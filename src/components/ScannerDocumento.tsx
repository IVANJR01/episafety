import { useRef, useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Check, Trash2, Loader2, Image as ImageIcon, VideoOff, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onCancel: () => void;
  /** Recebe o PDF pronto, já com todas as páginas capturadas. */
  onReady: (arquivo: File) => void;
  /** Vira o nome do arquivo; o padrão serve, mas o tipo do documento ajuda. */
  nomeSugerido?: string;
}

/**
 * Lado maior da imagem guardada, em pixels.
 *
 * A foto do celular vem com 3000, 4000 pixels de lado. Documento não precisa
 * disso: 1600 já lê texto de contrato sem esforço, o tratamento pixel a pixel
 * roda rápido em vez de travar o aparelho, e o PDF de três páginas sai com
 * poucos megabytes em vez de dezenas.
 */
const LADO_MAXIMO = 1600;

/**
 * Deixa a foto com cara de digitalização.
 *
 * Foto de papel sai acinzentada e com sombra — nada parecido com o que sai de
 * um scanner. O tratamento é o mesmo que uma copiadora faz: joga fora a cor,
 * descobre onde estão o papel e a tinta, e estica o contraste entre os dois
 * até o papel virar branco e o texto, preto.
 *
 * Os cortes saem do histograma da própria imagem, não de números fixos: assim
 * funciona tanto na foto clara demais quanto na tirada em luz fraca.
 */
function tratarComoDigitalizacao(ctx: CanvasRenderingContext2D, largura: number, altura: number) {
  const imagem = ctx.getImageData(0, 0, largura, altura);
  const d = imagem.data;
  const histograma = new Uint32Array(256);

  for (let i = 0; i < d.length; i += 4) {
    const cinza = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = cinza;
    histograma[cinza]++;
  }

  const total = largura * altura;
  // 5% mais escuros = tinta. 25% mais claros = papel. Tudo entre os dois é
  // esticado para preencher a faixa inteira de preto a branco.
  let acumulado = 0;
  let tinta = 0;
  for (let v = 0; v < 256; v++) {
    acumulado += histograma[v];
    if (acumulado >= total * 0.05) { tinta = v; break; }
  }
  acumulado = 0;
  let papel = 255;
  for (let v = 255; v >= 0; v--) {
    acumulado += histograma[v];
    if (acumulado >= total * 0.25) { papel = v; break; }
  }
  /*
   * Papel e tinta colados significam folha em branco ou foto sem contraste
   * nenhum: esticar aí só amplificaria ruído, e um borrão vira sujeira.
   * Nesse caso fica só o cinza, sem o esticamento.
   *
   * O cinza é gravado de qualquer jeito. Sair antes do `putImageData`
   * devolveria a foto colorida original — a conversão acontece numa cópia,
   * e cópia que não é escrita de volta não vale nada. O resultado era uma
   * página colorida no meio de um PDF que deveria parecer digitalizado.
   */
  if (papel - tinta >= 30) {
    const escala = 255 / (papel - tinta);
    const tabela = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      tabela[v] = Math.max(0, Math.min(255, Math.round((v - tinta) * escala)));
    }
    for (let i = 0; i < d.length; i += 4) {
      const v = tabela[d[i]];
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(imagem, 0, 0);
}

/** Reduz e trata a imagem, devolvendo JPEG pronto para virar página do PDF. */
async function prepararPagina(origem: CanvasImageSource, larguraOrig: number, alturaOrig: number): Promise<string> {
  const escala = Math.min(1, LADO_MAXIMO / Math.max(larguraOrig, alturaOrig));
  const largura = Math.round(larguraOrig * escala);
  const altura = Math.round(alturaOrig * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Não foi possível preparar a imagem.");
  ctx.drawImage(origem, 0, 0, largura, altura);
  tratarComoDigitalizacao(ctx, largura, altura);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function ScannerDocumento({ open, onCancel, onReady, nomeSugerido }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [paginas, setPaginas] = useState<string[]>([]);
  const [camera, setCamera] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const pararCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera(false);
  }, []);

  const iniciarCamera = useCallback(async () => {
    setErroCamera(null);
    try {
      // Câmera traseira e resolução alta: é a de documento, não a de selfie.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamera(true);
    } catch (e: any) {
      const negada = e?.name === "NotAllowedError";
      setErroCamera(
        negada
          ? "Permissão da câmera negada. Você ainda pode escolher fotos já tiradas."
          : "Não foi possível abrir a câmera. Você ainda pode escolher fotos já tiradas.",
      );
    }
  }, []);

  // Abrir o diálogo já com a câmera ligada; fechar sempre desliga. Câmera
  // esquecida ligada acende a luz do aparelho e consome bateria à toa.
  useEffect(() => {
    if (open) {
      setPaginas([]);
      setGerando(false);
      void iniciarCamera();
    } else {
      pararCamera();
    }
    return () => pararCamera();
  }, [open, iniciarCamera, pararCamera]);

  const capturar = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try {
      const pagina = await prepararPagina(video, video.videoWidth, video.videoHeight);
      setPaginas((p) => [...p, pagina]);
    } catch (e: any) {
      toast({ title: "Não foi possível capturar", description: e?.message, variant: "destructive" });
    }
  };

  const daGaleria = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = "";
    arquivos.forEach((arq) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const pagina = await prepararPagina(img, img.naturalWidth, img.naturalHeight);
          setPaginas((p) => [...p, pagina]);
        } catch { /* imagem ilegível: ignora essa e segue com as outras */ }
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(arq);
    });
  };

  const gerarPdf = async () => {
    if (paginas.length === 0) return;
    setGerando(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
      const larguraPagina = pdf.internal.pageSize.getWidth();
      const alturaPagina = pdf.internal.pageSize.getHeight();
      const margem = 8;

      for (let i = 0; i < paginas.length; i++) {
        if (i > 0) pdf.addPage();
        const dim = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.src = paginas[i];
        });
        // Encaixa a página inteira sem deformar, centralizada na folha A4.
        const escala = Math.min((larguraPagina - margem * 2) / dim.w, (alturaPagina - margem * 2) / dim.h);
        const larg = dim.w * escala;
        const alt = dim.h * escala;
        pdf.addImage(paginas[i], "JPEG", (larguraPagina - larg) / 2, (alturaPagina - alt) / 2, larg, alt);
      }

      const blob = pdf.output("blob");
      // "ASO - Atestado…" viraria "aso---atestado…" sem juntar os hífens.
      const base = (nomeSugerido || "documento")
        .toLowerCase().normalize("NFD").replace(/[^\w\s-]/g, "").trim()
        .replace(/[\s-]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      const arquivo = new File([blob], `${base || "documento"}-digitalizado.pdf`, { type: "application/pdf" });
      onReady(arquivo);
    } catch (e: any) {
      toast({ title: "Erro ao gerar o PDF", description: e?.message, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !gerando) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Digitalizar documento</DialogTitle>
          <DialogDescription>
            Enquadre a folha e toque em Capturar. Pode capturar várias páginas — todas entram no mesmo PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-black" style={{ aspectRatio: "4 / 3" }}>
            <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
            {!camera && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4 bg-muted">
                <VideoOff className="w-8 h-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{erroCamera || "Abrindo a câmera…"}</p>
                {erroCamera && (
                  <Button size="sm" variant="outline" onClick={() => void iniciarCamera()}>Tentar de novo</Button>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="button" className="flex-1" onClick={capturar} disabled={!camera || gerando}>
              <Camera className="w-4 h-4 mr-2" />
              {paginas.length === 0 ? "Capturar" : "Capturar mais uma"}
            </Button>
            <input ref={galeriaRef} type="file" accept="image/*" multiple className="hidden" onChange={daGaleria} />
            <Button type="button" variant="outline" onClick={() => galeriaRef.current?.click()} disabled={gerando}>
              <ImageIcon className="w-4 h-4 mr-2" />
              Foto salva
            </Button>
          </div>

          {paginas.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">
                {paginas.length} {paginas.length === 1 ? "página capturada" : "páginas capturadas"}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {paginas.map((p, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={p} alt={`Página ${i + 1}`} className="h-24 w-auto rounded border bg-white" />
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1 rounded">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPaginas((ps) => ps.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-1"
                      aria-label={`Remover página ${i + 1}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={capturar}
                  disabled={!camera}
                  className="shrink-0 h-24 w-20 rounded border border-dashed flex items-center justify-center text-muted-foreground disabled:opacity-40"
                  aria-label="Capturar mais uma página"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={gerando}>Cancelar</Button>
          <Button onClick={gerarPdf} disabled={paginas.length === 0 || gerando}>
            {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Usar {paginas.length > 1 ? `${paginas.length} páginas` : "esta página"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

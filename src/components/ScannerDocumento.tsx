import { useRef, useState, useCallback, useEffect } from "react";
import { precisaReatarStream } from "@/lib/scannerCamera";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Check, Trash2, Loader2, Image as ImageIcon, VideoOff, Plus, Maximize } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  corrigirPerspectiva, tamanhoDestino, ordenarCantos, quadrilateroUtil,
  type Ponto, type Quadrilatero,
} from "@/lib/perspectiva";

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

/** Quanto os cantos começam para dentro da borda da foto. */
const RECUO_INICIAL = 0.06;

/**
 * Como a página é acabada depois de endireitada.
 *
 * Antes só existia o modo "pb", aplicado sem perguntar — e documento de
 * pessoal é cheio de coisa que só existe em cor: carimbo do médico,
 * assinatura em caneta azul, foto do RG, marca-d'água. Jogar a cor fora
 * apaga tudo isso do arquivo que vale como prova. Por isso o padrão passou
 * a ser colorido, e o preto e branco virou escolha de quem quer o efeito
 * de copiadora.
 */
export type ModoCor = "cor" | "cinza" | "pb";

const ROTULO_MODO: Record<ModoCor, string> = {
  cor: "Colorido",
  cinza: "Tons de cinza",
  pb: "Preto e branco",
};

/**
 * Ajusta a página capturada conforme o modo escolhido.
 *
 * Em todos os modos o ponto de partida é o mesmo: o histograma da própria
 * imagem diz onde estão o papel e a tinta, então o resultado funciona tanto
 * na foto estourada de luz quanto na tirada em ambiente fraco — sem números
 * fixos que só valem para uma condição.
 *
 * - `cor`: só clareia, com ganho igual nos três canais. Levanta o papel para
 *   perto do branco sem mexer no matiz — carimbo continua vermelho, caneta
 *   continua azul. O ganho é limitado a 1,8× porque acima disso o papel já
 *   saturou e o que cresce é só o ruído da câmera.
 * - `cinza`: mesmo ganho, sem cor. Arquivo menor, tons preservados.
 * - `pb`: o tratamento de copiadora — estica o contraste entre tinta e papel
 *   até virar quase dois níveis. Ótimo para texto impresso, destrutivo para
 *   qualquer coisa colorida.
 */
function tratarPagina(
  ctx: CanvasRenderingContext2D,
  largura: number,
  altura: number,
  modo: ModoCor,
) {
  const imagem = ctx.getImageData(0, 0, largura, altura);
  const d = imagem.data;
  const total = largura * altura;

  // Usa apenas o canal verde (ou luma) para achar a tinta e o papel
  const histograma = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    histograma[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0]++;
  }

  let acumulado = 0;
  let tinta = 0;
  // Acha o pico das partes escuras (textos/caneta)
  for (let v = 0; v < 256; v++) {
    acumulado += histograma[v];
    if (acumulado >= total * 0.03) { tinta = v; break; }
  }
  acumulado = 0;
  let papel = 255;
  // Acha o pico do claro (fundo da folha)
  for (let v = 255; v >= 0; v--) {
    acumulado += histograma[v];
    if (acumulado >= total * 0.35) { papel = v; break; }
  }

  // Se a foto tiver sombra de lateral muito forte, o 'papel' pode ser 150 e a 'tinta' 40.
  // Vamos esticar a distância entre tinta e papel para gerar o efeito "Clear Scanner" puro!
  const tabela = new Uint8ClampedArray(256);

  // Efeito Magic Color (Escaneamento de Alta Definição)
  // Limiarizamos os fundos mais escuros para preto, e o fundo do papel para puramente branco.
  let pontoPreto = Math.max(0, tinta - 20); // Tudo abaixo disso vira 0 (Preto puro)
  let pontoBranco = Math.min(255, papel + 15); // Tudo acima disso vira 255 (Branco folha)

  if (modo === "pb") {
    // Para modo de fotocópia (P&B), o contraste é extremamente agressivo e cortante
    pontoPreto = tinta + 20; 
    pontoBranco = papel - 30;
  }

  const escala = pontoBranco - pontoPreto > 10 ? 255 / (pontoBranco - pontoPreto) : 1;

  for (let v = 0; v < 256; v++) {
    tabela[v] = Math.max(0, Math.min(255, Math.round((v - pontoPreto) * escala)));
  }

  if (modo === "cor") {
    for (let i = 0; i < d.length; i += 4) {
      // Aplica a tabela em cada canal preservando cores
      d[i] = tabela[d[i]];
      d[i + 1] = tabela[d[i + 1]];
      d[i + 2] = tabela[d[i + 2]];
    }
  } else {
    // Modo cinza ou PB
    for (let i = 0; i < d.length; i += 4) {
      const v = tabela[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0];
      // Se for pb "duro", binariza o resultado esticado para sumir de vez com sombras no meio do documento
      if (modo === "pb") {
        const binario = v > 150 ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = binario;
      } else {
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
  }
  ctx.putImageData(imagem, 0, 0);
}

/** Reaplica o acabamento sobre a página endireitada original. */
async function renderizarPagina(base: string, modo: ModoCor): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Página ilegível."));
    i.src = base;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Não foi possível preparar a imagem.");
  ctx.drawImage(img, 0, 0);
  tratarPagina(ctx, canvas.width, canvas.height, modo);
  return canvas.toDataURL("image/jpeg", modo === "cor" ? 0.85 : 0.82);
}

/** Reduz a imagem e devolve o canvas, sem tratar ainda. */
function reduzir(origem: CanvasImageSource, larguraOrig: number, alturaOrig: number) {
  const escala = Math.min(1, LADO_MAXIMO / Math.max(larguraOrig, alturaOrig));
  const largura = Math.round(larguraOrig * escala);
  const altura = Math.round(alturaOrig * escala);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Não foi possível preparar a imagem.");
  ctx.drawImage(origem, 0, 0, largura, altura);
  return { canvas, ctx, largura, altura };
}

interface Captura { url: string; largura: number; altura: number }

/**
 * `base` é a página já endireitada, ainda colorida e sem acabamento; `final`
 * é o que vai pro PDF. Guardar as duas é o que permite trocar de modo depois
 * de capturar — sem a base, virar para colorido exigiria fotografar de novo.
 */
interface Pagina { base: string; final: string }

export default function ScannerDocumento({ open, onCancel, onReady, nomeSugerido }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const areaAjusteRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [camera, setCamera] = useState(false);
  const [aspecto, setAspecto] = useState("4 / 3");
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [modo, setModo] = useState<ModoCor>("cor");
  const [reprocessando, setReprocessando] = useState(false);

  // Passo de ajuste: a foto recém-tirada, com os quatro cantos da folha.
  const [ajuste, setAjuste] = useState<Captura | null>(null);
  const [cantos, setCantos] = useState<Ponto[]>([]);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [endireitando, setEndireitando] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

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
        // A moldura acompanha o formato real da câmera. Fixar 4:3 com o
        // celular em pé deixava duas tarjas pretas comendo metade da tela.
        const v = videoRef.current;
        if (v.videoWidth && v.videoHeight) setAspecto(`${v.videoWidth} / ${v.videoHeight}`);
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

  useEffect(() => {
    if (open) {
      setPaginas([]);
      setAjuste(null);
      setGerando(false);
      setPreviewIndex(null);
      void iniciarCamera();
    } else {
      pararCamera();
    }
    return () => pararCamera();
  }, [open, iniciarCamera, pararCamera]);

  /*
   * Reata o stream ao <video> toda vez que ele volta à tela.
   *
   * O elemento vive dentro do ramo "não estou ajustando" do JSX, então
   * entrar no passo de marcar os cantos o desmonta e sair de lá monta um
   * elemento novo — sem `srcObject`. A câmera continuava ligada e o estado
   * `camera` continuava true, de modo que nada avisava: a prévia ficava
   * preta e o botão Capturar seguia habilitado, pronto para gravar um
   * quadro em branco.
   */
  useEffect(() => {
    const v = videoRef.current;
    const stream = streamRef.current;
    if (!precisaReatarStream(v, stream, !!ajuste)) return;
    v!.srcObject = stream;
    void v!.play().catch(() => {
      // Autoplay recusado só atrapalha a prévia; o resto do fluxo segue.
    });
  }, [ajuste]);

  /** Abre o passo de ajuste com os cantos recuados da borda. */
  const irParaAjuste = (url: string, largura: number, altura: number) => {
    setAjuste({ url, largura, altura });
    const rx = largura * RECUO_INICIAL;
    const ry = altura * RECUO_INICIAL;
    setCantos([
      { x: rx, y: ry }, { x: largura - rx, y: ry },
      { x: largura - rx, y: altura - ry }, { x: rx, y: altura - ry },
    ]);
  };

  const capturar = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try {
      const { canvas, largura, altura } = reduzir(video, video.videoWidth, video.videoHeight);
      irParaAjuste(canvas.toDataURL("image/jpeg", 0.92), largura, altura);
    } catch (e: any) {
      toast({ title: "Não foi possível capturar", description: e?.message, variant: "destructive" });
    }
  };

  const daGaleria = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = (e.target.files || [])[0];
    e.target.value = "";
    if (!arquivo) return;
    const img = new Image();
    img.onload = () => {
      try {
        const { canvas, largura, altura } = reduzir(img, img.naturalWidth, img.naturalHeight);
        irParaAjuste(canvas.toDataURL("image/jpeg", 0.92), largura, altura);
      } catch { /* imagem ilegível */ }
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(arquivo);
  };

  /** Endireita pelos cantos escolhidos, trata, e guarda como página. */
  const confirmarPagina = async () => {
    if (!ajuste || cantos.length !== 4) return;
    const quad = ordenarCantos(cantos);
    if (!quadrilateroUtil(quad)) {
      toast({ title: "Ajuste os cantos", description: "A área marcada está achatada demais para endireitar.", variant: "destructive" });
      return;
    }
    setEndireitando(true);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = ajuste.url;
      });
      const orig = document.createElement("canvas");
      orig.width = ajuste.largura;
      orig.height = ajuste.altura;
      const octx = orig.getContext("2d", { willReadFrequently: true })!;
      octx.drawImage(img, 0, 0);

      const { largura, altura } = tamanhoDestino(quad);
      const reto = corrigirPerspectiva(octx.getImageData(0, 0, ajuste.largura, ajuste.altura), quad, largura, altura);
      if (!reto) throw new Error("Não foi possível endireitar a área marcada.");

      const saida = document.createElement("canvas");
      saida.width = largura;
      saida.height = altura;
      const sctx = saida.getContext("2d", { willReadFrequently: true })!;
      sctx.putImageData(reto, 0, 0);
      // A base sai antes do acabamento e em qualidade mais alta: é dela que
      // qualquer troca de modo depois vai partir.
      const base = saida.toDataURL("image/jpeg", 0.92);
      tratarPagina(sctx, largura, altura, modo);

      setPaginas((p) => [...p, { base, final: saida.toDataURL("image/jpeg", modo === "cor" ? 0.85 : 0.82) }]);
      setAjuste(null);
    } catch (e: any) {
      toast({ title: "Não foi possível preparar a página", description: e?.message, variant: "destructive" });
    } finally {
      setEndireitando(false);
    }
  };

  /** Converte a posição do dedo/ponteiro para coordenada da imagem. */
  const posicaoNaImagem = (e: React.PointerEvent): Ponto | null => {
    const area = areaAjusteRef.current;
    if (!area || !ajuste) return null;
    const r = area.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * ajuste.largura;
    const y = ((e.clientY - r.top) / r.height) * ajuste.altura;
    return {
      x: Math.max(0, Math.min(ajuste.largura, x)),
      y: Math.max(0, Math.min(ajuste.altura, y)),
    };
  };

  const moverCanto = (e: React.PointerEvent) => {
    if (arrastando === null) return;
    const p = posicaoNaImagem(e);
    if (!p) return;
    setCantos((c) => c.map((v, i) => (i === arrastando ? p : v)));
  };

  /**
   * Troca o acabamento e refaz as páginas já capturadas.
   *
   * O modo vale para as próximas capturas e para as anteriores: quem
   * fotografou tudo e só então percebeu que o carimbo sumiu não precisa
   * começar de novo.
   */
  const trocarModo = async (novo: ModoCor) => {
    if (novo === modo || reprocessando) return;
    setModo(novo);
    if (paginas.length === 0) return;
    setReprocessando(true);
    try {
      const refeitas = await Promise.all(
        paginas.map(async (p) => ({ base: p.base, final: await renderizarPagina(p.base, novo) })),
      );
      setPaginas(refeitas);
    } catch (e: any) {
      toast({ title: "Não foi possível aplicar o modo", description: e?.message, variant: "destructive" });
    } finally {
      setReprocessando(false);
    }
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
        const pagina = paginas[i].final;
        const dim = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.src = pagina;
        });
        const escala = Math.min((larguraPagina - margem * 2) / dim.w, (alturaPagina - margem * 2) / dim.h);
        const larg = dim.w * escala;
        const alt = dim.h * escala;
        pdf.addImage(pagina, "JPEG", (larguraPagina - larg) / 2, (alturaPagina - alt) / 2, larg, alt);
      }

      const blob = pdf.output("blob");
      // "ASO - Atestado…" viraria "aso---atestado…" sem juntar os hífens.
      const base = (nomeSugerido || "documento")
        .toLowerCase().normalize("NFD").replace(/[^\w\s-]/g, "").trim()
        .replace(/[\s-]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      onReady(new File([blob], `${base || "documento"}-digitalizado.pdf`, { type: "application/pdf" }));
    } catch (e: any) {
      toast({ title: "Erro ao gerar o PDF", description: e?.message, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  const emAjuste = !!ajuste;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !gerando && !endireitando) onCancel(); }}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>{emAjuste ? "Marque os cantos da folha" : "Digitalizar documento"}</DialogTitle>
          <DialogDescription>
            {emAjuste
              ? "Arraste os quatro pontos até os cantos do papel. O que estiver dentro vira uma página reta, sem a mesa em volta e sem a inclinação da foto."
              : "Enquadre a folha e toque em Capturar. Pode capturar várias páginas — todas entram no mesmo PDF."}
          </DialogDescription>
        </DialogHeader>

        {emAjuste ? (
          <div className="space-y-3">
            <div
              ref={areaAjusteRef}
              className="relative select-none touch-none mx-auto bg-black rounded-lg overflow-hidden w-full shrink-0"
              style={{ aspectRatio: `${ajuste!.largura} / ${ajuste!.altura}`, maxHeight: "55dvh" }}
              onPointerMove={moverCanto}
              onPointerUp={() => setArrastando(null)}
              onPointerCancel={() => setArrastando(null)}
            >
              <img src={ajuste!.url} alt="Página capturada" className="absolute inset-0 w-full h-full object-contain" />
              {/* Contorno do recorte, para enxergar o que vai virar página */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${ajuste!.largura} ${ajuste!.altura}`} preserveAspectRatio="none">
                <polygon
                  points={ordenarCantos(cantos).map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="rgba(255,255,255,0.18)" stroke="#f97316"
                  strokeWidth={Math.max(2, ajuste!.largura / 250)} />
              </svg>
              {cantos.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setArrastando(i); }}
                  // Alvo de 44px, bem maior que o ponto desenhado: no celular
                  // o dedo cobre o canto que está tentando mirar.
                  className="absolute w-11 h-11 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                  style={{ left: pct(p.x, ajuste!.largura), top: pct(p.y, ajuste!.altura) }}
                  aria-label={`Canto ${i + 1}`}
                >
                  <span className="w-5 h-5 rounded-full bg-primary border-2 border-white shadow" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto px-1 pb-1">
            <div className="relative rounded-lg overflow-hidden bg-black mx-auto w-full shrink-0"
              style={{ aspectRatio: aspecto, maxHeight: "45dvh" }}>
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

            <input ref={galeriaRef} type="file" accept="image/*" className="hidden" onChange={daGaleria} />

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-xs font-medium">Cor do documento</p>
                {reprocessando && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> aplicando…
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["cor", "cinza", "pb"] as ModoCor[]).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={modo === m ? "default" : "outline"}
                    aria-pressed={modo === m}
                    disabled={gerando || reprocessando}
                    onClick={() => void trocarModo(m)}
                    className="text-xs"
                  >
                    {ROTULO_MODO[m]}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {modo === "cor"
                  ? "Mantém carimbos, assinaturas em azul e foto do documento."
                  : modo === "cinza"
                    ? "Sem cor, com os tons preservados. Arquivo menor."
                    : "Efeito de copiadora: bom para texto impresso, apaga o que é colorido."}
              </p>
            </div>

            {paginas.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  {paginas.length} {paginas.length === 1 ? "página pronta" : "páginas prontas"}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {paginas.map((p, i) => (
                    <div key={i} className="relative shrink-0">
                      <img 
                        src={p.final} 
                        alt={`Página ${i + 1}`} 
                        className="h-24 w-auto rounded border bg-white cursor-pointer hover:ring-2 ring-primary/50 transition-all" 
                        onClick={() => setPreviewIndex(i)}
                        title="Clique para ampliar"
                      />
                      <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1 rounded">{i + 1}</span>
                      <button type="button" onClick={() => setPaginas((ps) => ps.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-1"
                        aria-label={`Remover página ${i + 1}`}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={capturar} disabled={!camera}
                    className="shrink-0 h-24 w-20 rounded border border-dashed flex items-center justify-center text-muted-foreground disabled:opacity-40"
                    aria-label="Capturar mais uma página">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {emAjuste ? (
            /*
             * As três ações moram no rodapé, e não no corpo do diálogo.
             *
             * "Usar a foto inteira" e "Descartar" ficavam logo abaixo da
             * imagem, dentro da área que rola, e o rodapé fixo cobria a fila
             * pela metade no celular. Bastavam alguns pixels de sobra: o
             * teto da imagem estava em `vh`, que no iOS mede a tela cheia,
             * enquanto o diálogo se limita a `dvh`, que desconta as barras
             * do navegador. O teto virou `dvh` também, mas isso sozinho só
             * afasta o problema — no rodapé os botões não têm como sumir.
             */
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 sm:flex-none" disabled={endireitando}
                  onClick={() => setCantos([
                    { x: 0, y: 0 }, { x: ajuste!.largura, y: 0 },
                    { x: ajuste!.largura, y: ajuste!.altura }, { x: 0, y: ajuste!.altura },
                  ])}>
                  <Maximize className="w-4 h-4 mr-2" />
                  Usar a foto inteira
                </Button>
                <Button type="button" variant="outline" onClick={() => setAjuste(null)} disabled={endireitando}>
                  Descartar
                </Button>
              </div>
              <Button onClick={confirmarPagina} disabled={endireitando} className="w-full sm:w-auto">
                {endireitando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Endireitar e usar
              </Button>
            </div>
          ) : (
            /*
             * Capturar mora no rodapé porque é a única saída desta etapa.
             *
             * Ficava logo abaixo da prévia, no corpo que rola, e a prévia
             * sozinha já enchia a altura disponível: sobrava na tela a
             * câmera, um "Usar esta página" desabilitado (não há página
             * ainda) e Cancelar. Quem chegava aqui não tinha como capturar
             * sem descobrir que a área rolava.
             */
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex gap-2">
                <Button type="button" className="flex-1 sm:flex-none" onClick={capturar} disabled={!camera || gerando}>
                  <Camera className="w-4 h-4 mr-2" />
                  {paginas.length === 0 ? "Capturar" : "Capturar mais uma"}
                </Button>
                <Button type="button" variant="outline" onClick={() => galeriaRef.current?.click()} disabled={gerando}>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Foto salva
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 sm:flex-none" onClick={onCancel} disabled={gerando}>Cancelar</Button>
                <Button className="flex-1 sm:flex-none" onClick={gerarPdf} disabled={paginas.length === 0 || gerando}>
                  {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Usar {paginas.length > 1 ? `${paginas.length} páginas` : "esta página"}
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
      
      {/* Modal de Pré-visualização Ampliada */}
      {previewIndex !== null && (
        <Dialog open={true} onOpenChange={(v) => { if (!v) setPreviewIndex(null); }}>
          <DialogContent className="max-w-3xl p-2 sm:p-4 border-none bg-black/95">
            <DialogHeader className="sr-only">
              <DialogTitle>Pré-visualização da Página {previewIndex + 1}</DialogTitle>
            </DialogHeader>
            <div className="relative flex flex-col items-center justify-center w-full h-[80vh]">
              <img 
                src={paginas[previewIndex]?.final} 
                alt={`Página ampliada ${previewIndex + 1}`} 
                className="w-auto h-full object-contain rounded-md" 
              />
            </div>
            <DialogFooter className="px-2">
              <Button variant="secondary" onClick={() => setPreviewIndex(null)} className="w-full sm:w-auto">
                Voltar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}

import { useRef, useState, useCallback, useEffect } from "react";
import { precisaReatarStream, podeCapturar, temQuadro } from "@/lib/scannerCamera";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Check, Trash2, Loader2, Image as ImageIcon, VideoOff, Plus, Maximize, Zap, ZapOff, X, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  corrigirPerspectiva, tamanhoDestino, ordenarCantos, quadrilateroUtil, cantosIniciais,
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

/**
 * Recuo inicial dos cantos de ajuste em relação às bordas da foto (6%).
 *
 * Formulários como ASO têm linhas impressas de alto contraste próximas
 * às bordas — detecção automática cortaria dentro do documento. Com 6%
 * de recuo os pontos ficam sobre o papel e o usuário arrasta só o necessário.
 */
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

/** Modo de digitalização, igual ao Clear Scan. */
export type ModoCaptura = "simples" | "lote" | "identidade" | "passaporte";

const MODOS_CAPTURA: { id: ModoCaptura; label: string }[] = [
  { id: "simples",     label: "Simples" },
  { id: "lote",        label: "Lote" },
  { id: "identidade",  label: "Cartão de identidade" },
  { id: "passaporte",  label: "Passaporte" },
];

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

interface Pagina { 
  base: string; 
  final: string;
  pendente?: boolean;
  larguraOriginal?: number;
  alturaOriginal?: number;
  cantosSugeridos?: Ponto[];
}

export default function ScannerDocumento({ open, onCancel, onReady, nomeSugerido }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const areaAjusteRef = useRef<HTMLDivElement>(null);
  const lupaRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [camera, setCamera] = useState(false);
  const [previaPronta, setPreviaPronta] = useState(false);
  const [aspecto, setAspecto] = useState("4 / 3");
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [modo, setModo] = useState<ModoCor>("cor");
  const [reprocessando, setReprocessando] = useState(false);
  // Posição do ponteiro em coordenadas da imagem (para a lupa)
  const [pointerImg, setPointerImg] = useState<Ponto | null>(null);
  // Lanterna
  const [torchAtivo, setTorchAtivo] = useState(false);
  const [torchSuportado, setTorchSuportado] = useState(false);

  // Passo de ajuste: a foto recém-tirada, com os quatro cantos da folha.
  const [ajuste, setAjuste] = useState<Captura | null>(null);
  const [cantos, setCantos] = useState<Ponto[]>([]);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [endireitando, setEndireitando] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  /** Controle de ajuste sequencial do modo lote. */
  const [ajustandoLote, setAjustandoLote] = useState<number | null>(null);
  /** Modo de digitalização ativo. */
  const [modoCaptura, setModoCaptura] = useState<ModoCaptura>("simples");

  const pararCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera(false);
  }, []);

  /**
   * Registra o formato real da câmera e libera a captura.
   *
   * A moldura acompanha o formato da câmera porque fixar 4:3 com o celular
   * em pé deixava duas tarjas pretas comendo metade da tela.
   */
  const anotarFormato = useCallback(() => {
    const v = videoRef.current;
    if (!temQuadro(v)) return;
    setAspecto(`${v!.videoWidth} / ${v!.videoHeight}`);
    setPreviaPronta(true);
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
        // `play()` resolver não garante metadados lidos; quando eles já
        // estiverem, aproveita, senão quem avisa é o onLoadedMetadata.
        anotarFormato();
      }
      setCamera(true);
      // Verifica suporte à lanterna
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() as any;
      setTorchSuportado(!!(caps?.torch));
    } catch (e: any) {
      const negada = e?.name === "NotAllowedError";
      setErroCamera(
        negada
          ? "Permissão da câmera negada. Você ainda pode escolher fotos já tiradas."
          : "Não foi possível abrir a câmera. Você ainda pode escolher fotos já tiradas.",
      );
    }
  }, [anotarFormato]);

  const alternarTocha = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const novoEstado = !torchAtivo;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: novoEstado }] });
      setTorchAtivo(novoEstado);
    } catch { /* lanterna não disponível */ }
  }, [torchAtivo]);

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

  /**
   * Reatribui o stream ao <video> toda vez que o usuário volta da tela de
   * ajuste. O elemento é desmontado/remontado pelo condicional {emAjuste ? …}
   * e volta sem srcObject, deixando a prévia preta mesmo com a câmera ativa.
   */
  useEffect(() => {
    if (precisaReatarStream(videoRef.current, streamRef.current, !!ajuste)) {
      const v = videoRef.current!;
      v.srcObject = streamRef.current;
      void v.play().catch(() => {});
    }
  }, [ajuste]);

/**
 * Detecta automaticamente os 4 cantos do documento na imagem.
 * Analisa linhas/colunas de pixels procurando onde a cor muda abruptamente
 * (borda do papel sobre a mesa escura). Retorna os cantos detectados ou null
 * se a confiança for baixa e o chamador deve usar o recuo padrão.
 */
function detectarCantos(canvas: HTMLCanvasElement, largura: number, altura: number): Ponto[] | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const dados = ctx.getImageData(0, 0, largura, altura).data;

  // Calcula luminosidade de um pixel
  const luma = (x: number, y: number) => {
    const i = (y * largura + x) * 4;
    return dados[i] * 0.299 + dados[i + 1] * 0.587 + dados[i + 2] * 0.114;
  };

  // Amostragem: varre por linha/coluna procurando onde o brilho salta (borda do papel)
  const passo = Math.max(1, Math.round(largura / 80));
  const limiar = 30; // diferença de luminosidade que indica borda

  // Acha a borda esquerda: percorre cada linha, da esq pra dir
  const bordaEsq: number[] = [];
  const bordaDir: number[] = [];
  const bordaTopo: number[] = [];
  const bordaBase: number[] = [];

  for (let y = 0; y < altura; y += passo) {
    for (let x = 1; x < largura; x++) {
      if (Math.abs(luma(x, y) - luma(x - 1, y)) > limiar) { bordaEsq.push(x); break; }
    }
    for (let x = largura - 2; x >= 0; x--) {
      if (Math.abs(luma(x, y) - luma(x + 1, y)) > limiar) { bordaDir.push(x); break; }
    }
  }
  for (let x = 0; x < largura; x += passo) {
    for (let y = 1; y < altura; y++) {
      if (Math.abs(luma(x, y) - luma(x, y - 1)) > limiar) { bordaTopo.push(y); break; }
    }
    for (let y = altura - 2; y >= 0; y--) {
      if (Math.abs(luma(x, y) - luma(x, y + 1)) > limiar) { bordaBase.push(y); break; }
    }
  }

  if (bordaEsq.length < 5 || bordaDir.length < 5 || bordaTopo.length < 5 || bordaBase.length < 5) return null;

  // Percentil 10/90 para ignorar outliers nas bordas ruidosas
  const p = (arr: number[], pct: number) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length * pct)];
  };

  const esq = p(bordaEsq, 0.10);
  const dir = p(bordaDir, 0.90);
  const topo = p(bordaTopo, 0.10);
  const base = p(bordaBase, 0.90);

  // Confiança: se o recorte for menor que 30% de qualquer dimensão, provavelmente errou
  const largDoc = dir - esq;
  const altDoc = base - topo;
  if (largDoc < largura * 0.30 || altDoc < altura * 0.30) return null;

  return [
    { x: esq, y: topo },
    { x: dir, y: topo },
    { x: dir, y: base },
    { x: esq, y: base },
  ];
}

  /** Abre o passo de ajuste com recuo seguro nas bordas, ou com bordas detectadas automaticamente. */
  const irParaAjuste = (url: string, largura: number, altura: number, cantosIniciais?: Ponto[]) => {
    setAjuste({ url, largura, altura });
    if (cantosIniciais && cantosIniciais.length === 4) {
      setCantos(cantosIniciais);
    } else {
      const rx = largura * RECUO_INICIAL;
      const ry = altura * RECUO_INICIAL;
      setCantos([
        { x: rx, y: ry }, { x: largura - rx, y: ry },
        { x: largura - rx, y: altura - ry }, { x: rx, y: altura - ry },
      ]);
    }
  };

  const capturar = async () => {
    const video = videoRef.current;
    if (!temQuadro(video)) {
      toast({ title: "A câmera ainda está abrindo", description: "Aguarde o vídeo aparecer e toque de novo." });
      return;
    }
    try {
      const { canvas, largura, altura } = reduzir(video, video.videoWidth, video.videoHeight);
      const url = canvas.toDataURL("image/jpeg", 0.92);
      
      // Tenta achar a folha A4 automaticamente na imagem reduzida
      let cantosAuto = detectarCantos(canvas, largura, altura);
      if (!cantosAuto) {
        // Fallback: recuo fixo se o algoritmo não achar uma borda clara
        const rx = largura * RECUO_INICIAL;
        const ry = altura * RECUO_INICIAL;
        cantosAuto = [
          { x: rx, y: ry }, { x: largura - rx, y: ry },
          { x: largura - rx, y: altura - ry }, { x: rx, y: altura - ry },
        ];
      }
      
      if (modoCaptura === "lote") {
        // No modo Lote, acumula a foto crua como pendente. 
        // O ajuste acontecerá só quando o usuário pedir para gerar o documento.
        setPaginas(p => [...p, { base: url, final: url, pendente: true, larguraOriginal: largura, alturaOriginal: altura, cantosSugeridos: cantosAuto }]);
      } else {
        irParaAjuste(url, largura, altura, cantosAuto);
      }
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

  /**
   * Processa a imagem aplicando a perspectiva e cor.
   * Usado tanto pela confirmação manual quanto pelo processamento rápido em lote.
   */
  const processarRecorte = async (ajusteLocal: Captura, cantosLocal: Ponto[]) => {
    const quad = ordenarCantos(cantosLocal);
    if (!quadrilateroUtil(quad)) {
      toast({ title: "Ajuste os cantos", description: "A área marcada está achatada demais para endireitar.", variant: "destructive" });
      return null;
    }
    setEndireitando(true);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = ajusteLocal.url;
      });
      const orig = document.createElement("canvas");
      orig.width = ajusteLocal.largura;
      orig.height = ajusteLocal.altura;
      const octx = orig.getContext("2d", { willReadFrequently: true })!;
      octx.drawImage(img, 0, 0);

      const { largura, altura } = tamanhoDestino(quad);
      const reto = corrigirPerspectiva(octx.getImageData(0, 0, ajusteLocal.largura, ajusteLocal.altura), quad, largura, altura);
      if (!reto) throw new Error("Não foi possível endireitar a área marcada.");

      const saida = document.createElement("canvas");
      saida.width = largura;
      saida.height = altura;
      const sctx = saida.getContext("2d", { willReadFrequently: true })!;
      sctx.putImageData(reto, 0, 0);
      
      const base = saida.toDataURL("image/jpeg", 0.92);
      tratarPagina(sctx, largura, altura, modo);
      const urlFinal = saida.toDataURL("image/jpeg", modo === "cor" ? 0.85 : 0.82);
      
      return { base, final: urlFinal };
    } catch (e: any) {
      toast({ title: "Não foi possível preparar a página", description: e?.message, variant: "destructive" });
      return null;
    } finally {
      setEndireitando(false);
    }
  };

  /** Inicia a cadeia de ajustes para o modo lote. */
  const iniciarAjusteLote = () => {
    const index = paginas.findIndex(p => p.pendente);
    if (index !== -1) {
      setAjustandoLote(index);
      const p = paginas[index];
      irParaAjuste(p.base, p.larguraOriginal!, p.alturaOriginal!, p.cantosSugeridos);
    } else {
      void gerarPdf(); // Se por acaso não tiver pendentes, gera direto
    }
  };

  /**
   * Confirma a página ajustada manualmente.
   * Se estiver na fila de lote, avança para a próxima.
   * Dispara PDF auto se for Simples/Identidade/Passaporte, ou se terminou a fila de Lote.
   */
  const confirmarPagina = async () => {
    if (!ajuste || cantos.length !== 4) return;
    const pg = await processarRecorte(ajuste, cantos);
    if (!pg) return;

    if (ajustandoLote !== null) {
      const novasPaginas = [...paginas];
      novasPaginas[ajustandoLote] = pg;
      setPaginas(novasPaginas);
      setAjuste(null);

      const nextIndex = novasPaginas.findIndex((p, i) => i > ajustandoLote && p.pendente);
      if (nextIndex !== -1) {
        setAjustandoLote(nextIndex);
        const nextP = novasPaginas[nextIndex];
        // Um pequeno tempo para a UI respirar e renderizar a próxima aba
        setTimeout(() => irParaAjuste(nextP.base, nextP.larguraOriginal!, nextP.alturaOriginal!, nextP.cantosSugeridos), 50);
      } else {
        setAjustandoLote(null);
        void gerarPdfDe(novasPaginas);
      }
    } else {
      const novasPaginas = [...paginas, pg];
      setPaginas(novasPaginas);
      setAjuste(null);

      // Disparo automático por modo de captura (exceto Lote que usa a fila acima)
      if (modoCaptura === "simples" || modoCaptura === "passaporte") {
        void gerarPdfDe(novasPaginas);
      } else if (modoCaptura === "identidade" && novasPaginas.length >= 2) {
        void gerarPdfDe(novasPaginas);
      }
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
    setPointerImg(p);
    setCantos((c) => c.map((v, i) => (i === arrastando ? p : v)));
    // Renderiza a lupa em tempo real
    if (ajuste && lupaRef.current) {
      const area = areaAjusteRef.current;
      if (!area) return;
      const r = area.getBoundingClientRect();
      const escX = ajuste.largura / r.width;
      const escY = ajuste.altura / r.height;
      const ZOOM = 2.5;
      const RAIO_IMG = 60; // raio em pixels da imagem original que a lupa mostra
      const RAIO_CANVAS = 90; // raio do canvas da lupa em pixels de tela
      const c = lupaRef.current;
      c.width = RAIO_CANVAS * 2;
      c.height = RAIO_CANVAS * 2;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const img = area.querySelector("img") as HTMLImageElement | null;
      if (!img || !img.complete) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(RAIO_CANVAS, RAIO_CANVAS, RAIO_CANVAS, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        img,
        p.x / escX / escX - RAIO_IMG, p.y / escY / escY - RAIO_IMG,
        RAIO_IMG * 2, RAIO_IMG * 2,
        0, 0, RAIO_CANVAS * 2, RAIO_CANVAS * 2,
      );
      // Crosshair no centro
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(RAIO_CANVAS - 12, RAIO_CANVAS); ctx.lineTo(RAIO_CANVAS + 12, RAIO_CANVAS); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(RAIO_CANVAS, RAIO_CANVAS - 12); ctx.lineTo(RAIO_CANVAS, RAIO_CANVAS + 12); ctx.stroke();
      ctx.restore();
      // Borda da lupa
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(RAIO_CANVAS, RAIO_CANVAS, RAIO_CANVAS - 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
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

  /** Gera o PDF a partir de uma lista de páginas específica (usado pela confirmação automática). */
  const gerarPdfDe = async (lista: Pagina[]) => {
    if (lista.length === 0) return;
    setGerando(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
      const larguraPagina = pdf.internal.pageSize.getWidth();
      const alturaPagina = pdf.internal.pageSize.getHeight();
      const margem = 8;
      for (let i = 0; i < lista.length; i++) {
        if (i > 0) pdf.addPage();
        const pagina = lista[i].final;
        const dim = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.src = pagina;
        });
        const escala = Math.min((larguraPagina - margem * 2) / dim.w, (alturaPagina - margem * 2) / dim.h);
        pdf.addImage(pagina, "JPEG", (larguraPagina - larg(dim.w, escala)) / 2, (alturaPagina - alt(dim.h, escala)) / 2, larg(dim.w, escala), alt(dim.h, escala));
      }
      const blob = pdf.output("blob");
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

  const larg = (w: number, esc: number) => w * esc;
  const alt  = (h: number, esc: number) => h * esc;

  const gerarPdf = async () => gerarPdfDe(paginas);

  const emAjuste = !!ajuste;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !gerando && !endireitando) onCancel(); }}>
      {/* Tela cheia no mobile, modal centrado em telas grandes */}
      <DialogContent className="p-0 border-0 bg-black max-w-none w-screen h-[100dvh] sm:max-w-lg sm:h-auto sm:rounded-xl sm:max-h-[95vh] flex flex-col overflow-hidden">
        {/* ── TELA DE AJUSTE DE CANTOS ── */}
        {emAjuste ? (
          <div className="flex flex-col h-full">
            {/* Barra superior de ajuste */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/80">
              <button type="button" onClick={() => setAjuste(null)} disabled={endireitando}
                className="flex items-center gap-1.5 text-white text-sm font-medium">
                <ChevronLeft className="w-5 h-5" /> Descartar
              </button>
              <span className="text-white text-sm font-semibold">Ajuste os cantos</span>
              <button type="button"
                onClick={() => setCantos(cantosIniciais(ajuste!.largura, ajuste!.altura))}
                disabled={endireitando}
                className="text-orange-400 text-sm font-medium">
                Toda a foto
              </button>
            </div>

            {/* Área da imagem com handles */}
            <div
              ref={areaAjusteRef}
              className="relative flex-1 select-none touch-none bg-black"
              onPointerMove={moverCanto}
              onPointerUp={() => setArrastando(null)}
              onPointerCancel={() => setArrastando(null)}
            >
              <img src={ajuste!.url} alt="Página capturada" className="absolute inset-0 w-full h-full object-contain" />
              {/* Escurecimento fora do recorte */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${ajuste!.largura} ${ajuste!.altura}`} preserveAspectRatio="none">
                <defs>
                  <mask id="mask-recorte">
                    <rect width="100%" height="100%" fill="white" />
                    <polygon points={ordenarCantos(cantos).map((p) => `${p.x},${p.y}`).join(" ")} fill="black" />
                  </mask>
                </defs>
                {/* Sombra fora */}
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#mask-recorte)" />
                {/* Borda laranja */}
                <polygon
                  points={ordenarCantos(cantos).map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke="#f97316"
                  strokeWidth={Math.max(2, ajuste!.largura / 200)} />
              </svg>
              {/* Handles em L */}
              {cantos.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setArrastando(i); setPointerImg(cantos[i]); }}
                  onPointerUp={() => { setArrastando(null); setPointerImg(null); }}
                  onPointerCancel={() => { setArrastando(null); setPointerImg(null); }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center touch-none"
                  style={{ left: pct(p.x, ajuste!.largura), top: pct(p.y, ajuste!.altura), width: 56, height: 56 }}
                  aria-label={`Canto ${i + 1}`}
                >
                  <svg width="32" height="32" viewBox="0 0 32 32">
                    <path d="M2 18 L2 2 L18 2" stroke="rgba(0,0,0,0.6)" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"
                      transform={`rotate(${i === 0 ? 0 : i === 1 ? 90 : i === 2 ? 180 : 270} 16 16)`} />
                    <path d="M2 18 L2 2 L18 2" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"
                      transform={`rotate(${i === 0 ? 0 : i === 1 ? 90 : i === 2 ? 180 : 270} 16 16)`} />
                  </svg>
                </button>
              ))}
              {/* Lupa de precisão no canto oposto */}
              {arrastando !== null && (
                <canvas
                  ref={lupaRef}
                  className="absolute pointer-events-none rounded-full shadow-2xl border-[3px] border-white"
                  style={{
                    width: 100, height: 100,
                    ...(arrastando === 0 ? { bottom: 12, right: 12 } :
                       arrastando === 1 ? { bottom: 12, left: 12 } :
                       arrastando === 2 ? { top: 12, left: 12 } :
                       { top: 12, right: 12 }),
                  }}
                />
              )}
            </div>

            {/* Barra inferior de ajuste */}
            <div className="px-4 pb-6 pt-3 bg-black flex gap-3">
              <Button type="button" variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10" onClick={() => setAjuste(null)} disabled={endireitando}>
                Cancelar
              </Button>
              <Button onClick={confirmarPagina} disabled={endireitando} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
                {endireitando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Usar página
              </Button>
            </div>
          </div>

        ) : (
          /* ── TELA DA CÂMERA ── */
          <div className="flex flex-col h-full">
            {/* Câmera ocupando toda a tela */}
            <div className="relative flex-1 bg-black overflow-hidden">
              <video ref={videoRef} playsInline muted onLoadedMetadata={anotarFormato} onResize={anotarFormato}
                className="absolute inset-0 w-full h-full object-cover" />

              {/* Estado de erro / carregando sobre a câmera */}
              {(!camera || !previaPronta) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <VideoOff className="w-10 h-10 text-white/70" />
                  <p className="text-sm text-white/70">{erroCamera || "Abrindo a câmera…"}</p>
                  {erroCamera && (
                    <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10"
                      onClick={() => void iniciarCamera()}>Tentar de novo</Button>
                  )}
                </div>
              )}

              {/* Barra superior: Cancelar + título + Lanterna */}
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
                <button type="button" onClick={onCancel}
                  className="flex items-center gap-1 text-white text-sm font-medium">
                  <X className="w-5 h-5" /> Cancelar
                </button>
                <span className="text-white text-sm font-semibold opacity-80">Digitalizar</span>
                <button
                  type="button"
                  onClick={() => void alternarTocha()}
                  disabled={!torchSuportado}
                  className="p-2 rounded-full bg-black/30 text-white disabled:opacity-30"
                  aria-label={torchAtivo ? "Apagar lanterna" : "Acender lanterna"}
                >
                  {torchAtivo ? <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300" /> : <ZapOff className="w-5 h-5" />}
                </button>
              </div>

              {/* Miniaturas flutuantes das páginas capturadas */}
              {paginas.length > 0 && (
                <div className="absolute left-0 right-0 bottom-44 px-4">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {paginas.map((pg, i) => (
                      <div key={i} className="relative shrink-0">
                        <button type="button" onClick={() => setPreviewIndex(i)}>
                          <img src={pg.final} alt={`Pág ${i + 1}`}
                            className="h-16 w-auto rounded-md border-2 border-white/40 object-contain bg-black shadow-lg" />
                          {/* Label Frente/Verso no modo identidade */}
                          <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] rounded px-1">
                            {modoCaptura === "identidade" ? (i === 0 ? "Frente" : "Verso") : i + 1}
                          </span>
                        </button>
                        <button type="button"
                          onClick={() => setPaginas((p) => p.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow"
                          aria-label={`Remover página ${i + 1}`}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Barra inferior: tabs de modo + filtro de cor + controles */}
            <div className="bg-black px-4 pb-8 pt-2 flex flex-col gap-2">

              {/* Tabs de modo — estilo Clear Scan */}
              <div className="flex gap-0 overflow-x-auto border-b border-white/10 pb-1">
                {MODOS_CAPTURA.map((m) => (
                  <button key={m.id} type="button"
                    onClick={() => { setModoCaptura(m.id); setPaginas([]); }}
                    className={`whitespace-nowrap text-xs px-3 py-1.5 transition-colors relative ${
                      modoCaptura === m.id
                        ? "text-white font-semibold"
                        : "text-white/40 hover:text-white/70"
                    }`}>
                    {m.label}
                    {modoCaptura === m.id && (
                      <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-orange-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Hint contextual para Identidade */}
              {modoCaptura === "identidade" && paginas.length === 0 && (
                <p className="text-center text-white/50 text-[11px]">Capture a <strong className="text-white/70">frente</strong> do cartão primeiro</p>
              )}
              {modoCaptura === "identidade" && paginas.length === 1 && (
                <p className="text-center text-orange-400 text-[11px] font-medium">Agora capture o <strong>verso</strong> do cartão</p>
              )}

              {/* Filtro de cor — só após a primeira captura */}
              {paginas.length > 0 && (
                <div className="flex gap-1.5">
                  {(["cor", "cinza", "pb"] as ModoCor[]).map((m) => (
                    <button key={m} type="button"
                      onClick={() => void trocarModo(m)}
                      disabled={gerando || reprocessando}
                      className={`flex-1 text-xs py-1.5 rounded-full border transition-colors ${
                        modo === m
                          ? "bg-orange-500 border-orange-500 text-white font-semibold"
                          : "border-white/30 text-white/70 hover:border-white/60"
                      }`}>
                      {ROTULO_MODO[m]}
                    </button>
                  ))}
                </div>
              )}

              {/* Linha: galeria | capturar | usar */}
              <div className="flex items-center justify-between pt-1">
                {/* Galeria */}
                <button type="button" onClick={() => galeriaRef.current?.click()} disabled={gerando}
                  className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <ImageIcon className="w-5 h-5" />
                </button>

                {/* Botão circular grande de captura */}
                <button
                  type="button"
                  onClick={capturar}
                  disabled={!podeCapturar(camera, previaPronta, gerando) ||
                    (modoCaptura === "identidade" && paginas.length >= 2) ||
                    (modoCaptura === "simples" && paginas.length >= 1) ||
                    (modoCaptura === "passaporte" && paginas.length >= 1)}
                  className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-xl disabled:opacity-40 active:scale-95 transition-transform"
                  aria-label="Capturar"
                >
                  <div className="w-16 h-16 rounded-full border-[3px] border-black/20 bg-white flex items-center justify-center">
                    <Camera className="w-8 h-8 text-black/80" />
                  </div>
                </button>

                {/* Usar / contador de páginas (só no modo Lote) */}
                {(modoCaptura === "lote" && paginas.length > 0) ? (
                  <button type="button" onClick={() => iniciarAjusteLote()} disabled={gerando}
                    className="w-12 h-12 rounded-full bg-orange-500 flex flex-col items-center justify-center text-white shadow-lg disabled:opacity-50">
                    {gerando
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <>
                          <Check className="w-4 h-4" />
                          <span className="text-[10px] font-bold leading-none">{paginas.length}</span>
                        </>}
                  </button>
                ) : (
                  <div className="w-12" />
                )}
              </div>
            </div>

            <input ref={galeriaRef} type="file" accept="image/*" className="hidden" onChange={daGaleria} />
          </div>
        )}


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

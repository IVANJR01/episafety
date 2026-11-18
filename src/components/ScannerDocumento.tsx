import { useRef, useState, useCallback, useEffect } from "react";
import { precisaReatarStream, podeCapturar, temQuadro, encaixarNaArea, videoParaTela } from "@/lib/scannerCamera";
import { detectarFolha } from "@/lib/deteccaoFolha";
import {
  acompanharFolha, SEM_FOLHA, decidirCaptura, progressoDaCaptura, videoBastaComoFoto, type EstadoDaFolha,
} from "@/lib/folhaAoVivo";
import { acabarPagina, LADO_MAXIMO_PAGINA } from "@/lib/acabamentoScanner";
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
 * Lado maior da imagem guardada, em pixels: A4 a 300 DPI.
 *
 * Era 1600 (~137 DPI), com a justificativa de deixar o arquivo leve. Só
 * que documento de dossiê é prova: ASO, laudo, CNH, certificado de NR — e
 * letra miúda, CPF e número de registro saíam serrilhados. Ver
 * src/lib/acabamentoScanner.ts.
 */
const LADO_MAXIMO = LADO_MAXIMO_PAGINA;

/**
 * Recuo inicial dos cantos de ajuste em relação às bordas da foto (6%).
 *
 * Fallback caso a detecção automática falhe em encontrar a folha. Com 6%
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
  /*
   * Antes: uma curva de contraste única para a página inteira. Com a sombra
   * da mão num canto, o papel ali saía cinza-sujo — e no preto e branco, uma
   * mancha preta por cima do texto. Agora o fundo é estimado região por
   * região e a página é dividida por ele: sombra e luz amarela somem, a
   * tinta e as cores ficam. A regra, com teste, está em acabamentoScanner.
   */
  const imagem = ctx.getImageData(0, 0, largura, altura);
  acabarPagina(imagem.data, largura, altura, modo);
  ctx.putImageData(imagem, 0, 0);
}

/**
 * Como a página tratada é codificada.
 *
 * Preto e branco vai em PNG: só tem dois tons, o PNG fica pequeno e não
 * borra a borda das letras como o JPEG faz. Colorido e cinza vão em JPEG
 * de alta qualidade (0,92; antes 0,85 e 0,82).
 */
function codificarPagina(canvas: HTMLCanvasElement, modo: ModoCor): string {
  return modo === "pb" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * A página endireitada, antes do acabamento. Fica guardada para reaplicar
 * outro modo sem nova foto — por isso vai com a maior qualidade possível:
 * cada recompressão em JPEG perde detalhe, e esta é a matriz das outras.
 */
const QUALIDADE_DA_BASE = 0.97;

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
  return codificarPagina(canvas, modo);
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

interface Captura {
  /** Imagem que a TELA mostra. Com `fonte`, é uma prévia reduzida. */
  url: string;
  /** Tamanho da foto de verdade — é nele que os cantos são medidos. */
  largura: number;
  altura: number;
  /**
   * A foto de verdade, ainda na memória. Evita codificar a foto de 300 DPI
   * em JPEG só para decodificá-la de volta segundos depois — 1,3 s de
   * toDataURL num celular intermediário, mais o tempo de decodificar.
   */
  fonte?: HTMLCanvasElement;
}

/** Lado maior da prévia mostrada na tela de ajuste: a tela do celular não mostra mais que isso. */
const LADO_DA_PREVIA = 1600;

/** Quanto esperar a câmera entregar a foto antes de usar o quadro do vídeo. */
const PRAZO_DA_FOTO_MS = 6000;

/** Prévia leve para a tela; a foto inteira continua na memória. */
function previaDe(canvas: HTMLCanvasElement): string {
  const k = Math.min(1, LADO_DA_PREVIA / Math.max(canvas.width, canvas.height));
  if (k === 1) return canvas.toDataURL("image/jpeg", 0.85);
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * k);
  c.height = Math.round(canvas.height * k);
  c.getContext("2d")!.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

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
  /*
   * A área da tela de ajuste (com as faixas pretas) e, dentro dela, a caixa
   * com o formato exato da foto. Cantos, arraste e lupa usam a CAIXA — ver
   * encaixarNaArea em src/lib/scannerCamera.ts.
   */
  const areaExternaRef = useRef<HTMLDivElement>(null);
  const [areaExterna, setAreaExterna] = useState({ l: 0, a: 0 });
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
  /*
   * A folha achada ao vivo na prévia, em pixels do vídeo. É o contorno
   * verde que aparece antes da foto — e os cantos que a tela de ajuste usa
   * se a foto em si não deixar achar a folha.
   */
  const [folhaAoVivo, setFolhaAoVivo] = useState<Ponto[] | null>(null);
  const folhaAoVivoRef = useRef<Ponto[] | null>(null);
  /*
   * Enquanto a foto é processada, a procura ao vivo para. Ela seguia
   * rodando 4 vezes por segundo e disputava o processador com a foto:
   * 2,4 s dos 7,4 s entre o clique e a tela de ajuste, medidos num celular
   * intermediário simulado.
   */
  const processandoRef = useRef(false);
  const [telaCamera, setTelaCamera] = useState({ l: 0, a: 0 });

  // Passo de ajuste: a foto recém-tirada, com os quatro cantos da folha.
  const [ajuste, setAjuste] = useState<Captura | null>(null);
  const [cantos, setCantos] = useState<Ponto[]>([]);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [endireitando, setEndireitando] = useState(false);
  /* Entre o clique e a tela de ajuste: o botão mostra que está trabalhando. */
  const [fotografando, setFotografando] = useState(false);
  /*
   * Captura automática: achou a folha e ela ficou parada, fotografa sem
   * ninguém tocar no botão. Fica ligada por padrão; a escolha é lembrada
   * neste aparelho.
   */
  const [automatico, setAutomatico] = useState<boolean>(() => {
    try { return localStorage.getItem("scanner.automatico") !== "nao"; } catch { return true; }
  });
  const automaticoRef = useRef(automatico);
  automaticoRef.current = automatico;
  const alternarAutomatico = () => {
    setAutomatico((a) => {
      try { localStorage.setItem("scanner.automatico", a ? "nao" : "sim"); } catch { /* sem armazenamento */ }
      return !a;
    });
  };
  /* 0 a 1: o anel que enche enquanto a folha fica parada. */
  const [progressoAuto, setProgressoAuto] = useState(0);
  /* O laço ao vivo chama a versão mais nova de capturar(). */
  const capturarRef = useRef<() => void>(() => {});
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
        /*
         * Pede o máximo e o navegador entrega o que a câmera tiver. Pedir
         * 1920x1080 era o TETO: num celular com câmera de 12 MP, o
         * documento saía de um quadro de vídeo de 2 MP.
         */
        video: { facingMode: { ideal: "environment" }, width: { ideal: 4096 }, height: { ideal: 3072 } },
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
    const el = areaExternaRef.current;
    if (!el || !ajuste) return;
    const medir = () => setAreaExterna({ l: el.clientWidth, a: el.clientHeight });
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [ajuste]);

  useEffect(() => {
    if (precisaReatarStream(videoRef.current, streamRef.current, !!ajuste)) {
      const v = videoRef.current!;
      v.srcObject = streamRef.current;
      void v.play().catch(() => {});
    }
  }, [ajuste]);

/**
 * Os 4 cantos da folha na foto. A regra está em src/lib/deteccaoFolha.ts,
 * com teste em oito situações de foto real.
 *
 * O detector anterior disparava raios do centro e parava no primeiro
 * trecho "mais escuro que o centro". Medido nas mesmas cenas de teste:
 * com mesa clara errava 15,8% e com documento que tem foto 3x4 errava
 * 16,8% — o raio parava na foto escura achando que era a mesa, e a folha
 * saía CORTADA. O novo erra até 0,6% em todas.
 */
function detectarCantosDaFolha(canvas: HTMLCanvasElement, largura: number, altura: number): Ponto[] | null {
  /*
   * Numa cópia pequena: o detector trabalha com 360 px de qualquer jeito.
   * Ler os 8,7 milhões de pixels da foto inteira (getImageData) só para
   * reduzi-los custava quase um segundo no celular.
   */
  const k = Math.min(1, 480 / Math.max(largura, altura));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(largura * k));
  c.height = Math.max(1, Math.round(altura * k));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  const achados = detectarFolha(ctx.getImageData(0, 0, c.width, c.height));
  return achados ? achados.map((p) => ({ x: p.x / k, y: p.y / k })) : null;
}

  /** Abre o passo de ajuste com recuo seguro nas bordas, ou com bordas detectadas automaticamente. */
  const irParaAjuste = (url: string, largura: number, altura: number, cantosIniciais?: Ponto[], fonte?: HTMLCanvasElement) => {
    setAjuste({ url, largura, altura, fonte });
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

  /**
   * Tira a FOTO, e não um quadro do vídeo.
   *
   * O botão capturava o quadro que estava na tela — o vídeo da câmera,
   * que no celular vem em 1920x1080 no máximo, comprimido para vídeo e sem
   * foco travado. A folha ocupa só parte do quadro, então a página saía
   * com ~90 DPI: era o "péssimo" que aparecia no dossiê.
   *
   * `takePhoto()` (ImageCapture) pede à câmera uma foto de verdade, na
   * resolução cheia do sensor e com o foco que a câmera usa para foto.
   * Existe no Chrome e no Edge do Android. Onde não existe (Safari do
   * iPhone) ou falha, cai no quadro do vídeo, que é o que havia antes —
   * só que agora pedindo a maior resolução que a câmera oferecer.
   */
  const fotografar = async (video: HTMLVideoElement) => {
    const track = streamRef.current?.getVideoTracks()[0];
    const ImageCaptureCtor = (window as any).ImageCapture;
    if (track && ImageCaptureCtor && !videoBastaComoFoto(video.videoWidth, video.videoHeight)) {
      try {
        /*
         * Prazo para a câmera responder: há aparelhos em que a foto nunca
         * volta, e a tela ficava parada. Passou do prazo, usa o vídeo.
         */
        const blob: Blob = await Promise.race([
          new ImageCaptureCtor(track).takePhoto(),
          new Promise<never>((_, rejeitar) => window.setTimeout(() => rejeitar(new Error("tempo")), PRAZO_DA_FOTO_MS)),
        ]);
        const bitmap = await createImageBitmap(blob);
        try {
          return reduzir(bitmap, bitmap.width, bitmap.height);
        } finally {
          bitmap.close?.();
        }
      } catch { /* câmera sem suporte a foto: segue com o quadro do vídeo */ }
    }
    return reduzir(video, video.videoWidth, video.videoHeight);
  };

  /*
   * Procura a folha na prévia cerca de 4 vezes por segundo, numa cópia
   * pequena do quadro (a detecção só precisa da forma). Para quando a tela
   * de ajuste abre ou a câmera fecha.
   */
  useEffect(() => {
    if (!open || !camera || !previaPronta || ajuste) { setFolhaAoVivo(null); folhaAoVivoRef.current = null; return; }
    const quadro = document.createElement("canvas");
    let parado = false;
    let acompanhamento: EstadoDaFolha = SEM_FOLHA;
    let gatilho = { armado: true };
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (parado || processandoRef.current || !temQuadro(v)) return;
      const escala = Math.min(1, 360 / Math.max(v!.videoWidth, v!.videoHeight));
      quadro.width = Math.round(v!.videoWidth * escala);
      quadro.height = Math.round(v!.videoHeight * escala);
      const ctx = quadro.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v!, 0, 0, quadro.width, quadro.height);
      const achados = detectarFolha(ctx.getImageData(0, 0, quadro.width, quadro.height));
      const r = acompanharFolha(acompanhamento, achados, Math.max(quadro.width, quadro.height));
      acompanhamento = r.estado;
      const d = decidirCaptura(gatilho, acompanhamento, r.mostrar);
      gatilho = d.gatilho;
      setProgressoAuto(automaticoRef.current && gatilho.armado && r.mostrar ? progressoDaCaptura(acompanhamento) : 0);
      const noVideo = r.mostrar ? r.mostrar.map((p) => ({ x: p.x / escala, y: p.y / escala })) : null;
      folhaAoVivoRef.current = noVideo;
      setFolhaAoVivo(noVideo);
      setTelaCamera({ l: v!.clientWidth, a: v!.clientHeight });
      if (d.fotografar && automaticoRef.current) capturarRef.current();
    }, 200);
    return () => { parado = true; window.clearInterval(id); };
  }, [open, camera, previaPronta, ajuste]);

  const capturar = async () => {
    const video = videoRef.current;
    if (!temQuadro(video)) {
      toast({ title: "A câmera ainda está abrindo", description: "Aguarde o vídeo aparecer e toque de novo." });
      return;
    }
    if (processandoRef.current) return; // toque duplo no botão
    processandoRef.current = true;
    setFotografando(true);
    try {
      const { canvas, largura, altura } = await fotografar(video!);
      
      // Tenta achar a folha A4 automaticamente com o algoritmo aprimorado
      let cantosAuto = detectarCantosDaFolha(canvas, largura, altura);
      /*
       * Plano B: o contorno que estava verde na prévia. Só vale quando a
       * foto tem o formato do vídeo — a foto de verdade (takePhoto) pode
       * enquadrar mais que a prévia, e aí os pontos cairiam no lugar errado.
       */
      const vivo = folhaAoVivoRef.current;
      if (!cantosAuto && vivo && video && Math.abs(largura / altura - video.videoWidth / video.videoHeight) < 0.02) {
        const k = largura / video.videoWidth;
        cantosAuto = vivo.map((p) => ({ x: p.x * k, y: p.y * k }));
      }
      if (!cantosAuto) {
        // Fallback: recuo fixo se o algoritmo não achar a borda clara da folha
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
        // Aqui a foto vira JPEG: guardar dez fotos de 300 DPI abertas na
        // memória (~35 MB cada) derrubaria o navegador do celular.
        const url = canvas.toDataURL("image/jpeg", QUALIDADE_DA_BASE);
        setPaginas(p => [...p, { base: url, final: url, pendente: true, larguraOriginal: largura, alturaOriginal: altura, cantosSugeridos: cantosAuto }]);
      } else {
        irParaAjuste(previaDe(canvas), largura, altura, cantosAuto, canvas);
      }
    } catch (e: any) {
      toast({ title: "Não foi possível capturar", description: e?.message, variant: "destructive" });
    } finally {
      processandoRef.current = false;
      setFotografando(false);
    }
  };

  /* As mesmas regras valem para o botão e para a captura automática. */
  const capturaBloqueada = fotografando || !podeCapturar(camera, previaPronta, gerando) ||
    (modoCaptura === "identidade" && paginas.length >= 2) ||
    (modoCaptura === "simples" && paginas.length >= 1) ||
    (modoCaptura === "passaporte" && paginas.length >= 1);
  capturarRef.current = () => { if (!capturaBloqueada) void capturar(); };

  const daGaleria = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = (e.target.files || [])[0];
    e.target.value = "";
    if (!arquivo) return;
    const img = new Image();
    img.onload = () => {
      try {
        const { canvas, largura, altura } = reduzir(img, img.naturalWidth, img.naturalHeight);
        /* A foto da galeria também tem a folha procurada — antes ia direto
           para os cantos fixos de 6%, e o técnico arrastava os quatro. */
        irParaAjuste(previaDe(canvas), largura, altura,
          detectarCantosDaFolha(canvas, largura, altura) || undefined, canvas);
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
      let octx: CanvasRenderingContext2D;
      if (ajusteLocal.fonte) {
        /* A foto ainda está na memória: sem decodificar JPEG nenhum. */
        octx = ajusteLocal.fonte.getContext("2d", { willReadFrequently: true })!;
      } else {
        /* Lote: a foto foi guardada em JPEG e precisa voltar a ser pixels. */
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = ajusteLocal.url;
        });
        const orig = document.createElement("canvas");
        orig.width = ajusteLocal.largura;
        orig.height = ajusteLocal.altura;
        octx = orig.getContext("2d", { willReadFrequently: true })!;
        octx.drawImage(img, 0, 0);
      }

      const { largura, altura } = tamanhoDestino(quad);
      const reto = corrigirPerspectiva(octx.getImageData(0, 0, ajusteLocal.largura, ajusteLocal.altura), quad, largura, altura);
      if (!reto) throw new Error("Não foi possível endireitar a área marcada.");

      const saida = document.createElement("canvas");
      saida.width = largura;
      saida.height = altura;
      const sctx = saida.getContext("2d", { willReadFrequently: true })!;
      sctx.putImageData(reto, 0, 0);
      
      const base = saida.toDataURL("image/jpeg", QUALIDADE_DA_BASE);
      tratarPagina(sctx, largura, altura, modo);
      const urlFinal = codificarPagina(saida, modo);
      
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
      /*
       * A conta era p.x / escX / escX: dividia duas vezes, e a lupa ficava
       * mostrando um pedaço perto do canto superior esquerdo da foto, não o
       * canto que estava sendo arrastado. A imagem da tela agora pode ser
       * uma prévia reduzida, então a posição vai para a escala dela.
       */
      const k = img.naturalWidth / ajuste.largura;
      ctx.drawImage(
        img,
        (p.x - RAIO_IMG) * k, (p.y - RAIO_IMG) * k,
        RAIO_IMG * 2 * k, RAIO_IMG * 2 * k,
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
        /* Preto e branco agora é PNG; dizer "JPEG" aqui estragaria a página. */
        pdf.addImage(pagina, pagina.startsWith("data:image/png") ? "PNG" : "JPEG", (larguraPagina - larg(dim.w, escala)) / 2, (alturaPagina - alt(dim.h, escala)) / 2, larg(dim.w, escala), alt(dim.h, escala));
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
      {/* No computador a altura era `sm:h-auto`: a área da foto (flex-1, com
          a imagem posicionada por cima) não tem altura própria e encolhia a
          zero — a tela de ajuste aparecia só com os botões, sem a foto. */}
      <DialogContent className="p-0 border-0 bg-black max-w-none w-screen h-[100dvh] sm:max-w-lg sm:h-[90vh] sm:rounded-xl sm:max-h-[95vh] flex flex-col overflow-hidden">
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
              ref={areaExternaRef}
              className="relative flex-1 select-none touch-none bg-black"
              onPointerMove={moverCanto}
              onPointerUp={() => setArrastando(null)}
              onPointerCancel={() => setArrastando(null)}
            >
              {(() => {
                const caixa = encaixarNaArea(areaExterna.l, areaExterna.a, ajuste!.largura, ajuste!.altura);
                return (
              <div
                ref={areaAjusteRef}
                className="absolute"
                style={{ left: caixa.esquerda, top: caixa.topo, width: caixa.largura, height: caixa.altura }}
              >
              {/* Sem object-contain: a caixa já tem o formato da foto. */}
              <img src={ajuste!.url} alt="Página capturada" className="absolute inset-0 w-full h-full" />
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
              </div>
                );
              })()}
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

              {fotografando && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold text-white shadow pointer-events-none">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fotografando… segure firme
                </div>
              )}

              {/* Contorno da folha ao vivo: verde quando achou. */}
              {folhaAoVivo && videoRef.current && telaCamera.l > 0 && (() => {
                const v = videoRef.current!;
                const naTela = folhaAoVivo.map((p) => videoParaTela(p, v.videoWidth, v.videoHeight, telaCamera.l, telaCamera.a));
                return (
                  <>
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${telaCamera.l} ${telaCamera.a}`}>
                      <polygon points={naTela.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth={3} strokeLinejoin="round" />
                      {naTela.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={7} fill="#22c55e" stroke="white" strokeWidth={2} />)}
                    </svg>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-green-600/90 px-3 py-1 text-xs font-semibold text-white shadow pointer-events-none">
                      {automatico && progressoAuto > 0 && !fotografando
                        ? `Segure firme… ${Math.round(progressoAuto * 100)}%`
                        : "Folha encontrada"}
                    </div>
                  </>
                );
              })()}

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
                <button type="button" onClick={alternarAutomatico} aria-pressed={automatico}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border ${automatico ? "bg-green-600 border-green-500 text-white" : "bg-black/30 border-white/30 text-white/80"}`}>
                  {automatico ? "Automático: ligado" : "Automático: desligado"}
                </button>
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
                  disabled={capturaBloqueada}
                  className="relative w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-xl disabled:opacity-40 active:scale-95 transition-transform"
                  aria-label="Capturar"
                >
                  {automatico && progressoAuto > 0 && !fotografando && (
                    <svg className="absolute inset-0 w-20 h-20 -rotate-90 pointer-events-none" viewBox="0 0 80 80" aria-hidden>
                      <circle cx="40" cy="40" r="37" fill="none" stroke="#22c55e" strokeWidth="5"
                        strokeDasharray={2 * Math.PI * 37} strokeDashoffset={(1 - progressoAuto) * 2 * Math.PI * 37}
                        style={{ transition: "stroke-dashoffset 200ms linear" }} />
                    </svg>
                  )}
                  <div className="w-16 h-16 rounded-full border-[3px] border-black/20 bg-white flex items-center justify-center">
                    {fotografando
                      ? <Loader2 className="w-8 h-8 text-black/80 animate-spin" />
                      : <Camera className="w-8 h-8 text-black/80" />}
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

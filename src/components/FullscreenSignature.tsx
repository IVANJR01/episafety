import { useRef, useLayoutEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import SignaturePad from "signature_pad";
import { Loader2 } from "lucide-react";

/*
 * Assinatura em tela cheia.
 *
 * Duas coisas quebravam aqui, e as duas estão anotadas onde foram
 * corrigidas: girar o aparelho apagava a assinatura, e "Limpar" demorava.
 * O ponto comum é o canvas: mudar largura ou altura de um canvas apaga o
 * que está desenhado, então todo redimensionamento tem que redesenhar a
 * partir de uma cópia dos traços — e essa cópia precisa ser confiável.
 */

interface Props {
  open: boolean;
  employeeName?: string;
  employeeRole?: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  onFacialRecognition?: () => void;
}

export default function FullscreenSignature({ open, employeeName, employeeRole, onSave, onCancel, onFacialRecognition }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  /*
   * Os traços vivem AQUI, não dentro do SignaturePad.
   *
   * A cada redimensionamento o pad é recriado, e antes se lia `toData()` do
   * pad na hora de redesenhar. Bastava uma recriação intermediária para a
   * leitura vir vazia e a assinatura sumir. Guardando os traços por fora,
   * atualizados ao fim de cada traço, o redesenho não depende do estado de
   * um objeto que acabou de ser substituído.
   */
  const tracosRef = useRef<any[]>([]);
  /** Escala de pixels do último desenho — usada para limpar sem excesso. */
  const dprRef = useRef(1);
  const isSubmittingRef = useRef(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [indicativeName, setIndicativeName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Reposiciona os traços quando a área de desenho muda de tamanho.
   *
   * A escala é a MESMA nos dois eixos, e o resultado fica centralizado. Com
   * um fator para largura e outro para altura, girar o aparelho de retrato
   * para paisagem esticava a assinatura na horizontal e achatava na
   * vertical — ela sobrevivia, mas chegava irreconhecível, e assinatura
   * deformada não serve como assinatura.
   */
  const reescalarTracos = useCallback(
    (data: any[], deLargura: number, deAltura: number, paraLargura: number, paraAltura: number) => {
      if (!Array.isArray(data) || deLargura <= 0 || deAltura <= 0 || paraLargura <= 0 || paraAltura <= 0) return data;
      const escala = Math.min(paraLargura / deLargura, paraAltura / deAltura);
      const deslocX = (paraLargura - deLargura * escala) / 2;
      const deslocY = (paraAltura - deAltura * escala) / 2;

      return data.map((grupo) => ({
        ...grupo,
        points: Array.isArray(grupo?.points)
          ? grupo.points.map((p: any) => ({
              ...p,
              x: typeof p?.x === "number" ? p.x * escala + deslocX : p?.x,
              y: typeof p?.y === "number" ? p.y * escala + deslocY : p?.y,
            }))
          : grupo?.points,
      }));
    },
    [],
  );

  // Primary resize logic using useLayoutEffect for immediate DOM sync
  useLayoutEffect(() => {
    if (!open || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const scrollY = window.scrollY;

    // Lock body scroll — iOS-safe approach
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";

    // Prevent iOS rubber-banding / scroll-through on the overlay
    const preventScroll = (e: TouchEvent) => {
      // Allow touches on canvas only
      if (e.target === canvas) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", preventScroll, { passive: false });

    tracosRef.current = [];
    canvasSizeRef.current = { width: 0, height: 0 };
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    setShowNameInput(false);
    setIndicativeName("");

    const orientation = (screen as any)?.orientation;
    if (typeof orientation?.lock === "function") {
      orientation.lock("landscape").catch(() => null);
    }

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      const width = Math.round(r.width);
      const height = Math.round(r.height);
      if (width < 2 || height < 2) return;

      const tamanhoAnterior = canvasSizeRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;

      // Mexer em canvas.width/height apaga o desenho — por isso os traços
      // precisam vir de fora e ser redesenhados logo abaixo.
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.fillRect(0, 0, width, height);

      padRef.current?.off();
      const pad = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
        minWidth: 0.5,
        maxWidth: 2.5,
        throttle: 0,
        velocityFilterWeight: 0.4,
      });
      // A cópia de fora é atualizada ao fim de cada traço. É ela que
      // sobrevive à recriação do pad no próximo giro de tela.
      pad.addEventListener("endStroke", () => {
        tracosRef.current = pad.toData();
      });
      padRef.current = pad;

      const tracos = tracosRef.current;
      if (tracos.length > 0 && tamanhoAnterior.width > 0 && tamanhoAnterior.height > 0) {
        const reescalados = reescalarTracos(tracos, tamanhoAnterior.width, tamanhoAnterior.height, width, height);
        pad.fromData(reescalados);
        // Guarda já reescalado: o próximo giro parte deste tamanho.
        tracosRef.current = reescalados;
      }

      canvasSizeRef.current = { width, height };
    };

    // Initial resize with small delay for DOM readiness (dialog animations)
    let initAttempts = 0;
    let initTimer: number | null = null;
    const tryInit = () => {
      initAttempts++;
      const parent = canvas.parentElement;
      const r = parent?.getBoundingClientRect();
      if (r && r.width > 2 && r.height > 2) {
        resize();
      } else if (initAttempts < 30) {
        initTimer = window.setTimeout(tryInit, 50);
      }
    };
    tryInit();

    // Debounced resize handler
    let resizeTimer: number | null = null;
    const scheduleResize = () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 80);
    };

    window.addEventListener("resize", scheduleResize);
    window.addEventListener("orientationchange", scheduleResize);

    const vv = window.visualViewport;
    if (vv) vv.addEventListener("resize", scheduleResize);

    if (canvasHostRef.current && "ResizeObserver" in window) {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = new ResizeObserver(() => scheduleResize());
      resizeObserverRef.current.observe(canvasHostRef.current);
    }

    return () => {
      if (initTimer) window.clearTimeout(initTimer);
      if (resizeTimer) window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("orientationchange", scheduleResize);
      if (vv) vv.removeEventListener("resize", scheduleResize);
      document.removeEventListener("touchmove", preventScroll);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      padRef.current?.off();
      if (typeof orientation?.unlock === "function") orientation.unlock();
      // Restore body scroll
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
      window.scrollTo(0, scrollY);
    };
  }, [open, reescalarTracos]);

  const handleCancel = () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    onCancel();
  };

  /*
   * Limpar estava lento por pintar a tela muito mais vezes do que precisava.
   *
   * `pad.clear()` da biblioteca pinta uma área de `canvas.width` por
   * `canvas.height` — que são pixels de dispositivo — usando a matriz de
   * transformação em vigor. Como havia uma escala de `dpr` aplicada, cada
   * unidade valia 2 pixels: a área pintada saía 4x maior que o canvas. E
   * logo depois este método repetia clearRect + fillRect por conta própria,
   * dobrando tudo de novo — cerca de oito vezes o trabalho necessário.
   *
   * Agora a matriz volta à identidade antes de limpar, então a pintura
   * cobre exatamente o canvas, uma vez só. A escala é devolvida em seguida,
   * senão os próximos traços sairiam com metade do tamanho.
   */
  const handleClear = () => {
    if (isSubmittingRef.current) return;
    tracosRef.current = [];

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) {
      padRef.current?.clear();
      return;
    }

    const dpr = dprRef.current || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    padRef.current?.clear();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /** Downscale canvas to max 800px wide and export as JPEG 0.7 */
  const exportScaledJpeg = (sourceCanvas: HTMLCanvasElement): string => {
    const maxW = 800;
    const srcW = sourceCanvas.width;
    const srcH = sourceCanvas.height;
    if (srcW <= maxW) {
      return sourceCanvas.toDataURL("image/jpeg", 0.7);
    }
    const scale = maxW / srcW;
    const outW = Math.round(srcW * scale);
    const outH = Math.round(srcH * scale);
    const tmp = document.createElement("canvas");
    tmp.width = outW;
    tmp.height = outH;
    const ctx = tmp.getContext("2d")!;
    ctx.drawImage(sourceCanvas, 0, 0, outW, outH);
    return tmp.toDataURL("image/jpeg", 0.7);
  };

  const handleSave = () => {
    if (isSubmittingRef.current) return;
    if (padRef.current?.isEmpty()) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = exportScaledJpeg(canvas);
    onSave(dataUrl);
  };

  const handleSaveIndicativeName = () => {
    if (isSubmittingRef.current) return;
    const name = indicativeName.trim();
    if (!name) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillRect(0, 0, width, height);

    const fontSize = Math.min(32, width / (name.length * 0.6));
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.font = `italic ${fontSize}px "Georgia", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.toUpperCase(), width / 2, height / 2);

    const textWidth = ctx.measureText(name.toUpperCase()).width;
    ctx.strokeStyle = "rgb(0, 0, 0)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo((width - textWidth) / 2, height / 2 + fontSize * 0.55);
    ctx.lineTo((width + textWidth) / 2, height / 2 + fontSize * 0.55);
    ctx.stroke();

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const dataUrl = exportScaledJpeg(canvas);
    onSave(dataUrl);
  };

  if (!open) return null;

  /* iOS-safe inline styles to block magnifier, callout, and selection */
  const iosCanvasStyle: React.CSSProperties = {
    touchAction: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
    WebkitTouchCallout: "none" as any,
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-white flex flex-col"
      style={{
        height: "100dvh",
        /* fallback for older iOS */
        minHeight: "-webkit-fill-available",
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        overscrollBehavior: "none",
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-4 w-full px-3 bg-muted/50 border-b shrink-0 safe-area-top" style={{ minHeight: 52 }}>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="text-base font-bold text-green-600 uppercase tracking-wider px-3 min-h-[44px] min-w-[44px] active:opacity-60 transition-opacity"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={isSubmitting}
          className="text-base font-bold text-green-600 uppercase tracking-wider px-3 min-h-[44px] min-w-[44px] active:opacity-60 transition-opacity"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting}
          className="text-base font-bold text-muted-foreground uppercase tracking-wider px-3 min-h-[44px] min-w-[44px] flex items-center gap-1.5 ml-auto active:opacity-60 transition-opacity"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Salvando…
            </>
          ) : (
            "Salvar"
          )}
        </button>
      </div>

      {showNameInput ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 bg-white">
          <p className="text-sm text-muted-foreground text-center">
            Para quem não sabe assinar, digite o nome completo abaixo:
          </p>
          <input
            type="text"
            autoFocus
            value={indicativeName}
            onChange={e => setIndicativeName(e.target.value)}
            placeholder="Nome completo do colaborador"
            className="w-full max-w-sm border border-input rounded-lg px-4 py-3 text-lg text-center font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowNameInput(false); setIndicativeName(""); }}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold text-muted-foreground border border-input rounded-lg"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleSaveIndicativeName}
              disabled={!indicativeName.trim() || isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg disabled:opacity-40 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                "Confirmar Nome"
              )}
            </button>
          </div>
        </div>
      ) : (
        <div ref={canvasHostRef} className="flex-1 relative min-h-0">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            style={iosCanvasStyle}
          />
        </div>
      )}

      <div className="text-center border-t bg-muted/30 shrink-0" style={{ paddingTop: 8, paddingBottom: `max(10px, env(safe-area-inset-bottom, 10px))` }}>
        {!showNameInput && (
          <button
            type="button"
            onClick={() => {
              if (isSubmitting) return;
              if (onFacialRecognition) {
                onFacialRecognition();
              } else {
                setShowNameInput(true);
              }
            }}
            className="text-xs text-primary font-semibold underline underline-offset-2 mb-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            Não sabe assinar? Toque aqui
          </button>
        )}
        {employeeName && (
          <>
            <p className="text-sm font-bold tracking-wide uppercase">{employeeName}</p>
            {employeeRole && (
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{employeeRole}</p>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

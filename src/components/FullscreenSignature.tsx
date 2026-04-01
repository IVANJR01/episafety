import { useRef, useEffect, useLayoutEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import SignaturePad from "signature_pad";
import { Loader2 } from "lucide-react";

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
  const retryTimerRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const isClearingRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [indicativeName, setIndicativeName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scaleStrokeData = useCallback((data: any[], fromWidth: number, fromHeight: number, toWidth: number, toHeight: number) => {
    if (!Array.isArray(data) || fromWidth <= 0 || fromHeight <= 0 || toWidth <= 0 || toHeight <= 0) return data;
    const scaleX = toWidth / fromWidth;
    const scaleY = toHeight / fromHeight;

    return data.map((group) => ({
      ...group,
      points: Array.isArray(group?.points)
        ? group.points.map((point: any) => ({
            ...point,
            x: typeof point?.x === "number" ? point.x * scaleX : point?.x,
            y: typeof point?.y === "number" ? point.y * scaleY : point?.y,
          }))
        : group?.points,
    }));
  }, []);

  const initPad = useCallback(() => {
    if (!canvasRef.current) return false;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    if (width < 2 || height < 2) return false;

    const previousSize = canvasSizeRef.current;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.round(width * ratio);
    const nextHeight = Math.round(height * ratio);
    const previousData = isClearingRef.current ? [] : (padRef.current?.toData() ?? []);

    canvas.width = nextWidth;
    canvas.height = nextHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillRect(0, 0, width, height);

    padRef.current?.off();
    padRef.current = new SignaturePad(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(0, 0, 0)",
      minWidth: 0.5,
      maxWidth: 2.5,
      throttle: 0,
      velocityFilterWeight: 0.4,
    });

    if (previousData.length > 0) {
      const scaledData = scaleStrokeData(previousData, previousSize.width, previousSize.height, width, height);
      padRef.current.fromData(scaledData);
    } else {
      padRef.current.clear();
    }

    canvasSizeRef.current = { width, height };
    isClearingRef.current = false;
    return true;
  }, [scaleStrokeData]);

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

    isClearingRef.current = false;
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

      const previousSize = canvasSizeRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const previousData = isClearingRef.current ? [] : (padRef.current?.toData() ?? []);

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
      padRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
        minWidth: 0.5,
        maxWidth: 2.5,
        throttle: 0,
        velocityFilterWeight: 0.4,
      });

      if (previousData.length > 0 && previousSize.width > 0 && previousSize.height > 0) {
        const scaledData = scaleStrokeData(previousData, previousSize.width, previousSize.height, width, height);
        padRef.current.fromData(scaledData);
      }

      canvasSizeRef.current = { width, height };
      isClearingRef.current = false;
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
  }, [open, initPad, scaleStrokeData]);

  const handleCancel = () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    onCancel();
  };

  const handleClear = () => {
    if (isSubmittingRef.current) return;
    isClearingRef.current = true;
    padRef.current?.clear();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
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
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b shrink-0 safe-area-top">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={isSubmitting}
          className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting}
          className="text-sm font-semibold text-primary uppercase tracking-wide px-2 py-1 flex items-center gap-1.5"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
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

      <div className="text-center py-3 border-t bg-muted/30 shrink-0 safe-area-bottom">
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
            className="text-xs text-primary font-semibold underline underline-offset-2 mb-1"
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

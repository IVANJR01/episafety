import { useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import SignaturePad from "signature_pad";

interface Props {
  open: boolean;
  employeeName?: string;
  employeeRole?: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function FullscreenSignature({ open, employeeName, employeeRole, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);

  const isClearingRef = useRef(false);

  const initPad = useCallback(() => {
    if (!canvasRef.current) return false;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    if (width < 2 || height < 2) return false;

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
      padRef.current.fromData(previousData);
    } else {
      padRef.current.clear();
    }

    isClearingRef.current = false;
    return true;
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    isClearingRef.current = false;

    let attempts = 0;
    let disposed = false;

    const tryInit = () => {
      if (disposed) return;
      attempts += 1;
      const ready = initPad();
      if (!ready && attempts < 30) {
        retryTimerRef.current = window.setTimeout(tryInit, 50);
      }
    };

    tryInit();

    const handleResize = () => {
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(() => initPad(), 100);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
      window.removeEventListener("resize", handleResize);
      padRef.current?.off();
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [open, initPad]);

  const handleClear = () => {
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

  const handleSave = () => {
    if (padRef.current?.isEmpty()) return;
    const dataUrl = padRef.current.toDataURL("image/jpeg", 0.8);
    onSave(dataUrl);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col" style={{ touchAction: "none" }}>
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b shrink-0 safe-area-top">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="text-sm font-semibold text-primary uppercase tracking-wide px-2 py-1"
        >
          Salvar
        </button>
      </div>

      <div className="flex-1 relative min-h-0">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
        />
      </div>

      {employeeName && (
        <div className="text-center py-3 border-t bg-muted/30 shrink-0 safe-area-bottom">
          <p className="text-sm font-bold tracking-wide uppercase">{employeeName}</p>
          {employeeRole && (
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{employeeRole}</p>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}


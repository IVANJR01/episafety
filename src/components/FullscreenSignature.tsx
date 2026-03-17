import { useRef, useEffect, useCallback, useState } from "react";
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
  const [ready, setReady] = useState(false);

  const initPad = useCallback(() => {
    if (!canvasRef.current) return false;
    const canvas = canvasRef.current;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (w === 0 || h === 0) return false;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);
    if (padRef.current) padRef.current.off();
    padRef.current = new SignaturePad(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(0, 0, 0)",
      minWidth: 0.5,
      maxWidth: 2.5,
      throttle: 16,
      velocityFilterWeight: 0.7,
    });
    setReady(true);
    return true;
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";

    // Retry init until canvas has dimensions
    let attempts = 0;
    const tryInit = () => {
      attempts++;
      if (!initPad() && attempts < 20) {
        return setTimeout(tryInit, 50);
      }
      return null;
    };
    const timer = setTimeout(tryInit, 50);

    const handleResize = () => {
      setTimeout(() => initPad(), 100);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      padRef.current?.off();
      document.body.style.overflow = "";
    };
  }, [open, initPad]);

  const handleClear = () => padRef.current?.clear();

  const handleSave = () => {
    if (padRef.current?.isEmpty()) return;
    const dataUrl = padRef.current?.toDataURL("image/jpeg", 0.8) || null;
    if (dataUrl) onSave(dataUrl);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col" style={{ touchAction: "none" }}>
      {/* Top bar */}
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

      {/* Canvas area */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
        />
      </div>

      {/* Bottom info */}
      {employeeName && (
        <div className="text-center py-3 border-t bg-muted/30 shrink-0 safe-area-bottom">
          <p className="text-sm font-bold tracking-wide uppercase">{employeeName}</p>
          {employeeRole && (
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{employeeRole}</p>
          )}
        </div>
      )}
    </div>
  );
}

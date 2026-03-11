import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { Eraser, RotateCcw } from "lucide-react";

export interface SignatureCanvasRef {
  getDataURL: () => string | null;
  isEmpty: () => boolean;
  clear: () => void;
}

interface Props {
  label: string;
  width?: number;
  height?: number;
}

const SignatureCanvas = forwardRef<SignatureCanvasRef, Props>(
  ({ label, height = 350 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLandscape, setIsLandscape] = useState(false);

    const initPad = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
      }
      if (padRef.current) {
        padRef.current.off();
      }
      padRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
        minWidth: 0.5,
        maxWidth: 2.5,
        velocityFilterWeight: 0.7,
      });
    };

    useEffect(() => {
      initPad();
      return () => { padRef.current?.off(); };
    }, []);

    // Re-init on orientation/landscape toggle
    useEffect(() => {
      const timer = setTimeout(() => initPad(), 100);
      return () => clearTimeout(timer);
    }, [isLandscape]);

    // Detect orientation change
    useEffect(() => {
      const handleOrientation = () => {
        const landscape = window.innerWidth > window.innerHeight;
        setIsLandscape(landscape);
      };
      window.addEventListener("resize", handleOrientation);
      handleOrientation();
      return () => window.removeEventListener("resize", handleOrientation);
    }, []);

    useImperativeHandle(ref, () => ({
      getDataURL: () => {
        if (padRef.current?.isEmpty()) return null;
        return padRef.current?.toDataURL("image/png") || null;
      },
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      clear: () => padRef.current?.clear(),
    }));

    const canvasHeight = isLandscape ? "70vh" : `${height}px`;

    return (
      <div ref={containerRef} className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <div className="flex items-center gap-1">
            {!isLandscape && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Gire o celular para ampliar
              </span>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => padRef.current?.clear()}>
              <Eraser className="w-3.5 h-3.5 mr-1" /> Limpar
            </Button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className="border border-input rounded-lg w-full cursor-crosshair touch-none bg-white"
          style={{ height: canvasHeight }}
        />
        <p className="text-xs text-muted-foreground">
          Assine com seu nome completo por extenso
        </p>
      </div>
    );
  }
);

SignatureCanvas.displayName = "SignatureCanvas";
export default SignatureCanvas;
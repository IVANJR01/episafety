import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

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

const SignatureCanvas = forwardRef<SignatureCanvasRef, Props>(({ label, width = 400, height = 150 }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      padRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      });
    }
    return () => { padRef.current?.off(); };
  }, []);

  useImperativeHandle(ref, () => ({
    getDataURL: () => {
      if (padRef.current?.isEmpty()) return null;
      return padRef.current?.toDataURL("image/png") || null;
    },
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    clear: () => padRef.current?.clear(),
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => padRef.current?.clear()}>
          <Eraser className="w-3.5 h-3.5 mr-1" /> Limpar
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        className="border border-input rounded-lg w-full cursor-crosshair touch-none"
        style={{ height: `${height}px` }}
      />
    </div>
  );
});

SignatureCanvas.displayName = "SignatureCanvas";
export default SignatureCanvas;

import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SignatureCanvasRef {
  getDataURL: () => string | null;
  getTypedName: () => string;
  isEmpty: () => boolean;
  clear: () => void;
}

interface Props {
  label: string;
  width?: number;
  height?: number;
  showNameInput?: boolean;
  nameLabel?: string;
}

const SignatureCanvas = forwardRef<SignatureCanvasRef, Props>(
  ({ label, width = 400, height = 250, showNameInput = true, nameLabel = "Nome Completo" }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const [typedName, setTypedName] = useState("");

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
          minWidth: 0.5,
          maxWidth: 2.5,
          velocityFilterWeight: 0.7,
        });
      }
      return () => { padRef.current?.off(); };
    }, []);

    useImperativeHandle(ref, () => ({
      getDataURL: () => {
        if (padRef.current?.isEmpty()) return null;
        return padRef.current?.toDataURL("image/png") || null;
      },
      getTypedName: () => typedName,
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      clear: () => {
        padRef.current?.clear();
        setTypedName("");
      },
    }));

    return (
      <div className="space-y-4">
        {showNameInput && (
          <div className="space-y-2">
            <Label htmlFor="typed-name" className="text-sm font-medium">
              {nameLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="typed-name"
              type="text"
              placeholder="Digite seu nome completo"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              className="w-full"
            />
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => padRef.current?.clear()}>
              <Eraser className="w-3.5 h-3.5 mr-1" /> Limpar
            </Button>
          </div>
          <canvas
            ref={canvasRef}
            className="border border-input rounded-lg w-full cursor-crosshair touch-none bg-white"
            style={{ height: `${height}px` }}
          />
          <p className="text-xs text-muted-foreground">
            Assine com seu nome completo, não apenas uma rubrica
          </p>
        </div>
      </div>
    );
  }
);

SignatureCanvas.displayName = "SignatureCanvas";
export default SignatureCanvas;
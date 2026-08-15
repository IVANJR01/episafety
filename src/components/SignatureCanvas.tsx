import { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { Eraser, RotateCcw } from "lucide-react";
import { paraCanvas, paraNormalizado } from "@/lib/tracosAssinatura";

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

/*
 * Assinatura embutida (Ficha de EPI, DDS, Portal de Treinamentos).
 *
 * Mudar `canvas.width` ou `canvas.height` apaga tudo o que está desenhado.
 * Como este componente refaz o canvas a cada mudança de orientação, girar o
 * aparelho apagava a assinatura — e a própria tela convidava a girar, com o
 * aviso "Gire o celular para ampliar". Quem seguia a instrução perdia o que
 * tinha assinado.
 *
 * A correção tem duas partes: guardar os traços fora do SignaturePad, para
 * poder redesenhá-los depois, e não refazer o canvas quando o tamanho em
 * pixels não mudou de verdade.
 */
const SignatureCanvas = forwardRef<SignatureCanvasRef, Props>(
  ({ label, height = 300 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLandscape, setIsLandscape] = useState(false);

    /**
     * Os traços moram aqui, em coordenadas NORMALIZADAS — é o que sobrevive à
     * recriação do canvas, e é o que faz girar o aparelho não encolher a
     * assinatura. Ver tracosAssinatura.ts.
     */
    const tracosRef = useRef<any[]>([]);

    const initPad = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const largura = canvas.offsetWidth;
      const altura = canvas.offsetHeight;
      // Dentro de diálogo o canvas pode não ter medida ainda; refazer com
      // tamanho zero apagaria a assinatura e deixaria a área inutilizável.
      if (largura < 2 || altura < 2) return;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const novaLargura = Math.round(largura * ratio);
      const novaAltura = Math.round(altura * ratio);

      /*
       * Nada mudou de verdade em pixels? Então não refaz.
       *
       * `resize` dispara também quando a barra de endereço do navegador
       * aparece ou some e quando o teclado abre — e o agendamento novo, mais
       * abaixo, chama esta função em todos esses casos. Sem esta guarda,
       * seriam recriações de canvas a cada rolagem, cada uma apagando e
       * redesenhando a assinatura à toa.
       */
      if (padRef.current && canvas.width === novaLargura && canvas.height === novaAltura) return;

      canvas.width = novaLargura;
      canvas.height = novaAltura;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      padRef.current?.off();
      const pad = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
        minWidth: 0.5,
        maxWidth: 2.5,
        throttle: 16, // ~60fps for smoother drawing
        velocityFilterWeight: 0.7,
      });
      // Atualiza a cópia de fora ao fim de cada traço.
      pad.addEventListener("endStroke", () => {
        tracosRef.current = paraNormalizado(pad.toData() as never, largura, altura);
      });
      padRef.current = pad;

      // Sempre a partir do original normalizado: nada é gravado por cima, e
      // por isso nenhum erro de escala se acumula giro após giro.
      if (tracosRef.current.length > 0) {
        pad.fromData(paraCanvas(tracosRef.current, largura, altura) as never);
      }
    }, []);

    useEffect(() => {
      // Small delay to ensure DOM is ready (especially inside dialogs)
      const timer = setTimeout(() => initPad(), 50);
      return () => {
        clearTimeout(timer);
        padRef.current?.off();
      };
    }, [initPad]);

    // Re-init on orientation/landscape toggle
    useEffect(() => {
      const timer = setTimeout(() => initPad(), 150);
      return () => clearTimeout(timer);
    }, [isLandscape, initPad]);

    // Detect orientation change
    useEffect(() => {
      let timer: number | null = null;
      const handleOrientation = () => {
        setIsLandscape(window.innerWidth > window.innerHeight);
        // O giro muda a largura do canvas sem mexer em `isLandscape` quando
        // a tela ja estava deitada; este agendamento cobre esse caso. O
        // atraso junta a enxurrada de eventos do giro numa chamada só.
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(initPad, 120);
      };
      window.addEventListener("resize", handleOrientation);
      window.addEventListener("orientationchange", handleOrientation);
      handleOrientation();
      return () => {
        if (timer) window.clearTimeout(timer);
        window.removeEventListener("resize", handleOrientation);
        window.removeEventListener("orientationchange", handleOrientation);
      };
    }, [initPad]);

    const limpar = useCallback(() => {
      tracosRef.current = [];
      padRef.current?.clear();
    }, []);

    useImperativeHandle(ref, () => ({
      getDataURL: () => {
        if (padRef.current?.isEmpty()) return null;
        // Use JPEG for smaller size and faster encoding
        return padRef.current?.toDataURL("image/jpeg", 0.8) || null;
      },
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      clear: limpar,
    }));

    const canvasHeight = isLandscape ? "60vh" : `${height}px`;

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
            <Button type="button" size="sm" variant="ghost" onClick={limpar}>
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

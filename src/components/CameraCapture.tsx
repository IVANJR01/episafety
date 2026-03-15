import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, VideoOff, Upload } from "lucide-react";

interface Props {
  onCapture: (dataUrl: string) => void;
  capturedPhoto: string | null;
  onClear: () => void;
}

export default function CameraCapture({ onCapture, capturedPhoto, onClear }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraAttempted, setCameraAttempted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    setCameraAttempted(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === "NotAllowedError") {
        setError("Permissão da câmera negada. Use o botão abaixo para enviar uma foto da galeria.");
      } else if (err.name === "NotFoundError") {
        setError("Nenhuma câmera encontrada. Use o botão abaixo para enviar uma foto da galeria.");
      } else {
        setError("Não foi possível acessar a câmera. Use o botão abaixo para enviar uma foto da galeria.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  }, []);

  useEffect(() => {
    if (!capturedPhoto) {
      startCamera();
    }
    return () => stopCamera();
  }, [capturedPhoto]);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror for selfie
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCamera();
    onCapture(dataUrl);
  }, [onCapture, stopCamera]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        stopCamera();
        onCapture(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  }, [onCapture, stopCamera]);

  if (capturedPhoto) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-lg overflow-hidden border bg-muted">
          <img src={capturedPhoto} alt="Foto do colaborador" className="w-full max-h-[300px] object-contain" />
          <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1">
            <Check className="w-5 h-5 text-success" />
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClear} className="w-full">
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Tirar outra foto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileUpload}
      />

      {error ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed rounded-lg bg-muted/20 space-y-3">
          <VideoOff className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">{error}</p>
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden border bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-[300px] object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          {streaming && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <Button
                type="button"
                size="lg"
                onClick={takePhoto}
                className="rounded-full w-14 h-14 p-0 shadow-lg"
              >
                <Camera className="w-6 h-6" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Always show gallery upload as alternative */}
      <div className="flex gap-2">
        {error && (
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={startCamera}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Tentar câmera
          </Button>
        )}
        <Button
          type="button"
          variant={error ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          {error ? "Enviar foto da galeria" : "Ou enviar da galeria"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {streaming ? "Posicione o rosto do colaborador e capture a foto" : "Tire ou envie uma foto do colaborador"}
      </p>
    </div>
  );
}

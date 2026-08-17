import { useState, useEffect, useCallback } from "react";
import { Download, X, Sparkles } from "lucide-react";
import { versaoParaMostrar } from "@/lib/verificarAtualizacao";
import { forceAppUpdate } from "@/lib/appUpdate";

export default function UpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // Listen for the custom event dispatched from main.tsx
    const handler = (e: CustomEvent) => {
      setUpdateSW(() => e.detail);
      setShowUpdate(true);
    };
    window.addEventListener("sw-update-available", handler as EventListener);
    return () => window.removeEventListener("sw-update-available", handler as EventListener);
  }, []);

  const handleUpdate = useCallback(() => {
    if (updateSW) {
      updateSW(true);
    } else {
      void forceAppUpdate();
    }
  }, [updateSW]);

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 lg:bottom-6 lg:left-auto lg:right-6 lg:max-w-sm z-[110] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-primary text-primary-foreground rounded-xl shadow-2xl p-4 flex items-start gap-3">
        <div className="bg-primary-foreground/20 rounded-lg p-2 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Nova versão disponível!</p>
          <p className="text-xs opacity-80 mt-0.5">
            Versão atual: {versaoParaMostrar()}. Clique para atualizar.
          </p>
          <button
            onClick={handleUpdate}
            className="mt-2 inline-flex items-center gap-1.5 bg-primary-foreground text-primary text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" />
            Atualizar agora
          </button>
        </div>
        <button
          onClick={() => setShowUpdate(false)}
          className="p-1 hover:bg-primary-foreground/20 rounded-lg transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

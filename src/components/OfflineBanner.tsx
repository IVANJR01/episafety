import { useState, useEffect } from "react";
import { WifiOff, CloudOff, RefreshCw } from "lucide-react";
import { getSyncQueue } from "@/lib/offlineStorage";
import { useOfflineSync } from "@/hooks/useOfflineSync";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const { processQueue } = useOfflineSync();

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      // Update pending count after sync
      setTimeout(() => setPendingCount(getSyncQueue().length), 2000);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // Check pending count periodically
    const interval = setInterval(() => {
      setPendingCount(getSyncQueue().length);
    }, 3000);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      clearInterval(interval);
    };
  }, []);

  if (!isOffline && pendingCount === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground text-center py-2 px-4 text-sm flex items-center justify-center gap-2">
      {isOffline ? (
        <>
          <WifiOff className="w-4 h-4" />
          Você está offline. As alterações serão salvas localmente.
          {pendingCount > 0 && (
            <span className="ml-1 font-medium">
              ({pendingCount} pendente{pendingCount > 1 ? "s" : ""})
            </span>
          )}
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          Sincronizando {pendingCount} alteração(ões) pendente(s)...
        </>
      )}
    </div>
  );
}

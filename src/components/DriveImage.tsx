import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface DriveImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

function extractDriveFileId(url: string): string | null {
  // Match patterns: /uc?...id=XXX, /d/XXX/, /file/d/XXX
  const patterns = [
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const proxyCache = new Map<string, string>();

export default function DriveImage({ src, alt, className }: DriveImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) { setLoading(false); return; }

    // If it's a base64 or non-Drive URL, use directly
    if (src.startsWith("data:") || !src.includes("drive.google.com")) {
      setResolvedUrl(src);
      setLoading(false);
      return;
    }

    const fileId = extractDriveFileId(src);
    if (!fileId) {
      setResolvedUrl(src);
      setLoading(false);
      return;
    }

    // Check cache
    if (proxyCache.has(fileId)) {
      setResolvedUrl(proxyCache.get(fileId)!);
      setLoading(false);
      return;
    }

    // Resolve via gdrive-proxy
    let cancelled = false;
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("gdrive-proxy", {
          body: { id: fileId },
        });
        if (cancelled) return;
        if (fnErr || data?.error) {
          // Fallback: try lh3 thumbnail
          const fallback = `https://lh3.googleusercontent.com/d/${fileId}=w400`;
          proxyCache.set(fileId, fallback);
          setResolvedUrl(fallback);
        } else {
          proxyCache.set(fileId, data.url);
          setResolvedUrl(data.url);
        }
      } catch {
        if (!cancelled) {
          const fallback = `https://lh3.googleusercontent.com/d/${fileId}=w400`;
          proxyCache.set(fileId, fallback);
          setResolvedUrl(fallback);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [src]);

  if (!src) return null;

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded border", className)}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !resolvedUrl) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded border", className)}>
        <ImageOff className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className={cn("object-cover rounded border", className)}
      onError={() => setError(true)}
    />
  );
}

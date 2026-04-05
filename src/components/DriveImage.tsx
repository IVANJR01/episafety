import { useEffect, useState } from "react";
import { Loader2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractGDriveFileId, getGDriveImageProxyUrl } from "@/lib/googleDrive";

interface DriveImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

const proxyCache = new Map<string, string>();

export default function DriveImage({ src, alt, className }: DriveImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    setError(false);
    setUsedFallback(false);

    if (!src) {
      setResolvedUrl(null);
      setLoading(false);
      return;
    }

    if (src.startsWith("data:") || !src.includes("drive.google.com")) {
      setResolvedUrl(src);
      setLoading(false);
      return;
    }

    const fileId = extractGDriveFileId(src);
    if (!fileId) {
      setResolvedUrl(src);
      setLoading(false);
      return;
    }

    if (proxyCache.has(fileId)) {
      setResolvedUrl(proxyCache.get(fileId)!);
      setLoading(false);
      return;
    }

    const proxyUrl = getGDriveImageProxyUrl(src);
    if (!proxyUrl) {
      setResolvedUrl(src);
      setLoading(false);
      return;
    }

    proxyCache.set(fileId, proxyUrl);
    setResolvedUrl(proxyUrl);
    setLoading(false);
  }, [src]);

  const handleError = () => {
    if (!src || usedFallback || !src.includes("drive.google.com")) {
      setError(true);
      return;
    }

    const fileId = extractGDriveFileId(src);
    if (!fileId) {
      setError(true);
      return;
    }

    setUsedFallback(true);
    setResolvedUrl(`https://drive.google.com/thumbnail?id=${fileId}&sz=w800`);
  };

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
      loading="lazy"
      onError={handleError}
    />
  );
}

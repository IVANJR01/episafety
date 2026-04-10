import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractGDriveFileId, getGDriveImageProxyUrl } from "@/lib/googleDrive";
import { Skeleton } from "@/components/ui/skeleton";

interface DriveImageProps {
  src: string | null;
  alt: string;
  className?: string;
  /** Use low-res Google Drive thumbnail instead of full image (faster for lists) */
  thumbnail?: boolean;
}

const proxyCache = new Map<string, string>();

/** Build a lightweight Google Drive thumbnail URL (sz=w200 ≈ 5-15 KB). */
function getThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;
}

export default function DriveImage({ src, alt, className, thumbnail = false }: DriveImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    setError(false);
    setUsedFallback(false);
    setLoading(true);

    if (!src) {
      setResolvedUrl(null);
      setLoading(false);
      return;
    }

    // Non-Drive URLs pass through directly
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

    // Thumbnail mode: use lightweight Google thumbnail (no proxy needed)
    if (thumbnail) {
      setResolvedUrl(getThumbnailUrl(fileId));
      setLoading(false);
      return;
    }

    // Full resolution: use proxy
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
  }, [src, thumbnail]);

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

    // Fallback: try Google thumbnail at higher res
    setUsedFallback(true);
    setResolvedUrl(`https://drive.google.com/thumbnail?id=${fileId}&sz=w800`);
  };

  if (!src) return null;

  // Skeleton screen while loading
  if (loading) {
    return <Skeleton className={cn("rounded border", className)} />;
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
      decoding="async"
      onLoad={() => setLoading(false)}
      onError={handleError}
    />
  );
}

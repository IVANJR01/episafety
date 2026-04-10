import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGDriveImageProxyUrl, getGDriveThumbnailUrl } from "@/lib/googleDrive";
import { Skeleton } from "@/components/ui/skeleton";

interface DriveImageProps {
  src: string | null;
  alt: string;
  className?: string;
  /** Use low-res Google Drive thumbnail instead of full image (faster for lists) */
  thumbnail?: boolean;
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

    const preferredUrl = getGDriveThumbnailUrl(src, thumbnail ? 240 : 1200);
    if (preferredUrl) {
      setResolvedUrl(preferredUrl);
      setLoading(false);
      return;
    }

    const proxyUrl = getGDriveImageProxyUrl(src);
    if (!proxyUrl) {
      setResolvedUrl(src);
      setLoading(false);
      return;
    }

    setResolvedUrl(proxyUrl);
    setLoading(false);
  }, [src, thumbnail]);

  const handleError = () => {
    if (!src || usedFallback || !src.includes("drive.google.com")) {
      setError(true);
      return;
    }

    const proxyUrl = getGDriveImageProxyUrl(src);
    if (!proxyUrl || proxyUrl === resolvedUrl) {
      setError(true);
      return;
    }

    setUsedFallback(true);
    setResolvedUrl(proxyUrl);
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
      style={{ imageOrientation: "from-image" }}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoading(false)}
      onError={handleError}
    />
  );
}

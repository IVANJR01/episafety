import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getInspecaoPhotoSignedUrl } from "@/lib/inspecoesStorage";
import DriveImage from "@/components/DriveImage";

interface InspecaoImageProps {
  /** Path canônico no bucket inspecoes-fotos (novos registros). */
  path?: string | null;
  /** URL/base64 legado ou preview offline. */
  legacyUrl?: string | null;
  alt: string;
  className?: string;
  thumbnail?: boolean;
}

/**
 * Renderiza foto de inspeção priorizando o path do Storage privado ou URLs do Google Drive.
 */
export default function InspecaoImage({ path, legacyUrl, alt, className, thumbnail }: InspecaoImageProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(false);
    if (!path) {
      setSignedUrl(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getInspecaoPhotoSignedUrl(path)
      .then((url) => {
        if (!alive) return;
        setSignedUrl(url);
        if (!url) setError(true);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  if (path) {
    if (loading) return <Skeleton className={cn("rounded border", className)} />;
    if (error || !signedUrl) {
      return (
        <div className={cn("flex items-center justify-center bg-muted rounded border", className)}>
          <ImageOff className="w-4 h-4 text-muted-foreground" />
        </div>
      );
    }
    return (
      <img
        src={signedUrl}
        alt={alt}
        className={cn("object-cover rounded border", className)}
        style={{ imageOrientation: "from-image" }}
        loading="lazy"
        decoding="async"
        onError={() => setError(true)}
      />
    );
  }

  if (!legacyUrl) return null;

  if (legacyUrl.includes("drive.google.com")) {
    return <DriveImage src={legacyUrl} alt={alt} className={className} thumbnail={thumbnail} />;
  }

  return (
    <img
      src={legacyUrl}
      alt={alt}
      className={cn("object-cover rounded border", className)}
      style={{ imageOrientation: "from-image" }}
      loading="lazy"
      decoding="async"
      onError={() => setError(true)}
    />
  );
}

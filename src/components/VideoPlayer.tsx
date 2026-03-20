import { Play, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getGDriveEmbedUrl, isGDriveUrl } from "@/lib/googleDrive";

function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  if (isGDriveUrl(url)) return true;

  try {
    const u = new URL(url);
    const audioExtensionPattern = /\.(m4a|mp3|wav|aac|flac|oga|opus)$/i;
    const videoExtensionPattern = /\.(mp4|webm|ogg|mov|m4v)$/i;

    if (audioExtensionPattern.test(u.pathname)) return false;
    if (videoExtensionPattern.test(u.pathname)) return true;
    if (u.hostname.includes("supabase.co") && u.pathname.includes("/storage/")) return !audioExtensionPattern.test(u.pathname);
    return false;
  } catch {
    return false;
  }
}

interface VideoPlayerProps {
  url: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  className?: string;
  preload?: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  tabIndex?: number;
}

export function VideoPlayer({ url, controls, className, videoRef, autoPlay, muted, playsInline, preload, onEnded, onPlay, onPause, onContextMenu, onLoadedMetadata, onTimeUpdate, tabIndex }: VideoPlayerProps) {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError || !isDirectVideoUrl(url)) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-muted rounded-lg p-8 ${className || ""}`}>
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground text-center">
          Este arquivo não é um vídeo visível. Faça upload de um vídeo .mp4 válido para este módulo.
        </p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={url}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      playsInline={playsInline}
      preload={preload}
      className={className}
      onEnded={onEnded}
      onPlay={onPlay}
      onPause={onPause}
      onContextMenu={onContextMenu}
      onLoadedMetadata={(e) => {
        const video = e.currentTarget;
        if (video.videoWidth <= 0 || video.videoHeight <= 0) {
          setHasError(true);
          return;
        }
        onLoadedMetadata?.(e);
      }}
      onTimeUpdate={onTimeUpdate}
      tabIndex={tabIndex}
      onError={() => setHasError(true)}
    />
  );
}

interface VideoThumbnailProps {
  url: string;
  className?: string;
  iconSize?: string;
  completed?: boolean;
}

export function VideoThumbnail({ url, className = "w-24 aspect-video", iconSize = "h-5 w-5", completed }: VideoThumbnailProps) {
  const validVideo = isDirectVideoUrl(url);
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!validVideo) return;

    const element = thumbnailRef.current;
    if (!element) return;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [validVideo, url]);

  return (
    <div ref={thumbnailRef} className={`relative bg-muted rounded overflow-hidden flex-shrink-0 ${className}`}>
      {validVideo && shouldLoad ? (
        <video
          src={url}
          className="w-full h-full object-cover"
          preload="none"
          muted
          playsInline
          aria-hidden="true"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          {!validVideo && <AlertTriangle className="h-4 w-4 text-destructive" />}
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-foreground/30">
        {completed ? (
          <svg className={`${iconSize} text-primary`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <Play className={`${iconSize} text-background`} />
        )}
      </div>
    </div>
  );
}

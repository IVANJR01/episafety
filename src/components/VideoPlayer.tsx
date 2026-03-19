import { isExternalVideoUrl, getEmbedUrl, getYouTubeThumbnail } from "@/lib/videoUtils";
import { Play } from "lucide-react";

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
  if (isExternalVideoUrl(url)) {
    const embedUrl = getEmbedUrl(url);
    if (embedUrl) {
      return (
        <iframe
          src={embedUrl + (autoPlay ? "&autoplay=1" : "")}
          className={className}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ border: 0 }}
        />
      );
    }
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
      onLoadedMetadata={onLoadedMetadata}
      onTimeUpdate={onTimeUpdate}
      tabIndex={tabIndex}
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
  const isExternal = isExternalVideoUrl(url);
  const thumbnail = getYouTubeThumbnail(url);

  return (
    <div className={`relative bg-muted rounded overflow-hidden flex-shrink-0 ${className}`}>
      {isExternal && thumbnail ? (
        <img src={thumbnail} className="w-full h-full object-cover" alt="" />
      ) : isExternal ? (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <Play className={`${iconSize} text-muted-foreground`} />
        </div>
      ) : (
        <video src={url} className="w-full h-full object-cover" preload="metadata" />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        {completed ? (
          <svg className={`${iconSize} text-emerald-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <Play className={`${iconSize} text-white`} />
        )}
      </div>
    </div>
  );
}

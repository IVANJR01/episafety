/**
 * Detects if a URL is from YouTube, Vimeo, or other external platforms
 * and returns the appropriate embed URL.
 */

export function isExternalVideoUrl(url: string): boolean {
  if (!url) return false;
  return isYouTubeUrl(url) || isVimeoUrl(url);
}

export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

export function isVimeoUrl(url: string): boolean {
  return /vimeo\.com/i.test(url);
}

export function getYouTubeEmbedUrl(url: string): string | null {
  // Handle youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;

  // Handle youtube.com/watch?v=VIDEO_ID
  const longMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (longMatch) return `https://www.youtube.com/embed/${longMatch[1]}`;

  // Handle youtube.com/embed/VIDEO_ID (already embed)
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`;

  return null;
}

export function getVimeoEmbedUrl(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  if (match) return `https://player.vimeo.com/video/${match[1]}`;
  return null;
}

export function getEmbedUrl(url: string): string | null {
  if (isYouTubeUrl(url)) return getYouTubeEmbedUrl(url);
  if (isVimeoUrl(url)) return getVimeoEmbedUrl(url);
  return null;
}

export function getYouTubeThumbnail(url: string): string | null {
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  const longMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  const videoId = shortMatch?.[1] || longMatch?.[1] || embedMatch?.[1];
  if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  return null;
}

/**
 * Video utility functions for internal video hosting.
 * All videos are served from Supabase Storage — no external platforms.
 */

export function isExternalVideoUrl(_url: string): boolean {
  return false;
}

export function isYouTubeUrl(_url: string): boolean {
  return false;
}

export function getEmbedUrl(_url: string): string | null {
  return null;
}

export function getYouTubeThumbnail(_url: string): string | null {
  return null;
}

export function getYouTubeVideoId(_url: string): string | null {
  return null;
}

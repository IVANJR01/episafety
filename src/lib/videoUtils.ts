/**
 * Video utility functions.
 * Supports both internal (Supabase Storage) and YouTube URLs.
 */

export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/i.test(url);
}

export function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function getEmbedUrl(url: string): string | null {
  const id = getYouTubeVideoId(url);
  if (!id) return null;

  const params = new URLSearchParams({
    autoplay: "0",
    controls: "0",
    rel: "0",
    modestbranding: "1",
    iv_load_policy: "3",
    cc_load_policy: "0",
    disablekb: "1",
    fs: "0",
    playsinline: "1",
    loop: "1",
    playlist: id,
  });

  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function getYouTubeThumbnail(url: string): string | null {
  const id = getYouTubeVideoId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

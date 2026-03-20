/**
 * Google Drive video URL utilities.
 *
 * Supported share formats:
 *   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   https://drive.google.com/file/d/FILE_ID/view
 *   https://drive.google.com/open?id=FILE_ID
 *   https://drive.google.com/uc?id=FILE_ID
 */

const GDRIVE_FILE_REGEX = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
const GDRIVE_OPEN_REGEX = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
const GDRIVE_UC_REGEX   = /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/;

/** Extract the Google Drive file ID from a URL, or null if not a Drive link. */
export function extractGDriveFileId(url: string): string | null {
  if (!url) return null;
  const m1 = url.match(GDRIVE_FILE_REGEX);
  if (m1) return m1[1];
  const m2 = url.match(GDRIVE_OPEN_REGEX);
  if (m2) return m2[1];
  const m3 = url.match(GDRIVE_UC_REGEX);
  if (m3) return m3[1];
  return null;
}

/** Check whether a URL is a Google Drive link. */
export function isGDriveUrl(url: string): boolean {
  return extractGDriveFileId(url) !== null;
}

/**
 * Convert a Google Drive share link into an embeddable preview URL.
 * The /preview endpoint works inside an <iframe> without requiring download.
 */
export function getGDriveEmbedUrl(url: string): string | null {
  const fileId = extractGDriveFileId(url);
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Get a Google Drive stream URL compatible with native HTML5 <video> playback.
 * The usercontent endpoint supports byte-range requests and works better on mobile.
 */
export function getGDriveDirectUrl(url: string): string | null {
  const fileId = extractGDriveFileId(url);
  if (!fileId) return null;
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
}

/**
 * Get a proxy URL that streams the Google Drive video through our edge function.
 * This keeps full playback control and avoids mobile browser issues with Drive URLs.
 */
export function getGDriveProxyUrl(url: string): string | null {
  const fileId = extractGDriveFileId(url);
  if (!fileId) return null;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/functions/v1/gdrive-proxy?id=${fileId}&filename=treinamento.mp4`;
}

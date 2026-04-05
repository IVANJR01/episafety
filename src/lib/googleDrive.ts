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
const GDRIVE_UC_REGEX = /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/;
const GDRIVE_PROXY_VERSION = "2026-04-05-raw-image-fix";

function getProxyConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return { supabaseUrl, anonKey };
}

function buildProxyUrl(fileId: string, fileName: string, raw = false): string | null {
  const config = getProxyConfig();
  if (!config) return null;
  const safeFileName = encodeURIComponent(fileName);
  const rawFlag = raw ? "&raw=1" : "";
  const versionFlag = raw ? `&v=${encodeURIComponent(GDRIVE_PROXY_VERSION)}` : "";
  return `${config.supabaseUrl}/functions/v1/gdrive-proxy/${safeFileName}?id=${encodeURIComponent(fileId)}${rawFlag}${versionFlag}&apikey=${encodeURIComponent(config.anonKey)}`;
}

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

/** Resolve a Google Drive image through the proxy so browsers/PDF fetches can load it reliably. */
export function getGDriveImageProxyUrl(url: string): string | null {
  const fileId = extractGDriveFileId(url);
  if (!fileId) return null;
  return buildProxyUrl(fileId, "image.jpg", true);
}

/**
 * Resolve a Google Drive video URL through the edge function proxy.
 * Returns a direct CDN URL that can be used in <video src="...">.
 * This avoids streaming through the edge function (which causes timeout on large files).
 */
export async function resolveGDriveVideoUrl(url: string): Promise<string | null> {
  const fileId = extractGDriveFileId(url);
  if (!fileId) return null;

  const proxyUrl = buildProxyUrl(fileId, "metadata.json", false);
  if (!proxyUrl) return null;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.url || null;
  } catch {
    return null;
  }
}

/**
 * Get a proxy URL that streams the Google Drive video through our edge function.
 * @deprecated Use resolveGDriveVideoUrl instead for large files.
 */
export function getGDriveProxyUrl(url: string): string | null {
  const fileId = extractGDriveFileId(url);
  if (!fileId) return null;
  return buildProxyUrl(fileId, "treinamento.mp4", true);
}

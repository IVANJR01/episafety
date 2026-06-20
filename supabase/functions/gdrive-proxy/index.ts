import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { resolveCors } from "../_shared/cors.ts";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : null;
  const fileId = url.searchParams.get("id") || body?.id || null;
  const raw = url.searchParams.get("raw") === "1" || url.searchParams.get("raw") === "true";

  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return new Response(JSON.stringify({ error: "Missing or invalid file ID" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (raw) {
      const rangeHeader = req.headers.get("range") ?? undefined;
      const fileResponse = await fetchDriveFile(fileId, rangeHeader);

      if (!fileResponse) {
        return new Response(JSON.stringify({ error: "Could not fetch Google Drive file." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const headers = new Headers(corsHeaders);
      const sourceType = fileResponse.headers.get("content-type") || "application/octet-stream";
      headers.set("Content-Type", normalizeContentType(sourceType, url.pathname));
      headers.set("Cache-Control", "public, max-age=3600");
      headers.set("Accept-Ranges", fileResponse.headers.get("accept-ranges") || "bytes");

      const contentLength = fileResponse.headers.get("content-length");
      const contentRange = fileResponse.headers.get("content-range");
      if (contentLength) headers.set("Content-Length", contentLength);
      if (contentRange) headers.set("Content-Range", contentRange);

      return new Response(fileResponse.body, {
        status: fileResponse.status,
        headers,
      });
    }

    const directUrl = await resolveDirectUrl(fileId);
    if (!directUrl) {
      return new Response(JSON.stringify({ error: "Could not resolve Google Drive download URL. The file may be private or quota exceeded." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const proxyUrl = buildProxyUrl(req.url, fileId);
    return new Response(JSON.stringify({ url: directUrl, proxyUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Proxy error", message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function resolveDirectUrl(fileId: string): Promise<string | null> {
  const response = await fetchDriveFile(fileId, "bytes=0-0");
  if (!response) return null;
  const finalUrl = response.url || null;
  try {
    await response.body?.cancel();
  } catch {}
  return finalUrl;
}

async function fetchDriveFile(fileId: string, rangeHeader?: string): Promise<Response | null> {
  const urls = [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&authuser=0`,
  ];

  for (const downloadUrl of urls) {
    const initialResponse = await fetch(downloadUrl, {
      method: "GET",
      headers: buildBaseHeaders(rangeHeader),
      redirect: "follow",
    });

    if (!looksLikeHtml(initialResponse) && (initialResponse.ok || initialResponse.status === 206)) {
      return initialResponse;
    }

    const html = await initialResponse.text();
    const retryRequest = buildRetryRequest(fileId, initialResponse, html, rangeHeader);
    if (!retryRequest) continue;

    const retryResponse = await fetch(retryRequest.url, {
      method: "GET",
      headers: retryRequest.headers,
      redirect: "follow",
    });

    if (!looksLikeHtml(retryResponse) && (retryResponse.ok || retryResponse.status === 206)) {
      return retryResponse;
    }

    try {
      await retryResponse.body?.cancel();
    } catch {}
  }

  return null;
}

function buildRetryRequest(fileId: string, response: Response, html: string, rangeHeader?: string) {
  const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
  const uuidMatch = html.match(/uuid=([a-zA-Z0-9_-]+)/);
  const setCookies = response.headers.getSetCookie?.() || [];
  const cookieStr = setCookies.map((cookie: string) => cookie.split(";")[0]).join("; ");

  const params = new URLSearchParams({
    id: fileId,
    export: "download",
    confirm: confirmMatch?.[1] || "t",
  });

  if (uuidMatch?.[1]) {
    params.set("uuid", uuidMatch[1]);
  }

  return {
    url: `https://drive.usercontent.google.com/download?${params.toString()}`,
    headers: {
      ...buildBaseHeaders(rangeHeader),
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    },
  };
}

function buildBaseHeaders(rangeHeader?: string): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: "*/*",
    ...(rangeHeader ? { Range: rangeHeader } : {}),
  };
}

function buildProxyUrl(requestUrl: string, fileId: string): string {
  const url = new URL(requestUrl);
  url.search = "";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/image.jpg`;
  url.searchParams.set("id", fileId);
  url.searchParams.set("raw", "1");
  return url.toString();
}

function normalizeContentType(contentType: string, pathname: string): string {
  if (contentType && contentType !== "application/octet-stream") {
    return contentType;
  }

  const lower = pathname.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function looksLikeHtml(response: Response): boolean {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html");
}

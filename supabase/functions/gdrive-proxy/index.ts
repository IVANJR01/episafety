import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, Content-Type, Content-Disposition",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const fileId = url.searchParams.get("id");
  const filename = sanitizeFilename(url.searchParams.get("filename") || "treinamento.mp4");
  const requestedRange = req.headers.get("range");

  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return new Response(JSON.stringify({ error: "Missing or invalid file ID" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const upstreamRange = req.method === "HEAD" ? requestedRange || "bytes=0-1" : requestedRange;
    const upstreamResponse = await fetchDriveResponse(fileId, upstreamRange);

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      return new Response(JSON.stringify({ error: "Failed to fetch from Google Drive", status: upstreamResponse.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseHeaders = buildProxyHeaders(upstreamResponse, filename);

    if (req.method === "HEAD") {
      if (!requestedRange) {
        const totalSize = getTotalSize(upstreamResponse.headers.get("content-range"));
        if (totalSize) {
          responseHeaders["Content-Length"] = totalSize;
        }
        delete responseHeaders["Content-Range"];
        return new Response(null, {
          status: 200,
          headers: responseHeaders,
        });
      }

      return new Response(null, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Proxy error", message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchDriveResponse(fileId: string, rangeHeader: string | null): Promise<Response> {
  const baseHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "*/*",
  };

  const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  const fetchHeaders: Record<string, string> = { ...baseHeaders };

  if (rangeHeader) {
    fetchHeaders.Range = rangeHeader;
  }

  const response = await fetch(downloadUrl, {
    method: "GET",
    headers: fetchHeaders,
    redirect: "follow",
  });

  if (!looksLikeHtml(response)) {
    return response;
  }

  await response.text();
  const setCookies = response.headers.getSetCookie?.() || [];
  const cookieStr = setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
  const retryHeaders: Record<string, string> = {
    ...baseHeaders,
    ...(cookieStr ? { Cookie: cookieStr } : {}),
  };

  if (rangeHeader) {
    retryHeaders.Range = rangeHeader;
  }

  const retryResponse = await fetch(downloadUrl, {
    method: "GET",
    headers: retryHeaders,
    redirect: "follow",
  });

  if (looksLikeHtml(retryResponse)) {
    await retryResponse.text();
    throw new Error("Could not bypass Google Drive download gate. Make sure the file is publicly shared.");
  }

  return retryResponse;
}

function looksLikeHtml(response: Response): boolean {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html");
}

function buildProxyHeaders(response: Response, filename: string): Record<string, string> {
  const responseHeaders: Record<string, string> = { ...corsHeaders };
  const contentType = response.headers.get("content-type") || "video/mp4";
  const contentLength = response.headers.get("content-length");
  const contentRange = response.headers.get("content-range");
  const lastModified = response.headers.get("last-modified");

  responseHeaders["Content-Type"] = contentType;
  responseHeaders["Accept-Ranges"] = "bytes";
  responseHeaders["Cache-Control"] = "public, max-age=86400";
  responseHeaders["Content-Disposition"] = `inline; filename="${filename}"`;
  responseHeaders["X-Content-Type-Options"] = "nosniff";

  if (contentLength) responseHeaders["Content-Length"] = contentLength;
  if (contentRange) responseHeaders["Content-Range"] = contentRange;
  if (lastModified) responseHeaders["Last-Modified"] = lastModified;

  return responseHeaders;
}

function sanitizeFilename(filename: string): string {
  const cleaned = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  return cleaned.toLowerCase().endsWith(".mp4") ? cleaned : `${cleaned}.mp4`;
}

function getTotalSize(contentRange: string | null): string | null {
  if (!contentRange) return null;
  const match = contentRange.match(/\/(\d+)$/);
  return match?.[1] || null;
}

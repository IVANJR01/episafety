import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const fileId = url.searchParams.get("id");

  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return new Response(JSON.stringify({ error: "Missing or invalid file ID" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Google Drive direct download URL
    const gdriveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    // Forward Range header if present for streaming
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    };

    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    // First request - may get redirect or confirm page for large files
    let response = await fetch(gdriveUrl, { headers, redirect: "follow" });

    // Handle Google's virus scan confirmation page for large files
    if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
      const html = await response.text();

      // Extract confirm token
      const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
      const uuidMatch = html.match(/uuid=([a-zA-Z0-9_-]+)/);

      if (confirmMatch) {
        const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}${uuidMatch ? `&uuid=${uuidMatch[1]}` : ""}`;
        response = await fetch(confirmUrl, { headers, redirect: "follow" });
      } else {
        // Try the download anyway with confirm=t
        const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
        response = await fetch(directUrl, { headers, redirect: "follow" });
      }
    }

    if (!response.ok && response.status !== 206) {
      return new Response(JSON.stringify({ error: "Failed to fetch from Google Drive", status: response.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseHeaders: Record<string, string> = { ...corsHeaders };

    // Forward relevant headers
    const contentType = response.headers.get("content-type");
    if (contentType) responseHeaders["Content-Type"] = contentType;

    const contentLength = response.headers.get("content-length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    const contentRange = response.headers.get("content-range");
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    responseHeaders["Accept-Ranges"] = "bytes";
    responseHeaders["Cache-Control"] = "public, max-age=86400";

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Proxy error", message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

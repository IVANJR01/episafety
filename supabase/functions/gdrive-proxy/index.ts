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
    const baseHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    const rangeHeader = req.headers.get("range");

    // Use the direct download URL with confirm=t to bypass virus scan
    const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;

    const fetchHeaders: Record<string, string> = { ...baseHeaders };
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const response = await fetch(downloadUrl, {
      headers: fetchHeaders,
      redirect: "follow",
    });

    // If we still got HTML, try another approach
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      // Consume the body to free the connection
      await response.text();

      // Try with cookies from the first response
      const setCookies = response.headers.getSetCookie?.() || [];
      const cookieStr = setCookies.map(c => c.split(";")[0]).join("; ");

      const retryHeaders: Record<string, string> = {
        ...baseHeaders,
        ...(cookieStr ? { Cookie: cookieStr } : {}),
      };
      if (rangeHeader) {
        retryHeaders["Range"] = rangeHeader;
      }

      const retryUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
      const retryResponse = await fetch(retryUrl, {
        headers: retryHeaders,
        redirect: "follow",
      });

      const retryContentType = retryResponse.headers.get("content-type") || "";
      if (retryContentType.includes("text/html")) {
        await retryResponse.text();
        return new Response(JSON.stringify({ error: "Could not bypass Google Drive download gate. Make sure the file is publicly shared." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return buildProxyResponse(retryResponse, rangeHeader);
    }

    if (!response.ok && response.status !== 206) {
      return new Response(JSON.stringify({ error: "Failed to fetch from Google Drive", status: response.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return buildProxyResponse(response, rangeHeader);
  } catch (err) {
    return new Response(JSON.stringify({ error: "Proxy error", message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildProxyResponse(response: Response, _rangeHeader: string | null): Response {
  const responseHeaders: Record<string, string> = { ...corsHeaders };

  const ct = response.headers.get("content-type");
  if (ct) responseHeaders["Content-Type"] = ct;

  const cl = response.headers.get("content-length");
  if (cl) responseHeaders["Content-Length"] = cl;

  const cr = response.headers.get("content-range");
  if (cr) responseHeaders["Content-Range"] = cr;

  responseHeaders["Accept-Ranges"] = "bytes";
  responseHeaders["Cache-Control"] = "public, max-age=86400";

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const fileId = url.searchParams.get("id") || (req.method === "POST" ? (await req.json().catch(() => ({})))?.id : null);

  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return new Response(JSON.stringify({ error: "Missing or invalid file ID" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const directUrl = await resolveDirectUrl(fileId);

    if (!directUrl) {
      return new Response(JSON.stringify({ error: "Could not resolve Google Drive download URL. The file may be private or quota exceeded." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: directUrl }), {
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

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function resolveDirectUrl(fileId: string): Promise<string | null> {
  const baseHeaders: Record<string, string> = {
    "User-Agent": UA,
    "Accept": "*/*",
    "Range": "bytes=0-0",
  };

  const urls = [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&authuser=0`,
  ];

  for (const downloadUrl of urls) {
    const response = await fetch(downloadUrl, {
      method: "GET",
      headers: baseHeaders,
      redirect: "follow",
    });

    if (!looksLikeHtml(response) && (response.ok || response.status === 206)) {
      const finalUrl = response.url || downloadUrl;
      try { await response.body?.cancel(); } catch {}
      return finalUrl;
    }

    const body = await response.text();
    const confirmMatch = body.match(/confirm=([a-zA-Z0-9_-]+)/);
    const uuidMatch = body.match(/uuid=([a-zA-Z0-9_-]+)/);

    const setCookies = response.headers.getSetCookie?.() || [];
    const cookieStr = setCookies.map((cookie: string) => cookie.split(";")[0]).join("; ");

    const retryParams = new URLSearchParams({
      id: fileId,
      export: "download",
      confirm: confirmMatch?.[1] || "t",
    });
    if (uuidMatch?.[1]) retryParams.set("uuid", uuidMatch[1]);

    const retryUrl = `https://drive.usercontent.google.com/download?${retryParams.toString()}`;
    const retryHeaders: Record<string, string> = {
      "User-Agent": UA,
      "Accept": "*/*",
      "Range": "bytes=0-0",
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    };

    const retryResponse = await fetch(retryUrl, {
      method: "GET",
      headers: retryHeaders,
      redirect: "follow",
    });

    if (!looksLikeHtml(retryResponse) && (retryResponse.ok || retryResponse.status === 206)) {
      const finalUrl = retryResponse.url || retryUrl;
      try { await retryResponse.body?.cancel(); } catch {}
      return finalUrl;
    }

    try { await retryResponse.body?.cancel(); } catch {}
  }

  return null;
}

function looksLikeHtml(response: Response): boolean {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html");
}

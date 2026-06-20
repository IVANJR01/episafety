import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { resolveCors } from "../_shared/cors.ts";
const BUCKETS = ["logos", "inspecoes", "conformidades", "fotos-reconhecimento", "backups", "videos-treinamento"];

Deno.serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is authenticated
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new Error("Unauthorized");

    // Use service role to delete files
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const results: Record<string, { deleted: number; errors: number }> = {};

    for (const bucket of BUCKETS) {
      results[bucket] = { deleted: 0, errors: 0 };

      // List all files in bucket
      const { data: files, error: listError } = await serviceClient.storage
        .from(bucket)
        .list("", { limit: 1000 });

      if (listError || !files || files.length === 0) continue;

      // Get all file paths (filter out folders)
      const filePaths = files
        .filter((f) => f.name && !f.name.endsWith("/"))
        .map((f) => f.name);

      if (filePaths.length === 0) continue;

      // Delete in batches
      const { data: deleted, error: deleteError } = await serviceClient.storage
        .from(bucket)
        .remove(filePaths);

      if (deleteError) {
        console.error(`Error deleting from ${bucket}:`, deleteError);
        results[bucket].errors = filePaths.length;
      } else {
        results[bucket].deleted = deleted?.length || filePaths.length;
      }
    }

    const totalDeleted = Object.values(results).reduce((sum, r) => sum + r.deleted, 0);

    return new Response(JSON.stringify({
      success: true,
      message: `${totalDeleted} arquivos removidos do storage`,
      details: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

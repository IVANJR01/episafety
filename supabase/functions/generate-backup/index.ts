import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES = [
  "funcionarios",
  "epis",
  "entregas",
  "fichas_entrega",
  "dds",
  "dds_participantes",
  "inspecoes",
  "inspecao_itens",
  "inspecoes_subestacao",
  "treinamentos",
  "treinamento_participantes",
  "controle_treinamentos",
  "cursos_documentos",
  "exames",
  "medicos",
  "ordens_servico",
  "conformidades",
  "empresa_config",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to get empresa_id
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for data export
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's empresa_id
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .single();

    const empresaId = profile?.empresa_id;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Export all tables filtered by empresa_id
    const backup: Record<string, unknown[]> = {};
    const tableLabels: Record<string, string> = {
      funcionarios: "Funcionários",
      epis: "EPIs",
      entregas: "Entregas",
      fichas_entrega: "Fichas de Entrega",
      dds: "DDS",
      dds_participantes: "DDS Participantes",
      inspecoes: "Inspeções",
      inspecao_itens: "Itens de Inspeção",
      inspecoes_subestacao: "Inspeções Subestação",
      treinamentos: "Treinamentos",
      treinamento_participantes: "Participantes Treinamento",
      controle_treinamentos: "Controle Treinamentos",
      cursos_documentos: "Cursos/Documentos",
      exames: "Exames",
      medicos: "Médicos",
      ordens_servico: "Ordens de Serviço",
      conformidades: "Conformidades",
      empresa_config: "Empresa",
    };

    for (const table of TABLES) {
      let query = serviceClient.from(table).select("*");

      if (table === "empresa_config") {
        query = query.eq("id", empresaId);
      } else {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (!error && data) {
        backup[table] = data;
      }
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "-");
    const fileName = `${empresaId}/backup_${dateStr}_${timeStr}.json`;

    // Upload to storage
    const jsonContent = JSON.stringify(
      { generated_at: now.toISOString(), empresa_id: empresaId, tables: backup, table_labels: tableLabels },
      null,
      2
    );

    const { error: uploadError } = await serviceClient.storage
      .from("backups")
      .upload(fileName, new Blob([jsonContent], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: "Falha ao salvar backup", details: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean up old backups (keep last 7)
    const { data: files } = await serviceClient.storage.from("backups").list(empresaId, {
      sortBy: { column: "created_at", order: "desc" },
    });

    if (files && files.length > 7) {
      const toDelete = files.slice(7).map((f) => `${empresaId}/${f.name}`);
      await serviceClient.storage.from("backups").remove(toDelete);
    }

    return new Response(
      JSON.stringify({ success: true, file: fileName, tables: Object.keys(backup).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

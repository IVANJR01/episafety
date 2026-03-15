import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES = [
  "funcionarios", "epis", "entregas", "fichas_entrega",
  "dds", "dds_participantes", "inspecoes", "inspecao_itens",
  "inspecoes_subestacao", "treinamentos", "treinamento_participantes",
  "controle_treinamentos", "cursos_documentos", "exames", "medicos",
  "ordens_servico", "conformidades", "empresa_config",
];

const TABLE_LABELS: Record<string, string> = {
  funcionarios: "Funcionários", epis: "EPIs", entregas: "Entregas",
  fichas_entrega: "Fichas de Entrega", dds: "DDS",
  dds_participantes: "DDS Participantes", inspecoes: "Inspeções",
  inspecao_itens: "Itens de Inspeção", inspecoes_subestacao: "Inspeções Subestação",
  treinamentos: "Treinamentos", treinamento_participantes: "Participantes Treinamento",
  controle_treinamentos: "Controle Treinamentos", cursos_documentos: "Cursos/Documentos",
  exames: "Exames", medicos: "Médicos", ordens_servico: "Ordens de Serviço",
  conformidades: "Conformidades", empresa_config: "Empresa",
};

async function generateBackupForEmpresa(serviceClient: any, empresaId: string) {
  const backup: Record<string, unknown[]> = {};

  for (const table of TABLES) {
    let query = serviceClient.from(table).select("*");
    if (table === "empresa_config") {
      query = query.eq("id", empresaId);
    } else {
      query = query.eq("empresa_id", empresaId);
    }
    const { data, error } = await query;
    if (!error && data) backup[table] = data;
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "-");
  const fileName = `${empresaId}/backup_${dateStr}_${timeStr}.json`;

  const jsonContent = JSON.stringify(
    { generated_at: now.toISOString(), empresa_id: empresaId, tables: backup, table_labels: TABLE_LABELS },
    null, 2
  );

  const { error: uploadError } = await serviceClient.storage
    .from("backups")
    .upload(fileName, new Blob([jsonContent], { type: "application/json" }), {
      contentType: "application/json", upsert: false,
    });

  if (uploadError) return { success: false, tables: 0, error: uploadError.message };

  // Keep only last 7 backups
  const { data: files } = await serviceClient.storage.from("backups").list(empresaId, {
    sortBy: { column: "created_at", order: "desc" },
  });
  if (files && files.length > 7) {
    const toDelete = files.slice(7).map((f: any) => `${empresaId}/${f.name}`);
    await serviceClient.storage.from("backups").remove(toDelete);
  }

  return { success: true, tables: Object.keys(backup).length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const isScheduled = body?.scheduled === true;

    let empresaIds: string[] = [];

    if (isScheduled) {
      const { data: empresas } = await serviceClient.from("empresa_config").select("id");
      empresaIds = (empresas || []).map((e: any) => e.id);
    } else {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await serviceClient
        .from("profiles").select("empresa_id").eq("user_id", user.id).single();
      if (!profile?.empresa_id) {
        return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      empresaIds = [profile.empresa_id];
    }

    let totalTables = 0;
    for (const empresaId of empresaIds) {
      const result = await generateBackupForEmpresa(serviceClient, empresaId);
      if (result.success) totalTables += result.tables;
    }

    return new Response(
      JSON.stringify({ success: true, empresas: empresaIds.length, tables: totalTables }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

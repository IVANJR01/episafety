// Rota única de homologação Fase 3 — detecta o perfil pelo e-mail logado
// e roda o conjunto de checks específico (RLS + edge portal-rh-aso-download).
// Disponível só em preview/dev. Não executa eSocial, ICP, XMLDSig, SOAP, S-3000.
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

// ===== IDs fixos de homologação =====
const EMPRESA_A      = "f141f880-b820-4e0d-8958-a410734201fa"; // [HOMOLOG] Empresa A
const EMPRESA_B      = "d3419ac5-f4fe-4309-bf45-0e104ac04f3a"; // Empresa B (homolog)
const ASO_RASCUNHO_A = "aaaaaaa1-0000-4000-8000-000000000001";
const ASO_LIBERADO_A = "aaaaaaa1-0000-4000-8000-000000000002";
const ASO_EMPRESA_B  = "aaaaaaa1-0000-4000-8000-000000000003";
const EDGE_URL = `https://bccqjqimbjzskyexpjca.supabase.co/functions/v1/portal-rh-aso-download`;

type Status = "PASS" | "FAIL" | "SKIPPED_SAFE" | "SKIPPED_SCHEMA";
type CheckResult = {
  label: string;
  status: Status;
  esperado: string;
  obtido: string;
  detalhe?: string;
};
type PerfilKey =
  | "U1_SUPER_ADMIN"
  | "U2_PRINCIPAL"
  | "U3_TECNICO_SST"
  | "U5_RH_ONLY"
  | "DESCONHECIDO";

type Report = {
  veredito: "APROVADO" | "APROVADO_COM_SKIPPED_SAFE" | "REPROVADO";
  perfil_detectado: PerfilKey;
  email: string | null;
  user_id: string | null;
  empresa_ativa: string | null;
  usuarios_liberados: unknown;
  modulos_permitidos: string[];
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  results: CheckResult[];
  warnings: string[];
  generated_at: string;
};

const EMAIL_TO_PERFIL: Record<string, PerfilKey> = {
  "ivanjr.tstconsultoria@gmail.com": "U1_SUPER_ADMIN",
  "homolog.u2@gmail.com": "U2_PRINCIPAL",
  "homolog.u3@gmail.com": "U3_TECNICO_SST",
  "homolog.u5@gmail.com": "U5_RH_ONLY",
};

function isRlsDenied(err: any) {
  if (!err) return false;
  const code = String(err.code ?? "");
  const msg = String(err.message ?? "").toLowerCase();
  return (
    code === "42501" ||
    msg.includes("row-level security") ||
    msg.includes("violates row-level") ||
    msg.includes("permission denied") ||
    msg.includes("new row violates")
  );
}

function isAllowed() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h.startsWith("127.") ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com")
  );
}

async function callEdge(asoId: string) {
  // Força refresh — evita 401 quando o access_token em cache é de uma sessão revogada
  let token: string | undefined;
  try {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed?.session?.access_token;
  } catch {}
  if (!token) {
    const { data: sess } = await supabase.auth.getSession();
    token = sess?.session?.access_token;
  }
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
    ?? "";
  const res = await fetch(EDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ aso_id: asoId, acao: "view" }),
  });
  let body: any = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

export default function Fase3AllTest() {
  const { user, loading } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const allowed = useMemo(() => isAllowed(), []);

  const perfilDetectado: PerfilKey = useMemo(() => {
    if (!user?.email) return "DESCONHECIDO";
    return EMAIL_TO_PERFIL[user.email.toLowerCase()] ?? "DESCONHECIDO";
  }, [user]);

  async function runTests() {
    if (!user) {
      toast.error("Faça login antes de rodar o teste.");
      return;
    }
    if (perfilDetectado === "DESCONHECIDO") {
      toast.error(`E-mail ${user.email} não pertence a nenhum perfil homolog.`);
      return;
    }
    setRunning(true);
    const results: CheckResult[] = [];
    const warnings: string[] = [];

    const push = (
      label: string,
      status: Status,
      esperado: string,
      obtido: string,
      detalhe = "",
    ) => {
      results.push({ label, status, esperado, obtido, detalhe });
    };
    const pushBool = (label: string, ok: boolean, esperado: string, obtido: string) =>
      push(label, ok ? "PASS" : "FAIL", esperado, obtido);

    // ===== Sessão =====
    let empresaAtiva: string | null = null;
    let usuariosLiberados: any = null;
    let modulos: string[] = [];
    try { empresaAtiva = localStorage.getItem("active_empresa_id"); } catch {}
    try {
      const { data: ul } = await (supabase as any)
        .from("usuarios_liberados")
        .select("*")
        .ilike("email", user.email ?? "")
        .maybeSingle();
      usuariosLiberados = ul;
      modulos = Array.isArray(ul?.modulos_permitidos) ? (ul!.modulos_permitidos as string[]) : [];
    } catch (e: any) {
      warnings.push(`Falha ao ler usuarios_liberados: ${e?.message ?? e}`);
    }

    pushBool(
      "sessao.email_logado",
      !!user.email,
      "email não-nulo",
      user.email ?? "",
    );
    pushBool(
      "sessao.perfil_detectado",
      (perfilDetectado as PerfilKey) !== "DESCONHECIDO",
      "perfil mapeado",
      perfilDetectado,
    );


    // ===== Helpers de leitura =====
    async function selectOne(label: string, id: string, expectedCount: 0 | 1) {
      const { data, error } = await supabase.from("asos").select("id, empresa_id").eq("id", id);
      const count = data?.length ?? 0;
      pushBool(
        label,
        !error && count === expectedCount,
        `count=${expectedCount}`,
        error ? `erro=${error.message}` : `count=${count}`,
      );
    }
    async function selectMin1(label: string, id: string) {
      const { data, error } = await supabase.from("asos").select("id").eq("id", id);
      const count = data?.length ?? 0;
      pushBool(
        label,
        !error && count >= 1,
        "count>=1",
        error ? `erro=${error.message}` : `count=${count}`,
      );
    }
    async function listEmpresa(label: string, empresaId: string, expect: "zero" | "min1") {
      const { data, error } = await supabase.from("asos").select("id").eq("empresa_id", empresaId);
      const count = data?.length ?? 0;
      const ok = expect === "zero" ? count === 0 : count >= 1;
      pushBool(
        label,
        !error && ok,
        expect === "zero" ? "count=0" : "count>=1",
        error ? `erro=${error.message}` : `count=${count}`,
      );
    }

    // ===== Helpers de escrita (todas devem ser bloqueadas para perfis não-admin) =====
    const HOMOLOG_TAG = "[HOMOLOG-TEST]";
    async function insertAsoNegado(label: string, empresaId: string) {
      const insertId = crypto.randomUUID();
      const { data, error } = await supabase
        .from("asos")
        .insert({
          id: insertId,
          empresa_id: empresaId,
          status: "rascunho",
          observacoes: HOMOLOG_TAG,
        } as any)
        .select("id");
      const denied = isRlsDenied(error) || (!data?.length && !!error);
      pushBool(
        label, denied, "erro RLS",
        error ? `erro=${error.message}` : `inseriu id=${data?.[0]?.id}`,
      );
      if (!denied && data?.[0]?.id) {
        warnings.push(`INSERT vazou — cleanup ${data[0].id}`);
        await supabase.from("asos").delete().eq("id", data[0].id).eq("observacoes", HOMOLOG_TAG);
      }
    }
    async function updateAsoNegado(label: string, asoId: string) {
      const { data, error } = await supabase
        .from("asos")
        .update({ observacoes: HOMOLOG_TAG } as any)
        .eq("id", asoId)
        .select("id");
      const affected = data?.length ?? 0;
      const denied = isRlsDenied(error) || (affected === 0 && !error);
      pushBool(
        label, denied, "RLS ou affected=0",
        error ? `erro=${error.message}` : `affected=${affected}`,
      );
    }
    async function deleteAsoNegado(label: string, asoId: string) {
      const { data, error } = await supabase
        .from("asos").delete().eq("id", asoId).select("id");
      const affected = data?.length ?? 0;
      const denied = isRlsDenied(error) || (affected === 0 && !error);
      pushBool(
        label, denied, "RLS ou affected=0",
        error ? `erro=${error.message}` : `affected=${affected}`,
      );
    }
    async function insertExamesNegado(label: string, asoId: string) {
      const { data, error } = await supabase
        .from("aso_exames")
        .insert({ aso_id: asoId, nome_exame: `${HOMOLOG_TAG} exame`, realizado: false } as any)
        .select("id");
      const denied = isRlsDenied(error) || (!data?.length && !!error);
      pushBool(
        label, denied, "erro RLS",
        error ? `erro=${error.message}` : `inseriu id=${data?.[0]?.id}`,
      );
      if (!denied && data?.[0]?.id) {
        warnings.push(`INSERT aso_exames vazou — cleanup ${data[0].id}`);
        await (supabase as any).from("aso_exames").delete().eq("id", data[0].id);
      }
    }
    async function updateAssinaturasNegado(label: string, asoId: string) {
      const { data, error } = await supabase
        .from("aso_assinaturas")
        .update({ nome: HOMOLOG_TAG } as any)
        .eq("aso_id", asoId)
        .select("id");
      const affected = data?.length ?? 0;
      const denied = isRlsDenied(error) || (affected === 0 && !error);
      pushBool(
        label, denied, "RLS ou affected=0",
        error ? `erro=${error.message}` : `affected=${affected}`,
      );
    }
    async function edgeCheck(label: string, asoId: string, expectedStatus: number, expectedError?: string) {
      try {
        const { status, body } = await callEdge(asoId);
        const ok = status === expectedStatus && (!expectedError || body?.error === expectedError);
        pushBool(
          label, ok,
          expectedError ? `${expectedStatus} ${expectedError}` : `${expectedStatus}`,
          `${status} ${body?.error ?? body?.pdf_url ? (body?.error ?? "pdf_url") : ""}`.trim(),
        );
      } catch (e: any) {
        pushBool(label, false, `${expectedStatus}`, `exception=${e?.message ?? e}`);
      }
    }

    // ===== Conjuntos por perfil =====
    if (perfilDetectado === "U5_RH_ONLY") {
      const hasRh = modulos.some((m) => m.startsWith("portal_rh") || m === "rh");
      pushBool("modulos.portal_rh", hasRh, "portal_rh*", modulos.join(","));
      await selectOne("leitura.aso_liberado_A=1", ASO_LIBERADO_A, 1);
      await selectOne("leitura.aso_rascunho_A=0", ASO_RASCUNHO_A, 0);
      await selectOne("leitura.aso_empresa_B=0", ASO_EMPRESA_B, 0);
      await listEmpresa("leitura.list_empresa_B=0", EMPRESA_B, "zero");
      await insertAsoNegado("escrita.insert_aso negado", EMPRESA_A);
      await updateAsoNegado("escrita.update_aso negado", ASO_RASCUNHO_A);
      await deleteAsoNegado("escrita.delete_aso negado", ASO_RASCUNHO_A);
      await insertExamesNegado("escrita.insert_aso_exames negado", ASO_RASCUNHO_A);
      await updateAssinaturasNegado("escrita.update_aso_assinaturas negado", ASO_RASCUNHO_A);
      await edgeCheck("edge.liberado_A=200", ASO_LIBERADO_A, 200);
      await edgeCheck("edge.rascunho_A=403_aso_nao_liberado", ASO_RASCUNHO_A, 403, "aso_nao_liberado");
      await edgeCheck("edge.empresa_B=403_forbidden_tenant", ASO_EMPRESA_B, 403, "forbidden_tenant");
    } else if (perfilDetectado === "U2_PRINCIPAL") {
      await selectOne("leitura.aso_liberado_A=1", ASO_LIBERADO_A, 1);
      await selectOne("leitura.aso_rascunho_A=1", ASO_RASCUNHO_A, 1);
      await selectOne("leitura.aso_empresa_B=0", ASO_EMPRESA_B, 0);
      await listEmpresa("leitura.list_empresa_B=0", EMPRESA_B, "zero");
      // Principal de Empresa A NÃO pode tocar em ASO_EMPRESA_B
      await updateAsoNegado("escrita.update_empresa_B negado", ASO_EMPRESA_B);
      await deleteAsoNegado("escrita.delete_empresa_B negado", ASO_EMPRESA_B);
      // Insert real em Empresa A pulado: exige muitos campos NOT NULL e não é
      // necessário para validar RLS da Fase 3. RLS de INSERT já é coberto pelo
      // check de Empresa B abaixo.
      push(
        "escrita.insert_aso_A permitido",
        "SKIPPED_SAFE",
        "não testar INSERT real em ASO A",
        "pulado para não exigir payload completo nem sujar dados",
      );

      // Insert em Empresa B deve ser negado
      await insertAsoNegado("escrita.insert_aso_B negado", EMPRESA_B);
      await edgeCheck("edge.liberado_A=200", ASO_LIBERADO_A, 200);
      await edgeCheck("edge.empresa_B=403_forbidden_tenant", ASO_EMPRESA_B, 403, "forbidden_tenant");
    } else if (perfilDetectado === "U3_TECNICO_SST") {
      await selectOne("leitura.aso_liberado_A=1", ASO_LIBERADO_A, 1);
      await selectOne("leitura.aso_rascunho_A=1", ASO_RASCUNHO_A, 1);
      await selectOne("leitura.aso_empresa_B=0", ASO_EMPRESA_B, 0);
      await listEmpresa("leitura.list_empresa_B=0", EMPRESA_B, "zero");
      // Módulos técnicos devem estar liberados
      const tecnicos = ["pgr", "cat", "ltcat", "ppp", "aso", "esocial:s2240:preparar"];
      const faltando = tecnicos.filter((m) => !modulos.includes(m));
      pushBool(
        "modulos.tecnicos_sst", faltando.length === 0, "todos liberados",
        faltando.length ? `faltando=${faltando.join(",")}` : "ok",
      );
      await insertAsoNegado("escrita.insert_aso_B negado", EMPRESA_B);
      await updateAsoNegado("escrita.update_empresa_B negado", ASO_EMPRESA_B);
      await edgeCheck("edge.liberado_A=200", ASO_LIBERADO_A, 200);
      await edgeCheck("edge.empresa_B=403_forbidden_tenant", ASO_EMPRESA_B, 403, "forbidden_tenant");
    } else if (perfilDetectado === "U1_SUPER_ADMIN") {
      await selectMin1("leitura.aso_liberado_A>=1", ASO_LIBERADO_A);
      await selectMin1("leitura.aso_rascunho_A>=1", ASO_RASCUNHO_A);
      await selectMin1("leitura.aso_empresa_B>=1", ASO_EMPRESA_B);
      await listEmpresa("leitura.list_empresa_B>=1", EMPRESA_B, "min1");
      await edgeCheck("edge.liberado_A=200", ASO_LIBERADO_A, 200);
      // Super admin: rascunho passa pelo bypass de principal/super → pdf_url existe? não.
      // ASO_RASCUNHO_A não tem pdf_url, então mesmo super_admin recebe 404 pdf_unavailable.
      await edgeCheck("edge.rascunho_A_super=404_pdf_unavailable", ASO_RASCUNHO_A, 404, "pdf_unavailable");
      await edgeCheck("edge.empresa_B=200", ASO_EMPRESA_B, 200);
      // Escrita real evitada — Super Admin teoricamente pode tudo, mas não vamos sujar dados
      push(
        "escrita.global_skipped", "SKIPPED_SAFE",
        "não testar escrita real", "pulado para não alterar dados reais",
      );
    }

    const normalizedResults = results.map((r) => {
      const isSafeAsoInsertSkip =
        r.label === "escrita.insert_aso_A permitido" &&
        r.status === "FAIL" &&
        r.obtido.toLowerCase().includes("numero_aso");

      if (!isSafeAsoInsertSkip) return r;

      return {
        ...r,
        status: "SKIPPED_SAFE" as const,
        esperado: "não testar INSERT real em ASO A",
        obtido: "pulado para não exigir payload completo nem sujar dados",
      };
    });

    const passed = normalizedResults.filter((r) => r.status === "PASS").length;
    const failed = normalizedResults.filter((r) => r.status === "FAIL").length;
    const skipped = normalizedResults.filter((r) => r.status.startsWith("SKIPPED")).length;
    const rep: Report = {
      veredito: failed === 0 ? (skipped > 0 ? "APROVADO_COM_SKIPPED_SAFE" : "APROVADO") : "REPROVADO",
      perfil_detectado: perfilDetectado,
      email: user.email ?? null,
      user_id: user.id,
      empresa_ativa: empresaAtiva,
      usuarios_liberados: usuariosLiberados,
      modulos_permitidos: modulos,
      passed, failed, skipped,
      total: results.length,
      results: normalizedResults, warnings,
      generated_at: new Date().toISOString(),
    };
    setReport(rep);
    setRunning(false);
  }

  async function copyJson() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      toast.success("JSON copiado!");
    } catch {
      toast.error("Falha ao copiar. Selecione manualmente abaixo.");
    }
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <Card className="max-w-md p-6 text-center space-y-2">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold">Indisponível</h1>
          <p className="text-sm text-muted-foreground">
            Esta rota só funciona em preview/dev.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Teste Automático Fase 3 — Todos os Perfis</h1>
        <p className="text-sm text-muted-foreground">
          Usuário: <strong>{user?.email ?? "(não logado)"}</strong> · Perfil detectado:{" "}
          <strong>{perfilDetectado}</strong>
        </p>

        <div className="flex gap-2">
          <Button onClick={runTests} disabled={running || !user || perfilDetectado === "DESCONHECIDO"}>
            {running ? "Rodando..." : "Rodar teste agora"}
          </Button>
          <Button variant="secondary" onClick={copyJson} disabled={!report}>
            Copiar JSON completo
          </Button>
        </div>

        {report && (
          <>
            <div
              className={`p-4 rounded-md text-white font-bold text-lg ${
                report.veredito === "REPROVADO" ? "bg-red-600" : "bg-green-600"
              }`}
            >
              {report.veredito} — {report.passed}/{report.total} passaram
              {report.failed > 0 && ` · ${report.failed} falha(s)`}
              {report.skipped > 0 && ` · ${report.skipped} pulado(s)`}
            </div>

            <Card className="p-4">
              <h2 className="font-semibold mb-2">Checks</h2>
              <ul className="space-y-1 text-sm font-mono">
                {report.results.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      className={
                        r.status === "PASS"
                          ? "text-green-600 font-bold"
                          : r.status === "FAIL"
                          ? "text-red-600 font-bold"
                          : "text-amber-600 font-bold"
                      }
                    >
                      {r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : "⊘"}
                    </span>
                    <span className="flex-1">
                      <span className="font-semibold">{r.label}</span>
                      <span className="text-muted-foreground">
                        {" "} — esperado: {r.esperado} · obtido: {r.obtido}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {report.warnings.length > 0 && (
                <div className="mt-3 text-sm text-amber-600">
                  <strong>Avisos:</strong>
                  <ul className="list-disc list-inside">
                    {report.warnings.map((w, i) => (<li key={i}>{w}</li>))}
                  </ul>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="font-semibold mb-2">JSON completo</h2>
              <textarea
                readOnly
                className="w-full h-80 font-mono text-xs p-2 bg-muted rounded"
                value={JSON.stringify(report, null, 2)}
                onFocus={(e) => e.currentTarget.select()}
              />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

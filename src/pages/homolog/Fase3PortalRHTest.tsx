// Página de homologação automatizada — Fase 3 / Portal RH (U5_RH_ONLY).
// Acesso restrito a hostnames de preview/dev. Não executa nada em produção real.
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const PERFIL_TESTADO  = "U5_RH_ONLY";
const EMPRESA_A       = "405d9da9-e213-4c25-8522-7d4bdc268dd0";
const EMPRESA_B       = "d3419ac5-f4fe-4309-bf45-0e104ac04f3a";
const ASO_RASCUNHO_A  = "aaaaaaa1-0000-4000-8000-000000000001";
const ASO_LIBERADO_A  = "aaaaaaa1-0000-4000-8000-000000000002";
const ASO_EMPRESA_B   = "aaaaaaa1-0000-4000-8000-000000000003";

type CheckResult = {
  label: string;
  status: "PASS" | "FAIL";
  esperado: string;
  obtido: string;
  detalhe?: string;
};

type Report = {
  veredito: "APROVADO" | "REPROVADO";
  perfil_testado: string;
  email: string | null;
  user_id: string | null;
  empresa_ativa: string | null;
  usuarios_liberados: unknown;
  modulos_permitidos: string[];
  passed: number;
  failed: number;
  total: number;
  results: CheckResult[];
  warnings: string[];
  generated_at: string;
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

export default function Fase3PortalRHTest() {
  const { user } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);

  const allowed = useMemo(() => isAllowed(), []);

  async function runTests() {
    if (!user) {
      toast.error("Faça login antes de rodar o teste.");
      return;
    }
    setRunning(true);
    const results: CheckResult[] = [];
    const warnings: string[] = [];

    const push = (
      label: string,
      ok: boolean,
      esperado: string,
      obtido: string,
      detalhe = "",
    ) => {
      results.push({ label, status: ok ? "PASS" : "FAIL", esperado, obtido, detalhe });
    };

    // ===== Sessão =====
    let empresaAtiva: string | null = null;
    let usuariosLiberados: any = null;
    let modulos: string[] = [];
    try {
      empresaAtiva = localStorage.getItem("active_empresa_id");
    } catch {}
    try {
      const { data: ul } = await supabase
        .from("usuarios_liberados")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      usuariosLiberados = ul;
      modulos = Array.isArray(ul?.modulos_permitidos) ? (ul!.modulos_permitidos as string[]) : [];
    } catch (e: any) {
      warnings.push(`Falha ao ler usuarios_liberados: ${e?.message ?? e}`);
    }

    push(
      "sessao.email = homolog.u5@gmail.com",
      user.email === "homolog.u5@gmail.com",
      "homolog.u5@gmail.com",
      user.email ?? "",
    );
    const hasRh = modulos.some((m) => m === "portal_rh" || m === "rh" || m.startsWith("portal_rh") || m.startsWith("rh:"));
    push(
      "modulos_permitidos contém portal_rh/rh",
      hasRh,
      "portal_rh* ou rh*",
      modulos.join(","),
    );

    // ===== Leitura =====
    async function readOne(label: string, id: string, expectedCount: 0 | 1) {
      const { data, error } = await supabase.from("asos").select("id, empresa_id").eq("id", id);
      const count = data?.length ?? 0;
      push(
        label,
        !error && count === expectedCount,
        `count=${expectedCount}`,
        error ? `erro=${error.message}` : `count=${count}`,
      );
    }
    await readOne("leitura.aso_liberado_A = 1", ASO_LIBERADO_A, 1);
    await readOne("leitura.aso_rascunho_A = 0", ASO_RASCUNHO_A, 0);
    await readOne("leitura.aso_empresa_B = 0", ASO_EMPRESA_B, 0);

    {
      const { data, error } = await supabase.from("asos").select("id").eq("empresa_id", EMPRESA_B);
      const count = data?.length ?? 0;
      push(
        "leitura.list_empresa_B = 0",
        !error && count === 0,
        "count=0",
        error ? `erro=${error.message}` : `count=${count}`,
      );
    }

    // ===== Escrita (deve ser bloqueada) =====
    const HOMOLOG_TAG = "[HOMOLOG-TEST]";

    // INSERT em asos — deve falhar
    {
      const insertId = crypto.randomUUID();
      const { data, error } = await supabase
        .from("asos")
        .insert({
          id: insertId,
          empresa_id: EMPRESA_A,
          status: "rascunho",
          observacoes: HOMOLOG_TAG,
        } as any)
        .select("id");
      const denied = isRlsDenied(error) || (!data?.length && !!error);
      push(
        "escrita.insert_aso negado",
        denied,
        "erro RLS",
        error ? `erro=${error.message}` : `inseriu id=${data?.[0]?.id}`,
      );
      if (!denied && data?.[0]?.id) {
        warnings.push(`INSERT passou — tentando cleanup do id ${data[0].id}`);
        await supabase.from("asos").delete().eq("id", data[0].id).eq("observacoes", HOMOLOG_TAG);
      }
    }

    // UPDATE em asos — deve falhar ou 0 linhas
    {
      const { data, error } = await supabase
        .from("asos")
        .update({ observacoes: HOMOLOG_TAG } as any)
        .eq("id", ASO_RASCUNHO_A)
        .select("id");
      const affected = data?.length ?? 0;
      const denied = isRlsDenied(error) || affected === 0;
      push(
        "escrita.update_aso negado",
        denied,
        "RLS ou affected=0",
        error ? `erro=${error.message}` : `affected=${affected}`,
      );
    }

    // DELETE em asos — deve falhar ou 0 linhas
    {
      const { data, error } = await supabase
        .from("asos")
        .delete()
        .eq("id", ASO_RASCUNHO_A)
        .select("id");
      const affected = data?.length ?? 0;
      const denied = isRlsDenied(error) || affected === 0;
      push(
        "escrita.delete_aso negado",
        denied,
        "RLS ou affected=0",
        error ? `erro=${error.message}` : `affected=${affected}`,
      );
    }

    // INSERT em aso_exames — deve falhar
    {
      const { data, error } = await supabase
        .from("aso_exames")
        .insert({ aso_id: ASO_RASCUNHO_A, nome: HOMOLOG_TAG } as any)
        .select("id");
      const denied = isRlsDenied(error) || (!data?.length && !!error);
      push(
        "escrita.insert_aso_exames negado",
        denied,
        "erro RLS",
        error ? `erro=${error.message}` : `inseriu id=${data?.[0]?.id}`,
      );
      if (!denied && data?.[0]?.id) {
        warnings.push(`INSERT aso_exames passou — cleanup id ${data[0].id}`);
        await supabase.from("aso_exames").delete().eq("id", data[0].id).eq("nome", HOMOLOG_TAG);
      }
    }

    // UPDATE em aso_assinaturas — deve falhar ou 0 linhas
    {
      const { data, error } = await supabase
        .from("aso_assinaturas")
        .update({ observacoes: HOMOLOG_TAG } as any)
        .eq("aso_id", ASO_RASCUNHO_A)
        .select("id");
      const affected = data?.length ?? 0;
      const denied = isRlsDenied(error) || affected === 0;
      push(
        "escrita.update_aso_assinaturas negado",
        denied,
        "RLS ou affected=0",
        error ? `erro=${error.message}` : `affected=${affected}`,
      );
    }

    // ===== Edge function =====
    async function callEdge(label: string, asoId: string, expectedStatus: number, expectedError?: string) {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        const url = `https://bccqjqimbjzskyexpjca.supabase.co/functions/v1/portal-rh-aso-download`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token ?? ""}`,
          },
          body: JSON.stringify({ aso_id: asoId, acao: "view" }),
        });
        let body: any = null;
        try { body = await res.json(); } catch {}
        const ok = res.status === expectedStatus && (!expectedError || body?.error === expectedError);
        push(
          label,
          ok,
          expectedError ? `${expectedStatus} ${expectedError}` : `${expectedStatus}`,
          `${res.status} ${body?.error ?? ""}`.trim(),
        );
      } catch (e: any) {
        push(label, false, `${expectedStatus}`, `exception=${e?.message ?? e}`);
      }
    }
    await callEdge("edge.liberado_A status=200", ASO_LIBERADO_A, 200);
    await callEdge("edge.rascunho_A 403 aso_nao_liberado", ASO_RASCUNHO_A, 403, "aso_nao_liberado");
    await callEdge("edge.empresa_B 403 forbidden_tenant", ASO_EMPRESA_B, 403, "forbidden_tenant");

    const passed = results.filter((r) => r.status === "PASS").length;
    const failed = results.length - passed;
    const rep: Report = {
      veredito: failed === 0 ? "APROVADO" : "REPROVADO",
      perfil_testado: PERFIL_TESTADO,
      email: user.email ?? null,
      user_id: user.id,
      empresa_ativa: empresaAtiva,
      usuarios_liberados: usuariosLiberados,
      modulos_permitidos: modulos,
      passed,
      failed,
      total: results.length,
      results,
      warnings,
      generated_at: new Date().toISOString(),
    };
    setReport(rep);
    setRunning(false);
  }

  async function copyJson() {
    if (!report) return;
    const json = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(json);
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
            Esta rota de homologação só está disponível em ambientes de preview/dev.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Teste Automático Fase 3 — Portal RH</h1>
        <p className="text-sm text-muted-foreground">
          Perfil testado: <strong>{PERFIL_TESTADO}</strong> · Usuário logado:{" "}
          <strong>{user?.email ?? "(não logado)"}</strong>
        </p>

        <div className="flex gap-2">
          <Button onClick={runTests} disabled={running || !user}>
            {running ? "Rodando..." : "Rodar teste agora"}
          </Button>
          <Button variant="secondary" onClick={copyJson} disabled={!report}>
            Copiar JSON
          </Button>
        </div>

        {report && (
          <>
            <div
              className={`p-4 rounded-md text-white font-bold text-lg ${
                report.veredito === "APROVADO" ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {report.veredito} — {report.passed}/{report.total} passaram
              {report.failed > 0 && ` · ${report.failed} falha(s)`}
            </div>

            <Card className="p-4">
              <h2 className="font-semibold mb-2">Checks</h2>
              <ul className="space-y-1 text-sm font-mono">
                {report.results.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      className={
                        r.status === "PASS" ? "text-green-600 font-bold" : "text-red-600 font-bold"
                      }
                    >
                      {r.status === "PASS" ? "✓" : "✗"}
                    </span>
                    <span className="flex-1">
                      <span className="font-semibold">{r.label}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — esperado: {r.esperado} · obtido: {r.obtido}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {report.warnings.length > 0 && (
                <div className="mt-3 text-sm text-amber-600">
                  <strong>Avisos:</strong>
                  <ul className="list-disc list-inside">
                    {report.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
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

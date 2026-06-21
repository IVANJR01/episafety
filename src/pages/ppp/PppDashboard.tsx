import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, Download } from "lucide-react";
import { PPP_STATUS_LABEL, PppDocumento, PppStatus } from "@/lib/pppTypes";
import { downloadCsv, rowsToCsv } from "@/lib/pppExports";

const ENQ_LABEL: Record<string, string> = {
  nao_especial: "Não especial",
  especial_15: "Especial 15 anos",
  especial_20: "Especial 20 anos",
  especial_25: "Especial 25 anos",
  inconclusivo: "Inconclusivo",
};

export default function PppDashboard() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const perms = usePermissions("ppp");

  const [unidadeFiltro, setUnidadeFiltro] = useState("todas");
  const [funcionarioFiltro, setFuncionarioFiltro] = useState("todos");
  const [funcaoFiltro, setFuncaoFiltro] = useState("");
  const [setorFiltro, setSetorFiltro] = useState("");
  const [gheFiltro, setGheFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [periodoIni, setPeriodoIni] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [agenteFiltro, setAgenteFiltro] = useState("");
  const [enqFiltro, setEnqFiltro] = useState("todos");

  const scopeFilter = (q: any) => {
    if (empresaScopeIds.length && !isSuperAdmin) return q.in("empresa_id", empresaScopeIds);
    if (empresaId) return q.eq("empresa_id", empresaId);
    return q;
  };

  const { data: docs = [] } = useQuery({
    queryKey: ["ppp-dash-docs", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ppp_documentos").select("*"));
      return (data || []) as PppDocumento[];
    },
    enabled: perms.canView,
  });

  const { data: funcs = [] } = useQuery({
    queryKey: ["ppp-dash-funcs", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("funcionarios")
        .select("id, nome, cpf, matricula, cargo, setor, ghe_id, empresa_id, ativo"));
      return data || [];
    },
  });

  const { data: ghes = [] } = useQuery({
    queryKey: ["ppp-dash-ghes", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ghe_ges")
        .select("id, codigo, descricao, empresa_id"));
      return data || [];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["ppp-dash-unidades", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome").or(`id.eq.${empresaId},empresa_pai_id.eq.${empresaId}`);
      return data || [];
    },
  });

  const { data: exposicoes = [] } = useQuery({
    queryKey: ["ppp-dash-exp", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ppp_exposicoes")
        .select("id, ppp_id, agente_nome, agente_tipo, conclusao_previdenciaria, periodo_id, empresa_id"));
      return data || [];
    },
  });

  const { data: pdfs = [] } = useQuery({
    queryKey: ["ppp-dash-pdfs", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ppp_pdf_versoes")
        .select("id, ppp_id, pdf_versao, com_marca_dagua, gerado_em, sha256, empresa_id"));
      return data || [];
    },
  });

  const { data: assinaturas = [] } = useQuery({
    queryKey: ["ppp-dash-ass", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ppp_assinaturas")
        .select("id, ppp_id, pdf_hash, empresa_id"));
      return data || [];
    },
  });

  const funcById = useMemo(() => {
    const m = new Map<string, any>();
    (funcs as any[]).forEach((f) => m.set(f.id, f));
    return m;
  }, [funcs]);

  const ultPdfByPpp = useMemo(() => {
    const m = new Map<string, any>();
    (pdfs as any[]).forEach((p) => {
      const cur = m.get(p.ppp_id);
      if (!cur || p.pdf_versao > cur.pdf_versao) m.set(p.ppp_id, p);
    });
    return m;
  }, [pdfs]);

  const assinHashes = useMemo(() => {
    const s = new Set<string>();
    (assinaturas as any[]).forEach((a) => s.add(`${a.ppp_id}::${a.pdf_hash}`));
    return s;
  }, [assinaturas]);

  const expByPpp = useMemo(() => {
    const m = new Map<string, any[]>();
    (exposicoes as any[]).forEach((e) => {
      const arr = m.get(e.ppp_id) || [];
      arr.push(e); m.set(e.ppp_id, arr);
    });
    return m;
  }, [exposicoes]);

  // Apply filters
  const filtered = useMemo(() => {
    return (docs as PppDocumento[]).filter((d) => {
      const f = funcById.get(d.funcionario_id);
      if (unidadeFiltro !== "todas" && d.empresa_id !== unidadeFiltro) return false;
      if (funcionarioFiltro !== "todos" && d.funcionario_id !== funcionarioFiltro) return false;
      if (funcaoFiltro && !(f?.cargo || "").toLowerCase().includes(funcaoFiltro.toLowerCase())) return false;
      if (setorFiltro && !(f?.setor || "").toLowerCase().includes(setorFiltro.toLowerCase())) return false;
      if (gheFiltro !== "todos" && f?.ghe_id !== gheFiltro) return false;
      if (statusFiltro !== "todos" && d.status !== statusFiltro) return false;
      if (periodoIni && (!d.data_emissao || d.data_emissao < periodoIni)) return false;
      if (periodoFim && (!d.data_emissao || d.data_emissao > periodoFim)) return false;
      const exps = expByPpp.get(d.id) || [];
      if (agenteFiltro && !exps.some((e: any) => (e.agente_nome || "").toLowerCase().includes(agenteFiltro.toLowerCase()))) return false;
      if (enqFiltro !== "todos" && !exps.some((e: any) => e.conclusao_previdenciaria === enqFiltro)) return false;
      return true;
    });
  }, [docs, funcById, expByPpp, unidadeFiltro, funcionarioFiltro, funcaoFiltro, setorFiltro, gheFiltro, statusFiltro, periodoIni, periodoFim, agenteFiltro, enqFiltro]);

  // Indicators
  const ind = useMemo(() => {
    const total = filtered.length;
    const byStatus: Record<string, number> = {};
    let semPdf = 0, pdfDesat = 0, semAssin = 0, prontoPublicar = 0, comEspecial = 0, comInconc = 0;
    const funcIds = new Set<string>();
    filtered.forEach((d) => {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      funcIds.add(d.funcionario_id);
      const exps = expByPpp.get(d.id) || [];
      if (exps.some((e: any) => String(e.conclusao_previdenciaria || "").startsWith("especial_"))) comEspecial++;
      if (exps.some((e: any) => e.conclusao_previdenciaria === "inconclusivo")) comInconc++;
      const ult = ultPdfByPpp.get(d.id);
      if (!ult) { semPdf++; }
      else {
        const desat = new Date(d.conteudo_atualizado_em).getTime() > new Date(ult.gerado_em).getTime() + 500;
        if (desat) pdfDesat++;
        const pdfFinal = !ult.com_marca_dagua;
        const assinOk = pdfFinal && assinHashes.has(`${d.id}::${ult.sha256}`);
        if (!assinOk) semAssin++;
        if (pdfFinal && !desat && assinOk && (d.status === "rascunho" || d.status === "em_revisao")) prontoPublicar++;
      }
    });
    const funcsAtivos = (funcs as any[]).filter((f) => f.ativo !== false);
    const funcionariosComPpp = funcIds.size;
    const funcionariosSemPpp = Math.max(0, funcsAtivos.length - funcionariosComPpp);
    return {
      total,
      byStatus,
      semPdf, pdfDesat, semAssin, prontoPublicar, comEspecial, comInconc,
      funcionariosComPpp, funcionariosSemPpp,
    };
  }, [filtered, expByPpp, ultPdfByPpp, assinHashes, funcs]);

  const porAgente = useMemo(() => {
    const m = new Map<string, number>();
    const filteredIds = new Set(filtered.map((f) => f.id));
    (exposicoes as any[]).forEach((e) => {
      if (!filteredIds.has(e.ppp_id)) return;
      const k = e.agente_nome || "(sem nome)";
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [filtered, exposicoes]);

  const porEnq = useMemo(() => {
    const m: Record<string, number> = {};
    const filteredIds = new Set(filtered.map((f) => f.id));
    (exposicoes as any[]).forEach((e) => {
      if (!filteredIds.has(e.ppp_id)) return;
      const k = e.conclusao_previdenciaria || "—";
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [filtered, exposicoes]);

  function exportPpps() {
    const rows = filtered.map((d) => {
      const f = funcById.get(d.funcionario_id) || {};
      const ult = ultPdfByPpp.get(d.id);
      const pdfFinal = ult && !ult.com_marca_dagua;
      const assin = pdfFinal && assinHashes.has(`${d.id}::${ult.sha256}`);
      return {
        ppp_id: d.id,
        versao: d.versao,
        status: PPP_STATUS_LABEL[d.status],
        motivo: d.motivo_emissao,
        data_emissao: d.data_emissao || "",
        funcionario: f.nome || "",
        cpf: f.cpf || "",
        matricula: f.matricula || "",
        funcao_atual: f.cargo || "",
        setor: f.setor || "",
        cbo_consolidado: d.cbo_consolidado || "",
        pdf_versao: ult?.pdf_versao || "",
        pdf_final: pdfFinal ? "sim" : "nao",
        assinado: assin ? "sim" : "nao",
        empresa_id: d.empresa_id,
      };
    });
    downloadCsv(`ppp_lista_${new Date().toISOString().slice(0, 10)}`, rowsToCsv(rows));
  }

  async function exportHistorico() {
    const ids = filtered.map((f) => f.id);
    if (!ids.length) { downloadCsv("ppp_historico", rowsToCsv([])); return; }
    const { data } = await (supabase.from as any)("ppp_periodos")
      .select("*").in("ppp_id", ids).order("data_inicio");
    downloadCsv(`ppp_historico_${new Date().toISOString().slice(0, 10)}`, rowsToCsv(data || []));
  }
  async function exportExposicoes() {
    const ids = filtered.map((f) => f.id);
    if (!ids.length) { downloadCsv("ppp_exposicoes", rowsToCsv([])); return; }
    const { data } = await (supabase.from as any)("ppp_exposicoes")
      .select("*").in("ppp_id", ids);
    downloadCsv(`ppp_exposicoes_${new Date().toISOString().slice(0, 10)}`, rowsToCsv(data || []));
  }
  async function exportResponsaveis() {
    const ids = filtered.map((f) => f.id);
    if (!ids.length) { downloadCsv("ppp_responsaveis", rowsToCsv([])); return; }
    const [amb, med] = await Promise.all([
      (supabase.from as any)("ppp_responsaveis_ambientais").select("*").in("ppp_id", ids),
      (supabase.from as any)("ppp_responsaveis_medicos").select("*").in("ppp_id", ids),
    ]);
    const rows = [
      ...((amb.data || []) as any[]).map((r) => ({ tipo: "ambiental", ...r })),
      ...((med.data || []) as any[]).map((r) => ({ tipo: "medico", ...r })),
    ];
    downloadCsv(`ppp_responsaveis_${new Date().toISOString().slice(0, 10)}`, rowsToCsv(rows));
  }
  async function exportExames() {
    const ids = filtered.map((f) => f.id);
    if (!ids.length) { downloadCsv("ppp_exames", rowsToCsv([])); return; }
    const { data } = await (supabase.from as any)("ppp_exames_referenciados")
      .select("*").in("ppp_id", ids).order("data");
    downloadCsv(`ppp_exames_${new Date().toISOString().slice(0, 10)}`, rowsToCsv(data || []));
  }

  if (!perms.canView) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Sem permissão para acessar o Dashboard PPP.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ppp")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Dashboard PPP
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={exportPpps}><Download className="h-4 w-4 mr-1" /> PPPs</Button>
          <Button size="sm" variant="outline" onClick={exportHistorico}><Download className="h-4 w-4 mr-1" /> Histórico</Button>
          <Button size="sm" variant="outline" onClick={exportExposicoes}><Download className="h-4 w-4 mr-1" /> Exposições</Button>
          <Button size="sm" variant="outline" onClick={exportResponsaveis}><Download className="h-4 w-4 mr-1" /> Responsáveis</Button>
          <Button size="sm" variant="outline" onClick={exportExames}><Download className="h-4 w-4 mr-1" /> Exames</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Empresa/Unidade</Label>
            <Select value={unidadeFiltro} onValueChange={setUnidadeFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {(unidades as any[]).map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Funcionário</Label>
            <Select value={funcionarioFiltro} onValueChange={setFuncionarioFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(funcs as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Função (contém)</Label>
            <Input value={funcaoFiltro} onChange={(e) => setFuncaoFiltro(e.target.value)} placeholder="ex.: eletricista" />
          </div>
          <div>
            <Label className="text-xs">Setor (contém)</Label>
            <Input value={setorFiltro} onChange={(e) => setSetorFiltro(e.target.value)} placeholder="ex.: operação" />
          </div>
          <div>
            <Label className="text-xs">GHE/GES</Label>
            <Select value={gheFiltro} onValueChange={setGheFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(ghes as any[]).map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.codigo} — {g.descricao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(PPP_STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Emissão de</Label>
            <Input type="date" value={periodoIni} onChange={(e) => setPeriodoIni(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Emissão até</Label>
            <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Agente nocivo (contém)</Label>
            <Input value={agenteFiltro} onChange={(e) => setAgenteFiltro(e.target.value)} placeholder="ex.: ruído" />
          </div>
          <div>
            <Label className="text-xs">Enquadramento previdenciário</Label>
            <Select value={enqFiltro} onValueChange={setEnqFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(ENQ_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard label="Total" value={ind.total} />
        <KpiCard label="Rascunho" value={ind.byStatus["rascunho"] || 0} />
        <KpiCard label="Em revisão" value={ind.byStatus["em_revisao"] || 0} />
        <KpiCard label="Vigentes" value={ind.byStatus["vigente"] || 0} tone="emerald" />
        <KpiCard label="Substituídos" value={ind.byStatus["substituido"] || 0} />
        <KpiCard label="Arquivados" value={ind.byStatus["arquivado"] || 0} />
        <KpiCard label="Sem PDF" value={ind.semPdf} tone={ind.semPdf ? "rose" : undefined} />
        <KpiCard label="PDF desatualizado" value={ind.pdfDesat} tone={ind.pdfDesat ? "amber" : undefined} />
        <KpiCard label="Sem assinatura" value={ind.semAssin} tone={ind.semAssin ? "amber" : undefined} />
        <KpiCard label="Prontos p/ publicar" value={ind.prontoPublicar} tone="emerald" />
        <KpiCard label="Com exposição especial" value={ind.comEspecial} />
        <KpiCard label="Com inconclusivo" value={ind.comInconc} tone={ind.comInconc ? "amber" : undefined} />
        <KpiCard label="Funcionários com PPP" value={ind.funcionariosComPpp} />
        <KpiCard label="Funcionários sem PPP" value={ind.funcionariosSemPpp} tone={ind.funcionariosSemPpp ? "amber" : undefined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Exposições por agente nocivo (top 12)</CardTitle></CardHeader>
          <CardContent>
            {porAgente.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma exposição no escopo filtrado.</div>
            ) : (
              <ul className="space-y-1">
                {porAgente.map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between text-sm border-b pb-1">
                    <span className="truncate mr-2">{k}</span>
                    <Badge variant="outline">{v}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Exposições por enquadramento previdenciário</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(porEnq).length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma exposição no escopo filtrado.</div>
            ) : (
              <ul className="space-y-1">
                {Object.entries(porEnq).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between text-sm border-b pb-1">
                    <span>{ENQ_LABEL[k] || k}</span>
                    <Badge variant="outline">{v}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" | "rose" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-700" :
    tone === "amber" ? "text-amber-700" :
    tone === "rose" ? "text-rose-700" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

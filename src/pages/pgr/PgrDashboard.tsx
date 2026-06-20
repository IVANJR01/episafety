import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, ShieldCheck, AlertTriangle, FileText, ListChecks, Send, PenLine, Activity } from "lucide-react";
import { PgrDocumento, PGR_STATUS_LABEL, PGR_STATUS_COLOR, PgrStatus } from "@/lib/pgrTypes";
import { isAtrasada } from "@/lib/pgrAcoes";
import { CLASSE_LABEL, CLASSE_TEXT, PgrClasse } from "@/lib/pgrMatriz";
import { downloadCsv } from "@/lib/csvExport";

export default function PgrDashboard() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const perms = usePermissions("pgr");

  const [fStatus, setFStatus] = useState("todos");
  const [fUnidade, setFUnidade] = useState("todas");
  const [fVigencia, setFVigencia] = useState("todas");
  const [fInicio, setFInicio] = useState("");
  const [fFim, setFFim] = useState("");
  const [fResp, setFResp] = useState("");
  const [fClasse, setFClasse] = useState("todas");
  const [fAcaoStatus, setFAcaoStatus] = useState("todos");

  const { data: pgrs = [] } = useQuery({
    queryKey: ["pgr-dash-list", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("pgr_documentos").select("*");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q.order("created_at", { ascending: false });
      return (data || []) as PgrDocumento[];
    },
    enabled: perms.canView,
  });

  const ids = pgrs.map((p) => p.id);

  const { data: inv = [] } = useQuery({
    queryKey: ["pgr-dash-inv", ids.join(",")],
    queryFn: async () => {
      if (!ids.length) return [];
      const { data } = await (supabase.from as any)("pgr_inventario_itens")
        .select("id,pgr_id,empresa_id,classificacao").in("pgr_id", ids);
      return (data || []) as any[];
    },
    enabled: ids.length > 0,
  });

  const { data: acoes = [] } = useQuery({
    queryKey: ["pgr-dash-acoes", ids.join(",")],
    queryFn: async () => {
      if (!ids.length) return [];
      const { data } = await (supabase.from as any)("pgr_acoes")
        .select("id,pgr_id,empresa_id,status,prazo,classificacao,inventario_item_id").in("pgr_id", ids);
      return (data || []) as any[];
    },
    enabled: ids.length > 0,
  });

  const { data: pdfs = [] } = useQuery({
    queryKey: ["pgr-dash-pdfs", ids.join(",")],
    queryFn: async () => {
      if (!ids.length) return [];
      const { data } = await (supabase.from as any)("pgr_pdf_versoes")
        .select("pgr_id,pdf_versao,pdf_hash,gerado_em,com_marca_dagua").in("pgr_id", ids)
        .order("pdf_versao", { ascending: false });
      return (data || []) as any[];
    },
    enabled: ids.length > 0,
  });

  const { data: assinaturas = [] } = useQuery({
    queryKey: ["pgr-dash-assin", ids.join(",")],
    queryFn: async () => {
      if (!ids.length) return [];
      const { data } = await (supabase.from as any)("pgr_assinaturas")
        .select("pgr_id,pdf_versao,pdf_hash").in("pgr_id", ids);
      return (data || []) as any[];
    },
    enabled: ids.length > 0,
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["pgr-dash-uni", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome").or(`id.eq.${empresaId},empresa_pai_id.eq.${empresaId}`);
      return data || [];
    },
  });

  const unidadeMap = useMemo(() => {
    const m = new Map<string, string>();
    (unidades as any[]).forEach((u) => m.set(u.id, u.nome));
    return m;
  }, [unidades]);

  // Filtra PGRs
  const pgrsFiltrados = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return pgrs.filter((p) => {
      if (fStatus !== "todos" && p.status !== fStatus) return false;
      if (fUnidade !== "todas") {
        const ref = p.unidade_id || p.empresa_id;
        if (ref !== fUnidade) return false;
      }
      if (fVigencia === "vigente_hoje") {
        if (!p.data_vigencia_inicio || !p.data_vigencia_fim) return false;
        if (p.data_vigencia_inicio > hoje || p.data_vigencia_fim < hoje) return false;
      } else if (fVigencia === "vencido") {
        if (!p.data_vigencia_fim || p.data_vigencia_fim >= hoje) return false;
      }
      if (fInicio && (!p.data_vigencia_inicio || p.data_vigencia_inicio < fInicio)) return false;
      if (fFim && (!p.data_vigencia_fim || p.data_vigencia_fim > fFim)) return false;
      if (fResp.trim() && !(p.resp_tec_nome || "").toLowerCase().includes(fResp.toLowerCase())) return false;
      return true;
    });
  }, [pgrs, fStatus, fUnidade, fVigencia, fInicio, fFim, fResp]);

  const idsFiltrados = new Set(pgrsFiltrados.map((p) => p.id));
  const invFilt = inv.filter((i) => idsFiltrados.has(i.pgr_id) && (fClasse === "todas" || i.classificacao === fClasse));
  const acoesFilt = acoes.filter((a) => idsFiltrados.has(a.pgr_id) && (fAcaoStatus === "todos" || a.status === fAcaoStatus));

  // Última versão PDF por PGR
  const pdfPorPgr = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of pdfs) if (!m.has(p.pgr_id)) m.set(p.pgr_id, p);
    return m;
  }, [pdfs]);

  // Indicadores
  const hoje = new Date().toISOString().slice(0, 10);
  const total = pgrsFiltrados.length;
  const vigentes = pgrsFiltrados.filter((p) => p.status === "vigente").length;
  const emRevisao = pgrsFiltrados.filter((p) => p.status === "em_revisao").length;
  const vencidos = pgrsFiltrados.filter((p) => p.data_vigencia_fim && p.data_vigencia_fim < hoje && p.status === "vigente").length;
  const proxVenc = pgrsFiltrados.filter((p) => {
    if (!p.data_vigencia_fim) return false;
    const dias = (new Date(p.data_vigencia_fim).getTime() - Date.now()) / 86400000;
    return dias >= 0 && dias <= 60 && p.status === "vigente";
  });

  const riscoCount: Record<PgrClasse, number> = { baixo: 0, moderado: 0, alto: 0, critico: 0 };
  invFilt.forEach((i: any) => { if (riscoCount[i.classificacao as PgrClasse] != null) riscoCount[i.classificacao as PgrClasse]++; });

  const acoesAtivas = acoesFilt.filter((a) => a.status !== "cancelada");
  const acoesPend = acoesFilt.filter((a) => a.status === "pendente").length;
  const acoesAnd = acoesFilt.filter((a) => a.status === "em_andamento").length;
  const acoesAtrasadas = acoesFilt.filter((a) => isAtrasada(a)).length;
  const acoesConcluidas = acoesFilt.filter((a) => a.status === "concluida").length;
  const pctConclusao = acoesAtivas.length ? Math.round((acoesConcluidas / acoesAtivas.length) * 100) : 0;

  const pdfDesatualizados = pgrsFiltrados.filter((p) => {
    const last = pdfPorPgr.get(p.id);
    if (!last) return true;
    return new Date((p as any).conteudo_atualizado_em || 0).getTime() > new Date(last.gerado_em).getTime() + 500;
  }).length;

  const semAssinatura = pgrsFiltrados.filter((p) => {
    const last = pdfPorPgr.get(p.id);
    if (!last) return true;
    return !assinaturas.some((a) => a.pgr_id === p.id && a.pdf_versao === last.pdf_versao && a.pdf_hash === last.pdf_hash);
  }).length;

  const prontosPub = pgrsFiltrados.filter((p) => {
    if (p.status !== "rascunho" && p.status !== "em_revisao") return false;
    const last = pdfPorPgr.get(p.id);
    if (!last || last.com_marca_dagua) return false;
    if (new Date((p as any).conteudo_atualizado_em || 0).getTime() > new Date(last.gerado_em).getTime() + 500) return false;
    const itens = inv.filter((i) => i.pgr_id === p.id);
    if (!itens.length) return false;
    const ac = acoes.filter((a) => a.pgr_id === p.id);
    const hasAltoCrit = itens.some((i) => i.classificacao === "alto" || i.classificacao === "critico");
    if (hasAltoCrit && !ac.some((a) => a.status !== "cancelada")) return false;
    if ((p.responsavel_tecnico_id || (p.resp_tec_nome || "").trim()) &&
        !assinaturas.some((a) => a.pgr_id === p.id && a.pdf_versao === last.pdf_versao && a.pdf_hash === last.pdf_hash)) return false;
    return true;
  }).length;

  // Exports CSV
  function exportListaCsv() {
    downloadCsv(
      `pgr-lista-${hoje}.csv`,
      pgrsFiltrados.map((p) => ({
        Versao: `v${p.versao}`,
        Status: PGR_STATUS_LABEL[p.status as PgrStatus],
        Unidade: unidadeMap.get(p.unidade_id || p.empresa_id) || "",
        Emissao: p.data_emissao || "",
        Vigencia_inicio: p.data_vigencia_inicio || "",
        Vigencia_fim: p.data_vigencia_fim || "",
        Responsavel: p.resp_tec_nome || "",
        Registro: p.resp_tec_registro || "",
      })),
    );
  }
  function exportInvCsv() {
    const map = new Map(pgrs.map((p) => [p.id, p]));
    downloadCsv(
      `pgr-inventario-${hoje}.csv`,
      invFilt.map((i: any) => {
        const p = map.get(i.pgr_id);
        return {
          PGR: p ? `v${p.versao}` : "",
          Unidade: p ? unidadeMap.get(p.unidade_id || p.empresa_id) || "" : "",
          Classificacao: i.classificacao || "",
        };
      }),
    );
  }
  function exportAcoesCsv() {
    const map = new Map(pgrs.map((p) => [p.id, p]));
    downloadCsv(
      `pgr-acoes-${hoje}.csv`,
      acoesFilt.map((a: any) => {
        const p = map.get(a.pgr_id);
        return {
          PGR: p ? `v${p.versao}` : "",
          Unidade: p ? unidadeMap.get(p.unidade_id || p.empresa_id) || "" : "",
          Status: a.status,
          Classificacao: a.classificacao || "",
          Prazo: a.prazo || "",
          Atrasada: isAtrasada(a) ? "Sim" : "Não",
        };
      }),
    );
  }

  if (!perms.canView) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground">
        Você não tem permissão para acessar o Dashboard do PGR.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/pgr")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Dashboard PGR
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportListaCsv}>
            <Download className="h-4 w-4 mr-1" /> CSV Lista
          </Button>
          <Button size="sm" variant="outline" onClick={exportInvCsv}>
            <Download className="h-4 w-4 mr-1" /> CSV Inventário
          </Button>
          <Button size="sm" variant="outline" onClick={exportAcoesCsv}>
            <Download className="h-4 w-4 mr-1" /> CSV Ações
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Status PGR</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(PGR_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Unidade</Label>
            <Select value={fUnidade} onValueChange={setFUnidade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {(unidades as any[]).map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Vigência</Label>
            <Select value={fVigencia} onValueChange={setFVigencia}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="vigente_hoje">Vigente hoje</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Responsável técnico</Label>
            <Input value={fResp} onChange={(e) => setFResp(e.target.value)} placeholder="Nome contém..." />
          </div>
          <div>
            <Label className="text-xs">Vigência início ≥</Label>
            <Input type="date" value={fInicio} onChange={(e) => setFInicio(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Vigência fim ≤</Label>
            <Input type="date" value={fFim} onChange={(e) => setFFim(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Classificação de risco</Label>
            <Select value={fClasse} onValueChange={setFClasse}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="moderado">Moderado</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="critico">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status da ação</Label>
            <Select value={fAcaoStatus} onValueChange={setFAcaoStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="atrasada">Atrasada</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPIs PGR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi icon={FileText} label="Total de PGRs" value={total} tone="info" />
        <Kpi icon={ShieldCheck} label="Vigentes" value={vigentes} tone="ok" />
        <Kpi icon={Activity} label="Em revisão" value={emRevisao} tone="warn" />
        <Kpi icon={AlertTriangle} label="Vigentes vencidos" value={vencidos} tone={vencidos > 0 ? "fail" : "ok"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(["baixo","moderado","alto","critico"] as PgrClasse[]).map((c) => (
          <Card key={c} className="border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Riscos {CLASSE_LABEL[c]}</span>
                <Badge variant="outline" className={CLASSE_TEXT[c]}>{CLASSE_LABEL[c]}</Badge>
              </div>
              <div className="text-2xl font-bold mt-1">{riscoCount[c]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Kpi icon={ListChecks} label="Total ações" value={acoesFilt.length} tone="info" />
        <Kpi icon={Activity} label="Pendentes" value={acoesPend} tone="warn" />
        <Kpi icon={Activity} label="Em andamento" value={acoesAnd} tone="info" />
        <Kpi icon={AlertTriangle} label="Atrasadas" value={acoesAtrasadas} tone={acoesAtrasadas > 0 ? "fail" : "ok"} />
        <Kpi icon={ListChecks} label="Concluídas" value={acoesConcluidas} tone="ok" detail={`${pctConclusao}% conclusão`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi icon={FileText} label="PDF desatualizado" value={pdfDesatualizados} tone={pdfDesatualizados > 0 ? "warn" : "ok"} />
        <Kpi icon={PenLine} label="Sem assinatura visual" value={semAssinatura} tone={semAssinatura > 0 ? "warn" : "ok"} />
        <Kpi icon={Send} label="Prontos para publicação" value={prontosPub} tone={prontosPub > 0 ? "ok" : "info"} />
        <Kpi icon={AlertTriangle} label="Próximos a vencer (60d)" value={proxVenc.length} tone={proxVenc.length > 0 ? "warn" : "ok"} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Próximos vencimentos (60 dias)</CardTitle></CardHeader>
        <CardContent>
          {proxVenc.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum PGR vigente vencendo nos próximos 60 dias.</p>
          ) : (
            <ul className="space-y-2">
              {proxVenc.map((p) => (
                <li key={p.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                  <div>
                    <div className="font-medium">{unidadeMap.get(p.unidade_id || p.empresa_id) || "—"} · v{p.versao}</div>
                    <div className="text-xs text-muted-foreground">
                      Vence em {new Date((p.data_vigencia_fim || "") + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={PGR_STATUS_COLOR[p.status as PgrStatus]} variant="outline">
                      {PGR_STATUS_LABEL[p.status as PgrStatus]}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/pgr/${p.id}`)}>Abrir</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="text-[11px] text-muted-foreground">
        Documento técnico interno. Esta fase <b>não</b> implementa ICP-Brasil ou integração com órgãos externos.
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone, detail }: {
  icon: any; label: string; value: any; tone: "ok"|"warn"|"fail"|"info"; detail?: string;
}) {
  const bg =
    tone === "ok" ? "bg-emerald-50 border-emerald-200" :
    tone === "warn" ? "bg-amber-50 border-amber-200" :
    tone === "fail" ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200";
  const tx =
    tone === "ok" ? "text-emerald-800" :
    tone === "warn" ? "text-amber-800" :
    tone === "fail" ? "text-red-800" : "text-slate-700";
  return (
    <Card className={`border ${bg}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <Icon className={`h-4 w-4 ${tx}`} />
        </div>
        <div className={`text-2xl font-bold mt-1 ${tx}`}>{value}</div>
        {detail && <div className="text-[11px] text-muted-foreground mt-0.5">{detail}</div>}
      </CardContent>
    </Card>
  );
}

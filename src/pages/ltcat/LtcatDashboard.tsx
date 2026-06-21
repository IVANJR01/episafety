import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, BarChart3 } from "lucide-react";
import {
  LTCAT_STATUS_LABEL, LTCAT_CONCLUSAO_LABEL,
  LtcatDocumento, LtcatStatus, LtcatConclusaoAposentadoria,
} from "@/lib/ltcatTypes";
import { downloadCsv, rowsToCsv } from "@/lib/ltcatExports";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDays(d: string, n: number) {
  const dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

export default function LtcatDashboard() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const perms = usePermissions("ltcat");

  const [unidadeFiltro, setUnidadeFiltro] = useState("todas");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [vigenciaFiltro, setVigenciaFiltro] = useState("todas");
  const [rtFiltro, setRtFiltro] = useState("todos");
  const [agenteFiltro, setAgenteFiltro] = useState("todos");
  const [enqFiltro, setEnqFiltro] = useState("todos");
  const [gheFiltro, setGheFiltro] = useState("todos");
  const [funcaoFiltro, setFuncaoFiltro] = useState("todas");

  const scopeFilter = (q: any) => {
    if (empresaScopeIds.length && !isSuperAdmin) return q.in("empresa_id", empresaScopeIds);
    if (empresaId) return q.eq("empresa_id", empresaId);
    return q;
  };

  const { data: docs = [] } = useQuery({
    queryKey: ["ltcat-dash-docs", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ltcat_documentos").select("*"));
      return (data || []) as LtcatDocumento[];
    },
    enabled: perms.canView,
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["ltcat-dash-unidades", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome").or(`id.eq.${empresaId},empresa_pai_id.eq.${empresaId}`);
      return data || [];
    },
  });

  const { data: rts = [] } = useQuery({
    queryKey: ["ltcat-dash-rts", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ltcat_responsaveis_tecnicos")
        .select("id, ltcat_id, nome, registro_profissional"));
      return data || [];
    },
  });

  const { data: ghes = [] } = useQuery({
    queryKey: ["ltcat-dash-ghes", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ltcat_grupos_homogeneos")
        .select("id, ltcat_id, codigo, descricao"));
      return data || [];
    },
  });

  const { data: funcs = [] } = useQuery({
    queryKey: ["ltcat-dash-funcs", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ltcat_funcoes")
        .select("id, ltcat_id, nome, grupo_homogeneo_id"));
      return data || [];
    },
  });

  const { data: agentes = [] } = useQuery({
    queryKey: ["ltcat-dash-agentes", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ltcat_agentes")
        .select("id, ltcat_id, grupo_homogeneo_id, nome, tipo"));
      return data || [];
    },
  });

  const { data: avals = [] } = useQuery({
    queryKey: ["ltcat-dash-avals", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ltcat_avaliacoes")
        .select("id, ltcat_id, agente_id, grupo_homogeneo_id, intensidade, limite_tolerancia, data_medicao, enquadramento, tecnica"));
      return data || [];
    },
  });

  const { data: concls = [] } = useQuery({
    queryKey: ["ltcat-dash-concls", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ltcat_conclusoes")
        .select("id, ltcat_id, conclusao, enquadramento, funcao_id, grupo_homogeneo_id, fundamento_legal"));
      return data || [];
    },
  });

  const { data: pdfs = [] } = useQuery({
    queryKey: ["ltcat-dash-pdfs", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ltcat_pdf_versoes")
        .select("id, ltcat_id, tipo, gerado_em"));
      return data || [];
    },
  });

  const { data: assins = [] } = useQuery({
    queryKey: ["ltcat-dash-assins", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      const { data } = await scopeFilter((supabase.from as any)("ltcat_assinaturas")
        .select("id, ltcat_id"));
      return data || [];
    },
  });

  // Build lookups
  const unidadeMap = useMemo(() => new Map<string, string>((unidades as any[]).map((u) => [u.id, u.nome])), [unidades]);
  const docMap = useMemo(() => new Map<string, LtcatDocumento>(docs.map((d) => [d.id, d])), [docs]);
  const gheMap = useMemo(() => new Map<string, any>((ghes as any[]).map((g) => [g.id, g])), [ghes]);
  const funcMap = useMemo(() => new Map<string, any>((funcs as any[]).map((f) => [f.id, f])), [funcs]);
  const agenteMap = useMemo(() => new Map<string, any>((agentes as any[]).map((a) => [a.id, a])), [agentes]);
  const rtPorLtcat = useMemo(() => {
    const m = new Map<string, any[]>();
    (rts as any[]).forEach((r) => { const arr = m.get(r.ltcat_id) || []; arr.push(r); m.set(r.ltcat_id, arr); });
    return m;
  }, [rts]);
  const ultimoPdf = useMemo(() => {
    const m = new Map<string, any>();
    (pdfs as any[]).forEach((p) => {
      const cur = m.get(p.ltcat_id);
      if (!cur || new Date(p.gerado_em) > new Date(cur.gerado_em)) m.set(p.ltcat_id, p);
    });
    return m;
  }, [pdfs]);
  const assinPorLtcat = useMemo(() => {
    const m = new Map<string, number>();
    (assins as any[]).forEach((a) => m.set(a.ltcat_id, (m.get(a.ltcat_id) || 0) + 1));
    return m;
  }, [assins]);

  // Apply filters → set of allowed ltcat ids
  const filteredLtcatIds = useMemo(() => {
    const today = todayISO();
    const set = new Set<string>();
    for (const d of docs) {
      if (unidadeFiltro !== "todas") {
        const ref = d.unidade_id || d.empresa_id;
        if (ref !== unidadeFiltro) continue;
      }
      if (statusFiltro !== "todos" && d.status !== statusFiltro) continue;
      if (vigenciaFiltro === "vigente_hoje") {
        if (!d.data_vigencia_inicio || !d.data_vigencia_fim) continue;
        if (d.data_vigencia_inicio > today || d.data_vigencia_fim < today) continue;
      } else if (vigenciaFiltro === "vencido") {
        if (!d.data_vigencia_fim || d.data_vigencia_fim >= today) continue;
      } else if (vigenciaFiltro === "venc_30") {
        if (!d.data_vigencia_fim) continue;
        if (d.data_vigencia_fim < today || d.data_vigencia_fim > addDays(today, 30)) continue;
      }
      if (rtFiltro !== "todos") {
        const list = rtPorLtcat.get(d.id) || [];
        if (!list.some((r) => r.id === rtFiltro)) continue;
      }
      if (agenteFiltro !== "todos") {
        if (!(agentes as any[]).some((a) => a.ltcat_id === d.id && a.nome === agenteFiltro)) continue;
      }
      if (enqFiltro !== "todos") {
        if (!(concls as any[]).some((c) => c.ltcat_id === d.id && c.conclusao === enqFiltro)) continue;
      }
      if (gheFiltro !== "todos") {
        if (!(ghes as any[]).some((g) => g.ltcat_id === d.id && g.id === gheFiltro)) continue;
      }
      if (funcaoFiltro !== "todas") {
        if (!(funcs as any[]).some((f) => f.ltcat_id === d.id && f.id === funcaoFiltro)) continue;
      }
      set.add(d.id);
    }
    return set;
  }, [docs, unidadeFiltro, statusFiltro, vigenciaFiltro, rtFiltro, agenteFiltro, enqFiltro, gheFiltro, funcaoFiltro,
      rtPorLtcat, agentes, concls, ghes, funcs]);

  const filteredDocs = useMemo(() => docs.filter((d) => filteredLtcatIds.has(d.id)), [docs, filteredLtcatIds]);
  const filteredAgentes = useMemo(() => (agentes as any[]).filter((a) => filteredLtcatIds.has(a.ltcat_id)), [agentes, filteredLtcatIds]);
  const filteredAvals = useMemo(() => (avals as any[]).filter((a) => filteredLtcatIds.has(a.ltcat_id)), [avals, filteredLtcatIds]);
  const filteredConcls = useMemo(() => (concls as any[]).filter((c) => filteredLtcatIds.has(c.ltcat_id)), [concls, filteredLtcatIds]);
  const filteredGhes = useMemo(() => (ghes as any[]).filter((g) => filteredLtcatIds.has(g.ltcat_id)), [ghes, filteredLtcatIds]);
  const filteredFuncs = useMemo(() => (funcs as any[]).filter((f) => filteredLtcatIds.has(f.ltcat_id)), [funcs, filteredLtcatIds]);

  // Indicators
  const today = todayISO();
  const total = filteredDocs.length;
  const vigentes = filteredDocs.filter((d) => d.status === "vigente").length;
  const emRevisao = filteredDocs.filter((d) => d.status === "em_revisao").length;
  const vencidos = filteredDocs.filter((d) => d.data_vigencia_fim && d.data_vigencia_fim < today).length;
  const substArq = filteredDocs.filter((d) => d.status === "substituido" || d.status === "arquivado").length;
  const semPdf = filteredDocs.filter((d) => !ultimoPdf.get(d.id)).length;
  const pdfDesatualizado = filteredDocs.filter((d) => {
    const p = ultimoPdf.get(d.id);
    if (!p || !d.conteudo_atualizado_em) return false;
    return new Date(p.gerado_em).getTime() < new Date(d.conteudo_atualizado_em).getTime();
  }).length;
  const semAssin = filteredDocs.filter((d) => !assinPorLtcat.get(d.id)).length;

  // Pronto para publicação heuristic (mirror of checklist hard rules)
  const prontoPub = filteredDocs.filter((d) => {
    if (d.status !== "rascunho" && d.status !== "em_revisao") return false;
    if (!(rtPorLtcat.get(d.id)?.length)) return false;
    if (!(ghes as any[]).some((g) => g.ltcat_id === d.id)) return false;
    if (!(agentes as any[]).some((a) => a.ltcat_id === d.id)) return false;
    if (!(avals as any[]).some((a) => a.ltcat_id === d.id)) return false;
    const cs = (concls as any[]).filter((c) => c.ltcat_id === d.id);
    if (!cs.length) return false;
    const p = ultimoPdf.get(d.id);
    if (!p || p.tipo !== "final") return false;
    if (d.conteudo_atualizado_em && new Date(p.gerado_em).getTime() < new Date(d.conteudo_atualizado_em).getTime()) return false;
    if (!assinPorLtcat.get(d.id)) return false;
    return true;
  }).length;

  const agenteFreq = useMemo(() => {
    const m = new Map<string, number>();
    filteredAgentes.forEach((a) => m.set(a.nome, (m.get(a.nome) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filteredAgentes]);

  const acimaLimite = filteredAvals.filter((a) =>
    a.intensidade != null && a.limite_tolerancia != null && Number(a.intensidade) > Number(a.limite_tolerancia)
  ).length;

  const concPorTipo = useMemo(() => {
    const m: Record<string, number> = { especial_15: 0, especial_20: 0, especial_25: 0, nao_especial: 0, inconclusivo: 0 };
    filteredConcls.forEach((c) => { m[c.conclusao] = (m[c.conclusao] || 0) + 1; });
    return m;
  }, [filteredConcls]);

  const gheTop = useMemo(() => {
    const counts = new Map<string, number>();
    filteredAgentes.forEach((a) => counts.set(a.grupo_homogeneo_id, (counts.get(a.grupo_homogeneo_id) || 0) + 1));
    return [...counts.entries()]
      .map(([gid, n]) => ({ ghe: gheMap.get(gid), n }))
      .filter((x) => x.ghe)
      .sort((a, b) => b.n - a.n).slice(0, 8);
  }, [filteredAgentes, gheMap]);

  const funcoesEspeciais = useMemo(() => {
    const set = new Set<string>();
    filteredConcls.forEach((c) => {
      if (String(c.conclusao || "").startsWith("especial_") && c.funcao_id) set.add(c.funcao_id);
    });
    return [...set].map((fid) => funcMap.get(fid)).filter(Boolean);
  }, [filteredConcls, funcMap]);

  const proxVenc = useMemo(() => {
    const lim = addDays(today, 90);
    return filteredDocs
      .filter((d) => d.data_vigencia_fim && d.data_vigencia_fim >= today && d.data_vigencia_fim <= lim)
      .sort((a, b) => (a.data_vigencia_fim! < b.data_vigencia_fim! ? -1 : 1))
      .slice(0, 10);
  }, [filteredDocs, today]);

  const exportLtcats = () => {
    const rows = filteredDocs.map((d) => ({
      versao: d.versao,
      status: LTCAT_STATUS_LABEL[d.status as LtcatStatus] || d.status,
      unidade: unidadeMap.get(d.unidade_id || d.empresa_id) || "",
      data_emissao: d.data_emissao || "",
      vigencia_inicio: d.data_vigencia_inicio || "",
      vigencia_fim: d.data_vigencia_fim || "",
      cnae: d.cnae || "",
      grau_risco: d.grau_risco ?? "",
      pdf_atualizado: (() => {
        const p = ultimoPdf.get(d.id);
        if (!p) return "sem_pdf";
        if (d.conteudo_atualizado_em && new Date(p.gerado_em).getTime() < new Date(d.conteudo_atualizado_em).getTime()) return "desatualizado";
        return p.tipo;
      })(),
      assinaturas: assinPorLtcat.get(d.id) || 0,
    }));
    downloadCsv("ltcat_lista", rowsToCsv(rows));
  };

  const exportAgentesAvals = () => {
    const rows = filteredAvals.map((a) => {
      const ag = agenteMap.get(a.agente_id);
      const ghe = gheMap.get(a.grupo_homogeneo_id);
      const doc = docMap.get(a.ltcat_id);
      return {
        ltcat_versao: doc?.versao ?? "",
        unidade: doc ? (unidadeMap.get(doc.unidade_id || doc.empresa_id) || "") : "",
        ghe_codigo: ghe?.codigo ?? "",
        ghe_descricao: ghe?.descricao ?? "",
        agente_nome: ag?.nome ?? "",
        agente_tipo: ag?.tipo ?? "",
        tecnica: a.tecnica,
        enquadramento: a.enquadramento,
        intensidade: a.intensidade ?? "",
        limite_tolerancia: a.limite_tolerancia ?? "",
        acima_limite: a.intensidade != null && a.limite_tolerancia != null && Number(a.intensidade) > Number(a.limite_tolerancia) ? "sim" : "nao",
        data_medicao: a.data_medicao || "",
      };
    });
    downloadCsv("ltcat_agentes_avaliacoes", rowsToCsv(rows));
  };

  const exportConclusoes = () => {
    const rows = filteredConcls.map((c) => {
      const doc = docMap.get(c.ltcat_id);
      const ghe = c.grupo_homogeneo_id ? gheMap.get(c.grupo_homogeneo_id) : null;
      const fnc = c.funcao_id ? funcMap.get(c.funcao_id) : null;
      return {
        ltcat_versao: doc?.versao ?? "",
        unidade: doc ? (unidadeMap.get(doc.unidade_id || doc.empresa_id) || "") : "",
        ghe: ghe?.codigo ?? "",
        funcao: fnc?.nome ?? "",
        conclusao: LTCAT_CONCLUSAO_LABEL[c.conclusao as LtcatConclusaoAposentadoria] || c.conclusao,
        enquadramento: c.enquadramento ?? "",
        fundamento_legal: c.fundamento_legal ?? "",
      };
    });
    downloadCsv("ltcat_conclusoes", rowsToCsv(rows));
  };

  if (!perms.canView) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Sem permissão.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ltcat")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Dashboard LTCAT
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportLtcats}><Download className="h-4 w-4 mr-1" />LTCATs CSV</Button>
          <Button variant="outline" size="sm" onClick={exportAgentesAvals}><Download className="h-4 w-4 mr-1" />Agentes/Avals CSV</Button>
          <Button variant="outline" size="sm" onClick={exportConclusoes}><Download className="h-4 w-4 mr-1" />Conclusões CSV</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label className="text-xs">Unidade</Label>
            <Select value={unidadeFiltro} onValueChange={setUnidadeFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {(unidades as any[]).map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Status</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(LTCAT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Vigência</Label>
            <Select value={vigenciaFiltro} onValueChange={setVigenciaFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="vigente_hoje">Vigente hoje</SelectItem>
                <SelectItem value="venc_30">Vence em 30 dias</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Responsável técnico</Label>
            <Select value={rtFiltro} onValueChange={setRtFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="todos">Todos</SelectItem>
                {(rts as any[]).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Agente nocivo</Label>
            <Select value={agenteFiltro} onValueChange={setAgenteFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="todos">Todos</SelectItem>
                {[...new Set((agentes as any[]).map((a) => a.nome))].sort().map((n) =>
                  <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Enquadramento</Label>
            <Select value={enqFiltro} onValueChange={setEnqFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(LTCAT_CONCLUSAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">GHE/GES</Label>
            <Select value={gheFiltro} onValueChange={setGheFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="todos">Todos</SelectItem>
                {(ghes as any[]).map((g) => <SelectItem key={g.id} value={g.id}>{g.codigo} — {g.descricao}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Função</Label>
            <Select value={funcaoFiltro} onValueChange={setFuncaoFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="todas">Todas</SelectItem>
                {(funcs as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          ["Total", total, "text-foreground"],
          ["Vigentes", vigentes, "text-emerald-700"],
          ["Em revisão", emRevisao, "text-amber-700"],
          ["Vencidos", vencidos, "text-rose-700"],
          ["Substituídos/Arquivados", substArq, "text-zinc-600"],
          ["Sem PDF", semPdf, "text-rose-700"],
          ["PDF desatualizado", pdfDesatualizado, "text-amber-700"],
          ["Sem assinatura visual", semAssin, "text-rose-700"],
          ["Prontos p/ publicar", prontoPub, "text-emerald-700"],
          ["Avaliações acima do LT", acimaLimite, "text-rose-700"],
        ].map(([label, value, cls]) => (
          <Card key={label as string}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={`text-2xl font-semibold ${cls}`}>{value as number}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conclusões previdenciárias</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {Object.entries(concPorTipo).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{LTCAT_CONCLUSAO_LABEL[k as LtcatConclusaoAposentadoria] || k}</span>
                <Badge variant="outline">{v}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Agentes nocivos mais frequentes</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {agenteFreq.length === 0 ? <div className="text-muted-foreground">Sem dados.</div> :
              agenteFreq.map(([n, c]) => (
                <div key={n} className="flex justify-between">
                  <span className="truncate">{n}</span>
                  <Badge variant="outline">{c}</Badge>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">GHE/GES com mais agentes</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {gheTop.length === 0 ? <div className="text-muted-foreground">Sem dados.</div> :
              gheTop.map(({ ghe, n }) => (
                <div key={ghe.id} className="flex justify-between">
                  <span className="truncate">{ghe.codigo} — {ghe.descricao}</span>
                  <Badge variant="outline">{n}</Badge>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Funções com enquadramento especial</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {funcoesEspeciais.length === 0 ? <div className="text-muted-foreground">Nenhuma.</div> :
              funcoesEspeciais.map((f: any) => (
                <div key={f.id} className="flex justify-between">
                  <span>{f.nome}</span>
                  <Badge className="bg-rose-100 text-rose-800 border-rose-300" variant="outline">Especial</Badge>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Próximos vencimentos (90 dias)</CardTitle></CardHeader>
          <CardContent>
            {proxVenc.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum LTCAT vence nos próximos 90 dias.</div>
            ) : (
              <ul className="text-sm divide-y">
                {proxVenc.map((d) => (
                  <li key={d.id} className="py-2 flex items-center justify-between">
                    <button className="underline" onClick={() => navigate(`/ltcat/${d.id}`)}>
                      v{d.versao} · {unidadeMap.get(d.unidade_id || d.empresa_id) || "—"}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      vence em {new Date(d.data_vigencia_fim! + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
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

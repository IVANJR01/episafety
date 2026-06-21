// ============================================================================
// eSocial S-2240 — Dashboard & Checklist de Prontidão (Parte 5)
// ----------------------------------------------------------------------------
// Rota: /esocial/s2240/dashboard
// Apenas leitura + ações já aprovadas (validar/regerar XML). NÃO transmite,
// NÃO assina, NÃO gera recibo/protocolo. XML completo permanece somente no
// Drive BYOK privado — nada do XML cru é exibido nem exportado aqui.
// ============================================================================
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertTriangle, CheckCircle2, FileCode2, ExternalLink, Download,
  ShieldAlert, ListChecks, FileText, RefreshCcw, Loader2, Filter, X,
} from "lucide-react";
import { toast } from "sonner";
import MfaActionButton from "@/components/cat/MfaActionButton";
import { downloadCsv } from "@/lib/csvExport";
import {
  ESOCIAL_S2240_AVISO, ESOCIAL_S2240_VERSAO_LAYOUT,
  validarXmlS2240Tecnico, gerarXmlS2240,
} from "@/lib/esocialS2240Xml";

// ----------------------------------------------------------------------------
const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pronto_envio: "Pronto p/ envio (stub)",
  validado_stub: "Validado (stub)",
  homologacao_stub: "Homologação (stub)",
  simulado: "Simulado",
  rejeitado_local: "Rejeitado localmente",
  retificar: "Retificar",
  excluido_local: "Excluído local",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pendente: "outline", pronto_envio: "secondary", validado_stub: "default",
  homologacao_stub: "default", simulado: "secondary",
  rejeitado_local: "destructive", retificar: "outline", excluido_local: "destructive",
};

const norm = (s: string) => (s || "").trim().toLowerCase();
const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const fmtDt = (v: any) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
const daysSince = (v: any) => v ? Math.floor((Date.now() - new Date(v).getTime()) / 86400000) : null;

function hasPerm(modulos: string[], isSuper: boolean, isPrinc: boolean, key: string) {
  if (isSuper || isPrinc) return true;
  return modulos.includes(key) || modulos.includes("esocial");
}

// ============================================================================
type EventoRow = any;
interface Checks {
  ppp: boolean; func: boolean; cpf: boolean; matricula: boolean; cbo: boolean;
  periodo: boolean; exposicao: boolean; agente: boolean; t24: boolean;
  semPendT24: boolean; semDivT24: boolean; tecnica: boolean;
  intensidade: boolean; unidade: boolean; epiOk: boolean; respTec: boolean;
  xmlGerado: boolean; hash: boolean; semErroUltVal: boolean; driveOk: boolean;
}
const CHECK_LABELS: Array<[keyof Checks, string]> = [
  ["ppp", "PPP vinculado"],
  ["func", "Funcionário vinculado"],
  ["cpf", "CPF válido"],
  ["matricula", "Matrícula informada"],
  ["cbo", "CBO informado"],
  ["periodo", "Período laboral vinculado"],
  ["exposicao", "Exposição vinculada"],
  ["agente", "Agente nocivo informado"],
  ["t24", "Código Tabela 24 mapeado"],
  ["semPendT24", "Sem mapeamento pendente"],
  ["semDivT24", "Sem mapeamento divergente"],
  ["tecnica", "Técnica de avaliação"],
  ["intensidade", "Intensidade/concentração quando aplicável"],
  ["unidade", "Unidade de medida"],
  ["epiOk", "EPI/EPC coerente"],
  ["respTec", "Responsável técnico ambiental"],
  ["xmlGerado", "XML gerado"],
  ["hash", "Hash SHA-256 presente"],
  ["semErroUltVal", "Última validação sem erro bloqueante"],
  ["driveOk", "XML no Drive BYOK"],
];

function buildChecks(ev: EventoRow, ctx: {
  ppp: any; periodo: any; exps: any[]; maps: Map<string, any>; resp: any | null; ultVal: any | null;
}): Checks {
  const exps = ctx.exps || [];
  const semPend = exps.length > 0 && exps.every((e) => {
    const m = ctx.maps.get(norm(e.agente_nome));
    return !!(m?.codigo_t24 || e.codigo_esocial);
  });
  const semDiv = exps.every((e) => ctx.maps.get(norm(e.agente_nome))?.status !== "divergente");
  const tec = exps.length > 0 && exps.every((e) => !!e.tecnica);
  const inten = exps.length > 0 && exps.every((e) => {
    const m = ctx.maps.get(norm(e.agente_nome));
    const quantitativo = !!m?.unidade_medida_padrao || m?.tipo_avaliacao_esperado === "quantitativa";
    return !quantitativo || (e.intensidade !== null && e.intensidade !== undefined);
  });
  const un = exps.length > 0 && exps.every((e) => !!e.unidade_medida || !ctx.maps.get(norm(e.agente_nome))?.unidade_medida_padrao);
  const epi = exps.every((e) => !e.epi_descricao || e.epi_eficacia !== null);
  return {
    ppp: !!ctx.ppp,
    func: !!ev.funcionario_id,
    cpf: !!ev.cpf_trabalhador && /^\d{11}$/.test(ev.cpf_trabalhador || ""),
    matricula: !!ev.matricula,
    cbo: !!ev.cbo,
    periodo: !!ctx.periodo,
    exposicao: exps.length > 0,
    agente: exps.length > 0 && exps.every((e) => !!e.agente_nome),
    t24: exps.length > 0 && exps.every((e) => !!(ctx.maps.get(norm(e.agente_nome))?.codigo_t24 || e.codigo_esocial)),
    semPendT24: semPend,
    semDivT24: semDiv,
    tecnica: tec,
    intensidade: inten,
    unidade: un,
    epiOk: epi,
    respTec: !!ctx.resp,
    xmlGerado: !!ev.xml_drive_id,
    hash: !!ev.xml_sha256,
    semErroUltVal: !ctx.ultVal || ctx.ultVal.resultado !== "erro",
    driveOk: !!ev.xml_drive_id && !!ev.xml_drive_link,
  };
}
const checksPct = (c: Checks) => {
  const total = Object.keys(c).length;
  const ok = Object.values(c).filter(Boolean).length;
  return Math.round((ok / total) * 100);
};

// ============================================================================
function KpiCard({ label, value, tone = "default", icon }: { label: string; value: any; tone?: "default" | "warn" | "err" | "ok"; icon?: React.ReactNode }) {
  const cls =
    tone === "err" ? "border-destructive/40 bg-destructive/5"
    : tone === "warn" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
    : tone === "ok" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
    : "";
  return (
    <Card className={cls}>
      <CardContent className="p-3">
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
        <div className="text-xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
export default function S2240Dashboard() {
  const qc = useQueryClient();
  const { modulosPermitidos, isSuperAdmin, isPrincipal } = useAuth();
  const canView = hasPerm(modulosPermitidos, isSuperAdmin, isPrincipal, "esocial:s2240:visualizar");
  const canValidar = hasPerm(modulosPermitidos, isSuperAdmin, isPrincipal, "esocial:s2240:validar");
  const canPreparar = hasPerm(modulosPermitidos, isSuperAdmin, isPrincipal, "esocial:s2240:preparar");

  const [busy, setBusy] = useState<string | null>(null);
  const [openChecklist, setOpenChecklist] = useState<string | null>(null);

  // Filtros
  const [fEmpresa, setFEmpresa] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fFunc, setFFunc] = useState<string>("");
  const [fAgente, setFAgente] = useState<string>("");
  const [fT24, setFT24] = useState<string>("");
  const [fPPP, setFPPP] = useState<string>("");
  const [fLtcat, setFLtcat] = useState<string>("");
  const [fLayout, setFLayout] = useState<string>("all");
  const [fOcor, setFOcor] = useState<"any" | "erro" | "alerta" | "nenhuma">("any");
  const [fExpDe, setFExpDe] = useState<string>("");
  const [fExpAte, setFExpAte] = useState<string>("");
  const [fGerDe, setFGerDe] = useState<string>("");
  const [fGerAte, setFGerAte] = useState<string>("");
  const [fValDe, setFValDe] = useState<string>("");
  const [fValAte, setFValAte] = useState<string>("");

  // ---------- Queries (RLS-bound) ----------
  const { data: eventos = [], isLoading: loadingEv, refetch } = useQuery({
    queryKey: ["s2240-dash-eventos"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("esocial_eventos_s2240")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as EventoRow[];
    },
    enabled: canView,
  });

  const empresaIds = useMemo(() => Array.from(new Set(eventos.map((e) => e.empresa_id))).filter(Boolean), [eventos]);
  const pppIds = useMemo(() => Array.from(new Set(eventos.map((e) => e.ppp_documento_id))).filter(Boolean), [eventos]);
  const perIds = useMemo(() => Array.from(new Set(eventos.map((e) => e.ppp_periodo_id))).filter(Boolean), [eventos]);
  const funcIds = useMemo(() => Array.from(new Set(eventos.map((e) => e.funcionario_id))).filter(Boolean), [eventos]);

  const { data: empresas = [] } = useQuery({
    queryKey: ["s2240-dash-empresas", empresaIds],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome, cnpj").in("id", empresaIds);
      return data || [];
    },
  });

  const { data: ppps = [] } = useQuery({
    queryKey: ["s2240-dash-ppps", pppIds],
    enabled: pppIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_documentos")
        .select("id, empresa_id, funcionario_id, status").in("id", pppIds);
      return data || [];
    },
  });

  const { data: funcs = [] } = useQuery({
    queryKey: ["s2240-dash-funcs", funcIds],
    enabled: funcIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("funcionarios")
        .select("id, nome, cpf, matricula").in("id", funcIds);
      return data || [];
    },
  });

  const { data: periodos = [] } = useQuery({
    queryKey: ["s2240-dash-periodos", perIds],
    enabled: perIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_periodos")
        .select("id, ppp_id, data_inicio, data_fim, funcao_nome, cbo, setor_nome, ltcat_id")
        .in("id", perIds);
      return data || [];
    },
  });

  const { data: exposicoes = [] } = useQuery({
    queryKey: ["s2240-dash-exps", perIds],
    enabled: perIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_exposicoes")
        .select("id, periodo_id, agente_nome, codigo_esocial, intensidade, unidade_medida, tecnica, epi_descricao, epi_eficacia, epc_descricao")
        .in("periodo_id", perIds);
      return data || [];
    },
  });

  const { data: mapeamentos = [] } = useQuery({
    queryKey: ["s2240-dash-maps", empresaIds],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("esocial_s2240_mapeamentos")
        .select("empresa_id, agente_nome, codigo_t24, status, unidade_medida_padrao, tipo_avaliacao_esperado")
        .in("empresa_id", empresaIds);
      return data || [];
    },
  });

  const { data: respAmb = [] } = useQuery({
    queryKey: ["s2240-dash-respamb", pppIds],
    enabled: pppIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_responsaveis_ambientais")
        .select("ppp_id, periodo_id, nome, registro_profissional").in("ppp_id", pppIds);
      return data || [];
    },
  });

  const evIds = useMemo(() => eventos.map((e) => e.id), [eventos]);
  const { data: ocorrencias = [] } = useQuery({
    queryKey: ["s2240-dash-ocor", evIds],
    enabled: evIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("esocial_s2240_ocorrencias")
        .select("id, evento_id, tipo, resultado, erro_resumido, mensagens, xml_sha256, created_at")
        .in("evento_id", evIds).order("created_at", { ascending: false });
      return data || [];
    },
  });

  // ---------- Indices ----------
  const empById = new Map<string, any>(empresas.map((e: any) => [e.id, e]));
  const pppById = new Map<string, any>(ppps.map((p: any) => [p.id, p]));
  const funcById = new Map<string, any>(funcs.map((f: any) => [f.id, f]));
  const perById = new Map<string, any>(periodos.map((p: any) => [p.id, p]));
  const expsByPer = new Map<string, any[]>();
  for (const e of exposicoes as any[]) {
    (expsByPer.get(e.periodo_id) || expsByPer.set(e.periodo_id, []).get(e.periodo_id))!.push(e);
  }
  const mapsByEmp = new Map<string, Map<string, any>>();
  for (const m of mapeamentos as any[]) {
    if (!mapsByEmp.has(m.empresa_id)) mapsByEmp.set(m.empresa_id, new Map());
    mapsByEmp.get(m.empresa_id)!.set(norm(m.agente_nome), m);
  }
  const respByPpp = new Map<string, any>();
  for (const r of respAmb as any[]) if (!respByPpp.has(r.ppp_id)) respByPpp.set(r.ppp_id, r);
  const ultValByEv = new Map<string, any>();
  const ocorByEv = new Map<string, any[]>();
  for (const o of ocorrencias as any[]) {
    if (!ocorByEv.has(o.evento_id)) ocorByEv.set(o.evento_id, []);
    ocorByEv.get(o.evento_id)!.push(o);
    if (o.tipo === "validacao_local" && !ultValByEv.has(o.evento_id))
      ultValByEv.set(o.evento_id, o);
  }

  // ---------- Build extended rows ----------
  const rows = useMemo(() => eventos.map((ev) => {
    const per = perById.get(ev.ppp_periodo_id);
    const exps = expsByPer.get(ev.ppp_periodo_id) || [];
    const maps = mapsByEmp.get(ev.empresa_id) || new Map();
    const checks = buildChecks(ev, {
      ppp: pppById.get(ev.ppp_documento_id),
      periodo: per,
      exps,
      maps,
      resp: respByPpp.get(ev.ppp_documento_id),
      ultVal: ultValByEv.get(ev.id),
    });
    const ultVal = ultValByEv.get(ev.id) || null;
    const pendT24 = exps.filter((e: any) => !maps.get(norm(e.agente_nome))?.codigo_t24 && !e.codigo_esocial);
    const divT24 = exps.filter((e: any) => maps.get(norm(e.agente_nome))?.status === "divergente");
    const hashDiv = ultVal?.xml_sha256 && ev.xml_sha256 && ultVal.xml_sha256 !== ev.xml_sha256;
    return { ev, per, exps, maps, ultVal, checks, pct: checksPct(checks), pendT24, divT24, hashDiv };
  }), [eventos, periodos, exposicoes, mapeamentos, ppps, respAmb, ocorrencias]);

  // ---------- Filters ----------
  const filtered = useMemo(() => rows.filter(({ ev, per, exps, maps, ultVal }) => {
    if (fEmpresa !== "all" && ev.empresa_id !== fEmpresa) return false;
    if (fStatus !== "all" && ev.status !== fStatus) return false;
    if (fFunc) {
      const f = funcById.get(ev.funcionario_id);
      if (!(`${f?.nome || ""} ${f?.cpf || ""} ${ev.matricula || ""}`.toLowerCase().includes(fFunc.toLowerCase()))) return false;
    }
    if (fAgente && !exps.some((e: any) => (e.agente_nome || "").toLowerCase().includes(fAgente.toLowerCase()))) return false;
    if (fT24 && !exps.some((e: any) => (maps.get(norm(e.agente_nome))?.codigo_t24 || e.codigo_esocial || "").includes(fT24))) return false;
    if (fPPP && !(ev.ppp_documento_id || "").includes(fPPP)) return false;
    if (fLtcat && per?.ltcat_id !== fLtcat) return false;
    if (fLayout !== "all" && fLayout !== ESOCIAL_S2240_VERSAO_LAYOUT) return false;
    if (fOcor === "erro" && ultVal?.resultado !== "erro") return false;
    if (fOcor === "alerta" && ultVal?.resultado !== "aviso") return false;
    if (fOcor === "nenhuma" && ultVal) return false;
    if (fExpDe && (!per?.data_inicio || per.data_inicio < fExpDe)) return false;
    if (fExpAte && (!per?.data_inicio || per.data_inicio > fExpAte)) return false;
    if (fGerDe && (!ev.xml_gerado_em || ev.xml_gerado_em < fGerDe)) return false;
    if (fGerAte && (!ev.xml_gerado_em || ev.xml_gerado_em > fGerAte + "T23:59:59")) return false;
    if (fValDe && (!ev.validado_em || ev.validado_em < fValDe)) return false;
    if (fValAte && (!ev.validado_em || ev.validado_em > fValAte + "T23:59:59")) return false;
    return true;
  }), [rows, fEmpresa, fStatus, fFunc, fAgente, fT24, fPPP, fLtcat, fLayout, fOcor, fExpDe, fExpAte, fGerDe, fGerAte, fValDe, fValAte]);

  // ---------- KPIs ----------
  const k = useMemo(() => {
    const total = filtered.length;
    const byStatus = (s: string) => filtered.filter((r) => r.ev.status === s).length;
    const withXml = filtered.filter((r) => !!r.ev.xml_drive_id).length;
    const pronto = filtered.filter((r) => r.checks.t24 && r.checks.semPendT24 && r.checks.semDivT24 && r.checks.xmlGerado && r.checks.hash && r.checks.semErroUltVal && r.checks.cpf && r.checks.cbo).length;
    const semResp = filtered.filter((r) => !r.checks.respTec).length;
    const semMat = filtered.filter((r) => !r.checks.matricula).length;
    const semCbo = filtered.filter((r) => !r.checks.cbo).length;
    const comPend = filtered.filter((r) => r.pendT24.length > 0).length;
    const comDiv = filtered.filter((r) => r.divT24.length > 0).length;
    const hashDiv = filtered.filter((r) => r.hashDiv).length;
    const validades = filtered.map((r) => daysSince(r.ev.validado_em)).filter((v): v is number => v !== null);
    const idadeMed = validades.length ? Math.round(validades.reduce((a, b) => a + b, 0) / validades.length) : null;
    return {
      total,
      pendente: byStatus("pendente"),
      validado: byStatus("validado_stub"),
      rejeitado: byStatus("rejeitado_local"),
      simulado: byStatus("simulado"),
      homolog: byStatus("homologacao_stub"),
      withXml,
      withoutXml: total - withXml,
      hashDiv, comPend, comDiv,
      pronto,
      pctPronto: total ? Math.round((pronto / total) * 100) : 0,
      idadeMed,
      semResp, semMat, semCbo,
    };
  }, [filtered]);

  // ---------- Consolidado por empresa ----------
  const consolidado = useMemo(() => {
    const grupos = new Map<string, typeof filtered>();
    for (const r of filtered) {
      const arr = grupos.get(r.ev.empresa_id) || [];
      arr.push(r); grupos.set(r.ev.empresa_id, arr);
    }
    return Array.from(grupos.entries()).map(([empId, arr]) => {
      const total = arr.length;
      const pronto = arr.filter((r) => r.checks.xmlGerado && r.checks.hash && r.checks.semErroUltVal && r.checks.t24 && r.checks.semPendT24 && r.checks.semDivT24).length;
      const pctPronto = total ? Math.round((pronto / total) * 100) : 0;
      const pctMedio = total ? Math.round(arr.reduce((s, r) => s + r.pct, 0) / total) : 0;
      const erros = arr.filter((r) => r.ultVal?.resultado === "erro").length;
      const pendT24 = arr.filter((r) => r.pendT24.length > 0).length;
      const semXml = arr.filter((r) => !r.ev.xml_drive_id).length;
      return { empId, empresa: empById.get(empId), total, pronto, pctPronto, pctMedio, erros, pendT24, semXml };
    }).sort((a, b) => (a.empresa?.nome || "").localeCompare(b.empresa?.nome || ""));
  }, [filtered]);

  // ---------- Actions ----------
  const handleValidar = async (evId: string) => {
    setBusy(evId + ":val");
    try {
      const r = await validarXmlS2240Tecnico(evId);
      toast.success(`Validação técnica: ${r.erros} erro(s) / ${r.alertas} alerta(s)`);
      qc.invalidateQueries({ queryKey: ["s2240-dash-eventos"] });
      qc.invalidateQueries({ queryKey: ["s2240-dash-ocor"] });
      refetch();
    } catch (e: any) { toast.error(e?.message || "Falha na validação"); }
    finally { setBusy(null); }
  };
  const handleRegen = async (evId: string) => {
    setBusy(evId + ":gen");
    try {
      const r = await gerarXmlS2240(evId);
      toast.success(`XML regenerado — hash ${r.hash.slice(0, 16)}…`);
      qc.invalidateQueries({ queryKey: ["s2240-dash-eventos"] });
      refetch();
    } catch (e: any) { toast.error(e?.message || "Falha ao regerar XML", { duration: 8000 }); }
    finally { setBusy(null); }
  };

  // ---------- Exports ----------
  const exportEventos = () => {
    downloadCsv(`s2240-eventos-${Date.now()}.csv`, filtered.map(({ ev, per, exps, checks, pct, ultVal }) => ({
      evento_id: ev.id,
      empresa: empById.get(ev.empresa_id)?.nome || ev.empresa_id,
      cnpj: empById.get(ev.empresa_id)?.cnpj || "",
      funcionario: funcById.get(ev.funcionario_id)?.nome || "",
      cpf: ev.cpf_trabalhador || "",
      matricula: ev.matricula || "",
      cbo: ev.cbo || "",
      funcao: per?.funcao_nome || "",
      data_inicio: per?.data_inicio || "",
      data_fim: per?.data_fim || "",
      status: ev.status,
      layout: ESOCIAL_S2240_VERSAO_LAYOUT,
      xml_sha256: ev.xml_sha256 || "",
      xml_tamanho_bytes: ev.xml_tamanho_bytes || "",
      xml_gerado_em: ev.xml_gerado_em || "",
      validado_em: ev.validado_em || "",
      ultima_validacao_resultado: ultVal?.resultado || "",
      total_agentes: exps.length,
      checklist_pct: pct,
      prontidao: checks.xmlGerado && checks.hash && checks.semErroUltVal && checks.semPendT24 && checks.semDivT24 ? "pronto_stub" : "incompleto",
    })));
  };
  const exportOcor = () => {
    downloadCsv(`s2240-ocorrencias-${Date.now()}.csv`, (ocorrencias as any[]).map((o) => ({
      ocorrencia_id: o.id, evento_id: o.evento_id, tipo: o.tipo, resultado: o.resultado,
      erro_resumido: o.erro_resumido || "",
      total_mensagens: Array.isArray(o.mensagens) ? o.mensagens.length : 0,
      xml_sha256: o.xml_sha256 || "", created_at: o.created_at,
    })));
  };
  const exportAgentes = () => {
    const rows2: any[] = [];
    for (const r of filtered) {
      for (const e of r.exps) {
        const m = r.maps.get(norm(e.agente_nome));
        rows2.push({
          evento_id: r.ev.id,
          empresa: empById.get(r.ev.empresa_id)?.nome || "",
          funcionario: funcById.get(r.ev.funcionario_id)?.nome || "",
          agente: e.agente_nome,
          codigo_t24: m?.codigo_t24 || e.codigo_esocial || "",
          status_mapeamento: m?.status || (e.codigo_esocial ? "mapeado" : "pendente"),
          intensidade: e.intensidade ?? "",
          unidade: e.unidade_medida || m?.unidade_medida_padrao || "",
          tecnica: e.tecnica || "",
          epi: e.epi_descricao || "",
          epi_eficacia: e.epi_eficacia || "",
          epc: e.epc_descricao || "",
        });
      }
    }
    downloadCsv(`s2240-agentes-${Date.now()}.csv`, rows2);
  };
  const exportMapsPend = () => {
    const seen = new Set<string>();
    const rows2: any[] = [];
    for (const r of filtered) {
      for (const e of r.exps) {
        const m = r.maps.get(norm(e.agente_nome));
        const pend = !m?.codigo_t24 && !e.codigo_esocial;
        const div = m?.status === "divergente";
        if (!pend && !div) continue;
        const key = `${r.ev.empresa_id}|${norm(e.agente_nome)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows2.push({
          empresa: empById.get(r.ev.empresa_id)?.nome || "",
          agente: e.agente_nome,
          status: pend ? "pendente" : "divergente",
          codigo_t24_atual: m?.codigo_t24 || "",
          tipo_avaliacao: m?.tipo_avaliacao_esperado || "",
          unidade_padrao: m?.unidade_medida_padrao || "",
        });
      }
    }
    downloadCsv(`s2240-mapeamentos-pendentes-${Date.now()}.csv`, rows2);
  };

  // ---------- Render ----------
  if (!canView) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-sm text-muted-foreground flex gap-2 items-center">
          <ShieldAlert className="h-4 w-4" /> Sem permissão <code className="font-mono">esocial:s2240:visualizar</code>.
        </CardContent></Card>
      </div>
    );
  }

  const openRow = openChecklist ? rows.find((r) => r.ev.id === openChecklist) : null;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header + aviso */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileCode2 className="h-5 w-5" /> eSocial S-2240 — Dashboard & Prontidão
            <Badge variant="outline" className="text-[10px]">Layout {ESOCIAL_S2240_VERSAO_LAYOUT}</Badge>
            <Badge variant="destructive" className="text-[10px]">Não enviado ao Ambiente Nacional</Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">{ESOCIAL_S2240_AVISO}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link to="/esocial/s2240/mapeamentos"><Tag className="h-4 w-4 mr-1" /> Mapeamentos T24</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
            <Button size="sm" variant="ghost" className="ml-auto h-7"
              onClick={() => { setFEmpresa("all"); setFStatus("all"); setFFunc(""); setFAgente(""); setFT24(""); setFPPP(""); setFLtcat(""); setFLayout("all"); setFOcor("any"); setFExpDe(""); setFExpAte(""); setFGerDe(""); setFGerAte(""); setFValDe(""); setFValAte(""); }}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
          <div><Label className="text-[10px]">Empresa</Label>
            <Select value={fEmpresa} onValueChange={setFEmpresa}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-[10px]">Status</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-[10px]">Funcionário / CPF / Matrícula</Label>
            <Input className="h-8" value={fFunc} onChange={(e) => setFFunc(e.target.value)} placeholder="busca" /></div>
          <div><Label className="text-[10px]">Agente nocivo</Label>
            <Input className="h-8" value={fAgente} onChange={(e) => setFAgente(e.target.value)} placeholder="ex.: ruído" /></div>
          <div><Label className="text-[10px]">Código T24</Label>
            <Input className="h-8" value={fT24} onChange={(e) => setFT24(e.target.value)} placeholder="ex.: 01.01.001" /></div>
          <div><Label className="text-[10px]">PPP (ID parcial)</Label>
            <Input className="h-8" value={fPPP} onChange={(e) => setFPPP(e.target.value)} /></div>
          <div><Label className="text-[10px]">LTCAT (ID)</Label>
            <Input className="h-8" value={fLtcat} onChange={(e) => setFLtcat(e.target.value)} /></div>
          <div><Label className="text-[10px]">Layout</Label>
            <Select value={fLayout} onValueChange={setFLayout}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value={ESOCIAL_S2240_VERSAO_LAYOUT}>{ESOCIAL_S2240_VERSAO_LAYOUT}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-[10px]">Última validação</Label>
            <Select value={fOcor} onValueChange={(v: any) => setFOcor(v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="erro">Com erro</SelectItem>
                <SelectItem value="alerta">Com alerta</SelectItem>
                <SelectItem value="nenhuma">Sem validação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-[10px]">Período exp. (de)</Label>
            <Input type="date" className="h-8" value={fExpDe} onChange={(e) => setFExpDe(e.target.value)} /></div>
          <div><Label className="text-[10px]">Período exp. (até)</Label>
            <Input type="date" className="h-8" value={fExpAte} onChange={(e) => setFExpAte(e.target.value)} /></div>
          <div><Label className="text-[10px]">Gerado (de)</Label>
            <Input type="date" className="h-8" value={fGerDe} onChange={(e) => setFGerDe(e.target.value)} /></div>
          <div><Label className="text-[10px]">Gerado (até)</Label>
            <Input type="date" className="h-8" value={fGerAte} onChange={(e) => setFGerAte(e.target.value)} /></div>
          <div><Label className="text-[10px]">Validado (de)</Label>
            <Input type="date" className="h-8" value={fValDe} onChange={(e) => setFValDe(e.target.value)} /></div>
          <div><Label className="text-[10px]">Validado (até)</Label>
            <Input type="date" className="h-8" value={fValAte} onChange={(e) => setFValAte(e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <KpiCard label="Total de eventos" value={k.total} icon={<FileCode2 className="h-3.5 w-3.5" />} />
        <KpiCard label="Pendentes" value={k.pendente} tone="warn" />
        <KpiCard label="Validados (stub)" value={k.validado} tone="ok" />
        <KpiCard label="Rejeitados localmente" value={k.rejeitado} tone="err" />
        <KpiCard label="Simulados" value={k.simulado} />
        <KpiCard label="Homologação (stub)" value={k.homolog} />
        <KpiCard label="Com XML gerado" value={k.withXml} tone="ok" />
        <KpiCard label="Sem XML" value={k.withoutXml} tone="warn" />
        <KpiCard label="Hash divergente" value={k.hashDiv} tone={k.hashDiv ? "err" : "default"} />
        <KpiCard label="Com pendência T24" value={k.comPend} tone={k.comPend ? "warn" : "default"} />
        <KpiCard label="Com mapeamento divergente" value={k.comDiv} tone={k.comDiv ? "err" : "default"} />
        <KpiCard label="Prontos p/ transmissão futura" value={`${k.pronto} (${k.pctPronto}%)`} tone="ok" />
        <KpiCard label="Idade média da última validação" value={k.idadeMed !== null ? `${k.idadeMed} dia(s)` : "—"} />
        <KpiCard label="Sem responsável técnico" value={k.semResp} tone={k.semResp ? "warn" : "default"} />
        <KpiCard label="Sem matrícula" value={k.semMat} tone={k.semMat ? "warn" : "default"} />
        <KpiCard label="Sem CBO" value={k.semCbo} tone={k.semCbo ? "err" : "default"} />
      </div>

      {/* Exports */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={exportEventos}><Download className="h-4 w-4 mr-1" /> CSV eventos</Button>
        <Button size="sm" variant="outline" onClick={exportOcor}><Download className="h-4 w-4 mr-1" /> CSV ocorrências</Button>
        <Button size="sm" variant="outline" onClick={exportAgentes}><Download className="h-4 w-4 mr-1" /> CSV agentes</Button>
        <Button size="sm" variant="outline" onClick={exportMapsPend}><Download className="h-4 w-4 mr-1" /> CSV mapeamentos pendentes/divergentes</Button>
      </div>

      {/* Tabs eventos / consolidado */}
      <Tabs defaultValue="eventos">
        <TabsList>
          <TabsTrigger value="eventos">Por evento ({filtered.length})</TabsTrigger>
          <TabsTrigger value="consolidado">Consolidado por empresa ({consolidado.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="eventos">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {loadingEv ? (
                <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Nenhum evento S-2240 com os filtros atuais.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>CBO</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Checklist</TableHead>
                      <TableHead>Última validação</TableHead>
                      <TableHead>XML</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(({ ev, per, checks, pct, ultVal, pendT24, divT24, hashDiv }) => {
                      const f = funcById.get(ev.funcionario_id);
                      const emp = empById.get(ev.empresa_id);
                      return (
                        <TableRow key={ev.id}>
                          <TableCell className="text-xs">
                            <div className="font-medium">{emp?.nome || "—"}</div>
                            <div className="text-muted-foreground">{emp?.cnpj || ""}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>{f?.nome || "—"}</div>
                            <div className="text-muted-foreground">CPF {ev.cpf_trabalhador || "—"} · mat {ev.matricula || "—"}</div>
                          </TableCell>
                          <TableCell className="text-xs">{fmtDate(per?.data_inicio)} → {per?.data_fim ? fmtDate(per.data_fim) : "atual"}</TableCell>
                          <TableCell className="text-xs">{ev.cbo || <span className="text-destructive">—</span>}</TableCell>
                          <TableCell><Badge variant={STATUS_VARIANT[ev.status] || "outline"} className="text-[10px]">{STATUS_LABEL[ev.status] || ev.status}</Badge></TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1">
                              <div className="w-14 h-1.5 bg-muted rounded">
                                <div className={`h-full rounded ${pct === 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span>{pct}%</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {pendT24.length > 0 && <Badge variant="destructive" className="text-[9px]">{pendT24.length} pend T24</Badge>}
                              {divT24.length > 0 && <Badge variant="destructive" className="text-[9px]">{divT24.length} div</Badge>}
                              {!checks.respTec && <Badge variant="outline" className="text-[9px]">s/ resp.téc</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {ultVal ? (
                              <>
                                <Badge variant={ultVal.resultado === "erro" ? "destructive" : ultVal.resultado === "aviso" ? "outline" : "default"} className="text-[9px]">
                                  {ultVal.resultado}
                                </Badge>
                                <div className="text-muted-foreground mt-0.5">{fmtDt(ev.validado_em)}</div>
                                {hashDiv && <Badge variant="destructive" className="text-[9px] mt-0.5">hash divergente</Badge>}
                              </>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {ev.xml_drive_id ? (
                              <>
                                <div className="font-mono text-[10px]">sha {(ev.xml_sha256 || "").slice(0, 10)}…</div>
                                <div className="text-muted-foreground">{ev.xml_tamanho_bytes || "—"} B</div>
                              </>
                            ) : <Badge variant="outline" className="text-[9px]">sem XML</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 flex-wrap">
                              <Button asChild size="sm" variant="ghost" className="h-7 px-2" title="Abrir PPP">
                                <Link to={`/ppp/${ev.ppp_documento_id}`}><FileText className="h-3.5 w-3.5" /></Link>
                              </Button>
                              {ev.xml_drive_link && (
                                <Button asChild size="sm" variant="ghost" className="h-7 px-2" title="Abrir XML no Drive">
                                  <a href={ev.xml_drive_link} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 px-2" title="Checklist + ocorrências" onClick={() => setOpenChecklist(ev.id)}>
                                <ListChecks className="h-3.5 w-3.5" />
                              </Button>
                              <MfaActionButton size="sm" variant="ghost" className="h-7 px-2"
                                disabled={!canValidar || !ev.xml_drive_id || busy === ev.id + ":val"}
                                onClick={() => handleValidar(ev.id)} title="Validar XML técnico">
                                {busy === ev.id + ":val" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              </MfaActionButton>
                              <MfaActionButton size="sm" variant="ghost" className="h-7 px-2"
                                disabled={!canPreparar || busy === ev.id + ":gen"}
                                onClick={() => handleRegen(ev.id)} title="Regerar XML técnico">
                                {busy === ev.id + ":gen" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                              </MfaActionButton>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consolidado">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Prontos (stub)</TableHead>
                    <TableHead>% prontidão</TableHead>
                    <TableHead>Checklist médio</TableHead>
                    <TableHead>Com erro</TableHead>
                    <TableHead>Pend. T24</TableHead>
                    <TableHead>Sem XML</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidado.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-sm text-muted-foreground p-4">Nenhuma empresa com eventos.</TableCell></TableRow>
                  ) : consolidado.map((c) => (
                    <TableRow key={c.empId}>
                      <TableCell className="text-xs">
                        <div className="font-medium">{c.empresa?.nome || c.empId}</div>
                        <div className="text-muted-foreground">{c.empresa?.cnpj || ""}</div>
                      </TableCell>
                      <TableCell>{c.total}</TableCell>
                      <TableCell>{c.pronto}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded">
                            <div className={`h-full rounded ${c.pctPronto === 100 ? "bg-emerald-500" : c.pctPronto >= 70 ? "bg-amber-500" : "bg-destructive"}`} style={{ width: `${c.pctPronto}%` }} />
                          </div>
                          <span className="text-xs">{c.pctPronto}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{c.pctMedio}%</TableCell>
                      <TableCell>{c.erros > 0 ? <Badge variant="destructive">{c.erros}</Badge> : c.erros}</TableCell>
                      <TableCell>{c.pendT24 > 0 ? <Badge variant="destructive">{c.pendT24}</Badge> : c.pendT24}</TableCell>
                      <TableCell>{c.semXml}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drawer checklist + ocorrências */}
      <Sheet open={!!openChecklist} onOpenChange={(o) => !o && setOpenChecklist(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {openRow && (() => {
            const { ev, checks, pct } = openRow;
            const oco = ocorByEv.get(ev.id) || [];
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="h-4 w-4" /> Checklist · {pct}%
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    Evento {ev.id.slice(0, 8)}… · {STATUS_LABEL[ev.status] || ev.status}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {CHECK_LABELS.map(([k, label]) => {
                    const ok = (checks as any)[k];
                    return (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        {ok
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          : <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                        <span className={ok ? "" : "text-destructive font-medium"}>{label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 p-2 text-amber-900 dark:text-amber-200 text-[11px]">
                  {ESOCIAL_S2240_AVISO}
                </div>
                <div className="mt-4">
                  <div className="font-semibold text-sm mb-1">Ocorrências recentes</div>
                  {oco.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Nenhuma ocorrência registrada.</div>
                  ) : (
                    <ul className="space-y-2 max-h-72 overflow-y-auto">
                      {oco.slice(0, 20).map((o: any) => (
                        <li key={o.id} className="border rounded p-2 text-xs">
                          <div className="flex items-center gap-2">
                            <Badge variant={o.resultado === "erro" ? "destructive" : o.resultado === "aviso" ? "outline" : "default"} className="text-[9px]">{o.resultado}</Badge>
                            <span className="text-muted-foreground">{o.tipo} · {fmtDt(o.created_at)}</span>
                          </div>
                          {o.erro_resumido && <div className="mt-1">{o.erro_resumido}</div>}
                          {Array.isArray(o.mensagens) && o.mensagens.length > 0 && (
                            <ul className="mt-1 list-disc list-inside opacity-90">
                              {o.mensagens.slice(0, 6).map((m: any, i: number) => (
                                <li key={i}><span className="font-mono opacity-70">{m.codigo}</span> {m.mensagem}</li>
                              ))}
                              {o.mensagens.length > 6 && <li>… +{o.mensagens.length - 6}</li>}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Tag(props: any) { return <FileText {...props} />; }

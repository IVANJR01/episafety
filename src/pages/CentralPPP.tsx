import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, FileText, Download, Search, Users, X, AlertTriangle, CheckCircle2, RefreshCw, ExternalLink, Info } from "lucide-react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { gerarPPPPdf } from "@/lib/gerarPPP";

interface RiscoCargo {
  id: string;
  cargo: string;
  tipo_risco: string;
  fator_risco: string;
  intensidade_concentracao: string | null;
  tecnica_utilizada: string | null;
  epc_eficaz: boolean;
  epi_eficaz: boolean;
  ca_epi: string | null;
  profissiografia: string | null;
  cbo: string | null;
}

interface Responsavel {
  id: string;
  tipo: string;
  nome: string;
  nit: string | null;
  registro_conselho: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
}

interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  setor: string | null;
  data_admissao: string | null;
  data_demissao: string | null;
  matricula: string | null;
  regime_revezamento: string | null;
}

interface EmpresaConfig {
  id: string;
  nome: string;
  cnpj: string | null;
  cpf_representante_legal: string | null;
  nome_representante_legal: string | null;
}

const TIPO_RISCO_LABELS: Record<string, string> = {
  fisico: "Físico",
  quimico: "Químico",
  biologico: "Biológico",
  ergonomico: "Ergonômico",
  acidente: "Acidente",
};

// Riscos previdenciários (entram no PPP/eSocial S-2240)
const RISCOS_PREVIDENCIARIOS = ["fisico", "quimico", "biologico"];

const AUSENCIA_FATOR = "Ausência de Agente Nocivo ou Agentes Nocivos não arrolados no Decreto 3.048/1999";
const AUSENCIA_CODIGO = "09.01.001";
const AUSENCIA_OBS = "Informação declarada com base nas avaliações quantitativas e qualitativas constantes no LTCAT da empresa, em conformidade com o Anexo IV do Decreto 3.048/99";

const TIPO_RISCO_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  fisico: "default",
  quimico: "destructive",
  biologico: "secondary",
  ergonomico: "outline",
  acidente: "destructive",
};

const emptyRiscoForm = {
  cargo: "",
  tipo_risco: "fisico",
  fator_risco: "",
  intensidade_concentracao: "",
  tecnica_utilizada: "",
  epc_eficaz: false,
  epi_eficaz: false,
  ca_epi: "",
  profissiografia: "",
  cbo: "",
  cargos_multi: [] as string[], // for bulk creation
  ausencia_risco: false, // checkbox for 09.01.001
};

const emptyRespForm = {
  tipo: "engenheiro",
  nome: "",
  cpf_responsavel: "",
  registro_conselho: "",
  periodo_inicio: "",
  periodo_fim: "",
};

function CargoMultiSelect({ selected, onChange, suggestions }: { selected: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions.filter(
    (s) => !selected.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase())
  );

  const addCargo = (cargo: string) => {
    const trimmed = cargo.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setInputValue("");
  };

  const removeCargo = (cargo: string) => {
    onChange(selected.filter((c) => c !== cargo));
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 rounded-md border border-input bg-background px-2 py-1.5 min-h-[36px] cursor-text" onClick={() => inputRef.current?.focus()}>
        {selected.map((c) => (
          <span key={c} className="inline-flex items-center gap-0.5 bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
            {c}
            <button type="button" onClick={(e) => { e.stopPropagation(); removeCargo(c); }} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputValue.trim()) { e.preventDefault(); addCargo(inputValue); }
            if (e.key === "Backspace" && !inputValue && selected.length > 0) { removeCargo(selected[selected.length - 1]); }
          }}
          placeholder={selected.length === 0 ? "Ex: Servente" : "Adicionar..."}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
          {filtered.map((s) => (
            <button key={s} type="button" onMouseDown={(e) => { e.preventDefault(); addCargo(s); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent truncate">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CentralPPP() {
  const { empresaId, user } = useAuth();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  // Data
  const [riscos, setRiscos] = useState<RiscoCargo[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [riscoOpen, setRiscoOpen] = useState(false);
  const [respOpen, setRespOpen] = useState(false);
  const [pppOpen, setPppOpen] = useState(false);
  const [editingRisco, setEditingRisco] = useState<RiscoCargo | null>(null);
  const [editingResp, setEditingResp] = useState<Responsavel | null>(null);

  // Forms with localStorage persistence
  const { form: riscoForm, setForm: setRiscoForm, resetForm: resetRiscoForm, hasDraft: hasRiscoDraft, clearDraft: clearRiscoDraft } = useFormDraft("ppp_risco", emptyRiscoForm);
  const { form: respForm, setForm: setRespForm, resetForm: resetRespForm, hasDraft: hasRespDraft, clearDraft: clearRespDraft } = useFormDraft("ppp_resp", emptyRespForm);
  const [selectedFuncId, setSelectedFuncId] = useState("");
  const [pppSearchName, setPppSearchName] = useState("");
  const [search, setSearch] = useState("");

  // Prevent accidental exit with unsaved form data
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (riscoOpen || respOpen) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [riscoOpen, respOpen]);

  // Unique cargos from riscos
  const cargos = useMemo(() => [...new Set(riscos.map((r) => r.cargo))].sort(), [riscos]);
  // All known cargos: from riscos + from funcionarios
  const allCargos = useMemo(() => {
    const set = new Set<string>();
    riscos.forEach((r) => set.add(r.cargo));
    funcionarios.forEach((f) => { if (f.cargo) set.add(f.cargo); });
    return [...set].sort();
  }, [riscos, funcionarios]);

  useEffect(() => {
    if (empresaId) loadAll();
  }, [empresaId]);

  async function loadAll() {
    setLoading(true);
    const [rRes, respRes, fRes, eRes] = await Promise.all([
      supabase.from("ppp_riscos_cargo").select("*").order("cargo"),
      supabase.from("ppp_responsaveis").select("*").order("tipo"),
      supabase.from("funcionarios").select("id, nome, cpf, cargo, setor, data_admissao, data_demissao, matricula, regime_revezamento").order("nome"),
      supabase.from("empresa_config").select("id, nome, cnpj, cpf_representante_legal, nome_representante_legal").eq("id", empresaId!).single(),
    ]);
    if (rRes.data) setRiscos(rRes.data as any);
    if (respRes.data) setResponsaveis(respRes.data as any);
    if (fRes.data) setFuncionarios(fRes.data as any);
    if (eRes.data) setEmpresa(eRes.data as any);
    setLoading(false);
  }

  // === RISCOS CRUD ===
  function openNewRisco() {
    setEditingRisco(null);
    if (!hasRiscoDraft()) resetRiscoForm();
    setRiscoOpen(true);
  }
  function openEditRisco(r: RiscoCargo) {
    setEditingRisco(r);
    resetRiscoForm({
      cargo: r.cargo,
      tipo_risco: r.tipo_risco,
      fator_risco: r.fator_risco,
      intensidade_concentracao: r.intensidade_concentracao || "",
      tecnica_utilizada: r.tecnica_utilizada || "",
      epc_eficaz: r.epc_eficaz,
      epi_eficaz: r.epi_eficaz,
      ca_epi: r.ca_epi || "",
      profissiografia: r.profissiografia || "",
      cbo: r.cbo || "",
      cargos_multi: [],
      ausencia_risco: r.fator_risco === AUSENCIA_FATOR,
    });
    setRiscoOpen(true);
  }

  async function saveRisco() {
    const isEditing = !!editingRisco;
    // In edit mode use single cargo; in create mode use multi or single
    const cargosList = isEditing
      ? [riscoForm.cargo.trim()]
      : riscoForm.cargos_multi.length > 0
        ? riscoForm.cargos_multi.map((c) => c.trim())
        : riscoForm.cargo.trim() ? [riscoForm.cargo.trim()] : [];

    if (cargosList.length === 0 || !riscoForm.fator_risco) {
      toast.error("Preencha cargo(s) e fator de risco");
      return;
    }

    const basePayload = {
      tipo_risco: riscoForm.tipo_risco as "fisico" | "quimico" | "biologico" | "ergonomico" | "acidente",
      fator_risco: riscoForm.fator_risco.trim(),
      intensidade_concentracao: riscoForm.intensidade_concentracao || null,
      tecnica_utilizada: riscoForm.tecnica_utilizada || null,
      epc_eficaz: riscoForm.epc_eficaz,
      epi_eficaz: riscoForm.epi_eficaz,
      ca_epi: riscoForm.ca_epi || null,
      profissiografia: riscoForm.profissiografia || null,
      cbo: riscoForm.cbo || null,
      empresa_id: empresaId,
    };

    if (isEditing) {
      const { error } = await supabase.from("ppp_riscos_cargo").update({ ...basePayload, cargo: cargosList[0] }).eq("id", editingRisco!.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Risco atualizado");
    } else {
      const rows = cargosList.map((cargo) => ({ ...basePayload, cargo }));
      const { error } = await supabase.from("ppp_riscos_cargo").insert(rows);
      if (error) { toast.error("Erro ao cadastrar"); return; }
      toast.success(`${rows.length} risco(s) cadastrado(s) com sucesso`);
    }
    clearRiscoDraft();
    setRiscoOpen(false);
    loadAll();
  }

  async function deleteRisco(id: string) {
    await supabase.from("ppp_riscos_cargo").delete().eq("id", id);
    toast.success("Risco removido");
    loadAll();
  }

  // === SINCRONIZAR RISCOS DO LTCAT ===
  // Fonte oficial dos agentes previdenciários. O PPP apenas espelha.
  async function syncFromLtcat() {
    if (!empresaId) { toast.error("Selecione uma empresa ativa"); return; }
    setSyncing(true);
    try {
      const [funcRes, agRes] = await Promise.all([
        supabase.from("ltcat_funcoes")
          .select("id, nome_funcao, cbo, grupo_homogeneo_id")
          .eq("empresa_id", empresaId),
        supabase.from("ltcat_agentes")
          .select("id, nome, grupo, grupo_homogeneo_id, epi_eficacia, epc_eficacia, epi_ca, tipo_exposicao, trajetoria")
          .eq("empresa_id", empresaId),
      ]);
      if (funcRes.error) throw funcRes.error;
      if (agRes.error) throw agRes.error;

      const funcoes = (funcRes.data || []) as any[];
      const agentes = (agRes.data || []) as any[];

      if (funcoes.length === 0 || agentes.length === 0) {
        toast.error("Nenhum dado de LTCAT encontrado para esta empresa");
        setSyncing(false);
        return;
      }

      // Agrupar agentes por GHE
      const agentesPorGhe = new Map<string, any[]>();
      agentes.forEach((a) => {
        if (!a.grupo_homogeneo_id) return;
        const arr = agentesPorGhe.get(a.grupo_homogeneo_id) || [];
        arr.push(a);
        agentesPorGhe.set(a.grupo_homogeneo_id, arr);
      });

      const parseEficaz = (v: string | null) => !!v && /efic/i.test(v) && !/inefic/i.test(v);
      const tiposValidos = ["fisico", "quimico", "biologico", "ergonomico", "acidente"];

      // Montar linhas alvo
      const alvo: any[] = [];
      for (const f of funcoes) {
        const cargo = (f.nome_funcao || "").trim();
        if (!cargo) continue;
        const ags = agentesPorGhe.get(f.grupo_homogeneo_id) || [];
        for (const a of ags) {
          const tipo = tiposValidos.includes(a.grupo) ? a.grupo : "fisico";
          alvo.push({
            empresa_id: empresaId,
            cargo,
            cbo: f.cbo || null,
            tipo_risco: tipo,
            fator_risco: (a.nome || "").trim(),
            intensidade_concentracao: a.tipo_exposicao || null,
            tecnica_utilizada: a.trajetoria || null,
            epc_eficaz: parseEficaz(a.epc_eficacia),
            epi_eficaz: parseEficaz(a.epi_eficacia),
            ca_epi: a.epi_ca || null,
          });
        }
      }

      if (alvo.length === 0) {
        toast.error("LTCAT sem funções vinculadas a agentes");
        setSyncing(false);
        return;
      }

      // Dedupe por (cargo, fator_risco)
      const chave = (r: any) => `${r.cargo}||${r.fator_risco}`;
      const existentesRes = await supabase.from("ppp_riscos_cargo")
        .select("id, cargo, fator_risco").eq("empresa_id", empresaId);
      const existentes = new Map<string, string>();
      (existentesRes.data || []).forEach((r: any) => existentes.set(chave(r), r.id));

      let inseridos = 0, atualizados = 0;
      for (const row of alvo) {
        const k = chave(row);
        const existingId = existentes.get(k);
        if (existingId) {
          const { error } = await supabase.from("ppp_riscos_cargo")
            .update(row).eq("id", existingId);
          if (!error) atualizados++;
        } else {
          const { error } = await supabase.from("ppp_riscos_cargo").insert(row);
          if (!error) inseridos++;
        }
      }

      toast.success(`Dados do LTCAT sincronizados. ${inseridos} novo(s), ${atualizados} atualizado(s).`);
      loadAll();
    } catch (e: any) {
      toast.error(e.message || "Falha ao sincronizar com LTCAT");
    } finally {
      setSyncing(false);
    }
  }



  // === RESPONSÁVEIS CRUD ===
  function openNewResp() {
    setEditingResp(null);
    if (!hasRespDraft()) resetRespForm();
    setRespOpen(true);
  }
  function openEditResp(r: Responsavel) {
    setEditingResp(r);
    resetRespForm({
      tipo: r.tipo,
      nome: r.nome,
      cpf_responsavel: r.nit || "",
      registro_conselho: r.registro_conselho || "",
      periodo_inicio: r.periodo_inicio || "",
      periodo_fim: r.periodo_fim || "",
    });
    setRespOpen(true);
  }

  async function saveResp() {
    if (!respForm.nome) { toast.error("Preencha o nome"); return; }
    const payload = {
      tipo: respForm.tipo,
      nome: respForm.nome.trim(),
      nit: respForm.cpf_responsavel || null,
      registro_conselho: respForm.registro_conselho || null,
      periodo_inicio: respForm.periodo_inicio || null,
      periodo_fim: respForm.periodo_fim || null,
      empresa_id: empresaId,
    };
    if (editingResp) {
      await supabase.from("ppp_responsaveis").update(payload).eq("id", editingResp.id);
      toast.success("Responsável atualizado");
    } else {
      await supabase.from("ppp_responsaveis").insert(payload);
      toast.success("Responsável cadastrado");
    }
    clearRespDraft();
    setRespOpen(false);
    loadAll();
  }

  async function deleteResp(id: string) {
    await supabase.from("ppp_responsaveis").delete().eq("id", id);
    toast.success("Removido");
    loadAll();
  }

  // === GERAR PPP ===
  function openGerarPPP() {
    setSelectedFuncId("");
    setPppOpen(true);
  }

  function gerarPPP() {
    const func = funcionarios.find((f) => f.id === selectedFuncId);
    if (!func) { toast.error("Selecione um funcionário"); return; }

    const cargoRiscos = riscos.filter((r) => r.cargo.toLowerCase() === (func.cargo || "").toLowerCase());
    const eng = responsaveis.find((r) => r.tipo === "engenheiro");
    const med = responsaveis.find((r) => r.tipo === "medico");

    const formatDate = (d: string | null) => {
      if (!d) return "";
      const parts = d.split("-");
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
    };

    const profissiografia = cargoRiscos.find((r) => r.profissiografia)?.profissiografia || "";
    const cbo = cargoRiscos.find((r) => r.cbo)?.cbo || "";

    // Filter only previdenciários risks for PPP
    const riscosPrevidenciarios = cargoRiscos.filter((r) => RISCOS_PREVIDENCIARIOS.includes(r.tipo_risco));

    // If no previdenciário risks, auto-add 09.01.001
    const riscosParaPPP = riscosPrevidenciarios.length > 0
      ? riscosPrevidenciarios.map((r) => ({
          tipo: r.tipo_risco,
          fatorRisco: r.fator_risco,
          intensidade: r.intensidade_concentracao || "",
          tecnica: r.tecnica_utilizada || "",
          epcEficaz: r.epc_eficaz ? "S" : "N",
          epiEficaz: r.epi_eficaz ? "S" : "N",
          caEpi: r.ca_epi || "",
        }))
      : [
          {
            tipo: "fisico",
            fatorRisco: AUSENCIA_FATOR,
            intensidade: "Não se aplica",
            tecnica: "Não se aplica",
            epcEficaz: "Não se aplica",
            epiEficaz: "Não se aplica",
            caEpi: "",
          },
        ];

    // Build observation with 09.01.001 note when applicable
    const profissiografiaFinal = riscosPrevidenciarios.length === 0
      ? (profissiografia ? profissiografia + "\n\n" : "") + AUSENCIA_OBS
      : profissiografia;

    const doc = gerarPPPPdf({
      cnpj: empresa?.cnpj || "",
      nomeEmpresa: empresa?.nome || "",
      cnae: "",
      nomeTrabalhador: func.nome,
      brPdh: "NA",
      cpf: func.cpf || "",
      dataNascimento: "",
      sexo: "",
      matriculaEsocial: func.matricula || "N/A",
      dataAdmissao: formatDate(func.data_admissao),
      dataDemissao: formatDate(func.data_demissao),
      regime: func.regime_revezamento || "NA",
      cargo: func.cargo || "",
      funcao: "",
      cbo,
      setor: func.setor || "",
      codigoGfip: "01",
      cats: [],
      profissiografia: profissiografiaFinal,
      riscos: riscosParaPPP,
      engenheiro: eng
        ? {
            nome: eng.nome,
            cpf: eng.nit || "",
            registro: eng.registro_conselho || "",
            periodo: `${formatDate(eng.periodo_inicio)} a ${formatDate(eng.periodo_fim) || "atual"}`,
          }
        : null,
      medico: med
        ? {
            nome: med.nome,
            cpf: med.nit || "",
            registro: med.registro_conselho || "",
            periodo: `${formatDate(med.periodo_inicio)} a ${formatDate(med.periodo_fim) || "atual"}`,
          }
        : null,
      dataEmissao: new Date().toLocaleDateString("pt-BR"),
      representanteLegal: empresa?.cpf_representante_legal
        ? { nome: empresa.nome_representante_legal || "", cpf: empresa.cpf_representante_legal }
        : null,
      observacoes: "",
    });

    doc.save(`PPP_${func.nome.replace(/\s+/g, "_")}.pdf`);
    toast.success("PPP gerado com sucesso!");
    setPppOpen(false);
  }

  const filteredRiscos = riscos.filter(
    (r) =>
      r.cargo.toLowerCase().includes(search.toLowerCase()) ||
      r.fator_risco.toLowerCase().includes(search.toLowerCase())
  );

  // Group riscos by cargo
  const groupedRiscos = useMemo(() => {
    const map = new Map<string, RiscoCargo[]>();
    filteredRiscos.forEach((r) => {
      const key = r.cargo;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return map;
  }, [filteredRiscos]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central PPP</h1>
          <p className="text-muted-foreground text-sm mt-1">Perfil Profissiográfico Previdenciário</p>
        </div>
        <Button onClick={openGerarPPP} className="gap-2">
          <Download className="w-4 h-4" />
          Gerar PPP de Desligamento
        </Button>
      </div>

      <Tabs defaultValue={localStorage.getItem("ppp_active_tab") || "riscos"} onValueChange={(v) => localStorage.setItem("ppp_active_tab", v)}>
        <TabsList>
          <TabsTrigger value="riscos">Riscos Previdenciários (LTCAT)</TabsTrigger>
          <TabsTrigger value="responsaveis">Responsáveis Técnicos</TabsTrigger>
        </TabsList>

        {/* === ABA RISCOS === */}
        <TabsContent value="riscos" className="space-y-4">
          <div className="flex gap-2 items-start rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-sm">
            <Info className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
            <div className="text-blue-900 dark:text-blue-100">
              Os riscos exibidos no PPP são <b>importados do LTCAT</b>. Para alterar agentes,
              intensidade, técnica, EPI/EPC ou CA, edite o LTCAT correspondente em{" "}
              <Link to="/ltcat" className="underline font-medium">Programas → LTCAT</Link>.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cargo ou risco..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/ltcat")} className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Ir para LTCAT
              </Button>
              <Button onClick={syncFromLtcat} disabled={syncing} className="gap-2">
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando…" : "Sincronizar do LTCAT"}
              </Button>
            </div>
          </div>

          {groupedRiscos.size === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium text-foreground mb-1">Nenhum dado de LTCAT encontrado</p>
                <p className="text-sm mb-4">
                  Cadastre ou gere o LTCAT para que o PPP puxe automaticamente os agentes nocivos e informações previdenciárias.
                </p>
                <Button onClick={() => navigate("/ltcat")} className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Ir para LTCAT
                </Button>
              </CardContent>
            </Card>
          ) : (
            Array.from(groupedRiscos.entries()).map(([cargo, items]) => (
              <Card key={cargo}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <CardTitle className="text-base">{cargo}</CardTitle>
                        <CardDescription>CBO: {items[0]?.cbo || "—"} • {items.length} risco(s)</CardDescription>
                      </div>
                      {items.some((r) => r.fator_risco === AUSENCIA_FATOR) ? (
                        <Badge variant="outline" className="border-green-500 text-green-700 text-[10px]">🟢 09.01.001</Badge>
                      ) : items.some((r) => RISCOS_PREVIDENCIARIOS.includes(r.tipo_risco)) ? (
                        <Badge variant="destructive" className="text-[10px]">🔴 Risco Previdenciário</Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Fator de Risco</TableHead>
                        <TableHead className="hidden md:table-cell">Intensidade</TableHead>
                        <TableHead className="hidden md:table-cell">Técnica</TableHead>
                        <TableHead className="hidden sm:table-cell">EPC</TableHead>
                        <TableHead className="hidden sm:table-cell">EPI</TableHead>
                        <TableHead className="hidden sm:table-cell">CA</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Badge variant={TIPO_RISCO_COLORS[r.tipo_risco] || "outline"}>
                              {TIPO_RISCO_LABELS[r.tipo_risco] || r.tipo_risco}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{r.fator_risco}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{r.intensidade_concentracao || "—"}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{r.tecnica_utilizada || "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell">{r.epc_eficaz ? "✓" : "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell">{r.epi_eficaz ? "✓" : "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell text-xs font-mono">{r.ca_epi || "—"}</TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                onClick={() => navigate("/ltcat")}
                                title="Editar no LTCAT"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Editar no LTCAT
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* === ABA RESPONSÁVEIS === */}
        <TabsContent value="responsaveis" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewResp} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Responsável
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">CPF</TableHead>
                    <TableHead className="hidden sm:table-cell">Reg. Conselho</TableHead>
                    <TableHead className="hidden md:table-cell">Período</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responsaveis.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Cadastre o Engenheiro de Segurança e o Médico do Trabalho
                      </TableCell>
                    </TableRow>
                  ) : (
                    responsaveis.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant={r.tipo === "engenheiro" ? "default" : "secondary"}>
                            {r.tipo === "engenheiro" ? "Engenheiro" : "Médico"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{r.nit || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{r.registro_conselho || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          {r.periodo_inicio || "—"} a {r.periodo_fim || "atual"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => openEditResp(r)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteResp(r.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* === DIALOG RISCO === */}
      <Dialog open={riscoOpen} onOpenChange={setRiscoOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRisco ? "Editar Risco" : "Novo Risco por Cargo"}</DialogTitle>
            <DialogDescription>Configure os fatores de risco extraídos do LTCAT</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Ausência de Risco checkbox */}
            <div className="flex items-center gap-3 p-3 rounded-md border border-dashed bg-muted/30">
              <Switch
                checked={riscoForm.ausencia_risco}
                onCheckedChange={(v) => {
                  if (v) {
                    setRiscoForm({
                      ...riscoForm,
                      ausencia_risco: true,
                      tipo_risco: "fisico",
                      fator_risco: AUSENCIA_FATOR,
                      intensidade_concentracao: "Não se aplica",
                      tecnica_utilizada: "Não se aplica",
                      epc_eficaz: false,
                      epi_eficaz: false,
                      ca_epi: "",
                    });
                  } else {
                    setRiscoForm({
                      ...riscoForm,
                      ausencia_risco: false,
                      fator_risco: "",
                      intensidade_concentracao: "",
                      tecnica_utilizada: "",
                    });
                  }
                }}
              />
              <div>
                <Label className="text-sm font-medium">Declarar Ausência de Agentes Nocivos</Label>
                <p className="text-[11px] text-muted-foreground">Código eSocial 09.01.001 — Quando não há exposição acima do nível de ação</p>
              </div>
            </div>

            {/* Cargo field: multi-select chips for new, single input for edit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cargo{!editingRisco ? "s" : ""} *</Label>
                {editingRisco ? (
                  <>
                    <Input value={riscoForm.cargo} onChange={(e) => setRiscoForm({ ...riscoForm, cargo: e.target.value })} placeholder="Ex: Servente" list="cargos-list" />
                    <datalist id="cargos-list">
                      {cargos.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </>
                ) : (
                  <CargoMultiSelect
                    selected={riscoForm.cargos_multi}
                    onChange={(v) => setRiscoForm({ ...riscoForm, cargos_multi: v })}
                    suggestions={allCargos}
                  />
                )}
              </div>
              <div>
                <Label>CBO</Label>
                <Input
                  value={riscoForm.cbo}
                  onChange={(e) => setRiscoForm({ ...riscoForm, cbo: e.target.value })}
                  placeholder="Ex: 717020"
                  disabled={!editingRisco && riscoForm.cargos_multi.length > 1}
                />
                {!editingRisco && riscoForm.cargos_multi.length > 1 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Desabilitado com múltiplos cargos</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Risco *</Label>
                <Select value={riscoForm.tipo_risco} onValueChange={(v) => setRiscoForm({ ...riscoForm, tipo_risco: v })} disabled={riscoForm.ausencia_risco}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_RISCO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fator de Risco *</Label>
                <Input value={riscoForm.fator_risco} onChange={(e) => setRiscoForm({ ...riscoForm, fator_risco: e.target.value })} placeholder="Ex: Ruídos" disabled={riscoForm.ausencia_risco} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Intensidade/Concentração</Label>
                <Input value={riscoForm.intensidade_concentracao} onChange={(e) => setRiscoForm({ ...riscoForm, intensidade_concentracao: e.target.value })} placeholder="Ex: 85 dB(A)" disabled={riscoForm.ausencia_risco} />
              </div>
              <div>
                <Label>Técnica Utilizada</Label>
                <Input value={riscoForm.tecnica_utilizada} onChange={(e) => setRiscoForm({ ...riscoForm, tecnica_utilizada: e.target.value })} placeholder="Ex: NHO-01" disabled={riscoForm.ausencia_risco} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={riscoForm.epc_eficaz} onCheckedChange={(v) => setRiscoForm({ ...riscoForm, epc_eficaz: v })} disabled={riscoForm.ausencia_risco} />
                <Label>EPC Eficaz</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={riscoForm.epi_eficaz} onCheckedChange={(v) => setRiscoForm({ ...riscoForm, epi_eficaz: v })} disabled={riscoForm.ausencia_risco} />
                <Label>EPI Eficaz</Label>
              </div>
              <div>
                <Label>CA do EPI</Label>
                <Input value={riscoForm.ca_epi} onChange={(e) => setRiscoForm({ ...riscoForm, ca_epi: e.target.value })} placeholder="Ex: 33.161" disabled={riscoForm.ausencia_risco} />
              </div>
            </div>
            <div>
              <Label>Profissiografia (Descrição das Atividades)</Label>
              <Textarea
                value={riscoForm.profissiografia}
                onChange={(e) => setRiscoForm({ ...riscoForm, profissiografia: e.target.value })}
                placeholder="Descreva as atividades detalhadas do cargo conforme o item 14.2 do PPP..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveRisco}>{editingRisco ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DIALOG RESPONSÁVEL === */}
      <Dialog open={respOpen} onOpenChange={setRespOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingResp ? "Editar Responsável" : "Novo Responsável Técnico"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Tipo</Label>
              <Select value={respForm.tipo} onValueChange={(v) => setRespForm({ ...respForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="engenheiro">Engenheiro de Segurança</SelectItem>
                  <SelectItem value="medico">Médico do Trabalho</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={respForm.nome} onChange={(e) => setRespForm({ ...respForm, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CPF do Responsável</Label>
                <Input value={respForm.cpf_responsavel} onChange={(e) => setRespForm({ ...respForm, cpf_responsavel: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div>
                <Label>Registro Conselho</Label>
                <Input value={respForm.registro_conselho} onChange={(e) => setRespForm({ ...respForm, registro_conselho: e.target.value })} placeholder="Ex: CREA 14552-D" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Período Início</Label>
                <Input type="date" value={respForm.periodo_inicio} onChange={(e) => setRespForm({ ...respForm, periodo_inicio: e.target.value })} />
              </div>
              <div>
                <Label>Período Fim</Label>
                <Input type="date" value={respForm.periodo_fim} onChange={(e) => setRespForm({ ...respForm, periodo_fim: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveResp}>{editingResp ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DIALOG GERAR PPP === */}
      <Dialog open={pppOpen} onOpenChange={setPppOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar PPP de Desligamento</DialogTitle>
            <DialogDescription>
              Selecione o funcionário. O sistema preencherá o PPP automaticamente com os riscos configurados para o cargo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Funcionário</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nome..."
                  className="pl-8"
                  value={(() => {
                    const sel = funcionarios.find(f => f.id === selectedFuncId);
                    return sel ? sel.nome : pppSearchName;
                  })()}
                  onChange={(e) => {
                    setPppSearchName(e.target.value);
                    setSelectedFuncId("");
                  }}
                />
              </div>
              {pppSearchName.length >= 2 && !selectedFuncId && (
                <div className="border rounded-md mt-1 max-h-48 overflow-y-auto bg-background shadow-md">
                  {funcionarios
                    .filter(f => f.nome.toLowerCase().includes(pppSearchName.toLowerCase()))
                    .map(f => (
                      <button
                        key={f.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          setSelectedFuncId(f.id);
                          setPppSearchName("");
                        }}
                      >
                        <span className="font-medium">{f.nome}</span>
                        {f.cargo && <span className="text-muted-foreground ml-2">— {f.cargo}</span>}
                      </button>
                    ))}
                  {funcionarios.filter(f => f.nome.toLowerCase().includes(pppSearchName.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum funcionário encontrado</div>
                  )}
                </div>
              )}
            </div>
            {selectedFuncId && (() => {
              const func = funcionarios.find((f) => f.id === selectedFuncId);
              if (!func) return null;
              const cargoRiscos = riscos.filter((r) => r.cargo.toLowerCase() === (func.cargo || "").toLowerCase());
              const riscosPrevidenciarios = cargoRiscos.filter((r) => RISCOS_PREVIDENCIARIOS.includes(r.tipo_risco));
              const hasAusencia = cargoRiscos.some((r) => r.fator_risco === AUSENCIA_FATOR);
              const temRiscoPrevidenciario = riscosPrevidenciarios.length > 0 && !hasAusencia;
              const profissiografia = cargoRiscos.find((r) => r.profissiografia)?.profissiografia;
              const eng = responsaveis.find((r) => r.tipo === "engenheiro");
              const med = responsaveis.find((r) => r.tipo === "medico");

              // Pendencies checklist
              const pendencias: { label: string; ok: boolean }[] = [
                { label: "CPF do funcionário", ok: !!func.cpf },
                { label: "Cargo definido", ok: !!func.cargo },
                { label: "Data de admissão", ok: !!func.data_admissao },
                { label: "Matrícula / eSocial", ok: !!func.matricula },
                { label: "Profissiografia (Descrição das Atividades)", ok: !!profissiografia },
                { label: "Engenheiro de Segurança cadastrado", ok: !!eng },
                { label: "CPF do Engenheiro", ok: !!(eng?.nit) },
                { label: "Registro Conselho do Engenheiro", ok: !!(eng?.registro_conselho) },
                { label: "Médico do Trabalho cadastrado", ok: !!med },
                { label: "CPF do Médico", ok: !!(med?.nit) },
                { label: "Representante Legal da empresa", ok: !!(empresa?.cpf_representante_legal) },
                { label: "CNPJ da empresa", ok: !!(empresa?.cnpj) },
              ];
              const pendenciasCount = pendencias.filter(p => !p.ok).length;

              return (
                <div className="space-y-3">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-muted-foreground">Cargo:</span> <strong>{func.cargo || "—"}</strong></div>
                        <div><span className="text-muted-foreground">CPF:</span> <strong>{func.cpf || "—"}</strong></div>
                        <div><span className="text-muted-foreground">Admissão:</span> <strong>{func.data_admissao || "—"}</strong></div>
                        <div><span className="text-muted-foreground">Demissão:</span> <strong>{func.data_demissao || "—"}</strong></div>
                        <div><span className="text-muted-foreground">Matrícula:</span> <strong>{func.matricula || "N/A"}</strong></div>
                        <div><span className="text-muted-foreground">Regime:</span> <strong>{func.regime_revezamento || "NA"}</strong></div>
                      </div>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {temRiscoPrevidenciario ? (
                          <Badge variant="destructive" className="gap-1">
                            🔴 {riscosPrevidenciarios.length} Risco(s) Previdenciário(s)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-green-500 text-green-700">
                            🟢 Sem Riscos — 09.01.001
                          </Badge>
                        )}
                        {cargoRiscos.length === 0 && (
                          <span className="text-xs text-muted-foreground">Nenhum registro — será gerado com Ausência automática</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pendencies Checklist */}
                  <Card className={pendenciasCount > 0 ? "border-yellow-500/50" : "border-green-500/50"}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        {pendenciasCount > 0 ? (
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                        <span className="text-sm font-medium">
                          {pendenciasCount > 0
                            ? `${pendenciasCount} pendência(s) encontrada(s)`
                            : "Todos os campos preenchidos"}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {pendencias.map((p, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            {p.ok ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                            )}
                            <span className={p.ok ? "text-muted-foreground" : "text-foreground font-medium"}>{p.label}</span>
                          </div>
                        ))}
                      </div>
                      {pendenciasCount > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-2">
                          O PDF será gerado com "N/A" nos campos pendentes. Preencha-os para um PPP completo.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button onClick={gerarPPP} disabled={!selectedFuncId} className="gap-2">
              <Download className="w-4 h-4" />
              Gerar e Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

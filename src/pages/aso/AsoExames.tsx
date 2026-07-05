import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, Stethoscope, AlertTriangle, CheckCircle, Clock, Download, TrendingUp, LayoutGrid, List, UserPlus, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isOnline, addToSyncQueue, getCachedData, setCachedData } from "@/lib/offlineStorage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, format, parseISO, addMonths } from "date-fns";
import * as XLSX from "xlsx-js-style";

interface Exame {
  id: string;
  funcionario_id: string;
  tipo: string;
  nome_exame: string | null;
  data: string | null;
  data_vencimento: string | null;
  resultado: string;
  medico: string | null;
  observacao: string | null;
  empresa_id: string | null;
  created_by: string | null;
}

interface Funcionario {
  id: string;
  nome: string;
  cargo: string | null;
  cpf: string | null;
  matricula: string | null;
  setor: string | null;
  data_demissao: string | null;
}

type StatusFilter = "todos" | "vencido" | "atencao" | "vigente" | "pendente" | "sem_exame";

const TIPOS_EXAME = [
  { key: "admissional", label: "Admissional", validade_meses: 0 },
  { key: "periodico", label: "Periódico", validade_meses: 12 },
  { key: "demissional", label: "Demissional", validade_meses: 0 },
  { key: "retorno", label: "Retorno ao Trabalho", validade_meses: 0 },
  { key: "mudanca_funcao", label: "Mudança de Função", validade_meses: 0 },
];

const NOMES_EXAME = [
  { code: "0295", label: "ASO - Avaliação Clínica Ocupacional" },
  { code: "0296", label: "Acuidade Visual" },
  { code: "0281", label: "Audiometria Tonal Ocupacional" },
  { code: "0300", label: "Avaliação Psicossocial" },
  { code: "0530", label: "ECG - Eletrocardiograma" },
  { code: "0536", label: "EEG - Eletroencefalograma" },
  { code: "0658", label: "Glicemia" },
  { code: "0693", label: "Hemograma Completo" },
  { code: "1057", label: "Espirometria (Prova de Função Pulmonar)" },
  { code: "0078", label: "Raio-X de Tórax (PA)" },
  { code: "0545", label: "EAS - Exame de Urina (Elementos Anormais)" },
  { code: "0680", label: "Gama GT" },
  { code: "0860", label: "Lipidograma" },
  { code: "0855", label: "TGO (AST)" },
  { code: "0856", label: "TGP (ALT)" },
  { code: "0870", label: "Creatinina" },
  { code: "0875", label: "Ureia" },
  { code: "0640", label: "Toxicológico" },
  { code: "0000", label: "Outro" },
];

const tipoLabels: Record<string, string> = {};
TIPOS_EXAME.forEach(t => { tipoLabels[t.key] = t.label; });

const tipoValidade: Record<string, number> = {};
TIPOS_EXAME.forEach(t => { tipoValidade[t.key] = t.validade_meses; });

const resultadoLabels: Record<string, string> = {
  apto: "Apto",
  inapto: "Inapto",
  apto_com_restricao: "Apto c/ Restrição",
  pendente: "Pendente",
};

function getStatus(dataVencimento: string | null): { label: string; variant: "destructive" | "outline" | "default"; key: string } {
  if (!dataVencimento) return { label: "Sem vencimento", variant: "outline", key: "vigente" };
  const hoje = new Date();
  const venc = parseISO(dataVencimento);
  const dias = differenceInDays(venc, hoje);
  if (dias < 0) return { label: "🔴 Vencido", variant: "destructive", key: "vencido" };
  if (dias <= 60) return { label: "🟡 Atenção", variant: "outline", key: "atencao" };
  return { label: "🟢 Vigente", variant: "default", key: "vigente" };
}

function statusOrder(dataVencimento: string | null): number {
  const s = getStatus(dataVencimento);
  if (s.key === "vencido") return 0;
  if (s.key === "atencao") return 1;
  return 2;
}

function calcularVencimento(tipo: string, dataExame: string, mesesCustom?: number): string {
  const meses = mesesCustom !== undefined ? mesesCustom : (tipoValidade[tipo] || 0);
  if (!meses || meses === 0 || !dataExame) return "";
  const data = parseISO(dataExame);
  return format(addMonths(data, meses), "yyyy-MM-dd");
}

function formatDateSafe(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "dd/MM/yyyy");
}

interface Medico {
  id: string;
  nome: string;
  crm: string | null;
  especialidade: string | null;
}

export default function AsoExames() {
  const { empresaId } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Exame[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [catalogo, setCatalogo] = useState<{ nome: string; periodicidade_meses: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exame | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [setorFilter, setSetorFilter] = useState("");
  const [form, setForm] = useState({
    funcionario_id: "",
    tipo: "periodico",
    nome_exame: "",
    data: new Date().toISOString().split("T")[0],
    data_vencimento: "",
    resultado: "pendente",
    medico: "",
    observacao: "",
  });
  const [funcSearch, setFuncSearch] = useState("");
  const [funcFocused, setFuncFocused] = useState(false);
  const [medicoSearch, setMedicoSearch] = useState("");
  const [showAddMedico, setShowAddMedico] = useState(false);
  const [novoMedico, setNovoMedico] = useState({ nome: "", crm: "", especialidade: "" });

  const { empresaScopeIds } = useAuth() as any;

  const fetchData = async () => {
    setLoading(true);
    // Sem empresa ativa → não carrega nada (evita mostrar dados de outra empresa
    // enquanto o contexto ainda não resolveu). Também impede Super Admin ver
    // um mash-up global quando nenhuma empresa está selecionada.
    if (!empresaId) {
      setItems([]); setFuncionarios([]); setMedicos([]);
      setLoading(false);
      return;
    }
    if (!isOnline()) {
      setItems(getCachedData<Exame>("exames") || []);
      setFuncionarios(getCachedData<Funcionario>("funcionarios") || []);
      setMedicos(getCachedData<Medico>("medicos") || []);
      setLoading(false);
      return;
    }
    try {
      const scope: string[] = (empresaScopeIds && empresaScopeIds.length > 0)
        ? empresaScopeIds
        : [empresaId];
      const [{ data: exames }, { data: funcs }, { data: meds }, { data: cat }] = await Promise.all([
        supabase.from("exames").select("*").in("empresa_id", scope).order("data_vencimento", { ascending: true, nullsFirst: false }),
        supabase.from("funcionarios").select("id, nome, cargo, cpf, matricula, setor, data_demissao, empresa_id").in("empresa_id", scope),
        supabase.from("medicos").select("id, nome, crm, especialidade, empresa_id").in("empresa_id", scope),
        supabase.from("aso_exames_catalogo").select("nome, periodicidade_meses").eq("ativo", true).or(`empresa_id.in.(${scope.join(",")}),empresa_id.is.null`),
      ]);
      if (exames) { setItems(exames); setCachedData("exames", exames); }
      if (funcs) { setFuncionarios(funcs); setCachedData("funcionarios", funcs); }
      if (meds) { setMedicos(meds); setCachedData("medicos", meds); }
      if (cat) setCatalogo(cat);
    } catch {
      setItems(getCachedData<Exame>("exames") || []);
      setFuncionarios(getCachedData<Funcionario>("funcionarios") || []);
      setMedicos(getCachedData<Medico>("medicos") || []);
    }
    setLoading(false);
  };

  // Refetch quando a empresa ativa mudar (troca de empresa pelo header).
  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [empresaId, (empresaScopeIds || []).join(",")]);

  const funcMap = useMemo(() => {
    const m: Record<string, Funcionario> = {};
    funcionarios.forEach(f => { m[f.id] = f; });
    return m;
  }, [funcionarios]);

  const normalize = useCallback((s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), []);

  const filteredFuncionarios = useMemo(() => {
    const searchTerm = funcSearch?.trim() || "";
    if (!searchTerm) return funcionarios.slice(0, 50);
    const q = normalize(searchTerm);
    return funcionarios.filter(f => {
      const nome = normalize(f.nome || "");
      const matricula = (f.matricula || "").toLowerCase();
      const cpf = (f.cpf || "").replace(/\D/g, "");
      const qClean = q.replace(/\D/g, "");
      return nome.includes(q) || matricula.includes(q) || (qClean && cpf.includes(qClean));
    });
  }, [funcionarios, funcSearch, normalize]);

  const filteredMedicos = useMemo(() => {
    if (!medicoSearch.trim()) return medicos;
    const q = normalize(medicoSearch);
    return medicos.filter(m =>
      normalize(m.nome).includes(q) ||
      (m.crm && m.crm.toLowerCase().includes(q))
    );
  }, [medicos, medicoSearch]);

  const setoresUnicos = useMemo(() => {
    const s = new Set<string>();
    funcionarios.forEach(f => { if (f.setor) s.add(f.setor); });
    return [...s].sort();
  }, [funcionarios]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (setorFilter) {
      const funcIdsInSetor = new Set(funcionarios.filter(f => f.setor === setorFilter).map(f => f.id));
      list = list.filter(e => funcIdsInSetor.has(e.funcionario_id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => {
        const func = funcMap[e.funcionario_id];
        return (func?.nome || "").toLowerCase().includes(q) || (tipoLabels[e.tipo] || e.tipo).toLowerCase().includes(q);
      });
    }
    if (statusFilter === "pendente") {
      list = list.filter(e => e.resultado === "pendente");
    } else if (statusFilter !== "todos") {
      list = list.filter(e => getStatus(e.data_vencimento).key === statusFilter);
    }
    list.sort((a, b) => statusOrder(a.data_vencimento) - statusOrder(b.data_vencimento));
    return list;
  }, [items, search, statusFilter, funcMap, setorFilter, funcionarios]);

  const openNew = () => {
    setEditing(null);
    setForm({ funcionario_id: "", tipo: "periodico", nome_exame: "", data: new Date().toISOString().split("T")[0], data_vencimento: calcularVencimento("periodico", new Date().toISOString().split("T")[0]), resultado: "pendente", medico: "", observacao: "" });
    setFuncSearch("");
    setMedicoSearch("");
    setShowAddMedico(false);
    setOpen(true);
  };

  const openEdit = (e: Exame) => {
    setEditing(e);
    setForm({
      funcionario_id: e.funcionario_id,
      tipo: e.tipo,
      nome_exame: e.nome_exame || "",
      data: e.data || "",
      data_vencimento: e.data_vencimento || "",
      resultado: e.resultado,
      medico: e.medico || "",
      observacao: e.observacao || "",
    });
    setFuncSearch(funcMap[e.funcionario_id]?.nome || "");
    setMedicoSearch(e.medico || "");
    setShowAddMedico(false);
    setOpen(true);
  };

  const handleAddMedico = async () => {
    if (!novoMedico.nome.trim()) {
      toast({ title: "Informe o nome do médico", variant: "destructive" });
      return;
    }
    const medicoPayload = {
      nome: novoMedico.nome.trim(),
      crm: novoMedico.crm.trim() || null,
      especialidade: novoMedico.especialidade.trim() || null,
      empresa_id: empresaId,
    };

    if (!isOnline()) {
      const tempId = crypto.randomUUID();
      const newMedico = { ...medicoPayload, id: tempId } as Medico;
      addToSyncQueue({ table: "medicos", type: "insert", payload: newMedico });
      const cached = getCachedData<Medico>("medicos") || [];
      cached.push(newMedico);
      setCachedData("medicos", cached);
      setMedicos(prev => [...prev, newMedico]);
      setForm(f => ({ ...f, medico: newMedico.nome + (newMedico.crm ? ` - CRM: ${newMedico.crm}` : "") }));
      setMedicoSearch(newMedico.nome + (newMedico.crm ? ` - CRM: ${newMedico.crm}` : ""));
      setNovoMedico({ nome: "", crm: "", especialidade: "" });
      setShowAddMedico(false);
      toast({ title: "Médico salvo offline" });
      return;
    }

    const { data, error } = await (supabase.from("medicos") as any).insert([medicoPayload]).select().single();
    if (error) {
      toast({ title: "Erro ao adicionar médico", description: error.message, variant: "destructive" });
      return;
    }
    setMedicos(prev => [...prev, data]);
    setForm(f => ({ ...f, medico: data.nome + (data.crm ? ` - CRM: ${data.crm}` : "") }));
    setMedicoSearch(data.nome + (data.crm ? ` - CRM: ${data.crm}` : ""));
    setNovoMedico({ nome: "", crm: "", especialidade: "" });
    setShowAddMedico(false);
    toast({ title: "Médico adicionado!" });
  };

  const handleSave = async () => {
    if (!form.funcionario_id) {
      toast({ title: "Selecione um funcionário", variant: "destructive" });
      return;
    }
    const isPendente = form.resultado === "pendente";
    const payload = {
      funcionario_id: form.funcionario_id,
      tipo: form.tipo as "admissional" | "periodico" | "demissional" | "retorno" | "mudanca_funcao",
      nome_exame: form.nome_exame || null,
      data: isPendente ? (form.data || null) : (form.data || new Date().toISOString().split("T")[0]),
      data_vencimento: isPendente ? null : (form.data_vencimento || null),
      resultado: form.resultado as "apto" | "inapto" | "apto_com_restricao" | "pendente",
      medico: isPendente ? null : (form.medico || null),
      observacao: form.observacao || null,
      empresa_id: empresaId,
    };

    if (!isOnline()) {
      if (editing) {
        addToSyncQueue({ table: "exames", type: "update", payload: { id: editing.id, ...payload } });
        const cached = getCachedData<Exame>("exames") || [];
        setCachedData("exames", cached.map(c => c.id === editing.id ? { ...c, ...payload } : c));
        toast({ title: "Atualizado offline", description: "Será sincronizado quando houver conexão." });
      } else {
        const tempId = crypto.randomUUID();
        const newItem = { ...payload, id: tempId, created_by: null };
        addToSyncQueue({ table: "exames", type: "insert", payload: newItem });
        const cached = getCachedData<Exame>("exames") || [];
        cached.unshift(newItem as Exame);
        setCachedData("exames", cached);
        toast({ title: "Salvo offline", description: "Será sincronizado quando houver conexão." });
      }
      setOpen(false);
      fetchData();
      return;
    }

    if (editing) {
      const { error } = await supabase.from("exames").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Exame atualizado com sucesso!" });
    } else {
      const { error } = await supabase.from("exames").insert([payload]);
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Exame cadastrado com sucesso!" });
    }
    setOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!isOnline()) {
      addToSyncQueue({ table: "exames", type: "delete", payload: { id } });
      const cached = getCachedData<Exame>("exames") || [];
      setCachedData("exames", cached.filter(c => c.id !== id));
      toast({ title: "Excluído offline", description: "Será sincronizado quando houver conexão." });
      fetchData();
      return;
    }
    const { error } = await supabase.from("exames").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Exame excluído" });
    fetchData();
  };

  // Export Excel (uses filtered data)
  const handleExportExcel = async () => {
    let empresaNome = "", empresaCnpj = "", empresaEndereco = "", empresaTelefone = "", empresaEmail = "";
    if (empresaId) {
      let empData: any[] | null = null;
      if (isOnline()) {
        const res = await supabase.from("empresa_config").select("*").eq("id", empresaId).limit(1);
        empData = res.data;
      } else {
        const cached = getCachedData<any>("empresa_config");
        empData = cached ? cached.filter((c: any) => c.id === empresaId) : null;
      }
      if (empData && empData.length > 0) {
        const emp = empData[0];
        empresaNome = emp.nome || "";
        empresaCnpj = emp.cnpj || "";
        empresaEndereco = emp.endereco || "";
        empresaTelefone = emp.telefone || "";
        empresaEmail = emp.email || "";
      }
    }

    const exportItems = filtered;
    const nomesUsados = Array.from(new Set(exportItems.map(e => e.nome_exame || tipoLabels[e.tipo] || e.tipo))).sort();
    const funcIds = Array.from(new Set(exportItems.map(e => e.funcionario_id)));
    const fixedCols = 5; // Nº, COLABORADOR, CPF, FUNÇÃO, SETOR
    const totalCols = fixedCols + nomesUsados.length * 3;

    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];
    const HEADER_OFFSET = 5;

    wsData.push([empresaNome || ""]);
    wsData.push([empresaCnpj ? `CNPJ: ${empresaCnpj}` : ""]);
    wsData.push([empresaEndereco || ""]);
    wsData.push([[empresaTelefone, empresaEmail].filter(Boolean).join(" | ") || ""]);
    wsData.push([""]);

    const header1: any[] = ["Nº", "COLABORADOR", "CPF", "FUNÇÃO", "SETOR"];
    nomesUsados.forEach(n => { header1.push(n, "", ""); });
    wsData.push(header1);

    const header2: any[] = ["", "", "", "", ""];
    nomesUsados.forEach(() => { header2.push("DATA EXAME", "VENCIMENTO", "STATUS"); });
    wsData.push(header2);

    funcIds.forEach((fid, idx) => {
      const func = funcMap[fid];
      if (!func) return;
      const exames = exportItems.filter(e => e.funcionario_id === fid);
      const row: any[] = [idx + 1, func.nome, func.cpf || "—", func.cargo || "—", func.setor || "—"];
      nomesUsados.forEach(nome => {
        const e = exames.find(ex => (ex.nome_exame || tipoLabels[ex.tipo] || ex.tipo) === nome);
        if (!e) {
          row.push("—", "—", "—");
        } else {
          const s = getStatus(e.data_vencimento);
          row.push(
            e.data ? format(parseISO(e.data), "dd/MM/yyyy") : "—",
            e.data_vencimento ? format(parseISO(e.data_vencimento), "dd/MM/yyyy") : "—",
            e.resultado === "pendente" ? "Pendente" : s.key === "vencido" ? "Vencido" : s.key === "atencao" ? "Atenção" : "Válido"
          );
        }
      });
      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const merges: XLSX.Range[] = [];
    for (let r = 0; r < HEADER_OFFSET; r++) {
      merges.push({ s: { r, c: 0 }, e: { r, c: Math.max(totalCols - 1, fixedCols - 1) } });
    }
    nomesUsados.forEach((_, i) => {
      const startCol = fixedCols + i * 3;
      merges.push({ s: { r: HEADER_OFFSET, c: startCol }, e: { r: HEADER_OFFSET, c: startCol + 2 } });
    });
    for (let c = 0; c < fixedCols; c++) {
      merges.push({ s: { r: HEADER_OFFSET, c }, e: { r: HEADER_OFFSET + 1, c } });
    }
    ws["!merges"] = merges;

    const colWidths: { wch: number }[] = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 16 }];
    nomesUsados.forEach(() => { colWidths.push({ wch: 14 }, { wch: 14 }, { wch: 12 }); });
    ws["!cols"] = colWidths;

    ws["!rows"] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 18 }, { hpt: 18 }, { hpt: 10 }];

    const headerFill = { fgColor: { rgb: "1a365d" } };
    const headerFont = { bold: true, color: { rgb: "FFFFFF" }, name: "Arial", sz: 10 };
    const subHeaderFill = { fgColor: { rgb: "2d4a7a" } };
    const border = {
      top: { style: "thin", color: { rgb: "CCCCCC" } },
      bottom: { style: "thin", color: { rgb: "CCCCCC" } },
      left: { style: "thin", color: { rgb: "CCCCCC" } },
      right: { style: "thin", color: { rgb: "CCCCCC" } },
    };
    const centerAlign = { horizontal: "center", vertical: "center", wrapText: true };
    const leftAlign = { vertical: "center", wrapText: true };
    const totalRows = wsData.length;

    for (let R = 0; R < totalRows; R++) {
      for (let C = 0; C < totalCols; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        const cell = ws[addr];
        if (!cell.s) cell.s = {};

        if (R < HEADER_OFFSET) {
          if (R === 0) {
            cell.s.font = { name: "Arial", sz: 14, bold: true, color: { rgb: "1a365d" } };
            cell.s.alignment = { horizontal: "center", vertical: "center" };
          } else if (R < 4) {
            cell.s.font = { name: "Arial", sz: 10, color: { rgb: "444444" } };
            cell.s.alignment = { horizontal: "center", vertical: "center" };
          }
          continue;
        }

        cell.s.border = border;
        cell.s.font = { name: "Arial", sz: 9 };

        if (R === HEADER_OFFSET) {
          cell.s.fill = headerFill;
          cell.s.font = headerFont;
          cell.s.alignment = centerAlign;
        } else if (R === HEADER_OFFSET + 1) {
          cell.s.fill = subHeaderFill;
          cell.s.font = { ...headerFont, sz: 9 };
          cell.s.alignment = centerAlign;
        } else {
          cell.s.alignment = C <= 1 ? leftAlign : centerAlign;
          if (R % 2 === 0) {
            cell.s.fill = { fgColor: { rgb: "F8F9FA" } };
          }
          if (C >= fixedCols && (C - fixedCols) % 3 === 2) {
            const val = String(cell.v || "");
            if (val === "Vencido") {
              cell.s.fill = { fgColor: { rgb: "DC2626" } };
              cell.s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "FFFFFF" } };
            } else if (val === "Atenção") {
              cell.s.fill = { fgColor: { rgb: "F59E0B" } };
              cell.s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "FFFFFF" } };
            } else if (val === "Pendente") {
              cell.s.fill = { fgColor: { rgb: "FACC15" } };
              cell.s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "000000" } };
            } else if (val === "Válido") {
              cell.s.fill = { fgColor: { rgb: "16A34A" } };
              cell.s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "FFFFFF" } };
            }
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Matriz Exames");
    XLSX.writeFile(wb, `Matriz_Exames_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Exportado com sucesso!", description: "Matriz exportada com cores e formatação." });
  };

  // Only count active employees (not demitidos)
  const funcionariosAtivos = useMemo(() => funcionarios.filter(f => !f.data_demissao), [funcionarios]);

  const totalItems = items.length;
  const pendentesCount = items.filter(e => e.resultado === "pendente").length;
  const vencidosCount = items.filter(e => getStatus(e.data_vencimento).key === "vencido").length;
  const atencaoCount = items.filter(e => getStatus(e.data_vencimento).key === "atencao").length;
  const vigentesCount = items.filter(e => getStatus(e.data_vencimento).key === "vigente").length;
  const conformidade = totalItems > 0 ? Math.round((vigentesCount / totalItems) * 100) : 100;

  // Funcionários ativos sem nenhum exame cadastrado (exclui demitidos)
  const funcionariosSemExame = useMemo(() => {
    const idsComExame = new Set(items.map(e => e.funcionario_id));
    return funcionariosAtivos.filter(f => !idsComExame.has(f.id));
  }, [items, funcionariosAtivos]);
  const semExameCount = funcionariosSemExame.length;

  // Matrix data: group by employee, nome_exame as columns
  const matrixData = useMemo(() => {
    const nomesUsados = Array.from(new Set(items.map(e => e.nome_exame || tipoLabels[e.tipo] || e.tipo))).sort();
    const funcIds = Array.from(new Set(items.map(e => e.funcionario_id)));
    const rows = funcIds.map(fid => {
      const func = funcMap[fid];
      if (!func) return null;
      const exames = items.filter(e => e.funcionario_id === fid);
      const tipoData: Record<string, { data: string | null; vencimento: string | null; resultado: string; status: ReturnType<typeof getStatus> }> = {};
      nomesUsados.forEach(nome => {
        // Get most recent exam with this nome_exame
        const sorted = exames
          .filter(e => (e.nome_exame || tipoLabels[e.tipo] || e.tipo) === nome)
          .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
        if (sorted.length > 0) {
          const e = sorted[0];
          tipoData[nome] = { data: e.data, vencimento: e.data_vencimento, resultado: e.resultado, status: getStatus(e.data_vencimento) };
        }
      });
      return { func, tipoData };
    }).filter(Boolean) as { func: Funcionario; tipoData: Record<string, { data: string | null; vencimento: string | null; resultado: string; status: ReturnType<typeof getStatus> }> }[];

    return { tipos: nomesUsados, rows };
  }, [items, funcMap]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exames"
        subtitle="Controle de ASOs, exames ocupacionais, vencimentos e renovações."
        actions={
          <>
            <Button variant="outline" size="sm" className="hidden md:flex border-primary/30 hover:bg-primary/10" onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-2" />Exportar
            </Button>
            <Button size="sm" onClick={openNew} className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />Novo Exame
            </Button>
          </>
        }
      />

      {/* Indicadores */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        {/* Conformidade */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                  strokeDasharray={`${conformidade * 2.136} 213.6`}
                  strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary">{conformidade}%</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Conformidade</p>
          </CardContent>
        </Card>

        {/* Total */}
        <Card className="group hover:shadow-md transition-all cursor-pointer" onClick={() => setStatusFilter("todos")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-2xl font-bold text-foreground">{totalItems}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Total de Exames</p>
            <Progress value={100} className="mt-2 h-1" />
          </CardContent>
        </Card>

        {/* Vencidos */}
        <Card className="group hover:shadow-md transition-all cursor-pointer hover:border-destructive/30"
          onClick={() => setStatusFilter(statusFilter === "vencido" ? "todos" : "vencido")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-2xl font-bold text-destructive">{vencidosCount}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Vencidos</p>
            <Progress value={totalItems > 0 ? (vencidosCount / totalItems) * 100 : 0} className="mt-2 h-1 [&>div]:bg-destructive" />
          </CardContent>
        </Card>

        {/* A Vencer */}
        <Card className="group hover:shadow-md transition-all cursor-pointer hover:border-warning/30"
          onClick={() => setStatusFilter(statusFilter === "atencao" ? "todos" : "atencao")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <Clock className="w-4 h-4 text-warning" />
              <span className="text-2xl font-bold text-warning">{atencaoCount}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">A Vencer</p>
            <Progress value={totalItems > 0 ? (atencaoCount / totalItems) * 100 : 0} className="mt-2 h-1 [&>div]:bg-warning" />
          </CardContent>
        </Card>

        {/* Pendentes */}
        <Card className="group hover:shadow-md transition-all cursor-pointer hover:border-primary/30"
          onClick={() => setStatusFilter(statusFilter === "pendente" ? "todos" : "pendente")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-2xl font-bold text-primary">{pendentesCount}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Pendentes</p>
            <Progress value={totalItems > 0 ? (pendentesCount / totalItems) * 100 : 0} className="mt-2 h-1" />
          </CardContent>
        </Card>

        {/* Sem Exame */}
        <Card className="group hover:shadow-md transition-all cursor-pointer hover:border-destructive/30"
          onClick={() => setStatusFilter(statusFilter === "sem_exame" ? "todos" : "sem_exame")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <UserX className="w-4 h-4 text-destructive" />
              <span className="text-2xl font-bold text-destructive">{semExameCount}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Sem Exame</p>
            <Progress value={funcionariosAtivos.length > 0 ? (semExameCount / funcionariosAtivos.length) * 100 : 0} className="mt-2 h-1 [&>div]:bg-destructive" />
          </CardContent>
        </Card>

        {/* Vigentes */}
        <Card className="group hover:shadow-md transition-all cursor-pointer hover:border-success/30"
          onClick={() => setStatusFilter(statusFilter === "vigente" ? "todos" : "vigente")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-2xl font-bold text-success">{vigentesCount}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Vigentes</p>
            <Progress value={totalItems > 0 ? (vigentesCount / totalItems) * 100 : 0} className="mt-2 h-1 [&>div]:bg-success" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome ou tipo de exame..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {setoresUnicos.length > 0 && (
          <Select value={setorFilter || "all"} onValueChange={v => setSetorFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Filtrar por setor..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {setoresUnicos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Ver todos</SelectItem>
            <SelectItem value="vencido">🔴 Vencidos</SelectItem>
            <SelectItem value="atencao">🟡 A vencer</SelectItem>
            <SelectItem value="vigente">🟢 Vigentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="lista" className="gap-1.5"><List className="w-4 h-4" />Lista</TabsTrigger>
          <TabsTrigger value="matriz" className="gap-1.5"><LayoutGrid className="w-4 h-4" />Matriz</TabsTrigger>
          <TabsTrigger value="sem_exame" className="gap-1.5"><UserX className="w-4 h-4" />Sem Exame {semExameCount > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{semExameCount}</Badge>}</TabsTrigger>
        </TabsList>

        {/* === ABA LISTA === */}
        <TabsContent value="lista">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-3"><ListSkeleton rows={5} /></div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden p-3 space-y-3">
                    {filtered.length === 0 ? (
                      <EmptyState
                        bare
                        icon={Stethoscope}
                        title={search || statusFilter !== "todos" || setorFilter ? "Nenhum resultado encontrado" : "Nenhum exame registrado"}
                        description={search || statusFilter !== "todos" || setorFilter
                          ? "Ajuste os filtros ou a busca para ver mais resultados."
                          : "Cadastre o primeiro exame ocupacional para acompanhar vencimentos e renovações."}
                        action={!(search || statusFilter !== "todos" || setorFilter) ? (
                          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo Exame</Button>
                        ) : undefined}
                      />
                    ) : filtered.map((e, index) => {
                      const func = funcMap[e.funcionario_id];
                      const status = getStatus(e.data_vencimento);
                      const tone: StatusTone =
                        e.resultado === "pendente" ? "pending" :
                        status.key === "vencido" ? "danger" :
                        status.key === "atencao" ? "warning" :
                        "success";
                      const toneLabel =
                        e.resultado === "pendente" ? "Pendente" :
                        status.key === "vencido" ? "Vencido" :
                        status.key === "atencao" ? "A vencer" :
                        "Vigente";
                      return (
                        <Card key={e.id} className="border">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs text-muted-foreground">#{index + 1}</div>
                                <div className="font-semibold text-sm truncate">{func?.nome || "—"}</div>
                                <div className="text-xs text-muted-foreground truncate">{func?.cargo || "—"} · {func?.setor || "—"}</div>
                              </div>
                              <StatusBadge tone={tone}>{toneLabel}</StatusBadge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t">
                              <div>
                                <div className="text-[10px] uppercase text-muted-foreground">Tipo</div>
                                <div className="font-medium">{tipoLabels[e.tipo] || e.tipo}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase text-muted-foreground">Resultado</div>
                                <div className="font-medium">{resultadoLabels[e.resultado] || e.resultado}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase text-muted-foreground">Data</div>
                                <div className="font-mono">{formatDateSafe(e.data)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase text-muted-foreground">Vencimento</div>
                                <div className="font-mono">{formatDateSafe(e.data_vencimento)}</div>
                              </div>
                              {e.nome_exame && (
                                <div className="col-span-2">
                                  <div className="text-[10px] uppercase text-muted-foreground">Exame</div>
                                  <div className="font-medium">{e.nome_exame}</div>
                                </div>
                              )}
                              {e.medico && (
                                <div className="col-span-2">
                                  <div className="text-[10px] uppercase text-muted-foreground">Médico</div>
                                  <div className="truncate">{e.medico}</div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 pt-2 border-t">
                              <Button size="sm" variant="outline" className="flex-1 h-11" onClick={() => openEdit(e)} aria-label="Editar exame">
                                <Pencil className="w-4 h-4 mr-1" /> Editar
                              </Button>
                              <Button size="sm" variant="outline" className="h-11 w-11 p-0" onClick={() => handleDelete(e.id)} aria-label="Excluir exame">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">Nº</TableHead>
                          <TableHead>Nome Completo</TableHead>
                          <TableHead>Função</TableHead>
                          <TableHead>Setor</TableHead>
                          <TableHead>Exame</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Data Exame</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Resultado</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Médico</TableHead>
                          <TableHead className="w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.length === 0 ? (
                          <TableRow><TableCell colSpan={12} className="py-4">
                            <EmptyState
                              bare
                              icon={Stethoscope}
                              title={search || statusFilter !== "todos" || setorFilter ? "Nenhum resultado encontrado" : "Nenhum exame registrado"}
                              description={search || statusFilter !== "todos" || setorFilter
                                ? "Ajuste os filtros ou a busca para ver mais resultados."
                                : "Cadastre o primeiro exame ocupacional para acompanhar vencimentos e renovações."}
                              action={!(search || statusFilter !== "todos" || setorFilter) ? (
                                <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo Exame</Button>
                              ) : undefined}
                            />
                          </TableCell></TableRow>
                        ) : filtered.map((e, index) => {
                          const func = funcMap[e.funcionario_id];
                          const status = getStatus(e.data_vencimento);
                          return (
                            <TableRow key={e.id}>
                              <TableCell className="text-center font-medium text-muted-foreground">{index + 1}</TableCell>
                              <TableCell className="font-medium">{func?.nome || "—"}</TableCell>
                              <TableCell>{func?.cargo || "—"}</TableCell>
                              <TableCell className="text-muted-foreground">{func?.setor || "—"}</TableCell>
                              <TableCell className="text-xs font-medium">{e.nome_exame || "—"}</TableCell>
                              <TableCell><Badge variant="secondary">{tipoLabels[e.tipo] || e.tipo}</Badge></TableCell>
                              <TableCell className="font-mono text-xs">{formatDateSafe(e.data)}</TableCell>
                              <TableCell className="font-mono text-xs">{formatDateSafe(e.data_vencimento)}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  e.resultado === "apto" ? "default" :
                                  e.resultado === "inapto" ? "destructive" :
                                  e.resultado === "apto_com_restricao" ? "secondary" : "outline"
                                }>
                                  {resultadoLabels[e.resultado] || e.resultado}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const tone: StatusTone =
                                    e.resultado === "pendente" ? "pending" :
                                    status.key === "vencido" ? "danger" :
                                    status.key === "atencao" ? "warning" :
                                    "success";
                                  const label =
                                    e.resultado === "pendente" ? "Pendente" :
                                    status.key === "vencido" ? "Vencido" :
                                    status.key === "atencao" ? "A vencer" :
                                    "Vigente";
                                  return <StatusBadge tone={tone}>{label}</StatusBadge>;
                                })()}
                              </TableCell>
                              <TableCell className="text-xs">{e.medico || "—"}</TableCell>
                              <TableCell>
                                <div className="flex gap-1 justify-end">
                                  <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                                  <Button size="icon" variant="ghost" onClick={() => handleDelete(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ABA MATRIZ === */}
        <TabsContent value="matriz">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-3"><ListSkeleton rows={5} /></div>
              ) : matrixData.tipos.length === 0 ? (
                <EmptyState
                  bare
                  icon={Stethoscope}
                  title="Nenhum exame registrado"
                  description="Cadastre o primeiro exame ocupacional para acompanhar vencimentos e renovações."
                  action={<Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo Exame</Button>}
                />
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden p-3 space-y-3">
                    {matrixData.rows.map((row, idx) => {
                      const tiposComDados = matrixData.tipos.filter(t => row.tipoData[t]);
                      const vencidos = tiposComDados.filter(t => row.tipoData[t]!.status.key === "vencido").length;
                      const atencao = tiposComDados.filter(t => row.tipoData[t]!.status.key === "atencao").length;
                      const pendentes = tiposComDados.filter(t => row.tipoData[t]!.resultado === "pendente").length;
                      const geral = vencidos > 0 ? { l: "Vencido", cls: "bg-destructive/10 text-destructive border-destructive/30" }
                        : pendentes > 0 ? { l: "Pendente", cls: "bg-warning/10 text-warning border-warning/30" }
                        : atencao > 0 ? { l: "A vencer", cls: "bg-warning/10 text-warning border-warning/30" }
                        : { l: "Vigente", cls: "bg-success/10 text-success border-success/30" };
                      return (
                        <details key={row.func.id} className="border rounded-lg bg-card">
                          <summary className="p-3 cursor-pointer list-none flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-muted-foreground">#{idx + 1}</div>
                              <div className="font-semibold text-sm truncate">{row.func.nome}</div>
                              <div className="text-xs text-muted-foreground truncate">{row.func.cargo || "—"} · {row.func.setor || "—"}</div>
                              <div className="text-[11px] text-muted-foreground mt-1">
                                {tiposComDados.length}/{matrixData.tipos.length} exames
                                {vencidos > 0 && ` · ${vencidos} vencido(s)`}
                                {pendentes > 0 && ` · ${pendentes} pendente(s)`}
                              </div>
                            </div>
                            <Badge variant="outline" className={geral.cls}>{geral.l}</Badge>
                          </summary>
                          <div className="border-t p-3 space-y-2">
                            {matrixData.tipos.map(tipo => {
                              const td = row.tipoData[tipo];
                              const stCls = !td ? "bg-muted text-muted-foreground border-border"
                                : td.resultado === "pendente" ? "bg-warning/10 text-warning border-warning/30"
                                : td.status.key === "vencido" ? "bg-destructive/10 text-destructive border-destructive/30"
                                : td.status.key === "atencao" ? "bg-warning/10 text-warning border-warning/30"
                                : "bg-success/10 text-success border-success/30";
                              const stLabel = !td ? "Sem exame"
                                : td.resultado === "pendente" ? "Pendente"
                                : td.status.key === "vencido" ? "Vencido"
                                : td.status.key === "atencao" ? "Atenção" : "Válido";
                              return (
                                <div key={tipo} className="flex items-start justify-between gap-2 text-xs border-b last:border-0 pb-2 last:pb-0">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium truncate">{tipo}</div>
                                    {td && (
                                      <div className="text-[11px] text-muted-foreground font-mono">
                                        {formatDateSafe(td.data)} → {formatDateSafe(td.vencimento)}
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant="outline" className={stCls}>{stLabel}</Badge>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>

                  {/* Desktop matrix */}
                  <div className="hidden md:block overflow-auto max-h-[70vh]">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-primary text-primary-foreground">
                          <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold sticky left-0 bg-primary z-20 min-w-[40px]">Nº</th>
                          <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold sticky left-[40px] bg-primary z-20 min-w-[180px]">COLABORADOR</th>
                          <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold min-w-[100px]">CPF</th>
                          <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold min-w-[120px]">FUNÇÃO</th>
                          <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold min-w-[120px]">SETOR</th>
                          {matrixData.tipos.map(nome => (
                            <th key={nome} colSpan={3} className="border border-border/30 px-2 py-2 text-center font-bold min-w-[280px] bg-primary/90">
                              {nome}
                            </th>
                          ))}
                        </tr>
                        <tr className="bg-primary/80 text-primary-foreground">
                          {matrixData.tipos.flatMap(tipo => [
                            <th key={`${tipo}-data`} className="border border-border/30 px-1 py-1.5 text-center font-medium min-w-[90px]">DATA EXAME</th>,
                            <th key={`${tipo}-ven`} className="border border-border/30 px-1 py-1.5 text-center font-medium min-w-[100px]">VENCIMENTO</th>,
                            <th key={`${tipo}-st`} className="border border-border/30 px-1 py-1.5 text-center font-medium min-w-[80px]">STATUS</th>,
                          ])}
                        </tr>
                      </thead>
                      <tbody>
                        {matrixData.rows.map((row, idx) => {
                          const rowBg = idx % 2 === 0 ? "bg-background" : "bg-muted";
                          return (
                          <tr key={row.func.id} className={rowBg}>
                            <td className={`border border-border/30 px-2 py-1.5 text-center font-mono sticky left-0 ${rowBg} z-10`}>{idx + 1}</td>
                            <td className={`border border-border/30 px-2 py-1.5 font-medium sticky left-[40px] ${rowBg} z-10 whitespace-nowrap`}>{row.func.nome}</td>
                            <td className="border border-border/30 px-2 py-1.5 font-mono">{row.func.cpf || "—"}</td>
                            <td className="border border-border/30 px-2 py-1.5">{row.func.cargo || "—"}</td>
                            <td className="border border-border/30 px-2 py-1.5 text-muted-foreground">{row.func.setor || "—"}</td>
                            {matrixData.tipos.flatMap(tipo => {
                              const td = row.tipoData[tipo];
                              if (!td) {
                                return [
                                  <td key={`${row.func.id}-${tipo}-d`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">—</td>,
                                  <td key={`${row.func.id}-${tipo}-v`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">—</td>,
                                  <td key={`${row.func.id}-${tipo}-s`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">—</td>,
                                ];
                              }
                              const statusBg = td.status.key === "vencido"
                                ? "bg-destructive text-destructive-foreground font-bold"
                                : td.status.key === "atencao"
                                ? "bg-warning text-warning-foreground font-bold"
                                : "bg-success text-success-foreground font-bold";
                              return [
                                <td key={`${row.func.id}-${tipo}-d`} className="border border-border/30 px-1 py-1.5 text-center font-mono">
                                  {formatDateSafe(td.data)}
                                </td>,
                                <td key={`${row.func.id}-${tipo}-v`} className="border border-border/30 px-1 py-1.5 text-center font-mono">
                                  {formatDateSafe(td.vencimento)}
                                </td>,
                                <td key={`${row.func.id}-${tipo}-s`} className={`border border-border/30 px-1 py-1.5 text-center text-[10px] ${td.resultado === "pendente" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" : statusBg}`}>
                                  {td.resultado === "pendente" ? "Pendente" : td.status.key === "vencido" ? "Vencido" : td.status.key === "atencao" ? "Atenção" : "Válido"}
                                </td>,
                              ];
                            })}
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ABA SEM EXAME === */}
        <TabsContent value="sem_exame">
          <Card>
            <CardContent className="p-0">
              {funcionariosSemExame.length > 0 && (
                <div className="flex justify-end p-4 pb-0">
                  <Button variant="outline" className="border-primary/30 hover:bg-primary/10" onClick={() => {
                    const wb = XLSX.utils.book_new();
                    const wsData: any[][] = [
                      [{ v: "Funcionários Sem Exame Cadastrado", t: "s", s: { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } } }],
                      [{ v: `Data: ${format(new Date(), "dd/MM/yyyy")}`, t: "s", s: { font: { sz: 10 }, alignment: { horizontal: "center" } } }],
                      [],
                      ["Nº", "Nome Completo", "CPF", "Matrícula", "Função", "Setor"].map(h => ({ v: h, t: "s", s: { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 }, fill: { fgColor: { rgb: "E74C3C" } }, alignment: { horizontal: "center" }, border: { bottom: { style: "thin", color: { rgb: "000000" } } } } })),
                    ];
                    funcionariosSemExame.forEach((f, i) => {
                      wsData.push([i + 1, f.nome, f.cpf || "—", f.matricula || "—", f.cargo || "—", f.setor || "—"]);
                    });
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }];
                    ws["!cols"] = [{ wch: 6 }, { wch: 35 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 18 }];
                    XLSX.utils.book_append_sheet(wb, ws, "Sem Exame");
                    XLSX.writeFile(wb, `Funcionarios_Sem_Exame_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
                    toast({ title: "Exportado!", description: `${funcionariosSemExame.length} funcionários sem exame exportados.` });
                  }}>
                    <Download className="w-4 h-4 mr-2" />Exportar Sem Exame
                  </Button>
                </div>
              )}
              {loading ? (
                <div className="p-3"><ListSkeleton rows={4} /></div>
              ) : funcionariosSemExame.length === 0 ? (
                <EmptyState bare icon={CheckCircle} title="Tudo em dia" description="Todos os funcionários possuem exames cadastrados." />
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden p-3 space-y-3">
                    {funcionariosSemExame.map((f, idx) => (
                      <Card key={f.id} className="border">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-muted-foreground">#{idx + 1}</div>
                              <div className="font-semibold text-sm truncate">{f.nome}</div>
                              <div className="text-xs text-muted-foreground truncate">{f.cargo || "—"} · {f.setor || "—"}</div>
                            </div>
                            <StatusBadge tone="danger">Sem exame</StatusBadge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t">
                            <div><div className="text-[10px] uppercase text-muted-foreground">CPF</div><div className="font-mono">{f.cpf || "—"}</div></div>
                            <div><div className="text-[10px] uppercase text-muted-foreground">Matrícula</div><div>{f.matricula || "—"}</div></div>
                          </div>
                          <Button size="sm" variant="outline" className="w-full h-11" onClick={() => {
                            setEditing(null);
                            setForm({ funcionario_id: f.id, tipo: "periodico", nome_exame: "", data: new Date().toISOString().split("T")[0], data_vencimento: calcularVencimento("periodico", new Date().toISOString().split("T")[0]), resultado: "pendente", medico: "", observacao: "" });
                            setFuncSearch(f.nome);
                            setMedicoSearch("");
                            setShowAddMedico(false);
                            setOpen(true);
                          }}>
                            <Plus className="w-4 h-4 mr-1" /> Adicionar exame
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">Nº</TableHead>
                          <TableHead>Nome Completo</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Função</TableHead>
                          <TableHead>Setor</TableHead>
                          <TableHead className="w-32 text-center">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {funcionariosSemExame.map((f, idx) => (
                          <TableRow key={f.id}>
                            <TableCell className="text-center font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{f.nome}</TableCell>
                            <TableCell className="font-mono text-xs">{f.cpf || "—"}</TableCell>
                            <TableCell className="text-xs">{f.matricula || "—"}</TableCell>
                            <TableCell>{f.cargo || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{f.setor || "—"}</TableCell>
                            <TableCell className="text-center">
                              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => {
                                setEditing(null);
                                setForm({ funcionario_id: f.id, tipo: "periodico", nome_exame: "", data: new Date().toISOString().split("T")[0], data_vencimento: calcularVencimento("periodico", new Date().toISOString().split("T")[0]), resultado: "pendente", medico: "", observacao: "" });
                                setFuncSearch(f.nome);
                                setMedicoSearch("");
                                setShowAddMedico(false);
                                setOpen(true);
                              }}>
                                <Plus className="w-3 h-3" />Adicionar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Exame" : "Novo Exame"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Funcionário */}
            <div>
              <Label>Funcionário *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nome, matrícula ou CPF..."
                  value={funcSearch}
                  onChange={e => { setFuncSearch(e.target.value); setForm(f => ({ ...f, funcionario_id: "" })); setFuncFocused(true); }}
                  onFocus={() => setFuncFocused(true)}
                  onBlur={() => setTimeout(() => setFuncFocused(false), 200)}
                  className="pl-9"
                />
              </div>
              {form.funcionario_id && (
                <div className="mt-1 text-xs text-primary font-medium">
                  ✓ {funcMap[form.funcionario_id]?.nome}
                </div>
              )}
              {!form.funcionario_id && funcFocused && (
                <div className="border rounded-lg mt-1 max-h-48 overflow-y-auto bg-background shadow-md">
                  {filteredFuncionarios.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 text-center">Nenhum funcionário encontrado</p>
                  ) : filteredFuncionarios.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                      onClick={() => { setForm(prev => ({ ...prev, funcionario_id: f.id })); setFuncSearch(f.nome); setFuncFocused(false); }}
                    >
                      <span className="font-medium">{f.nome}</span>
                      <span className="text-xs text-muted-foreground">{f.cargo || ""} {f.matricula ? `• ${f.matricula}` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Nome do Exame */}
            <div>
              <Label>Nome do Exame *</Label>
              <Select value={form.nome_exame} onValueChange={v => {
                const catExame = catalogo.find(c => c.nome === v);
                const newVenc = calcularVencimento(form.tipo, form.data, catExame?.periodicidade_meses);
                setForm(f => ({ ...f, nome_exame: v, data_vencimento: newVenc || f.data_vencimento }));
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione o exame..." /></SelectTrigger>
                <SelectContent>
                  {NOMES_EXAME.map(e => (
                    <SelectItem key={e.code} value={e.label}>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">{e.code}</span>
                        <span>{e.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Exame</Label>
                <Select value={form.tipo} onValueChange={v => {
                  const catExame = catalogo.find(c => c.nome === form.nome_exame);
                  const newVenc = calcularVencimento(v, form.data, catExame?.periodicidade_meses);
                  setForm(f => ({ ...f, tipo: v, data_vencimento: newVenc || f.data_vencimento }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_EXAME.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Resultado</Label>
                <Select value={form.resultado} onValueChange={v => setForm(f => ({ ...f, resultado: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="apto">Apto</SelectItem>
                    <SelectItem value="inapto">Inapto</SelectItem>
                    <SelectItem value="apto_com_restricao">Apto c/ Restrição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data do Exame</Label>
                <Input type="date" value={form.data} onChange={e => {
                  const catExame = catalogo.find(c => c.nome === form.nome_exame);
                  const newVenc = calcularVencimento(form.tipo, e.target.value, catExame?.periodicidade_meses);
                  setForm(f => ({ ...f, data: e.target.value, data_vencimento: newVenc || f.data_vencimento }));
                }} />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
                {tipoValidade[form.tipo] > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">Calculado automaticamente ({tipoValidade[form.tipo]} meses)</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Médico</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary" onClick={() => setShowAddMedico(!showAddMedico)}>
                  <UserPlus className="w-3 h-3" />
                  {showAddMedico ? "Cancelar" : "Novo Médico"}
                </Button>
              </div>

              {showAddMedico ? (
                <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <Input
                    placeholder="Nome do médico *"
                    value={novoMedico.nome}
                    onChange={e => setNovoMedico(p => ({ ...p, nome: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="CRM"
                      value={novoMedico.crm}
                      onChange={e => setNovoMedico(p => ({ ...p, crm: e.target.value }))}
                    />
                    <Input
                      placeholder="Especialidade"
                      value={novoMedico.especialidade}
                      onChange={e => setNovoMedico(p => ({ ...p, especialidade: e.target.value }))}
                    />
                  </div>
                  <Button type="button" size="sm" className="w-full" onClick={handleAddMedico}>
                    <Plus className="w-3 h-3 mr-1" />Adicionar Médico
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Pesquisar médico por nome ou CRM..."
                      value={medicoSearch}
                      onChange={e => { setMedicoSearch(e.target.value); setForm(f => ({ ...f, medico: "" })); }}
                      className="pl-9"
                    />
                  </div>
                  {form.medico && (
                    <div className="mt-1 text-xs text-primary font-medium">✓ {form.medico}</div>
                  )}
                  {!form.medico && medicoSearch.trim() && (
                    <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto bg-background">
                      {filteredMedicos.length === 0 ? (
                        <div className="p-2 text-center">
                          <p className="text-xs text-muted-foreground">Nenhum médico encontrado</p>
                          <Button type="button" variant="link" size="sm" className="text-xs h-6 mt-1" onClick={() => {
                            setNovoMedico({ nome: medicoSearch, crm: "", especialidade: "" });
                            setShowAddMedico(true);
                          }}>
                            <Plus className="w-3 h-3 mr-1" />Cadastrar "{medicoSearch}"
                          </Button>
                        </div>
                      ) : filteredMedicos.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                          onClick={() => {
                            const label = m.nome + (m.crm ? ` - CRM: ${m.crm}` : "");
                            setForm(prev => ({ ...prev, medico: label }));
                            setMedicoSearch(label);
                          }}
                        >
                          <span className="font-medium">{m.nome}</span>
                          <span className="text-xs text-muted-foreground">{m.crm ? `CRM: ${m.crm}` : ""} {m.especialidade || ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Observações" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

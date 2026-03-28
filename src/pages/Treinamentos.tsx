import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, GraduationCap, AlertTriangle, CheckCircle, Clock, Download, TrendingUp, FileWarning, Check, ChevronsUpDown, X, LayoutGrid, List, BookOpen, Upload, Brain, Infinity, Briefcase, Ban, Settings2, Maximize2, Minimize2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isOnline, addToSyncQueue, getCachedData, setCachedData } from "@/lib/offlineStorage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, format, parseISO } from "date-fns";
import * as XLSX from "xlsx-js-style";
import CadastroCursos from "@/components/CadastroCursos";
import BulkDocumentUpload from "@/components/BulkDocumentUpload";
import AIDocumentValidator from "@/components/AIDocumentValidator";
import CadastroFuncaoRequisitos from "@/components/CadastroFuncaoRequisitos";

interface ControleTreinamento {
  id: string;
  funcionario_id: string;
  nome_curso: string;
  data_realizacao: string;
  data_renovacao: string | null;
  documento_pendente: string | null;
  empresa_id: string | null;
  created_by: string | null;
}

interface Funcionario { id: string; nome: string; cargo: string | null; cpf: string | null; matricula: string | null; setor: string | null; }
interface RequisitoCliente { id: string; curso_nome: string; funcoes_exigidas: string[] | null; carga_horaria_minima: number; validade_meses: number; }

type StatusFilter = "todos" | "vencido" | "atencao" | "vigente" | "pendente";

// Documents that never expire (one-time upload)
const DOCUMENTOS_PERMANENTES = [
  "Ficha de EPI", "Comprovante de Escolaridade", "Escolaridade", "Ficha de Registro",
  "Ficha de Registro do Empregado", "CTPS", "CTPS Digital", "Regras de Ouro",
  "Contrato de Trabalho", "Comprovante de Residência", "CNH (Categoria)",
  "Registro no Conselho de Classe", "Certidão Negativa", "Edital",
];

function isPermanentDate(dataRenovacao: string | null): boolean {
  return dataRenovacao === "9999-12-31";
}

function isPermanentCourse(nomeCurso: string): boolean {
  const norm = nomeCurso.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return DOCUMENTOS_PERMANENTES.some(d => norm.includes(d.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()));
}

function getStatus(dataRenovacao: string | null): { label: string; variant: "destructive" | "outline" | "default"; key: string } {
  if (isPermanentDate(dataRenovacao)) return { label: "∞ Vitalício", variant: "default", key: "permanente" };
  if (!dataRenovacao) return { label: "Sem renovação", variant: "outline", key: "vigente" };
  const hoje = new Date();
  const renovacao = parseISO(dataRenovacao);
  const dias = differenceInDays(renovacao, hoje);
  if (dias < 0) return { label: "🔴 Vencido", variant: "destructive", key: "vencido" };
  if (dias <= 60) return { label: "🟡 Atenção", variant: "outline", key: "atencao" };
  return { label: "🟢 Vigente", variant: "default", key: "vigente" };
}

function statusOrder(dataRenovacao: string | null): number {
  const s = getStatus(dataRenovacao);
  if (s.key === "vencido") return 0;
  if (s.key === "atencao") return 1;
  return 2;
}

export default function Treinamentos() {
  const { empresaId } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ControleTreinamento[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ControleTreinamento | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [setorFilter, setSetorFilter] = useState("");
  const [form, setForm] = useState({
    funcionario_id: "",
    nome_curso: "",
    data_realizacao: new Date().toISOString().split("T")[0],
    data_renovacao: "",
    documento_pendente: "",
    sem_vencimento: false,
  });
  const [funcSearch, setFuncSearch] = useState("");
  const [showFuncList, setShowFuncList] = useState(false);
  const [cursoSearch, setCursoSearch] = useState("");
  const [showCursoList, setShowCursoList] = useState(false);

  // DB-based courses
  const [dbCursos, setDbCursos] = useState<{ nome: string; validade_meses: number }[]>([]);
  // Requisitos da Matriz Unificada
  const [requisitos, setRequisitos] = useState<RequisitoCliente[]>([]);
  // Dispensas de requisito por colaborador
  interface DispensaRequisito { id: string; funcionario_id: string; curso_nome: string; motivo: string; }
  const [dispensas, setDispensas] = useState<DispensaRequisito[]>([]);
  // Dialog para gerenciar dispensas
  const [dispensaDialogOpen, setDispensaDialogOpen] = useState(false);
  const [dispensaFuncId, setDispensaFuncId] = useState("");
  const [dispensaMotivo, setDispensaMotivo] = useState("");
  const [dispensaCursosSelecionados, setDispensaCursosSelecionados] = useState<string[]>([]);
  const [savingDispensa, setSavingDispensa] = useState(false);
  const [matrizFullscreen, setMatrizFullscreen] = useState(false);

  const fetchCursosDB = useCallback(async () => {
    if (!isOnline()) {
      const cached = getCachedData<{ nome: string; validade_meses: number }>("cursos_documentos");
      if (cached) setDbCursos(cached);
      const cachedReq = getCachedData<RequisitoCliente>("requisitos_cliente");
      if (cachedReq) setRequisitos(cachedReq);
      return;
    }
    const [{ data }, { data: reqData }, { data: dispData }] = await Promise.all([
      (supabase.from as any)("cursos_documentos").select("nome, validade_meses").order("nome"),
      (supabase.from as any)("requisitos_cliente").select("id, curso_nome, funcoes_exigidas, carga_horaria_minima, validade_meses"),
      (supabase.from as any)("dispensas_requisito").select("id, funcionario_id, curso_nome, motivo"),
    ]);
    if (data) { setDbCursos(data); setCachedData("cursos_documentos", data); }
    if (reqData) { setRequisitos(reqData); setCachedData("requisitos_cliente", reqData); }
    if (dispData) setDispensas(dispData);
  }, []);

  // Multi-course mode
  interface CursoEntry { nome_curso: string; data_realizacao: string; data_renovacao: string; documento_pendente: string; cursoSearch: string; showCursoList: boolean; docPopoverOpen: boolean; }
  const emptyCurso = (): CursoEntry => ({ nome_curso: "", data_realizacao: new Date().toISOString().split("T")[0], data_renovacao: "", documento_pendente: "", cursoSearch: "", showCursoList: false, docPopoverOpen: false });
  const [multiCursos, setMultiCursos] = useState<CursoEntry[]>([emptyCurso()]);
  const [multiMode, setMultiMode] = useState(false);
  const [multiFuncId, setMultiFuncId] = useState("");
  const [multiFuncSearch, setMultiFuncSearch] = useState("");
  const [savingMulti, setSavingMulti] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    if (!isOnline()) {
      setItems(getCachedData<ControleTreinamento>("controle_treinamentos") || []);
      setFuncionarios(getCachedData<Funcionario>("funcionarios") || []);
      setLoading(false);
      return;
    }
    try {
      const [{ data: treinos }, { data: funcs }] = await Promise.all([
        (supabase.from as any)("controle_treinamentos").select("*").order("data_renovacao", { ascending: true, nullsFirst: false }),
        supabase.from("funcionarios").select("id, nome, cargo, cpf, matricula, setor"),
      ]);
      if (treinos) { setItems(treinos); setCachedData("controle_treinamentos", treinos); }
      if (funcs) { setFuncionarios(funcs); setCachedData("funcionarios", funcs); }
    } catch {
      setItems(getCachedData<ControleTreinamento>("controle_treinamentos") || []);
      setFuncionarios(getCachedData<Funcionario>("funcionarios") || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); fetchCursosDB(); }, [fetchCursosDB]);

  const funcMap = useMemo(() => {
    const m: Record<string, Funcionario> = {};
    funcionarios.forEach(f => { m[f.id] = f; });
    return m;
  }, [funcionarios]);

  // Cursos do banco de dados (editáveis no sub-módulo)
  const cursosValidade = useMemo(() => {
    const m: Record<string, number> = {};
    dbCursos.forEach(c => { m[c.nome] = c.validade_meses; });
    return m;
  }, [dbCursos]);

  const CURSOS_SUGERIDOS = useMemo(() => {
    return dbCursos.map(c => c.nome).sort();
  }, [dbCursos]);

  const calcularRenovacao = (curso: string, dataRealizacao: string, forceNoPermanent?: boolean): string => {
    if (!forceNoPermanent && isPermanentCourse(curso)) return "9999-12-31";
    const meses = cursosValidade[curso];
    if (meses === undefined || meses === 0 || !dataRealizacao) return "";
    const data = parseISO(dataRealizacao);
    const renovacao = new Date(data);
    renovacao.setMonth(renovacao.getMonth() + meses);
    return format(renovacao, "yyyy-MM-dd");
  };

  // Documentos Pendentes list comes from the "Documentos Permanentes" registered in cursos_documentos (validade_meses === 0)
  const DOCUMENTOS_LISTA = useMemo(() => {
    const permanentes = dbCursos.filter(c => c.validade_meses === 0).map(c => c.nome);
    return permanentes.length > 0 ? permanentes : ["Ordem de Serviço", "Ficha de EPI", "ASO"];
  }, [dbCursos]);

  const [docPopoverOpen, setDocPopoverOpen] = useState(false);

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const normalizeCourseName = (s: string | null | undefined) => normalize(s ?? "").replace(/\s+/g, " ").trim();

  // Helper: check if employee cargo matches any of the funcoes_exigidas using fuzzy matching
  const cargoMatchesFuncao = useCallback((cargo: string | null, funcoes: string[] | null): boolean => {
    if (!cargo || !funcoes || funcoes.length === 0) return false;
    const normCargo = normalize(cargo);
    return funcoes.some(f => {
      const normF = normalize(f);
      // Split compound function names by "/" and check each part
      const parts = normF.split("/").map(p => p.trim()).filter(Boolean);
      return parts.some(part => normCargo.includes(part) || part.includes(normCargo));
    });
  }, []);

  // Get required courses for a given cargo from Matriz Unificada
  const getRequiredCourses = useCallback((cargo: string | null): RequisitoCliente[] => {
    if (!cargo) return [];
    return requisitos.filter(r => cargoMatchesFuncao(cargo, r.funcoes_exigidas));
  }, [requisitos, cargoMatchesFuncao]);

  // Open add modal with pre-selected course from a pendente tag click
  const openNewWithCourse = (funcId: string, cursoNome: string) => {
    setEditing(null);
    setMultiMode(false);
    const func = funcMap[funcId];
    const isPerm = isPermanentCourse(cursoNome);
    setForm({ funcionario_id: funcId, nome_curso: cursoNome, data_realizacao: new Date().toISOString().split("T")[0], data_renovacao: isPerm ? "9999-12-31" : "", documento_pendente: "", sem_vencimento: isPerm });
    setFuncSearch(func?.nome || "");
    setCursoSearch(cursoNome);
    setShowCursoList(false);
    if (!isPerm) {
      const newRen = calcularRenovacao(cursoNome, new Date().toISOString().split("T")[0]);
      if (newRen) setForm(prev => ({ ...prev, data_renovacao: newRen }));
    }
    refreshFuncionarios();
    setOpen(true);
  };

  const filteredFuncionarios = useMemo(() => {
    if (!funcSearch.trim()) return funcionarios.slice().sort((a, b) => a.nome.localeCompare(b.nome));
    const q = normalize(funcSearch);
    return funcionarios.filter(f =>
      normalize(f.nome).includes(q) ||
      (f.matricula && f.matricula.toLowerCase().includes(q)) ||
      (f.cpf && f.cpf.replace(/\D/g, "").includes(q.replace(/\D/g, "")))
    ).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [funcionarios, funcSearch]);

  const filteredCursos = useMemo(() => {
    if (!cursoSearch.trim()) return CURSOS_SUGERIDOS;
    const q = normalize(cursoSearch);
    return CURSOS_SUGERIDOS.filter(c => normalize(c).includes(q));
  }, [cursoSearch]);

  // Unique setores for filter
  const setoresUnicos = useMemo(() => {
    const s = new Set<string>();
    funcionarios.forEach(f => { if (f.setor) s.add(f.setor); });
    return [...s].sort();
  }, [funcionarios]);

  const filtered = useMemo(() => {
    let list = [...items];
    // Setor filter
    if (setorFilter) {
      const funcIdsInSetor = new Set(funcionarios.filter(f => f.setor === setorFilter).map(f => f.id));
      list = list.filter(t => funcIdsInSetor.has(t.funcionario_id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => {
        const func = funcMap[t.funcionario_id];
        return (func?.nome || "").toLowerCase().includes(q) || t.nome_curso.toLowerCase().includes(q);
      });
    }
    if (statusFilter === "pendente") {
      list = list.filter(t => t.documento_pendente && t.documento_pendente.trim() !== "");
    } else if (statusFilter !== "todos") {
      list = list.filter(t => getStatus(t.data_renovacao).key === statusFilter);
    }
    list.sort((a, b) => statusOrder(a.data_renovacao) - statusOrder(b.data_renovacao));
    return list;
  }, [items, search, statusFilter, funcMap, setorFilter, funcionarios]);

  const refreshFuncionarios = async () => {
    if (!isOnline()) return;
    const { data: funcs } = await supabase.from("funcionarios").select("id, nome, cargo, cpf, matricula, setor");
    if (funcs) { setFuncionarios(funcs); setCachedData("funcionarios", funcs); }
  };

  const openNew = () => {
    setEditing(null);
    setMultiMode(false);
    setForm({ funcionario_id: "", nome_curso: "", data_realizacao: new Date().toISOString().split("T")[0], data_renovacao: "", documento_pendente: "", sem_vencimento: false });
    setFuncSearch(""); setCursoSearch(""); setShowCursoList(false);
    setMultiCursos([emptyCurso()]);
    setMultiFuncId("");
    setMultiFuncSearch("");
    refreshFuncionarios();
    setOpen(true);
  };

  const openNewMulti = () => {
    setEditing(null);
    setMultiMode(true);
    setForm({ funcionario_id: "", nome_curso: "", data_realizacao: new Date().toISOString().split("T")[0], data_renovacao: "", documento_pendente: "", sem_vencimento: false });
    setFuncSearch(""); setCursoSearch(""); setShowCursoList(false);
    setMultiCursos([emptyCurso()]);
    setMultiFuncId("");
    setMultiFuncSearch("");
    refreshFuncionarios();
    setOpen(true);
  };

  const openEdit = (t: ControleTreinamento) => {
    setEditing(t);
    const isPerm = isPermanentDate(t.data_renovacao) || isPermanentCourse(t.nome_curso);
    setForm({
      funcionario_id: t.funcionario_id,
      nome_curso: t.nome_curso,
      data_realizacao: t.data_realizacao,
      data_renovacao: t.data_renovacao || "",
      documento_pendente: t.documento_pendente || "",
      sem_vencimento: isPerm,
    });
    const func = funcMap[t.funcionario_id];
    setFuncSearch(func?.nome || "");
    setCursoSearch(t.nome_curso);
    setShowCursoList(false);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.funcionario_id) {
      toast({ title: "Selecione o funcionário", variant: "destructive" });
      return;
    }
    const payload = {
      funcionario_id: form.funcionario_id,
      nome_curso: form.nome_curso,
      data_realizacao: form.data_realizacao,
      data_renovacao: form.data_renovacao || null,
      documento_pendente: form.documento_pendente || null,
      empresa_id: empresaId,
    };

    if (!isOnline()) {
      if (editing) {
        addToSyncQueue({ table: "controle_treinamentos", type: "update", payload: { id: editing.id, ...payload } });
        const cached = getCachedData<ControleTreinamento>("controle_treinamentos") || [];
        setCachedData("controle_treinamentos", cached.map(c => c.id === editing.id ? { ...c, ...payload } : c));
      } else {
        const tempId = crypto.randomUUID();
        const newItem = { ...payload, id: tempId, created_by: null };
        addToSyncQueue({ table: "controle_treinamentos", type: "insert", payload: newItem });
        const cached = getCachedData<ControleTreinamento>("controle_treinamentos") || [];
        cached.unshift(newItem as ControleTreinamento);
        setCachedData("controle_treinamentos", cached);
      }
      toast({ title: "Salvo offline", description: "Será sincronizado quando houver conexão." });
      setOpen(false);
      fetchData();
      return;
    }

    if (editing) {
      const { error } = await (supabase.from as any)("controle_treinamentos").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await (supabase.from as any)("controle_treinamentos").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setOpen(false);
    fetchData();
  };

  const handleSaveMulti = async () => {
    if (!multiFuncId) {
      toast({ title: "Selecione o funcionário", variant: "destructive" });
      return;
    }
    const validCursos = multiCursos.filter(c => c.nome_curso.trim() || c.documento_pendente.trim());
    if (validCursos.length === 0) {
      toast({ title: "Adicione pelo menos um curso ou documento", variant: "destructive" });
      return;
    }
    setSavingMulti(true);
    const payloads = validCursos.map(c => ({
      funcionario_id: multiFuncId,
      nome_curso: c.nome_curso.trim() || "Documentação Pendente",
      data_realizacao: c.data_realizacao,
      data_renovacao: c.data_renovacao || null,
      documento_pendente: c.documento_pendente || null,
      empresa_id: empresaId,
    }));

    if (!isOnline()) {
      const cached = getCachedData<ControleTreinamento>("controle_treinamentos") || [];
      payloads.forEach(p => {
        const tempId = crypto.randomUUID();
        const newItem = { ...p, id: tempId, created_by: null };
        addToSyncQueue({ table: "controle_treinamentos", type: "insert", payload: newItem });
        cached.unshift(newItem as ControleTreinamento);
      });
      setCachedData("controle_treinamentos", cached);
      setSavingMulti(false);
      toast({ title: "Salvo offline", description: `${validCursos.length} curso(s) serão sincronizados.` });
      setOpen(false);
      fetchData();
      return;
    }

    const { error } = await (supabase.from as any)("controle_treinamentos").insert(payloads);
    setSavingMulti(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sucesso!", description: `${validCursos.length} curso(s) cadastrado(s)` });
    setOpen(false);
    fetchData();
  };

  const updateMultiCurso = (idx: number, updates: Partial<CursoEntry>) => {
    setMultiCursos(prev => prev.map((c, i) => i === idx ? { ...c, ...updates } : c));
  };

  const filteredMultiFuncionarios = useMemo(() => {
    if (!multiFuncSearch.trim()) return funcionarios.slice().sort((a, b) => a.nome.localeCompare(b.nome));
    const q = normalize(multiFuncSearch);
    const matched = funcionarios.filter(f =>
      normalize(f.nome).includes(q) ||
      (f.matricula && normalize(f.matricula).includes(q)) ||
      (f.cpf && f.cpf.replace(/\D/g, "").includes(q.replace(/\D/g, ""))) ||
      (f.cargo && normalize(f.cargo).includes(q)) ||
      (f.setor && normalize(f.setor).includes(q))
    );
    // Sort: name starts with query first, then name contains, then other field matches
    return matched.sort((a, b) => {
      const aName = normalize(a.nome);
      const bName = normalize(b.nome);
      const aStarts = aName.startsWith(q) ? 0 : aName.includes(q) ? 1 : 2;
      const bStarts = bName.startsWith(q) ? 0 : bName.includes(q) ? 1 : 2;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.nome.localeCompare(b.nome);
    });
  }, [funcionarios, multiFuncSearch]);

  const handleDelete = async (id: string) => {
    if (!isOnline()) {
      addToSyncQueue({ table: "controle_treinamentos", type: "delete", payload: { id } });
      const cached = getCachedData<ControleTreinamento>("controle_treinamentos") || [];
      setCachedData("controle_treinamentos", cached.filter(c => c.id !== id));
      toast({ title: "Excluído offline", description: "Será sincronizado quando houver conexão." });
      fetchData();
      return;
    }
    await (supabase.from as any)("controle_treinamentos").delete().eq("id", id);
    fetchData();
  };

  const handleExportExcel = async () => {
    // Fetch empresa data
    let empresaNome = "";
    let empresaCnpj = "";
    let empresaEndereco = "";
    let empresaTelefone = "";
    let empresaEmail = "";
    let logoBase64: string | null = null;

    if (empresaId) {
      let empData: any[] | null = null;
      if (isOnline()) {
        const res = await (supabase.from as any)("empresa_config").select("*").eq("id", empresaId).limit(1);
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

        // Fetch logo as base64
        if (emp.logo_url) {
          try {
            const res = await fetch(emp.logo_url);
            const blob = await res.blob();
            logoBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch { /* ignore logo fetch error */ }
        }
      }
    }

    // Use filtered data (respects sector filter) instead of all items
    const exportItems = filtered;
    const cursoSet = new Set<string>();
    exportItems.forEach(t => cursoSet.add(t.nome_curso));
    const cursos = Array.from(cursoSet).sort();
    const funcIds = Array.from(new Set(exportItems.map(t => t.funcionario_id)));
    const fixedCols = 6; // Nº, COLABORADOR, CPF, FUNÇÃO, SETOR, PENDENTES
    const totalCols = fixedCols + cursos.length * 3;

    // Build worksheet manually for full style control
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];

    // Company header rows (offset for data)
    const HEADER_OFFSET = 5; // 5 rows for company info before table

    // Row 0: Company name
    const companyRow: any[] = [empresaNome || ""];
    wsData.push(companyRow);
    // Row 1: CNPJ
    wsData.push([empresaCnpj ? `CNPJ: ${empresaCnpj}` : ""]);
    // Row 2: Address
    wsData.push([empresaEndereco || ""]);
    // Row 3: Phone / Email
    wsData.push([[empresaTelefone, empresaEmail].filter(Boolean).join(" | ") || ""]);
    // Row 4: Empty separator
    wsData.push([""]);

    // Header row 1: Nº, COLABORADOR, CPF, FUNÇÃO, PENDENTES, then each course spans 3 cols
    const header1: any[] = ["Nº", "COLABORADOR", "CPF", "FUNÇÃO", "SETOR", "PENDENTES"];
    cursos.forEach(curso => { header1.push(curso, "", ""); });
    wsData.push(header1);

    // Header row 2: sub-headers under each course
    const header2: any[] = ["", "", "", "", "", ""];
    cursos.forEach(() => { header2.push("ÚLTIMA DATA", "DATA RENOVAÇÃO", "STATUS"); });
    wsData.push(header2);

    // Data rows
    funcIds.forEach((fid, idx) => {
      const func = funcMap[fid];
      if (!func) return;
      const treinos = exportItems.filter(t => t.funcionario_id === fid);
      const protocoladosSet = new Set<string>();
      treinos.forEach(t => {
        if (t.documento_pendente) t.documento_pendente.split(" | ").filter(Boolean).forEach(d => protocoladosSet.add(d));
      });
      const row: any[] = [idx + 1, func.nome, func.cpf || "—", func.cargo || "—", func.setor || "—", protocoladosSet.size > 0 ? "✅ " + Array.from(protocoladosSet).join(", ") : "—"];
      cursos.forEach(curso => {
        const t = treinos.find(tr => tr.nome_curso === curso);
        if (!t) {
          row.push("—", "—", "—");
        } else {
          const s = getStatus(t.data_renovacao);
          row.push(
            t.data_realizacao ? format(parseISO(t.data_realizacao), "dd/MM/yyyy") : "—",
            isPermanentDate(t.data_renovacao) ? "Vitalício" : t.data_renovacao ? format(parseISO(t.data_renovacao), "dd/MM/yyyy") : "—",
            s.key === "permanente" ? "∞ Entregue" : s.key === "vencido" ? "Vencido" : s.key === "atencao" ? "Atenção" : "Válido"
          );
        }
      });
      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge company header rows across all columns
    const merges: XLSX.Range[] = [];
    for (let r = 0; r < HEADER_OFFSET; r++) {
      merges.push({ s: { r, c: 0 }, e: { r, c: Math.max(totalCols - 1, fixedCols - 1) } });
    }

    // Merge header cells for course names (row HEADER_OFFSET)
    cursos.forEach((_, i) => {
      const startCol = fixedCols + i * 3;
      merges.push({ s: { r: HEADER_OFFSET, c: startCol }, e: { r: HEADER_OFFSET, c: startCol + 2 } });
    });
    // Merge Nº, COLABORADOR, CPF, FUNÇÃO, SETOR, PENDENTES across 2 header rows
    for (let c = 0; c < fixedCols; c++) {
      merges.push({ s: { r: HEADER_OFFSET, c }, e: { r: HEADER_OFFSET + 1, c } });
    }
    ws["!merges"] = merges;

    // Column widths
    const colWidths: { wch: number }[] = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 16 }, { wch: 14 }];
    cursos.forEach(() => { colWidths.push({ wch: 14 }, { wch: 16 }, { wch: 12 }); });
    ws["!cols"] = colWidths;

    // Row heights for company header
    ws["!rows"] = [
      { hpt: 28 }, // Company name
      { hpt: 18 }, // CNPJ
      { hpt: 18 }, // Address
      { hpt: 18 }, // Phone/Email
      { hpt: 10 }, // Separator
    ];

    // Apply styles
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

        // Company header rows
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
          // Main header row
          cell.s.fill = headerFill;
          cell.s.font = headerFont;
          cell.s.alignment = centerAlign;
        } else if (R === HEADER_OFFSET + 1) {
          // Sub-header row
          cell.s.fill = subHeaderFill;
          cell.s.font = { ...headerFont, sz: 9 };
          cell.s.alignment = centerAlign;
        } else {
          // Data rows
          cell.s.alignment = C <= 1 ? leftAlign : centerAlign;

          // Alternate row bg
          if (R % 2 === 0) {
            cell.s.fill = { fgColor: { rgb: "F8F9FA" } };
          }

          // Color status cells
          if (C >= fixedCols && (C - fixedCols) % 3 === 2) {
            const val = String(cell.v || "");
            if (val === "Vencido") {
              cell.s.fill = { fgColor: { rgb: "DC2626" } };
              cell.s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "FFFFFF" } };
            } else if (val === "Atenção") {
              cell.s.fill = { fgColor: { rgb: "F59E0B" } };
              cell.s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "FFFFFF" } };
            } else if (val === "Válido") {
              cell.s.fill = { fgColor: { rgb: "16A34A" } };
              cell.s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "FFFFFF" } };
            } else if (val === "∞ Entregue") {
              cell.s.fill = { fgColor: { rgb: "3B82F6" } };
              cell.s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "FFFFFF" } };
            }
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Matriz Treinamentos");
    XLSX.writeFile(wb, `Matriz_Treinamentos_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Exportado com sucesso!", description: "Matriz exportada com cores e formatação." });
  };

  const totalItems = items.length;
  const vencidosCount = items.filter(t => getStatus(t.data_renovacao).key === "vencido").length;
  const atencaoCount = items.filter(t => getStatus(t.data_renovacao).key === "atencao").length;
  const vigentesCount = items.filter(t => getStatus(t.data_renovacao).key === "vigente").length;
  const pendentesCount = items.filter(t => t.documento_pendente && t.documento_pendente.trim() !== "").length;
  const conformidade = totalItems > 0 ? Math.round((vigentesCount / totalItems) * 100) : 100;

  // Matrix data: group by employee, list all unique courses as columns
  // Now includes ALL employees (even without trainings) and auto-pendentes from Matriz Unificada
  const matrixData = useMemo(() => {
    const matrixItems = items.filter(t => t.nome_curso !== "Documentação Pendente");
    const cursoSet = new Set<string>();
    matrixItems.forEach(t => {
      if (t.nome_curso?.trim()) cursoSet.add(t.nome_curso);
    });
    // Also add required courses/documents from Matriz Unificada as columns
    requisitos.forEach(r => cursoSet.add(r.curso_nome));
    const cursos = Array.from(cursoSet).sort();

    // Include ALL employees, not just those with trainings
    const allFuncIds = new Set<string>();
    items.forEach(t => allFuncIds.add(t.funcionario_id));
    // Also include employees that have required courses via their cargo
    funcionarios.forEach(f => {
      if (getRequiredCourses(f.cargo).length > 0) allFuncIds.add(f.id);
    });
    // Apply setor filter if active
    const filteredFuncIds = setorFilter
      ? [...allFuncIds].filter(fid => {
          const f = funcMap[fid];
          return f?.setor === setorFilter;
        })
      : [...allFuncIds];

    const rows = filteredFuncIds.map(fid => {
      const func = funcMap[fid];
      if (!func) return null;
      const treinos = items.filter(t => t.funcionario_id === fid);
      const treinosComCurso = treinos.filter(t => t.nome_curso !== "Documentação Pendente");
      const cursoData: Record<string, { realizacao: string; renovacao: string | null; status: ReturnType<typeof getStatus> }> = {};
      const cursoDataNormalizado: Record<string, { realizacao: string; renovacao: string | null; status: ReturnType<typeof getStatus> }> = {};

      // Documentos protocolados são considerados válidos — removem pendências
      const protocoladosSet = new Set<string>();
      treinos.forEach(t => {
        if (t.documento_pendente) {
          t.documento_pendente.split(" | ").filter(Boolean).forEach(d => protocoladosSet.add(normalizeCourseName(d)));
        }
      });

      cursos.forEach(curso => {
        const t = treinosComCurso.find(tr => tr.nome_curso === curso);
        if (t) {
          const value = { realizacao: t.data_realizacao, renovacao: t.data_renovacao, status: getStatus(t.data_renovacao) };
          cursoData[curso] = value;
          cursoDataNormalizado[normalizeCourseName(curso)] = value;
        }
      });

      const requiredCourses = getRequiredCourses(func.cargo);
      const requiredCourseNames = new Set(requiredCourses.map(req => normalizeCourseName(req.curso_nome)));
      const autoPendentesMap = new Map<string, string>();

      // Dispensas deste colaborador
      const funcDispensas = dispensas.filter(d => d.funcionario_id === fid);
      const dispensadosSet = new Set(funcDispensas.map(d => normalizeCourseName(d.curso_nome)));

      requiredCourses.forEach(req => {
        const reqKey = normalizeCourseName(req.curso_nome);
        const cd = cursoData[req.curso_nome] || cursoDataNormalizado[reqKey];
        // Se dispensado, ignorar completamente — prioridade sobre regra da função
        if (dispensadosSet.has(reqKey)) return;
        // Se o documento foi protocolado, considerar como válido (não pendente)
        if (protocoladosSet.has(reqKey)) return;
        if (!cd) {
          autoPendentesMap.set(reqKey, req.curso_nome);
        } else if (cd.status.key === "permanente") {
          // Permanent doc already delivered — skip
        } else if (cd.status.key === "vencido") {
          autoPendentesMap.set(reqKey, `${req.curso_nome} (Vencido)`);
        }
      });

      return {
        func,
        cursoData,
        pendentes: [], // Protocolados agora são válidos, não pendentes
        protocolados: protocoladosSet,
        autoPendentes: Array.from(autoPendentesMap.values()),
        requiredCourseNames,
        dispensados: dispensadosSet,
      };
    }).filter(Boolean) as {
      func: Funcionario;
      cursoData: Record<string, { realizacao: string; renovacao: string | null; status: ReturnType<typeof getStatus> }>;
      pendentes: string[];
      protocolados: Set<string>;
      autoPendentes: string[];
      requiredCourseNames: Set<string>;
      dispensados: Set<string>;
    }[];

    return { cursos, rows };
  }, [items, funcMap, requisitos, funcionarios, getRequiredCourses, setorFilter, dispensas]);

  // === Dispensa helpers ===
  const openDispensaDialog = (funcId: string) => {
    const func = funcMap[funcId];
    if (!func) return;
    const funcDispensas = dispensas.filter(d => d.funcionario_id === funcId);
    setDispensaFuncId(funcId);
    setDispensaCursosSelecionados(funcDispensas.map(d => d.curso_nome));
    setDispensaMotivo("");
    setDispensaDialogOpen(true);
  };

  const handleSaveDispensas = async () => {
    if (!dispensaFuncId) return;
    setSavingDispensa(true);
    const existing = dispensas.filter(d => d.funcionario_id === dispensaFuncId);
    const existingNames = new Set(existing.map(d => d.curso_nome));
    const selectedSet = new Set(dispensaCursosSelecionados);

    // Add new dispensas
    const toAdd = dispensaCursosSelecionados.filter(c => !existingNames.has(c));
    // Remove unselected dispensas
    const toRemove = existing.filter(d => !selectedSet.has(d.curso_nome));

    try {
      if (toAdd.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const rows = toAdd.map(curso => ({
          funcionario_id: dispensaFuncId,
          curso_nome: curso,
          motivo: dispensaMotivo || "Não se aplica ao colaborador",
          empresa_id: empresaId,
          created_by: user?.id || null,
        }));
        const { data: insertedRows, error: insertError } = await (supabase.from as any)("dispensas_requisito").insert(rows).select("id, funcionario_id, curso_nome, motivo");
        if (insertError) throw insertError;
        setDispensas(prev => [...prev.filter(d => !(d.funcionario_id === dispensaFuncId && selectedSet.has(d.curso_nome) && !existingNames.has(d.curso_nome))), ...(insertedRows || [])]);
      }
      if (toRemove.length > 0) {
        const ids = toRemove.map(d => d.id);
        const { error: deleteError } = await (supabase.from as any)("dispensas_requisito").delete().in("id", ids);
        if (deleteError) throw deleteError;
        setDispensas(prev => prev.filter(d => !ids.includes(d.id)));
      }
      toast({ title: "Dispensas atualizadas", description: "Requisitos do colaborador foram ajustados com sucesso." });
      setDispensaDialogOpen(false);
    } catch (e: any) {
      console.error("Erro ao salvar dispensas:", e);
      toast({ title: "Erro ao salvar dispensas", description: e.message, variant: "destructive" });
    }
    setSavingDispensa(false);
  };

  return (
    <div className="space-y-6">
      {/* Header com gradiente */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-5 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Controle de Documentos</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Acompanhamento de Documentação</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleExportExcel} className="border-primary/30 hover:bg-primary/10">
              <Download className="w-4 h-4 mr-2" />Exportar
            </Button>
            <Button variant="outline" onClick={openNewMulti} className="border-primary/30 hover:bg-primary/10">
              <Plus className="w-4 h-4 mr-2" />Adicionar Vários Documentos
            </Button>
            <Button onClick={openNew} className="shadow-lg shadow-primary/25">
              <Plus className="w-4 h-4 mr-2" />Adicionar Novo
            </Button>
          </div>
        </div>
      </div>

      {/* Indicadores visuais */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        {/* Card de conformidade grande */}
        <Card className="col-span-2 lg:col-span-1 border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
          <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center text-center gap-2">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                  strokeDasharray={`${conformidade * 2.136} 213.6`}
                  strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-primary">{conformidade}%</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Conformidade</p>
          </CardContent>
        </Card>

        {/* Total */}
        <Card className="group hover:shadow-md transition-all duration-200 hover:border-primary/30">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-3xl font-bold text-foreground">{totalItems}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Total Registros</p>
            <Progress value={100} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        {/* Vencidos */}
        <Card className="group hover:shadow-md transition-all duration-200 hover:border-destructive/30 cursor-pointer"
          onClick={() => setStatusFilter(statusFilter === "vencido" ? "todos" : "vencido")}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-3xl font-bold text-destructive">{vencidosCount}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Vencidos</p>
            <Progress value={totalItems > 0 ? (vencidosCount / totalItems) * 100 : 0} className="mt-2 h-1.5 [&>div]:bg-destructive" />
          </CardContent>
        </Card>

        {/* Atenção */}
        <Card className="group hover:shadow-md transition-all duration-200 hover:border-warning/30 cursor-pointer"
          onClick={() => setStatusFilter(statusFilter === "atencao" ? "todos" : "atencao")}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-warning/10 text-warning group-hover:bg-warning group-hover:text-warning-foreground transition-colors">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-3xl font-bold text-warning">{atencaoCount}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">A Vencer</p>
            <Progress value={totalItems > 0 ? (atencaoCount / totalItems) * 100 : 0} className="mt-2 h-1.5 [&>div]:bg-warning" />
          </CardContent>
        </Card>

        {/* Vigentes */}
        <Card className="group hover:shadow-md transition-all duration-200 hover:border-success/30 cursor-pointer"
          onClick={() => setStatusFilter(statusFilter === "vigente" ? "todos" : "vigente")}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-success/10 text-success group-hover:bg-success group-hover:text-success-foreground transition-colors">
                <CheckCircle className="w-4 h-4" />
              </div>
              <span className="text-3xl font-bold text-success">{vigentesCount}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Vigentes</p>
            <Progress value={totalItems > 0 ? (vigentesCount / totalItems) * 100 : 0} className="mt-2 h-1.5 [&>div]:bg-success" />
          </CardContent>
        </Card>

        {/* Documentos Pendentes */}
        <Card className="group hover:shadow-md transition-all duration-200 hover:border-orange-500/30 cursor-pointer"
          onClick={() => setStatusFilter(statusFilter === "pendente" ? "todos" : "pendente" as StatusFilter)}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <FileWarning className="w-4 h-4" />
              </div>
              <span className="text-3xl font-bold text-orange-500">{pendentesCount}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Doc. Pendentes</p>
            <Progress value={totalItems > 0 ? (pendentesCount / totalItems) * 100 : 0} className="mt-2 h-1.5 [&>div]:bg-orange-500" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome ou curso..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
            <SelectItem value="pendente">📄 Doc. Pendentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="lista" className="gap-1.5"><List className="w-4 h-4" />Lista</TabsTrigger>
          <TabsTrigger value="matriz" className="gap-1.5"><LayoutGrid className="w-4 h-4" />Matriz</TabsTrigger>
          
          <TabsTrigger value="ia" className="gap-1.5"><Brain className="w-4 h-4" />Validação IA</TabsTrigger>
          <TabsTrigger value="requisitos" className="gap-1.5"><Briefcase className="w-4 h-4" />Requisitos por Função</TabsTrigger>
          <TabsTrigger value="cadastro" className="gap-1.5"><BookOpen className="w-4 h-4" />Cursos e Documentação</TabsTrigger>
        </TabsList>

        {/* === ABA LISTA === */}
        <TabsContent value="lista">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">Nº</TableHead>
                      <TableHead>Nome Completo</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Nome do Curso</TableHead>
                      <TableHead>Data Realização</TableHead>
                      <TableHead>Renovação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Doc. Protocolada</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhum treinamento cadastrado</TableCell></TableRow>
                    ) : filtered.map((t, index) => {
                      const func = funcMap[t.funcionario_id];
                      const status = getStatus(t.data_renovacao);
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-center font-medium text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{func?.nome || "—"}</TableCell>
                          <TableCell>{func?.cargo || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{func?.setor || "—"}</TableCell>
                          <TableCell>{t.nome_curso}</TableCell>
                          <TableCell className="font-mono text-xs">{format(parseISO(t.data_realizacao), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="font-mono text-xs">{isPermanentDate(t.data_renovacao) ? "Vitalício / Permanente" : t.data_renovacao ? format(parseISO(t.data_renovacao), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={status.variant}
                              className={
                                status.key === "permanente" ? "bg-blue-500/10 text-blue-600 border-blue-300" :
                                status.key === "vencido" ? "bg-destructive/10 text-destructive border-destructive/20" :
                                status.key === "atencao" ? "bg-warning/10 text-warning border-warning/20" :
                                "bg-success/10 text-success border-success/20"
                              }
                            >
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {t.documento_pendente ? (
                              <div className="flex flex-wrap gap-1">
                                {t.documento_pendente.split(" | ").filter(Boolean).map(doc => (
                                  <Badge key={doc} variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                                    <CheckCircle className="w-3 h-3 mr-1" />{doc}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
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

        {/* === ABA MATRIZ === */}
        <TabsContent value="matriz">
          <Card className={matrizFullscreen ? "fixed inset-0 z-50 rounded-none m-0" : ""}>
            <CardContent className="p-0">
              {/* Fullscreen toggle */}
              <div className="flex justify-end p-2 border-b border-border/30">
                <Button size="sm" variant="outline" onClick={() => setMatrizFullscreen(f => !f)} className="gap-1.5 text-xs">
                  {matrizFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {matrizFullscreen ? "Sair Tela Cheia" : "Tela Cheia"}
                </Button>
              </div>
              {loading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : matrixData.cursos.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">Nenhum treinamento cadastrado</div>
              ) : (
                <div className={`overflow-auto relative ${matrizFullscreen ? "max-h-[calc(100vh-50px)]" : "max-h-[70vh]"}`}>
                  <style>{`
                    .matrix-sticky-shadow { box-shadow: 4px 0 8px -2px rgba(0,0,0,0.15); }
                  `}</style>
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 z-30">
                      <tr className="bg-primary text-primary-foreground">
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-center font-bold sticky left-0 bg-primary z-40 min-w-[36px] w-[36px]">Nº</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold sticky left-[36px] bg-primary z-40 min-w-[220px] matrix-sticky-shadow">COLABORADOR</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold min-w-[100px]">CPF</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold min-w-[120px]">FUNÇÃO</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold min-w-[100px]">SETOR</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-center font-bold min-w-[140px] max-w-[180px]">PENDENTES</th>
                        {matrixData.cursos.map(curso => (
                          <th key={curso} colSpan={3} className="border border-border/30 px-2 py-2 text-center font-bold min-w-[280px] bg-primary/90">
                            {curso}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-primary/80 text-primary-foreground">
                        {matrixData.cursos.flatMap(curso => [
                            <th key={`${curso}-data`} className="border border-border/30 px-1 py-1.5 text-center font-medium min-w-[90px]">ÚLTIMA DATA</th>,
                            <th key={`${curso}-ren`} className="border border-border/30 px-1 py-1.5 text-center font-medium min-w-[100px]">DATA RENOVAÇÃO</th>,
                            <th key={`${curso}-st`} className="border border-border/30 px-1 py-1.5 text-center font-medium min-w-[80px]">STATUS</th>,
                        ])}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.rows.map((row, idx) => {
                        const isEven = idx % 2 === 0;
                        const stickyBg = isEven
                          ? "bg-[hsl(var(--background))]"
                          : "bg-[hsl(var(--muted))]";
                        return (
                        <tr key={row.func.id} className={`${stickyBg} h-[44px]`}>
                          <td className={`border border-border/30 px-2 py-1.5 text-center font-mono sticky left-0 z-20 ${stickyBg}`}>{idx + 1}</td>
                          <td className={`border border-border/30 px-2 py-1.5 font-medium sticky left-[36px] z-20 whitespace-nowrap ${stickyBg} matrix-sticky-shadow`}>
                            <div className="flex items-center gap-1">
                              <span className="truncate max-w-[170px]">{row.func.nome}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 shrink-0"
                                onClick={() => openDispensaDialog(row.func.id)}
                                title="Dispensar requisitos"
                              >
                                <Settings2 className="w-3 h-3 text-primary" />
                              </Button>
                            </div>
                          </td>
                          <td className="border border-border/30 px-2 py-1.5 font-mono text-[10px]">{row.func.cpf || "—"}</td>
                          <td className="border border-border/30 px-2 py-1.5 text-[10px]">{row.func.cargo || "—"}</td>
                          <td className="border border-border/30 px-2 py-1.5 text-muted-foreground text-[10px]">{row.func.setor || "—"}</td>
                          <td className="border border-border/30 px-1 py-1.5 text-center max-w-[180px]">
                            {row.autoPendentes.length > 0 ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="flex flex-wrap gap-0.5 justify-center cursor-pointer">
                                    {row.autoPendentes.slice(0, 2).map(d => {
                                      const cursoName = d.replace(" (Vencido)", "");
                                      const shortName = cursoName.length > 12 ? cursoName.substring(0, 10) + "…" : cursoName;
                                      return (
                                        <Badge
                                          key={`auto-${d}`}
                                          variant="outline"
                                          className="text-[7px] leading-tight px-1 py-0 bg-destructive/10 text-destructive border-destructive/30"
                                          title={cursoName}
                                        >
                                          {shortName}
                                        </Badge>
                                      );
                                    })}
                                    {row.autoPendentes.length > 2 && (
                                      <Badge variant="outline" className="text-[7px] leading-tight px-1 py-0 bg-warning/10 text-warning border-warning/30">
                                        +{row.autoPendentes.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-2">
                                  <p className="text-xs font-semibold mb-1.5">Pendências ({row.autoPendentes.length})</p>
                                  <div className="flex flex-col gap-1">
                                    {row.autoPendentes.map(d => {
                                      const cursoName = d.replace(" (Vencido)", "");
                                      return (
                                        <Badge
                                          key={`full-${d}`}
                                          variant="outline"
                                          className="text-[9px] cursor-pointer hover:opacity-80 bg-destructive/10 text-destructive border-destructive/30 justify-start"
                                          onClick={() => openNewWithCourse(row.func.id, cursoName)}
                                          title={`Clique para cadastrar: ${cursoName}`}
                                        >
                                          {d}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-success/30">✓ Conforme</Badge>
                            )}
                          </td>
                          {matrixData.cursos.flatMap(curso => {
                            const cd = row.cursoData[curso];
                            const cursoKey = normalizeCourseName(curso);
                            const isProtocolado = row.protocolados.has(cursoKey);
                            const isDispensado = row.dispensados.has(cursoKey);

                            if (isDispensado) {
                              return [
                                <td key={`${row.func.id}-${curso}-d`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">—</td>,
                                <td key={`${row.func.id}-${curso}-r`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">—</td>,
                                <td key={`${row.func.id}-${curso}-s`} className="border border-border/30 px-1 py-1.5 text-center text-[10px] bg-muted text-muted-foreground font-bold">
                                  N/A
                                </td>,
                              ];
                            }
                            
                            const isRequiredAndMissing = row.requiredCourseNames.has(cursoKey) && !cd && !isProtocolado;
                            
                            if (!cd && isProtocolado) {
                              return [
                                <td key={`${row.func.id}-${curso}-d`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">—</td>,
                                <td key={`${row.func.id}-${curso}-r`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">—</td>,
                                <td key={`${row.func.id}-${curso}-s`} className="border border-border/30 px-1 py-1.5 text-center text-[10px] bg-success text-success-foreground font-bold">
                                  VÁLIDO
                                </td>,
                              ];
                            }
                            if (!cd) {
                              return [
                                <td key={`${row.func.id}-${curso}-d`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">{isRequiredAndMissing ? "⚠️" : "—"}</td>,
                                <td key={`${row.func.id}-${curso}-r`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">{isRequiredAndMissing ? "⚠️" : "—"}</td>,
                                <td key={`${row.func.id}-${curso}-s`} className={`border border-border/30 px-1 py-1.5 text-center text-[10px] font-bold ${isRequiredAndMissing ? "bg-warning text-warning-foreground" : "text-muted-foreground"}`}>
                                  {isRequiredAndMissing ? "PENDENTE" : "—"}
                                </td>,
                              ];
                            }
                            const statusBg = cd.status.key === "permanente"
                              ? "bg-primary text-primary-foreground font-bold"
                              : cd.status.key === "vencido"
                              ? "bg-destructive text-destructive-foreground font-bold"
                              : cd.status.key === "atencao"
                              ? "bg-warning text-warning-foreground font-bold"
                              : "bg-success text-success-foreground font-bold";
                            return [
                              <td key={`${row.func.id}-${curso}-d`} className="border border-border/30 px-1 py-1.5 text-center font-mono text-[10px]">
                                {format(parseISO(cd.realizacao), "dd/MM/yyyy")}
                              </td>,
                              <td key={`${row.func.id}-${curso}-r`} className="border border-border/30 px-1 py-1.5 text-center font-mono text-[10px]">
                                {isPermanentDate(cd.renovacao) ? "∞" : cd.renovacao ? format(parseISO(cd.renovacao), "dd/MM/yyyy") : "—"}
                              </td>,
                              <td key={`${row.func.id}-${curso}-s`} className={`border border-border/30 px-1 py-1.5 text-center text-[10px] ${statusBg}`}>
                                {cd.status.key === "permanente" ? "∞ Entregue" : cd.status.key === "vencido" ? "Vencido" : cd.status.key === "atencao" ? "Atenção" : "Válido"}
                              </td>,
                            ];
                          })}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* === ABA VALIDAÇÃO IA === */}
        <TabsContent value="ia">
          <Card>
            <CardContent className="p-6">
              <AIDocumentValidator
                funcionarios={funcionarios}
                cursos={CURSOS_SUGERIDOS}
                empresaId={empresaId}
                onComplete={fetchData}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ABA REQUISITOS POR FUNÇÃO === */}
        <TabsContent value="requisitos">
          <Card>
            <CardContent className="p-6">
              <CadastroFuncaoRequisitos onUpdate={fetchCursosDB} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ABA CADASTRO DE CURSOS === */}
        <TabsContent value="cadastro">
          <CadastroCursos onUpdate={fetchCursosDB} />
        </TabsContent>
      </Tabs>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={multiMode && !editing ? "max-w-3xl max-h-[90vh] overflow-y-auto" : "max-w-lg max-h-[85vh] overflow-y-auto"}>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Treinamento" : multiMode ? "Adicionar Vários Documentos" : "Adicionar Novo Treinamento"}
            </DialogTitle>
          </DialogHeader>

          {/* ===== MULTI MODE ===== */}
          {multiMode && !editing ? (
            <div className="grid gap-4 py-2">
              {/* Funcionário */}
              <div>
                <Label>Funcionário *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por nome, matrícula ou CPF..."
                    value={multiFuncSearch}
                    onChange={e => { setMultiFuncSearch(e.target.value); setMultiFuncId(""); }}
                    className="pl-9"
                  />
                </div>
                {multiFuncId && (
                  <div className="mt-1 text-xs text-primary font-medium">
                    ✓ {funcMap[multiFuncId]?.nome}
                  </div>
                )}
                {!multiFuncId && multiFuncSearch.trim() && (
                  <div className="border rounded-lg mt-1 max-h-48 overflow-y-auto bg-background">
                    {filteredMultiFuncionarios.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2 text-center">Nenhum funcionário encontrado</p>
                    ) : filteredMultiFuncionarios.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                        onClick={() => { setMultiFuncId(f.id); setMultiFuncSearch(f.nome); }}
                      >
                        <span className="font-medium">{f.nome}</span>
                        <span className="text-xs text-muted-foreground">{f.cargo || ""} {f.matricula ? `• ${f.matricula}` : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de cursos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Cursos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setMultiCursos(prev => [...prev, emptyCurso()])}>
                    <Plus className="w-3.5 h-3.5 mr-1" />Adicionar Curso
                  </Button>
                </div>

                {multiCursos.map((curso, idx) => {
                  const filteredC = curso.cursoSearch.trim()
                    ? CURSOS_SUGERIDOS.filter(c => normalize(c).includes(normalize(curso.cursoSearch)))
                    : CURSOS_SUGERIDOS;

                  return (
                    <Card key={idx} className="border-dashed">
                      <CardContent className="p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-muted-foreground">CURSO {idx + 1}</span>
                          {multiCursos.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMultiCursos(prev => prev.filter((_, i) => i !== idx))}>
                              <X className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>

                        {/* Curso search */}
                        <div>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder="Pesquisar ou digitar curso..."
                              value={curso.cursoSearch}
                              onChange={e => {
                                const isPerm = isPermanentCourse(e.target.value);
                                const newRen = isPerm ? "9999-12-31" : calcularRenovacao(e.target.value, curso.data_realizacao);
                                updateMultiCurso(idx, { cursoSearch: e.target.value, nome_curso: e.target.value, data_renovacao: newRen || curso.data_renovacao, showCursoList: true });
                              }}
                              onFocus={() => updateMultiCurso(idx, { showCursoList: true })}
                              className="pl-9"
                            />
                          </div>
                          {curso.showCursoList && (
                            <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto bg-background">
                              {filteredC.length === 0 ? (
                                <p className="text-xs text-muted-foreground p-2 text-center">Use o texto digitado</p>
                              ) : filteredC.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                                  onClick={() => {
                                    const isPerm = isPermanentCourse(c);
                                    const newRen = isPerm ? "9999-12-31" : calcularRenovacao(c, curso.data_realizacao);
                                    updateMultiCurso(idx, { nome_curso: c, cursoSearch: c, data_renovacao: newRen || curso.data_renovacao, showCursoList: false });
                                  }}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Checkbox Sem Vencimento */}
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`sem-venc-${idx}`}
                            checked={isPermanentDate(curso.data_renovacao)}
                            onCheckedChange={(checked) => {
                              const isChecked = !!checked;
                              updateMultiCurso(idx, { data_renovacao: isChecked ? "9999-12-31" : calcularRenovacao(curso.nome_curso, curso.data_realizacao) || "" });
                            }}
                          />
                          <Label htmlFor={`sem-venc-${idx}`} className="text-xs cursor-pointer flex items-center gap-1">
                            <Infinity className="w-3.5 h-3.5 text-blue-500" />
                            Sem Vencimento
                          </Label>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Data Realização</Label>
                            <Input type="date" value={curso.data_realizacao} onChange={e => {
                              const isPerm = isPermanentDate(curso.data_renovacao);
                              const newRen = isPerm ? "9999-12-31" : calcularRenovacao(curso.nome_curso, e.target.value);
                              updateMultiCurso(idx, { data_realizacao: e.target.value, data_renovacao: newRen || curso.data_renovacao });
                            }} />
                          </div>
                          <div>
                            <Label className="text-xs">Data Renovação</Label>
                            {isPermanentDate(curso.data_renovacao) ? (
                              <div className="flex items-center gap-1.5 h-9 px-3 rounded-md border bg-muted/50 text-xs text-blue-600 font-medium">
                                <Infinity className="w-3.5 h-3.5" /> Vitalício
                              </div>
                            ) : (
                              <>
                                <Input type="date" value={curso.data_renovacao} onChange={e => updateMultiCurso(idx, { data_renovacao: e.target.value })} />
                                {curso.nome_curso && cursosValidade[curso.nome_curso] !== undefined && cursosValidade[curso.nome_curso] > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">⏱ {cursosValidade[curso.nome_curso]} meses</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Documentação Protocolada */}
                        <div>
                          <Label className="text-xs mb-1 block">Documentação Protocolada</Label>
                          <Popover open={curso.docPopoverOpen} onOpenChange={(o) => updateMultiCurso(idx, { docPopoverOpen: o })}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className="w-full justify-between h-auto min-h-8 font-normal text-xs">
                                <span className="text-muted-foreground truncate">
                                  {curso.documento_pendente
                                    ? `${curso.documento_pendente.split(" | ").filter(Boolean).length} doc(s)`
                                    : "Selecione..."}
                                </span>
                                <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Pesquisar documento..." />
                                <CommandList>
                                  <CommandEmpty>Nenhum documento encontrado.</CommandEmpty>
                                  <CommandGroup>
                                    {DOCUMENTOS_LISTA.map(doc => {
                                      const docs = curso.documento_pendente ? curso.documento_pendente.split(" | ").filter(Boolean) : [];
                                      const isSelected = docs.includes(doc);
                                      return (
                                        <CommandItem
                                          key={doc}
                                          value={doc}
                                          onSelect={() => {
                                            const currentDocs = curso.documento_pendente ? curso.documento_pendente.split(" | ").filter(Boolean) : [];
                                            const updated = isSelected
                                              ? currentDocs.filter(d => d !== doc)
                                              : [...currentDocs, doc];
                                            updateMultiCurso(idx, { documento_pendente: updated.join(" | ") });
                                          }}
                                        >
                                          <Check className={`mr-2 h-3 w-3 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                                          <span className="text-xs">{doc}</span>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {curso.documento_pendente && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {curso.documento_pendente.split(" | ").filter(Boolean).map(doc => (
                                <Badge key={doc} variant="secondary" className="text-[10px] gap-0.5">
                                  {doc}
                                  <X className="h-2.5 w-2.5 cursor-pointer hover:text-destructive" onClick={() => {
                                    const updated = curso.documento_pendente.split(" | ").filter(Boolean).filter(d => d !== doc);
                                    updateMultiCurso(idx, { documento_pendente: updated.join(" | ") });
                                  }} />
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ===== SINGLE MODE (original) ===== */
            <div className="grid gap-4 py-2">
              {/* Funcionário com pesquisa */}
              <div>
                <Label>Funcionário *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por nome, matrícula ou CPF..."
                    value={funcSearch}
                    onChange={e => { setFuncSearch(e.target.value); setForm({ ...form, funcionario_id: "" }); setShowFuncList(true); }}
                    onFocus={() => setShowFuncList(true)}
                    onBlur={() => setTimeout(() => setShowFuncList(false), 200)}
                    className="pl-9"
                  />
                </div>
                {form.funcionario_id && (
                  <div className="mt-1 text-xs text-primary font-medium">
                    ✓ {funcMap[form.funcionario_id]?.nome}
                  </div>
                )}
                {!form.funcionario_id && showFuncList && (
                  <div className="border rounded-lg mt-1 max-h-40 overflow-y-auto bg-background">
                    {filteredFuncionarios.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2 text-center">Nenhum funcionário encontrado</p>
                    ) : filteredFuncionarios.slice(0, 50).map(f => (
                      <button
                        key={f.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                        onClick={() => { setForm({ ...form, funcionario_id: f.id }); setFuncSearch(f.nome); setShowFuncList(false); }}
                      >
                        <span className="font-medium">{f.nome}</span>
                        <span className="text-xs text-muted-foreground">{f.cargo || ""} {f.matricula ? `• ${f.matricula}` : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Nome do Curso com lista suspensa */}
              <div>
                <Label>Nome do Curso *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar ou digitar curso..."
                    value={cursoSearch}
                    onChange={e => {
                      setCursoSearch(e.target.value);
                      const isPerm = isPermanentCourse(e.target.value);
                      const newRenovacao = isPerm ? "9999-12-31" : calcularRenovacao(e.target.value, form.data_realizacao);
                      setForm({ ...form, nome_curso: e.target.value, data_renovacao: newRenovacao || form.data_renovacao, sem_vencimento: isPerm });
                      setShowCursoList(e.target.value.trim().length > 0);
                    }}
                    onBlur={() => setTimeout(() => setShowCursoList(false), 200)}
                    className="pl-9"
                  />
                </div>
                {showCursoList && cursoSearch.trim() && (
                  <div className="border rounded-lg mt-1 max-h-40 overflow-y-auto bg-background">
                    {filteredCursos.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2 text-center">Nenhuma sugestão — use o texto digitado</p>
                    ) : filteredCursos.map(c => (
                      <button
                        key={c}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => {
                          const isPerm = isPermanentCourse(c);
                          const newRenovacao = isPerm ? "9999-12-31" : calcularRenovacao(c, form.data_realizacao);
                          setForm({ ...form, nome_curso: c, data_renovacao: newRenovacao || form.data_renovacao, sem_vencimento: isPerm });
                          setCursoSearch(c);
                          setShowCursoList(false);
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Checkbox: Documento Sem Vencimento */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sem-vencimento"
                  checked={form.sem_vencimento}
                  onCheckedChange={(checked) => {
                    const isChecked = !!checked;
                    setForm({ ...form, sem_vencimento: isChecked, data_renovacao: isChecked ? "9999-12-31" : calcularRenovacao(form.nome_curso, form.data_realizacao) || "" });
                  }}
                />
                <Label htmlFor="sem-vencimento" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <Infinity className="w-4 h-4 text-blue-500" />
                  Documento Sem Vencimento (Carga Única / Permanente)
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de Realização</Label>
                  <Input type="date" value={form.data_realizacao} onChange={e => {
                    const newRenovacao = form.sem_vencimento ? "9999-12-31" : calcularRenovacao(form.nome_curso, e.target.value);
                    setForm({ ...form, data_realizacao: e.target.value, data_renovacao: newRenovacao || form.data_renovacao });
                  }} />
                </div>
                <div>
                  <Label>Data de Renovação/Reciclagem</Label>
                  {form.sem_vencimento ? (
                    <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50 text-sm text-blue-600 font-medium">
                      <Infinity className="w-4 h-4" /> Vitalício / Permanente
                    </div>
                  ) : (
                    <Input type="date" value={form.data_renovacao} onChange={e => setForm({ ...form, data_renovacao: e.target.value })} />
                  )}
                  {!form.sem_vencimento && form.nome_curso && cursosValidade[form.nome_curso] !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ⏱ Validade: {cursosValidade[form.nome_curso] === 0 ? "Sem renovação" : `${cursosValidade[form.nome_curso]} meses`}
                      {cursosValidade[form.nome_curso] > 0 && " (calculado automaticamente)"}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Documentação Protocolada</Label>
                <Popover open={docPopoverOpen} onOpenChange={setDocPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={docPopoverOpen} className="w-full justify-between h-auto min-h-10 font-normal">
                      <span className="text-sm text-muted-foreground truncate">
                        {form.documento_pendente
                          ? `${form.documento_pendente.split(" | ").filter(Boolean).length} documento(s) protocolado(s)`
                          : "Selecione os documentos entregues..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar documento..." />
                      <CommandList>
                        <CommandEmpty>Nenhum documento encontrado.</CommandEmpty>
                        <CommandGroup>
                          {DOCUMENTOS_LISTA.map(doc => {
                            const docs = form.documento_pendente ? form.documento_pendente.split(" | ").filter(Boolean) : [];
                            const isSelected = docs.includes(doc);
                            return (
                              <CommandItem
                                key={doc}
                                value={doc}
                                onSelect={() => {
                                  const currentDocs = form.documento_pendente ? form.documento_pendente.split(" | ").filter(Boolean) : [];
                                  const updated = isSelected
                                    ? currentDocs.filter(d => d !== doc)
                                    : [...currentDocs, doc];
                                  setForm({ ...form, documento_pendente: updated.join(" | ") });
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                                {doc}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {form.documento_pendente && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.documento_pendente.split(" | ").filter(Boolean).map(doc => (
                      <Badge key={doc} variant="secondary" className="text-xs gap-1">
                        {doc}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => {
                            const updated = form.documento_pendente.split(" | ").filter(Boolean).filter(d => d !== doc);
                            setForm({ ...form, documento_pendente: updated.join(" | ") });
                          }}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {multiMode && !editing ? (
              <Button onClick={handleSaveMulti} disabled={savingMulti}>
                {savingMulti ? "Salvando..." : `Cadastrar ${multiCursos.filter(c => c.nome_curso.trim() || c.documento_pendente.trim()).length} item(ns)`}
              </Button>
            ) : (
              <Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DIALOG DISPENSAR REQUISITOS === */}
      <Dialog open={dispensaDialogOpen} onOpenChange={setDispensaDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5" />
              Dispensar Requisitos — {funcMap[dispensaFuncId]?.nome}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Marque os cursos/documentos que <strong>não se aplicam</strong> a este colaborador. Eles serão removidos das pendências e exibidos como "N/A" na Matriz.
          </p>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {getRequiredCourses(funcMap[dispensaFuncId]?.cargo ?? null).map(req => (
              <label key={req.curso_nome} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={dispensaCursosSelecionados.includes(req.curso_nome)}
                  onCheckedChange={(checked) => {
                    setDispensaCursosSelecionados(prev =>
                      checked ? [...prev, req.curso_nome] : prev.filter(c => c !== req.curso_nome)
                    );
                  }}
                />
                <span className="text-sm">{req.curso_nome}</span>
              </label>
            ))}
          </div>
          {dispensaCursosSelecionados.length > 0 && (
            <div className="space-y-2">
              <Label>Motivo da Dispensa</Label>
              <Textarea
                placeholder="Ex: Colaborador não conduz veículo da empresa"
                value={dispensaMotivo}
                onChange={e => setDispensaMotivo(e.target.value)}
                rows={2}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispensaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDispensas} disabled={savingDispensa}>
              {savingDispensa ? "Salvando..." : "Salvar Dispensas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

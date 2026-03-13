import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, GraduationCap, AlertTriangle, CheckCircle, Clock, Download, TrendingUp, FileWarning, Check, ChevronsUpDown, X, LayoutGrid, List, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

interface Funcionario { id: string; nome: string; cargo: string | null; cpf: string | null; matricula: string | null; }

type StatusFilter = "todos" | "vencido" | "atencao" | "vigente" | "pendente";

function getStatus(dataRenovacao: string | null): { label: string; variant: "destructive" | "outline" | "default"; key: string } {
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
  const [form, setForm] = useState({
    funcionario_id: "",
    nome_curso: "",
    data_realizacao: new Date().toISOString().split("T")[0],
    data_renovacao: "",
    documento_pendente: "",
  });
  const [funcSearch, setFuncSearch] = useState("");
  const [showFuncList, setShowFuncList] = useState(false);
  const [cursoSearch, setCursoSearch] = useState("");
  const [showCursoList, setShowCursoList] = useState(false);

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
    const [{ data: treinos }, { data: funcs }] = await Promise.all([
      (supabase.from as any)("controle_treinamentos").select("*").order("data_renovacao", { ascending: true, nullsFirst: false }),
      supabase.from("funcionarios").select("id, nome, cargo, cpf, matricula"),
    ]);
    if (treinos) setItems(treinos);
    if (funcs) setFuncionarios(funcs);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const funcMap = useMemo(() => {
    const m: Record<string, Funcionario> = {};
    funcionarios.forEach(f => { m[f.id] = f; });
    return m;
  }, [funcionarios]);

  // Mapeamento curso → validade em meses
  const CURSOS_VALIDADE: Record<string, number> = {
    "NR-10 Básico": 24,
    "NR-10 Complementar (SEP)": 24,
    "NR-12": 24,
    "NR-17 - Transporte Manual de Carga": 24,
    "NR-18 - Integração": 6,
    "NR-20": 12,
    "NR-33": 12,
    "NR-35": 24,
    "POP 00": 12,
    "POP 05": 12,
    "Treinamento Inicial": 0,
    "Guardião da Vida": 12,
    "Direção Defensiva": 12,
    "Liderança": 24,
    "Sinaleiro / Amarrador de Carga": 12,
    "Cargas Indivisíveis": 12,
    "Operador Guindaste": 12,
    "Operador Guindauto": 12,
    "Operação de Cesto Aéreo/Acoplado": 12,
    "Operação de Motosserra": 12,
    "Montagem Eletromecânica SE": 24,
    "Curso de Transporte de Passageiros": 12,
    "Curso de Motorista de Ambulância": 12,
    "Capacitação sobre Procedimento Operacional": 12,
    "Poda e Manejo Vegetal": 12,
    "Operação de Martelete": 12,
    "Operação de Máquinas": 12,
  };

  const CURSOS_SUGERIDOS = Object.keys(CURSOS_VALIDADE);

  const calcularRenovacao = (curso: string, dataRealizacao: string): string => {
    const meses = CURSOS_VALIDADE[curso];
    if (meses === undefined || meses === 0 || !dataRealizacao) return "";
    const data = parseISO(dataRealizacao);
    const renovacao = new Date(data);
    renovacao.setMonth(renovacao.getMonth() + meses);
    return format(renovacao, "yyyy-MM-dd");
  };

  const DOCUMENTOS_LISTA = [
    "Ordem de Serviço",
    "Ficha de EPI",
    "ASO",
    "Ficha de Registro do Empregado",
    "Termo de Anuência - NR10",
    "Termo de Anuência - NR12",
    "Termo de Anuência - NR33",
    "Termo de Anuência - NR35",
    "Anuência da Empresa (Condução de Veículo)",
    "Registro no Conselho de Classe",
    "Certificado de Treinamento",
    "Comprovante de Escolaridade",
    "Licença de Porte e Uso - LPU",
    "Procedimento Operacional",
    "Procedimento Seg. Máq. e Equipamentos",
    "Edital",
    "CTPS Digital",
    "CNH (Categoria)",
    "Declaração de Saúde",
    "Termo de Responsabilidade",
    "Contrato de Trabalho",
    "Comprovante de Residência",
    "Certidão Negativa",
    "Laudo Técnico",
    "PGR / PCMSO",
    "PPRA",
    "LTCAT",
  ];

  const [docPopoverOpen, setDocPopoverOpen] = useState(false);

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredFuncionarios = useMemo(() => {
    if (!funcSearch.trim()) return funcionarios;
    const q = normalize(funcSearch);
    return funcionarios.filter(f =>
      normalize(f.nome).includes(q) ||
      (f.matricula && f.matricula.toLowerCase().includes(q)) ||
      (f.cpf && f.cpf.replace(/\D/g, "").includes(q.replace(/\D/g, "")))
    );
  }, [funcionarios, funcSearch]);

  const filteredCursos = useMemo(() => {
    if (!cursoSearch.trim()) return CURSOS_SUGERIDOS;
    const q = normalize(cursoSearch);
    return CURSOS_SUGERIDOS.filter(c => normalize(c).includes(q));
  }, [cursoSearch]);

  const filtered = useMemo(() => {
    let list = [...items];
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
  }, [items, search, statusFilter, funcMap]);

  const openNew = () => {
    setEditing(null);
    setMultiMode(false);
    setForm({ funcionario_id: "", nome_curso: "", data_realizacao: new Date().toISOString().split("T")[0], data_renovacao: "", documento_pendente: "" });
    setFuncSearch(""); setCursoSearch(""); setShowCursoList(false);
    setMultiCursos([emptyCurso()]);
    setMultiFuncId("");
    setMultiFuncSearch("");
    setOpen(true);
  };

  const openNewMulti = () => {
    setEditing(null);
    setMultiMode(true);
    setForm({ funcionario_id: "", nome_curso: "", data_realizacao: new Date().toISOString().split("T")[0], data_renovacao: "", documento_pendente: "" });
    setFuncSearch(""); setCursoSearch(""); setShowCursoList(false);
    setMultiCursos([emptyCurso()]);
    setMultiFuncId("");
    setMultiFuncSearch("");
    setOpen(true);
  };

  const openEdit = (t: ControleTreinamento) => {
    setEditing(t);
    setForm({
      funcionario_id: t.funcionario_id,
      nome_curso: t.nome_curso,
      data_realizacao: t.data_realizacao,
      data_renovacao: t.data_renovacao || "",
      documento_pendente: t.documento_pendente || "",
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
    const validCursos = multiCursos.filter(c => c.nome_curso.trim());
    if (validCursos.length === 0) {
      toast({ title: "Adicione pelo menos um curso", variant: "destructive" });
      return;
    }
    setSavingMulti(true);
    const payloads = validCursos.map(c => ({
      funcionario_id: multiFuncId,
      nome_curso: c.nome_curso,
      data_realizacao: c.data_realizacao,
      data_renovacao: c.data_renovacao || null,
      documento_pendente: c.documento_pendente || null,
      empresa_id: empresaId,
    }));
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
    if (!multiFuncSearch.trim()) return funcionarios;
    const q = normalize(multiFuncSearch);
    return funcionarios.filter(f =>
      normalize(f.nome).includes(q) ||
      (f.matricula && f.matricula.toLowerCase().includes(q)) ||
      (f.cpf && f.cpf.replace(/\D/g, "").includes(q.replace(/\D/g, "")))
    );
  }, [funcionarios, multiFuncSearch]);

  const handleDelete = async (id: string) => {
    await (supabase.from as any)("controle_treinamentos").delete().eq("id", id);
    fetchData();
  };

  const handleExportExcel = () => {
    const cursoSet = new Set<string>();
    items.forEach(t => cursoSet.add(t.nome_curso));
    const cursos = Array.from(cursoSet).sort();
    const funcIds = Array.from(new Set(items.map(t => t.funcionario_id)));

    // Build worksheet manually for full style control
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];

    // Header row 1: Nº, COLABORADOR, CPF, FUNÇÃO, PENDENTES, then each course spans 3 cols
    const header1: any[] = ["Nº", "COLABORADOR", "CPF", "FUNÇÃO", "PENDENTES"];
    cursos.forEach(curso => { header1.push(curso, "", ""); });
    wsData.push(header1);

    // Header row 2: sub-headers under each course
    const header2: any[] = ["", "", "", "", ""];
    cursos.forEach(() => { header2.push("ÚLTIMA DATA", "DATA RENOVAÇÃO", "STATUS"); });
    wsData.push(header2);

    // Data rows
    funcIds.forEach((fid, idx) => {
      const func = funcMap[fid];
      if (!func) return;
      const treinos = items.filter(t => t.funcionario_id === fid);
      const docsSet = new Set<string>();
      treinos.forEach(t => {
        if (t.documento_pendente) t.documento_pendente.split(" | ").filter(Boolean).forEach(d => docsSet.add(d));
      });
      const row: any[] = [idx + 1, func.nome, func.cpf || "—", func.cargo || "—", docsSet.size > 0 ? Array.from(docsSet).join(", ") : "—"];
      cursos.forEach(curso => {
        const t = treinos.find(tr => tr.nome_curso === curso);
        if (!t) {
          row.push("—", "—", "—");
        } else {
          const s = getStatus(t.data_renovacao);
          row.push(
            t.data_realizacao ? format(parseISO(t.data_realizacao), "dd/MM/yyyy") : "—",
            t.data_renovacao ? format(parseISO(t.data_renovacao), "dd/MM/yyyy") : "—",
            s.key === "vencido" ? "Vencido" : s.key === "atencao" ? "Atenção" : "Válido"
          );
        }
      });
      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge header cells for course names (row 1)
    const merges: XLSX.Range[] = [];
    cursos.forEach((_, i) => {
      const startCol = 5 + i * 3;
      merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 2 } });
    });
    // Merge Nº, COLABORADOR, CPF, FUNÇÃO, OBS across 2 header rows
    for (let c = 0; c < 5; c++) {
      merges.push({ s: { r: 0, c }, e: { r: 1, c } });
    }
    ws["!merges"] = merges;

    // Column widths
    const colWidths: { wch: number }[] = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 14 }];
    cursos.forEach(() => { colWidths.push({ wch: 14 }, { wch: 16 }, { wch: 12 }); });
    ws["!cols"] = colWidths;

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

    const totalCols = 5 + cursos.length * 3;
    const totalRows = wsData.length;

    for (let R = 0; R < totalRows; R++) {
      for (let C = 0; C < totalCols; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        const cell = ws[addr];
        if (!cell.s) cell.s = {};

        cell.s.border = border;
        cell.s.font = { name: "Arial", sz: 9 };

        if (R === 0) {
          // Main header row
          cell.s.fill = headerFill;
          cell.s.font = headerFont;
          cell.s.alignment = centerAlign;
        } else if (R === 1) {
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
          if (C >= 5 && (C - 5) % 3 === 2) {
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
  const matrixData = useMemo(() => {
    const cursoSet = new Set<string>();
    items.forEach(t => cursoSet.add(t.nome_curso));
    const cursos = Array.from(cursoSet).sort();

    const funcIds = Array.from(new Set(items.map(t => t.funcionario_id)));
    const rows = funcIds.map(fid => {
      const func = funcMap[fid];
      if (!func) return null;
      const treinos = items.filter(t => t.funcionario_id === fid);
      const cursoData: Record<string, { realizacao: string; renovacao: string | null; status: ReturnType<typeof getStatus> }> = {};
      const pendentesSet = new Set<string>();
      // Collect ALL pendentes from all treinos of this employee
      treinos.forEach(t => {
        if (t.documento_pendente) {
          t.documento_pendente.split(" | ").filter(Boolean).forEach(d => pendentesSet.add(d));
        }
      });
      cursos.forEach(curso => {
        const t = treinos.find(tr => tr.nome_curso === curso);
        if (t) {
          cursoData[curso] = { realizacao: t.data_realizacao, renovacao: t.data_renovacao, status: getStatus(t.data_renovacao) };
        }
      });
      return { func, cursoData, pendentes: Array.from(pendentesSet) };
    }).filter(Boolean) as { func: Funcionario; cursoData: Record<string, { realizacao: string; renovacao: string | null; status: ReturnType<typeof getStatus> }>; pendentes: string[] }[];

    return { cursos, rows };
  }, [items, funcMap]);

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
                      <TableHead>Nome Completo</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Nome do Curso</TableHead>
                      <TableHead>Data Realização</TableHead>
                      <TableHead>Renovação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Doc. Pendente</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum treinamento cadastrado</TableCell></TableRow>
                    ) : filtered.map(t => {
                      const func = funcMap[t.funcionario_id];
                      const status = getStatus(t.data_renovacao);
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{func?.nome || "—"}</TableCell>
                          <TableCell>{func?.cargo || "—"}</TableCell>
                          <TableCell>{t.nome_curso}</TableCell>
                          <TableCell className="font-mono text-xs">{format(parseISO(t.data_realizacao), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="font-mono text-xs">{t.data_renovacao ? format(parseISO(t.data_renovacao), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={status.variant}
                              className={
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
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                                <FileWarning className="w-3 h-3 mr-1" />{t.documento_pendente}
                              </Badge>
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
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : matrixData.cursos.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">Nenhum treinamento cadastrado</div>
              ) : (
                <div className="overflow-auto max-h-[70vh]">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 z-10">
                      {/* Header row 1: grouped course names */}
                      <tr className="bg-primary text-primary-foreground">
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold sticky left-0 bg-primary z-20 min-w-[40px]">Nº</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold sticky left-[40px] bg-primary z-20 min-w-[180px]">COLABORADOR</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold min-w-[100px]">CPF</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold min-w-[120px]">FUNÇÃO</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-center font-bold min-w-[180px]">PENDENTES</th>
                        {matrixData.cursos.map(curso => (
                          <th key={curso} colSpan={3} className="border border-border/30 px-2 py-2 text-center font-bold min-w-[280px] bg-primary/90">
                            {curso}
                          </th>
                        ))}
                      </tr>
                      {/* Header row 2: sub-columns */}
                      <tr className="bg-primary/80 text-primary-foreground">
                        {matrixData.cursos.flatMap(curso => [
                            <th key={`${curso}-data`} className="border border-border/30 px-1 py-1.5 text-center font-medium min-w-[90px]">ÚLTIMA DATA</th>,
                            <th key={`${curso}-ren`} className="border border-border/30 px-1 py-1.5 text-center font-medium min-w-[100px]">DATA RENOVAÇÃO</th>,
                            <th key={`${curso}-st`} className="border border-border/30 px-1 py-1.5 text-center font-medium min-w-[80px]">STATUS</th>,
                        ])}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.rows.map((row, idx) => (
                        <tr key={row.func.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                          <td className="border border-border/30 px-2 py-1.5 text-center font-mono sticky left-0 bg-inherit z-10">{idx + 1}</td>
                          <td className="border border-border/30 px-2 py-1.5 font-medium sticky left-[40px] bg-inherit z-10 whitespace-nowrap">{row.func.nome}</td>
                          <td className="border border-border/30 px-2 py-1.5 font-mono">{row.func.cpf || "—"}</td>
                          <td className="border border-border/30 px-2 py-1.5">{row.func.cargo || "—"}</td>
                          <td className="border border-border/30 px-2 py-1.5 text-center text-xs">
                            {row.pendentes.length > 0 ? (
                              <div className="flex flex-wrap gap-0.5 justify-center">
                                {row.pendentes.map(d => (
                                  <Badge key={d} variant="outline" className="text-[9px] bg-orange-50 text-orange-700 border-orange-200">{d}</Badge>
                                ))}
                              </div>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          {matrixData.cursos.flatMap(curso => {
                            const cd = row.cursoData[curso];
                            if (!cd) {
                              return [
                                <td key={`${row.func.id}-${curso}-d`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">—</td>,
                                <td key={`${row.func.id}-${curso}-r`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">—</td>,
                                <td key={`${row.func.id}-${curso}-s`} className="border border-border/30 px-1 py-1.5 text-center text-muted-foreground">—</td>,
                              ];
                            }
                            const statusBg = cd.status.key === "vencido"
                              ? "bg-destructive text-destructive-foreground font-bold"
                              : cd.status.key === "atencao"
                              ? "bg-warning text-warning-foreground font-bold"
                              : "bg-success text-success-foreground font-bold";
                            return [
                              <td key={`${row.func.id}-${curso}-d`} className="border border-border/30 px-1 py-1.5 text-center font-mono">
                                {format(parseISO(cd.realizacao), "dd/MM/yyyy")}
                              </td>,
                              <td key={`${row.func.id}-${curso}-r`} className="border border-border/30 px-1 py-1.5 text-center font-mono">
                                {cd.renovacao ? format(parseISO(cd.renovacao), "dd/MM/yyyy") : "—"}
                              </td>,
                              <td key={`${row.func.id}-${curso}-s`} className={`border border-border/30 px-1 py-1.5 text-center text-[10px] ${statusBg}`}>
                                {cd.status.key === "vencido" ? "Vencido" : cd.status.key === "atencao" ? "Atenção" : "Válido"}
                              </td>,
                            ];
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
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
                  <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto bg-background">
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
                                const newRen = calcularRenovacao(e.target.value, curso.data_realizacao);
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
                                    const newRen = calcularRenovacao(c, curso.data_realizacao);
                                    updateMultiCurso(idx, { nome_curso: c, cursoSearch: c, data_renovacao: newRen || curso.data_renovacao, showCursoList: false });
                                  }}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Data Realização</Label>
                            <Input type="date" value={curso.data_realizacao} onChange={e => {
                              const newRen = calcularRenovacao(curso.nome_curso, e.target.value);
                              updateMultiCurso(idx, { data_realizacao: e.target.value, data_renovacao: newRen || curso.data_renovacao });
                            }} />
                          </div>
                          <div>
                            <Label className="text-xs">Data Renovação</Label>
                            <Input type="date" value={curso.data_renovacao} onChange={e => updateMultiCurso(idx, { data_renovacao: e.target.value })} />
                            {curso.nome_curso && CURSOS_VALIDADE[curso.nome_curso] !== undefined && CURSOS_VALIDADE[curso.nome_curso] > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">⏱ {CURSOS_VALIDADE[curso.nome_curso]} meses</p>
                            )}
                          </div>
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
                    onFocus={() => { if (!form.funcionario_id && funcSearch.trim()) setShowFuncList(true); }}
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
                    ) : filteredFuncionarios.slice(0, 20).map(f => (
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
                      const newRenovacao = calcularRenovacao(e.target.value, form.data_realizacao);
                      setForm({ ...form, nome_curso: e.target.value, data_renovacao: newRenovacao || form.data_renovacao });
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
                          const newRenovacao = calcularRenovacao(c, form.data_realizacao);
                          setForm({ ...form, nome_curso: c, data_renovacao: newRenovacao || form.data_renovacao });
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de Realização</Label>
                  <Input type="date" value={form.data_realizacao} onChange={e => {
                    const newRenovacao = calcularRenovacao(form.nome_curso, e.target.value);
                    setForm({ ...form, data_realizacao: e.target.value, data_renovacao: newRenovacao || form.data_renovacao });
                  }} />
                </div>
                <div>
                  <Label>Data de Renovação/Reciclagem</Label>
                  <Input type="date" value={form.data_renovacao} onChange={e => setForm({ ...form, data_renovacao: e.target.value })} />
                  {form.nome_curso && CURSOS_VALIDADE[form.nome_curso] !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ⏱ Validade: {CURSOS_VALIDADE[form.nome_curso] === 0 ? "Sem renovação" : `${CURSOS_VALIDADE[form.nome_curso]} meses`}
                      {CURSOS_VALIDADE[form.nome_curso] > 0 && " (calculado automaticamente)"}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Documentos Pendentes</Label>
                <Popover open={docPopoverOpen} onOpenChange={setDocPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={docPopoverOpen} className="w-full justify-between h-auto min-h-10 font-normal">
                      <span className="text-sm text-muted-foreground truncate">
                        {form.documento_pendente
                          ? `${form.documento_pendente.split(" | ").filter(Boolean).length} documento(s) selecionado(s)`
                          : "Selecione os documentos pendentes..."}
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
                {savingMulti ? "Salvando..." : `Cadastrar ${multiCursos.filter(c => c.nome_curso.trim()).length} curso(s)`}
              </Button>
            ) : (
              <Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, Stethoscope, AlertTriangle, CheckCircle, Clock, Download, TrendingUp, LayoutGrid, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, format, parseISO, addMonths } from "date-fns";
import * as XLSX from "xlsx-js-style";

interface Exame {
  id: string;
  funcionario_id: string;
  tipo: string;
  nome_exame: string | null;
  data: string;
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
}

type StatusFilter = "todos" | "vencido" | "atencao" | "vigente";

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

function calcularVencimento(tipo: string, dataExame: string): string {
  const meses = tipoValidade[tipo];
  if (!meses || meses === 0 || !dataExame) return "";
  const data = parseISO(dataExame);
  return format(addMonths(data, meses), "yyyy-MM-dd");
}

export default function ExamesModule() {
  const { empresaId } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Exame[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exame | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [setorFilter, setSetorFilter] = useState("");
  const [form, setForm] = useState({
    funcionario_id: "",
    tipo: "periodico",
    data: new Date().toISOString().split("T")[0],
    data_vencimento: "",
    resultado: "pendente",
    medico: "",
    observacao: "",
  });
  const [funcSearch, setFuncSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const [{ data: exames }, { data: funcs }] = await Promise.all([
      supabase.from("exames").select("*").order("data_vencimento", { ascending: true, nullsFirst: false }),
      supabase.from("funcionarios").select("id, nome, cargo, cpf, matricula, setor"),
    ]);
    if (exames) setItems(exames);
    if (funcs) setFuncionarios(funcs);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const funcMap = useMemo(() => {
    const m: Record<string, Funcionario> = {};
    funcionarios.forEach(f => { m[f.id] = f; });
    return m;
  }, [funcionarios]);

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
    if (statusFilter !== "todos") {
      list = list.filter(e => getStatus(e.data_vencimento).key === statusFilter);
    }
    list.sort((a, b) => statusOrder(a.data_vencimento) - statusOrder(b.data_vencimento));
    return list;
  }, [items, search, statusFilter, funcMap, setorFilter, funcionarios]);

  const openNew = () => {
    setEditing(null);
    setForm({ funcionario_id: "", tipo: "periodico", data: new Date().toISOString().split("T")[0], data_vencimento: calcularVencimento("periodico", new Date().toISOString().split("T")[0]), resultado: "pendente", medico: "", observacao: "" });
    setFuncSearch("");
    setOpen(true);
  };

  const openEdit = (e: Exame) => {
    setEditing(e);
    setForm({
      funcionario_id: e.funcionario_id,
      tipo: e.tipo,
      data: e.data,
      data_vencimento: e.data_vencimento || "",
      resultado: e.resultado,
      medico: e.medico || "",
      observacao: e.observacao || "",
    });
    setFuncSearch(funcMap[e.funcionario_id]?.nome || "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.funcionario_id) {
      toast({ title: "Selecione um funcionário", variant: "destructive" });
      return;
    }
    const payload = {
      funcionario_id: form.funcionario_id,
      tipo: form.tipo as "admissional" | "periodico" | "demissional" | "retorno" | "mudanca_funcao",
      data: form.data,
      data_vencimento: form.data_vencimento || null,
      resultado: form.resultado as "apto" | "inapto" | "apto_com_restricao" | "pendente",
      medico: form.medico || null,
      observacao: form.observacao || null,
      empresa_id: empresaId,
    };
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
    const { error } = await supabase.from("exames").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Exame excluído" });
    fetchData();
  };

  // Export Excel (uses filtered data)
  const handleExportExcel = async () => {
    let empresaNome = "", empresaCnpj = "", empresaEndereco = "", empresaTelefone = "", empresaEmail = "";
    if (empresaId) {
      const { data: empData } = await supabase.from("empresa_config").select("*").eq("id", empresaId).limit(1);
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
    const tiposUsados = Array.from(new Set(exportItems.map(e => e.tipo))).sort();
    const funcIds = Array.from(new Set(exportItems.map(e => e.funcionario_id)));
    const fixedCols = 5; // Nº, COLABORADOR, CPF, FUNÇÃO, SETOR
    const totalCols = fixedCols + tiposUsados.length * 3;

    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];
    const HEADER_OFFSET = 5;

    wsData.push([empresaNome || ""]);
    wsData.push([empresaCnpj ? `CNPJ: ${empresaCnpj}` : ""]);
    wsData.push([empresaEndereco || ""]);
    wsData.push([[empresaTelefone, empresaEmail].filter(Boolean).join(" | ") || ""]);
    wsData.push([""]);

    const header1: any[] = ["Nº", "COLABORADOR", "CPF", "FUNÇÃO", "SETOR"];
    tiposUsados.forEach(t => { header1.push(tipoLabels[t] || t, "", ""); });
    wsData.push(header1);

    const header2: any[] = ["", "", "", "", ""];
    tiposUsados.forEach(() => { header2.push("DATA EXAME", "VENCIMENTO", "STATUS"); });
    wsData.push(header2);

    funcIds.forEach((fid, idx) => {
      const func = funcMap[fid];
      if (!func) return;
      const exames = exportItems.filter(e => e.funcionario_id === fid);
      const row: any[] = [idx + 1, func.nome, func.cpf || "—", func.cargo || "—", func.setor || "—"];
      tiposUsados.forEach(tipo => {
        const e = exames.find(ex => ex.tipo === tipo);
        if (!e) {
          row.push("—", "—", "—");
        } else {
          const s = getStatus(e.data_vencimento);
          row.push(
            e.data ? format(parseISO(e.data), "dd/MM/yyyy") : "—",
            e.data_vencimento ? format(parseISO(e.data_vencimento), "dd/MM/yyyy") : "—",
            s.key === "vencido" ? "Vencido" : s.key === "atencao" ? "Atenção" : "Válido"
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
    tiposUsados.forEach((_, i) => {
      const startCol = fixedCols + i * 3;
      merges.push({ s: { r: HEADER_OFFSET, c: startCol }, e: { r: HEADER_OFFSET, c: startCol + 2 } });
    });
    for (let c = 0; c < fixedCols; c++) {
      merges.push({ s: { r: HEADER_OFFSET, c }, e: { r: HEADER_OFFSET + 1, c } });
    }
    ws["!merges"] = merges;

    const colWidths: { wch: number }[] = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 16 }];
    tiposUsados.forEach(() => { colWidths.push({ wch: 14 }, { wch: 14 }, { wch: 12 }); });
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

  const totalItems = items.length;
  const vencidosCount = items.filter(e => getStatus(e.data_vencimento).key === "vencido").length;
  const atencaoCount = items.filter(e => getStatus(e.data_vencimento).key === "atencao").length;
  const vigentesCount = items.filter(e => getStatus(e.data_vencimento).key === "vigente").length;
  const conformidade = totalItems > 0 ? Math.round((vigentesCount / totalItems) * 100) : 100;

  // Matrix data: group by employee, tipos as columns
  const matrixData = useMemo(() => {
    const tiposUsados = Array.from(new Set(items.map(e => e.tipo))).sort();
    const funcIds = Array.from(new Set(items.map(e => e.funcionario_id)));
    const rows = funcIds.map(fid => {
      const func = funcMap[fid];
      if (!func) return null;
      const exames = items.filter(e => e.funcionario_id === fid);
      const tipoData: Record<string, { data: string; vencimento: string | null; resultado: string; status: ReturnType<typeof getStatus> }> = {};
      tiposUsados.forEach(tipo => {
        // Get most recent exam of this type
        const sorted = exames.filter(e => e.tipo === tipo).sort((a, b) => b.data.localeCompare(a.data));
        if (sorted.length > 0) {
          const e = sorted[0];
          tipoData[tipo] = { data: e.data, vencimento: e.data_vencimento, resultado: e.resultado, status: getStatus(e.data_vencimento) };
        }
      });
      return { func, tipoData };
    }).filter(Boolean) as { func: Funcionario; tipoData: Record<string, { data: string; vencimento: string | null; resultado: string; status: ReturnType<typeof getStatus> }> }[];

    return { tipos: tiposUsados, rows };
  }, [items, funcMap]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-5 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Stethoscope className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Controle de Exames</h1>
              <p className="text-muted-foreground text-sm mt-0.5">PCMSO - Acompanhamento de Exames Ocupacionais</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleExportExcel} className="border-primary/30 hover:bg-primary/10">
              <Download className="w-4 h-4 mr-2" />Exportar
            </Button>
            <Button onClick={openNew} className="shadow-lg shadow-primary/25">
              <Plus className="w-4 h-4 mr-2" />Novo Exame
            </Button>
          </div>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {/* Conformidade */}
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
            <p className="text-xs font-medium text-muted-foreground">Total de Exames</p>
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
                      <TableHead>Tipo de Exame</TableHead>
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
                      <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhum exame cadastrado</TableCell></TableRow>
                    ) : filtered.map((e, index) => {
                      const func = funcMap[e.funcionario_id];
                      const status = getStatus(e.data_vencimento);
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="text-center font-medium text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{func?.nome || "—"}</TableCell>
                          <TableCell>{func?.cargo || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{func?.setor || "—"}</TableCell>
                          <TableCell><Badge variant="secondary">{tipoLabels[e.tipo] || e.tipo}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{format(parseISO(e.data), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="font-mono text-xs">{e.data_vencimento ? format(parseISO(e.data_vencimento), "dd/MM/yyyy") : "—"}</TableCell>
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
              ) : matrixData.tipos.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">Nenhum exame cadastrado</div>
              ) : (
                <div className="overflow-auto max-h-[70vh]">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-primary text-primary-foreground">
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold sticky left-0 bg-primary z-20 min-w-[40px]">Nº</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold sticky left-[40px] bg-primary z-20 min-w-[180px]">COLABORADOR</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold min-w-[100px]">CPF</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold min-w-[120px]">FUNÇÃO</th>
                        <th rowSpan={2} className="border border-border/30 px-2 py-2 text-left font-bold min-w-[120px]">SETOR</th>
                        {matrixData.tipos.map(tipo => (
                          <th key={tipo} colSpan={3} className="border border-border/30 px-2 py-2 text-center font-bold min-w-[280px] bg-primary/90">
                            {tipoLabels[tipo] || tipo}
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
                      {matrixData.rows.map((row, idx) => (
                        <tr key={row.func.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                          <td className="border border-border/30 px-2 py-1.5 text-center font-mono sticky left-0 bg-inherit z-10">{idx + 1}</td>
                          <td className="border border-border/30 px-2 py-1.5 font-medium sticky left-[40px] bg-inherit z-10 whitespace-nowrap">{row.func.nome}</td>
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
                                {format(parseISO(td.data), "dd/MM/yyyy")}
                              </td>,
                              <td key={`${row.func.id}-${tipo}-v`} className="border border-border/30 px-1 py-1.5 text-center font-mono">
                                {td.vencimento ? format(parseISO(td.vencimento), "dd/MM/yyyy") : "—"}
                              </td>,
                              <td key={`${row.func.id}-${tipo}-s`} className={`border border-border/30 px-1 py-1.5 text-center text-[10px] ${statusBg}`}>
                                {td.status.key === "vencido" ? "Vencido" : td.status.key === "atencao" ? "Atenção" : "Válido"}
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
                  onChange={e => { setFuncSearch(e.target.value); setForm(f => ({ ...f, funcionario_id: "" })); }}
                  className="pl-9"
                />
              </div>
              {form.funcionario_id && (
                <div className="mt-1 text-xs text-primary font-medium">
                  ✓ {funcMap[form.funcionario_id]?.nome}
                </div>
              )}
              {!form.funcionario_id && funcSearch.trim() && (
                <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto bg-background">
                  {filteredFuncionarios.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 text-center">Nenhum funcionário encontrado</p>
                  ) : filteredFuncionarios.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                      onClick={() => { setForm(prev => ({ ...prev, funcionario_id: f.id })); setFuncSearch(f.nome); }}
                    >
                      <span className="font-medium">{f.nome}</span>
                      <span className="text-xs text-muted-foreground">{f.cargo || ""} {f.matricula ? `• ${f.matricula}` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Exame</Label>
                <Select value={form.tipo} onValueChange={v => {
                  const newVenc = calcularVencimento(v, form.data);
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
                  const newVenc = calcularVencimento(form.tipo, e.target.value);
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
              <Label>Médico</Label>
              <Input value={form.medico} onChange={e => setForm(f => ({ ...f, medico: e.target.value }))} placeholder="Nome do médico" />
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

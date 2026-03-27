import { useState, useRef, useMemo, useEffect } from "react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Plus, Pencil, Trash2, User, Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertCircle, Search, Filter, UserX, RotateCcw } from "lucide-react";
import BaixaDesligamento from "@/components/BaixaDesligamento";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabaseCrud } from "@/hooks/useSupabaseData";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cachedQuery } from "@/lib/offlineStorage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface Funcionario {
  id: string; nome: string; matricula: string | null; setor: string | null;
  cargo: string | null; data_admissao: string | null; cpf: string | null;
  data_demissao: string | null; unidade_id: string | null; contrato_id: string | null;
}

interface Unidade { id: string; nome: string; tipo: string; }
interface Contrato { id: string; nome: string; unidade_id: string; }

interface ImportRow {
  nome: string; cpf: string; matricula: string; setor: string; cargo: string; data_admissao: string;
  unidade: string; contrato: string; unidade_id?: string; contrato_id?: string;
  valid: boolean; error?: string; action?: "insert" | "update"; existingId?: string;
}

const emptyForm = { nome: "", matricula: "", setor: "", cargo: "", data_admissao: "", cpf: "", data_demissao: "", unidade_id: "", contrato_id: "" };

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

const EXPECTED_COLUMNS = ["nome", "cpf", "matricula", "setor", "cargo", "data_admissao", "unidade", "contrato"];

function normalizeHeader(h: string): string {
  const map: Record<string, string> = {
    "nome": "nome", "nome completo": "nome", "funcionario": "nome", "funcionário": "nome",
    "cpf": "cpf", "c.p.f": "cpf", "c.p.f.": "cpf",
    "matricula": "matricula", "matrícula": "matricula", "mat": "matricula", "registro": "matricula",
    "setor": "setor", "departamento": "setor", "área": "setor", "area": "setor",
    "cargo": "cargo", "função": "cargo", "funcao": "cargo", "função/cargo": "cargo",
    "data admissao": "data_admissao", "data admissão": "data_admissao", "data_admissao": "data_admissao",
    "data de admissão": "data_admissao", "data de admissao": "data_admissao", "admissao": "data_admissao",
    "admissão": "data_admissao",
    "unidade": "unidade", "filial": "unidade", "obra": "unidade",
    "contrato": "contrato",
  };
  const normalized = h.trim().toLowerCase().replace(/[_\-]/g, " ");
  return map[normalized] || normalized;
}

function parseExcelDate(value: any): string {
  if (!value) return "";
  if (typeof value === "number") {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }
  }
  const str = String(value).trim();
  // Try DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  // Try YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  return str;
}

function validateRow(row: Omit<ImportRow, "valid" | "error">): { valid: boolean; error?: string } {
  if (!row.nome || !row.nome.trim()) return { valid: false, error: "Nome é obrigatório" };
  return { valid: true };
}

export default function Funcionarios() {
  const { data: items, loading, add, update, remove, refetch } = useSupabaseCrud<Funcionario>("funcionarios", "nome", true);
  const { canEdit, canCreate, canDelete } = usePermissions("cadastro_funcionarios");
  const { empresaId } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const { form, setForm, resetForm, hasDraft } = useFormDraft("funcionarios", emptyForm);
  const { toast } = useToast();

  // Unidades and Contratos for selects
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [empresaInfo, setEmpresaInfo] = useState<{ nome: string; cnpj: string | null }>({ nome: "", cnpj: null });

  const fetchUnidadesContratos = async () => {
    const [uResult, cResult] = await Promise.all([
      cachedQuery<Unidade>("empresa_config_unidades", () =>
        supabase.from("empresa_config").select("id, nome, tipo").neq("tipo", "empresa").order("nome") as any
      ),
      cachedQuery<Contrato>("contratos_list", () =>
        supabase.from("contratos").select("id, nome, unidade_id").order("nome") as any
      ),
    ]);
    setUnidades(uResult.data as Unidade[]);
    setContratos(cResult.data as Contrato[]);
  };

  // Load unidades/contratos on mount for display in table
  useEffect(() => { fetchUnidadesContratos(); }, []);

  // Helper maps for display
  const unidadeMap = useMemo(() => new Map(unidades.map(u => [u.id, u.nome])), [unidades]);
  const contratoMap = useMemo(() => new Map(contratos.map(c => [c.id, c.nome])), [contratos]);

  const contratosFiltrados = form.unidade_id ? contratos.filter(c => c.unidade_id === form.unidade_id) : contratos;

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openNew = () => { setEditing(null); if (!hasDraft()) resetForm(); fetchUnidadesContratos(); setOpen(true); };
  const openEdit = (f: Funcionario) => {
    setEditing(f);
    resetForm({ nome: f.nome, matricula: f.matricula || "", setor: f.setor || "", cargo: f.cargo || "", data_admissao: f.data_admissao || "", cpf: f.cpf || "", data_demissao: f.data_demissao || "", unidade_id: f.unidade_id || "", contrato_id: f.contrato_id || "" });
    fetchUnidadesContratos();
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const data = { nome: form.nome, matricula: form.matricula || null, setor: form.setor || null, cargo: form.cargo || null, data_admissao: form.data_admissao || null, cpf: form.cpf || null, data_demissao: form.data_demissao || null, unidade_id: form.unidade_id || null, contrato_id: form.contrato_id || null };
    if (editing) await update(editing.id, data);
    else await add(data);
    resetForm();
    setOpen(false);
  };

  // Demissão dialog
  const [demissaoOpen, setDemissaoOpen] = useState(false);
  const [demissaoTarget, setDemissaoTarget] = useState<Funcionario | null>(null);
  const [demissaoDate, setDemissaoDate] = useState("");

  const openDemissao = (f: Funcionario) => {
    setDemissaoTarget(f);
    setDemissaoDate(new Date().toISOString().split("T")[0]);
    setDemissaoOpen(true);
  };

  const handleDemissao = async () => {
    if (!demissaoTarget || !demissaoDate) return;
    await update(demissaoTarget.id, { data_demissao: demissaoDate } as any);
    setDemissaoOpen(false);
    toast({ title: "Demissão registrada", description: `${demissaoTarget.nome} foi marcado como demitido.` });
  };

  const handleReativar = async (f: Funcionario) => {
    await update(f.id, { data_demissao: null } as any);
    toast({ title: "Funcionário reativado", description: `${f.nome} voltou para a lista de ativos.` });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

        if (jsonData.length === 0) {
          toast({ title: "Planilha vazia", description: "Nenhuma linha encontrada.", variant: "destructive" });
          return;
        }

        // Map headers
        const rawHeaders = Object.keys(jsonData[0]);
        const headerMap: Record<string, string> = {};
        rawHeaders.forEach(h => {
          const norm = normalizeHeader(h);
          if (EXPECTED_COLUMNS.includes(norm)) headerMap[h] = norm;
        });

        // Build map of existing CPFs to their IDs for update detection
        const existingCpfMap = new Map<string, string>();
        items.forEach((f: Funcionario) => {
          if (f.cpf) existingCpfMap.set(f.cpf.replace(/\D/g, ""), f.id);
        });

        const seenCpfs = new Set<string>();

        // Build name-to-id maps for unidade/contrato matching
        const unidadeNameMap = new Map(unidades.map(u => [u.nome.toLowerCase().trim(), u.id]));
        const contratoNameMap = new Map(contratos.map(c => [c.nome.toLowerCase().trim(), { id: c.id, unidade_id: c.unidade_id }]));

        const rows: ImportRow[] = jsonData.map(raw => {
          const mapped: any = { nome: "", cpf: "", matricula: "", setor: "", cargo: "", data_admissao: "", unidade: "", contrato: "" };
          Object.entries(headerMap).forEach(([orig, norm]) => {
            let val = raw[orig] != null ? String(raw[orig]).trim() : "";
            if (norm === "data_admissao") val = parseExcelDate(raw[orig]);
            if (norm === "cpf" && val) val = formatCPF(val);
            mapped[norm] = val;
          });

          // Resolve unidade name to ID
          let resolvedUnidadeId: string | undefined;
          if (mapped.unidade) {
            resolvedUnidadeId = unidadeNameMap.get(mapped.unidade.toLowerCase().trim());
          }

          // Resolve contrato name to ID
          let resolvedContratoId: string | undefined;
          if (mapped.contrato) {
            const contratoMatch = contratoNameMap.get(mapped.contrato.toLowerCase().trim());
            if (contratoMatch) {
              resolvedContratoId = contratoMatch.id;
              // If no unidade specified, infer from contrato
              if (!resolvedUnidadeId) resolvedUnidadeId = contratoMatch.unidade_id;
            }
          }

          let validation = validateRow(mapped);
          let action: "insert" | "update" = "insert";
          let existingId: string | undefined;

          if (validation.valid && mapped.cpf) {
            const cpfDigits = mapped.cpf.replace(/\D/g, "");
            if (cpfDigits.length >= 11) {
              if (existingCpfMap.has(cpfDigits)) {
                action = "update";
                existingId = existingCpfMap.get(cpfDigits);
              } else if (seenCpfs.has(cpfDigits)) {
                validation = { valid: false, error: "CPF duplicado na planilha" };
              } else {
                seenCpfs.add(cpfDigits);
              }
            }
          }

          return { ...mapped, ...validation, action, existingId, unidade_id: resolvedUnidadeId, contrato_id: resolvedContratoId };
        });

        setImportRows(rows);
        setImportResult(null);
        setImportOpen(true);
      } catch {
        toast({ title: "Erro ao ler arquivo", description: "Verifique se o arquivo é uma planilha válida (.xlsx, .xls, .csv)", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    const validRows = importRows.filter(r => r.valid);
    if (validRows.length === 0) return;

    setImporting(true);
    setImportProgress(10);

    const toInsert = validRows.filter(r => r.action === "insert");
    const toUpdate = validRows.filter(r => r.action === "update");

    let successCount = 0;
    let errorCount = 0;

    // Bulk insert new rows
    if (toInsert.length > 0) {
      const payloads = toInsert.map(r => ({
        nome: r.nome, cpf: r.cpf || null, matricula: r.matricula || null,
        setor: r.setor || null, cargo: r.cargo || null, data_admissao: r.data_admissao || null,
        unidade_id: r.unidade_id || null, contrato_id: r.contrato_id || null,
        empresa_id: empresaId,
      }));
      const { error, data: inserted } = await (supabase.from as any)("funcionarios").insert(payloads).select();
      if (!error) successCount += inserted?.length || toInsert.length;
      else errorCount += toInsert.length;
    }

    setImportProgress(50);

    // Update existing rows
    if (toUpdate.length > 0) {
      for (const r of toUpdate) {
        const { error } = await (supabase.from as any)("funcionarios")
          .update({ nome: r.nome, matricula: r.matricula || null, setor: r.setor || null, cargo: r.cargo || null, data_admissao: r.data_admissao || null, unidade_id: r.unidade_id || null, contrato_id: r.contrato_id || null })
          .eq("id", r.existingId);
        if (!error) successCount++;
        else errorCount++;
      }
    }

    setImportProgress(100);
    setImporting(false);
    setImportResult({ success: successCount, errors: errorCount });
    
    const msgs: string[] = [];
    const inserted = toInsert.length - (errorCount > 0 ? Math.min(errorCount, toInsert.length) : 0);
    const updated = toUpdate.length - Math.max(0, errorCount - toInsert.length);
    if (inserted > 0) msgs.push(`${inserted} novo(s)`);
    if (updated > 0) msgs.push(`${updated} atualizado(s)`);
    
    toast({ title: "Importação concluída", description: msgs.join(", ") + "." });
    await refetch();
  };

  const exportToExcel = () => {
    const rows = items.map(f => ({
      "Nome": f.nome,
      "CPF": f.cpf || "",
      "Matrícula": f.matricula || "",
      "Unidade": f.unidade_id ? unidadeMap.get(f.unidade_id) || "" : "",
      "Contrato": f.contrato_id ? contratoMap.get(f.contrato_id) || "" : "",
      "Setor": f.setor || "",
      "Cargo": f.cargo || "",
      "Data Admissão": f.data_admissao || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funcionários");
    XLSX.writeFile(wb, "funcionarios.xlsx");
  };

  const downloadTemplate = () => {
    // Main sheet with example row
    const exampleUnidade = unidades.length > 0 ? unidades[0].nome : "Nome da Unidade";
    const exampleContrato = contratos.length > 0 ? contratos[0].nome : "Nome do Contrato";
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nome", "CPF", "Matrícula", "Setor", "Cargo", "Data Admissão", "Unidade", "Contrato"],
      ["João da Silva", "123.456.789-00", "001", "Produção", "Operador", "01/01/2024", exampleUnidade, exampleContrato],
    ]);
    ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funcionários");

    // Reference sheet with list of valid Unidades and Contratos
    const refData: string[][] = [["Unidades Disponíveis", "", "Contratos Disponíveis", "Unidade do Contrato"]];
    const maxRows = Math.max(unidades.length, contratos.length, 1);
    for (let i = 0; i < maxRows; i++) {
      refData.push([
        unidades[i]?.nome || "",
        "",
        contratos[i]?.nome || "",
        contratos[i] ? (unidades.find(u => u.id === contratos[i].unidade_id)?.nome || "") : "",
      ]);
    }
    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    wsRef["!cols"] = [{ wch: 30 }, { wch: 3 }, { wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsRef, "Ref - Unidades e Contratos");

    XLSX.writeFile(wb, "modelo_funcionarios.xlsx");
  };

  const validCount = importRows.filter(r => r.valid).length;
  const insertCount = importRows.filter(r => r.valid && r.action === "insert").length;
  const updateCount = importRows.filter(r => r.valid && r.action === "update").length;
  const invalidCount = importRows.filter(r => !r.valid).length;

  // Search/filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSetor, setFilterSetor] = useState("");

  const normalize = (str: string) =>
    str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Extract unique setores
  const setores = useMemo(() => {
    const unique = [...new Set(items.map(f => f.setor).filter(Boolean))] as string[];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Separate active vs dismissed
  const ativos = useMemo(() => items.filter(f => !f.data_demissao), [items]);
  const demitidos = useMemo(() => items.filter(f => !!f.data_demissao), [items]);

  const [activeTab, setActiveTab] = useState("ativos");

  const currentList = activeTab === "ativos" ? ativos : demitidos;

  const filteredItems = useMemo(() => {
    let result = currentList;
    
    // Apply setor filter
    if (filterSetor) {
      result = result.filter(f => f.setor === filterSetor);
    }
    
    // Apply search
    if (searchTerm.trim()) {
      const term = normalize(searchTerm);
      const termDigits = term.replace(/\D/g, "");
      result = result.filter((f: Funcionario) => {
        if (normalize(f.nome).includes(term)) return true;
        if (f.cpf && termDigits && f.cpf.replace(/\D/g, "").includes(termDigits)) return true;
        if (f.matricula && normalize(f.matricula).includes(term)) return true;
        if (f.setor && normalize(f.setor).includes(term)) return true;
        if (f.cargo && normalize(f.cargo).includes(term)) return true;
        return false;
      });
    }
    
    return result;
  }, [currentList, searchTerm, filterSetor]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Funcionários</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Gerenciar funcionários</p>
        </div>
        {canCreate && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={exportToExcel} className="w-full sm:w-auto" disabled={items.length === 0}>
              <Download className="w-4 h-4 mr-2" />Exportar
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full sm:w-auto">
              <Upload className="w-4 h-4 mr-2" />Importar
            </Button>
            <Button variant="outline" onClick={downloadTemplate} className="w-full sm:w-auto">
              <FileSpreadsheet className="w-4 h-4 mr-2" />Modelo
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
            <Button onClick={openNew} className="w-full sm:w-auto relative">
              <Plus className="w-4 h-4 mr-2" />Novo Funcionário
              {hasDraft() && <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse" title="Rascunho salvo" />}
            </Button>
          </div>
        )}
      </div>

      {/* Search bar + Sector filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, matrícula ou cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {setores.length > 0 && (
          <Select value={filterSetor} onValueChange={v => setFilterSetor(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por setor..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {setores.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
         <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredItems.length} de {currentList.length}
        </span>
      </div>

      {/* Tabs Ativos / Demitidos */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ativos" className="gap-1.5">
            <User className="w-4 h-4" />Ativos <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{ativos.length}</span>
          </TabsTrigger>
          <TabsTrigger value="demitidos" className="gap-1.5">
            <UserX className="w-4 h-4" />Demitidos <span className="ml-1 text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">{demitidos.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 lg:hidden">
            {filteredItems.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
                {searchTerm ? "Nenhum funcionário encontrado para esta busca" : activeTab === "demitidos" ? "Nenhum funcionário demitido" : "Nenhum funcionário cadastrado"}
              </CardContent></Card>
            ) : filteredItems.map(f => (
              <Card key={f.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{f.nome}</p>
                        <p className="text-xs text-muted-foreground">{f.cargo || "Sem cargo"} • {f.setor || "Sem setor"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {activeTab === "ativos" && canEdit && (
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => openDemissao(f)}>
                          <UserX className="w-3 h-3" />Demitir
                        </Button>
                      )}
                      {activeTab === "demitidos" && canEdit && (
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handleReativar(f)}>
                          <RotateCcw className="w-3 h-3" />Reativar
                        </Button>
                      )}
                      {canEdit && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>}
                      {canDelete && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(f.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">CPF:</span> <span className="font-mono">{f.cpf || "—"}</span></div>
                    <div><span className="text-muted-foreground">Matrícula:</span> <span className="font-mono">{f.matricula || "—"}</span></div>
                    <div><span className="text-muted-foreground">Unidade:</span> <span>{f.unidade_id ? unidadeMap.get(f.unidade_id) || "—" : "—"}</span></div>
                    <div><span className="text-muted-foreground">Contrato:</span> <span>{f.contrato_id ? contratoMap.get(f.contrato_id) || "—" : "—"}</span></div>
                    {f.data_admissao && <div><span className="text-muted-foreground">Admissão:</span> <span className="font-mono">{f.data_admissao.split("-").reverse().join("/")}</span></div>}
                    {f.data_demissao && <div><span className="text-muted-foreground">Demissão:</span> <span className="font-mono text-destructive">{f.data_demissao.split("-").reverse().join("/")}</span></div>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table layout */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Admissão</TableHead>
                    {activeTab === "demitidos" && <TableHead>Demissão</TableHead>}
                    <TableHead className="w-36"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow><TableCell colSpan={activeTab === "demitidos" ? 10 : 9} className="text-center text-muted-foreground py-8">
                      {searchTerm ? "Nenhum funcionário encontrado para esta busca" : activeTab === "demitidos" ? "Nenhum funcionário demitido" : "Nenhum funcionário cadastrado"}
                    </TableCell></TableRow>
                  ) : filteredItems.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{f.cpf || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{f.matricula || "—"}</TableCell>
                      <TableCell>{f.unidade_id ? unidadeMap.get(f.unidade_id) || "—" : "—"}</TableCell>
                      <TableCell>{f.contrato_id ? contratoMap.get(f.contrato_id) || "—" : "—"}</TableCell>
                      <TableCell>{f.setor || "—"}</TableCell>
                      <TableCell>{f.cargo || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{f.data_admissao ? f.data_admissao.split("-").reverse().join("/") : "—"}</TableCell>
                      {activeTab === "demitidos" && <TableCell className="font-mono text-xs text-destructive">{f.data_demissao ? f.data_demissao.split("-").reverse().join("/") : "—"}</TableCell>}
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {activeTab === "ativos" && canEdit && (
                            <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => openDemissao(f)}>
                              <UserX className="w-3 h-3" />Demitir
                            </Button>
                          )}
                          {activeTab === "demitidos" && canEdit && (
                            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handleReativar(f)}>
                              <RotateCcw className="w-3 h-3" />Reativar
                            </Button>
                          )}
                          {canEdit && <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>}
                          {canDelete && <Button size="icon" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
        </TabsContent>
      </Tabs>

      {/* Dialog novo/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome completo" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm({...form, cpf: formatCPF(e.target.value)})} placeholder="000.000.000-00" maxLength={14} /></div>
              <div><Label>Matrícula</Label><Input value={form.matricula} onChange={e => setForm({...form, matricula: e.target.value})} placeholder="Nº matrícula" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Admissão</Label><Input type="date" value={form.data_admissao} onChange={e => setForm({...form, data_admissao: e.target.value})} /></div>
              <div><Label>Setor</Label><Input value={form.setor} onChange={e => setForm({...form, setor: e.target.value})} placeholder="Ex: Produção" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unidade</Label>
                <Select value={form.unidade_id} onValueChange={v => setForm({...form, unidade_id: v === "none" ? "" : v, contrato_id: ""})}>
                  <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contrato</Label>
                <Select value={form.contrato_id} onValueChange={v => setForm({...form, contrato_id: v === "none" ? "" : v})} disabled={!form.unidade_id}>
                  <SelectTrigger><SelectValue placeholder={form.unidade_id ? "Selecione o contrato" : "Selecione a unidade primeiro"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {contratosFiltrados.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Cargo</Label><Input value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} placeholder="Ex: Operador" />
            </div>
            {editing && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data Demissão</Label><Input type="date" value={form.data_demissao} onChange={e => setForm({...form, data_demissao: e.target.value})} /></div>
                <div></div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Demissão */}
      <Dialog open={demissaoOpen} onOpenChange={setDemissaoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserX className="w-5 h-5 text-destructive" />Registrar Demissão</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Funcionário: <strong className="text-foreground">{demissaoTarget?.nome}</strong></p>
            <div>
              <Label>Data da Demissão</Label>
              <Input type="date" value={demissaoDate} onChange={e => setDemissaoDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDemissaoOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDemissao} disabled={!demissaoDate}>Confirmar Demissão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog importação */}
      <Dialog open={importOpen} onOpenChange={(v) => { if (!importing) { setImportOpen(v); if (!v) { setImportRows([]); setImportResult(null); } } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Importar Funcionários
            </DialogTitle>
          </DialogHeader>

          {importResult ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <div className="text-center">
                <p className="text-lg font-semibold">{importResult.success} importado(s) com sucesso</p>
                {importResult.errors > 0 && <p className="text-sm text-destructive mt-1">{importResult.errors} erro(s)</p>}
              </div>
              <Button onClick={() => { setImportOpen(false); setImportRows([]); setImportResult(null); }}>Fechar</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 pb-2">
                <div className="flex items-center gap-4 text-sm">
                  {insertCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="font-medium">{insertCount}</span> novo(s)
                    </span>
                  )}
                  {updateCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Pencil className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">{updateCount}</span> atualização(ões)
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <span className="font-medium">{invalidCount}</span> com erro
                    </span>
                  )}
                  <span className="text-muted-foreground">Total: {importRows.length}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-xs">
                  <Download className="w-3.5 h-3.5 mr-1" />Modelo
                </Button>
              </div>

              {importing && (
                <div className="space-y-2">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">Importando... {importProgress}%</p>
                </div>
              )}

              <div className="overflow-auto flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Admissão</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRows.map((r, i) => (
                      <TableRow key={i} className={!r.valid ? "bg-destructive/5" : r.action === "update" ? "bg-blue-500/5" : ""}>
                        <TableCell className="px-2">
                          {!r.valid ? <AlertCircle className="w-4 h-4 text-destructive" /> : r.action === "update" ? <Pencil className="w-4 h-4 text-blue-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{r.nome || <span className="text-destructive italic">vazio</span>}</TableCell>
                        <TableCell className="text-xs font-mono">{r.cpf || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{r.matricula || "—"}</TableCell>
                        <TableCell className="text-xs">{r.setor || "—"}</TableCell>
                        <TableCell className="text-xs">{r.cargo || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{r.data_admissao || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {r.error ? <span className="text-destructive">{r.error}</span> : r.action === "update" ? <span className="text-blue-500">Atualizar</span> : <span className="text-green-600">Novo</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]); }} disabled={importing}>Cancelar</Button>
                <Button onClick={handleImport} disabled={importing || validCount === 0}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar {validCount} ({insertCount > 0 ? `${insertCount} novo(s)` : ""}{insertCount > 0 && updateCount > 0 ? ", " : ""}{updateCount > 0 ? `${updateCount} atualização` : ""})
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

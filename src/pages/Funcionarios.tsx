import { useState, useRef } from "react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Plus, Pencil, Trash2, User, Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { useSupabaseCrud } from "@/hooks/useSupabaseData";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
}

interface ImportRow {
  nome: string; cpf: string; matricula: string; setor: string; cargo: string; data_admissao: string;
  valid: boolean; error?: string; action?: "insert" | "update"; existingId?: string;
}

const emptyForm = { nome: "", matricula: "", setor: "", cargo: "", data_admissao: "", cpf: "" };

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

const EXPECTED_COLUMNS = ["nome", "cpf", "matricula", "setor", "cargo", "data_admissao"];

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

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openNew = () => { setEditing(null); if (!hasDraft()) resetForm(); setOpen(true); };
  const openEdit = (f: Funcionario) => {
    setEditing(f);
    resetForm({ nome: f.nome, matricula: f.matricula || "", setor: f.setor || "", cargo: f.cargo || "", data_admissao: f.data_admissao || "", cpf: f.cpf || "" });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const data = { nome: form.nome, matricula: form.matricula || null, setor: form.setor || null, cargo: form.cargo || null, data_admissao: form.data_admissao || null, cpf: form.cpf || null };
    if (editing) await update(editing.id, data);
    else await add(data);
    resetForm();
    setOpen(false);
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

        const rows: ImportRow[] = jsonData.map(raw => {
          const mapped: any = { nome: "", cpf: "", matricula: "", setor: "", cargo: "", data_admissao: "" };
          Object.entries(headerMap).forEach(([orig, norm]) => {
            let val = raw[orig] != null ? String(raw[orig]).trim() : "";
            if (norm === "data_admissao") val = parseExcelDate(raw[orig]);
            if (norm === "cpf" && val) val = formatCPF(val);
            mapped[norm] = val;
          });

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

          return { ...mapped, ...validation, action, existingId };
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
          .update({ nome: r.nome, matricula: r.matricula || null, setor: r.setor || null, cargo: r.cargo || null, data_admissao: r.data_admissao || null })
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
      "Setor": f.setor || "",
      "Cargo": f.cargo || "",
      "Data Admissão": f.data_admissao || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funcionários");
    XLSX.writeFile(wb, "funcionarios.xlsx");
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nome", "CPF", "Matrícula", "Setor", "Cargo", "Data Admissão"],
      ["João da Silva", "123.456.789-00", "001", "Produção", "Operador", "01/01/2024"],
    ]);
    ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funcionários");
    XLSX.writeFile(wb, "modelo_funcionarios.xlsx");
  };

  const validCount = importRows.filter(r => r.valid).length;
  const insertCount = importRows.filter(r => r.valid && r.action === "insert").length;
  const updateCount = importRows.filter(r => r.valid && r.action === "update").length;
  const invalidCount = importRows.filter(r => !r.valid).length;

  // Search/filter state
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = items.filter((f: Funcionario) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const nomeMatch = f.nome.toLowerCase().includes(term);
    const cpfMatch = f.cpf ? f.cpf.replace(/\D/g, "").includes(term.replace(/\D/g, "")) : false;
    const matriculaMatch = f.matricula ? f.matricula.toLowerCase().includes(term) : false;
    const setorMatch = f.setor ? f.setor.toLowerCase().includes(term) : false;
    const cargoMatch = f.cargo ? f.cargo.toLowerCase().includes(term) : false;
    return nomeMatch || cpfMatch || matriculaMatch || setorMatch || cargoMatch;
  });

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
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
            <Button onClick={openNew} className="w-full sm:w-auto relative">
              <Plus className="w-4 h-4 mr-2" />Novo Funcionário
              {hasDraft() && <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse" title="Rascunho salvo" />}
            </Button>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, matrícula, setor ou cargo..."
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
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredItems.length} de {items.length} funcionário(s)
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 lg:hidden">
            {filteredItems.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
                {searchTerm ? "Nenhum funcionário encontrado para esta busca" : "Nenhum funcionário cadastrado"}
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
                      {canEdit && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>}
                      {canDelete && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(f.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">CPF:</span> <span className="font-mono">{f.cpf || "—"}</span></div>
                    <div><span className="text-muted-foreground">Matrícula:</span> <span className="font-mono">{f.matricula || "—"}</span></div>
                    {f.data_admissao && <div><span className="text-muted-foreground">Admissão:</span> <span className="font-mono">{f.data_admissao.split("-").reverse().join("/")}</span></div>}
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
                    <TableHead>Setor</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Admissão</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {searchTerm ? "Nenhum funcionário encontrado para esta busca" : "Nenhum funcionário cadastrado"}
                    </TableCell></TableRow>
                  ) : filteredItems.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{f.cpf || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{f.matricula || "—"}</TableCell>
                      <TableCell>{f.setor || "—"}</TableCell>
                      <TableCell>{f.cargo || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{f.data_admissao ? f.data_admissao.split("-").reverse().join("/") : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
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
            <div>
              <Label>Cargo</Label><Input value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} placeholder="Ex: Operador" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
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
                  Importar {validCount} funcionário(s)
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

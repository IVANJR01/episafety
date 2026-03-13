import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, GraduationCap, AlertTriangle, CheckCircle, Clock, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, format, parseISO } from "date-fns";
import * as XLSX from "xlsx";

interface ControleTreinamento {
  id: string;
  funcionario_id: string;
  nome_curso: string;
  data_realizacao: string;
  data_renovacao: string | null;
  empresa_id: string | null;
  created_by: string | null;
}

interface Funcionario { id: string; nome: string; cargo: string | null; cpf: string | null; matricula: string | null; }

type StatusFilter = "todos" | "vencido" | "atencao" | "vigente";

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
  });
  const [funcSearch, setFuncSearch] = useState("");
  const [cursoSearch, setCursoSearch] = useState("");
  const [showCursoList, setShowCursoList] = useState(false);

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

  const CURSOS_SUGERIDOS = [
    "NR-10 Básico", "NR-10 Complementar (SEP)", "NR-12", "NR-17 - Transporte Manual de Carga",
    "NR-18 - Integração", "NR-20", "NR-33", "NR-35",
    "POP 00", "POP 05", "Treinamento Inicial", "Guardião da Vida",
    "Direção Defensiva", "Liderança", "Sinaleiro / Amarrador de Carga",
    "Cargas Indivisíveis", "Operador Guindaste", "Operador Guindauto",
    "Operação de Cesto Aéreo/Acoplado", "Operação de Motosserra",
    "Montagem Eletromecânica SE", "Curso de Transporte de Passageiros",
    "Curso de Motorista de Ambulância", "Capacitação sobre Procedimento Operacional",
    "Poda e Manejo Vegetal", "Operação de Martelete", "Operação de Máquinas",
  ];

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


    let list = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => {
        const func = funcMap[t.funcionario_id];
        return (func?.nome || "").toLowerCase().includes(q) || t.nome_curso.toLowerCase().includes(q);
      });
    }
    if (statusFilter !== "todos") {
      list = list.filter(t => getStatus(t.data_renovacao).key === statusFilter);
    }
    list.sort((a, b) => statusOrder(a.data_renovacao) - statusOrder(b.data_renovacao));
    return list;
  }, [items, search, statusFilter, funcMap]);

  const openNew = () => {
    setEditing(null);
    setForm({ funcionario_id: "", nome_curso: "", data_realizacao: new Date().toISOString().split("T")[0], data_renovacao: "" });
    setOpen(true);
  };

  const openEdit = (t: ControleTreinamento) => {
    setEditing(t);
    setForm({
      funcionario_id: t.funcionario_id,
      nome_curso: t.nome_curso,
      data_realizacao: t.data_realizacao,
      data_renovacao: t.data_renovacao || "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.funcionario_id || !form.nome_curso.trim()) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    const payload = {
      funcionario_id: form.funcionario_id,
      nome_curso: form.nome_curso,
      data_realizacao: form.data_realizacao,
      data_renovacao: form.data_renovacao || null,
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

  const handleDelete = async (id: string) => {
    await (supabase.from as any)("controle_treinamentos").delete().eq("id", id);
    fetchData();
  };

  const handleExportExcel = () => {
    const rows = filtered.map((t, i) => {
      const func = funcMap[t.funcionario_id];
      const status = getStatus(t.data_renovacao);
      return {
        "N°": i + 1,
        "Nome Completo": func?.nome || "—",
        "Função": func?.cargo || "—",
        "Nome do Curso": t.nome_curso,
        "Data Realização": t.data_realizacao ? format(parseISO(t.data_realizacao), "dd/MM/yyyy") : "",
        "Data Renovação": t.data_renovacao ? format(parseISO(t.data_renovacao), "dd/MM/yyyy") : "",
        "Status": status.key === "vencido" ? "Vencido" : status.key === "atencao" ? "Atenção" : "Vigente",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 5 }, { wch: 35 }, { wch: 20 }, { wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Treinamentos");
    XLSX.writeFile(wb, `Controle_Treinamentos_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Exportado com sucesso!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            Controle de Treinamentos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhamento de capacitações e reciclagens</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel}><Download className="w-4 h-4 mr-2" />Exportar Excel</Button>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Adicionar Novo</Button>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="p-2 rounded-xl bg-muted text-primary"><GraduationCap className="w-5 h-5" /></div>
            <div><p className="text-xl font-bold">{items.length}</p><p className="text-[10px] sm:text-xs text-muted-foreground">Total</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="p-2 rounded-xl bg-red-100 text-red-700"><AlertTriangle className="w-5 h-5" /></div>
            <div><p className="text-xl font-bold">{items.filter(t => getStatus(t.data_renovacao).key === "vencido").length}</p><p className="text-[10px] sm:text-xs text-muted-foreground">Vencidos</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="p-2 rounded-xl bg-yellow-100 text-yellow-700"><Clock className="w-5 h-5" /></div>
            <div><p className="text-xl font-bold">{items.filter(t => getStatus(t.data_renovacao).key === "atencao").length}</p><p className="text-[10px] sm:text-xs text-muted-foreground">A Vencer</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="p-2 rounded-xl bg-green-100 text-green-700"><CheckCircle className="w-5 h-5" /></div>
            <div><p className="text-xl font-bold">{items.filter(t => getStatus(t.data_renovacao).key === "vigente").length}</p><p className="text-[10px] sm:text-xs text-muted-foreground">Vigentes</p></div>
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
          </SelectContent>
        </Select>
      </div>

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
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum treinamento cadastrado</TableCell></TableRow>
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
                            status.key === "vencido" ? "bg-red-100 text-red-800 border-red-200" :
                            status.key === "atencao" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                            "bg-green-100 text-green-800 border-green-200"
                          }
                        >
                          {status.label}
                        </Badge>
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

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Treinamento" : "Adicionar Novo Treinamento"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Funcionário *</Label>
              <Select value={form.funcionario_id} onValueChange={v => setForm({ ...form, funcionario_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
                <SelectContent>
                  {funcionarios.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome} {f.cargo ? `— ${f.cargo}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do Curso *</Label>
              <Input value={form.nome_curso} onChange={e => setForm({ ...form, nome_curso: e.target.value })} placeholder="Ex: NR-10 SEP, NR-35, POP 001" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Realização</Label>
                <Input type="date" value={form.data_realizacao} onChange={e => setForm({ ...form, data_realizacao: e.target.value })} />
              </div>
              <div>
                <Label>Data de Renovação/Reciclagem</Label>
                <Input type="date" value={form.data_renovacao} onChange={e => setForm({ ...form, data_renovacao: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

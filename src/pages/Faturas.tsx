import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, ExternalLink, ChevronLeft, ChevronRight, FileText, Trash2, Pencil } from "lucide-react";
import { Navigate } from "react-router-dom";

type Fatura = {
  id: string;
  empresa_id: string;
  ciclo: number;
  valor: number;
  situacao: string;
  data_criacao: string;
  data_vencimento: string;
  fatura_url: string | null;
  observacao: string | null;
};

type Empresa = { id: string; nome: string };

const PAGE_SIZE = 10;

const situacaoConfig: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  aberto: { label: "Aberto", variant: "default" },
  vencido: { label: "Vencido", variant: "destructive" },
  pago: { label: "Pago", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "outline" },
};

export default function Faturas() {
  const { isSuperAdmin, isPrincipal } = useAuth();
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("todas");
  const [filtroVencimentoDe, setFiltroVencimentoDe] = useState("");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFatura, setEditingFatura] = useState<Fatura | null>(null);
  const [form, setForm] = useState({
    empresa_id: "",
    ciclo: 1,
    valor: 0,
    situacao: "aberto",
    data_vencimento: "",
    fatura_url: "",
    observacao: "",
  });

  useEffect(() => {
    if (isSuperAdmin || isPrincipal) loadData();
  }, [isSuperAdmin, isPrincipal]);

  // Only super_admin and principal can see this module
  if (!isSuperAdmin && !isPrincipal) {
    return <Navigate to="/" replace />;
  }

  async function loadData() {
    setLoading(true);
    const [fRes, eRes] = await Promise.all([
      (supabase.from as any)("faturas").select("*").order("data_vencimento", { ascending: false }),
      (supabase.from as any)("empresa_config").select("id, nome").is("empresa_pai_id", null).order("nome"),
    ]);
    setFaturas(fRes.data || []);
    setEmpresas(eRes.data || []);
    setLoading(false);
  }

  const empresaMap = useMemo(() => {
    const m: Record<string, string> = {};
    empresas.forEach((e) => (m[e.id] = e.nome));
    return m;
  }, [empresas]);

  const filtered = useMemo(() => {
    return faturas.filter((f) => {
      const nome = empresaMap[f.empresa_id] || "";
      if (filtroNome && !nome.toLowerCase().includes(filtroNome.toLowerCase())) return false;
      if (filtroSituacao !== "todas" && f.situacao !== filtroSituacao) return false;
      if (filtroVencimentoDe && f.data_vencimento < filtroVencimentoDe) return false;
      return true;
    });
  }, [faturas, filtroNome, filtroSituacao, filtroVencimentoDe, empresaMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openNew() {
    setEditingFatura(null);
    setForm({ empresa_id: "", ciclo: 1, valor: 0, situacao: "aberto", data_vencimento: "", fatura_url: "", observacao: "" });
    setDialogOpen(true);
  }

  function openEdit(f: Fatura) {
    setEditingFatura(f);
    setForm({
      empresa_id: f.empresa_id,
      ciclo: f.ciclo,
      valor: f.valor,
      situacao: f.situacao,
      data_vencimento: f.data_vencimento,
      fatura_url: f.fatura_url || "",
      observacao: f.observacao || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.empresa_id || !form.data_vencimento) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    const payload = {
      empresa_id: form.empresa_id,
      ciclo: form.ciclo,
      valor: form.valor,
      situacao: form.situacao,
      data_vencimento: form.data_vencimento,
      fatura_url: form.fatura_url || null,
      observacao: form.observacao || null,
    };

    if (editingFatura) {
      const { error } = await (supabase.from as any)("faturas").update(payload).eq("id", editingFatura.id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Fatura atualizada" });
    } else {
      const { error } = await (supabase.from as any)("faturas").insert(payload);
      if (error) {
        toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Fatura criada" });
    }
    setDialogOpen(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta fatura?")) return;
    const { error } = await (supabase.from as any)("faturas").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Fatura excluída" });
    loadData();
  }

  function formatCurrency(v: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  }

  function formatDate(d: string) {
    if (!d) return "";
    const date = new Date(d + (d.includes("T") ? "" : "T00:00:00"));
    return date.toLocaleDateString("pt-BR");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faturas</h1>
          <p className="text-sm text-muted-foreground">Gerencie faturas vinculadas às empresas</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openNew} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nova Fatura
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Vencimento a partir de</Label>
              <Input
                type="date"
                value={filtroVencimentoDe}
                onChange={(e) => { setFiltroVencimentoDe(e.target.value); setPage(1); }}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status da fatura</Label>
              <div className="flex gap-2">
                {["todas", "aberto", "pago", "vencido", "cancelado"].map((s) => (
                  <Button
                    key={s}
                    variant={filtroSituacao === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setFiltroSituacao(s); setPage(1); }}
                  >
                    {s === "todas" ? "Todas" : situacaoConfig[s]?.label || s}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-2 border-b text-xs text-muted-foreground">
            <span>{filtered.length === 0 ? "Nenhum registro" : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} de ${filtered.length} registros`}</span>
            <Select value={String(PAGE_SIZE)} disabled>
              <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="10">10</SelectItem></SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-center">Ciclo</TableHead>
                <TableHead className="text-center">Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Criação</TableHead>
                <TableHead className="text-center">Vencimento</TableHead>
                <TableHead className="text-center">Fatura</TableHead>
                {isSuperAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
              <TableRow>
                <TableHead className="py-1">
                  <Input
                    placeholder="Filtrar..."
                    value={filtroNome}
                    onChange={(e) => { setFiltroNome(e.target.value); setPage(1); }}
                    className="h-7 text-xs"
                  />
                </TableHead>
                <TableHead colSpan={isSuperAdmin ? 7 : 6} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma fatura encontrada</TableCell></TableRow>
              ) : (
                paginated.map((f) => {
                  const cfg = situacaoConfig[f.situacao] || situacaoConfig.aberto;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{empresaMap[f.empresa_id] || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">#{f.ciclo}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(f.valor)}</TableCell>
                      <TableCell className="text-center text-sm">{formatDate(f.data_criacao)}</TableCell>
                      <TableCell className="text-center text-sm">{formatDate(f.data_vencimento)}</TableCell>
                      <TableCell className="text-center">
                        {f.fatura_url ? (
                          <a href={f.fatura_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-sm">
                            <ExternalLink className="w-3.5 h-3.5" /> Ver fatura
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(f.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
            <span>{filtered.length === 0 ? "" : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} de ${filtered.length} registros`}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(1)}>
                <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-2" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="px-2 font-medium">{page}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFatura ? "Editar Fatura" : "Nova Fatura"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Empresa *</Label>
              <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Ciclo</Label>
                <Input type="number" value={form.ciclo} onChange={(e) => setForm({ ...form, ciclo: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Situação</Label>
                <Select value={form.situacao} onValueChange={(v) => setForm({ ...form, situacao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Vencimento *</Label>
                <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>URL da Fatura</Label>
              <Input value={form.fatura_url} onChange={(e) => setForm({ ...form, fatura_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
            </div>
            <Button onClick={handleSave} className="w-full">
              {editingFatura ? "Salvar Alterações" : "Criar Fatura"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

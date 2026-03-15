import { useState } from "react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Plus, Pencil, Trash2, Search, Loader2, Download, Package, BarChart3, ClipboardList } from "lucide-react";
import * as XLSX from "xlsx";
import { useSupabaseCrud, useSupabaseQuery } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import Entregas from "@/pages/Entregas";

interface EPI {
  id: string; nome: string; ca: string | null; validade: string | null;
  estoque: number; estoque_minimo: number; categoria: string | null;
  descricao: string | null; fabricante: string | null; aprovado_para: string | null;
  valor: number | null;
}

interface Entrega { id: string; funcionario_id: string; epi_id: string; quantidade: number; data: string; }
interface Funcionario { id: string; nome: string; setor: string | null; }

const emptyForm = {
  nome: "", ca: "", validade: "", estoque: 0, estoque_minimo: 5,
  categoria: "", descricao: "", fabricante: "", aprovado_para: "", valor: 0
};

export default function EPIs() {
  const { data: epis, loading, add, update, remove } = useSupabaseCrud<EPI>("epis", "created_at");
  const { data: entregas } = useSupabaseQuery<Entrega>("entregas", "created_at");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const { canEdit, canCreate, canDelete } = usePermissions("epis");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EPI | null>(null);
  const { form, setForm, resetForm, hasDraft } = useFormDraft("epis", emptyForm);
  const [consultando, setConsultando] = useState(false);
  const [busca, setBusca] = useState("");
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("estoque");
  const [filtroFunc, setFiltroFunc] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const setores = [...new Set(funcionarios.map(f => f.setor).filter(Boolean))];

  const filteredEntregas = entregas.filter(e => {
    const func = funcionarios.find(f => f.id === e.funcionario_id);
    if (filtroFunc && filtroFunc !== "all" && e.funcionario_id !== filtroFunc) return false;
    if (filtroSetor && filtroSetor !== "all" && func?.setor !== filtroSetor) return false;
    if (dataInicio && e.data < dataInicio) return false;
    if (dataFim && e.data > dataFim) return false;
    return true;
  });

  const totalItens = filteredEntregas.reduce((a, e) => a + e.quantidade, 0);
  const byEpi: Record<string, number> = {};
  filteredEntregas.forEach(e => { byEpi[e.epi_id] = (byEpi[e.epi_id] || 0) + e.quantidade; });

  const episFiltrados = epis.filter(e => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    return e.nome.toLowerCase().includes(termo) || (e.ca && e.ca.toLowerCase().includes(termo));
  });

  const openNew = () => { setEditing(null); if (!hasDraft()) resetForm(); setOpen(true); };
  const openEdit = (e: EPI) => {
    setEditing(e);
    resetForm({
      nome: e.nome, ca: e.ca || "", validade: e.validade || "",
      estoque: e.estoque, estoque_minimo: e.estoque_minimo,
      categoria: e.categoria || "", descricao: e.descricao || "",
      fabricante: e.fabricante || "", aprovado_para: e.aprovado_para || "",
      valor: e.valor || 0
    });
    setOpen(true);
  };

  const consultarCA = async () => {
    if (!form.ca.trim()) {
      toast({ title: "Informe o nº do CA", variant: "destructive" });
      return;
    }
    setConsultando(true);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-ca", {
        body: { ca: form.ca.trim() }
      });
      if (error) throw error;
      if (data?.success && data.data) {
        const d = data.data;
        setForm(prev => ({
          ...prev,
          nome: d.nome || prev.nome,
          categoria: d.categoria || prev.categoria,
          validade: d.validade || prev.validade,
          descricao: d.descricao || prev.descricao,
          fabricante: d.fabricante || prev.fabricante,
          aprovado_para: d.aprovado_para || prev.aprovado_para,
        }));
        toast({ title: "CA encontrado!", description: `${d.nome || "EPI"} - ${d.situacao || ""}` });
      } else {
        toast({ title: "CA não encontrado", description: data?.error || "Verifique o número e tente novamente", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro na consulta", description: err.message || "Falha ao consultar CA", variant: "destructive" });
    } finally {
      setConsultando(false);
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const data = {
      nome: form.nome, ca: form.ca || null, validade: form.validade || null,
      estoque: form.estoque, estoque_minimo: form.estoque_minimo,
      categoria: form.categoria || null, descricao: form.descricao || null,
      fabricante: form.fabricante || null, aprovado_para: form.aprovado_para || null,
      valor: form.valor || 0
    };
    if (editing) await update(editing.id, data);
    else await add(data);
    resetForm();
    setOpen(false);
  };

  const exportarExcel = () => {
    const dados = epis.map(e => ({
      "Nome": e.nome, "CA": e.ca || "", "Categoria": e.categoria || "",
      "Fabricante": e.fabricante || "", "Validade CA": e.validade || "",
      "Aprovado Para": e.aprovado_para || "",
      "Valor Unitário (R$)": e.valor ? Number(e.valor).toFixed(2) : "0.00",
      "Estoque Atual": e.estoque, "Estoque Mínimo": e.estoque_minimo,
      "Valor Total Estoque (R$)": ((e.valor || 0) * e.estoque).toFixed(2),
      "Status": e.estoque <= e.estoque_minimo ? "BAIXO" : "OK",
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    ws["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque EPIs");
    XLSX.writeFile(wb, `Relatorio_Estoque_EPIs_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Relatório exportado com sucesso!" });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">EPIs</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Gerenciar equipamentos de proteção</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="estoque"><Package className="w-4 h-4 mr-1.5" />Estoque</TabsTrigger>
          <TabsTrigger value="entregas"><ClipboardList className="w-4 h-4 mr-1.5" />Entregas</TabsTrigger>
          <TabsTrigger value="relatorios"><BarChart3 className="w-4 h-4 mr-1.5" />Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="estoque" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou CA..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportarExcel} disabled={epis.length === 0} className="text-xs sm:text-sm">
                <Download className="w-4 h-4 mr-1 sm:mr-2" />Exportar
              </Button>
              {canCreate && (
                <Button onClick={openNew} className="text-xs sm:text-sm">
                  <Plus className="w-4 h-4 mr-1 sm:mr-2" />Novo EPI
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 lg:hidden">
                {episFiltrados.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">{busca ? "Nenhum EPI encontrado" : "Nenhum EPI cadastrado"}</CardContent></Card>
                ) : episFiltrados.map(e => (
                  <Card key={e.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${e.estoque <= e.estoque_minimo ? "bg-destructive/10" : "bg-primary/10"}`}>
                            <Package className={`w-4 h-4 ${e.estoque <= e.estoque_minimo ? "text-destructive" : "text-primary"}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{e.nome}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {e.ca && <span className="text-xs font-mono text-muted-foreground">CA: {e.ca}</span>}
                              {e.categoria && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{e.categoria}</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {canEdit && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>}
                          {canDelete && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <div className="flex gap-3">
                          <div>
                            <span className="text-muted-foreground">Estoque: </span>
                            <span className={`font-mono font-semibold ${e.estoque <= e.estoque_minimo ? "text-destructive" : ""}`}>{e.estoque}</span>
                          </div>
                          {e.valor ? <div><span className="text-muted-foreground">Valor: </span><span className="font-mono">R$ {Number(e.valor).toFixed(2)}</span></div> : null}
                        </div>
                        {e.validade && <span className="text-muted-foreground font-mono">{e.validade}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop table */}
              <Card className="hidden lg:block">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CA</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Fabricante</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Estoque</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {episFiltrados.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{busca ? "Nenhum EPI encontrado" : "Nenhum EPI cadastrado"}</TableCell></TableRow>
                      ) : episFiltrados.map(e => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.nome}</TableCell>
                          <TableCell className="font-mono text-xs">{e.ca || "—"}</TableCell>
                          <TableCell><Badge variant="secondary">{e.categoria || "—"}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{e.fabricante || "—"}</TableCell>
                          <TableCell>{e.validade || "—"}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{e.valor ? `R$ ${Number(e.valor).toFixed(2)}` : "—"}</TableCell>
                          <TableCell className="text-right">
                            <span className={e.estoque <= e.estoque_minimo ? "text-destructive font-semibold" : ""}>{e.estoque}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              {canEdit && <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>}
                              {canDelete && <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
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

        <TabsContent value="entregas" className="mt-4">
          <Entregas />
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label className="text-xs">Funcionário</Label>
                  <Select value={filtroFunc} onValueChange={setFiltroFunc}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Setor</Label>
                  <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {setores.map(s => <SelectItem key={s!} value={s!}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Data início</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
                <div><Label className="text-xs">Data fim</Label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total de entregas</span><span className="font-semibold">{filteredEntregas.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total de itens</span><span className="font-semibold">{totalItens}</span></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Por EPI</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {Object.entries(byEpi).map(([epiId, qty]) => (
                    <div key={epiId} className="flex justify-between">
                      <span className="text-muted-foreground">{epis.find(e => e.id === epiId)?.nome || "—"}</span>
                      <span className="font-semibold">{qty}</span>
                    </div>
                  ))}
                  {Object.keys(byEpi).length === 0 && <p className="text-muted-foreground text-center py-2">Sem dados</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Detalhamento</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>EPI</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntregas.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem resultados</TableCell></TableRow>
                  ) : filteredEntregas.map(e => {
                    const func = funcionarios.find(f => f.id === e.funcionario_id);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.data}</TableCell>
                        <TableCell className="font-medium">{func?.nome || "—"}</TableCell>
                        <TableCell>{func?.setor || "—"}</TableCell>
                        <TableCell>{epis.find(ep => ep.id === e.epi_id)?.nome || "—"}</TableCell>
                        <TableCell className="text-right">{e.quantidade}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar EPI" : "Novo EPI"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nº do CA</Label>
              <div className="flex gap-2">
                <Input value={form.ca} onChange={e => setForm({...form, ca: e.target.value})} placeholder="Ex: 37536" className="flex-1" />
                <Button type="button" variant="secondary" onClick={consultarCA} disabled={consultando || !form.ca.trim()}>
                  {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-2 hidden sm:inline">Consultar</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Insira o CA e clique em Consultar para preencher automaticamente</p>
            </div>
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Capacete de Segurança" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} placeholder="Ex: Cabeça" /></div>
              <div><Label>Validade do CA</Label><Input type="date" value={form.validade} onChange={e => setForm({...form, validade: e.target.value})} /></div>
            </div>
            <div><Label>Fabricante</Label><Input value={form.fabricante} onChange={e => setForm({...form, fabricante: e.target.value})} placeholder="Preenchido automaticamente pela consulta" /></div>
            <div><Label>Aprovado Para</Label><Textarea value={form.aprovado_para} onChange={e => setForm({...form, aprovado_para: e.target.value})} placeholder="Proteção contra..." rows={2} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Descrição técnica do EPI" rows={3} /></div>
            <div><Label>Valor Unitário (R$)</Label><Input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm({...form, valor: Number(e.target.value)})} placeholder="0.00" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Estoque</Label><Input type="number" value={form.estoque} onChange={e => setForm({...form, estoque: Number(e.target.value)})} /></div>
              <div><Label>Estoque Mín.</Label><Input type="number" value={form.estoque_minimo} onChange={e => setForm({...form, estoque_minimo: Number(e.target.value)})} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

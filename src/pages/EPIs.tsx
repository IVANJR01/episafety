import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useSupabaseCrud } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface EPI {
  id: string; nome: string; ca: string | null; validade: string | null;
  estoque: number; estoque_minimo: number; categoria: string | null;
  descricao: string | null; fabricante: string | null; aprovado_para: string | null;
  valor: number | null;
}

const emptyForm = {
  nome: "", ca: "", validade: "", estoque: 0, estoque_minimo: 5,
  categoria: "", descricao: "", fabricante: "", aprovado_para: "", valor: 0
};

export default function EPIs() {
  const { data: epis, loading, add, update, remove } = useSupabaseCrud<EPI>("epis", "created_at");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EPI | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [consultando, setConsultando] = useState(false);
  const { toast } = useToast();

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (e: EPI) => {
    setEditing(e);
    setForm({
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
        toast({
          title: "CA encontrado!",
          description: `${d.nome || "EPI"} - ${d.situacao || ""}`,
        });
      } else {
        toast({
          title: "CA não encontrado",
          description: data?.error || "Verifique o número e tente novamente",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro na consulta",
        description: err.message || "Falha ao consultar CA",
        variant: "destructive"
      });
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
    if (editing) {
      await update(editing.id, data);
    } else {
      await add(data);
    }
    setOpen(false);
  };

  const exportarExcel = () => {
    const dados = epis.map(e => ({
      "Nome": e.nome,
      "CA": e.ca || "",
      "Categoria": e.categoria || "",
      "Fabricante": e.fabricante || "",
      "Validade CA": e.validade || "",
      "Aprovado Para": e.aprovado_para || "",
      "Valor Unitário (R$)": e.valor ? Number(e.valor).toFixed(2) : "0.00",
      "Estoque Atual": e.estoque,
      "Estoque Mínimo": e.estoque_minimo,
      "Valor Total Estoque (R$)": ((e.valor || 0) * e.estoque).toFixed(2),
      "Status": e.estoque <= e.estoque_minimo ? "BAIXO" : "OK",
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const colWidths = [
      { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 12 },
      { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 8 },
    ];
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque EPIs");
    XLSX.writeFile(wb, `Relatorio_Estoque_EPIs_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Relatório exportado com sucesso!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">EPIs</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciar equipamentos de proteção</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarExcel} disabled={epis.length === 0}>
            <Download className="w-4 h-4 mr-2" />Exportar Excel
          </Button>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo EPI</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : (
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
                {epis.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum EPI cadastrado</TableCell></TableRow>
                ) : epis.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{e.ca || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{e.categoria || "—"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{e.fabricante || "—"}</TableCell>
                    <TableCell>{e.validade || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {e.valor ? `R$ ${Number(e.valor).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={e.estoque <= e.estoque_minimo ? "text-destructive font-semibold" : ""}>{e.estoque}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar EPI" : "Novo EPI"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nº do CA</Label>
              <div className="flex gap-2">
                <Input
                  value={form.ca}
                  onChange={e => setForm({...form, ca: e.target.value})}
                  placeholder="Ex: 37536"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={consultarCA}
                  disabled={consultando || !form.ca.trim()}
                >
                  {consultando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span className="ml-2">Consultar</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Insira o CA e clique em Consultar para preencher automaticamente
              </p>
            </div>

            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Capacete de Segurança" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} placeholder="Ex: Cabeça" /></div>
              <div><Label>Validade do CA</Label><Input type="date" value={form.validade} onChange={e => setForm({...form, validade: e.target.value})} /></div>
            </div>

            <div>
              <Label>Fabricante</Label>
              <Input value={form.fabricante} onChange={e => setForm({...form, fabricante: e.target.value})} placeholder="Preenchido automaticamente pela consulta" />
            </div>

            <div>
              <Label>Aprovado Para</Label>
              <Textarea
                value={form.aprovado_para}
                onChange={e => setForm({...form, aprovado_para: e.target.value})}
                placeholder="Proteção contra..."
                rows={2}
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={e => setForm({...form, descricao: e.target.value})}
                placeholder="Descrição técnica do EPI"
                rows={3}
              />
            </div>

            <div>
              <Label>Valor Unitário (R$)</Label>
              <Input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm({...form, valor: Number(e.target.value)})} placeholder="0.00" />
            </div>

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

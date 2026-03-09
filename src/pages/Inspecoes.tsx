import { useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useSupabaseCrud } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Inspecao {
  id: string; titulo: string; local: string | null; responsavel: string | null;
  data: string; status: string; observacao: string | null;
}

interface InspecaoItem {
  id: string; inspecao_id: string; descricao: string; conforme: boolean | null; observacao: string | null;
}

const statusConfig: Record<string, { label: string; variant: "outline" | "secondary" | "default" }> = {
  pendente: { label: "Pendente", variant: "outline" },
  em_andamento: { label: "Em Andamento", variant: "secondary" },
  concluida: { label: "Concluída", variant: "default" },
};

export default function Inspecoes() {
  const { data: inspecoes, loading, add, update, remove, refetch } = useSupabaseCrud<Inspecao>("inspecoes", "created_at");
  const [itensMap, setItensMap] = useState<Record<string, InspecaoItem[]>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Inspecao | null>(null);
  const [form, setForm] = useState({ titulo: "", local: "", responsavel: "", data: new Date().toISOString().split("T")[0], status: "pendente", observacao: "" });
  const [formItens, setFormItens] = useState<{ id?: string; descricao: string; conforme: boolean | null; observacao: string }[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const { toast } = useToast();

  // Load itens for all inspecoes
  const loadItens = async () => {
    const { data } = await (supabase.from as any)("inspecao_itens").select("*");
    if (data) {
      const map: Record<string, InspecaoItem[]> = {};
      (data as InspecaoItem[]).forEach(item => {
        if (!map[item.inspecao_id]) map[item.inspecao_id] = [];
        map[item.inspecao_id].push(item);
      });
      setItensMap(map);
    }
  };

  useState(() => { loadItens(); });

  const openNew = () => { setEditing(null); setForm({ titulo: "", local: "", responsavel: "", data: new Date().toISOString().split("T")[0], status: "pendente", observacao: "" }); setFormItens([]); setOpen(true); };
  const openEdit = (i: Inspecao) => {
    setEditing(i);
    setForm({ titulo: i.titulo, local: i.local || "", responsavel: i.responsavel || "", data: i.data, status: i.status, observacao: i.observacao || "" });
    setFormItens((itensMap[i.id] || []).map(it => ({ id: it.id, descricao: it.descricao, conforme: it.conforme, observacao: it.observacao || "" })));
    setOpen(true);
  };

  const addItem = () => {
    if (!novoItem.trim()) return;
    setFormItens([...formItens, { descricao: novoItem, conforme: null, observacao: "" }]);
    setNovoItem("");
  };

  const removeItem = (idx: number) => setFormItens(formItens.filter((_, i) => i !== idx));
  const toggleConforme = (idx: number, value: boolean) => setFormItens(formItens.map((it, i) => i === idx ? { ...it, conforme: value } : it));

  const handleSave = async () => {
    if (!form.titulo.trim()) return;
    const data = { titulo: form.titulo, local: form.local || null, responsavel: form.responsavel || null, data: form.data, status: form.status, observacao: form.observacao || null };

    let inspecaoId: string;
    if (editing) {
      await update(editing.id, data);
      inspecaoId = editing.id;
      // Delete old itens
      await (supabase.from as any)("inspecao_itens").delete().eq("inspecao_id", inspecaoId);
    } else {
      const { data: inserted, error } = await (supabase.from as any)("inspecoes").insert(data).select().single();
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      inspecaoId = inserted.id;
    }

    // Insert itens
    if (formItens.length > 0) {
      await (supabase.from as any)("inspecao_itens").insert(
        formItens.map(it => ({ inspecao_id: inspecaoId, descricao: it.descricao, conforme: it.conforme, observacao: it.observacao || null }))
      );
    }

    await refetch();
    await loadItens();
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    await loadItens();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inspeções</h1>
          <p className="text-muted-foreground text-sm mt-1">Checklists e auditorias de segurança</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nova Inspeção</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspecoes.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma inspeção cadastrada</TableCell></TableRow>
                ) : inspecoes.map(i => {
                  const itens = itensMap[i.id] || [];
                  const conformes = itens.filter(it => it.conforme === true).length;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.titulo}</TableCell>
                      <TableCell>{i.local || "—"}</TableCell>
                      <TableCell>{i.responsavel || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{i.data}</TableCell>
                      <TableCell><span className="text-xs font-mono">{conformes}/{itens.length}</span></TableCell>
                      <TableCell><Badge variant={statusConfig[i.status]?.variant || "outline"}>{statusConfig[i.status]?.label || i.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(i.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Inspeção" : "Nova Inspeção"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Título</Label><Input value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} placeholder="Ex: Inspeção NR-18" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Local</Label><Input value={form.local} onChange={e => setForm({...form, local: e.target.value})} placeholder="Local da inspeção" /></div>
              <div><Label>Responsável</Label><Input value={form.responsavel} onChange={e => setForm({...form, responsavel: e.target.value})} placeholder="Nome" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Itens do Checklist</Label>
              <div className="flex gap-2 mb-3">
                <Input value={novoItem} onChange={e => setNovoItem(e.target.value)} placeholder="Descrição do item" onKeyDown={e => e.key === "Enter" && addItem()} />
                <Button type="button" size="sm" onClick={addItem}>Adicionar</Button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {formItens.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                    <button type="button" onClick={() => toggleConforme(idx, item.conforme !== true)}
                      className={`p-0.5 rounded ${item.conforme === true ? "text-success" : item.conforme === false ? "text-destructive" : "text-muted-foreground"}`}>
                      {item.conforme === true ? <CheckCircle2 className="w-4 h-4" /> : item.conforme === false ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </button>
                    <span className="flex-1">{item.descricao}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(idx)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div><Label>Observação</Label><Textarea value={form.observacao} onChange={e => setForm({...form, observacao: e.target.value})} placeholder="Observações gerais" /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useSupabaseCrud, useSupabaseQuery } from "@/hooks/useSupabaseData";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

interface Treinamento {
  id: string; nome: string; descricao: string | null; instrutor: string | null;
  data: string; carga_horaria: number; validade: string | null; status: string;
}
interface Funcionario { id: string; nome: string; setor: string | null; }
interface Participante { id: string; treinamento_id: string; funcionario_id: string; }

const statusConfig: Record<string, { label: string; variant: "outline" | "default" | "destructive" }> = {
  agendado: { label: "Agendado", variant: "outline" },
  realizado: { label: "Realizado", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

export default function Treinamentos() {
  const { data: items, loading, update, remove, refetch } = useSupabaseCrud<Treinamento>("treinamentos", "created_at");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Treinamento | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", instrutor: "", data: new Date().toISOString().split("T")[0], carga_horaria: 1, validade: "", status: "agendado" });
  const [selectedParticipantes, setSelectedParticipantes] = useState<string[]>([]);
  const { toast } = useToast();

  useState(() => {
    (supabase.from as any)("treinamento_participantes").select("*").then(({ data }: any) => {
      if (data) setParticipantes(data);
    });
  });

  const openNew = () => { setEditing(null); setForm({ nome: "", descricao: "", instrutor: "", data: new Date().toISOString().split("T")[0], carga_horaria: 1, validade: "", status: "agendado" }); setSelectedParticipantes([]); setOpen(true); };
  const openEdit = (t: Treinamento) => {
    setEditing(t);
    setForm({ nome: t.nome, descricao: t.descricao || "", instrutor: t.instrutor || "", data: t.data, carga_horaria: t.carga_horaria, validade: t.validade || "", status: t.status });
    setSelectedParticipantes(participantes.filter(p => p.treinamento_id === t.id).map(p => p.funcionario_id));
    setOpen(true);
  };

  const toggleParticipante = (funcId: string) => {
    setSelectedParticipantes(prev => prev.includes(funcId) ? prev.filter(p => p !== funcId) : [...prev, funcId]);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const data = { nome: form.nome, descricao: form.descricao || null, instrutor: form.instrutor || null, data: form.data, carga_horaria: form.carga_horaria, validade: form.validade || null, status: form.status };

    let treinamentoId: string;
    if (editing) {
      await update(editing.id, data);
      treinamentoId = editing.id;
      await (supabase.from as any)("treinamento_participantes").delete().eq("treinamento_id", treinamentoId);
    } else {
      const { data: inserted, error } = await (supabase.from as any)("treinamentos").insert(data).select().single();
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      treinamentoId = inserted.id;
    }

    if (selectedParticipantes.length > 0) {
      await (supabase.from as any)("treinamento_participantes").insert(
        selectedParticipantes.map(fid => ({ treinamento_id: treinamentoId, funcionario_id: fid }))
      );
    }

    await refetch();
    const { data: p } = await (supabase.from as any)("treinamento_participantes").select("*");
    if (p) setParticipantes(p);
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    const { data: p } = await (supabase.from as any)("treinamento_participantes").select("*");
    if (p) setParticipantes(p);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Treinamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Capacitações e exercícios simulados</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo Treinamento</Button>
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
                  <TableHead>Instrutor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Carga Horária</TableHead>
                  <TableHead>Participantes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum treinamento cadastrado</TableCell></TableRow>
                ) : items.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.nome}</TableCell>
                    <TableCell>{t.instrutor || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{t.data}</TableCell>
                    <TableCell>{t.carga_horaria}h</TableCell>
                    <TableCell className="font-mono text-xs">{participantes.filter(p => p.treinamento_id === t.id).length}</TableCell>
                    <TableCell><Badge variant={statusConfig[t.status]?.variant || "outline"}>{statusConfig[t.status]?.label || t.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Treinamento" : "Novo Treinamento"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: NR-35 Trabalho em Altura" /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Descrição do treinamento" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Instrutor</Label><Input value={form.instrutor} onChange={e => setForm({...form, instrutor: e.target.value})} placeholder="Nome do instrutor" /></div>
              <div><Label>Carga Horária (h)</Label><Input type="number" min={1} value={form.carga_horaria} onChange={e => setForm({...form, carga_horaria: Number(e.target.value)})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} /></div>
              <div><Label>Validade</Label><Input type="date" value={form.validade} onChange={e => setForm({...form, validade: e.target.value})} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Participantes</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                {funcionarios.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">Cadastre funcionários primeiro</p>
                ) : funcionarios.map(f => (
                  <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={selectedParticipantes.includes(f.id)} onCheckedChange={() => toggleParticipante(f.id)} />
                    <span>{f.nome}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{f.setor || ""}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

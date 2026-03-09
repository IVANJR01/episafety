import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useSupabaseCrud, useSupabaseQuery } from "@/hooks/useSupabaseData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface OrdemServico {
  id: string; numero: string | null; titulo: string; descricao: string | null;
  funcionario_id: string | null; setor: string | null; riscos: string | null;
  epis: string | null; data: string; status: string;
}
interface Funcionario { id: string; nome: string; }

const statusConfig: Record<string, { label: string; variant: "outline" | "default" | "destructive" }> = {
  emitida: { label: "Emitida", variant: "outline" },
  assinada: { label: "Assinada", variant: "default" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

export default function OrdensServico() {
  const { data: items, loading, add, update, remove } = useSupabaseCrud<OrdemServico>("ordens_servico", "created_at");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrdemServico | null>(null);
  const [form, setForm] = useState({ numero: "", titulo: "", descricao: "", funcionario_id: "", setor: "", riscos: "", epis: "", data: new Date().toISOString().split("T")[0], status: "emitida" });

  const openNew = () => {
    setEditing(null);
    setForm({ numero: `OS-${String(items.length + 1).padStart(4, "0")}`, titulo: "", descricao: "", funcionario_id: "", setor: "", riscos: "", epis: "", data: new Date().toISOString().split("T")[0], status: "emitida" });
    setOpen(true);
  };
  const openEdit = (os: OrdemServico) => {
    setEditing(os);
    setForm({ numero: os.numero || "", titulo: os.titulo, descricao: os.descricao || "", funcionario_id: os.funcionario_id || "", setor: os.setor || "", riscos: os.riscos || "", epis: os.epis || "", data: os.data, status: os.status });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) return;
    const data = { numero: form.numero || null, titulo: form.titulo, descricao: form.descricao || null, funcionario_id: form.funcionario_id || null, setor: form.setor || null, riscos: form.riscos || null, epis: form.epis || null, data: form.data, status: form.status };
    if (editing) await update(editing.id, data);
    else await add(data);
    setOpen(false);
  };

  const getFuncName = (id: string | null) => funcionarios.find(f => f.id === id)?.nome || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciar ordens de serviço de segurança</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nova OS</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma OS cadastrada</TableCell></TableRow>
                ) : items.map(os => (
                  <TableRow key={os.id}>
                    <TableCell className="font-mono text-xs font-semibold">{os.numero || "—"}</TableCell>
                    <TableCell className="font-medium">{os.titulo}</TableCell>
                    <TableCell>{getFuncName(os.funcionario_id)}</TableCell>
                    <TableCell>{os.setor || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{os.data}</TableCell>
                    <TableCell><Badge variant={statusConfig[os.status]?.variant || "outline"}>{statusConfig[os.status]?.label || os.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(os)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(os.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Editar OS" : "Nova Ordem de Serviço"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Número</Label><Input value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} /></div>
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} /></div>
            </div>
            <div><Label>Título</Label><Input value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} placeholder="Título da OS" /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Descrição das atividades" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Funcionário</Label>
                <Select value={form.funcionario_id} onValueChange={v => setForm({...form, funcionario_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Setor</Label><Input value={form.setor} onChange={e => setForm({...form, setor: e.target.value})} placeholder="Setor" /></div>
            </div>
            <div><Label>Riscos Envolvidos</Label><Textarea value={form.riscos} onChange={e => setForm({...form, riscos: e.target.value})} placeholder="Riscos identificados" /></div>
            <div><Label>EPIs Necessários</Label><Textarea value={form.epis} onChange={e => setForm({...form, epis: e.target.value})} placeholder="EPIs obrigatórios" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emitida">Emitida</SelectItem>
                  <SelectItem value="assinada">Assinada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

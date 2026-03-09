import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ordemServicoStorage, funcionarioStorage, OrdemServico } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const statusConfig = {
  emitida: { label: "Emitida", variant: "outline" as const },
  assinada: { label: "Assinada", variant: "default" as const },
  cancelada: { label: "Cancelada", variant: "destructive" as const },
};

const emptyForm = (): Omit<OrdemServico, "id"> => ({
  numero: "", titulo: "", descricao: "", funcionarioId: "", setor: "",
  riscos: "", epis: "", data: new Date().toISOString().split("T")[0], status: "emitida",
});

export default function OrdensServico() {
  const [items, setItems] = useState(ordemServicoStorage.getAll());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrdemServico | null>(null);
  const [form, setForm] = useState<Omit<OrdemServico, "id">>(emptyForm());

  const funcionarios = funcionarioStorage.getAll();

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm(), numero: `OS-${String(items.length + 1).padStart(4, "0")}` });
    setOpen(true);
  };
  const openEdit = (os: OrdemServico) => {
    setEditing(os);
    setForm({ numero: os.numero, titulo: os.titulo, descricao: os.descricao, funcionarioId: os.funcionarioId, setor: os.setor, riscos: os.riscos, epis: os.epis, data: os.data, status: os.status });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.titulo.trim()) return;
    if (editing) { ordemServicoStorage.update({ ...editing, ...form }); }
    else { ordemServicoStorage.add({ ...form, id: crypto.randomUUID() }); }
    setItems(ordemServicoStorage.getAll());
    setOpen(false);
  };

  const handleDelete = (id: string) => { ordemServicoStorage.delete(id); setItems(ordemServicoStorage.getAll()); };
  const getFuncName = (id: string) => funcionarios.find(f => f.id === id)?.nome || "—";

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
                  <TableCell className="font-mono text-xs font-semibold">{os.numero}</TableCell>
                  <TableCell className="font-medium">{os.titulo}</TableCell>
                  <TableCell>{getFuncName(os.funcionarioId)}</TableCell>
                  <TableCell>{os.setor}</TableCell>
                  <TableCell className="font-mono text-xs">{os.data}</TableCell>
                  <TableCell><Badge variant={statusConfig[os.status].variant}>{statusConfig[os.status].label}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(os)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(os.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
                <Select value={form.funcionarioId} onValueChange={v => setForm({...form, funcionarioId: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Setor</Label><Input value={form.setor} onChange={e => setForm({...form, setor: e.target.value})} placeholder="Setor" /></div>
            </div>
            <div><Label>Riscos Envolvidos</Label><Textarea value={form.riscos} onChange={e => setForm({...form, riscos: e.target.value})} placeholder="Riscos identificados" /></div>
            <div><Label>EPIs Necessários</Label><Textarea value={form.epis} onChange={e => setForm({...form, epis: e.target.value})} placeholder="EPIs obrigatórios para a atividade" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v as any})}>
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

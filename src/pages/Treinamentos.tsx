import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { treinamentoStorage, funcionarioStorage, Treinamento } from "@/lib/storage";
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

const statusConfig = {
  agendado: { label: "Agendado", variant: "outline" as const },
  realizado: { label: "Realizado", variant: "default" as const },
  cancelado: { label: "Cancelado", variant: "destructive" as const },
};

const emptyForm = (): Omit<Treinamento, "id"> => ({
  nome: "", descricao: "", instrutor: "", data: new Date().toISOString().split("T")[0],
  cargaHoraria: 1, validade: "", participantes: [], status: "agendado",
});

export default function Treinamentos() {
  const [items, setItems] = useState(treinamentoStorage.getAll());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Treinamento | null>(null);
  const [form, setForm] = useState<Omit<Treinamento, "id">>(emptyForm());

  const funcionarios = funcionarioStorage.getAll();

  const openNew = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (t: Treinamento) => {
    setEditing(t);
    setForm({ nome: t.nome, descricao: t.descricao, instrutor: t.instrutor, data: t.data, cargaHoraria: t.cargaHoraria, validade: t.validade, participantes: [...t.participantes], status: t.status });
    setOpen(true);
  };

  const toggleParticipante = (funcId: string) => {
    const arr = form.participantes.includes(funcId)
      ? form.participantes.filter(p => p !== funcId)
      : [...form.participantes, funcId];
    setForm({ ...form, participantes: arr });
  };

  const handleSave = () => {
    if (!form.nome.trim()) return;
    if (editing) { treinamentoStorage.update({ ...editing, ...form }); }
    else { treinamentoStorage.add({ ...form, id: crypto.randomUUID() }); }
    setItems(treinamentoStorage.getAll());
    setOpen(false);
  };

  const handleDelete = (id: string) => { treinamentoStorage.delete(id); setItems(treinamentoStorage.getAll()); };

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
                  <TableCell>{t.instrutor}</TableCell>
                  <TableCell className="font-mono text-xs">{t.data}</TableCell>
                  <TableCell>{t.cargaHoraria}h</TableCell>
                  <TableCell className="font-mono text-xs">{t.participantes.length}</TableCell>
                  <TableCell><Badge variant={statusConfig[t.status].variant}>{statusConfig[t.status].label}</Badge></TableCell>
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
              <div><Label>Carga Horária (h)</Label><Input type="number" min={1} value={form.cargaHoraria} onChange={e => setForm({...form, cargaHoraria: Number(e.target.value)})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} /></div>
              <div><Label>Validade</Label><Input type="date" value={form.validade} onChange={e => setForm({...form, validade: e.target.value})} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v as any})}>
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
                    <Checkbox checked={form.participantes.includes(f.id)} onCheckedChange={() => toggleParticipante(f.id)} />
                    <span>{f.nome}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{f.setor}</span>
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

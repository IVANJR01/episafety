import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { funcionarioStorage, Funcionario } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const empty: Omit<Funcionario, "id"> = { nome: "", matricula: "", setor: "", cargo: "" };

export default function Funcionarios() {
  const [items, setItems] = useState(funcionarioStorage.getAll());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [form, setForm] = useState<Omit<Funcionario, "id">>(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (f: Funcionario) => { setEditing(f); setForm({ nome: f.nome, matricula: f.matricula, setor: f.setor, cargo: f.cargo }); setOpen(true); };

  const handleSave = () => {
    if (!form.nome.trim()) return;
    if (editing) {
      funcionarioStorage.update({ ...editing, ...form });
    } else {
      funcionarioStorage.add({ ...form, id: crypto.randomUUID() });
    }
    setItems(funcionarioStorage.getAll());
    setOpen(false);
  };

  const handleDelete = (id: string) => { funcionarioStorage.delete(id); setItems(funcionarioStorage.getAll()); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funcionários</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciar funcionários</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo Funcionário</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum funcionário cadastrado</TableCell></TableRow>
              ) : items.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{f.matricula}</TableCell>
                  <TableCell>{f.setor}</TableCell>
                  <TableCell>{f.cargo}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(f.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome completo" /></div>
            <div><Label>Matrícula</Label><Input value={form.matricula} onChange={e => setForm({...form, matricula: e.target.value})} placeholder="Nº matrícula" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Setor</Label><Input value={form.setor} onChange={e => setForm({...form, setor: e.target.value})} placeholder="Ex: Produção" /></div>
              <div><Label>Cargo</Label><Input value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} placeholder="Ex: Operador" /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

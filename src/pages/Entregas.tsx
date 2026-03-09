import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { entregaStorage, epiStorage, funcionarioStorage, Entrega } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export default function Entregas() {
  const [entregas, setEntregas] = useState(entregaStorage.getAll());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ funcionarioId: "", epiId: "", quantidade: 1, data: new Date().toISOString().split("T")[0], observacao: "" });

  const funcionarios = funcionarioStorage.getAll();
  const epis = epiStorage.getAll();

  const handleSave = () => {
    if (!form.funcionarioId || !form.epiId) return;
    entregaStorage.add({ ...form, id: crypto.randomUUID() });
    setEntregas(entregaStorage.getAll());
    setOpen(false);
    setForm({ funcionarioId: "", epiId: "", quantidade: 1, data: new Date().toISOString().split("T")[0], observacao: "" });
  };

  const handleDelete = (id: string) => { entregaStorage.delete(id); setEntregas(entregaStorage.getAll()); };

  const getName = (list: { id: string; nome: string }[], id: string) => list.find(i => i.id === id)?.nome || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entregas</h1>
          <p className="text-muted-foreground text-sm mt-1">Registrar entregas de EPI</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nova Entrega</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>EPI</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entregas.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma entrega registrada</TableCell></TableRow>
              ) : [...entregas].reverse().map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.data}</TableCell>
                  <TableCell className="font-medium">{getName(funcionarios, e.funcionarioId)}</TableCell>
                  <TableCell>{getName(epis, e.epiId)}</TableCell>
                  <TableCell className="text-right">{e.quantidade}</TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">{e.observacao || "—"}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Entrega</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Funcionário</Label>
              <Select value={form.funcionarioId} onValueChange={v => setForm({...form, funcionarioId: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>EPI</Label>
              <Select value={form.epiId} onValueChange={v => setForm({...form, epiId: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{epis.map(e => <SelectItem key={e.id} value={e.id}>{e.nome} (estoque: {e.estoque})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Quantidade</Label><Input type="number" min={1} value={form.quantidade} onChange={e => setForm({...form, quantidade: Number(e.target.value)})} /></div>
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} /></div>
            </div>
            <div><Label>Observação</Label><Textarea value={form.observacao} onChange={e => setForm({...form, observacao: e.target.value})} placeholder="Observações opcionais" /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Registrar Entrega</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

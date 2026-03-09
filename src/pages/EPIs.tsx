import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { epiStorage, EPI } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const emptyEpi: Omit<EPI, "id"> = { nome: "", ca: "", validade: "", estoque: 0, estoqueMinimo: 5, categoria: "" };

export default function EPIs() {
  const [epis, setEpis] = useState(epiStorage.getAll());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EPI | null>(null);
  const [form, setForm] = useState<Omit<EPI, "id">>(emptyEpi);

  const openNew = () => { setEditing(null); setForm(emptyEpi); setOpen(true); };
  const openEdit = (e: EPI) => { setEditing(e); setForm({ nome: e.nome, ca: e.ca, validade: e.validade, estoque: e.estoque, estoqueMinimo: e.estoqueMinimo, categoria: e.categoria }); setOpen(true); };

  const handleSave = () => {
    if (!form.nome.trim()) return;
    if (editing) {
      const updated = { ...editing, ...form };
      epiStorage.update(updated);
    } else {
      epiStorage.add({ ...form, id: crypto.randomUUID() });
    }
    setEpis(epiStorage.getAll());
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    epiStorage.delete(id);
    setEpis(epiStorage.getAll());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">EPIs</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciar equipamentos de proteção</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo EPI</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CA</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {epis.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum EPI cadastrado</TableCell></TableRow>
              ) : epis.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{e.ca}</TableCell>
                  <TableCell><Badge variant="secondary">{e.categoria || "—"}</Badge></TableCell>
                  <TableCell>{e.validade || "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className={e.estoque <= e.estoqueMinimo ? "text-destructive font-semibold" : ""}>{e.estoque}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Editar EPI" : "Novo EPI"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Capacete de Segurança" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>CA</Label><Input value={form.ca} onChange={e => setForm({...form, ca: e.target.value})} placeholder="Nº do CA" /></div>
              <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} placeholder="Ex: Cabeça" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Validade</Label><Input type="date" value={form.validade} onChange={e => setForm({...form, validade: e.target.value})} /></div>
              <div><Label>Estoque</Label><Input type="number" value={form.estoque} onChange={e => setForm({...form, estoque: Number(e.target.value)})} /></div>
              <div><Label>Estoque Mín.</Label><Input type="number" value={form.estoqueMinimo} onChange={e => setForm({...form, estoqueMinimo: Number(e.target.value)})} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

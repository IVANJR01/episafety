import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useSupabaseCrud } from "@/hooks/useSupabaseData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface EPI {
  id: string; nome: string; ca: string | null; validade: string | null;
  estoque: number; estoque_minimo: number; categoria: string | null;
}

const emptyForm = { nome: "", ca: "", validade: "", estoque: 0, estoque_minimo: 5, categoria: "" };

export default function EPIs() {
  const { data: epis, loading, add, update, remove } = useSupabaseCrud<EPI>("epis", "created_at");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EPI | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (e: EPI) => {
    setEditing(e);
    setForm({ nome: e.nome, ca: e.ca || "", validade: e.validade || "", estoque: e.estoque, estoque_minimo: e.estoque_minimo, categoria: e.categoria || "" });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const data = { nome: form.nome, ca: form.ca || null, validade: form.validade || null, estoque: form.estoque, estoque_minimo: form.estoque_minimo, categoria: form.categoria || null };
    if (editing) {
      await update(editing.id, data);
    } else {
      await add(data);
    }
    setOpen(false);
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
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : (
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
                    <TableCell className="font-mono text-xs">{e.ca || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{e.categoria || "—"}</Badge></TableCell>
                    <TableCell>{e.validade || "—"}</TableCell>
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
              <div><Label>Estoque Mín.</Label><Input type="number" value={form.estoque_minimo} onChange={e => setForm({...form, estoque_minimo: Number(e.target.value)})} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

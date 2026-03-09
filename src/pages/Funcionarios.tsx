import { useState } from "react";
import { Plus, Pencil, Trash2, User } from "lucide-react";
import { useSupabaseCrud } from "@/hooks/useSupabaseData";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Funcionario {
  id: string; nome: string; matricula: string | null; setor: string | null;
  cargo: string | null; data_admissao: string | null; cpf: string | null;
}

const emptyForm = { nome: "", matricula: "", setor: "", cargo: "", data_admissao: "", cpf: "" };

export default function Funcionarios() {
  const { data: items, loading, add, update, remove } = useSupabaseCrud<Funcionario>("funcionarios", "created_at");
  const { canEdit, canDelete } = usePermissions("cadastro_funcionarios");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (f: Funcionario) => {
    setEditing(f);
    setForm({ nome: f.nome, matricula: f.matricula || "", setor: f.setor || "", cargo: f.cargo || "", data_admissao: f.data_admissao || "", cpf: f.cpf || "" });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const data = { nome: form.nome, matricula: form.matricula || null, setor: form.setor || null, cargo: form.cargo || null, data_admissao: form.data_admissao || null, cpf: form.cpf || null };
    if (editing) await update(editing.id, data);
    else await add(data);
    setOpen(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Funcionários</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Gerenciar funcionários</p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />Novo Funcionário
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 lg:hidden">
            {items.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum funcionário cadastrado</CardContent></Card>
            ) : items.map(f => (
              <Card key={f.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{f.nome}</p>
                        <p className="text-xs text-muted-foreground">{f.cargo || "Sem cargo"} • {f.setor || "Sem setor"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {canEdit && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>}
                      {canDelete && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(f.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">CPF:</span> <span className="font-mono">{f.cpf || "—"}</span></div>
                    <div><span className="text-muted-foreground">Matrícula:</span> <span className="font-mono">{f.matricula || "—"}</span></div>
                    {f.data_admissao && <div><span className="text-muted-foreground">Admissão:</span> <span className="font-mono">{f.data_admissao}</span></div>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table layout */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Admissão</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum funcionário cadastrado</TableCell></TableRow>
                  ) : items.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{f.cpf || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{f.matricula || "—"}</TableCell>
                      <TableCell>{f.setor || "—"}</TableCell>
                      <TableCell>{f.cargo || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{f.data_admissao || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {canEdit && <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>}
                          {canDelete && <Button size="icon" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome completo" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00" /></div>
              <div><Label>Matrícula</Label><Input value={form.matricula} onChange={e => setForm({...form, matricula: e.target.value})} placeholder="Nº matrícula" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Admissão</Label><Input type="date" value={form.data_admissao} onChange={e => setForm({...form, data_admissao: e.target.value})} /></div>
              <div><Label>Setor</Label><Input value={form.setor} onChange={e => setForm({...form, setor: e.target.value})} placeholder="Ex: Produção" /></div>
            </div>
            <div>
              <Label>Cargo</Label><Input value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} placeholder="Ex: Operador" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { exameStorage, funcionarioStorage, Exame } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const tipoLabels: Record<string, string> = {
  admissional: "Admissional", periodico: "Periódico", demissional: "Demissional",
  retorno: "Retorno ao Trabalho", mudanca_funcao: "Mudança de Função",
};

const resultadoConfig: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive" }> = {
  apto: { label: "Apto", variant: "default" },
  inapto: { label: "Inapto", variant: "destructive" },
  apto_com_restricao: { label: "Apto c/ Restrição", variant: "secondary" },
  pendente: { label: "Pendente", variant: "outline" },
};

const emptyForm = (): Omit<Exame, "id"> => ({
  funcionarioId: "", tipo: "periodico", data: new Date().toISOString().split("T")[0],
  dataVencimento: "", resultado: "pendente", medico: "", observacao: "",
});

export default function PCMSO() {
  const [items, setItems] = useState(exameStorage.getAll());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exame | null>(null);
  const [form, setForm] = useState<Omit<Exame, "id">>(emptyForm());

  const funcionarios = funcionarioStorage.getAll();

  const openNew = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (e: Exame) => {
    setEditing(e);
    setForm({ funcionarioId: e.funcionarioId, tipo: e.tipo, data: e.data, dataVencimento: e.dataVencimento, resultado: e.resultado, medico: e.medico, observacao: e.observacao });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.funcionarioId) return;
    if (editing) { exameStorage.update({ ...editing, ...form }); }
    else { exameStorage.add({ ...form, id: crypto.randomUUID() }); }
    setItems(exameStorage.getAll());
    setOpen(false);
  };

  const handleDelete = (id: string) => { exameStorage.delete(id); setItems(exameStorage.getAll()); };
  const getFuncName = (id: string) => funcionarios.find(f => f.id === id)?.nome || "—";

  // Exames vencendo em 30 dias
  const hoje = new Date();
  const em30dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
  const vencendo = items.filter(e => {
    if (!e.dataVencimento) return false;
    const venc = new Date(e.dataVencimento);
    return venc <= em30dias && venc >= hoje;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PCMSO - Exames</h1>
          <p className="text-muted-foreground text-sm mt-1">Controle de exames ocupacionais</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo Exame</Button>
      </div>

      {vencendo.length > 0 && (
        <Card className="border-warning/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="font-semibold text-sm">Exames vencendo nos próximos 30 dias</span>
            </div>
            <div className="space-y-1">
              {vencendo.map(e => (
                <div key={e.id} className="flex justify-between text-sm p-1.5 rounded bg-warning/5">
                  <span>{getFuncName(e.funcionarioId)} — {tipoLabels[e.tipo]}</span>
                  <span className="text-warning font-mono text-xs">{e.dataVencimento}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum exame cadastrado</TableCell></TableRow>
              ) : items.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{getFuncName(e.funcionarioId)}</TableCell>
                  <TableCell><Badge variant="secondary">{tipoLabels[e.tipo]}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{e.data}</TableCell>
                  <TableCell className="font-mono text-xs">{e.dataVencimento || "—"}</TableCell>
                  <TableCell><Badge variant={resultadoConfig[e.resultado].variant}>{resultadoConfig[e.resultado].label}</Badge></TableCell>
                  <TableCell>{e.medico}</TableCell>
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
          <DialogHeader><DialogTitle>{editing ? "Editar Exame" : "Novo Exame"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Funcionário</Label>
              <Select value={form.funcionarioId} onValueChange={v => setForm({...form, funcionarioId: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admissional">Admissional</SelectItem>
                    <SelectItem value="periodico">Periódico</SelectItem>
                    <SelectItem value="demissional">Demissional</SelectItem>
                    <SelectItem value="retorno">Retorno ao Trabalho</SelectItem>
                    <SelectItem value="mudanca_funcao">Mudança de Função</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Resultado</Label>
                <Select value={form.resultado} onValueChange={v => setForm({...form, resultado: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="apto">Apto</SelectItem>
                    <SelectItem value="inapto">Inapto</SelectItem>
                    <SelectItem value="apto_com_restricao">Apto c/ Restrição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data do Exame</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} /></div>
              <div><Label>Vencimento</Label><Input type="date" value={form.dataVencimento} onChange={e => setForm({...form, dataVencimento: e.target.value})} /></div>
            </div>
            <div><Label>Médico</Label><Input value={form.medico} onChange={e => setForm({...form, medico: e.target.value})} placeholder="Nome do médico" /></div>
            <div><Label>Observação</Label><Textarea value={form.observacao} onChange={e => setForm({...form, observacao: e.target.value})} placeholder="Observações" /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

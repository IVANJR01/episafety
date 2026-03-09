import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSupabaseCrud, useSupabaseQuery } from "@/hooks/useSupabaseData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Entrega { id: string; funcionario_id: string; epi_id: string; quantidade: number; data: string; tipo: string; observacao: string | null; status: string; }
interface Funcionario { id: string; nome: string; }
interface EPI { id: string; nome: string; estoque: number; }

const tipoLabels: Record<string, string> = { entrega: "Entrega", troca: "Troca", devolucao: "Devolução" };
const tipoBadge: Record<string, "default" | "secondary" | "outline"> = { entrega: "default", troca: "secondary", devolucao: "outline" };

export default function Entregas() {
  const { data: entregas, loading, add, remove } = useSupabaseCrud<Entrega>("entregas", "created_at");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const { data: epis } = useSupabaseQuery<EPI>("epis");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    funcionario_id: "", epi_id: "", quantidade: 1,
    data: new Date().toISOString().split("T")[0],
    tipo: "entrega" as string, observacao: "",
  });

  const handleSave = async () => {
    if (!form.funcionario_id || !form.epi_id) return;
    const status = form.tipo === "devolucao" ? "devolvido" : form.tipo === "troca" ? "trocado" : "ativo";
    await add({ ...form, status, observacao: form.observacao || null } as any);
    setOpen(false);
    setForm({ funcionario_id: "", epi_id: "", quantidade: 1, data: new Date().toISOString().split("T")[0], tipo: "entrega", observacao: "" });
  };

  const getName = (list: { id: string; nome: string }[], id: string) => list.find(i => i.id === id)?.nome || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entregas de EPI</h1>
          <p className="text-muted-foreground text-sm mt-1">Entrega, troca e devolução de EPIs</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nova Movimentação</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>EPI</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Obs</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entregas.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma movimentação registrada</TableCell></TableRow>
                ) : entregas.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.data}</TableCell>
                    <TableCell><Badge variant={tipoBadge[e.tipo] || "default"}>{tipoLabels[e.tipo] || e.tipo}</Badge></TableCell>
                    <TableCell className="font-medium">{getName(funcionarios, e.funcionario_id)}</TableCell>
                    <TableCell>{getName(epis, e.epi_id)}</TableCell>
                    <TableCell className="text-right">{e.quantidade}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${e.status === "ativo" ? "text-success" : "text-muted-foreground"}`}>
                        {e.status === "ativo" ? "Ativo" : e.status === "devolvido" ? "Devolvido" : "Trocado"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">{e.observacao || "—"}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrega">📦 Entrega</SelectItem>
                  <SelectItem value="troca">🔄 Troca</SelectItem>
                  <SelectItem value="devolucao">↩️ Devolução</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Funcionário</Label>
              <Select value={form.funcionario_id} onValueChange={v => setForm({...form, funcionario_id: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>EPI</Label>
              <Select value={form.epi_id} onValueChange={v => setForm({...form, epi_id: v})}>
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
          <DialogFooter><Button onClick={handleSave}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

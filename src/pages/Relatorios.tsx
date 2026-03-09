import { useState } from "react";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Entrega { id: string; funcionario_id: string; epi_id: string; quantidade: number; data: string; }
interface Funcionario { id: string; nome: string; setor: string | null; }
interface EPI { id: string; nome: string; }

export default function Relatorios() {
  const { data: entregas } = useSupabaseQuery<Entrega>("entregas", "created_at");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const { data: epis } = useSupabaseQuery<EPI>("epis");

  const [filtroFunc, setFiltroFunc] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const setores = [...new Set(funcionarios.map(f => f.setor).filter(Boolean))];

  const filtered = entregas.filter(e => {
    const func = funcionarios.find(f => f.id === e.funcionario_id);
    if (filtroFunc && filtroFunc !== "all" && e.funcionario_id !== filtroFunc) return false;
    if (filtroSetor && filtroSetor !== "all" && func?.setor !== filtroSetor) return false;
    if (dataInicio && e.data < dataInicio) return false;
    if (dataFim && e.data > dataFim) return false;
    return true;
  });

  const totalItens = filtered.reduce((a, e) => a + e.quantidade, 0);
  const byEpi: Record<string, number> = {};
  filtered.forEach(e => { byEpi[e.epi_id] = (byEpi[e.epi_id] || 0) + e.quantidade; });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-1">Filtrar e analisar entregas</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">Funcionário</Label>
              <Select value={filtroFunc} onValueChange={setFiltroFunc}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Setor</Label>
              <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {setores.map(s => <SelectItem key={s!} value={s!}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Data início</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
            <div><Label className="text-xs">Data fim</Label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total de entregas</span><span className="font-semibold">{filtered.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total de itens</span><span className="font-semibold">{totalItens}</span></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Por EPI</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {Object.entries(byEpi).map(([epiId, qty]) => (
                <div key={epiId} className="flex justify-between">
                  <span className="text-muted-foreground">{epis.find(e => e.id === epiId)?.nome || "—"}</span>
                  <span className="font-semibold">{qty}</span>
                </div>
              ))}
              {Object.keys(byEpi).length === 0 && <p className="text-muted-foreground text-center py-2">Sem dados</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Detalhamento</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>EPI</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem resultados</TableCell></TableRow>
              ) : filtered.map(e => {
                const func = funcionarios.find(f => f.id === e.funcionario_id);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.data}</TableCell>
                    <TableCell className="font-medium">{func?.nome || "—"}</TableCell>
                    <TableCell>{func?.setor || "—"}</TableCell>
                    <TableCell>{epis.find(ep => ep.id === e.epi_id)?.nome || "—"}</TableCell>
                    <TableCell className="text-right">{e.quantidade}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

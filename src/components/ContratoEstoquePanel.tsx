import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Plus, Minus, Save, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ContratoEpiRow {
  id: string;
  epi_id: string;
  epi_nome: string;
  epi_ca: string | null;
  epi_categoria: string | null;
  estoque: number;
  dirty: boolean;
}

interface Props {
  filialId: string;
  contratoId: string;
  contratoNome: string;
}

export default function ContratoEstoquePanel({ filialId, contratoId, contratoNome }: Props) {
  const [rows, setRows] = useState<ContratoEpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState("");
  const [availableEpis, setAvailableEpis] = useState<{ id: string; nome: string; ca: string | null; categoria: string | null }[]>([]);
  const [addEpiId, setAddEpiId] = useState("");
  const [addingEpi, setAddingEpi] = useState(false);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    const [contEpisRes, allEpisRes] = await Promise.all([
      supabase
        .from("contrato_epis")
        .select("id, epi_id, estoque")
        .eq("contrato_id", contratoId),
      supabase
        .from("epis")
        .select("id, nome, ca, categoria")
        .eq("empresa_id", filialId)
        .order("nome"),
    ]);

    const allEpis = allEpisRes.data || [];
    const contEpis = contEpisRes.data || [];
    const contEpiMap = new Map(contEpis.map(ce => [ce.epi_id, ce]));

    const mapped: ContratoEpiRow[] = contEpis.map(ce => {
      const epi = allEpis.find(e => e.id === ce.epi_id);
      return {
        id: ce.id,
        epi_id: ce.epi_id,
        epi_nome: epi?.nome || "EPI removido",
        epi_ca: epi?.ca || null,
        epi_categoria: epi?.categoria || null,
        estoque: ce.estoque,
        dirty: false,
      };
    });

    setRows(mapped.sort((a, b) => a.epi_nome.localeCompare(b.epi_nome)));
    setAvailableEpis(allEpis.filter(e => !contEpiMap.has(e.id)));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [filialId, contratoId]);

  const updateEstoque = (epiId: string, delta: number) => {
    setRows(prev => prev.map(r =>
      r.epi_id === epiId
        ? { ...r, estoque: Math.max(0, r.estoque + delta), dirty: true }
        : r
    ));
  };

  const setEstoque = (epiId: string, value: number) => {
    setRows(prev => prev.map(r =>
      r.epi_id === epiId
        ? { ...r, estoque: Math.max(0, value), dirty: true }
        : r
    ));
  };

  const addEpi = async () => {
    if (!addEpiId) return;
    setAddingEpi(true);
    const { data: inserted, error } = await supabase.from("contrato_epis").insert({
      contrato_id: contratoId,
      epi_id: addEpiId,
      estoque: 0,
      empresa_id: filialId,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    }).select("id, epi_id, estoque").single();

    if (error) {
      toast({ title: "Erro ao adicionar EPI", description: error.message, variant: "destructive" });
    } else if (inserted) {
      const epi = availableEpis.find(e => e.id === addEpiId);
      setRows(prev => [...prev, {
        id: inserted.id,
        epi_id: inserted.epi_id,
        epi_nome: epi?.nome || "",
        epi_ca: epi?.ca || null,
        epi_categoria: epi?.categoria || null,
        estoque: 0,
        dirty: false,
      }].sort((a, b) => a.epi_nome.localeCompare(b.epi_nome)));
      setAvailableEpis(prev => prev.filter(e => e.id !== addEpiId));
      toast({ title: "EPI adicionado ao contrato!" });
    }
    setAddEpiId("");
    setAddingEpi(false);
  };

  const saveAll = async () => {
    const dirtyRows = rows.filter(r => r.dirty);
    if (dirtyRows.length === 0) return;
    setSaving(true);

    const promises = dirtyRows.map(r =>
      supabase.from("contrato_epis").update({ estoque: r.estoque }).eq("id", r.id)
    );
    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      toast({ title: "Erro ao salvar", description: `${errors.length} item(s) falharam`, variant: "destructive" });
    } else {
      setRows(prev => prev.map(r => ({ ...r, dirty: false })));
      toast({ title: "Estoque atualizado!", description: `${dirtyRows.length} item(s) salvo(s)` });
    }
    setSaving(false);
  };

  const removeEpi = async (row: ContratoEpiRow) => {
    const { error } = await supabase.from("contrato_epis").delete().eq("id", row.id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setRows(prev => prev.filter(r => r.id !== row.id));
    setAvailableEpis(prev => [...prev, { id: row.epi_id, nome: row.epi_nome, ca: row.epi_ca, categoria: row.epi_categoria }].sort((a, b) => a.nome.localeCompare(b.nome)));
    toast({ title: "EPI removido do contrato" });
  };

  const hasDirty = rows.some(r => r.dirty);
  const filtered = rows.filter(r => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return r.epi_nome.toLowerCase().includes(t) || (r.epi_ca && r.epi_ca.toLowerCase().includes(t));
  });

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando estoque do contrato...
      </div>
    );
  }

  return (
    <div className="border-b px-3 py-3 space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-primary" />
          Estoque do Contrato — {contratoNome}
        </p>
        {hasDirty && (
          <Button size="sm" className="h-6 text-[11px] gap-1" onClick={saveAll} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Salvar Alterações ({rows.filter(r => r.dirty).length})
          </Button>
        )}
      </div>

      {/* Add EPI + search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5 flex-1">
          <Select value={addEpiId} onValueChange={setAddEpiId}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="Adicionar EPI ao contrato..." />
            </SelectTrigger>
            <SelectContent>
              {availableEpis.length === 0 ? (
                <SelectItem value="__none" disabled>Todos os EPIs já foram adicionados</SelectItem>
              ) : (
                availableEpis.map(e => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">
                    {e.nome} {e.ca ? `(CA: ${e.ca})` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={addEpi} disabled={!addEpiId || addingEpi}>
            {addingEpi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Adicionar
          </Button>
        </div>
        {rows.length > 5 && (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              className="h-7 text-xs pl-7 w-full sm:w-40"
              placeholder="Buscar..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhum EPI vinculado a este contrato. Adicione EPIs acima.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs py-1.5">EPI</TableHead>
              <TableHead className="text-xs py-1.5">CA</TableHead>
              <TableHead className="text-xs py-1.5">Categoria</TableHead>
              <TableHead className="text-xs py-1.5 text-center w-[180px]">Estoque Contrato</TableHead>
              <TableHead className="text-xs py-1.5 w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(row => (
              <TableRow key={row.id} className={row.dirty ? "bg-primary/5" : ""}>
                <TableCell className="text-xs py-1.5 font-medium">{row.epi_nome}</TableCell>
                <TableCell className="text-xs py-1.5 font-mono">{row.epi_ca || "—"}</TableCell>
                <TableCell className="text-xs py-1.5">
                  {row.epi_categoria ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{row.epi_categoria}</Badge> : "—"}
                </TableCell>
                <TableCell className="text-xs py-1">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => updateEstoque(row.epi_id, -1)}
                      disabled={row.estoque <= 0}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      value={row.estoque}
                      onChange={e => setEstoque(row.epi_id, Number(e.target.value))}
                      className="h-6 w-16 text-xs text-center font-mono font-bold px-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => updateEstoque(row.epi_id, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    {row.dirty && <Badge className="text-[9px] px-1 py-0 ml-1 bg-primary/20 text-primary">alterado</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-xs py-1.5">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeEpi(row)}>
                    ✕
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

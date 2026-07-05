import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Download, Pencil, Trash2, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import InventarioItemDialog from "./InventarioItemDialog";
import ImportarGheDialog from "./ImportarGheDialog";
import MatrizRisco from "./MatrizRisco";
import {
  classificarRisco, CLASSE_TEXT, CLASSE_LABEL, GRUPO_LABEL,
  EXPOSICAO_LABEL, AVALIACAO_LABEL,
} from "@/lib/pgrMatriz";
import { isEditavel, PgrStatus } from "@/lib/pgrTypes";

export default function InventarioTab({
  pgrId, empresaId, status, canEdit,
}: {
  pgrId: string; empresaId: string; status: PgrStatus; canEdit: boolean;
}) {
  const qc = useQueryClient();
  const editavel = isEditavel(status) && canEdit;
  const [busca, setBusca] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["pgr-inventario", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_inventario_itens")
        .select("*, ghe:ghe_id(id, codigo, nome)")
        .eq("pgr_id", pgrId).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    if (!q) return itens;
    return itens.filter((i: any) =>
      i.perigo_descricao?.toLowerCase().includes(q) ||
      i.fonte_geradora?.toLowerCase().includes(q) ||
      i.ghe?.codigo?.toLowerCase().includes(q) ||
      i.ghe?.nome?.toLowerCase().includes(q));
  }, [itens, busca]);

  const stats = useMemo(() => {
    const s = { total: itens.length, baixo: 0, moderado: 0, alto: 0, critico: 0, acao: 0 };
    itens.forEach((i: any) => {
      const c = i.classificacao || classificarRisco(i.severidade, i.probabilidade);
      (s as any)[c]++;
      if (i.necessita_acao) s.acao++;
    });
    return s;
  }, [itens]);

  const excluir = async (id: string) => {
    if (!confirm("Excluir este item do inventário?")) return;
    const { error } = await (supabase.from as any)("pgr_inventario_itens").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Item excluído"); qc.invalidateQueries({ queryKey: ["pgr-inventario", pgrId] }); }
  };

  const onSaved = () => qc.invalidateQueries({ queryKey: ["pgr-inventario", pgrId] });

  return (
    <div className="space-y-3">
      {!editavel && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            PGR <b>{status}</b> não permite edição direta do inventário. Abra uma revisão para alterar.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Total: {stats.total}</Badge>
            <Badge className={CLASSE_TEXT.baixo} variant="outline">Baixo: {stats.baixo}</Badge>
            <Badge className={CLASSE_TEXT.moderado} variant="outline">Moderado: {stats.moderado}</Badge>
            <Badge className={CLASSE_TEXT.alto} variant="outline">Alto: {stats.alto}</Badge>
            <Badge className={CLASSE_TEXT.critico} variant="outline">Crítico: {stats.critico}</Badge>
            <Badge className="bg-orange-100 text-orange-800 border-orange-300" variant="outline">
              Requer ação: {stats.acao}
            </Badge>
          </div>
          <div className="flex gap-2">
            {editavel && (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Download className="h-4 w-4 mr-1" /> Importar GES
                </Button>
                <Button size="sm" onClick={() => { setEditId(null); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Novo item
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por perigo, GHE, fonte..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {isLoading ? (
            <p className="text-center py-6 text-muted-foreground text-sm">Carregando…</p>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">Nenhum item no inventário ainda.</p>
              {editavel && <p className="text-xs text-muted-foreground mt-1">Use “Importar GES” ou “Novo item”.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">GES</th>
                    <th className="p-2 text-left">Setor</th>
                    <th className="p-2 text-left">Funções expostas</th>
                    <th className="p-2 text-left">Processo</th>
                    <th className="p-2 text-left">Grupo</th>
                    <th className="p-2 text-left">Perigo</th>
                    <th className="p-2 text-left">Fonte</th>
                    <th className="p-2 text-left">Exposição</th>
                    <th className="p-2 text-left">Aval.</th>
                    <th className="p-2 text-center">S×P</th>
                    <th className="p-2 text-center">Nível</th>
                    <th className="p-2 text-left">Classificação</th>
                    <th className="p-2 text-center">Exp.</th>
                    <th className="p-2 text-center">Ação?</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((i: any) => {
                    const cls = (i.classificacao || classificarRisco(i.severidade, i.probabilidade)) as keyof typeof CLASSE_TEXT;
                    return (
                      <tr key={i.id} className="border-t hover:bg-muted/40">
                        <td className="p-2">{i.ghe ? `${i.ghe.codigo} — ${i.ghe.nome}` : "—"}</td>
                        <td className="p-2">{GRUPO_LABEL[i.grupo] || i.grupo}</td>
                        <td className="p-2 max-w-[200px] truncate" title={i.perigo_descricao}>{i.perigo_descricao}</td>
                        <td className="p-2 max-w-[140px] truncate" title={i.fonte_geradora || ""}>{i.fonte_geradora || "—"}</td>
                        <td className="p-2">{EXPOSICAO_LABEL[i.tipo_exposicao] || i.tipo_exposicao}</td>
                        <td className="p-2">
                          {AVALIACAO_LABEL[i.avaliacao_tipo]}
                          {i.avaliacao_tipo === "quantitativa" && i.excedente && (
                            <Badge className="ml-1 bg-red-100 text-red-800 border-red-300" variant="outline">excede LT</Badge>
                          )}
                        </td>
                        <td className="p-2 text-center">{i.severidade}×{i.probabilidade}</td>
                        <td className="p-2 text-center font-semibold">{i.nivel_risco ?? i.severidade*i.probabilidade}</td>
                        <td className="p-2"><Badge className={CLASSE_TEXT[cls]} variant="outline">{CLASSE_LABEL[cls]}</Badge></td>
                        <td className="p-2 text-center">
                          {i.trabalhadores_expostos}
                          {i.trabalhadores_ajuste_manual && <span className="text-amber-700 ml-1" title={i.justificativa || ""}>*</span>}
                        </td>
                        <td className="p-2 text-center">{i.necessita_acao ? "✓" : "—"}</td>
                        <td className="p-2 text-right">
                          {editavel && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => { setEditId(i.id); setDialogOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => excluir(i.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-red-600" />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[10px] text-muted-foreground mt-2">* trabalhadores expostos com ajuste manual (passe o mouse para ver justificativa).</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="text-xs font-semibold mb-2">Matriz de risco 5×5 (referência)</div>
          <MatrizRisco compact />
        </CardContent>
      </Card>

      <InventarioItemDialog
        open={dialogOpen} onOpenChange={setDialogOpen}
        pgrId={pgrId} empresaId={empresaId} itemId={editId} onSaved={onSaved}
      />
      <ImportarGheDialog
        open={importOpen} onOpenChange={setImportOpen}
        pgrId={pgrId} onImported={onSaved}
      />
    </div>
  );
}

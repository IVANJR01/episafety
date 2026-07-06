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
  classificarRisco, CLASSE_TEXT, GRUPO_LABEL,
  classificarRiscoPGR, CLASSE_PGR_LABEL, CLASSE_PGR_TEXT,
} from "@/lib/pgrMatriz";
import { isEditavel, PgrStatus } from "@/lib/pgrTypes";

const NA = "N.A";
const val = (v: any) => (v === null || v === undefined || v === "" ? NA : v);

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
        .select("*, ghe:ghe_id(id, codigo, nome, descricao_ambiente, ambiente, setor, processo)")
        .eq("pgr_id", pgrId).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const ambienteDe = (i: any): string =>
    i.descricao_ambiente || i.ghe?.descricao_ambiente || i.ghe?.ambiente || "";

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    const base = !q ? itens : itens.filter((i: any) =>
      i.perigo_descricao?.toLowerCase().includes(q) ||
      i.fonte_geradora?.toLowerCase().includes(q) ||
      i.ghe?.codigo?.toLowerCase().includes(q) ||
      i.ghe?.nome?.toLowerCase().includes(q));
    // Ordenar por GES + ambiente + setor para permitir agrupamento visual
    return [...base].sort((a: any, b: any) => {
      const ga = a.ghe?.codigo || ""; const gb = b.ghe?.codigo || "";
      if (ga !== gb) return ga.localeCompare(gb);
      const aa = ambienteDe(a); const ab = ambienteDe(b);
      if (aa !== ab) return aa.localeCompare(ab);
      return (a.setor || "").localeCompare(b.setor || "");
    });
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
            <div className="overflow-x-auto -mx-3 px-3">
              <table className="w-full text-xs border-collapse min-w-[1800px]">
                <thead className="bg-amber-100 sticky top-0">
                  <tr className="text-amber-900">
                    <th className="p-2 text-left border border-amber-300 min-w-[220px]">Descrição do ambiente</th>
                    <th className="p-2 text-center border border-amber-300 w-[60px]">GES</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[110px]">Setor</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[180px]">Função</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[200px]">Processo</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[110px]">Agente</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[150px]">Tipo de agente</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[180px]">Perigo / Fonte</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[180px]">Possíveis lesões</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[100px]">Limite exp.</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[110px]">Intensidade</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[120px]">Tipo/tempo exp.</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[180px]">Medidas existentes</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[100px]">EPI</th>
                    <th className="p-2 text-center border border-amber-300 w-[50px]">Prob.</th>
                    <th className="p-2 text-center border border-amber-300 w-[50px]">Sev.</th>
                    <th className="p-2 text-center border border-amber-300 w-[50px]">Total</th>
                    <th className="p-2 text-left border border-amber-300 min-w-[120px]">Classificação</th>
                    <th className="p-2 border border-amber-300 w-[70px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((i: any, idx: number) => {
                    const prev = idx > 0 ? filtrados[idx - 1] : null;
                    const ambiente = ambienteDe(i);
                    const gesCod = i.ghe?.codigo || "";
                    const sameAmbiente = prev && ambienteDe(prev) === ambiente && (prev.ghe?.codigo || "") === gesCod;
                    const sameGes = prev && (prev.ghe?.codigo || "") === gesCod && ambienteDe(prev) === ambiente;
                    const clsPgr = classificarRiscoPGR(i.severidade, i.probabilidade);
                    const total = i.nivel_risco ?? i.severidade * i.probabilidade;
                    const controles = Array.isArray(i.controles_existentes) && i.controles_existentes.length > 0
                      ? i.controles_existentes.join("; ") : NA;
                    const funcoes = Array.isArray(i.funcoes_snapshot) && i.funcoes_snapshot.length > 0
                      ? i.funcoes_snapshot.join(", ") : NA;
                    const intensidade = i.medicao_valor != null
                      ? `${i.medicao_valor}${i.medicao_unidade ? " " + i.medicao_unidade : ""}` : NA;
                    return (
                      <tr key={i.id} className={`border-t hover:bg-muted/40 align-top ${sameAmbiente ? "" : "border-t-2 border-t-amber-300"}`}>
                        <td className={`p-2 border ${sameAmbiente ? "text-transparent border-t-0" : ""}`}>{ambiente || NA}</td>
                        <td className={`p-2 border text-center font-semibold ${sameGes ? "text-transparent border-t-0" : ""}`}>{gesCod || NA}</td>
                        <td className="p-2 border">{val(i.setor)}</td>
                        <td className="p-2 border">{funcoes}</td>
                        <td className="p-2 border">{val(i.processo)}</td>
                        <td className="p-2 border">{GRUPO_LABEL[i.grupo] || NA}</td>
                        <td className="p-2 border">{val(i.perigo_descricao)}</td>
                        <td className="p-2 border">{val(i.fonte_geradora)}</td>
                        <td className="p-2 border">{val(i.lesoes)}</td>
                        <td className="p-2 border">{val(i.limite_tolerancia)}</td>
                        <td className="p-2 border">{intensidade}</td>
                        <td className="p-2 border">{val(i.tipo_exposicao)}</td>
                        <td className="p-2 border">{controles}</td>
                        <td className="p-2 border">{val(i.epi)}</td>
                        <td className="p-2 border text-center">{i.probabilidade}</td>
                        <td className="p-2 border text-center">{i.severidade}</td>
                        <td className="p-2 border text-center font-semibold">{total}</td>
                        <td className="p-2 border">
                          <Badge className={CLASSE_PGR_TEXT[clsPgr]} variant="outline">
                            {CLASSE_PGR_LABEL[clsPgr]}
                          </Badge>
                        </td>
                        <td className="p-2 border text-right whitespace-nowrap">
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
              <p className="text-[10px] text-muted-foreground mt-2">
                Classificação PGR — Trivial (1-3) · Tolerável (4-8) · Moderado (9-12) · Substancial (13-15) · Intolerável (16-25).
                Campos sem dado exibem <b>N.A</b>.
              </p>
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

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Search, AlertTriangle, ArrowDownToLine, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import InventarioItemDialog from "./InventarioItemDialog";
import {
  classificarRisco, classeLabel, CLASSE_LABEL, CLASSE_TEXT,
  CLASSES_ORDENADAS, GRUPO_LABEL, PgrClasse,
} from "@/lib/pgrMatriz";
import { isEditavel, PgrStatus } from "@/lib/pgrTypes";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Linha de pgr_levantamento_preliminar, na forma que esta tela consome. */
interface Levantado {
  id: string;
  grupo: string;
  perigo_descricao: string;
  fonte_circunstancia?: string | null;
  possiveis_lesoes?: string | null;
  trabalhadores_expostos?: string | null;
  medidas_existentes?: string | null;
  ges_id?: string | null;
  ges?: { id: string; codigo: string; nome: string } | null;
}

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
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [delState, setDelState] = useState<{ ids: string[]; setores: string[] } | null>(null);
  const [preencher, setPreencher] = useState<Record<string, string> | null>(null);

  /**
   * Colunas de detalhe (limite de exposição, intensidade, técnica utilizada,
   * atenuação) escondidas por padrão.
   *
   * Elas só se aplicam a risco medido instrumentalmente — num levantamento
   * qualitativo saem todas "N.A" — e custavam 420px de rolagem horizontal numa
   * planilha que já tem 2100px. Nada foi removido: o Excel e o PDF continuam
   * saindo com o formato completo, que é o que o documento exige.
   */
  const [detalhes, setDetalhes] = useState(false);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["pgr-inventario", pgrId, "v2-ambiente"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_inventario_itens")
        .select("*, ghe:ghe_id(id, codigo, nome, descricao_ambiente, ambiente, setor, processo)")
        .eq("pgr_id", pgrId).order("created_at", { ascending: false });
      return data || [];
    },
    staleTime: 0,
  });

  /**
   * Perigos levantados na etapa 5 que ainda não viraram item do inventário.
   *
   * As duas telas pediam as mesmas seis informações. Sem esta ponte, quem
   * levantasse o perigo na etapa 5 digitava tudo de novo aqui.
   */
  const { data: levantados = [] } = useQuery<Levantado[]>({
    queryKey: ["pgr-levantamento-pendente", pgrId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from as any)("pgr_levantamento_preliminar")
        .select("*, ges:ges_id(id, codigo, nome)")
        .eq("pgr_id", pgrId).order("created_at", { ascending: false });
      return (data || []) as Levantado[];
    },
    staleTime: 0,
  });

  const clean = (v: any) => {
    const s = (v ?? "").toString().trim();
    return s && s.toUpperCase() !== "N.A" && s.toUpperCase() !== "N/A" ? s : "";
  };

  /** Já está no inventário? Compara pelo texto do perigo, normalizado. */
  const naoAproveitados = useMemo(() => {
    const norm = (s: string) => (s || "").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const jaNoInventario = new Set(
      (itens as { perigo_descricao?: string }[]).map((i) => norm(i.perigo_descricao || "")),
    );
    return levantados.filter((l) => !jaNoInventario.has(norm(l.perigo_descricao)));
  }, [levantados, itens]);
  const ambienteDe = (i: any): string =>
    clean(i.descricao_ambiente) || clean(i.ghe?.descricao_ambiente) || clean(i.ghe?.ambiente) || "";

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
    const porClasse: Record<PgrClasse, number> = {
      trivial: 0, toleravel: 0, moderado: 0, substancial: 0, intoleravel: 0,
    };
    let naoAvaliado = 0;
    let acao = 0;
    itens.forEach((i: any) => {
      const c = (i.classificacao as PgrClasse | null)
        ?? classificarRisco(i.severidade, i.probabilidade);
      if (c && porClasse[c] != null) porClasse[c]++;
      else naoAvaliado++;
      if (i.necessita_acao) acao++;
    });
    return { total: itens.length, porClasse, naoAvaliado, acao };
  }, [itens]);

  const excluirGrupo = async (ids: string[]) => {
    const { error } = await (supabase.from as any)("pgr_inventario_itens").delete().in("id", ids);
    if (error) toast.error(error.message);
    else {
      toast.success(ids.length > 1 ? `${ids.length} itens excluídos` : "Item excluído");
      qc.invalidateQueries({ queryKey: ["pgr-inventario", pgrId] });
    }
    setDelState(null);
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
            {CLASSES_ORDENADAS.map((c) => (
              <Badge key={c} className={CLASSE_TEXT[c]} variant="outline">
                {CLASSE_LABEL[c]}: {stats.porClasse[c]}
              </Badge>
            ))}
            {stats.naoAvaliado > 0 && (
              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                Não avaliado: {stats.naoAvaliado}
              </Badge>
            )}
            <Badge className="bg-orange-100 text-orange-800 border-orange-300" variant="outline">
              Requer ação: {stats.acao}
            </Badge>
          </div>
          <div className="flex gap-2">
            {editavel && (
              <>
                {/* "Importar GES" saiu: criava linhas a partir dos setores com
                    ambiente, processo e funções preenchidos — exatamente o que
                    "Novo item" passou a fazer sozinho ao escolher o GES. Eram
                    dois caminhos para a mesma linha, e o de importação ainda
                    pedia para escolher o grupo de novo, no fim. */}
                <Button size="sm" onClick={() => { setEditId(null); setPreencher(null); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Novo item
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDetalhes((v) => !v)}
                  title="Limite de exposição, intensidade, técnica utilizada e atenuação">
                  {detalhes ? <><EyeOff className="h-4 w-4 mr-1" /> Menos colunas</> : <><Eye className="h-4 w-4 mr-1" /> Colunas de medição</>}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Perigos da antiga etapa "Perigos e riscos", que virou este inventário.
          O painel drena o que ficou lá — depois de vazio, não aparece mais. */}
      {editavel && naoAproveitados.length > 0 && (
        <Card className="border-sky-300 bg-sky-50/60">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <ArrowDownToLine className="h-4 w-4 mt-0.5 shrink-0 text-sky-700" />
              <p className="text-sm text-sky-900">
                <b>{naoAproveitados.length}</b> {naoAproveitados.length === 1 ? "perigo levantado" : "perigos levantados"} antes
                {naoAproveitados.length === 1 ? " ainda não está" : " ainda não estão"} no inventário.
                Traga para cá já preenchido — só falta classificar na matriz.
              </p>
            </div>
            <ul className="space-y-1">
              {naoAproveitados.map((l) => (
                <li key={l.id} className="flex items-center gap-2 rounded border bg-background px-2 py-1.5">
                  <Badge variant="outline" className="shrink-0 text-[11px]">
                    {GRUPO_LABEL[l.grupo] || l.grupo}
                  </Badge>
                  <span className="text-sm min-w-0 flex-1 truncate" title={l.perigo_descricao}>
                    {l.perigo_descricao}
                  </span>
                  {l.ges?.codigo && (
                    <span className="text-xs text-muted-foreground shrink-0">{l.ges.codigo}</span>
                  )}
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs shrink-0"
                    onClick={() => {
                      setEditId(null);
                      setPreencher({
                        grupo: l.grupo || "fisico",
                        perigo_descricao: l.perigo_descricao || "",
                        fonte_geradora: l.fonte_circunstancia || "",
                        lesoes: l.possiveis_lesoes || "",
                        funcoes_text: l.trabalhadores_expostos || "",
                        controles_text: l.medidas_existentes || "",
                        ghe_id: l.ges_id || "",
                      });
                      setDialogOpen(true);
                    }}
                  >
                    Trazer
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
              {editavel && <p className="text-xs text-muted-foreground mt-1">Clique em “Novo item”: escolhido o GES, ambiente, setor, processo e funções vêm junto.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 px-3">
              <table className={`w-full text-[11px] border-collapse ${detalhes ? "min-w-[2100px]" : "min-w-[1680px]"}`}>
                <thead className="bg-amber-200 sticky top-0 z-10">
                  <tr className="text-amber-950">
                    <th className="p-2 text-left border border-amber-400 min-w-[200px]">Descrição do ambiente</th>
                    <th className="p-2 text-left border border-amber-400 min-w-[110px]">Setor</th>
                    <th className="p-2 text-center border border-amber-400 w-[60px]">GES</th>
                    <th className="p-2 text-left border border-amber-400 min-w-[170px]">Função</th>
                    <th className="p-2 text-left border border-amber-400 min-w-[180px]">Processo</th>
                    <th className="p-2 text-left border border-amber-400 min-w-[110px]">Agente</th>
                    <th className="p-2 text-left border border-amber-400 min-w-[130px]">Tipo de Agente</th>
                    <th className="p-2 text-left border border-amber-400 min-w-[170px]">Perigo / Fonte Exposição</th>
                    <th className="p-2 text-left border border-amber-400 min-w-[170px]">Possíveis Lesões ou<br/>Agravos à Saúde</th>
                    {detalhes && <th className="p-2 text-left border border-amber-400 min-w-[100px]">Limite de<br/>Exposição</th>}
                    {detalhes && <th className="p-2 text-left border border-amber-400 min-w-[110px]">Intensidade /<br/>Concentração</th>}
                    <th className="p-2 text-left border border-amber-400 min-w-[120px]">Tipo / Tempo<br/>de Exposição</th>
                    {detalhes && <th className="p-2 text-left border border-amber-400 min-w-[110px]">Técnica<br/>Utilizada</th>}
                    <th className="p-2 text-left border border-amber-400 min-w-[200px]">Proc. Administrativo / EPC /<br/>Organização do Trabalho</th>
                    <th className="p-2 text-left border border-amber-400 min-w-[110px]">EPI</th>
                    {detalhes && <th className="p-2 text-left border border-amber-400 min-w-[100px]">Atenuação /<br/>Fator de Proteção</th>}
                    <th className="p-2 text-center border border-amber-400 w-[55px]">Prob.</th>
                    <th className="p-2 text-center border border-amber-400 w-[55px]">Sev.</th>
                    <th className="p-2 text-center border border-amber-400 w-[55px]">Total</th>
                    <th className="p-2 text-left border border-amber-400 min-w-[120px]">Classificação<br/>do Risco</th>
                    <th className="p-2 border border-amber-400 w-[76px] sticky right-0 z-20 bg-amber-200 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.25)]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((i: any, idx: number) => {
                    const ambiente = ambienteDe(i);
                    const gesCod = i.ghe?.codigo || "";
                    const groupKey = `${gesCod}||${ambiente}`;
                    const prev = idx > 0 ? filtrados[idx - 1] : null;
                    const prevKey = prev ? `${prev.ghe?.codigo || ""}||${ambienteDe(prev)}` : null;
                    const isFirstOfGroup = groupKey !== prevKey;
                    let rowSpan = 1;
                    if (isFirstOfGroup) {
                      for (let j = idx + 1; j < filtrados.length; j++) {
                        const n = filtrados[j];
                        const nKey = `${n.ghe?.codigo || ""}||${ambienteDe(n)}`;
                        if (nKey === groupKey) rowSpan++;
                        else break;
                      }
                    }
                    // O valor gravado pelo trigger tem precedência; o cálculo local
                    // é apenas fallback para itens ainda não persistidos.
                    const clsPgr = (i.classificacao as PgrClasse | null)
                      ?? classificarRisco(i.severidade, i.probabilidade);
                    const total = i.nivel_risco ?? i.severidade * i.probabilidade;
                    const controles = Array.isArray(i.controles_existentes) && i.controles_existentes.length > 0
                      ? i.controles_existentes.join("; ") : NA;
                    const funcoes = Array.isArray(i.funcoes_snapshot) && i.funcoes_snapshot.length > 0
                      ? i.funcoes_snapshot.join(", ") : NA;
                    const intensidade = i.medicao_valor != null
                      ? `${i.medicao_valor}${i.medicao_unidade ? " " + i.medicao_unidade : ""}` : NA;
                    const tecnica = val(i.metodologia_avaliacao ?? i.tecnica_utilizada ?? i.tipo_avaliacao);
                    const atenuacao = val(i.atenuacao ?? i.fator_protecao ?? i.epi_fator_protecao);

                    // Chave de agrupamento do risco (dentro do mesmo GES+ambiente)
                    const riskKey = [
                      groupKey,
                      i.grupo ?? "",
                      i.perigo_descricao ?? "",
                      i.fonte_geradora ?? "",
                      i.lesoes ?? "",
                      i.limite_tolerancia ?? "",
                      intensidade,
                      i.tipo_exposicao ?? "",
                      tecnica,
                      controles,
                      i.epi ?? "",
                      atenuacao,
                      i.probabilidade ?? "",
                      i.severidade ?? "",
                    ].join("§");
                    const prevRiskKey = prev ? [
                      prevKey,
                      prev.grupo ?? "",
                      prev.perigo_descricao ?? "",
                      prev.fonte_geradora ?? "",
                      prev.lesoes ?? "",
                      prev.limite_tolerancia ?? "",
                      prev.medicao_valor != null ? `${prev.medicao_valor}${prev.medicao_unidade ? " " + prev.medicao_unidade : ""}` : NA,
                      prev.tipo_exposicao ?? "",
                      val(prev.metodologia_avaliacao ?? prev.tecnica_utilizada ?? prev.tipo_avaliacao),
                      Array.isArray(prev.controles_existentes) && prev.controles_existentes.length > 0 ? prev.controles_existentes.join("; ") : NA,
                      prev.epi ?? "",
                      val(prev.atenuacao ?? prev.fator_protecao ?? prev.epi_fator_protecao),
                      prev.probabilidade ?? "",
                      prev.severidade ?? "",
                    ].join("§") : null;
                    const isFirstOfRisk = riskKey !== prevRiskKey;
                    let riskRowSpan = 1;
                    const groupIds: string[] = [i.id];
                    const groupSetores: string[] = [i.setor || NA];
                    if (isFirstOfRisk) {
                      for (let j = idx + 1; j < filtrados.length; j++) {
                        const n = filtrados[j];
                        const nAmb = ambienteDe(n);
                        const nGroupKey = `${n.ghe?.codigo || ""}||${nAmb}`;
                        const nIntensidade = n.medicao_valor != null ? `${n.medicao_valor}${n.medicao_unidade ? " " + n.medicao_unidade : ""}` : NA;
                        const nKey = [
                          nGroupKey,
                          n.grupo ?? "",
                          n.perigo_descricao ?? "",
                          n.fonte_geradora ?? "",
                          n.lesoes ?? "",
                          n.limite_tolerancia ?? "",
                          nIntensidade,
                          n.tipo_exposicao ?? "",
                          val(n.metodologia_avaliacao ?? n.tecnica_utilizada ?? n.tipo_avaliacao),
                          Array.isArray(n.controles_existentes) && n.controles_existentes.length > 0 ? n.controles_existentes.join("; ") : NA,
                          n.epi ?? "",
                          val(n.atenuacao ?? n.fator_protecao ?? n.epi_fator_protecao),
                          n.probabilidade ?? "",
                          n.severidade ?? "",
                        ].join("§");
                        if (nKey === riskKey) { riskRowSpan++; groupIds.push(n.id); groupSetores.push(n.setor || NA); }
                        else break;
                      }
                    }
                    return (
                      <tr key={i.id} className={`hover:bg-muted/40 align-top ${isFirstOfGroup ? "border-t-2 border-t-amber-400" : "border-t border-t-amber-100"}`}>
                        {isFirstOfGroup && (
                          <td rowSpan={rowSpan} className="p-2 border border-amber-300 align-top bg-amber-50/60 font-medium text-[11px] leading-snug">
                            {ambiente || NA}
                          </td>
                        )}
                        <td className="p-2 border align-top">{val(i.setor)}</td>
                        {isFirstOfGroup && (
                          <td rowSpan={rowSpan} className="p-2 border border-amber-300 align-middle text-center font-bold text-sm bg-amber-50/80">
                            {gesCod || NA}
                          </td>
                        )}
                        <td className="p-2 border align-top">{funcoes}</td>
                        <td className="p-2 border align-top">{val(i.processo)}</td>
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border align-top bg-amber-50/30">{GRUPO_LABEL[i.grupo] || NA}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border align-top bg-amber-50/30">{val(i.perigo_descricao)}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border align-top bg-amber-50/30">{val(i.fonte_geradora)}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border align-top bg-amber-50/30">{val(i.lesoes)}</td>}
                        {detalhes && isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border align-top bg-amber-50/30">{val(i.limite_tolerancia)}</td>}
                        {detalhes && isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border align-top bg-amber-50/30">{intensidade}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border align-top bg-amber-50/30">{val(i.tipo_exposicao)}</td>}
                        {detalhes && isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border align-top bg-amber-50/30">{tecnica}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border align-top bg-amber-50/30">{controles}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border align-top bg-amber-50/30">{val(i.epi)}</td>}
                        {detalhes && isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border align-top bg-amber-50/30">{atenuacao}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border text-center align-middle bg-amber-50/30">{i.probabilidade}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border text-center align-middle bg-amber-50/30">{i.severidade}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-2 border text-center align-middle font-semibold bg-amber-50/30">{total}</td>}
                        {isFirstOfRisk && (
                          <td rowSpan={riskRowSpan} className="p-2 border align-middle bg-amber-50/30">
                            <Badge
                              className={clsPgr ? CLASSE_TEXT[clsPgr] : "bg-slate-100 text-slate-700 border-slate-300"}
                              variant="outline"
                            >
                              {classeLabel(clsPgr)}
                            </Badge>
                          </td>
                        )}

                        {isFirstOfRisk && (
                          <td rowSpan={riskRowSpan} className="p-2 border text-right whitespace-nowrap align-middle sticky right-0 z-10 bg-white shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.25)]">
                            {editavel && (
                              <>
                                <Button size="icon" variant="ghost" title={groupIds.length > 1 ? `Editar grupo (${groupIds.length} setores)` : "Editar item"} onClick={() => { setEditId(i.id); setEditGroupIds(groupIds); setDialogOpen(true); }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" title={groupIds.length > 1 ? `Excluir grupo (${groupIds.length} setores)` : "Excluir item"} onClick={() => setDelState({ ids: groupIds, setores: groupSetores })}>
                                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                </Button>
                              </>
                            )}
                          </td>
                        )}
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

      <InventarioItemDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditGroupIds([]); }}
        pgrId={pgrId} empresaId={empresaId} itemId={editId} valoresIniciais={preencher}
        groupItemIds={editGroupIds}
        onSaved={onSaved}
      />

      <AlertDialog open={!!delState} onOpenChange={(o) => { if (!o) setDelState(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir risco do inventário?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Isso removerá o risco dos setores vinculados neste grupo, mas <b>não apagará</b> o GES, os setores ou as funções cadastradas.</p>
                {delState && (
                  <div className="border rounded p-2 bg-muted/40 text-xs">
                    <div><b>Setores afetados ({delState.ids.length}):</b></div>
                    <div className="mt-1">{delState.setores.join(", ")}</div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => delState && excluirGrupo(delState.ids)} className="bg-red-600 hover:bg-red-700">
              Excluir do inventário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

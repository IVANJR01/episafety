import { useEffect, useMemo, useRef, useState } from "react";
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
import { ExpandableText } from "@/components/ui/ExpandableText";
import { candidatosDeGes, indexarVinculos, type AlvoVinculo } from "@/lib/pgrGesVinculo";

/** Linha de pgr_levantamento_preliminar, na forma que esta tela consome. */
interface Levantado {
  id: string;
  grupo: string;
  perigo_descricao: string;
  fonte_circunstancia?: string | null;
  possiveis_lesoes?: string | null;
  trabalhadores_expostos?: string | null;
  medidas_existentes?: string | null;
  setor_id?: string | null;
  ges_id?: string | null;
  ges?: { id: string; codigo: string; nome: string } | null;
}

const NA = "N.A";
const val = (v: any) => (v === null || v === undefined || v === "" ? NA : v);

/**
 * Colunas de contexto — ambiente, setor e GES — congeladas à esquerda.
 *
 * São 17 colunas contra pouco mais de 1300px de tela: rolar de lado é
 * inevitável neste formato, que é o mesmo do documento emitido. O que dá para
 * evitar é rolar de ida **e volta** — sem o contexto preso, chegar na
 * classificação faz perder de vista de qual setor e GES é a linha, e obriga a
 * voltar para conferir.
 *
 * O fundo precisa ser opaco. Com cor translúcida (`bg-amber-50/60`) o conteúdo
 * que passa por baixo durante a rolagem aparece através da célula.
 */
const CTX_TH = "p-1.5 text-left border border-amber-400 sticky top-0 z-20 bg-amber-200";
const AMBAR_CHAPADO = "bg-[#fffbeb]";

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
   * qualitativo saem todas "N.A" — e custam 400px de rolagem horizontal numa
   * planilha que já passa de 1700px. Nada foi removido: o Excel e o PDF
   * continuam saindo com o formato completo, que é o que o documento exige.
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

  /**
   * A estrutura da empresa — é ela que diz a qual GES um item pertence.
   *
   * `ghe_id` é opcional no item do inventário, e sempre foi: linha trazida do
   * levantamento preliminar sem grupo escolhido, ou criada antes de o GES
   * existir, nasce sem vínculo e imprime "N.A" na coluna GES. Só que a
   * informação existe do outro lado — o setor e as funções da linha estão
   * cadastrados dentro de um grupo. Faltava alguém cruzar as duas pontas.
   */
  const { data: vinculos } = useQuery({
    queryKey: ["pgr-inventario-vinculos", empresaId],
    enabled: !!empresaId,
    staleTime: 30_000,
    queryFn: async () => {
      const t = (n: string, cols = "*") =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from as any)(n).select(cols).eq("empresa_id", empresaId);
      const [ges, gSet, gFun, setores, funcoes, nucleo] = await Promise.all([
        t("ghe_ges", "id, codigo, nome, status"),
        t("ghe_setores", "ghe_id, nome, setor_id, ativo"),
        t("ghe_funcoes", "ghe_id, nome_funcao, funcao_id, status"),
        t("sst_setores", "id, nome"),
        t("sst_funcoes", "id, nome"),
        t("sst_ges", "id"),
      ]);
      return {
        ges: (ges.data || []) as { id: string; codigo: string; nome: string; status?: string }[],
        gheSetores: (gSet.data || []) as { ghe_id: string; nome?: string; setor_id?: string | null; ativo?: boolean }[],
        gheFuncoes: (gFun.data || []) as { ghe_id: string; nome_funcao?: string; funcao_id?: string | null; status?: string }[],
        setores: (setores.data || []) as { id: string; nome: string }[],
        funcoes: (funcoes.data || []) as { id: string; nome: string }[],
        nucleoIds: new Set<string>(((nucleo.data || []) as { id: string }[]).map((g) => g.id)),
      };
    },
  });

  /** Índice nome→grupo, montado uma vez por carga da estrutura. */
  const indice = useMemo(() => (vinculos ? indexarVinculos(vinculos) : null), [vinculos]);

  /** Os grupos possíveis para uma linha órfã. Vazio enquanto a estrutura carrega. */
  const candidatosDe = useMemo(
    () => (alvo: AlvoVinculo) => (indice ? candidatosDeGes(indice, alvo) : []),
    [indice],
  );

  const codigoDoGes = (id: string) =>
    vinculos?.ges.find((g) => g.id === id)?.codigo || "";

  /** Itens sem GES, já com o(s) grupo(s) que a estrutura sugere. */
  const orfaos = useMemo(
    () => (itens as any[]).filter((i) => !i.ghe_id)
      .map((i) => ({
        item: i,
        cand: candidatosDe({
          setor: i.setor,
          funcoes: Array.isArray(i.funcoes_snapshot) ? i.funcoes_snapshot : [],
        }),
      })),
    [itens, candidatosDe],
  );

  /**
   * Vincula sozinho o que tem resposta única.
   *
   * Deixar a linha "N.A" esperando alguém reabrir e escolher o grupo à mão é
   * pedir para o PGR sair com buraco: o GES é quem responde pelo risco no
   * documento. Quando a estrutura aponta um único grupo possível, o vínculo é
   * gravado e a tela avisa o que fez — nada é adivinhado em silêncio.
   *
   * A trava por id evita repetir a tentativa a cada renderização quando a
   * gravação falha (PGR bloqueado, permissão, rede).
   */
  const jaTentado = useRef(new Set<string>());
  useEffect(() => {
    if (!editavel || !vinculos) return;
    const ligar = orfaos.filter((o) => o.cand.length === 1 && !jaTentado.current.has(o.item.id));
    if (!ligar.length) return;
    ligar.forEach((o) => jaTentado.current.add(o.item.id));

    void (async () => {
      const porGes = new Map<string, string[]>();
      ligar.forEach((o) => {
        const g = o.cand[0];
        porGes.set(g, [...(porGes.get(g) || []), o.item.id]);
      });
      let ligados = 0;
      const codigos: string[] = [];
      for (const [gesId, ids] of porGes) {
        // ges_id só quando o grupo existe no Núcleo Mestre: gravar um id de
        // ghe_ges que não está em sst_ges violaria a chave estrangeira.
        const payload: Record<string, string> = { ghe_id: gesId };
        if (vinculos.nucleoIds.has(gesId)) payload.ges_id = gesId;
        const { error } = await (supabase.from as any)("pgr_inventario_itens")
          .update(payload).in("id", ids);
        if (!error) { ligados += ids.length; codigos.push(codigoDoGes(gesId) || "?"); }
      }
      if (ligados > 0) {
        toast.success(
          `${ligados === 1 ? "1 item ficou" : `${ligados} itens ficaram`} sem GES e ${ligados === 1 ? "foi vinculado" : "foram vinculados"} ao ${codigos.length === 1 ? `GES ${codigos[0]}` : `GES ${[...new Set(codigos)].join(", ")}`} pela estrutura cadastrada.`,
        );
        qc.invalidateQueries({ queryKey: ["pgr-inventario", pgrId] });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orfaos, editavel, vinculos]);

  /** Os que sobraram: nenhum grupo bate, ou mais de um bate. */
  const semResposta = useMemo(() => orfaos.filter((o) => o.cand.length !== 1), [orfaos]);

  /**
   * O GES do perigo levantado, para o botão "Trazer" já abrir com ele escolhido.
   *
   * O levantamento pode ter sido feito por setor, sem apontar grupo — e era daí
   * que saíam as linhas "N.A" do inventário. Resolver aqui evita criar o
   * problema, em vez de só consertá-lo depois.
   */
  const gesSugeridoPara = (l: Levantado): string => {
    if (l.ges_id) return l.ges_id;
    const nomeSetor = vinculos?.setores.find((s) => s.id === l.setor_id)?.nome || "";
    const cand = candidatosDe({
      setor: nomeSetor,
      funcoes_snapshot: (l.trabalhadores_expostos || "").split(/\n|,|;/),
    });
    return cand.length === 1 ? cand[0] : "";
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

  /**
   * As três chaves de agrupamento visual da tabela, do mais externo ao mais
   * interno. Elas espelham a hierarquia real dos dados: ambiente e processo
   * pertencem ao Setor, o GES pertence ao Setor, e as funções pertencem ao GES.
   *
   * Antes havia só duas, e a de fora era `GES + ambiente` — com o GES dentro
   * dela, dois grupos do MESMO setor viravam blocos separados e o parágrafo do
   * ambiente saía reimpresso por inteiro em cada um.
   */
  const chaveSetor = (i: any) =>
    [i.setor || "", ambienteDe(i), i.processo || ""].join("§");
  const chaveGes = (i: any) => [chaveSetor(i), i.ghe?.codigo || ""].join("§");

  /**
   * Chave do risco. Estava escrita três vezes, com a mesma lista de 14 campos
   * copiada — mudar a composição em três cópias é erro na certa.
   */
  const chaveRisco = (i: any) => [
    chaveGes(i),
    i.grupo ?? "",
    i.perigo_descricao ?? "",
    i.fonte_geradora ?? "",
    i.lesoes ?? "",
    i.limite_tolerancia ?? "",
    i.medicao_valor != null
      ? `${i.medicao_valor}${i.medicao_unidade ? " " + i.medicao_unidade : ""}` : NA,
    i.tipo_exposicao ?? "",
    val(i.metodologia_avaliacao ?? i.tecnica_utilizada ?? i.tipo_avaliacao),
    Array.isArray(i.controles_existentes) && i.controles_existentes.length > 0
      ? i.controles_existentes.join("; ") : NA,
    i.epi ?? "",
    val(i.atenuacao ?? i.fator_protecao ?? i.epi_fator_protecao),
    i.probabilidade ?? "",
    i.severidade ?? "",
  ].join("§");

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    const base = !q ? itens : itens.filter((i: any) =>
      i.perigo_descricao?.toLowerCase().includes(q) ||
      i.fonte_geradora?.toLowerCase().includes(q) ||
      i.ghe?.codigo?.toLowerCase().includes(q) ||
      i.ghe?.nome?.toLowerCase().includes(q));
    // Setor → ambiente → GES → perigo: a ordem espelha o aninhamento das
    // células mescladas, e mesclar só funciona em linhas vizinhas. Antes
    // ordenava por GES primeiro, o que espalhava os grupos de um mesmo setor
    // assim que existisse mais de um setor.
    return [...base].sort((a: any, b: any) => {
      const sa = a.setor || ""; const sb = b.setor || "";
      if (sa !== sb) return sa.localeCompare(sb);
      const aa = ambienteDe(a); const ab = ambienteDe(b);
      if (aa !== ab) return aa.localeCompare(ab);
      const ga = a.ghe?.codigo || ""; const gb = b.ghe?.codigo || "";
      if (ga !== gb) return ga.localeCompare(gb);
      return (a.perigo_descricao || "").localeCompare(b.perigo_descricao || "");
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
              /* "Importar GES" saiu: criava linhas a partir dos setores com
                 ambiente, processo e funções preenchidos — exatamente o que
                 "Novo item" passou a fazer sozinho ao escolher o GES. Eram
                 dois caminhos para a mesma linha, e o de importação ainda
                 pedia para escolher o grupo de novo, no fim. */
              <Button size="sm" onClick={() => { setEditId(null); setPreencher(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Novo item
              </Button>
            )}
            {/* Ver as colunas de medição não é editar — quem só consulta o PGR
                também precisa delas. */}
            <Button variant="ghost" size="sm" onClick={() => setDetalhes((v) => !v)}
              title="Limite de exposição, intensidade/concentração, técnica utilizada e atenuação">
              {detalhes ? <><EyeOff className="h-4 w-4 mr-1" /> Menos colunas</> : <><Eye className="h-4 w-4 mr-1" /> Colunas de medição</>}
            </Button>
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
                        ghe_id: gesSugeridoPara(l),
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

      {/* O que o vínculo automático não conseguiu resolver sozinho. Não dá para
          escolher no lugar de quem responde tecnicamente pelo documento: ou
          nenhum grupo bate com o setor/função da linha, ou mais de um bate. */}
      {editavel && semResposta.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/70">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-700" />
              <p className="text-sm text-amber-900">
                <b>{semResposta.length}</b> {semResposta.length === 1 ? "item está sem GES" : "itens estão sem GES"}.
                O GES é quem responde pelo risco no documento — sem ele a linha sai <b>N.A</b> no PGR.
              </p>
            </div>
            <ul className="space-y-1">
              {semResposta.map(({ item, cand }) => (
                <li key={item.id} className="flex items-center gap-2 rounded border bg-background px-2 py-1.5">
                  <span className="text-sm min-w-0 flex-1 truncate" title={item.perigo_descricao}>
                    {clean(item.setor) && <b className="mr-1">{item.setor} ·</b>}
                    {item.perigo_descricao}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {cand.length === 0
                      ? "nenhum grupo bate com o setor/função"
                      : `${cand.length} grupos possíveis: ${cand.map(codigoDoGes).filter(Boolean).join(", ")}`}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                    onClick={() => { setEditId(item.id); setEditGroupIds([item.id]); setDialogOpen(true); }}>
                    Escolher GES
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
              <table className={`w-full text-[11px] border-collapse ${detalhes ? "min-w-[2120px]" : "min-w-[1720px]"}`}>
                <thead className="bg-amber-200 sticky top-0 z-10">
                  <tr className="text-amber-950">
                    {/* As três primeiras ficam congeladas à esquerda: são o
                        contexto da linha, e sem elas rolar até a classificação
                        obrigava a voltar para saber de qual setor/GES era. As
                        larguras aqui são fixas porque o `left` das seguintes é
                        a soma delas. */}
                    <th className={`${CTX_TH} w-[200px] min-w-[200px] max-w-[200px] left-0`}>Descrição do ambiente</th>
                    <th className={`${CTX_TH} w-[136px] min-w-[136px] max-w-[136px] left-[200px] shadow-[6px_0_6px_-6px_rgba(0,0,0,0.25)]`}>Setor / GES</th>
                    <th className="p-1.5 text-left border border-amber-400 min-w-[140px]">Função</th>
                    <th className="p-1.5 text-left border border-amber-400 min-w-[150px]">Processo</th>
                    {/* Estes dois rótulos estavam trocados entre si: a coluna
                        "Agente" imprimia o grupo ("Ergonômico") e a "Tipo de
                        Agente" imprimia o perigo ("Pressão por metas"). */}
                    <th className="p-1.5 text-left border border-amber-400 min-w-[84px]">Tipo de<br/>agente</th>
                    <th className="p-1.5 text-left border border-amber-400 min-w-[130px]">Agente / perigo</th>
                    <th className="p-1.5 text-left border border-amber-400 min-w-[130px]">Fonte de<br/>exposição</th>
                    <th className="p-1.5 text-left border border-amber-400 min-w-[130px]">Possíveis lesões ou<br/>agravos à saúde</th>
                    {detalhes && <th className="p-1.5 text-left border border-amber-400 min-w-[96px]">Limite de<br/>exposição</th>}
                    {detalhes && <th className="p-1.5 text-left border border-amber-400 min-w-[104px]">Intensidade /<br/>concentração</th>}
                    <th className="p-1.5 text-left border border-amber-400 min-w-[88px]">Tipo / tempo<br/>de exposição</th>
                    {detalhes && <th className="p-1.5 text-left border border-amber-400 min-w-[104px]">Técnica<br/>utilizada</th>}
                    <th className="p-1.5 text-left border border-amber-400 min-w-[150px]">Proc. administrativo / EPC /<br/>organização do trabalho</th>
                    <th className="p-1.5 text-left border border-amber-400 min-w-[90px]">EPI</th>
                    {detalhes && <th className="p-1.5 text-left border border-amber-400 min-w-[96px]">Atenuação /<br/>fator de proteção</th>}
                    <th className="p-1.5 text-center border border-amber-400 w-[44px]">Prob.</th>
                    <th className="p-1.5 text-center border border-amber-400 w-[44px]">Sev.</th>
                    <th className="p-1.5 text-center border border-amber-400 w-[44px]">Total</th>
                    <th className="p-1.5 text-left border border-amber-400 min-w-[104px]">Classificação<br/>do risco</th>
                    <th className="p-1.5 border border-amber-400 w-[68px] sticky right-0 z-20 bg-amber-200 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.25)]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((i: any, idx: number) => {
                    const ambiente = ambienteDe(i);
                    const gesCod = i.ghe?.codigo || "";
                    const prev = idx > 0 ? filtrados[idx - 1] : null;

                    /** Quantas linhas seguidas, a partir daqui, compartilham a chave. */
                    const alcance = (chaveDe: (x: any) => string) => {
                      let n = 1;
                      for (let j = idx + 1; j < filtrados.length; j++) {
                        if (chaveDe(filtrados[j]) !== chaveDe(i)) break;
                        n++;
                      }
                      return n;
                    };
                    const primeiroDe = (chaveDe: (x: any) => string) =>
                      !prev || chaveDe(prev) !== chaveDe(i);

                    // Ambiente, Setor e Processo saem uma vez por SETOR; GES e
                    // Função, uma vez por GES; o resto, uma vez por risco.
                    const abreSetor = primeiroDe(chaveSetor);
                    const linhasDoSetor = abreSetor ? alcance(chaveSetor) : 1;
                    const abreGes = primeiroDe(chaveGes);
                    const linhasDoGes = abreGes ? alcance(chaveGes) : 1;
                    const isFirstOfRisk = primeiroDe(chaveRisco);
                    const riskRowSpan = isFirstOfRisk ? alcance(chaveRisco) : 1;

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

                    // Os itens cobertos por esta linha de risco — é o que os
                    // botões de editar/excluir em grupo operam.
                    const cobertos = filtrados.slice(idx, idx + riskRowSpan);
                    const groupIds: string[] = cobertos.map((x: any) => x.id);
                    const groupSetores: string[] = cobertos.map((x: any) => x.setor || NA);

                    return (
                      <tr key={i.id} className={`hover:bg-muted/40 align-top ${abreSetor ? "border-t-2 border-t-amber-400" : "border-t border-t-amber-100"}`}>
                        {/* Ambiente, Setor e Processo pertencem ao setor: saem uma
                            vez por setor, por mais GES que ele tenha. Antes o GES
                            entrava na chave e o parágrafo do ambiente era
                            reimpresso inteiro em cada grupo. */}
                        {abreSetor && (
                          <td rowSpan={linhasDoSetor} className={`p-1.5 pt-2 border border-amber-300 align-top font-medium leading-snug sticky left-0 z-10 w-[200px] min-w-[200px] max-w-[200px] break-words ${AMBAR_CHAPADO}`}>
                            <ExpandableText text={ambiente || NA} />
                          </td>
                        )}
                        {abreGes && (
                          <td rowSpan={linhasDoGes} className={`p-1.5 pt-2 border border-amber-300 align-top sticky left-[200px] z-10 shadow-[6px_0_6px_-6px_rgba(0,0,0,0.25)] w-[136px] min-w-[136px] max-w-[136px] break-words ${AMBAR_CHAPADO}`}>
                            <span className="font-medium">{val(i.setor)}</span>
                            {gesCod && gesCod !== NA && gesCod !== val(i.setor) ? (
                              <span className="text-[11px] font-bold text-muted-foreground ml-1">(GES: {gesCod})</span>
                            ) : !gesCod ? (
                              /* Sem grupo a linha sai N.A no PGR emitido. Marcar
                                 aqui é o que faz a falha aparecer antes da
                                 emissão, e não depois. */
                              <span className="text-[11px] font-semibold text-amber-700 ml-1">(sem GES)</span>
                            ) : null}
                          </td>
                        )}
                        {/* As funções vêm do GES — uma vez por grupo. */}
                        {abreGes && (
                          <td rowSpan={linhasDoGes} className="p-1.5 pt-2 border align-top max-w-[200px]">
                            <ExpandableText text={funcoes} />
                          </td>
                        )}
                        {abreSetor && (
                          <td rowSpan={linhasDoSetor} className="p-1.5 pt-2 border align-top max-w-[200px]">
                            <ExpandableText text={val(i.processo)} />
                          </td>
                        )}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border align-top bg-amber-50/30">{GRUPO_LABEL[i.grupo] || NA}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border align-top max-w-[200px] bg-amber-50/30">
                          <ExpandableText text={val(i.perigo_descricao)} />
                        </td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border align-top max-w-[200px] bg-amber-50/30">
                          <ExpandableText text={val(i.fonte_geradora)} />
                        </td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border align-top max-w-[200px] bg-amber-50/30">
                          <ExpandableText text={val(i.lesoes)} />
                        </td>}
                        {detalhes && isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border align-top bg-amber-50/30">{val(i.limite_tolerancia)}</td>}
                        {detalhes && isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border align-top bg-amber-50/30">{intensidade}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border align-top bg-amber-50/30">{val(i.tipo_exposicao)}</td>}
                        {detalhes && isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border align-top bg-amber-50/30">{tecnica}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border align-top max-w-[200px] bg-amber-50/30">
                          <ExpandableText text={controles} />
                        </td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border align-top bg-amber-50/30">{val(i.epi)}</td>}
                        {detalhes && isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border align-top bg-amber-50/30">{atenuacao}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border text-center align-top bg-amber-50/30">{i.probabilidade}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border text-center align-top bg-amber-50/30">{i.severidade}</td>}
                        {isFirstOfRisk && <td rowSpan={riskRowSpan} className="p-1.5 pt-2 border text-center align-top font-semibold bg-amber-50/30">{total}</td>}
                        {isFirstOfRisk && (
                          <td rowSpan={riskRowSpan} className="p-1.5 border align-middle bg-amber-50/30">
                            <Badge
                              className={clsPgr ? CLASSE_TEXT[clsPgr] : "bg-slate-100 text-slate-700 border-slate-300"}
                              variant="outline"
                            >
                              {classeLabel(clsPgr)}
                            </Badge>
                          </td>
                        )}

                        {isFirstOfRisk && (
                          <td rowSpan={riskRowSpan} className="p-1.5 border text-right whitespace-nowrap align-middle sticky right-0 z-10 bg-white shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.25)]">
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
                Campos sem dado exibem <b>N.A</b>. O documento emitido (PDF/Excel) continua saindo com todas as colunas.
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

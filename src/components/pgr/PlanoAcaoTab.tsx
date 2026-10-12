import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wand2, RefreshCw, AlertTriangle, ClipboardList, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import PgrAcaoDialog from "./PgrAcaoDialog";
import {
  ACAO_STATUS_LABEL, ACAO_STATUS_COLOR, PgrAcaoStatus, isAtrasada,
  prazoSugerido, prioridadeSugerida, ACAO_KANBAN_COLS,
} from "@/lib/pgrAcoes";
import { classificarRisco, necessitaAcao, PgrClasse } from "@/lib/pgrMatriz";
import { isEditavel, PgrStatus } from "@/lib/pgrTypes";

interface Props {
  pgrId: string;
  empresaId: string;
  pgrVersao: number;
  status: PgrStatus;
  canEdit: boolean;
  pgr: any;
}

const STATUS_COLS: PgrAcaoStatus[] = ACAO_KANBAN_COLS;

const MESES_CRONOGRAMA = [
  { rotulo: "J", nome: "Janeiro", num: 1 },
  { rotulo: "F", nome: "Fevereiro", num: 2 },
  { rotulo: "M", nome: "Março", num: 3 },
  { rotulo: "A", nome: "Abril", num: 4 },
  { rotulo: "M", nome: "Maio", num: 5 },
  { rotulo: "J", nome: "Junho", num: 6 },
  { rotulo: "J", nome: "Julho", num: 7 },
  { rotulo: "A", nome: "Agosto", num: 8 },
  { rotulo: "S", nome: "Setembro", num: 9 },
  { rotulo: "O", nome: "Outubro", num: 10 },
  { rotulo: "N", nome: "Novembro", num: 11 },
  { rotulo: "D", nome: "Dezembro", num: 12 },
];

function prioridadeRotulo(p: number | string | null | undefined): string {
  const n = Number(p);
  if (!n) return "MÉDIA";
  if (n >= 4) return "ALTA";
  if (n === 3) return "MÉDIA";
  return "BAIXA";
}

export default function PlanoAcaoTab({ pgrId, empresaId, pgrVersao, status, canEdit, pgr }: Props) {
  const qc = useQueryClient();
  const editavel = isEditavel(status) && canEdit;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<any>(null);

  // Filtros
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fResp, setFResp] = useState("");
  const [fPrio, setFPrio] = useState<string>("todas");
  const [soAtrasadas, setSoAtrasadas] = useState(false);

  const { data: acoes = [] } = useQuery({
    queryKey: ["pgr-acoes", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_acoes")
        .select("*")
        .eq("pgr_id", pgrId)
        .order("prazo", { ascending: true });
      return data || [];
    },
  });

  // Itens do inventário para correlação de Setor e GES
  const { data: inventario = [] } = useQuery({
    queryKey: ["pgr-inventario", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_inventario_itens")
        .select("*, ges:ghe_id(codigo, nome)")
        .eq("pgr_id", pgrId);
      return data || [];
    },
  });

  const { data: setores = [] } = useQuery({
    queryKey: ["sst-setores", empresaId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("sst_setores")
        .select("id, nome")
        .eq("empresa_id", empresaId);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const mapaSetores = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of setores) map.set(s.id, s.nome);
    return map;
  }, [setores]);

  const mapaInventario = useMemo(() => {
    const map = new Map<string, any>();
    for (const i of inventario) map.set(i.id, i);
    return map;
  }, [inventario]);

  const obterSetorDaAcao = (a: any) => {
    if (a.setor) return a.setor;
    if (a.inventario_item_id && mapaInventario.has(a.inventario_item_id)) {
      const item = mapaInventario.get(a.inventario_item_id);
      return item.setor || (item.setor_id ? mapaSetores.get(item.setor_id) : "") || item.descricao_ambiente || "";
    }
    return a.where_local || a.responsavel_setor || "—";
  };

  const obterGesDaAcao = (a: any) => {
    if (a.ges) return a.ges;
    if (a.inventario_item_id && mapaInventario.has(a.inventario_item_id)) {
      const item = mapaInventario.get(a.inventario_item_id);
      return item.ges?.codigo || item.ges?.nome || item.ges_codigo || "";
    }
    return a.responsavel_setor || "—";
  };

  const obterMesesDaAcao = (a: any): number[] => {
    if (Array.isArray(a.meses_execucao) && a.meses_execucao.length > 0) {
      return a.meses_execucao;
    }
    if (a.prazo) {
      const mes = parseInt(a.prazo.slice(5, 7), 10);
      if (!isNaN(mes) && mes >= 1 && mes <= 12) {
        return [mes];
      }
    }
    return [];
  };

  const formatarQuanto = (a: any) => {
    if (a.how_much != null && a.how_much !== "") {
      const num = Number(a.how_much);
      if (!isNaN(num) && num > 0) {
        return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    }
    if (a.custo_estimado != null && a.custo_estimado !== "") {
      const num = Number(a.custo_estimado);
      if (!isNaN(num) && num > 0) {
        return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    }
    return a.quanto_texto || "—";
  };

  const sugestoes = useMemo(() => {
    const idsComAcao = new Set(
      acoes.filter((a: any) => a.status !== "cancelada").map((a: any) => a.inventario_item_id).filter(Boolean)
    );
    return inventario
      .filter((i: any) => {
        const cls = (i.classificacao as PgrClasse | null)
          ?? classificarRisco(i.severidade, i.probabilidade);
        return (i.necessita_acao === true || necessitaAcao(cls)) && !idsComAcao.has(i.id);
      })
      .map((i: any) => ({
        ...i,
        classe: (i.classificacao as PgrClasse | null)
          ?? classificarRisco(i.severidade, i.probabilidade),
      }));
  }, [inventario, acoes]);

  const filtradas = useMemo(() => {
    return acoes.filter((a: any) => {
      if (fStatus === "todos") {
        if (a.status === "cancelada") return false;
      } else if (a.status !== fStatus) {
        return false;
      }
      if (fResp && !(a.who || a.responsavel_nome || "").toLowerCase().includes(fResp.toLowerCase())) return false;
      if (fPrio !== "todas") {
        const rot = prioridadeRotulo(a.prioridade);
        if (String(a.prioridade) !== fPrio && rot !== fPrio.toUpperCase()) return false;
      }
      if (soAtrasadas && !isAtrasada(a)) return false;
      if (busca.trim()) {
        const termo = busca.trim().toLowerCase();
        const texto = [
          a.what, a.descricao, a.why, a.how, a.where_local,
          a.who, a.responsavel_nome, obterSetorDaAcao(a), obterGesDaAcao(a),
          a.forma_acompanhamento, a.indicador
        ].filter(Boolean).join(" ").toLowerCase();
        if (!texto.includes(termo)) return false;
      }
      return true;
    });
  }, [acoes, fStatus, fResp, fPrio, soAtrasadas, busca, mapaInventario, mapaSetores]);

  const stats = useMemo(() => {
    const ativas = acoes.filter((a: any) => a.status !== "cancelada");
    const s: any = { total: ativas.length, atrasadas: 0 };
    STATUS_COLS.forEach((c) => (s[c] = 0));
    acoes.forEach((a: any) => {
      s[a.status] = (s[a.status] || 0) + 1;
      if (isAtrasada(a)) s.atrasadas++;
    });
    return s;
  }, [acoes]);

  const onSaved = () => qc.invalidateQueries({ queryKey: ["pgr-acoes", pgrId] });

  const novaManual = () => {
    setEditId(null);
    setDefaults({
      responsavel_nome: pgr?.resp_tec_nome || "",
      responsavel_id: pgr?.responsavel_tecnico_id || null,
    });
    setDialogOpen(true);
  };

  const aceitarSugestao = (item: any) => {
    const prazo = prazoSugerido(item.classe);
    setEditId(null);
    setDefaults({
      inventario_item_id: item.id,
      descricao: `Controle para: ${item.perigo_descricao}`,
      tipo: "engenharia",
      prioridade: prioridadeSugerida(item.classe, item.trabalhadores_expostos),
      prazo: prazo || "",
      responsavel_nome: pgr?.resp_tec_nome || "",
      responsavel_id: pgr?.responsavel_tecnico_id || null,
      what: `Implantar controle do risco "${item.perigo_descricao}"`,
      why: `Risco classificado como ${String(item.classe || "").toUpperCase()} no inventário.`,
      where_local: item.ges?.nome || item.ges?.codigo || item.descricao_ambiente || "Geral",
      responsavel_setor: item.ges?.codigo || item.ges?.nome || "",
    });
    setDialogOpen(true);
  };

  const marcarAtrasadas = async () => {
    try {
      const { data, error } = await (supabase as any).rpc("pgr_marcar_atrasadas", { _pgr_id: pgrId });
      if (error) throw error;
      toast.success(`${data ?? 0} ação(ões) marcada(s) como atrasada(s)`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const excluirAcao = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editavel) return;
    if (!window.confirm("Deseja realmente excluir esta ação do plano de ação?")) return;
    try {
      const { error } = await (supabase.from as any)("pgr_acoes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Ação excluída com sucesso");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Falha ao excluir ação");
    }
  };

  return (
    <div className="space-y-3">
      {!editavel && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              PGR <b>{status}</b> não permite edição direta do Plano de Ação. Abra uma revisão para alterar.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Barra de Ações Globais e Estatísticas */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline">Total: {stats.total}</Badge>
            {STATUS_COLS.filter((s) => stats[s] > 0).map((s) => (
              <Badge key={s} className={ACAO_STATUS_COLOR[s]} variant="outline">
                {ACAO_STATUS_LABEL[s]}: {stats[s]}
              </Badge>
            ))}
            {stats.atrasadas > 0 && (
              <Badge className="bg-red-600 text-white">Atrasadas: {stats.atrasadas}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={marcarAtrasadas} disabled={!editavel}>
              <RefreshCw className="h-4 w-4 mr-1" /> Recalcular atrasadas
            </Button>
            {editavel && (
              <Button size="sm" onClick={novaManual}>
                <Plus className="h-4 w-4 mr-1" /> Nova ação
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sugestões Automáticas do Inventário */}
      {editavel && sugestoes.length > 0 && (
        <Card className="border-orange-300">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="h-4 w-4 text-orange-700" />
              <div className="font-semibold text-sm">
                Sugestões automáticas — riscos que exigem ação, ainda sem ação ({sugestoes.length})
              </div>
            </div>
            <ul className="divide-y">
              {sugestoes.slice(0, 8).map((it: any) => (
                <li key={it.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium flex flex-wrap items-center gap-2">
                      <span className="truncate max-w-[400px] sm:max-w-none">{it.perigo_descricao}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 font-normal whitespace-nowrap bg-slate-100 text-slate-600">
                        {it.ges?.codigo || it.ges?.nome || it.descricao_ambiente || "Geral"}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Classe <b className="uppercase">{it.classe}</b>
                      {prazoSugerido(it.classe) ? ` · SLA sugerido até ${new Date(prazoSugerido(it.classe)! + "T00:00:00").toLocaleDateString("pt-BR")}` : " · sem SLA automático"} · prioridade {prioridadeSugerida(it.classe, it.trabalhadores_expostos)}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => aceitarSugestao(it)}>Criar ação</Button>
                </li>
              ))}
            </ul>
            {sugestoes.length > 8 && (
              <div className="text-[11px] text-muted-foreground mt-1">
                + {sugestoes.length - 8} sugestões — abra o inventário para ver todas.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Se não houver ações cadastradas */}
      {acoes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <p className="font-semibold">Nenhuma ação no plano ainda</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {sugestoes.length > 0
                  ? `O inventário tem ${sugestoes.length} risco(s) que exigem ação. Comece por eles — o quadro acima cria cada ação já ligada ao risco, com prazo e prioridade sugeridos.`
                  : inventario.length === 0
                    ? "O inventário de riscos ainda está vazio. Preencha a etapa de Inventário e as ações necessárias passam a ser sugeridas aqui automaticamente."
                    : "Nenhum risco do inventário está classificado num nível que exija ação. Se precisar registrar uma ação mesmo assim, use o botão abaixo."}
              </p>
            </div>
            {editavel && (
              <Button onClick={novaManual}>
                <Plus className="h-4 w-4 mr-1" /> Nova ação
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Tabela Mestre Oficial 5W2H com Cronograma */
        <Card className="overflow-hidden shadow-sm border">
          <CardContent className="p-3 space-y-3">
            {/* Barra de Filtros da Tabela 5W2H */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar ação, setor, medida…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-8 text-xs"
                />
              </div>

              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  {STATUS_COLS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ACAO_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Filtrar por responsável"
                value={fResp}
                onChange={(e) => setFResp(e.target.value)}
                className="text-xs"
              />

              <Select value={fPrio} onValueChange={setFPrio}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas prioridades</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="MÉDIA">Média</SelectItem>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  id="chk-atrasadas"
                  checked={soAtrasadas}
                  onChange={(e) => setSoAtrasadas(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="chk-atrasadas" className="text-xs font-medium cursor-pointer select-none">
                  Só atrasadas
                </label>
              </div>
            </div>

            {/* Tabela Oficial 5W2H */}
            <div className="overflow-x-auto border rounded-md shadow-inner bg-background">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-[#0f2a44] text-white text-xs font-semibold select-none sticky top-0 z-20">
                  <tr className="border-b border-slate-700">
                    <th className="p-2.5 text-left min-w-[120px] border-r border-slate-700/60 font-semibold tracking-wide">
                      SETOR
                    </th>
                    <th className="p-2.5 text-center min-w-[60px] border-r border-slate-700/60 font-semibold tracking-wide">
                      GES
                    </th>
                    <th className="p-2.5 text-left min-w-[220px] border-r border-slate-700/60 font-semibold tracking-wide">
                      O QUÊ? (MEDIDA)
                    </th>
                    <th className="p-2.5 text-left min-w-[180px] border-r border-slate-700/60 font-semibold tracking-wide">
                      POR QUÊ?
                    </th>
                    <th className="p-2.5 text-left min-w-[180px] border-r border-slate-700/60 font-semibold tracking-wide">
                      COMO?
                    </th>
                    <th className="p-2.5 text-left min-w-[120px] border-r border-slate-700/60 font-semibold tracking-wide">
                      ONDE?
                    </th>
                    <th className="p-2.5 text-left min-w-[100px] border-r border-slate-700/60 font-semibold tracking-wide">
                      QUANTO?
                    </th>
                    <th className="p-2.5 text-center min-w-[80px] border-r border-slate-700/60 font-semibold tracking-wide">
                      PRIOR.
                    </th>

                    {/* Cronograma anual de 12 meses */}
                    {MESES_CRONOGRAMA.map((m, idx) => (
                      <th
                        key={m.num}
                        className={`p-1 text-center w-7 min-w-[28px] max-w-[28px] text-[11px] font-bold ${
                          idx === 0 ? "border-l border-slate-700/60" : ""
                        } border-r border-slate-700/60`}
                        title={m.nome}
                      >
                        {m.rotulo}
                      </th>
                    ))}

                    <th className="p-2.5 text-left min-w-[140px] border-r border-slate-700/60 font-semibold tracking-wide">
                      RESPONSÁVEL
                    </th>
                    <th className="p-2.5 text-center min-w-[110px] border-r border-slate-700/60 font-semibold tracking-wide">
                      STATUS
                    </th>
                    <th className="p-2.5 text-left min-w-[180px] border-r border-slate-700/60 font-semibold tracking-wide">
                      ACOMPANHAMENTO E AFERIÇÃO
                    </th>
                    {editavel && (
                      <th className="p-2.5 text-center min-w-[70px] font-semibold tracking-wide">
                        AÇÕES
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((a: any) => {
                    const meses = obterMesesDaAcao(a);
                    const atras = isAtrasada(a);
                    const prioridade = prioridadeRotulo(a.prioridade);
                    const statusLabel = ACAO_STATUS_LABEL[a.status as PgrAcaoStatus] || a.status;

                    return (
                      <tr
                        key={a.id}
                        className="border-b hover:bg-slate-50/80 dark:hover:bg-slate-900/50 cursor-pointer transition-colors text-xs align-middle"
                        onClick={() => {
                          setEditId(a.id);
                          setDefaults(null);
                          setDialogOpen(true);
                        }}
                      >
                        <td className="p-2.5 font-medium border-r text-slate-800 dark:text-slate-200">
                          {obterSetorDaAcao(a)}
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-700 dark:text-slate-300 border-r">
                          {obterGesDaAcao(a)}
                        </td>
                        <td className="p-2.5 border-r font-medium text-slate-900 dark:text-slate-100 max-w-[260px]">
                          <div className="line-clamp-2" title={a.what || a.descricao}>
                            {a.what || a.descricao || "—"}
                          </div>
                        </td>
                        <td className="p-2.5 border-r text-slate-600 dark:text-slate-400 max-w-[200px]">
                          <div className="line-clamp-2" title={a.why}>
                            {a.why || "—"}
                          </div>
                        </td>
                        <td className="p-2.5 border-r text-slate-600 dark:text-slate-400 max-w-[200px]">
                          <div className="line-clamp-2" title={a.how}>
                            {a.how || "—"}
                          </div>
                        </td>
                        <td className="p-2.5 border-r text-slate-600 dark:text-slate-400">
                          {a.where_local || "—"}
                        </td>
                        <td className="p-2.5 border-r text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatarQuanto(a)}
                        </td>
                        <td className="p-2.5 border-r text-center">
                          <Badge
                            variant="outline"
                            className={
                              prioridade === "ALTA"
                                ? "bg-rose-100 text-rose-800 border-rose-300 font-bold"
                                : prioridade === "MÉDIA"
                                ? "bg-amber-100 text-amber-800 border-amber-300 font-semibold"
                                : "bg-slate-100 text-slate-700 border-slate-300 font-normal"
                            }
                          >
                            {prioridade}
                          </Badge>
                        </td>

                        {/* 12 Meses do cronograma */}
                        {MESES_CRONOGRAMA.map((m) => {
                          const marcado = meses.includes(m.num);
                          return (
                            <td
                              key={m.num}
                              className={`p-1 text-center w-7 min-w-[28px] max-w-[28px] border-r ${
                                marcado ? "bg-[#0f2a44]/5" : ""
                              }`}
                            >
                              {marcado ? (
                                <div className="w-5 h-5 mx-auto bg-[#0f2a44] text-white rounded text-[11px] font-bold flex items-center justify-center shadow-xs">
                                  X
                                </div>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-700 text-[10px]">·</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="p-2.5 border-r text-slate-700 dark:text-slate-300">
                          {a.who || a.responsavel_nome || "—"}
                        </td>

                        <td className="p-2.5 border-r text-center whitespace-nowrap">
                          <Badge
                            className={ACAO_STATUS_COLOR[a.status as PgrAcaoStatus] || "bg-slate-100 text-slate-700"}
                            variant="outline"
                          >
                            {statusLabel}
                          </Badge>
                          {atras && a.status !== "atrasada" && (
                            <Badge className="ml-1 bg-red-100 text-red-800 border-red-300" variant="outline">
                              vencida
                            </Badge>
                          )}
                        </td>

                        <td className="p-2.5 border-r text-slate-600 dark:text-slate-400">
                          {[a.forma_acompanhamento, a.indicador].filter(Boolean).join("; ") || "—"}
                        </td>

                        {editavel && (
                          <td
                            className="p-2.5 text-center whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-slate-600 hover:text-slate-900"
                                title="Editar ação"
                                onClick={() => {
                                  setEditId(a.id);
                                  setDefaults(null);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                title="Excluir ação"
                                onClick={(e) => excluirAcao(a.id, e)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {filtradas.length === 0 && (
                    <tr>
                      <td
                        colSpan={editavel ? 21 : 20}
                        className="p-8 text-center text-muted-foreground"
                      >
                        Nenhuma ação encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé e Legenda Oficial do Cronograma */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border rounded-md flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-[#0f2a44] text-white rounded text-[10px] font-bold flex items-center justify-center">
                  X
                </div>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Mês marcado = prazo previsto para a ação.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  Exibindo <b>{filtradas.length}</b> de <b>{acoes.length}</b> ação(ões) no plano
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diálogo de Criação e Edição da Ação */}
      <PgrAcaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pgrId={pgrId}
        empresaId={empresaId}
        pgrVersao={pgrVersao}
        acaoId={editId}
        defaults={defaults}
        canEdit={canEdit}
        pgrEditavel={editavel}
        onSaved={onSaved}
      />
    </div>
  );
}

import { criterioDoGrupo } from "@/lib/sstEstrutura";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, ArrowRight, BarChart3, Briefcase, Building2, ChevronDown, ChevronRight,
  ClipboardList, Clock, Eye, FileText, Home, Info, LayoutGrid, ListChecks, Loader2,
  MoreHorizontal, Plus, Search, ShieldCheck, TriangleAlert, Users, Workflow,
} from "lucide-react";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import { GRUPO_LABEL, classificarRisco, CLASSE_LABEL, CLASSE_TEXT } from "@/lib/pgrMatriz";
import { PGR_STATUS_LABEL, PgrStatus } from "@/lib/pgrTypes";

type NoTipo = "empresa" | "unidade" | "ambiente" | "processo" | "setor" | "ges" | "funcao" | "atividade";
type AbaDetalhe = "caracterizacao" | "funcoes" | "perigos" | "avaliacoes" | "controles";

const ICONE: Record<NoTipo, any> = {
  empresa: Building2, unidade: Building2, ambiente: Home, processo: Workflow,
  setor: LayoutGrid, ges: ShieldCheck, funcao: Briefcase, atividade: ClipboardList,
};

const ROTULO: Record<NoTipo, string> = {
  empresa: "Empresa", unidade: "Unidade / Obra", ambiente: "Ambiente", processo: "Processo",
  setor: "Setor", ges: "GES", funcao: "Função", atividade: "Atividade",
};

interface NoSel { tipo: NoTipo; id: string | null; nome: string }

/**
 * Modo 2 — Estrutura técnica.
 *
 * Árvore à esquerda, dados do nó ao centro, resumo à direita. A árvore organiza
 * a leitura, mas NÃO define os vínculos: um GES aparece sob o setor em que tem
 * vínculo e continua acessível de qualquer outro ponto. Colapsar a hierarquia
 * em uma árvore rígida obrigaria cada GES a ter exatamente um setor, que é o
 * erro conceitual que a NR-01 justamente evita.
 */
export default function PgrEstruturaTecnica() {
  const { id: pgrId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    ambientes, processos, setores, funcoes, atividades, gesList, gheSetores, gheFuncoes, isLoading,
  } = useNucleoMestreSst();

  // Guarda o que está FECHADO, não o que está aberto: a árvore nasce expandida,
  // senão o usuário abre a tela e vê só "Empresa", sem ideia do que existe abaixo.
  const [fechado, setFechado] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<NoSel>({ tipo: "empresa", id: null, nome: "Empresa" });
  const [aba, setAba] = useState<AbaDetalhe>("perigos");
  const [busca, setBusca] = useState("");

  const { data: pgr } = useQuery({
    queryKey: ["pgr-detalhe", pgrId],
    enabled: !!pgrId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_documentos")
        .select("*").eq("id", pgrId).maybeSingle();
      return data;
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ["estrutura-empresa", pgr?.empresa_id, pgr?.unidade_id],
    enabled: !!pgr,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id,nome,nome_fantasia")
        .in("id", [pgr.empresa_id, pgr.unidade_id || pgr.empresa_id]);
      return (data || []) as any[];
    },
  });

  const { data: inventario = [] } = useQuery({
    queryKey: ["pgr-estrutura-inventario", pgrId],
    enabled: !!pgrId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_inventario_itens")
        .select("*").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: perigos = [] } = useQuery({
    queryKey: ["pgr-estrutura-perigos", pgrId],
    enabled: !!pgrId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_levantamento_preliminar")
        .select("*").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const alterna = (c: string) => setFechado((f) => ({ ...f, [c]: !f[c] }));
  const casa = (nome: string) =>
    !busca.trim() || nome.toLowerCase().includes(busca.trim().toLowerCase());

  const funcoesDoGes = (gesId: string) => {
    const ids = new Set(
      (gheFuncoes as any[]).filter((v) => v.ghe_id === gesId && v.funcao_id).map((v) => v.funcao_id));
    return funcoes.filter((f: any) => ids.has(f.id));
  };
  const gesDoSetor = (setorId: string) => {
    const ids = new Set(
      (gheSetores as any[]).filter((v) => v.setor_id === setorId).map((v) => v.ghe_id));
    return gesList.filter((g: any) => ids.has(g.id));
  };

  /** Itens ancorados no nó selecionado, em qualquer nível da hierarquia. */
  const dados = useMemo(() => {
    const campo: Partial<Record<NoTipo, string>> = {
      ambiente: "ambiente_id", processo: "processo_id", setor: "setor_id",
      ges: "ges_id", funcao: "funcao_id", atividade: "atividade_id",
    };
    const chave = campo[sel.tipo];
    const filtra = (l: any[]) => (!chave || !sel.id ? l : l.filter((i) => i[chave] === sel.id));
    const inv = filtra(inventario);
    const lev = filtra(perigos);
    return {
      inv, lev,
      pendencias: lev.filter((l: any) => !l.inventario_item_id).length
        + inv.filter((i: any) => i.necessita_acao).length,
    };
  }, [sel, inventario, perigos]);

  /** Funções e trabalhadores do nó — usados no cabeçalho e no resumo. */
  const meta = useMemo(() => {
    if (sel.tipo === "ges" && sel.id) {
      const g: any = gesList.find((x: any) => x.id === sel.id);
      const fns = funcoesDoGes(sel.id);
      const setorNome = setores.find((s: any) =>
        (gheSetores as any[]).some((v) => v.ghe_id === sel.id && v.setor_id === s.id))?.nome;
      // Soma das funções como estimativa quando o GES não declara o total.
      // Soma zero vira null: nenhuma função informou quantos são, e mostrar 0
      // afirmaria que o GES não tem trabalhador.
      const somaFuncoes = fns.reduce((a: number, f: any) => a + (f.qtd_trabalhadores || 0), 0);
      return {
        funcoes: fns.length,
        trabalhadores: g?.qtd_trabalhadores ?? (somaFuncoes || null),
        setor: setorNome || null,
        jornada: g?.jornada || null,
        // Montado do setor e das funções agora. A "Descrição curta da
        // exposição" saiu do cadastro: era uma cópia da composição, e ficava
        // velha assim que uma função mudava de grupo.
        criterio: g?.justificativa_similaridade
          || criterioDoGrupo({ armazenado: g?.criterio_agrupamento, setorNome, funcoes: fns })
          || null,
        lista: fns,
      };
    }
    if (sel.tipo === "funcao" && sel.id) {
      const f: any = funcoes.find((x: any) => x.id === sel.id);
      return {
        funcoes: 1, trabalhadores: f?.qtd_trabalhadores ?? null,
        setor: setores.find((s: any) => s.id === f?.setor_id)?.nome || null,
        jornada: f?.jornada || null, criterio: f?.descricao_atividades || null,
        lista: [f].filter(Boolean),
      };
    }
    return { funcoes: null, trabalhadores: null, setor: null, jornada: null, criterio: null, lista: [] };
  }, [sel, gesList, funcoes, setores, gheSetores, gheFuncoes]);

  const No = ({
    chave, tipo, nome, contagem, filhos, nivel = 0,
  }: {
    chave: string; tipo: NoTipo; nome: string; contagem?: number;
    filhos?: React.ReactNode; nivel?: number;
  }) => {
    const Icone = ICONE[tipo];
    const expandido = !fechado[chave];
    const idNo = chave.split(":")[1] || null;
    const ativo = sel.tipo === tipo && sel.id === idNo;
    return (
      <li>
        <div
          className={`group flex items-center rounded-md ${
            ativo ? "bg-accent border-l-2 border-primary" : "hover:bg-muted border-l-2 border-transparent"
          }`}
          style={{ paddingLeft: `${nivel * 16}px` }}
        >
          {filhos ? (
            <button onClick={() => alterna(chave)} className="p-1.5 shrink-0 text-muted-foreground"
              aria-label={expandido ? "Recolher" : "Expandir"} aria-expanded={expandido}>
              {expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : <span className="w-7 shrink-0" />}
          <button
            onClick={() => { setSel({ tipo, id: idNo, nome }); setAba("perigos"); }}
            className="flex items-center gap-2 py-2 min-w-0 flex-1 text-left"
          >
            <Icone className={`h-4 w-4 shrink-0 ${ativo ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-sm truncate ${ativo ? "font-medium" : ""}`}>{nome}</span>
          </button>
          {contagem != null && (
            <span className="mr-2 shrink-0 rounded border px-1.5 text-[11px] text-muted-foreground tabular-nums">
              {contagem}
            </span>
          )}
        </div>
        {expandido && filhos && <ul>{filhos}</ul>}
      </li>
    );
  };

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando estrutura…
      </div>
    );
  }

  const nomeEmpresa = (empresa || []).find((e: any) => e.id === pgr?.empresa_id);
  const nomeUnidade = (empresa || []).find((e: any) => e.id === (pgr?.unidade_id || pgr?.empresa_id));
  const ano = pgr?.data_vigencia_inicio?.slice(0, 4) || pgr?.data_emissao?.slice(0, 4) || "";

  const ABAS: { id: AbaDetalhe; rotulo: string; icone: any }[] = [
    { id: "caracterizacao", rotulo: "Caracterização", icone: FileText },
    { id: "funcoes", rotulo: "Funções e atividades", icone: Users },
    { id: "perigos", rotulo: "Perigos e riscos", icone: TriangleAlert },
    { id: "avaliacoes", rotulo: "Avaliações", icone: BarChart3 },
    { id: "controles", rotulo: "Controles", icone: ShieldCheck },
  ];

  const IconeSel = ICONE[sel.tipo];

  return (
    <div className="pgr-module min-h-screen bg-muted/40">
      <header className="sticky top-0 z-20 bg-background border-b">
        <div className="px-3 sm:px-5 h-16 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(pgrId ? `/pgr/${pgrId}` : "/pgr")}
            className="shrink-0">
            <ArrowLeft className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Assistente</span>
          </Button>

          <div className="flex items-center gap-4 min-w-0 flex-1 overflow-hidden">
            <span className="hidden xl:flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate">
                <span className="text-muted-foreground">Empresa: </span>
                <span className="font-medium">{nomeEmpresa?.nome_fantasia || nomeEmpresa?.nome || "—"}</span>
              </span>
            </span>
            <span className="hidden md:flex items-center gap-2 min-w-0">
              <Home className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate">
                <span className="text-muted-foreground">Unidade: </span>
                <span className="font-medium">{nomeUnidade?.nome_fantasia || nomeUnidade?.nome || "—"}</span>
              </span>
            </span>
            {ano && (
              <span className="flex items-center gap-2 shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">PGR {ano}</span>
              </span>
            )}
            {pgr && (
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 shrink-0">
                <span className={`h-2 w-2 rounded-full ${
                  pgr.status === "vigente" ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span className="text-sm font-medium whitespace-nowrap">
                  {PGR_STATUS_LABEL[pgr.status as PgrStatus] || pgr.status}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-10 hidden sm:inline-flex"
              onClick={() => navigate(`/pgr/${pgrId}?etapa=perigos`)}>
              <Plus className="h-4 w-4 mr-2" /> Novo item
            </Button>
            <Button size="sm" className="h-10" onClick={() => navigate(`/pgr/${pgrId}?etapa=emissao`)}>
              <Eye className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Visualizar PGR</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Grade em vez de flex-row. Com a barra lateral do app ocupando ~250px,
          três colunas nunca cabiam: as media queries do Tailwind medem a
          JANELA, não o espaço restante, então "2xl" disparava a 1536px mesmo
          com só ~1280px disponíveis e a tabela e a régua de abas ficavam com
          barra de rolagem própria. Ficaram duas colunas — árvore e conteúdo —
          e o resumo passou para dentro do painel, onde sempre cabe. */}
      <div className="grid gap-5 p-3 sm:p-5 max-w-[1700px] mx-auto items-start
                      lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ÁRVORE */}
        <aside className="min-w-0 bg-card border rounded-xl p-4 lg:sticky lg:top-[84px]">
          <div className="flex items-start justify-between gap-2 mb-3">
            {/* Sem truncate: o título encurtado para "Estrutura do le…" não diz
                nada. Se faltar largura, ele quebra em duas linhas. */}
            <h2 className="font-semibold text-sm flex items-start gap-1.5 min-w-0 leading-tight pt-1.5">
              <span>Estrutura do levantamento</span>
              <span className="shrink-0 mt-0.5"
                title="A árvore organiza a leitura. Um GES continua acessível de outros pontos.">
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            </h2>
            <Button variant="outline" size="sm" className="shrink-0 h-8"
              onClick={() => navigate(`/pgr/${pgrId}?etapa=ambientes`)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>

          <div className="relative mb-3">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar na estrutura…" className="pl-8 h-9" />
          </div>

          <ul className="max-h-[55vh] lg:max-h-[calc(100vh-260px)] overflow-y-auto -mx-1 px-1">
            <No
              chave="emp:" tipo="empresa" nome={nomeEmpresa?.nome_fantasia || nomeEmpresa?.nome || "Empresa"}
              contagem={1}
              filhos={
                <No
                  chave="uni:" tipo="unidade" nome={nomeUnidade?.nome_fantasia || nomeUnidade?.nome || "Unidade"}
                  nivel={1} contagem={ambientes.length}
                  filhos={
                    <>
                      {ambientes.filter((a: any) => casa(a.nome)).map((amb: any) => {
                        const sets = setores.filter((s: any) => s.ambiente_id === amb.id);
                        return (
                          <No key={amb.id} chave={`ambiente:${amb.id}`} tipo="ambiente" nome={amb.nome}
                            nivel={2} contagem={sets.length}
                            filhos={sets.length ? (
                              <>
                                {sets.map((set: any) => {
                                  const ges = gesDoSetor(set.id);
                                  return (
                                    <No key={set.id} chave={`setor:${set.id}`} tipo="setor" nome={set.nome}
                                      nivel={3} contagem={ges.length}
                                      filhos={ges.length ? (
                                        <>
                                          {ges.map((g: any) => {
                                            const fns = funcoesDoGes(g.id);
                                            return (
                                              <No key={g.id} chave={`ges:${g.id}`} tipo="ges"
                                                nome={g.codigo ? `${g.codigo} — ${g.nome}` : g.nome}
                                                nivel={4} contagem={fns.length}
                                                filhos={fns.length ? (
                                                  <>
                                                    {fns.map((fn: any) => {
                                                      const ats = atividades.filter(
                                                        (a: any) => a.funcao_id === fn.id);
                                                      return (
                                                        <No key={fn.id} chave={`funcao:${fn.id}`} tipo="funcao"
                                                          nome={fn.nome} nivel={5} contagem={ats.length}
                                                          filhos={ats.length ? (
                                                            <>
                                                              {ats.map((at: any) => (
                                                                <No key={at.id} chave={`atividade:${at.id}`}
                                                                  tipo="atividade" nome={at.nome} nivel={6} />
                                                              ))}
                                                            </>
                                                          ) : undefined}
                                                        />
                                                      );
                                                    })}
                                                  </>
                                                ) : undefined}
                                              />
                                            );
                                          })}
                                        </>
                                      ) : undefined}
                                    />
                                  );
                                })}
                              </>
                            ) : undefined}
                          />
                        );
                      })}
                      {processos.filter((p: any) => casa(p.nome)).map((p: any) => (
                        <No key={p.id} chave={`processo:${p.id}`} tipo="processo" nome={p.nome} nivel={2} />
                      ))}
                    </>
                  }
                />
              }
            />
          </ul>

          {ambientes.length === 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Nenhum ambiente cadastrado. A árvore cresce conforme a estrutura é preenchida.
            </p>
          )}
        </aside>

        {/* DETALHE DO NÓ
            overflow-hidden é o que impede a tabela larga de esticar o cartão:
            em coluna (celular) o flex dimensiona o item pelo conteúdo, e sem
            isso a tabela empurra a largura e o texto some sob a borda direita.
            A rolagem horizontal fica no container da própria tabela. */}
        <main className="min-w-0 w-full max-w-full overflow-hidden bg-card border rounded-xl">
          <div className="p-5 sm:p-6 flex items-center gap-4 flex-wrap">
            <span className="h-16 w-16 rounded-full border grid place-items-center shrink-0">
              <IconeSel className="h-7 w-7 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{ROTULO[sel.tipo]}</p>
              <h1 className="text-2xl font-bold tracking-tight break-words">{sel.nome}</h1>
              <div className="flex items-center gap-x-6 gap-y-1 flex-wrap mt-2 text-sm">
                {meta.trabalhadores != null && (
                  <Meta icone={Users} rotulo="Trabalhadores" valor={String(meta.trabalhadores)} />
                )}
                {meta.setor && <Meta icone={LayoutGrid} rotulo="Setor" valor={meta.setor} />}
                {meta.jornada && <Meta icone={Clock} rotulo="Jornada" valor={meta.jornada} />}
              </div>
            </div>
          </div>

          {/* Resumo em faixa, dentro do painel: como coluna própria ele nunca
              cabia junto da árvore e da tabela. */}
          <div className="px-5 sm:px-6 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icone={Users} cor="text-sky-600 bg-sky-50" rotulo="Funções"
              valor={meta.funcoes ?? funcoes.length} />
            <Stat icone={Users} cor="text-emerald-600 bg-emerald-50" rotulo="Trabalhadores"
              valor={meta.trabalhadores} />
            <Stat icone={TriangleAlert} cor="text-amber-600 bg-amber-50" rotulo="Perigos"
              valor={dados.inv.length + dados.lev.length} />
            <Stat icone={ListChecks} cor="text-red-600 bg-red-50" rotulo="Pendências"
              valor={dados.pendencias} />
          </div>

          {/* Abas quebram em vez de rolar: rolagem escondia "Controles". */}
          <div className="border-b px-2 sm:px-5">
            <div className="flex flex-wrap gap-1">
              {ABAS.map((a) => {
                const I = a.icone;
                const ativa = aba === a.id;
                return (
                  <button key={a.id} onClick={() => setAba(a.id)}
                    className={`flex items-center gap-2 px-3 py-3 border-b-2 whitespace-nowrap transition ${
                      ativa
                        ? "border-primary text-primary font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}>
                    <I className="h-4 w-4" />
                    <span className="text-sm">{a.rotulo}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {aba === "perigos" && (
              <>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">Perigos e riscos</h2>
                    <p className="text-sm text-muted-foreground">
                      Identificação dos perigos e análise dos riscos associados a este nível.
                    </p>
                  </div>
                  <Button onClick={() => navigate(`/pgr/${pgrId}?etapa=perigos`)} className="shrink-0">
                    <Plus className="h-4 w-4 mr-2" /> Cadastrar perigo
                  </Button>
                </div>

                {dados.inv.length === 0 && dados.lev.length === 0 ? (
                  <Vazio texto="Nenhum perigo registrado para este item ainda." />
                ) : (
                  <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
                    {/* Cabeçalhos em uma linha só: é o que garante uma largura
                        mínima decente para cada coluna. Sem isso o navegador
                        espreme "Perigo / fator de risco" em três linhas para dar
                        espaço às colunas de texto longo. A tabela rola dentro do
                        próprio container quando não couber. */}
                    <table className="w-full border-collapse text-sm min-w-[880px]">
                      <thead>
                        <tr className="bg-muted/60">
                          {["Perigo / fator de risco", "Fonte ou circunstância", "Possíveis danos",
                            "Exposição", "Controles existentes", "Classificação", ""].map((h) => (
                            <th key={h}
                              className="border p-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dados.inv.map((i: any) => {
                          // null = não avaliado. Rotular como "Trivial" faria
                          // risco não avaliado parecer risco aceito.
                          const classe = classificarRisco(i.severidade, i.probabilidade);
                          const controles: string[] = [
                            ...(i.controles_existentes || []),
                            i.medidas_existentes, i.epi,
                          ].filter(Boolean);
                          return (
                            <tr key={i.id} className="align-top">
                              <td className="border p-3">
                                <p className="font-medium">{i.perigo_descricao}</p>
                                {i.grupo && (
                                  <p className="text-xs text-muted-foreground">
                                    {GRUPO_LABEL[i.grupo] || i.grupo}
                                  </p>
                                )}
                              </td>
                              <td className="border p-3 text-muted-foreground">
                                {i.fonte_geradora || i.circunstancia || "—"}
                              </td>
                              <td className="border p-3 text-muted-foreground">{i.lesoes || "—"}</td>
                              <td className="border p-3 text-muted-foreground">
                                {i.tipo_exposicao || "—"}
                                {i.trabalhadores_expostos ? (
                                  <span className="block text-xs">{i.trabalhadores_expostos} exposto(s)</span>
                                ) : null}
                              </td>
                              <td className="border p-3">
                                {controles.length === 0 ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                                    {controles.map((c, n) => <li key={n}>{c}</li>)}
                                  </ul>
                                )}
                              </td>
                              <td className="border p-3">
                                {classe ? (
                                  <span className={`inline-block rounded px-2 py-1 text-xs font-medium border whitespace-nowrap ${CLASSE_TEXT[classe]}`}>
                                    {CLASSE_LABEL[classe]}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Não avaliado</span>
                                )}
                              </td>
                              <td className="border p-3">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => navigate(`/pgr/${pgrId}?etapa=inventario`)}>
                                      Abrir no inventário
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => navigate(`/pgr/${pgrId}?etapa=acoes`)}>
                                      Ver plano de ação
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                        {dados.lev.filter((l: any) => !l.inventario_item_id).map((l: any) => (
                          <tr key={l.id} className="align-top bg-amber-50/50">
                            <td className="border p-3">
                              <p className="font-medium">{l.perigo_descricao}</p>
                              {l.grupo && (
                                <p className="text-xs text-muted-foreground">
                                  {GRUPO_LABEL[l.grupo] || l.grupo}
                                </p>
                              )}
                            </td>
                            <td className="border p-3 text-muted-foreground">
                              {l.fonte_circunstancia || "—"}
                            </td>
                            <td className="border p-3 text-muted-foreground" colSpan={3}>
                              Levantado, aguardando avaliação de risco.
                            </td>
                            <td className="border p-3">
                              <span className="text-xs text-muted-foreground">Não avaliado</span>
                            </td>
                            <td className="border p-3" />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {aba === "caracterizacao" && (
              <div className="space-y-4 max-w-2xl">
                <h2 className="text-lg font-semibold">Caracterização</h2>
                {meta.criterio ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {sel.tipo === "ges" ? "Critério de agrupamento" : "Descrição"}
                    </p>
                    <p className="text-sm">{meta.criterio}</p>
                  </div>
                ) : (
                  <Vazio texto="Sem descrição cadastrada para este item." />
                )}
                {sel.tipo === "ges" && !meta.criterio && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Este GES não declara por que os trabalhadores têm exposição semelhante.
                    Sem esse critério, o GES é apenas um setor renomeado.
                  </p>
                )}
              </div>
            )}

            {aba === "funcoes" && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Funções e atividades</h2>
                {meta.lista.length === 0 ? (
                  <Vazio texto="Nenhuma função vinculada a este item." />
                ) : meta.lista.map((fn: any) => {
                  const ats = atividades.filter((a: any) => a.funcao_id === fn.id);
                  return (
                    <div key={fn.id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{fn.nome}</span>
                        {fn.cbo && <Badge variant="outline" className="text-[11px] font-mono">CBO {fn.cbo}</Badge>}
                        {fn.qtd_trabalhadores != null && (
                          <span className="text-xs text-muted-foreground">
                            {fn.qtd_trabalhadores} trabalhador(es)
                          </span>
                        )}
                      </div>
                      {ats.length > 0 && (
                        <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground">
                          {ats.map((a: any) => <li key={a.id}>{a.nome}</li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {aba === "avaliacoes" && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Avaliações</h2>
                {dados.inv.length === 0 ? (
                  <Vazio texto="Nenhum risco avaliado neste nível." />
                ) : dados.inv.map((i: any) => {
                  const classe = classificarRisco(i.severidade, i.probabilidade);
                  return (
                    <div key={i.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{i.perigo_descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          Severidade {i.severidade} × Probabilidade {i.probabilidade}
                          {" = "}{(i.severidade || 0) * (i.probabilidade || 0)}
                        </p>
                      </div>
                      {classe ? (
                        <span className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium border ${CLASSE_TEXT[classe]}`}>
                          {CLASSE_LABEL[classe]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">Não avaliado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {aba === "controles" && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Controles</h2>
                {dados.inv.length === 0 ? (
                  <Vazio texto="Nenhum controle registrado neste nível." />
                ) : dados.inv.map((i: any) => {
                  const controles: string[] = [
                    ...(i.controles_existentes || []), i.medidas_existentes, i.epi,
                  ].filter(Boolean);
                  return (
                    <div key={i.id} className="border rounded-lg p-3">
                      <p className="font-medium text-sm">{i.perigo_descricao}</p>
                      {controles.length === 0 ? (
                        <p className="text-xs text-amber-800 mt-1">
                          Sem controle existente registrado.
                        </p>
                      ) : (
                        <ul className="list-disc pl-5 mt-1 text-sm text-muted-foreground">
                          {controles.map((c, n) => <li key={n}>{c}</li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Próxima etapa no rodapé do painel: era a terceira coluna, que foi
              removida por não caber junto da árvore. */}
          <button
            onClick={() => navigate(`/pgr/${pgrId}?etapa=${dados.lev.length > 0 ? "inventario" : "perigos"}`)}
            className="w-full text-left border-t p-5 flex items-center gap-3 hover:bg-muted/50 transition"
          >
            <span className="h-10 w-10 rounded-full bg-primary grid place-items-center shrink-0">
              <ArrowRight className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Próxima etapa</span>
              <span className="block font-semibold leading-tight">
                {dados.lev.length > 0 ? "Avaliar riscos" : "Cadastrar perigos"}
              </span>
            </span>
          </button>
        </main>
      </div>
    </div>
  );
}

function Meta({ icone: Icone, rotulo, valor }: { icone: any; rotulo: string; valor: string }) {
  return (
    <span className="flex items-center gap-2">
      <Icone className="h-4 w-4 text-muted-foreground shrink-0" />
      <span>
        <span className="block text-[11px] text-muted-foreground leading-none">{rotulo}</span>
        <span className="block font-medium leading-tight">{valor}</span>
      </span>
    </span>
  );
}

function Stat({
  icone: Icone, cor, rotulo, valor,
}: { icone: any; cor: string; rotulo: string; valor: number | null }) {
  return (
    <div className="flex items-center gap-3 border rounded-lg p-3">
      <span className={`h-10 w-10 rounded-full grid place-items-center shrink-0 ${cor}`}>
        <Icone className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{rotulo}</span>
        {/* "—" quando o dado não foi cadastrado: zero afirmaria que não há nenhum. */}
        <span className="block text-2xl font-bold leading-none">{valor ?? "—"}</span>
      </span>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
      {texto}
    </div>
  );
}

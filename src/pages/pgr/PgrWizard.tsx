import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  ArrowLeft, ArrowRight, Building2, Check, ChevronDown, Eye, FileSpreadsheet, FileText,
  GitCompare, Loader2, MapPin, Menu, Network, Save, Smartphone, TriangleAlert, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  PgrDocumento, PgrStatus, PGR_STATUS_LABEL, isEditavel,
} from "@/lib/pgrTypes";

import PgrDadosStep from "@/components/pgr/PgrDadosStep";
import PgrResponsaveisStep from "@/components/pgr/PgrResponsaveisStep";
import { EstruturaOcupacionalTab } from "@/components/documentacao/EstruturaOcupacionalTab";
import ColetasCampoRevisao from "@/components/pgr/ColetasCampoRevisao";
import InventarioTab from "@/components/pgr/InventarioTab";
import PlanoAcaoTab from "@/components/pgr/PlanoAcaoTab";
import QuadroEpisTab from "@/components/pgr/QuadroEpisTab";
import EmergenciasTab from "@/components/pgr/EmergenciasTab";
import GovernancaTab from "@/components/pgr/GovernancaTab";
import PgrChecklistTab from "@/components/pgr/PgrChecklistTab";
import PgrPdfTab from "@/components/pgr/PgrPdfTab";
import MatrizRisco from "@/components/pgr/MatrizRisco";
import { PgrEtapaProvider, useAcoesEtapa } from "@/components/pgr/PgrEtapaContext";
import PgrPendenciasPainel, { usePgrPendencias } from "@/components/pgr/PgrPendenciasPainel";
import { CLASSE_DECISAO, CLASSE_LABEL, CLASSE_TEXT, CLASSES_ORDENADAS } from "@/lib/pgrMatriz";
import { exportarPgrExcel } from "@/lib/pgrExcel";
import { verificarEstruturasSst } from "@/lib/erroSupabase";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type EtapaId =
  | "escopo" | "estrutura" | "ges_funcoes"
  | "avaliacao" | "inventario" | "acoes" | "emissao";

interface Etapa {
  id: EtapaId;
  n: number;
  titulo: string;
  ajuda: string;
}

const ETAPAS: Etapa[] = [
  { id: "escopo", n: 1, titulo: "Escopo e identificação", ajuda: "Identificação da unidade, escopo, datas e prazo de revisão." },
  { id: "estrutura", n: 2, titulo: "Estrutura ocupacional", ajuda: "Estabelecimento, ambientes e setores." },
  // A etapa "Processos" saiu: o processo passou a aparecer na linha do setor,
  // na Estrutura ocupacional, e é lá que se cadastra — abrindo o setor. Uma
  // etapa inteira do assistente só para repetir o que a etapa anterior já
  // mostra não se justificava.
  //
  // O id "ges_funcoes" continua o mesmo apesar do rótulo "Funções": é gravado
  // em etapa_atual e vai na URL (?etapa=), então renomear quebraria PGR salvo
  // e link guardado.
  { id: "ges_funcoes", n: 3, titulo: "Funções", ajuda: "Funções e cargos, com o setor de cada um." },
  { id: "avaliacao", n: 4, titulo: "Avaliação de riscos e controles", ajuda: "Matriz de risco, probabilidade, severidade e controles." },
  { id: "inventario", n: 5, titulo: "Inventário de riscos", ajuda: "Consolidação dos perigos, avaliações e classificações." },
  { id: "acoes", n: 6, titulo: "Plano de ação", ajuda: "Medidas que serão implementadas." },
  { id: "emissao", n: 7, titulo: "Revisão e emissão", ajuda: "Complementares, pendências e geração do documento." },
];

export default function PgrWizard() {
  return (
    <PgrEtapaProvider>
      <Assistente />
    </PgrEtapaProvider>
  );
}

function Assistente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const perms = usePermissions("pgr");
  const [params, setParams] = useSearchParams();
  const [menuAberto, setMenuAberto] = useState(false);
  const acoes = useAcoesEtapa();

  // Etapas que deixaram de existir continuam gravadas em PGRs antigos e em
  // links guardados. Sem estas trocas, `findIndex` devolveria -1 e a pessoa
  // cairia na etapa 1 sem entender por quê.
  const ETAPA_APOSENTADA: Record<string, EtapaId> = {
    perigos: "inventario",            // virou o inventário
    dados: "escopo",
    atividades_perigos: "estrutura",  // o processo foi para a Estrutura ocupacional
  };
  const etapaSalva = params.get("etapa") || "";
  const etapaAtual = (ETAPA_APOSENTADA[etapaSalva] || etapaSalva || "escopo") as EtapaId;
  const idx = Math.max(0, ETAPAS.findIndex((e) => e.id === etapaAtual));
  const etapa = ETAPAS[idx];

  const irPara = (e: EtapaId) => {
    const p = new URLSearchParams(params);
    p.set("etapa", e);
    setParams(p, { replace: false });
    setMenuAberto(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const { data: pgr, isLoading } = useQuery({
    queryKey: ["pgr-detalhe", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("pgr_documentos")
        .select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as PgrDocumento | null;
    },
    enabled: !!id,
  });

  const { data: empresa } = useQuery({
    queryKey: ["pgr-wiz-empresa", pgr?.empresa_id],
    enabled: !!pgr,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("empresa_config")
        .select("nome,nome_fantasia").eq("id", pgr!.empresa_id).maybeSingle();
      return data;
    },
  });

  const { data: unidade } = useQuery({
    queryKey: ["pgr-wiz-unidade", pgr?.unidade_id, pgr?.empresa_id],
    enabled: !!pgr,
    queryFn: async () => {
      const alvo = pgr!.unidade_id || pgr!.empresa_id;
      const { data } = await (supabase.from as any)("empresa_config")
        .select("nome,nome_fantasia").eq("id", alvo).maybeSingle();
      return data;
    },
  });

  // Quando o PGR não tem unidade própria, a consulta acima cai no próprio
  // empresa_id — ou seja, é a MESMA linha. O cabeçalho mostrava o nome duas
  // vezes e o espaço gasto na repetição era o que faltava para o nome caber.
  const nomeEmpresa = empresa?.nome_fantasia || empresa?.nome || null;
  const nomeUnidade = unidade?.nome_fantasia || unidade?.nome || null;

  // Progresso: cada etapa vale o mesmo. É indicativo de preenchimento, não de
  // conformidade — quem diz se pode emitir é o checklist da última etapa.
  const { data: progresso } = useQuery({
    queryKey: ["pgr-wiz-progresso", id],
    enabled: !!pgr,
    queryFn: async () => {
      const [inv, acs, resp, amb, set, fun, proc] = await Promise.all([
        (supabase.from as any)("pgr_inventario_itens").select("id").eq("pgr_id", id).limit(1),
        (supabase.from as any)("pgr_acoes").select("id").eq("pgr_id", id).limit(1),
        (supabase.from as any)("pgr_responsaveis").select("id").eq("pgr_id", id).limit(1),
        (supabase.from as any)("sst_ambientes").select("id").eq("empresa_id", pgr!.empresa_id).limit(1),
        (supabase.from as any)("sst_setores").select("id").eq("empresa_id", pgr!.empresa_id).limit(1),
        (supabase.from as any)("sst_funcoes").select("id").eq("empresa_id", pgr!.empresa_id).limit(1),
        (supabase.from as any)("sst_processos").select("id").eq("empresa_id", pgr!.empresa_id).limit(1),
      ]);
      const tem = (r: any) => (r?.data?.length ?? 0) > 0;
      return {
        escopo: !!(pgr!.data_emissao || pgr!.escopo) && !!(pgr!.cnpj_snapshot || pgr!.cnae_principal),
        // Processo entrou na Estrutura ocupacional junto com o setor: a etapa
        // só está pronta quando setor, ambiente e processo existem.
        estrutura: tem(set) && tem(amb) && tem(proc),
        ges_funcoes: tem(fun),
        avaliacao: !!(pgr as any)!.matriz_versao_id,
        inventario: tem(inv),
        acoes: tem(acs),
        emissao: pgr!.status === "vigente"
          && (tem(resp) || !!(pgr!.resp_tec_nome || "").trim()),
      } as Record<EtapaId, boolean>;
    },
  });

  const pct = useMemo(() => {
    if (!progresso) return 0;
    return Math.round((ETAPAS.filter((e) => progresso[e.id]).length / ETAPAS.length) * 100);
  }, [progresso]);

  const { resumo: resumoPend, ...pend } = usePgrPendencias(id, pgr?.resp_tec_nome);

  // Migrations pendentes: avisa uma vez, no topo, em vez de deixar o usuário
  // preencher a etapa inteira e descobrir na hora de salvar.
  const { data: estruturas } = useQuery({
    queryKey: ["sst-estruturas-ok"],
    staleTime: 5 * 60 * 1000,
    queryFn: () => verificarEstruturasSst(supabase),
  });

  /**
   * A exportação usa os MESMOS dados já carregados para as pendências, em vez de
   * consultar o banco de novo. Os nomes das chaves estrangeiras vêm do Núcleo
   * Mestre; sem eles a planilha sairia com uuid nas colunas de contexto.
   */
  const exportarExcel = async () => {
    if (!pgr || !pend.data) return;
    try {
      const daEmpresa = async (t: string) => {
        const { data } = await (supabase.from as any)(t)
          .select("id,nome").eq("empresa_id", pgr.empresa_id);
        return Object.fromEntries(((data || []) as any[]).map((r) => [r.id, r.nome]));
      };
      const [ges, ambientes, setores, funcoes, atividades] = await Promise.all([
        daEmpresa("sst_ges"), daEmpresa("sst_ambientes"), daEmpresa("sst_setores"),
        daEmpresa("sst_funcoes"), daEmpresa("sst_atividades"),
      ]);
      exportarPgrExcel({
        pgr,
        empresaNome: empresa?.nome_fantasia || empresa?.nome,
        unidadeNome: unidade?.nome_fantasia || unidade?.nome,
        ...pend.data,
        nomes: { ges, ambientes, setores, funcoes, atividades },
      });
      toast.success("Planilha gerada");
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar a planilha");
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando PGR…
      </div>
    );
  }
  if (!pgr) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <p className="text-muted-foreground">PGR não encontrado ou fora do seu acesso.</p>
        <Button onClick={() => navigate("/pgr")}>Voltar para a lista</Button>
      </div>
    );
  }

  const status = pgr.status as PgrStatus;
  const editavel = isEditavel(status) && perms.canEdit;
  const ano = pgr.data_vigencia_inicio?.slice(0, 4) || pgr.data_emissao?.slice(0, 4) || "";

  /** Trilha numerada com o fio ligando as etapas, como no desenho. */
  const ListaEtapas = () => (
    <nav className="relative w-full overflow-x-auto scrollbar-hide pb-2">
      <span className="absolute top-[24px] left-8 right-8 h-px bg-border" aria-hidden />
      <ul className="relative flex items-start justify-between min-w-max gap-4 px-2">
        {ETAPAS.map((e) => {
          const ativa = e.id === etapaAtual;
          const feita = progresso?.[e.id];
          return (
            <li key={e.id} className="flex-1 min-w-[120px]">
              <button
                onClick={() => irPara(e.id)}
                aria-current={ativa ? "step" : undefined}
                className={`w-full flex-col text-center rounded-xl p-2 flex items-center gap-2 transition ${
                  ativa ? "bg-primary/5 text-primary" : "hover:bg-muted"
                }`}
              >
                <span
                  className={`shrink-0 w-8 h-8 rounded-full grid place-items-center text-sm font-semibold ring-4 ring-background z-10 ${
                    ativa
                      ? "bg-primary text-primary-foreground"
                      : feita
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {feita && !ativa ? <Check className="h-4 w-4" /> : e.n}
                </span>
                <span className="text-xs leading-tight font-medium line-clamp-2">{e.titulo}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const conteudo = () => {
    switch (etapaAtual) {
      case "escopo":
        return (
          <div className="space-y-8">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Identificação
              </h3>
              <PgrDadosStep pgr={pgr} canEdit={editavel} escopo />
            </section>
            <section className="space-y-4 border-t pt-8">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Vigência e escopo
              </h3>
              <PgrDadosStep pgr={pgr} canEdit={editavel} />
            </section>
          </div>
        );
      case "estrutura":
        return <EstruturaOcupacionalTab only="setores" />;
      case "ges_funcoes":
        return (
          <div className="space-y-6">
            {/* Saiu a linha "Os GES são configurados na Documentação
                central": esta etapa não cria, não edita e não valida GES —
                citá-los aqui só levantava um assunto que não é desta tela. */}
            <EstruturaOcupacionalTab key="funcoes" only="funcoes" />
          </div>
        );
      case "avaliacao":
        return (
          <div className="space-y-6 max-w-3xl">
            <p className="text-sm text-muted-foreground">
              Estes são os critérios usados para classificar cada risco. Ficam registrados na
              versão do PGR, então uma mudança futura de metodologia não reescreve este documento.
            </p>
            <Card><CardContent className="p-4 flex justify-center"><MatrizRisco /></CardContent></Card>
            <div className="space-y-2">
              {CLASSES_ORDENADAS.map((c) => (
                <div key={c} className="flex items-start gap-3 border rounded-lg p-3">
                  <Badge variant="outline" className={`${CLASSE_TEXT[c]} shrink-0`}>
                    {CLASSE_LABEL[c]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{CLASSE_DECISAO[c]}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => navigate("/pgr/matriz")}>
              Ver ou personalizar a matriz
            </Button>
          </div>
        );
      case "inventario":
        return (
          <div className="space-y-10">
            {/* O que veio do celular entra aqui: é no inventário que o perigo
                identificado em campo vira item avaliado. */}
            <ColetasCampoRevisao pgrId={pgr.id} empresaId={pgr.empresa_id} canEdit={editavel} />
            <InventarioTab pgrId={pgr.id} empresaId={pgr.empresa_id} status={status} canEdit={perms.canEdit} />
          </div>
        );
      case "acoes":
        return (
          <PlanoAcaoTab pgrId={pgr.id} empresaId={pgr.empresa_id} pgrVersao={pgr.versao}
            status={status} canEdit={perms.canEdit} pgr={pgr} />
        );
      case "emissao":
        return (
          <div className="space-y-10">
            <Secao titulo="O que falta para emitir">
              <PgrPendenciasPainel pgrId={pgr.id} respTecNome={pgr.resp_tec_nome}
                onIrParaEtapa={(e) => irPara(e as EtapaId)} />
            </Secao>
            <Secao titulo="Responsáveis e assinaturas">
              <PgrResponsaveisStep pgrId={pgr.id} empresaId={pgr.empresa_id} canEdit={editavel} />
            </Secao>
            <Secao titulo="Quadro de EPIs">
              <QuadroEpisTab pgrId={pgr.id} empresaId={pgr.empresa_id} />
            </Secao>
            <Secao titulo="Emergências">
              <EmergenciasTab pgrId={pgr.id} empresaId={pgr.empresa_id} canEdit={editavel} />
            </Secao>
            <Secao titulo="Conferência normativa">
              <PgrChecklistTab pgr={pgr} />
            </Secao>
            <Secao titulo="Gatilhos e aprovações">
              <GovernancaTab pgr={pgr} canEdit={editavel} />
            </Secao>
            <Secao titulo="Documento">
              <PgrPdfTab pgr={pgr} canEdit={perms.canEdit} canExport={perms.canEdit} canAssinar={perms.canEdit} />
            </Secao>
          </div>
        );
    }
  };

  const avancar = async () => {
    if (acoes.temSalvar && !(await acoes.salvar())) return;
    if (idx < ETAPAS.length - 1) irPara(ETAPAS[idx + 1].id);
  };

  return (
    <div className="pgr-module min-h-screen bg-muted/40">
      {/* Cabeçalho: identifica o documento e reúne progresso e ações globais. */}
      <header className="sticky top-0 z-20 bg-background border-b">
        <div className="px-3 sm:px-5 h-16 flex items-center gap-3">
          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden shrink-0" aria-label="Etapas do PGR">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="pgr-module w-[85vw] max-w-sm overflow-y-auto">
              <h2 className="font-semibold mb-4 mt-2">Etapas do PGR</h2>
              <ListaEtapas />
            </SheetContent>
          </Sheet>

          <Button variant="ghost" size="sm" onClick={() => navigate("/pgr")}
            className="hidden lg:inline-flex shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {/* Identificação em "chips". Some por ordem de importância conforme
              a tela estreita, em vez de espremer ou cortar texto. */}
          <div className="flex items-center gap-4 min-w-0 flex-1 overflow-hidden">
            {/* A empresa é o único item que cede espaço, e é o último a sumir:
                antes era o contrário — `hidden xl:flex` na empresa e
                `hidden md:flex` na unidade escondiam justamente o nome mais
                importante primeiro. */}
            <Chip icone={Building2} rotulo="Empresa" valor={nomeEmpresa}
              className="hidden sm:flex" flexivel />
            {/* Quando a unidade é a própria matriz, o nome se repete e ocupa o
                espaço que faria os dois caberem. Só aparece se for diferente. */}
            {nomeUnidade && nomeUnidade !== nomeEmpresa && (
              <Chip icone={MapPin} rotulo="Unidade" valor={nomeUnidade} className="hidden xl:flex" />
            )}
            <Chip icone={FileText} rotulo="PGR" valor={ano} className="hidden md:flex" />
            <StatusPill status={status} />
          </div>

          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-medium tabular-nums">{pct}%</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Bloqueios ficam visíveis o tempo todo: descobrir que faltava
                responsável só na hora de emitir é tarde demais. */}
            {resumoPend.bloqueios > 0 && (
              <Button variant="outline" size="sm" className="h-10 border-red-300 text-red-700"
                onClick={() => irPara("emissao")}>
                <TriangleAlert className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{resumoPend.bloqueios} pendência(s)</span>
                <span className="sm:hidden">{resumoPend.bloqueios}</span>
              </Button>
            )}
            {acoes.temRascunho && (
              <Button variant="outline" size="sm" className="h-10 hidden sm:inline-flex"
                disabled={acoes.ocupado} onClick={() => acoes.salvarRascunho()}>
                <Save className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Salvar</span>
              </Button>
            )}
            <Button size="sm" className="h-10" onClick={() => irPara("emissao")}>
              <Eye className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Visualizar</span>
            </Button>
          </div>
        </div>

        {/* Barra de progresso em tela estreita, onde o par rótulo+número não cabe. */}
        <div className="lg:hidden px-3 pb-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
        </div>
      </header>

      {/* O teto de 1600px sobrava tela em monitor grande justo onde a planilha
          do inventario tem 2100px de largura e cada pixel economiza rolagem.
          Padding e respiro tambem cederam um pouco. */}
      <div className="flex flex-col gap-5 px-3 sm:px-4 py-4 w-full mx-auto">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between w-full bg-card border rounded-xl p-4 sm:p-6">
          <div className="flex-1 w-full overflow-hidden">
            <ListaEtapas />
          </div>
          <div className="shrink-0 w-full lg:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span className="flex items-center">
                    <Wrench className="h-4 w-4 mr-2" /> Mais ações
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate(`/pgr/${pgr.id}/estrutura`)}>
                  <Network className="h-4 w-4 mr-2" /> Estrutura técnica
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/campo?pgr=${pgr.id}`)}>
                  <Smartphone className="h-4 w-4 mr-2" /> Levantamento em campo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/pgr/${pgr.id}/comparar`)}>
                  <GitCompare className="h-4 w-4 mr-2" /> Comparar versões
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportarExcel} disabled={!pend.data}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar para Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <main className="flex-1 min-w-0">
          <div className="bg-card border rounded-xl">
            <div className="p-4 sm:p-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{etapa.titulo}</h1>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                  Etapa {etapa.n} de {ETAPAS.length}
                </span>
                <span className="text-sm text-muted-foreground">{etapa.ajuda}</span>
              </div>

              {estruturas && !estruturas.ok && (
                <Card className="border-amber-300 bg-amber-50 mt-5">
                  <CardContent className="p-3 text-sm text-amber-900">
                    <b>Banco desatualizado.</b> As etapas de Atividades, Perigos e o Levantamento
                    em campo dependem de estruturas que ainda não existem neste banco
                    ({estruturas.faltando.join(", ")}). Aplique as migrations pendentes no Supabase.
                    O restante do PGR funciona normalmente e nenhum dado foi perdido.
                  </CardContent>
                </Card>
              )}

              {!editavel && status !== "vigente" && (
                <Card className="border-amber-300 bg-amber-50 mt-5">
                  <CardContent className="p-3 text-sm text-amber-900">
                    Este PGR está <b>{PGR_STATUS_LABEL[status]}</b> e não permite edição direta.
                    Abra uma revisão para alterar o conteúdo.
                  </CardContent>
                </Card>
              )}

              <div className="mt-7">{conteudo()}</div>
            </div>

            {/* Rodapé de navegação dentro do próprio cartão. */}
            <div className="border-t p-4 sm:px-7 flex flex-col-reverse sm:flex-row sm:items-center gap-3">
              <Button variant="outline" size="lg" disabled={idx === 0}
                onClick={() => irPara(ETAPAS[idx - 1].id)} className="sm:mr-auto">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
              {acoes.temRascunho && (
                <Button variant="outline" size="lg" disabled={acoes.ocupado}
                  onClick={() => acoes.salvarRascunho()}>
                  <FileText className="h-4 w-4 mr-2" /> Salvar rascunho
                </Button>
              )}
              <Button size="lg" onClick={avancar}
                disabled={acoes.ocupado || (idx === ETAPAS.length - 1 && !acoes.temSalvar)}>
                {acoes.ocupado && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {acoes.temSalvar
                  ? "Salvar e continuar"
                  : idx === ETAPAS.length - 1 ? "Concluir" : "Continuar"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-lg">{titulo}</h2>
      {children}
    </section>
  );
}

/**
 * Um item de identificação do cabeçalho.
 *
 * `flexivel` decide quem cede espaço. Antes todos os chips eram iguais: cada um
 * com `min-w-0` e `truncate` dentro do mesmo flex, então encolhiam juntos e
 * todos saíam cortados — o nome da empresa virava "LEONARDO ..." e o rótulo
 * "PGR" virava "PG...", apesar de o valor ter 4 caracteres. Agora só o chip
 * flexível corta; os curtos ficam inteiros.
 */
function Chip({
  icone: Icone, rotulo, valor, className = "", flexivel = false,
}: { icone: any; rotulo: string; valor?: string | null; className?: string; flexivel?: boolean }) {
  if (!valor) return null;
  return (
    <span
      className={`items-center gap-2 ${flexivel ? "min-w-0 flex-1" : "shrink-0"} ${className || "flex"}`}
      // O nome completo continua acessível quando não couber na largura.
      title={`${rotulo}: ${valor}`}
    >
      <Icone className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className={`text-sm ${flexivel ? "truncate" : "whitespace-nowrap"}`}>
        <span className="text-muted-foreground">{rotulo}: </span>
        <span className="font-medium">{valor}</span>
      </span>
    </span>
  );
}

/** Ponto colorido + rótulo, como no desenho — o texto carrega o significado. */
function StatusPill({ status }: { status: PgrStatus }) {
  const cor: Partial<Record<PgrStatus, string>> = {
    rascunho: "bg-amber-500",
    em_revisao_tecnica: "bg-sky-500",
    aguardando_aprovacao: "bg-indigo-500",
    aguardando_assinatura: "bg-violet-500",
    vigente: "bg-emerald-500",
    em_revisao: "bg-amber-500",
    substituido: "bg-slate-400",
    arquivado: "bg-slate-400",
  };
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 shrink-0">
      <span className={`h-2 w-2 rounded-full ${cor[status] || "bg-slate-400"}`} />
      <span className="text-sm font-medium whitespace-nowrap">{PGR_STATUS_LABEL[status]}</span>
    </span>
  );
}

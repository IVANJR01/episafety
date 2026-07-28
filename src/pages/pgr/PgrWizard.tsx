import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, ArrowRight, Check, FileText, ListChecks, Loader2, Menu } from "lucide-react";
import {
  PgrDocumento, PgrStatus, PGR_STATUS_LABEL, PGR_STATUS_COLOR, isEditavel,
} from "@/lib/pgrTypes";

import PgrDadosStep from "@/components/pgr/PgrDadosStep";
import PgrResponsaveisStep from "@/components/pgr/PgrResponsaveisStep";
import { EstruturaOcupacionalTab } from "@/components/documentacao/EstruturaOcupacionalTab";
import LevantamentoPreliminarTab from "@/components/pgr/LevantamentoPreliminarTab";
import InventarioTab from "@/components/pgr/InventarioTab";
import PlanoAcaoTab from "@/components/pgr/PlanoAcaoTab";
import QuadroEpisTab from "@/components/pgr/QuadroEpisTab";
import EmergenciasTab from "@/components/pgr/EmergenciasTab";
import GovernancaTab from "@/components/pgr/GovernancaTab";
import PgrChecklistTab from "@/components/pgr/PgrChecklistTab";
import PgrPdfTab from "@/components/pgr/PgrPdfTab";
import MatrizRisco from "@/components/pgr/MatrizRisco";
import { CLASSE_DECISAO, CLASSE_LABEL, CLASSE_TEXT, CLASSES_ORDENADAS } from "@/lib/pgrMatriz";

type EtapaId =
  | "dados" | "empresa" | "ambientes" | "setores" | "funcoes" | "perigos"
  | "avaliacao" | "inventario" | "acoes" | "complementares" | "responsaveis" | "emissao";

interface Etapa {
  id: EtapaId;
  n: number;
  titulo: string;
  /** Frase curta em linguagem comum — o usuário leigo precisa saber o que fazer aqui. */
  ajuda: string;
}

const ETAPAS: Etapa[] = [
  { id: "dados", n: 1, titulo: "Dados do PGR", ajuda: "Datas, escopo e prazo de revisão do programa." },
  { id: "empresa", n: 2, titulo: "Empresa e unidade", ajuda: "Qual unidade este PGR cobre e seus dados de identificação." },
  { id: "ambientes", n: 3, titulo: "Ambientes e processos", ajuda: "Onde se trabalha e o que é feito em cada lugar." },
  { id: "setores", n: 4, titulo: "Setores e GES", ajuda: "Divisão da empresa e agrupamento de quem tem a mesma exposição." },
  { id: "funcoes", n: 5, titulo: "Funções e atividades", ajuda: "Cargos existentes e o que cada um faz." },
  { id: "perigos", n: 6, titulo: "Perigos e riscos", ajuda: "Levantamento: o que pode causar dano e de onde veio essa informação." },
  { id: "avaliacao", n: 7, titulo: "Avaliação dos riscos", ajuda: "Os critérios usados para classificar cada risco." },
  { id: "inventario", n: 8, titulo: "Inventário de riscos", ajuda: "A lista completa de riscos avaliados." },
  { id: "acoes", n: 9, titulo: "Plano de ação", ajuda: "O que será feito para reduzir cada risco, por quem e até quando." },
  { id: "complementares", n: 10, titulo: "Documentos complementares", ajuda: "EPIs e preparação para emergências." },
  { id: "responsaveis", n: 11, titulo: "Responsáveis e assinaturas", ajuda: "Quem elaborou, revisou e aprova o programa." },
  { id: "emissao", n: 12, titulo: "Revisão e emissão", ajuda: "Pendências, geração do PDF e publicação." },
];

export default function PgrWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const perms = usePermissions("pgr");
  const [params, setParams] = useSearchParams();
  const [menuAberto, setMenuAberto] = useState(false);

  const etapaAtual = (params.get("etapa") as EtapaId) || "dados";
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

  // Progresso: cada etapa vale 1/12. É indicativo de preenchimento, não de
  // conformidade — quem diz se pode emitir é o checklist da etapa 12.
  const { data: progresso } = useQuery({
    queryKey: ["pgr-wiz-progresso", id],
    enabled: !!pgr,
    queryFn: async () => {
      const [inv, acoes, lev, resp, amb, set, fun] = await Promise.all([
        (supabase.from as any)("pgr_inventario_itens").select("id").eq("pgr_id", id).limit(1),
        (supabase.from as any)("pgr_acoes").select("id").eq("pgr_id", id).limit(1),
        (supabase.from as any)("pgr_levantamento_preliminar").select("id").eq("pgr_id", id).limit(1),
        (supabase.from as any)("pgr_responsaveis").select("id").eq("pgr_id", id).limit(1),
        (supabase.from as any)("sst_ambientes").select("id").eq("empresa_id", pgr!.empresa_id).limit(1),
        (supabase.from as any)("sst_setores").select("id").eq("empresa_id", pgr!.empresa_id).limit(1),
        (supabase.from as any)("sst_funcoes").select("id").eq("empresa_id", pgr!.empresa_id).limit(1),
      ]);
      const tem = (r: any) => (r?.data?.length ?? 0) > 0;
      return {
        dados: !!(pgr!.data_emissao || pgr!.escopo),
        empresa: !!(pgr!.cnpj_snapshot || pgr!.cnae_principal),
        ambientes: tem(amb),
        setores: tem(set),
        funcoes: tem(fun),
        perigos: tem(lev),
        avaliacao: !!(pgr as any)!.matriz_versao_id,
        inventario: tem(inv),
        acoes: tem(acoes),
        complementares: true,
        responsaveis: tem(resp) || !!(pgr!.resp_tec_nome || "").trim(),
        emissao: pgr!.status === "vigente",
      } as Record<EtapaId, boolean>;
    },
  });

  const pct = useMemo(() => {
    if (!progresso) return 0;
    const feitas = ETAPAS.filter((e) => progresso[e.id]).length;
    return Math.round((feitas / ETAPAS.length) * 100);
  }, [progresso]);

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

  const ListaEtapas = () => (
    <nav className="space-y-1">
      {ETAPAS.map((e) => {
        const ativa = e.id === etapaAtual;
        const feita = progresso?.[e.id];
        return (
          <button
            key={e.id}
            onClick={() => irPara(e.id)}
            className={`w-full text-left rounded-lg px-3 py-2.5 flex items-start gap-2.5 transition ${
              ativa ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            <span
              className={`shrink-0 w-6 h-6 rounded-full grid place-items-center text-xs font-semibold ${
                ativa
                  ? "bg-primary-foreground/20"
                  : feita
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted-foreground/15 text-muted-foreground"
              }`}
            >
              {feita && !ativa ? <Check className="h-3.5 w-3.5" /> : e.n}
            </span>
            <span className="text-sm leading-tight">{e.titulo}</span>
          </button>
        );
      })}
    </nav>
  );

  const conteudo = () => {
    switch (etapa.id) {
      case "dados":
        return <PgrDadosStep pgr={pgr} canEdit={editavel} />;
      case "empresa":
        return <PgrDadosStep pgr={pgr} canEdit={editavel} escopo />;
      case "ambientes":
        return (
          <div className="space-y-8">
            <EstruturaOcupacionalTab only="ambientes" />
            <EstruturaOcupacionalTab only="processos" />
          </div>
        );
      case "setores":
        return (
          <div className="space-y-8">
            <EstruturaOcupacionalTab only="setores" />
            <p className="text-sm text-muted-foreground">
              Os GES (grupos de exposição semelhante) são cadastrados na aba GES do módulo de
              documentação — um GES reúne trabalhadores com a mesma exposição, não apenas do
              mesmo setor.
            </p>
          </div>
        );
      case "funcoes":
        return <EstruturaOcupacionalTab only="funcoes" />;
      case "perigos":
        return <LevantamentoPreliminarTab pgrId={pgr.id} empresaId={pgr.empresa_id} canEdit={editavel} />;
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
        return <InventarioTab pgrId={pgr.id} empresaId={pgr.empresa_id} status={status} canEdit={perms.canEdit} />;
      case "acoes":
        return (
          <PlanoAcaoTab pgrId={pgr.id} empresaId={pgr.empresa_id} pgrVersao={pgr.versao}
            status={status} canEdit={perms.canEdit} pgr={pgr} />
        );
      case "complementares":
        return (
          <div className="space-y-8">
            <section className="space-y-3">
              <h3 className="font-semibold">Quadro de EPIs</h3>
              <QuadroEpisTab pgrId={pgr.id} empresaId={pgr.empresa_id} />
            </section>
            <section className="space-y-3">
              <h3 className="font-semibold">Emergências</h3>
              <EmergenciasTab pgrId={pgr.id} empresaId={pgr.empresa_id} canEdit={editavel} />
            </section>
          </div>
        );
      case "responsaveis":
        return <PgrResponsaveisStep pgrId={pgr.id} empresaId={pgr.empresa_id} canEdit={editavel} />;
      case "emissao":
        return (
          <div className="space-y-8">
            <section className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <ListChecks className="h-4 w-4" /> O que falta para emitir
              </h3>
              <PgrChecklistTab pgr={pgr} />
            </section>
            <section className="space-y-3">
              <h3 className="font-semibold">Gatilhos e aprovações</h3>
              <GovernancaTab pgr={pgr} canEdit={editavel} />
            </section>
            <section className="space-y-3">
              <h3 className="font-semibold">Documento</h3>
              <PgrPdfTab pgr={pgr} canEdit={perms.canEdit} canExport={perms.canEdit} canAssinar={perms.canEdit} />
            </section>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Cabeçalho fixo: identifica o documento e concentra as duas ações globais. */}
      <header className="sticky top-0 z-20 bg-background border-b">
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/pgr")} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1" /> Documentos
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-semibold truncate">PGR — {unidade?.nome_fantasia || unidade?.nome || "Empresa"}</h1>
              <Badge variant="outline" className={PGR_STATUS_COLOR[status]}>{PGR_STATUS_LABEL[status]}</Badge>
              <Badge variant="outline">v{pgr.versao}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 rounded-full bg-muted flex-1 max-w-[220px] overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{pct}% preenchido</span>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => irPara("emissao")} className="shrink-0">
            <FileText className="h-4 w-4 mr-1" /> Visualizar documento
          </Button>
        </div>

        {/* Mobile: as etapas viram um painel deslizante. */}
        <div className="lg:hidden px-4 pb-3">
          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger asChild>
              <Button variant="outline" className="w-full justify-start h-11">
                <Menu className="h-4 w-4 mr-2" />
                Etapas do PGR — {etapa.n}. {etapa.titulo}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto">
              <h2 className="font-semibold mb-3 mt-2">Etapas do PGR</h2>
              <ListaEtapas />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:block w-72 shrink-0 border-r min-h-[calc(100vh-73px)] p-3">
          <ListaEtapas />
        </aside>

        <main className="flex-1 min-w-0 p-4 sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-medium text-muted-foreground">
              Etapa {etapa.n} de {ETAPAS.length}
            </p>
            <h2 className="text-xl sm:text-2xl font-bold mt-0.5">{etapa.titulo}</h2>
            <p className="text-sm text-muted-foreground mt-1">{etapa.ajuda}</p>
          </div>

          {!editavel && status !== "vigente" && (
            <Card className="border-amber-300 bg-amber-50 mb-4">
              <CardContent className="p-3 text-sm text-amber-900">
                Este PGR está <b>{PGR_STATUS_LABEL[status]}</b> e não permite edição direta.
                Abra uma revisão para alterar o conteúdo.
              </CardContent>
            </Card>
          )}

          {conteudo()}

          <div className="flex items-center justify-between gap-3 mt-10 pt-5 border-t">
            <Button
              variant="outline" size="lg" disabled={idx === 0}
              onClick={() => irPara(ETAPAS[idx - 1].id)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button
              size="lg" disabled={idx === ETAPAS.length - 1}
              onClick={() => irPara(ETAPAS[idx + 1].id)}
            >
              Próxima <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}

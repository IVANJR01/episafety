import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Check, ShieldCheck, Fingerprint, QrCode, PackageSearch, AlertTriangle,
  FileCheck2, ArrowRight, Clock, RotateCcw, BarChart3, Boxes,
  CheckCircle2, XCircle, ShieldAlert, Sparkles, UserCheck, Search,
  FileText, ChevronRight, ChevronDown, Laptop, Smartphone, Eye,
  Building2, Users, FileSpreadsheet, Lock, ArrowUpRight, Zap
} from "lucide-react";
import logo from "@/assets/logo-episafety.png";
import fichaExemplo from "/marca/ficha-epi-exemplo.png";
import {
  PLANOS, precoFormatado, linkDoWhatsapp, algumPrecoDefinido,
  descontoPercentual, totalMensal, CONTATO,
} from "@/lib/planosDeVenda";

/**
 * PÁGINA PÚBLICA DE VENDAS — SAFETY SOLUÇÕES
 *
 * Design B2B SaaS de Alto Padrão (Dark Tech Studio & Clean Authority)
 * Posicionamento Comercial Central:
 * "O EPI sai do estoque com CA conferido. A entrega sai assinada. A ficha fica pronta para auditoria."
 */

const PROBLEMAS = [
  {
    titulo: "Fichas de papel preenchidas à mão",
    descricao: "Pastas físicas que rasgam, molham no canteiro ou ficam com caligrafia ilegível e sem valor probatório.",
    impacto: "Incerteza jurídica",
  },
  {
    titulo: "Dificuldade para achar comprovantes",
    descricao: "Horas de desespero procurando papéis em caixas e arquivos mortos quando o fiscal chega na empresa.",
    impacto: "Perda de produtividade",
  },
  {
    titulo: "Falta de rastreabilidade por pessoa",
    descricao: "Sem histórico centralizado de quem recebeu qual item, em qual quantidade, data ou unidade de trabalho.",
    impacto: "Descontrole operacional",
  },
  {
    titulo: "Risco de entregar com CA vencido",
    descricao: "EPI entregue com Certificado de Aprovação vencido é considerado inexistente pelo auditor e gera autuação.",
    impacto: "Autuação e multa MTE",
  },
  {
    titulo: "Correria em dias de auditoria",
    descricao: "Tentativas de colher assinaturas atrasadas quando a fiscalização notifica, gerando inconsistências graves.",
    impacto: "Passivo trabalhista",
  },
  {
    titulo: "Estoque separado das entregas",
    descricao: "Controle em cadernos ou planilhas desconexas onde o saldo físico nunca bate com quem realmente recebeu.",
    impacto: "Prejuízo e extravios",
  },
];

const ETAPAS_INTERATIVAS = [
  {
    id: "cadastro",
    numero: "01",
    titulo: "Cadastro Organizado",
    chamada: "Centralize colaboradores, cargos e filiais",
    descricao: "Cadastre seus trabalhadores com dados organizados por setor e função. Na hora da entrega, o sistema já sabe o histórico e os equipamentos indicados.",
    icone: UserCheck,
    tag: "Organização",
  },
  {
    id: "ca",
    numero: "02",
    titulo: "Conferência do CA",
    chamada: "Bloqueio automático de itens vencidos",
    descricao: "Antes da liberação do estoque, o sistema confere o Certificado de Aprovação (CA) do equipamento. Se estiver vencido, a saída é bloqueada na hora.",
    icone: Search,
    tag: "Blindagem",
  },
  {
    id: "entrega",
    numero: "03",
    titulo: "Entrega e Assinatura",
    chamada: "Assinatura na tela do celular ou tablet",
    descricao: "O trabalhador assina digitalmente no ato da entrega, com o dedo ou biometria. O registro recebe carimbo de data, hora e código de conferência.",
    icone: Fingerprint,
    tag: "Validade",
  },
  {
    id: "ficha",
    numero: "04",
    titulo: "Ficha Individual em PDF",
    chamada: "Pronta em 10 segundos para a fiscalização",
    descricao: "Gere o documento oficial completo com a declaração do art. 166 da CLT, todo o histórico de entregas e trocas, e código QR para auditoria imediata.",
    icone: FileCheck2,
    tag: "Auditoria",
  },
];

const DIFERENCIAIS_CHAVE = [
  {
    icone: Search,
    badge: "Segurança Documental",
    titulo: "CA conferido antes da saída",
    texto: "O sistema bloqueia e alerta caso o Certificado de Aprovação esteja vencido ou inapropriado antes de o item sair do estoque.",
    destaque: "Zero risco de entregar EPI irregular",
  },
  {
    icone: Fingerprint,
    badge: "Comprovação Imediata",
    titulo: "Assinatura no ato da entrega",
    texto: "O colaborador assina na tela do celular, tablet ou computador com registro de data, hora e código de conferência.",
    destaque: "Assinatura digital e biometria rápida",
  },
  {
    icone: FileCheck2,
    badge: "Pronta para Fiscalização",
    titulo: "Ficha individual em PDF",
    texto: "Em 10 segundos você gera a ficha oficial com todas as entregas, trocas, devoluções e texto legal do art. 166 da CLT.",
    destaque: "Conferência por QR Code sem login",
  },
];

const RECURSOS_SISTEMA = [
  {
    icone: PackageSearch,
    titulo: "Cadastro de EPI e consulta de CA",
    texto: "Busca e organização dos dados de fabricante, validade e proteção aprovada de cada equipamento.",
  },
  {
    icone: Fingerprint,
    titulo: "Entrega assinada na hora",
    texto: "Assinatura na tela ou biometria, com data, hora e código de conferência em cada entrega.",
  },
  {
    icone: FileCheck2,
    titulo: "Ficha pronta para a fiscalização",
    texto: "Um PDF por colaborador, com a declaração do art. 166 da CLT, todas as entregas, devoluções e assinaturas.",
  },
  {
    icone: QrCode,
    titulo: "Conferência sem login",
    texto: "O fiscal digita o código impresso na ficha e confere a entrega na hora, com o papel na mão.",
  },
  {
    icone: Boxes,
    titulo: "Estoque por unidade",
    texto: "Quanto tem em cada obra ou filial, com estoque mínimo avisando antes de faltar.",
  },
  {
    icone: RotateCcw,
    titulo: "Devolução e troca",
    texto: "Entrou, saiu, trocou: tudo no mesmo histórico do colaborador.",
  },
  {
    icone: BarChart3,
    titulo: "Relatórios de entrega",
    texto: "Quanto foi entregue, de quê e para quem — por período, unidade e colaborador.",
  },
  {
    icone: ShieldCheck,
    titulo: "NR-06 e art. 166 da CLT",
    texto: "A ficha sai com o texto legal que a norma exige, não com um recibo qualquer.",
  },
];

const FAQS = [
  {
    pergunta: "A ficha digital de EPI tem validade jurídica comprovada?",
    resposta: "Sim. A ficha digital cumpre integralmente a Norma Regulamentadora NR-06 e a legislação trabalhista brasileira (Portaria MTP nº 671/2021). Cada entrega registra a declaração obrigatória do art. 166 da CLT, carimbo de data e hora e código único de conferência.",
  },
  {
    pergunta: "O auditor fiscal precisa de cadastro ou senha para conferir a ficha?",
    resposta: "Não. A ficha gerada pelo SafetySoluções possui código e QR Code de conferência pública. O fiscal do trabalho apenas lê o código com a câmera do celular ou digita no portal e visualiza a prova da entrega na hora.",
  },
  {
    pergunta: "Preciso comprar leitores biométricos especiais ou computadores caros?",
    resposta: "Não. O sistema funciona pelo navegador em qualquer celular, tablet ou computador. A assinatura pode ser feita diretamente na tela com o dedo ou caneta stylus, ou via biometria nativa do aparelho.",
  },
  {
    pergunta: "Como funciona a implantação? Vocês ajudam a cadastrar minha equipe?",
    resposta: "Sim! Nossa equipe auxilia você a cadastrar seus colaboradores, unidades e catálogo de EPIs no primeiro acesso. Você não começa com a tela vazia.",
  },
];

export default function Planos() {
  const plano = PLANOS[0];
  const semPrecos = !algumPrecoDefinido();
  const linkPlano = linkDoWhatsapp(plano);
  const preco = precoFormatado(plano.precoPorVida);
  const precoDe = precoFormatado(plano.precoDe ?? null);
  const desconto = descontoPercentual(plano);

  const [vidas, setVidas] = useState(50);
  const total = precoFormatado(totalMensal(vidas, plano));
  const [etapaAtiva, setEtapaAtiva] = useState(0);
  const [faqAberto, setFaqAberto] = useState<number | null>(null);

  const Cta = ({
    grande = false,
    texto = "Conhecer a solução",
    variante = "default",
  }: {
    grande?: boolean;
    texto?: string;
    variante?: "default" | "outline";
  }) =>
    linkPlano ? (
      <Button
        size={grande ? "lg" : "default"}
        variant={variante}
        asChild
        className={`font-semibold transition-all duration-200 ${
          variante === "default"
            ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98]"
            : "border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <a href={linkPlano} target="_blank" rel="noreferrer">
          {texto} <ArrowRight className="ml-1.5 h-4 w-4" />
        </a>
      </Button>
    ) : (
      <Button
        size={grande ? "lg" : "default"}
        variant={variante}
        asChild
        className={`font-semibold transition-all duration-200 ${
          variante === "default"
            ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98]"
            : "border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <a href="#oferta">
          {texto} <ArrowRight className="ml-1.5 h-4 w-4" />
        </a>
      </Button>
    );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* ── HEADER GLASSMORPHISM PREMIUM ── */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={logo} alt="SafetySoluções" className="h-9 w-9 rounded-xl border border-slate-700/80 object-cover shadow-xs" />
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-500" />
            </div>
            <div className="leading-tight">
              <span className="text-base font-bold tracking-tight text-white">SafetySoluções</span>
              <p className="text-[11px] font-medium text-emerald-400">Gestão e Ficha de EPIs</p>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-xs font-medium text-slate-300 md:flex">
            <a href="#fluxo" className="transition-colors hover:text-white">Como funciona</a>
            <a href="#diferenciais" className="transition-colors hover:text-white">Diferenciais</a>
            <a href="#sistema" className="transition-colors hover:text-white">O Sistema</a>
            <a href="#oferta" className="transition-colors hover:text-white">Planos & Simulador</a>
            <a href="#faq" className="transition-colors hover:text-white">Dúvidas</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden text-xs font-medium text-slate-300 transition-colors hover:text-white sm:inline-block"
            >
              Entrar
            </Link>
            <Cta texto="Conhecer a solução" />
          </div>
        </div>
      </header>

      {/* ── 1. PRIMEIRA DOBRA — HERO COCKPIT DE ALTO IMPACTO ── */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-32">
        {/* Glow ambient background lights */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute top-[-10%] left-[10%] h-[35rem] w-[35rem] rounded-full bg-emerald-600/15 blur-[120px]" />
          <div className="absolute top-[5%] right-[5%] h-[30rem] w-[30rem] rounded-full bg-blue-600/15 blur-[120px]" />
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div className="space-y-6 text-left">
              {/* Badge oficial */}
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 shadow-inner">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>NR-06 · art. 166 da CLT · Rastreabilidade Integral</span>
              </div>

              {/* Headline definitiva */}
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl sm:leading-[1.12] lg:text-[3.25rem]">
                Entrega de EPI controlada. CA conferido. Assinatura registrada.
                <span className="mt-2 block bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  Ficha pronta para auditoria.
                </span>
              </h1>

              {/* Subheadline com autoridade */}
              <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Organize a entrega de EPIs por colaborador, confira o Certificado de Aprovação,
                registre as assinaturas e mantenha as fichas individuais em PDF — do jeito que o auditor pede.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Cta grande texto="Conhecer a solução" />
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-slate-800 bg-slate-900/80 text-slate-200 backdrop-blur-md hover:border-slate-700 hover:bg-slate-800 hover:text-white"
                >
                  <a href="#fluxo">
                    Solicitar demonstração <ChevronRight className="ml-1.5 h-4 w-4" />
                  </a>
                </Button>
              </div>

              {/* Mini trust points */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-6 border-t border-slate-800/80 pt-6 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Sem taxa de implantação
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Sem fidelidade
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 100% em nuvem segura
                </span>
              </div>
            </div>

            {/* MOCKUP INTERATIVO DO SOFTWARE / FICHA */}
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              {/* Moldura de janela de aplicação SaaS */}
              <div className="relative rounded-2xl border border-slate-800 bg-slate-900/90 p-3 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl">
                {/* Janela Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 px-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-[11px] font-mono text-slate-400">safety-ficha-auditoria.pdf</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" /> Ficha Conforme
                  </div>
                </div>

                {/* Imagem Oficial da Ficha */}
                <div className="relative mt-2 overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950">
                  <img
                    src={fichaExemplo}
                    alt="Ficha de EPI gerada pelo sistema, com as entregas assinadas e o número do CA de cada equipamento"
                    className="w-full object-contain shadow-inner"
                    loading="eager"
                  />
                </div>

                {/* Cards Flutuantes 3D de Demonstração dos 3 Pilares */}
                <div className="absolute -top-4 -right-4 hidden sm:flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <div className="text-left text-xs">
                    <p className="font-bold text-white">CA 43.128 Conferido</p>
                    <p className="text-[10px] text-emerald-400">Válido no MTE</p>
                  </div>
                </div>

                <div className="absolute -bottom-4 -left-4 hidden sm:flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                    <Fingerprint className="h-4 w-4" />
                  </div>
                  <div className="text-left text-xs">
                    <p className="font-bold text-white">Entrega Assinada</p>
                    <p className="text-[10px] text-slate-300">Biometria & Carimbo de Tempo</p>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-center text-xs font-medium text-slate-400">
                Ficha gerada pelo próprio sistema. Dados fictícios.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. SEÇÃO — OS PROBLEMAS QUE A EMPRESA ENFRENTA ── */}
      <section className="border-t border-slate-850 bg-slate-900/40 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-rose-400">
              <ShieldAlert className="h-4 w-4" /> O Custo do Descontrole
            </span>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-4xl">
              Os 6 gargalos operacionais que custam caro na auditoria
            </h2>
            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              A rotina em canteiros de obras, almoxarifados e indústrias costuma acumular falhas críticas na gestão de EPIs:
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEMAS.map((prob) => (
              <div
                key={prob.titulo}
                className="group relative rounded-2xl border border-slate-800 bg-slate-950/60 p-6 transition-all duration-300 hover:border-rose-500/40 hover:bg-slate-900/70 hover:shadow-lg hover:shadow-rose-950/20"
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                    <XCircle className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-rose-400">
                    {prob.impacto}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-white">{prob.titulo}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
                  {prob.descricao}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 p-6 text-center">
            <p className="text-sm font-semibold text-slate-200 sm:text-base">
              Na Justiça do Trabalho e na fiscalização do Ministério do Trabalho, quem não tem a ficha assinada com CA válido não entregou.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              A Safety Soluções substitui o papel por comprovação jurídica eletrônica blindada.
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. SEÇÃO — COMO A SOLUÇÃO FUNCIONA (FLUXO EM 4 ETAPAS) ── */}
      <section id="fluxo" className="border-t border-slate-800 bg-slate-950 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Rastreabilidade de Ponta a Ponta
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
              Como a Safety Soluções funciona na prática
            </h2>
            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              Um fluxo claro, intuitivo e à prova de falhas em quatro etapas simples:
            </p>
          </div>

          {/* Grid Interativo das 4 Etapas */}
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPAS_INTERATIVAS.map((etapa, idx) => {
              const Icone = etapa.icone;
              return (
                <div
                  key={etapa.numero}
                  className="group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all duration-300 hover:border-emerald-500/50 hover:bg-slate-900 hover:shadow-xl hover:shadow-emerald-950/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-slate-700 transition-colors group-hover:text-emerald-500">
                      {etapa.numero}
                    </span>
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                      <Icone className="h-5 w-5" />
                    </div>
                  </div>

                  <span className="mt-4 inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    {etapa.tag}
                  </span>
                  <h3 className="mt-1 text-base font-bold text-white">{etapa.titulo}</h3>
                  <p className="mt-1 text-xs font-medium text-slate-400">{etapa.chamada}</p>
                  <p className="mt-3 text-xs leading-relaxed text-slate-300 border-t border-slate-800/80 pt-3">
                    {etapa.descricao}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4. SEÇÃO — TRÊS GRANDES DIFERENCIAIS (OS PILARES) ── */}
      <section id="diferenciais" className="border-t border-slate-800 bg-slate-900/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Pilares da Plataforma
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
              Três grandes diferenciais que blindam a sua empresa
            </h2>
            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              O núcleo da segurança operacional e jurídica da Safety Soluções:
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {DIFERENCIAIS_CHAVE.map((dif) => {
              const Icone = dif.icone;
              return (
                <div
                  key={dif.titulo}
                  className="relative rounded-3xl border border-slate-800 bg-slate-950 p-8 shadow-xl transition-all duration-300 hover:border-emerald-500/50 hover:shadow-emerald-950/30"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                    <Icone className="h-6 w-6" />
                  </div>
                  <span className="mt-6 block text-xs font-bold uppercase tracking-wider text-emerald-400">
                    {dif.badge}
                  </span>
                  <h3 className="mt-1 text-xl font-bold text-white">{dif.titulo}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    {dif.texto}
                  </p>
                  <div className="mt-6 border-t border-slate-850 pt-4 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{dif.destaque}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 5. SEÇÃO — VISUALIZAÇÃO DO SISTEMA (RECURSOS COMPROVADOS) ── */}
      <section id="sistema" className="border-t border-slate-800 bg-slate-950 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Tecnologia em Produção
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
              Recursos prontos e disponíveis hoje
            </h2>
            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              Todas as ferramentas que a sua equipe de SST e almoxarifado precisa para trabalhar sem papel:
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {RECURSOS_SISTEMA.map((r) => {
              const Icone = r.icone;
              return (
                <div
                  key={r.titulo}
                  className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-all hover:border-slate-700 hover:bg-slate-900 hover:shadow-md"
                >
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-emerald-400 transition-colors group-hover:bg-emerald-500 group-hover:text-slate-950">
                    <Icone className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3.5 text-sm font-bold text-white leading-snug">{r.titulo}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{r.texto}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 6. SEÇÃO — PLANOS E OFERTAS COM SIMULADOR REATIVO ── */}
      <section id="oferta" className="border-t border-slate-800 bg-slate-900/40 py-20 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="relative rounded-3xl border-2 border-emerald-500/60 bg-slate-950 p-7 shadow-2xl shadow-emerald-950/40 sm:p-12">
            <span className="absolute -top-3.5 left-8 rounded-full bg-emerald-500 px-4 py-1 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md">
              Comece por aqui
            </span>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">{plano.nome}</h2>
                <p className="mt-1 text-sm text-slate-300">{plano.publico}</p>
              </div>
            </div>

            {/* Preço em Destaque */}
            <div className="mt-8 flex flex-wrap items-baseline gap-3">
              {preco ? (
                <>
                  {precoDe && (
                    <span className="text-xl text-slate-400 line-through">{precoDe}</span>
                  )}
                  <span className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                    {preco}
                  </span>
                  <span className="text-sm font-medium text-slate-300">{plano.unidade}</span>
                  {desconto != null && (
                    <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
                      −{desconto}%
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-3xl font-black text-white">Sob consulta</span>
                  <span className="text-sm text-slate-300">{plano.unidade}</span>
                </>
              )}
            </div>

            {/* Simulador Interativo de Vidas */}
            {semPrecos ? (
              <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs leading-relaxed text-slate-300">
                O valor é fechado no contato: ele muda conforme o número de colaboradores e de unidades atendidas.
              </p>
            ) : (
              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8">
                <label
                  htmlFor="vidas"
                  className="block text-sm font-bold text-white"
                >
                  Quantos colaboradores você tem?
                </label>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <input
                    id="vidas"
                    type="number"
                    min={1}
                    max={100000}
                    value={vidas}
                    onChange={(e) => setVidas(Math.trunc(Number(e.target.value)))}
                    className="h-12 w-32 rounded-xl border border-slate-700 bg-slate-950 px-4 text-xl font-black text-white shadow-inner focus:border-emerald-500 focus:outline-hidden"
                  />
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-400">fica</span>
                    <span className="text-3xl font-black tracking-tight text-emerald-400 sm:text-4xl">
                      {total ?? "—"}
                    </span>
                    <span className="text-sm font-medium text-slate-300">
                      {total ? "por mês" : "informe de 1 a 100.000"}
                    </span>
                  </div>
                </div>

                {/* Seletores rápidos de porte */}
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">Porte rápido:</span>
                  {[25, 50, 100, 250, 500].map((qtd) => (
                    <button
                      key={qtd}
                      type="button"
                      onClick={() => setVidas(qtd)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        vidas === qtd
                          ? "border-emerald-500 bg-emerald-500 text-slate-950 shadow-sm"
                          : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      {qtd} colaboradores
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-xs leading-relaxed text-slate-400">
                  Sem taxa de implantação, sem contrato de fidelidade e sem cobrança por unidade: você paga pelas vidas que estão no sistema.
                </p>
              </div>
            )}

            {/* O que está incluso */}
            <div className="mt-8 border-t border-slate-800 pt-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tudo incluso na contratação:
              </span>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {plano.inclui.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-xs leading-snug sm:text-sm text-slate-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Cta grande texto="Quero no WhatsApp" />
              {CONTATO.email && (
                <Button size="lg" variant="outline" asChild className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                  <a href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a>
                </Button>
              )}
            </div>

            <p className="mt-4 text-xs text-slate-400">
              A gente cadastra seus EPIs e seus colaboradores junto com você. Você não começa com a tela vazia.
            </p>
          </div>
        </div>
      </section>

      {/* ── 7. SEÇÃO — CONFIANÇA E SEGURANÇA ── */}
      <section className="border-t border-slate-800 bg-slate-950 py-20 sm:py-28 text-center">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Conformidade & Tranquilidade
          </span>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
            Segurança jurídica de ponta a ponta
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            O SafetySoluções foi desenvolvido estritamente de acordo com os requisitos da NR-06 e da legislação trabalhista:
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3 text-left">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">Texto Legal da NR-06</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                A ficha sai com a declaração expressa de guarda, conservação e uso obrigatório prevista no art. 166 da CLT.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <QrCode className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">Autenticidade por QR Code</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                O auditor confere a autenticidade do documento em tempo real sem precisar de senha ou cadastro no sistema.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">Implantação Assistida</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Carregamos seus colaboradores, funções e estoque inicial junto com a sua equipe no primeiro dia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. SEÇÃO — FAQ (DÚVIDAS FREQUENTES) ── */}
      <section id="faq" className="border-t border-slate-800 bg-slate-900/30 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Perguntas Frequentes
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
              Tire suas dúvidas antes de começar
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              Esclarecimentos sobre a substituição da ficha física pelo controle digital:
            </p>
          </div>

          <div className="mt-12 space-y-3">
            {FAQS.map((faq, idx) => {
              const aberto = faqAberto === idx;
              return (
                <div
                  key={faq.pergunta}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => setFaqAberto(aberto ? null : idx)}
                    className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-white transition-colors hover:bg-slate-900/80 sm:text-base"
                  >
                    <span>{faq.pergunta}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        aberto ? "rotate-180 text-emerald-400" : ""
                      }`}
                    />
                  </button>
                  {aberto && (
                    <div className="border-t border-slate-800/80 px-5 pb-5 pt-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
                      {faq.resposta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 9. SEÇÃO — CTA FINAL DE FECHAMENTO ── */}
      <section className="relative overflow-hidden border-t border-slate-800 bg-slate-950 py-24 sm:py-32 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute bottom-0 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-5">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            Chega de procurar ficha de EPI quando o auditor solicita.
          </h2>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Tenha as entregas registradas, os CA conferidos e o histórico individual dos colaboradores organizado.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-4">
            <Cta grande texto="Conhecer a Safety Soluções" />
          </div>
          <p className="text-xs text-slate-400">
            Atendimento imediato e demonstração prática com os dados da sua empresa.
          </p>
        </div>
      </section>

      {/* ── RODAPÉ INSTITUCIONAL ── */}
      <footer className="border-t border-slate-850 bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-slate-400 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="SafetySoluções" className="h-6 w-6 rounded" />
            <span>SafetySoluções — Gestão e Ficha de EPIs</span>
          </div>
          <div className="flex gap-6">
            <Link to="/termos" className="hover:text-white transition-colors">Termos</Link>
            <Link to="/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
            <Link to="/login" className="hover:text-white transition-colors">Entrar</Link>
          </div>
        </div>
      </footer>

      {/* ── BARRA FIXA FLUTUANTE NO CELULAR (CRO) ── */}
      <div className="sticky bottom-0 z-50 border-t border-slate-800 bg-slate-950/95 p-3.5 backdrop-blur-xl sm:hidden shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-xs font-bold text-white">{plano.nome}</p>
            <p className="text-[11px] font-semibold text-emerald-400">
              {preco ? `${preco} ${plano.unidade}` : "Sob consulta"}
            </p>
          </div>
          <Cta texto="Quero no WhatsApp" />
        </div>
      </div>
    </div>
  );
}

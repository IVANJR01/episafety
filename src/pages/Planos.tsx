import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Check, ShieldCheck, Fingerprint, QrCode, PackageSearch, AlertTriangle,
  FileCheck2, ArrowRight, Clock, RotateCcw, BarChart3, Boxes,
  CheckCircle2, XCircle, ShieldAlert, Sparkles, UserCheck, Search,
  FileText, ArrowDown, ChevronRight, CheckCircle
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
 * Posicionamento Comercial Central:
 * "O EPI sai do estoque com CA conferido. A entrega sai assinada. A ficha fica pronta para auditoria."
 *
 * Solução corporativa de controle e rastreabilidade na gestão de entrega de EPIs
 * para Técnicos/Engenheiros de SST, RH, Almoxarifado e Operações.
 */

// Seção 2: Problemas reais que as empresas enfrentam
const PROBLEMAS = [
  {
    titulo: "Fichas de papel preenchidas à mão",
    descricao: "Pastas físicas que rasgam, molham no canteiro ou ficam com caligrafia ilegível.",
  },
  {
    titulo: "Dificuldade para achar comprovantes",
    descricao: "Horas perdidas procurando papéis em arquivos mortos quando o fiscal chega.",
  },
  {
    titulo: "Falta de rastreabilidade por pessoa",
    descricao: "Sem histórico centralizado de quem recebeu qual item, em qual obra ou data.",
  },
  {
    titulo: "Risco de entregar com CA vencido",
    descricao: "EPI entregue com Certificado vencido gera autuação e invalida a proteção na perícia.",
  },
  {
    titulo: "Correria em dias de auditoria",
    descricao: "Desespero para juntar fichas e assinaturas atrasadas quando a fiscalização notifica.",
  },
  {
    titulo: "Estoque separado das entregas",
    descricao: "Controle em caderno ou planilhas desconectadas: não bate o saldo físico com quem recebeu.",
  },
];

// Seção 3: Como a solução funciona (4 Etapas)
const ETAPAS = [
  {
    numero: "01",
    titulo: "Cadastro Organizado",
    descricao: "Identificação do colaborador, cargo e unidade de trabalho com dados centralizados.",
    icone: UserCheck,
  },
  {
    numero: "02",
    titulo: "Conferência do CA",
    descricao: "Verificação do Certificado de Aprovação do equipamento antes da liberação do estoque.",
    icone: Search,
  },
  {
    numero: "03",
    titulo: "Entrega e Assinatura",
    descricao: "Registro dos EPIs entregues com quantidades, datas e assinatura do colaborador na hora.",
    icone: Fingerprint,
  },
  {
    numero: "04",
    titulo: "Ficha Individual em PDF",
    descricao: "Documento com o histórico completo do trabalhador, pronto para consulta e auditoria.",
    icone: FileCheck2,
  },
];

// Seção 4: Três Grandes Diferenciais
const DIFERENCIAIS = [
  {
    icone: Search,
    titulo: "CA conferido antes da saída",
    subtitulo: "Segurança documental",
    texto: "O sistema bloqueia e alerta caso o Certificado de Aprovação esteja vencido ou inapropriado antes de o item sair do estoque.",
  },
  {
    icone: Fingerprint,
    titulo: "Assinatura no ato da entrega",
    subtitulo: "Comprovação na hora",
    texto: "O colaborador assina na tela do celular, tablet ou computador com registro de data, hora e código de conferência.",
  },
  {
    icone: FileCheck2,
    titulo: "Ficha individual em PDF",
    subtitulo: "Pronta para auditoria",
    texto: "Em 10 segundos você gera a ficha oficial com todas as entregas, trocas, devoluções e texto legal do art. 166 da CLT.",
  },
];

// Seção 5: Recursos comprovadamente disponíveis no sistema
const RECURSOS = [
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

export default function Planos() {
  const plano = PLANOS[0];
  const semPrecos = !algumPrecoDefinido();
  const linkPlano = linkDoWhatsapp(plano);
  const preco = precoFormatado(plano.precoPorVida);
  const precoDe = precoFormatado(plano.precoDe ?? null);
  const desconto = descontoPercentual(plano);

  /*
   * Simulador de investimento por colaborador (vida).
   */
  const [vidas, setVidas] = useState(50);
  const total = precoFormatado(totalMensal(vidas, plano));

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
        className="font-semibold shadow-xs transition-all hover:scale-[1.01]"
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
        className="font-semibold shadow-xs transition-all hover:scale-[1.01]"
      >
        <a href="#oferta">
          {texto} <ArrowRight className="ml-1.5 h-4 w-4" />
        </a>
      </Button>
    );

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      {/* ── HEADER CORPORATIVO ── */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <img src={logo} alt="SafetySoluções" className="h-9 w-9 rounded-lg border object-cover shadow-xs" />
            <div className="leading-tight">
              <span className="text-base font-bold tracking-tight text-foreground">SafetySoluções</span>
              <p className="text-[11px] font-medium text-muted-foreground">Gestão e Ficha de EPIs</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-xs font-medium text-muted-foreground md:flex">
            <a href="#como-funciona" className="transition-colors hover:text-foreground">Como funciona</a>
            <a href="#diferenciais" className="transition-colors hover:text-foreground">Diferenciais</a>
            <a href="#sistema" className="transition-colors hover:text-foreground">O Sistema</a>
            <a href="#oferta" className="transition-colors hover:text-foreground">Planos</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden text-xs font-medium text-muted-foreground hover:text-foreground sm:block">
              Entrar
            </Link>
            <Cta texto="Conhecer a solução" />
          </div>
        </div>
      </header>

      {/* ── 1. PRIMEIRA DOBRA — HERO DE ALTO IMPACTO ── */}
      <section className="relative overflow-hidden border-b bg-slate-950 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40
            [background:radial-gradient(60rem_35rem_at_20%_-10%,#1e3a8a,transparent),radial-gradient(45rem_28rem_at_85%_15%,#0f766e,transparent)]"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>NR-06 · art. 166 da CLT · Rastreabilidade Integral</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:leading-[1.15]">
              Entrega de EPI controlada. CA conferido. Assinatura registrada.
              <span className="mt-2 block text-emerald-400">Ficha pronta para auditoria.</span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Organize a entrega de EPIs por colaborador, confira o Certificado de Aprovação,
              registre as assinaturas e mantenha as fichas individuais em PDF — do jeito que o auditor pede.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Cta grande texto="Conhecer a solução" />
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                <a href="#como-funciona">
                  Solicitar demonstração <ChevronRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-5 border-t border-slate-800/80 pt-6 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Sem taxa de implantação
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Sem fidelidade
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Dados seguros em nuvem
              </span>
            </div>
          </div>

          {/* Representação visual realista do sistema */}
          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <figure className="relative rounded-2xl border border-white/15 bg-white/5 p-2.5 shadow-2xl backdrop-blur-xs">
              <img
                src={fichaExemplo}
                alt="Ficha de EPI gerada pelo sistema, com as entregas assinadas e o número do CA de cada equipamento"
                className="w-full rounded-xl object-contain shadow-lg"
                loading="eager"
              />
            </figure>
            <figcaption className="mt-3 text-center text-xs font-medium text-slate-400">
              Ficha gerada pelo próprio sistema. Dados fictícios.
            </figcaption>
          </div>
        </div>
      </section>

      {/* ── 2. OS PROBLEMAS QUE A EMPRESA ENFRENTA ── */}
      <section className="border-b bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-destructive">
              Gargalos Operacionais e Risco Trabalhista
            </span>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Os problemas reais que as empresas enfrentam no dia a dia
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              A rotina de obras, fábricas e operações costuma acumular falhas graves na gestão de EPIs:
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEMAS.map((prob) => (
              <div
                key={prob.titulo}
                className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 transition-all hover:border-destructive/40 hover:bg-destructive/10"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                  <XCircle className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">{prob.titulo}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {prob.descricao}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border bg-muted/40 p-5 text-center">
            <p className="mx-auto max-w-2xl text-sm font-medium text-foreground">
              Na Justiça do Trabalho e na fiscalização do Ministério do Trabalho, quem não tem a ficha assinada com CA válido não entregou.
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. COMO A SOLUÇÃO FUNCIONA (4 ETAPAS) ── */}
      <section id="como-funciona" className="border-b bg-muted/20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Fluxo Operacional Simples
            </span>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Como a Safety Soluções funciona na prática
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Do almoxarifado à auditoria em quatro etapas estruturadas:
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPAS.map((etapa) => (
              <div
                key={etapa.numero}
                className="relative rounded-2xl border bg-background p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-primary/40">{etapa.numero}</span>
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <etapa.icone className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">{etapa.titulo}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {etapa.descricao}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. TRÊS GRANDES DIFERENCIAIS (OS PILARES) ── */}
      <section id="diferenciais" className="border-b bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Pilares da Solução
            </span>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Três grandes diferenciais que blindam a sua empresa
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              A base da segurança jurídica e operacional da Safety Soluções:
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {DIFERENCIAIS.map((dif) => (
              <div
                key={dif.titulo}
                className="rounded-3xl border-2 border-primary/20 bg-muted/10 p-8 transition-all hover:border-primary hover:shadow-lg"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  <dif.icone className="h-6 w-6" />
                </div>
                <span className="mt-6 block text-xs font-bold uppercase tracking-wider text-primary">
                  {dif.subtitulo}
                </span>
                <h3 className="mt-1 text-xl font-bold text-foreground">{dif.titulo}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {dif.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. VISUALIZAÇÃO DO SISTEMA (RECURSOS COMPROVADOS) ── */}
      <section id="sistema" className="border-b bg-muted/20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Visão Geral do Software
            </span>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Recursos prontos e disponíveis hoje
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Ferramentas desenvolvidas especificamente para o controle ágil e seguro da entrega de EPIs:
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {RECURSOS.map((r) => (
              <div
                key={r.titulo}
                className="group rounded-2xl border bg-background p-5 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <r.icone className="h-5 w-5" />
                </div>
                <h3 className="mt-3.5 text-sm font-semibold leading-snug text-foreground">{r.titulo}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. PLANOS E OFERTAS (TRANSPARÊNCIA TOTAL) ── */}
      <section id="oferta" className="border-b bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4">
          <div className="relative rounded-3xl border-2 border-primary bg-background p-7 shadow-xl sm:p-10">
            <span className="absolute -top-3.5 left-8 rounded-full bg-primary px-3.5 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
              Comece por aqui
            </span>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{plano.nome}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{plano.publico}</p>
              </div>
            </div>

            {/* Preço Real */}
            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              {preco ? (
                <>
                  {precoDe && (
                    <span className="text-xl text-muted-foreground line-through">{precoDe}</span>
                  )}
                  <span className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                    {preco}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{plano.unidade}</span>
                  {desconto != null && (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      −{desconto}%
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-3xl font-extrabold text-foreground">Sob consulta</span>
                  <span className="text-sm text-muted-foreground">{plano.unidade}</span>
                </>
              )}
            </div>

            {/* Simulador de Vidas */}
            {semPrecos ? (
              <p className="mt-4 rounded-xl border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
                O valor é fechado no contato: ele muda conforme o número de colaboradores e de unidades atendidas.
              </p>
            ) : (
              <div className="mt-6 rounded-2xl border bg-muted/30 p-5 sm:p-6">
                <label
                  htmlFor="vidas"
                  className="block text-sm font-bold text-foreground"
                >
                  Quantos colaboradores você tem?
                </label>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <input
                    id="vidas"
                    type="number"
                    min={1}
                    max={100000}
                    value={vidas}
                    onChange={(e) => setVidas(Math.trunc(Number(e.target.value)))}
                    className="h-12 w-32 rounded-xl border bg-background px-3.5 text-xl font-bold shadow-xs focus:border-primary focus:outline-hidden"
                  />
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-muted-foreground">fica</span>
                    <span className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
                      {total ?? "—"}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      {total ? "por mês" : "informe de 1 a 100.000"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Porte rápido:</span>
                  {[25, 50, 100, 250, 500].map((qtd) => (
                    <button
                      key={qtd}
                      type="button"
                      onClick={() => setVidas(qtd)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                        vidas === qtd
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      {qtd} colaboradores
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Sem taxa de implantação, sem contrato de fidelidade e sem cobrança por unidade: você paga pelas vidas que estão no sistema.
                </p>
              </div>
            )}

            {/* O que está incluso */}
            <div className="mt-7 border-t pt-6">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Tudo incluso no plano:
              </span>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {plano.inclui.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs leading-snug sm:text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Cta grande texto="Quero no WhatsApp" />
              {CONTATO.email && (
                <Button size="lg" variant="outline" asChild className="font-semibold">
                  <a href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a>
                </Button>
              )}
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              A gente cadastra seus EPIs e seus colaboradores junto com você. Você não começa com a tela vazia.
            </p>
          </div>
        </div>
      </section>

      {/* ── 7. CONFIANÇA E SEGURANÇA JURÍDICA ── */}
      <section className="border-b bg-muted/20 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Conformidade & Tranquilidade
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Segurança jurídica de ponta a ponta
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            O SafetySoluções foi concebido estritamente de acordo com a legislação trabalhista brasileira (NR-06 e art. 166 da CLT):
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-3 text-left">
            <div className="rounded-2xl border bg-background p-6 shadow-xs">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold">Texto Legal da NR-06</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                A ficha sai com a declaração expressa de responsabilidade, guarda e uso correto exigida pela fiscalização.
              </p>
            </div>

            <div className="rounded-2xl border bg-background p-6 shadow-xs">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold">Autenticidade por QR Code</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                O auditor confere a autenticidade do documento em tempo real sem precisar de senha ou cadastro no sistema.
              </p>
            </div>

            <div className="rounded-2xl border bg-background p-6 shadow-xs">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold">Implantação Assistida</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Carregamos seus colaboradores, funções e estoque inicial junto com a sua equipe no primeiro dia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. CTA FINAL DE ALTA CONVERSÃO ── */}
      <section className="bg-background py-16 sm:py-24 text-center">
        <div className="mx-auto max-w-3xl px-4 space-y-4">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            Chega de procurar ficha de EPI quando o auditor solicita.
          </h2>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground">
            Tenha as entregas registradas, os CA conferidos e o histórico individual dos colaboradores organizado.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-3">
            <Cta grande texto="Conhecer a Safety Soluções" />
          </div>
          <p className="text-xs text-muted-foreground">
            Atendimento imediato e demonstração prática com os dados da sua empresa.
          </p>
        </div>
      </section>

      {/* ── RODAPÉ ── */}
      <footer className="border-t bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="SafetySoluções" className="h-6 w-6 rounded" />
            <span>SafetySoluções — Gestão e Ficha de EPIs</span>
          </div>
          <div className="flex gap-5">
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link to="/login" className="hover:text-foreground">Entrar</Link>
          </div>
        </div>
      </footer>

      {/* ── BARRA FIXA MOBILE PARA CRO ── */}
      <div className="sticky bottom-0 z-40 border-t bg-background/95 p-3.5 backdrop-blur-md sm:hidden shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-xs font-bold text-foreground">{plano.nome}</p>
            <p className="text-[11px] font-medium text-muted-foreground">
              {preco ? `${preco} ${plano.unidade}` : "Sob consulta"}
            </p>
          </div>
          <Cta texto="Quero no WhatsApp" />
        </div>
      </div>
    </div>
  );
}

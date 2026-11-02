import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Check, ShieldCheck, Fingerprint, QrCode, PackageSearch, AlertTriangle,
  FileCheck2, ArrowRight, Clock, RotateCcw, BarChart3, Boxes,
} from "lucide-react";
import logo from "@/assets/logo-episafety.png";
import fichaExemplo from "/marca/ficha-epi-exemplo.png";
import {
  PLANOS, precoFormatado, linkDoWhatsapp, algumPrecoDefinido,
  descontoPercentual, CONTATO,
} from "@/lib/planosDeVenda";

/**
 * Página pública de vendas — Gestão de EPIs.
 *
 * Fica fora do sistema: sem login, sem menu lateral, sem empresa ativa.
 * Quem chega aqui ainda não é cliente.
 *
 * A página é toda construída em cima de UMA pergunta — "cadê a ficha
 * assinada?" —, porque é a pergunta que o auditor fiscal faz e a que o
 * advogado da outra parte faz. Vender gestão de EPI é vender a resposta
 * a ela.
 *
 * Preço e contato não moram aqui: moram em src/lib/planosDeVenda.ts.
 *
 * A imagem da ficha NÃO é um desenho: foi gerada pelo próprio código do
 * sistema (src/lib/gerarFichaEPI.ts), com dados fictícios. Página de
 * venda com mockup bonito que o produto não entrega volta como
 * reclamação de quem assinou.
 */

const DORES = [
  {
    icone: AlertTriangle,
    titulo: "Entrega sem assinatura",
    texto: "O EPI saiu do estoque e ninguém assinou. Na reclamação trabalhista, "
      + "quem não tem a ficha assinada não entregou.",
  },
  {
    icone: Clock,
    titulo: "CA vencido",
    texto: "EPI com Certificado de Aprovação vencido é o mesmo que EPI nenhum "
      + "para a fiscalização — e ninguém percebe olhando a caixa.",
  },
  {
    icone: Boxes,
    titulo: "Estoque no caderno",
    texto: "Ninguém sabe quanto tem, em qual unidade, nem quando acaba. "
      + "Aí compra errado ou falta na hora.",
  },
];

const RECURSOS = [
  {
    icone: PackageSearch, titulo: "Cadastro com o CA preenchido sozinho",
    texto: "Digite o número do CA e o sistema busca fabricante, validade e para "
      + "o que ele é aprovado.",
  },
  {
    icone: Fingerprint, titulo: "Entrega assinada na hora",
    texto: "Assinatura na tela ou biometria, com data, hora e código de "
      + "conferência em cada entrega.",
  },
  {
    icone: FileCheck2, titulo: "Ficha pronta para a fiscalização",
    texto: "Um PDF por colaborador, com a declaração do art. 166 da CLT, todas "
      + "as entregas, devoluções e assinaturas.",
  },
  {
    icone: QrCode, titulo: "Conferência sem login",
    texto: "O fiscal digita o código impresso na ficha e confere a entrega na "
      + "hora, com o papel na mão.",
  },
  {
    icone: Boxes, titulo: "Estoque por unidade",
    texto: "Quanto tem em cada obra ou filial, com estoque mínimo avisando "
      + "antes de faltar.",
  },
  {
    icone: RotateCcw, titulo: "Devolução e troca",
    texto: "Entrou, saiu, trocou: tudo no mesmo histórico do colaborador.",
  },
  {
    icone: BarChart3, titulo: "Relatórios",
    texto: "Quanto foi entregue, de quê e para quem — por período, unidade e "
      + "colaborador.",
  },
  {
    icone: ShieldCheck, titulo: "NR-06 e art. 166 da CLT",
    texto: "A ficha sai com o texto legal que a norma exige, não com um recibo "
      + "qualquer.",
  },
];

export default function Planos() {
  const plano = PLANOS[0];
  const semPrecos = !algumPrecoDefinido();
  const whatsapp = linkDoWhatsapp();
  const linkPlano = linkDoWhatsapp(plano);
  const preco = precoFormatado(plano.precoMensal);
  const precoDe = precoFormatado(plano.precoDe ?? null);
  const desconto = descontoPercentual(plano);

  const Cta = ({ grande = false }: { grande?: boolean }) =>
    linkPlano ? (
      <Button size={grande ? "lg" : "default"} asChild className="shadow-lg">
        <a href={linkPlano} target="_blank" rel="noreferrer">
          Quero no WhatsApp <ArrowRight className="ml-1.5 h-4 w-4" />
        </a>
      </Button>
    ) : (
      <Button size={grande ? "lg" : "default"} asChild className="shadow-lg">
        <a href="#oferta">Ver a oferta <ArrowRight className="ml-1.5 h-4 w-4" /></a>
      </Button>
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Topo ── */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="SafetySoluções" className="h-8 w-8 rounded" />
            <div className="leading-tight">
              <p className="text-sm font-bold">SafetySoluções</p>
              <p className="text-[10px] text-muted-foreground">Gestão de EPIs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden text-xs text-muted-foreground hover:text-foreground sm:block">
              Entrar
            </Link>
            <Cta />
          </div>
        </div>
      </header>

      {/* ── Chamada: a pergunta que vende ── */}
      <section className="relative overflow-hidden border-b bg-slate-950 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40
            [background:radial-gradient(60rem_30rem_at_20%_-10%,#1e3a8a,transparent),radial-gradient(40rem_24rem_at_90%_10%,#0f766e,transparent)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/90">
              <ShieldCheck className="h-3.5 w-3.5" /> NR-06 · art. 166 da CLT
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-[1.1] sm:text-5xl">
              “Cadê a ficha assinada?”
              <span className="mt-2 block text-emerald-400">Você responde em 10 segundos.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              Entrega de EPI assinada na hora, CA conferido antes de o equipamento
              sair do estoque, e a ficha de cada colaborador pronta em PDF — do
              jeito que o auditor pede.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Cta grande />
              <a href="#oferta" className="text-sm text-white/70 underline-offset-4 hover:text-white hover:underline">
                ver o que está incluído
              </a>
            </div>
            <p className="mt-5 text-xs text-white/50">
              Sem fidelidade · Sem taxa de implantação · Cancela quando quiser
            </p>
          </div>

          {/* A prova: a ficha que o sistema gera */}
          <figure className="relative">
            <img
              src={fichaExemplo}
              alt="Ficha de EPI gerada pelo sistema, com as entregas assinadas e o número do CA de cada equipamento"
              className="w-full rounded-lg border border-white/10 shadow-2xl"
              loading="eager"
            />
            <figcaption className="mt-2.5 text-center text-[11px] text-white/45">
              Ficha gerada pelo próprio sistema. Dados fictícios.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── A dor ── */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          Três coisas custam caro na auditoria
        </h2>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {DORES.map((d) => (
            <div key={d.titulo} className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
              <d.icone className="h-5 w-5 text-destructive" />
              <h3 className="mt-3 text-sm font-semibold">{d.titulo}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{d.texto}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          As três têm a mesma origem: a entrega não ficou registrada do jeito que
          vale como prova.
        </p>
      </section>

      {/* ── O que resolve ── */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold sm:text-3xl">O que você passa a ter</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tudo abaixo já está no ar e em uso hoje.
          </p>
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {RECURSOS.map((r) => (
              <div key={r.titulo} className="rounded-xl border bg-background p-5">
                <r.icone className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-sm font-semibold leading-snug">{r.titulo}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Oferta ── */}
      <section id="oferta" className="mx-auto max-w-3xl px-4 py-16">
        <div className="relative rounded-2xl border-2 border-primary bg-background p-7 shadow-xl sm:p-9">
          <span className="absolute -top-3.5 left-7 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
            Comece por aqui
          </span>

          <h2 className="text-2xl font-bold">{plano.nome}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{plano.publico}</p>

          <div className="mt-6 flex flex-wrap items-end gap-3">
            {preco ? (
              <>
                {precoDe && (
                  <span className="text-lg text-muted-foreground line-through">{precoDe}</span>
                )}
                <span className="text-4xl font-bold tracking-tight">{preco}</span>
                <span className="pb-1.5 text-sm text-muted-foreground">{plano.unidade}</span>
                {desconto != null && (
                  <span className="mb-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    −{desconto}%
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-3xl font-bold">Sob consulta</span>
                <span className="pb-1 text-sm text-muted-foreground">{plano.unidade}</span>
              </>
            )}
          </div>

          {semPrecos && (
            /*
              * Enquanto o valor não foi definido, a página diz por que não há
              * número — em vez de exibir um que ninguém combinou.
              */
            <p className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              O valor é fechado no contato: ele muda conforme o número de
              colaboradores e de unidades atendidas.
            </p>
          )}

          <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
            {plano.inclui.map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Cta grande />
            {CONTATO.email && (
              <Button size="lg" variant="outline" asChild>
                <a href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a>
              </Button>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            A gente cadastra seus EPIs e seus colaboradores junto com você. Você não
            começa com a tela vazia.
          </p>
        </div>
      </section>

      {/* ── Como começa ── */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-bold">Três passos e está rodando</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { n: "1", t: "Você chama no WhatsApp", d: "A gente entende quantos colaboradores e unidades você tem." },
              { n: "2", t: "A gente carrega seus dados", d: "Colaboradores, EPIs e estoque entram no sistema com você." },
              { n: "3", t: "A primeira entrega é assinada", d: "E a ficha dela já sai pronta, com código de conferência." },
            ].map((p) => (
              <div key={p.n} className="rounded-xl border bg-background p-5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {p.n}
                </span>
                <h3 className="mt-3 text-sm font-semibold">{p.t}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fecho ── */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">
          Da próxima auditoria, a ficha já existe.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          A gente mostra o sistema com os seus EPIs e os seus colaboradores, não com
          dados de exemplo.
        </p>
        <div className="mt-7 flex justify-center">
          <Cta grande />
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row">
          <span>SafetySoluções — Segurança e Saúde no Trabalho</span>
          <div className="flex gap-4">
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link to="/login" className="hover:text-foreground">Entrar</Link>
          </div>
        </div>
      </footer>

      {/* Barra fixa no celular: a oferta nunca sai da tela. */}
      <div className="sticky bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-xs font-semibold">{plano.nome}</p>
            <p className="text-[11px] text-muted-foreground">
              {preco ? `${preco} ${plano.unidade}` : "Sob consulta"}
            </p>
          </div>
          <Cta />
        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Check, ShieldCheck, FileText, Stethoscope, HardHat, GraduationCap,
  ClipboardCheck, QrCode, Bell, ArrowRight, Flame, Package,
} from "lucide-react";
import logo from "@/assets/logo-episafety.png";
import {
  PLANOS, precoFormatado, linkDoWhatsapp, algumPrecoDefinido, CONTATO,
} from "@/lib/planosDeVenda";

/**
 * Página pública de planos.
 *
 * Fica fora do sistema de propósito: sem login, sem menu lateral, sem
 * empresa ativa. Quem chega aqui ainda não é cliente.
 *
 * Preço, prazo e contato não moram nesta página — moram em
 * src/lib/planosDeVenda.ts. Quem for mexer em valor não precisa abrir
 * código de tela, e preço espalhado por uma página sai errado numa hora
 * dessas.
 *
 * O que está escrito sobre o sistema descreve o que ele faz hoje. Página
 * de venda que promete o que o produto não entrega volta como reclamação
 * do cliente que assinou.
 */

const MODULOS = [
  {
    icone: FileText, titulo: "Documentos de SST",
    texto: "PGR, PCMSO, LTCAT, PPP, Ordem de Serviço e os laudos de Insalubridade "
      + "e Periculosidade, com inventário de riscos e plano de ação integrados.",
  },
  {
    icone: Stethoscope, titulo: "Saúde ocupacional",
    texto: "ASO por tipo de exame, matriz de exames por GES e portal para o RH "
      + "emitir, com a periodicidade que a NR-07 manda.",
  },
  {
    icone: Package, titulo: "EPIs",
    texto: "Cadastro com CA, estoque por unidade, entregas e ficha assinada — "
      + "a prova que a fiscalização pede.",
  },
  {
    icone: ClipboardCheck, titulo: "Inspeções e apontamentos",
    texto: "Registro em campo com foto do antes e do depois, norma enquadrada "
      + "e ação corretiva, por obra ou local.",
  },
  {
    icone: GraduationCap, titulo: "Treinamentos",
    texto: "Controle por NR, validade, certificados e o que está vencendo.",
  },
  {
    icone: Flame, titulo: "Extintores (NR-23)",
    texto: "Inspeção mensal, selo digital e histórico que o Corpo de Bombeiros "
      + "lê pelo QR Code.",
  },
  {
    icone: Bell, titulo: "Vencimentos",
    texto: "Painel do que vence — documento, exame, treinamento e EPI — antes "
      + "de virar autuação.",
  },
  {
    icone: QrCode, titulo: "Conferência pública",
    texto: "Cada documento emitido leva um QR Code. O fiscal confere a validade "
      + "na hora, com o papel na mão, sem pedir login a ninguém.",
  },
];

export default function Planos() {
  const semPrecos = !algumPrecoDefinido();
  const whatsapp = linkDoWhatsapp();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Topo ── */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="SafetySoluções" className="h-9 w-9 rounded" />
            <div className="leading-tight">
              <p className="text-sm font-bold">SafetySoluções</p>
              <p className="text-[11px] text-muted-foreground">Segurança e Saúde no Trabalho</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/login">Entrar no sistema</Link>
          </Button>
        </div>
      </header>

      {/* ── Chamada ── */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            NR-01 · NR-06 · NR-07 · NR-23 · eSocial
          </span>
          <h1 className="mt-5 text-3xl font-bold leading-tight sm:text-5xl">
            A documentação de SST da sua empresa, em um sistema só.
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            PGR, PCMSO, ASO, EPIs, treinamentos e inspeções ligados entre si: o risco
            que você levanta no PGR é o mesmo que entra no ASO, na Ordem de Serviço e
            na ficha de EPI. Sem redigitar, sem planilha solta, sem documento
            contando história diferente do outro.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <a href="#planos">Ver os planos <ArrowRight className="ml-1.5 h-4 w-4" /></a>
            </Button>
            {whatsapp && (
              <Button size="lg" variant="outline" asChild>
                <a href={whatsapp} target="_blank" rel="noreferrer">Falar com a gente</a>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ── O que tem dentro ── */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold">O que o sistema faz</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tudo abaixo já está no ar e em uso.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MODULOS.map((m) => (
              <div key={m.titulo} className="rounded-xl border bg-background p-5">
                <m.icone className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-sm font-semibold">{m.titulo}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {m.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planos ── */}
      <section id="planos" className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <h2 className="text-2xl font-bold">Planos</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sem fidelidade e sem taxa de implantação. Você cancela quando quiser.
        </p>

        {semPrecos && (
          /*
            * Aviso honesto enquanto os valores não foram definidos. Melhor
            * dizer "fale com a gente" do que exibir um número que ninguém
            * combinou — ele vira promessa que alguém vai cobrar.
            */
          <p className="mt-5 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            Os valores destes planos são passados no contato — eles variam com o
            número de empresas e de colaboradores atendidos.
          </p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {PLANOS.map((plano) => {
            const preco = precoFormatado(plano);
            const link = linkDoWhatsapp(plano);
            return (
              <div
                key={plano.id}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  plano.destaque ? "border-primary shadow-lg" : ""
                }`}
              >
                {plano.destaque && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    Mais escolhido
                  </span>
                )}

                <h3 className="text-lg font-bold">{plano.nome}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{plano.publico}</p>

                <div className="mt-5">
                  {preco ? (
                    <>
                      <span className="text-3xl font-bold">{preco}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {plano.unidade}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-bold">Sob consulta</span>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {plano.unidade}
                      </p>
                    </>
                  )}
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plano.inclui.map((item) => (
                    <li key={item} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                  {(plano.naoInclui || []).map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-muted-foreground line-through">
                      <span className="mt-0.5 w-4 shrink-0 text-center">—</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-7"
                  variant={plano.destaque ? "default" : "outline"}
                  asChild={!!link}
                  disabled={!link}
                >
                  {link
                    ? <a href={link} target="_blank" rel="noreferrer">Quero este plano</a>
                    : <span>Fale com a gente</span>}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Como começa ── */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold">Como começa</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { n: "1", t: "Conversa", d: "A gente entende quantas empresas você atende e o que já existe de documentação." },
              { n: "2", t: "Implantação", d: "Suas empresas, colaboradores e GES entram no sistema. PGR em Word ou planilha de inventário são importados." },
              { n: "3", t: "Uso", d: "Você emite os documentos, e o sistema avisa o que está vencendo antes de virar problema." },
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
      <section className="mx-auto max-w-6xl px-4 py-14 text-center">
        <HardHat className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 text-2xl font-bold">Quer ver funcionando?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          A gente mostra o sistema com os seus documentos, não com dados de exemplo.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {whatsapp && (
            <Button size="lg" asChild>
              <a href={whatsapp} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>
            </Button>
          )}
          {CONTATO.email && (
            <Button size="lg" variant="outline" asChild>
              <a href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a>
            </Button>
          )}
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
    </div>
  );
}

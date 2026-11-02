import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Check, ShieldCheck, Fingerprint, QrCode, PackageSearch, AlertTriangle,
  FileCheck2, ArrowRight, RotateCcw, BarChart3, Boxes,
  CheckCircle2, XCircle, ChevronDown,
} from "lucide-react";
import logo from "@/assets/logo-episafety.png";
import fichaExemplo from "/marca/ficha-epi-exemplo.png";
import mobileOfflineReal from "/marca/mobile-entrega-offline-real.jpg";
import {
  PLANOS, precoFormatado, linkDoWhatsapp, algumPrecoDefinido,
  descontoPercentual, totalMensal, CONTATO,
} from "@/lib/planosDeVenda";

/**
 * PÁGINA PÚBLICA DE VENDAS — SAFETY SOLUÇÕES
 *
 * Posicionamento Comercial Pé no Chão e com Tom de Realidade:
 * "O EPI sai do estoque com CA conferido. A entrega sai assinada. A ficha fica pronta para auditoria."
 *
 * Focado na realidade operacional de canteiros de obras, fábricas, almoxarifados
 * e departamentos de SST que precisam se defender de multas do MTE e passivos trabalhistas.
 */

// Cenários reais de quem vive o dia a dia de SST e Almoxarifado
const CENARIOS_REAIS = [
  {
    momento: "Cenário 1: O fiscal do trabalho chega de surpresa",
    situacao: "O auditor fiscal do Ministério do Trabalho entra na empresa e solicita as fichas de entrega de EPI dos últimos 12 meses de 30 trabalhadores de um setor operacional.",
    comPapel: "O almoxarife e o técnico perdem horas ou dias revirando caixas de arquivo morto, fichas rasgadas, pastas desorganizadas ou com assinaturas faltantes. Risco de auto de infração imediato.",
    comSafety: "Você abre o sistema no computador ou celular, busca os nomes e baixa todos os PDFs em 10 segundos, com código de conferência e assinaturas registradas.",
  },
  {
    momento: "Cenário 2: A reclamação trabalhista com pedido de insalubridade",
    situacao: "Um ex-colaborador entra na Justiça do Trabalho alegando que trabalhava exposto a ruído ou produtos químicos sem nunca ter recebido o EPI adequado da empresa.",
    comPapel: "A empresa procura a ficha física e descobre que o funcionário não assinou as últimas trocas, ou que o CA do protetor auricular entregue estava vencido na data. Causa praticamente perdida.",
    comSafety: "O advogado anexa ao processo a ficha eletrônica completa, com cada entrega assinada com data e hora exatas, texto do art. 166 da CLT e o CA válido na época. Prova documental sólida.",
  },
  {
    momento: "Cenário 3: A rotina diária no balcão do almoxarifado",
    situacao: "Fila de 15 trabalhadores às 07h da manhã para retirar botas, luvas e capacetes antes de iniciar o turno de trabalho.",
    comPapel: "Caneta falhando, papel molhado com suor ou poeira, caligrafia ilegível e ninguém confere se o lote de EPIs da caixa ainda tem CA dentro da validade.",
    comSafety: "O almoxarife seleciona o colaborador no celular ou tablet, escolhe o EPI com o número do CA já cadastrado, o trabalhador assina com o dedo na tela em segundos e o saldo baixa do estoque automaticamente.",
  },
];

// As 6 dores operacionais reais
const PROBLEMAS_REAIS = [
  {
    titulo: "Fichas de papel que somem ou se degradam",
    descricao: "Em obras e indústrias, papel amassa, molha, rasga e pega poeira. Quando o perito pede a folha de 2 anos atrás, ninguém sabe em qual caixa está arquivada.",
  },
  {
    titulo: "Colaborador que recebe e não assina",
    descricao: "Na correria do balcão, o trabalhador pega a luva nova e sai com a promessa de 'assinar depois'. Esse 'depois' nunca acontece e a empresa fica desprotegida.",
  },
  {
    titulo: "Entregar EPI com CA vencido sem perceber",
    descricao: "A caixa do fornecedor é igual, mas o lote tem CA que venceu semana passada. Para a fiscalização, entregar EPI com CA vencido equivale a não entregar nada.",
  },
  {
    titulo: "Estoque no caderno que não bate com as fichas",
    descricao: "Divergência entre o que o financeiro comprou, o que consta no estoque do almoxarifado e o que realmente foi entregue na mão de cada funcionário.",
  },
  {
    titulo: "Desespero antes de auditorias de clientes ou órgãos",
    descricao: "Equipes de RH e SST passando noites e fins de semana tentando regularizar assinaturas e documentos atrasados às vésperas de fiscalizações.",
  },
  {
    titulo: "Falta de histórico individual nas trocas e devoluções",
    descricao: "Sem controle de durabilidade por função: você não sabe se o colaborador gasta um par de luvas por semana ou por mês, nem se devolveu o item avariado.",
  },
];

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
  /*
   * Título e descrição próprios da página.
   *
   * O index.html serve o sistema inteiro e diz "Sistema de gestão de EPIs
   * e segurança do trabalho" — texto de produto, não de venda. Quem abre
   * esta página via link vê a aba com o nome certo e o navegador guarda o
   * favorito com ele.
   */
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = "Gestão e Ficha de EPIs — SafetySoluções";

    const meta = document.querySelector('meta[name="description"]');
    const descricaoAnterior = meta?.getAttribute("content") ?? null;
    meta?.setAttribute(
      "content",
      "Entrega de EPI assinada pelo colaborador, com o CA registrado e a ficha individual em PDF pronta para a fiscalização. NR-06 e art. 166 da CLT.",
    );

    /* Sai da página, devolve o que era: isto aqui é o documento do app todo. */
    return () => {
      document.title = tituloAnterior;
      if (descricaoAnterior != null) meta?.setAttribute("content", descricaoAnterior);
    };
  }, []);

  const plano = PLANOS[0];
  const semPrecos = !algumPrecoDefinido();
  const linkPlano = linkDoWhatsapp(plano);
  const preco = precoFormatado(plano.precoPorVida);
  const precoDe = precoFormatado(plano.precoDe ?? null);
  const desconto = descontoPercentual(plano);

  /* O exemplo da primeira dobra sai da mesma conta do simulador. */
  const exemploDeTotal = precoFormatado(totalMensal(50, plano));

  const [vidas, setVidas] = useState(50);
  const total = precoFormatado(totalMensal(vidas, plano));

  /*
   * Um botão só, com um texto só. A página tinha cinco rótulos diferentes
   * para a mesma ação ("Solicitar Demonstração", "Testar no WhatsApp",
   * "Conhecer a Safety Soluções"...). Quem lê cinco promessas diferentes
   * não sabe o que vai acontecer ao clicar, e hesitar é não clicar.
   */
  const Cta = ({
    grande = false,
    texto = "Falar no WhatsApp",
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
        className={`font-semibold transition-all ${
          variante === "default"
            ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg"
            : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
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
        className={`font-semibold transition-all ${
          variante === "default"
            ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg"
            : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
        }`}
      >
        <a href="#oferta">
          {texto} <ArrowRight className="ml-1.5 h-4 w-4" />
        </a>
      </Button>
    );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* ── BARRA DE ALERTA REALISTA NO TOPO ── */}
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-[13px]">
        <span>⚠️ Na Justiça do Trabalho e na fiscalização do MTE: <strong>quem não tem a ficha assinada com CA válido não entregou.</strong></span>
      </div>

      {/* ── HEADER CORPORATIVO LIMPO ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="SafetySoluções" className="h-9 w-9 rounded-lg border border-slate-200 object-cover shadow-xs" />
            <div className="leading-tight">
              <span className="text-base font-bold tracking-tight text-slate-900">SafetySoluções</span>
              <p className="text-[11px] font-semibold text-emerald-700">Gestão e Ficha de EPIs</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-xs font-medium text-slate-600 md:flex">
            <a href="#cenarios" className="transition-colors hover:text-slate-900">Casos Reais</a>
            <a href="#demonstracao" className="transition-colors hover:text-slate-900">Como Funciona</a>
            <a href="#oferta" className="transition-colors hover:text-slate-900">Simulador de Custos</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden text-xs font-medium text-slate-600 hover:text-slate-900 sm:inline-block">
              Entrar
            </Link>
            <Cta />
          </div>
        </div>
      </header>

      {/* ── 1. PRIMEIRA DOBRA — TOM DE REALIDADE & DOR OPERACIONAL ── */}
      <section className="border-b border-slate-200 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
            <div className="space-y-5 text-left">
              <div className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <span>Norma Regulamentadora NR-06 · Art. 166 da CLT</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
                Entrega de EPI controlada. CA conferido. Assinatura registrada.
                <span className="mt-2 block text-emerald-700">Ficha pronta para auditoria.</span>
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Organize a entrega de EPIs por colaborador, confira o Certificado de Aprovação,
                registre as assinaturas e mantenha as fichas individuais em PDF — do jeito que o auditor pede.
              </p>

              {/*
                * O preço na primeira dobra. Vender por vida levanta sempre a
                * mesma dúvida — "no meu caso dá quanto?" — e quem precisa
                * rolar a página inteira para descobrir costuma não rolar.
                * O valor sai das mesmas funções do simulador lá embaixo, para
                * não existir um segundo lugar com preço escrito à mão.
                */}
              {preco && (
                <a
                  href="#oferta"
                  data-testid="preco-primeira-dobra"
                  className="group flex w-full max-w-md items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 transition-colors hover:border-emerald-400 hover:bg-emerald-100"
                >
                  <span className="text-sm text-slate-700">
                    <strong className="text-lg font-extrabold text-emerald-800">{preco}</strong>
                    <span className="ml-1.5 text-xs font-medium text-slate-600">{plano.unidade}</span>
                  </span>
                  <span className="text-right text-xs font-medium text-slate-600">
                    {exemploDeTotal && (
                      <>
                        50 colaboradores ={" "}
                        <strong className="text-slate-900">{exemploDeTotal}</strong>/mês
                      </>
                    )}
                    <span className="block text-emerald-700 group-hover:underline">
                      simular com o meu número →
                    </span>
                  </span>
                </a>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Cta grande />
                <Button size="lg" variant="outline" asChild className="border-slate-300 bg-white text-slate-800 hover:bg-slate-100">
                  <a href="#demonstracao">
                    Ver como funciona no balcão <ChevronDown className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              </div>

              <div className="border-t border-slate-200 pt-5 text-xs text-slate-500">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-medium">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Sem taxa de implantação
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Sem contrato de fidelidade
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Cadastramos seus dados com você
                  </span>
                </div>
              </div>
            </div>

            {/* A FICHA REAL GERADA PELO SISTEMA */}
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <div className="rounded-2xl border border-slate-300 bg-slate-900 p-3 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 px-1 text-slate-300">
                  <span className="text-xs font-mono font-medium">ficha_individual_epi.pdf</span>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <Check className="h-3 w-3" /> Ficha Pronta para Auditoria
                  </span>
                </div>
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-700 bg-white">
                  <img
                    src={fichaExemplo}
                    alt="Ficha de EPI gerada pelo sistema, com as entregas assinadas e o número do CA de cada equipamento"
                    className="w-full object-contain"
                    loading="eager"
                  />
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">
                Ficha gerada pelo próprio sistema. Dados fictícios.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. CASOS REAIS DO DIA A DIA (PÉ NO CHÃO) ── */}
      <section id="cenarios" className="border-b border-slate-200 bg-slate-100/60 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Situações que Toda Empresa Enfrenta
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Como a sua empresa responde nestas 3 situações reais?
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              A diferença entre ter um controle digital organizado e continuar dependendo de papéis físicos no almoxarifado:
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {CENARIOS_REAIS.map((cenario, idx) => (
              <div
                key={cenario.momento}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
              >
                <div className="inline-flex self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                  {cenario.momento}
                </div>
                <p className="mt-4 text-xs font-medium leading-relaxed text-slate-700">
                  {cenario.situacao}
                </p>

                <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-xs">
                  <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-red-950">
                    <span className="font-bold flex items-center gap-1.5 text-red-700">
                      <XCircle className="h-4 w-4 shrink-0" /> Com ficha de papel:
                    </span>
                    <p className="mt-1 leading-normal text-slate-700">{cenario.comPapel}</p>
                  </div>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-950">
                    <span className="font-bold flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" /> Com o SafetySoluções:
                    </span>
                    <p className="mt-1 leading-normal text-slate-700">{cenario.comSafety}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. O QUE ACONTECE NA TELA DE ENTREGA (DEMONSTRAÇÃO REALISTA) ── */}
      <section id="demonstracao" className="border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Demonstração Prática do Balcão
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              O EPI sai do estoque com CA conferido. A entrega sai assinada.
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Veja exatamente como o almoxarife faz a entrega no celular ou tablet em menos de 1 minuto:
            </p>
          </div>

          {/* Demonstração Realista da Entrega no Mobile (100% Offline) */}
          <div className="mx-auto mt-12 grid max-w-5xl items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            {/* O Celular com o Print Real no Ato da Entrega */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-[320px] rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-950 p-2 shadow-2xl shadow-slate-400/20">
                <div className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-black">
                  <img
                    src={mobileOfflineReal}
                    alt="Tela do aplicativo SafetySoluções no celular no ato da entrega de EPI com assinatura digital em modo offline"
                    className="w-full object-contain"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* Explicação Técnica e Operacional do Modo Offline */}
            <div className="space-y-6 text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-900">
                <span>⚡ Funciona 100% Offline (Sem Sinal de Internet)</span>
              </div>

              <h3 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                No canteiro de obras, no galpão ou no subsolo: a entrega não para.
              </h3>

              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                A internet caiu ou você está em uma área remota da obra? O almoxarife continua
                entregando os EPIs e coletando a assinatura do trabalhador normalmente no celular ou tablet.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Assinatura com o dedo na tela</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      O colaborador assina diretamente na tela do celular no momento exato em que recebe o EPI.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">CA gravado na entrega</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      O número do Certificado de Aprovação e a validade cadastrada do EPI ficam gravados na entrega e saem impressos na ficha.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Sincronização automática</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Cada entrega fica gravada com segurança no aparelho. Quando reconectar ao Wi-Fi ou 4G, tudo sobe sozinho para a nuvem.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <Cta />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. OS 6 PROBLEMAS REAIS QUE CUSTAM CARO ── */}
      <section className="border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              O Risco Oculto do Papel
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Seis pontos que custam caro na auditoria
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              A rotina comum de preenchimento manual de fichas esconde vulnerabilidades jurídicas perigosas:
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEMAS_REAIS.map((prob) => (
              <div
                key={prob.titulo}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300"
              >
                <div className="flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900">{prob.titulo}</h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {prob.descricao}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. RECURSOS DO SISTEMA (O QUE VOCÊ PASSA A TER) ── */}
      <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Ferramentas de Trabalho
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              O que você passa a ter
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Tudo abaixo já está no ar e em uso hoje.
            </p>
          </div>

          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {RECURSOS.map((r) => {
              const Icone = r.icone;
              return (
                <div
                  key={r.titulo}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition-all hover:border-emerald-500/40 hover:bg-white hover:shadow-xs"
                >
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                    <Icone className="h-4 w-4" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">{r.titulo}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{r.texto}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 6. SEÇÃO DE OFERTA E SIMULADOR REALISTA (id="oferta") ── */}
      <section id="oferta" className="border-b border-slate-200 bg-slate-100/60 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="relative rounded-2xl border-2 border-emerald-600 bg-white p-7 shadow-xl sm:p-10">
            <span className="absolute -top-3.5 left-7 rounded-full bg-emerald-700 px-3.5 py-1 text-xs font-bold text-white shadow-xs">
              Comece por aqui
            </span>

            <div>
              <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">{plano.nome}</h2>
              <p className="mt-1 text-sm text-slate-600">{plano.publico}</p>
            </div>

            {/* Preço real */}
            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              {preco ? (
                <>
                  {precoDe && (
                    <span className="text-lg text-slate-400 line-through">{precoDe}</span>
                  )}
                  <span className="text-4xl font-extrabold tracking-tight text-slate-950">
                    {preco}
                  </span>
                  <span className="text-sm font-medium text-slate-600">{plano.unidade}</span>
                  {desconto != null && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      −{desconto}%
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-3xl font-bold text-slate-950">Sob consulta</span>
                  <span className="text-sm text-slate-600">{plano.unidade}</span>
                </>
              )}
            </div>

            {/* Simulador de Vidas */}
            {semPrecos ? (
              <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                O valor é fechado no contato: ele muda conforme o número de colaboradores e de unidades atendidas.
              </p>
            ) : (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                <label
                  htmlFor="vidas"
                  className="block text-sm font-bold text-slate-900"
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
                    className="h-11 w-28 rounded-lg border border-slate-300 bg-white px-3 text-lg font-bold text-slate-900 shadow-xs focus:border-emerald-600 focus:outline-hidden"
                  />
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-slate-600">fica</span>
                    {/*
                      * aria-live: quem usa leitor de tela troca o número de
                      * colaboradores e ouve o total novo. Sem isso, o valor
                      * muda em silêncio e a pessoa não sabe quanto deu.
                      */}
                    <span
                      data-testid="total-simulado"
                      aria-live="polite"
                      className="text-3xl font-extrabold tracking-tight text-emerald-700"
                    >
                      {total ?? "—"}
                    </span>
                    <span className="text-sm text-slate-600">
                      {total ? "por mês" : "informe de 1 a 100.000"}
                    </span>
                  </div>
                </div>

                {/* Atalhos de colaboradores */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Selecione rápido:</span>
                  {[25, 50, 100, 250, 500].map((qtd) => (
                    <button
                      key={qtd}
                      type="button"
                      onClick={() => setVidas(qtd)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-all ${
                        vidas === qtd
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {qtd} colaboradores
                    </button>
                  ))}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Sem taxa de implantação, sem contrato de fidelidade e sem cobrança por unidade: você paga pelas vidas que estão no sistema.
                </p>
              </div>
            )}

            {/* O que está incluso */}
            <div className="mt-7 border-t border-slate-200 pt-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tudo incluso no plano:
              </span>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {plano.inclui.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-slate-800 sm:text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ações */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Cta grande />
              {CONTATO.email && (
                <Button size="lg" variant="outline" asChild className="border-slate-300">
                  <a href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a>
                </Button>
              )}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              A gente cadastra seus EPIs e seus colaboradores junto com você. Você não começa com a tela vazia.
            </p>
          </div>
        </div>
      </section>

      {/* ── 7. TRÊS PASSOS E ESTÁ RODANDO ── */}
      <section className="border-b border-slate-200 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Como Começa
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Três passos e está rodando
            </h2>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { n: "1", t: "Você chama no WhatsApp", d: "A gente entende quantos colaboradores e unidades você tem." },
              { n: "2", t: "A gente carrega seus dados", d: "Colaboradores, EPIs e estoque entram no sistema com você." },
              { n: "3", t: "A primeira entrega é assinada", d: "E a ficha dela já sai pronta, com código de conferência." },
            ].map((p) => (
              <div key={p.n} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                  {p.n}
                </span>
                <h3 className="mt-3 text-sm font-bold text-slate-900">{p.t}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. FECHO REALISTA ── */}
      <section className="border-b border-slate-200 bg-slate-100 py-16 sm:py-24 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-3">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Da próxima auditoria, a ficha já existe.
          </h2>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            A gente mostra o sistema com os seus EPIs e os seus colaboradores, não com dados de exemplo.
          </p>
          <div className="pt-4 flex justify-center">
            <Cta grande />
          </div>
        </div>
      </section>

      {/* ── RODAPÉ ── */}
      <footer className="bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="SafetySoluções" className="h-6 w-6 rounded" />
            <span>SafetySoluções — Segurança e Saúde no Trabalho</span>
          </div>
          <div className="flex gap-5">
            <Link to="/termos" className="hover:text-slate-900">Termos</Link>
            <Link to="/privacidade" className="hover:text-slate-900">Privacidade</Link>
            <Link to="/login" className="hover:text-slate-900">Entrar</Link>
          </div>
        </div>
      </footer>

      {/* ── BARRA FIXA MOBILE ── */}
      <div className="sticky bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-md sm:hidden shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-xs font-bold text-slate-900">{plano.nome}</p>
            <p className="text-[11px] font-medium text-slate-500">
              {preco ? `${preco} ${plano.unidade}` : "Sob consulta"}
            </p>
          </div>
          <Cta />
        </div>
      </div>
    </div>
  );
}

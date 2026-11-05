import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Check, ShieldCheck, Fingerprint, QrCode, PackageSearch, AlertTriangle,
  FileCheck2, ArrowRight, RotateCcw, BarChart3, Boxes,
  CheckCircle2, XCircle, ChevronDown, Building2, UserCheck, DatabaseBackup, Smartphone, WifiOff, FileText,
  MessageCircle,
  Clock, ShieldAlert, Award, HelpCircle
} from "lucide-react";
import logo from "@/assets/logo-episafety.png";
import fichaExemplo from "/marca/ficha-epi-exemplo.png";
import mobileEntregasReal from "/marca/mobile-entregas-real.png";
import telaEstoque from "/marca/tela-estoque-epis.png";
import telaConferencia from "/marca/tela-conferencia-publica.png";
import {
  PLANOS, precoFormatado, linkDoWhatsapp, algumPrecoDefinido,
  descontoPercentual, totalMensal, CONTATO,
} from "@/lib/planosDeVenda";

/**
 * PÁGINA PÚBLICA DE VENDAS & DEMONSTRAÇÃO — SAFETY SOLUÇÕES
 *
 * Padrão Corporativo B2B de Alta Conversão inspirado nas melhores referências do setor (OnSafety).
 * Proposta de Valor Central:
 * "O EPI sai do estoque com CA conferido. A entrega sai assinada. A ficha fica pronta para auditoria."
 *
 * Foco técnico: Gestão de EPI, Assinatura Eletrônica, Funcionamento 100% Offline no Mobile
 * e Ficha Individual em PDF conforme NR-06 e Art. 166 da CLT.
 */

// Rótulo unificado para todos os links de WhatsApp (requisito estrito de CRO e consistência)
const TEXTO_BOTAO_WHATSAPP = "Falar no WhatsApp";

/* Amarelo de segurança: só para aviso de CA e para o selo de sem sinal. */
const ALERTA = "#F5B800";

/* Ficha de papel x ficha digital: uma frase por célula, sem drama. */
const COMPARATIVO_OPERACIONAL = [
  {
    situacao: "Fiscalização",
    papel: "Procurar as fichas no arquivo e torcer para não faltar assinatura.",
    safety: "Buscar o colaborador e baixar a ficha em PDF.",
  },
  {
    situacao: "Processo trabalhista",
    papel: "Provar a entrega com folha rasurada, sem data e sem o CA.",
    safety: "Anexar a ficha com data, CA e assinatura de cada entrega.",
  },
  {
    situacao: "Balcão do almoxarifado",
    papel: "Fila, caneta falhando e o \"assino depois\" que nunca acontece.",
    safety: "O trabalhador assina na tela e o estoque baixa sozinho.",
  },
];

/* Seis recursos, todos do mesmo tamanho. Oito cansava antes de vender. */
const RECURSOS_MODULO = [
  {
    icone: ShieldCheck,
    titulo: "Conferência do CA",
    descricao: "A entrega é recusada se o CA estiver vencido, e avisa 30 dias antes de vencer.",
  },
  {
    icone: Fingerprint,
    titulo: "Assinatura na tela",
    descricao: "O trabalhador assina com o dedo ou por reconhecimento facial, com data e hora.",
  },
  {
    icone: FileCheck2,
    titulo: "Ficha individual em PDF",
    descricao: "Todas as entregas do colaborador num documento, com o texto do art. 166 da CLT.",
  },
  {
    icone: QrCode,
    titulo: "Código para o fiscal conferir",
    descricao: "Quem está com a ficha na mão confere a entrega numa página pública, sem login.",
  },
  {
    icone: Boxes,
    titulo: "Estoque por unidade",
    descricao: "Saldo de cada obra ou filial, com aviso quando cai abaixo do mínimo.",
  },
  {
    icone: RotateCcw,
    titulo: "Troca e devolução",
    descricao: "Entrou, saiu, trocou: tudo no mesmo histórico do colaborador.",
  },
];

/*
 * Os três pilares: o que o fiscal confere numa entrega. Duas frases cada,
 * no máximo. O pilar 01 ficou meses mais fraco do que a página queria
 * porque o sistema guardava a validade do CA e não olhava para ela. Agora
 * olha e recusa a entrega — por isso a frase mudou.
 */
const PILARES = [
  {
    numero: "01",
    icone: ShieldCheck,
    titulo: "CA válido na data da entrega",
    texto:
      "O sistema confere a validade do CA e recusa a entrega se estiver vencido. Faltando 30 dias para vencer, avisa antes.",
  },
  {
    numero: "02",
    icone: Fingerprint,
    titulo: "Assinatura de quem recebeu",
    texto:
      "Quem recebeu, qual EPI, quantos e em que data. O trabalhador assina na tela e a entrega ganha um código de conferência.",
  },
  {
    numero: "03",
    icone: FileCheck2,
    titulo: "Ficha individual em PDF",
    texto:
      "Todas as entregas, trocas e devoluções do colaborador num documento só. Com o texto do art. 166 da CLT.",
  },
];

/*
 * ====== QUEM VENDE: PREENCHA AQUI ======
 *
 * Linha de identificação do rodapé e a seção "Quem está por trás". Cada
 * campo só aparece na página quando tem valor — nada é inventado. O
 * WhatsApp sai de CONTATO, em planosDeVenda.ts, para não haver dois
 * lugares com o mesmo número.
 */
const IDENTIFICACAO = {
  cnpj: "",
  cidade: "",
  whatsapp: CONTATO.whatsapp
    ? CONTATO.whatsapp.replace(/^55(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3")
    : "",
};

/*
 * ====== QUEM ESTÁ POR TRÁS: PREENCHA AQUI ======
 *
 * A seção inteira some enquanto `nome` estiver vazio. É o bloco que mais
 * vende numa página de um negócio pequeno: o comprador quer saber com
 * quem está falando. Mas não dá para escrever por você.
 *
 *   nome: "Ivan Júnior"
 *   titulo: "técnico de segurança do trabalho"
 *   anos: "12"
 *   cidade: "Juazeiro do Norte/CE"
 *   motivo: "cansei de correr atrás de ficha de EPI assinada antes de fiscalização"
 *   foto: importe a imagem e passe aqui; sem foto, a seção mostra só o texto
 */
const RESPONSAVEL = {
  nome: "",
  titulo: "",
  anos: "",
  cidade: "",
  motivo: "",
  foto: "" as string,
};

/*
 * ====== DEPOIMENTOS: PREENCHA AQUI ======
 *
 * Está vazio de propósito, e a seção inteira some da página enquanto
 * estiver assim. Depoimento inventado é o jeito mais rápido de perder a
 * venda — o comprador é técnico de segurança e conhece o mercado — e
 * ainda cria problema jurídico.
 *
 * Para publicar um, peça autorização ao cliente e preencha:
 *
 *   { texto: "...", nome: "...", cargo: "...", empresa: "..." }
 *
 * Um depoimento real vale mais que dez escritos por nós.
 */
const DEPOIMENTOS: {
  texto: string;
  nome: string;
  cargo: string;
  empresa: string;
}[] = [];

/* Só o que existe no sistema hoje; conferido antes de escrever. */
const SEGURANCA = [
  {
    icone: Building2,
    titulo: "Cada empresa vê só o que é dela",
    texto:
      "A separação é feita no banco de dados, não apenas na tela: mesmo um acesso indevido ao sistema não alcança os dados de outra empresa.",
  },
  {
    icone: UserCheck,
    titulo: "Acesso por perfil",
    texto:
      "Você define o que cada pessoa abre. O almoxarife da obra não precisa enxergar o que o RH enxerga.",
  },
  {
    icone: QrCode,
    titulo: "Conferência sem expor o sistema",
    texto:
      "O fiscal confere uma entrega pelo código impresso na ficha, numa página pública que mostra só aquela entrega — e nada mais.",
  },
  {
    icone: DatabaseBackup,
    titulo: "Backup automático",
    texto:
      "As informações são copiadas de forma automática e periódica, sem depender de alguém lembrar de fazer.",
  },
];

// Perguntas frequentes para quebra de objeções
const PERGUNTAS_FREQUENTES = [
  {
    pergunta: "A ficha de EPI digital tem validade jurídica perante o MTE e a Justiça do Trabalho?",
    resposta: "Sim. A própria NR-06 admite expressamente que o registro do fornecimento de EPI seja feito em livro, ficha OU sistema eletrônico, inclusive biométrico — desde que o sistema permita extrair relatórios e identificar o trabalhador e o equipamento entregue. É exatamente o que a ficha individual em PDF faz, com o número do CA, a data e a assinatura de cada entrega.",
  },
  {
    pergunta: "Como funciona a entrega em locais sem sinal de internet (modo offline)?",
    resposta: "O aplicativo mobile da SafetySoluções foi construído para o canteiro de obras e galpões industriais. O almoxarife faz a busca, seleciona o colaborador e coleta a assinatura na tela mesmo sem qualquer conexão. Ao retornar para uma área com Wi-Fi ou 4G, todas as entregas são sincronizadas automaticamente.",
  },
  {
    pergunta: "Preciso comprar equipamentos específicos ou leitores caros?",
    resposta: "Não. A SafetySoluções roda em qualquer smartphone, tablet ou computador comum já disponível na empresa. A assinatura é colhida pelo colaborador direto na tela touch com a ponta do dedo.",
  },
  {
    pergunta: "Vocês ajudam a cadastrar os colaboradores e os EPIs da minha empresa?",
    resposta: "Com certeza! Fazemos a importação das suas planilhas de colaboradores e do catálogo de EPIs junto com você na ativação da conta. Você não começa com o sistema vazio.",
  },
  {
    pergunta: "Há taxa de implantação ou contrato de fidelidade com multa?",
    resposta: "Nenhuma taxa de implantação e zero fidelidade contratual. Você utiliza o sistema com tranquilidade e só paga pelo número de colaboradores cadastrados.",
  },
  {
    pergunta: "Na prática, como é feita uma entrega de EPI?",
    resposta: "Você busca o colaborador pelo nome, CPF ou matrícula, escolhe o EPI e a quantidade, informa de qual unidade o material está saindo e passa o aparelho para o trabalhador assinar na tela. O saldo do estoque baixa na mesma hora e a entrega já entra na ficha dele.",
  },
  {
    pergunta: "Como é feita a conferência do CA?",
    resposta: "O CA é cadastrado uma vez por EPI, e o sistema busca os dados do certificado automaticamente a partir do número — fabricante, validade e proteção aprovada. Na hora de registrar a entrega, a validade é conferida contra a data de hoje: se estiver vencida, o sistema recusa a entrega e mostra qual equipamento está irregular. Faltando 30 dias ou menos para vencer, aparece um aviso para dar tempo de repor o estoque. O número do CA também fica gravado em cada entrega e sai impresso na ficha, que é onde o fiscal procura.",
  },
  {
    pergunta: "O colaborador assina como? Precisa de papel em algum momento?",
    resposta: "Ele assina com o dedo na tela do celular ou tablet, ou por reconhecimento facial com foto. A assinatura fica gravada na entrega com data e hora, e cada uma recebe um código de conferência. Em nenhum momento é preciso imprimir para colher assinatura.",
  },
  {
    pergunta: "Consigo baixar a ficha individual e consultar o histórico depois?",
    resposta: "Sim. A ficha de cada colaborador sai em PDF com todas as entregas, devoluções e trocas, o CA de cada equipamento e o texto do art. 166 da CLT. O histórico fica disponível na tela a qualquer momento, por colaborador, por EPI e por período.",
  },
  {
    pergunta: "O fiscal consegue conferir se a ficha é verdadeira?",
    resposta: "Consegue, e sem precisar de login. Cada entrega assinada leva um código impresso na ficha. Quem tiver o papel na mão digita esse código numa página pública do sistema e vê se aquela entrega existe mesmo — é a diferença entre um PDF qualquer e um documento conferível.",
  },
  {
    pergunta: "Tem controle de estoque? E se eu tiver várias obras ou filiais?",
    resposta: "Tem. O estoque é por unidade: você vê quanto cada obra ou filial tem de cada EPI, define um estoque mínimo e é avisado antes de faltar. As unidades também podem pedir material pelo próprio sistema. Não há limite de colaboradores nem de unidades.",
  },
  {
    pergunta: "Como funciona a contratação e qual plano atende a minha empresa?",
    resposta: "Hoje existe um plano único de Gestão de EPIs, cobrado por colaborador cadastrado por mês — sem taxa de implantação e sem fidelidade. Não há versão limitada: quem tem 20 colaboradores e quem tem 500 usam o mesmo sistema completo, pagando proporcionalmente. Use o simulador acima para ver o seu valor e chame no WhatsApp para começar.",
  },
];

export default function Planos() {
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = "Gestão e Ficha de EPIs — SafetySoluções";

    const meta = document.querySelector('meta[name="description"]');
    const descricaoAnterior = meta?.getAttribute("content") ?? null;
    meta?.setAttribute(
      "content",
      "Controle de entrega de EPI assinada pelo colaborador, com CA registrado e a ficha individual em PDF pronta para fiscalização da NR-06 e Art. 166 da CLT. Funciona 100% offline no celular.",
    );

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

  // Exemplo da primeira dobra
  const exemploDeTotal = precoFormatado(totalMensal(50, plano));

  // Simulador de vidas
  const [vidas, setVidas] = useState(50);
  const total = precoFormatado(totalMensal(vidas, plano));

  // FAQ acordeão
  const [faqAberto, setFaqAberto] = useState<number | null>(0);

  /**
   * Componente de Botão de Conversão (CTA)
   * Mantém estritamente o mesmo rótulo para satisfazer testes de consistência
   */
  const Cta = ({
    grande = false,
    variante = "default",
  }: {
    grande?: boolean;
    variante?: "default" | "outline";
  }) =>
    linkPlano ? (
      <Button
        size={grande ? "lg" : "default"}
        variant={variante}
        asChild
        className={`font-semibold transition-all shadow-sm hover:shadow-md ${
          variante === "default"
            ? "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
        } ${grande ? "px-6 py-6 text-base" : "px-4 py-2 text-sm"}`}
      >
        <a href={linkPlano} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
          {TEXTO_BOTAO_WHATSAPP} <ArrowRight className="h-4 w-4" />
        </a>
      </Button>
    ) : (
      <Button
        size={grande ? "lg" : "default"}
        variant={variante}
        asChild
        className={`font-semibold transition-all shadow-sm hover:shadow-md ${
          variante === "default"
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
        } ${grande ? "px-6 py-6 text-base" : "px-4 py-2 text-sm"}`}
      >
        <a href="#oferta" className="inline-flex items-center gap-2">
          {TEXTO_BOTAO_WHATSAPP} <ArrowRight className="h-4 w-4" />
        </a>
      </Button>
    );

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* ── BARRA SUPERIOR DE CONFORMIDADE JURÍDICA (Estilo OnSafety) ── */}
      <div className="border-b border-emerald-950/20 bg-slate-900 px-4 py-2.5 text-center text-xs font-medium text-slate-200 sm:text-[13px]">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
            NR-06 · CLT
          </span>
          <span>
            A NR-06 admite o registro da entrega de EPI por <strong>sistema eletrônico</strong>, no lugar do livro ou da ficha de papel.
          </span>
        </div>
      </div>

      {/* ── HEADER CORPORATIVO LIMPO & MODERNO ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="SafetySoluções"
              className="h-10 w-10 rounded-xl border border-slate-200/80 object-cover shadow-xs"
            />
            {/*
              * O nome cortava em telas estreitas. Agora ele começa menor e
              * cresce com a tela, e o subtítulo só aparece a partir de 420px.
              */}
            <div className="min-w-0 leading-tight">
              <span className="block truncate text-base font-extrabold tracking-tight text-slate-950 min-[420px]:text-lg">
                SafetySoluções
              </span>
              <p className="hidden text-[11px] font-semibold text-emerald-700 min-[420px]:block">
                Controle de EPI &amp; Ficha Digital
              </p>
            </div>
          </div>

          {/*
            * Seis itens, cada um numa linha só. Com nove e sem nowrap o menu
            * quebrava em duas ou três linhas no desktop e encavalava o logo.
            */}
          <nav className="hidden items-center gap-6 text-[13px] font-semibold text-slate-600 lg:flex">
            {[
              { href: "#comparativo", texto: "Por que digitalizar" },
              { href: "#sem-sinal", texto: "Offline" },
              { href: "#recursos", texto: "Recursos" },
              { href: "#oferta", texto: "Preços" },
              { href: "#faq", texto: "Dúvidas" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="whitespace-nowrap transition-colors hover:text-slate-950"
              >
                {item.texto}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 sm:inline-block"
            >
              Acessar sistema
            </Link>
            <Cta />
          </div>
        </div>
      </header>

      {/* ── 1. HERO SECTION INSTITUCIONAL (Inspirado no OnSafety) ── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-slate-50/80 via-white to-slate-50/40 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            
            {/* Texto da Proposta de Valor */}
            <div className="space-y-6 text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-1 text-xs font-semibold text-slate-700">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Controle de EPI e ficha digital</span>
              </div>

              <h1 className="max-w-[18ch] text-[1.75rem] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-[2.6rem]">
                Nenhum EPI com CA vencido sai do seu almoxarifado.
              </h1>

              <p className="max-w-[62ch] text-base leading-relaxed text-slate-600 sm:text-lg">
                O trabalhador assina no celular, a ficha sai em PDF pronta para o
                fiscal e o sistema funciona mesmo sem internet na obra.
              </p>

              <ul className="grid gap-2.5 pt-1 text-sm text-slate-700">
                {[
                  "Bloqueia a entrega se o CA estiver vencido e avisa 30 dias antes",
                  "Assinatura com o dedo na tela ou por reconhecimento facial",
                  "Funciona sem sinal no canteiro e sincroniza sozinho depois",
                  "Ficha individual em PDF em 10 segundos, com código para o fiscal conferir",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Bloco de Preço na Primeira Dobra */}
              {preco && (
                <div className="pt-2">
                  <a
                    href="#oferta"
                    data-testid="preco-primeira-dobra"
                    className="group flex w-full max-w-md items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-white p-3.5 shadow-sm transition-all hover:border-emerald-400 hover:shadow-md"
                  >
                    <div className="flex items-baseline gap-1.5">
                      <strong className="text-xl font-extrabold text-emerald-800">{preco}</strong>
                      <span className="text-xs font-semibold text-slate-500">{plano.unidade}</span>
                    </div>
                    <div className="text-right text-xs">
                      {exemploDeTotal && (
                        <div className="font-semibold text-slate-800">
                          Ex: 50 colaboradores = <strong>{exemploDeTotal}</strong>/mês
                        </div>
                      )}
                      <span className="font-bold text-emerald-700 group-hover:underline">
                        Simular valor da minha empresa →
                      </span>
                    </div>
                  </a>
                </div>
              )}

              <p className="max-w-[62ch] text-sm text-slate-600">
                Sem taxa de implantação. Sem fidelidade. A gente cadastra seus EPIs
                e colaboradores com você.
              </p>

              {/*
                * Sem botão aqui de propósito. São três na página — cabeçalho,
                * preços e fecho — e no celular o botão flutuante. O do
                * cabeçalho fica fixo na tela, então repetir aqui vira ruído.
                */}
            </div>

            {/*
              * O celular na frente, a ficha atrás.
              *
              * Celular na mão é o que o comprador reconhece como "isso roda
              * no meu almoxarifado". A ficha em PDF continua aparecendo,
              * menor e por trás, porque é ela que o fiscal pede — mas quem
              * decide a compra decide olhando a operação, não o documento.
              */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative pb-10 pl-4 pt-4 sm:pl-10">
                {/* Ficha em PDF, atrás */}
                <div className="absolute right-0 top-0 hidden w-[72%] rotate-2 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg sm:block">
                  <img
                    src={fichaExemplo}
                    alt="Ficha de EPI gerada pelo sistema, com as entregas assinadas e o número do CA de cada equipamento"
                    className="w-full object-contain"
                    loading="eager"
                  />
                </div>

                {/* Celular, na frente */}
                <div className="relative z-10 mx-auto w-[220px] rounded-[2rem] border-[7px] border-slate-900 bg-slate-900 shadow-2xl sm:mx-0 sm:w-[250px]">
                  <div className="overflow-hidden rounded-[1.5rem] bg-white">
                    <img
                      src={mobileEntregasReal}
                      alt="Tela de entregas de EPI no celular, com o CA, a situação e a data de cada entrega do colaborador"
                      className="w-full object-contain"
                      loading="eager"
                    />
                  </div>
                </div>

                <span
                  className="absolute bottom-2 left-4 z-20 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-900 shadow-sm sm:left-10"
                  style={{ backgroundColor: ALERTA }}
                >
                  <WifiOff className="h-3.5 w-3.5" /> Funciona sem sinal
                </span>
              </div>

              <p className="mt-2 text-center text-xs text-slate-600 sm:text-left">
                Telas do próprio sistema. Nomes e dados fictícios.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/*
        * ── OS TRÊS PILARES ──
        *
        * A página explicava muitos recursos e nenhum deles ficava na
        * cabeça. Estes três são o que o comprador precisa levar embora: é
        * o que ele vai ter de mostrar quando o fiscal chegar. O texto de
        * cada um diz só o que o sistema faz hoje.
        */}
      <section id="pilares" className="border-b border-slate-200 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Na hora da auditoria
            </span>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              O que o fiscal confere numa entrega de EPI
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Faltando uma das três, vale como entrega não feita.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PILARES.map((pilar) => {
              const Icone = pilar.icone;
              return (
                <div
                  key={pilar.numero}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60 p-7 transition-all hover:border-emerald-500/50 hover:bg-white hover:shadow-lg"
                >
                  <span className="absolute -right-3 -top-4 text-7xl font-extrabold text-slate-200/70 transition-colors group-hover:text-emerald-100">
                    {pilar.numero}
                  </span>
                  <div className="relative">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                      <Icone className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-slate-950">{pilar.titulo}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {pilar.texto}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 3. POR QUE ABANDONAR A FICHA DE PAPEL (Antes vs Depois) ── */}
      <section id="comparativo" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            Ficha de papel x ficha digital
          </h2>

          {/*
            * Tabela em vez de três cartões. A comparação é lado a lado por
            * natureza, e em cartão empilhado no celular o leitor perde de
            * vista o que está sendo comparado.
            */}
          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-xs uppercase tracking-wide text-slate-600">
                  <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
                  <th scope="col" className="px-4 py-3 font-semibold">No papel</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Na SafetySoluções</th>
                </tr>
              </thead>
              <tbody>
                {COMPARATIVO_OPERACIONAL.map((item) => (
                  <tr key={item.situacao} className="border-b border-slate-100 last:border-none align-top">
                    <th scope="row" className="px-4 py-4 font-semibold text-slate-950">
                      {item.situacao}
                    </th>
                    <td className="px-4 py-4 text-slate-600">{item.papel}</td>
                    <td className="px-4 py-4 font-medium text-slate-800">{item.safety}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 4. O APLICATIVO NO ATO DA ENTREGA (PRINT REAL 100% OFFLINE) ── */}
      <section id="sem-sinal" className="border-b border-slate-200 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            
            {/* O MOCKUP REAL DE CELULAR (SEM IA, COM O PRINT VERDADEIRO DO SISTEMA) */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-[340px]">
                {/* Efeito sutil de iluminação de fundo */}
                <div className="absolute -inset-4 rounded-[3.5rem] bg-gradient-to-tr from-emerald-500/15 via-orange-500/15 to-blue-500/15 blur-xl" />

                {/* Moldura de Smartphone Premium */}
                <div className="relative rounded-[3rem] border-[8px] border-slate-900 bg-slate-950 p-2.5 shadow-2xl shadow-slate-900/30">
                  {/* Speaker / Notch no topo */}
                  <div className="absolute left-1/2 top-4 z-20 h-4 w-24 -translate-x-1/2 rounded-full bg-slate-900" />

                  {/* Tela interna com o print autêntico */}
                  <div className="relative overflow-hidden rounded-[2.25rem] border border-slate-800 bg-white">
                    <img
                      src={mobileEntregasReal}
                      alt="Tela do aplicativo mobile SafetySoluções exibindo a lista de entregas de EPI com CA, assinatura e botão de Ficha individual"
                      className="w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>

                {/*
                  * Aviso de dado fictício.
                  *
                  * O print é da tela de verdade do sistema — é esse o valor
                  * dele aqui. Mas ele saiu de uma conta em uso, com nome de
                  * colaborador e de empresa cliente. Dado pessoal de terceiro
                  * não entra em página pública, ainda mais uma feita para
                  * circular no WhatsApp: os nomes foram trocados por
                  * fictícios, e a página diz isso.
                  */}
                <p className="mt-6 text-center text-xs text-slate-600">
                  Tela real do sistema, com os nomes trocados por fictícios.
                </p>

                {/* Badge flutuante sobre a imagem */}
                <div className="absolute -bottom-4 right-0 rounded-xl border bg-white p-3 shadow-lg" style={{ borderColor: ALERTA }}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                      <WifiOff className="h-4 w-4" />
                    </div>
                    <div className="leading-tight text-left">
                      <p className="text-xs font-bold text-slate-900">Sem sinal, continua</p>
                      <p className="text-[10px] font-medium text-slate-600">Sincroniza automaticamente</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Explicação da Operação no Canteiro de Obras */}
            <div className="space-y-6 text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-900">
                <WifiOff className="h-3.5 w-3.5" />
                <span>Funciona offline, sem sinal de internet</span>
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                Sem sinal? A entrega continua.
              </h2>

              <p className="max-w-[62ch] text-sm leading-relaxed text-slate-600 sm:text-base">
                No subsolo, no galpão ou longe da obra, o almoxarife registra a
                entrega e colhe a assinatura normalmente. Quando o celular pega
                Wi-Fi ou 4G, tudo sobe sozinho.
              </p>

              {/* 3 passos da operação mobile */}
              <div className="space-y-4 pt-1">
                <div className="flex items-start gap-3.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-xs">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Assinatura com o dedo na tela</h3>
                    <p className="text-xs leading-relaxed text-slate-600 mt-0.5">
                      O trabalhador assina na tela do celular no momento em que recebe o EPI.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-xs">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">CA registrado na ficha</h3>
                    <p className="text-xs leading-relaxed text-slate-600 mt-0.5">
                      O número do CA entra na entrega e sai impresso na ficha do colaborador.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-xs">
                    3
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Sincronização em segundo plano</h3>
                    <p className="text-xs leading-relaxed text-slate-600 mt-0.5">
                      Cada entrega fica guardada no aparelho e sobe sozinha quando a internet volta.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="telas" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              O sistema por dentro
            </span>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Estas são as telas, não um desenho
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Todas as imagens desta página saem do próprio sistema. Onde aparece
              nome de pessoa ou de empresa, o dado é fictício.
            </p>
          </div>

          <div className="mt-12 space-y-12">
            {/* Estoque com CA e validade */}
            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <figure className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg">
                <img
                  src={telaEstoque}
                  alt="Tela de cadastro de EPIs do sistema, com nome, número do CA, categoria, fabricante, validade, valor e saldo em estoque de cada equipamento"
                  className="w-full object-contain"
                  loading="lazy"
                />
              </figure>
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  Cada EPI com CA, validade e saldo
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  O cadastro guarda o número do CA, a validade, o fabricante e
                  quanto ainda tem em estoque. Quando o saldo cai abaixo do mínimo
                  que você definiu, o número aparece em vermelho — antes de faltar
                  no balcão.
                </p>
                <p className="mt-3 text-xs font-medium text-slate-500">
                  Equipamentos e valores fictícios.
                </p>
              </div>
            </div>

            {/* Conferência pública */}
            <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
              <div className="lg:order-2">
                <h3 className="text-lg font-bold text-slate-950">
                  O fiscal confere sem pedir login para ninguém
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Cada entrega assinada leva um código impresso na ficha. Quem tem
                  o papel na mão digita o código nesta página e vê se aquela
                  entrega existe mesmo. É o que separa um PDF qualquer de um
                  documento conferível.
                </p>
                <p className="mt-3 text-xs font-medium text-slate-500">
                  Página pública do sistema, no ar agora.
                </p>
              </div>
              <figure className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg lg:order-1">
                <img
                  src={telaConferencia}
                  alt="Página pública de verificação de ficha de EPI, onde se digita o código impresso embaixo da assinatura para conferir a entrega"
                  className="w-full object-contain"
                  loading="lazy"
                />
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. RECURSOS DO MÓDULO (GRID COMPLETO ESTILO ONSAFETY) ── */}
      <section id="recursos" className="border-b border-slate-200 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Tecnologia para SST e Almoxarifado
            </span>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Recursos completos para a gestão de EPI da sua empresa
            </h2>
            <p className="mt-3 text-sm text-slate-600 sm:text-base">
              Desenvolvido para atender tanto quem faz a entrega no balcão quanto quem defende a empresa em auditorias:
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {RECURSOS_MODULO.map((rec) => {
              const Icone = rec.icone;
              return (
                <div
                  key={rec.titulo}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 transition-all hover:border-emerald-500/50 hover:bg-white hover:shadow-md"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <Icone className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-950">{rec.titulo}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{rec.descricao}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 7. COMO FUNCIONA (FLUXO EM 4 PASSOS) ── */}
      <section id="como-funciona" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Fluxo Simples e Rápido
            </span>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Do balcão à auditoria em 4 etapas
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              A rotina diária no almoxarifado fica mais rápida e 100% registrada:
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                passo: "01",
                titulo: "Identifique o Colaborador",
                texto: "Busca rápida pelo nome ou CPF na tela do celular, tablet ou computador.",
              },
              {
                passo: "02",
                titulo: "Selecione o EPI e CA",
                texto: "Equipamento com o número do CA já cadastrado no estoque da obra.",
              },
              {
                passo: "03",
                titulo: "Assinatura na Hora",
                texto: "O trabalhador assina com o dedo na tela, com ou sem internet.",
              },
              {
                passo: "04",
                titulo: "Ficha em PDF Pronta",
                texto: "Histórico vitalício arquivado e pronto para baixar ou imprimir quando o fiscal solicitar.",
              },
            ].map((p) => (
              <div key={p.passo} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <span className="font-mono text-2xl font-extrabold text-emerald-700">{p.passo}</span>
                <h3 className="mt-2 text-sm font-bold text-slate-900">{p.titulo}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/*
        * ── QUEM ESTÁ POR TRÁS ──
        *
        * Num negócio pequeno, saber com quem se está falando vale mais que
        * mais um bloco de recursos. A seção só existe quando RESPONSAVEL
        * tem nome: não dá para escrever isso por quem vende.
        */}
      {RESPONSAVEL.nome && (
        <section id="quem-somos" className="border-b border-slate-200 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Quem está por trás
            </h2>
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
              {RESPONSAVEL.foto && (
                <img
                  src={RESPONSAVEL.foto}
                  alt={RESPONSAVEL.nome}
                  className="h-28 w-28 shrink-0 rounded-2xl border border-slate-200 object-cover"
                  loading="lazy"
                />
              )}
              <p className="max-w-[62ch] text-base leading-relaxed text-slate-700">
                Sou {RESPONSAVEL.nome}
                {RESPONSAVEL.titulo && `, ${RESPONSAVEL.titulo}`}
                {RESPONSAVEL.anos && ` há ${RESPONSAVEL.anos} anos`}
                {RESPONSAVEL.cidade && ` em ${RESPONSAVEL.cidade}`}
                . Criei a SafetySoluções porque {RESPONSAVEL.motivo}.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── 8. OFERTA & SIMULADOR DE COLABORADORES (id="oferta") ── */}
      <section id="oferta" className="border-b border-slate-200 bg-slate-100/70 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {/* Fundo escuro: depois do topo, é aqui que o olho tem de parar. */}
          <div className="relative rounded-3xl p-7 shadow-2xl sm:p-10" style={{ backgroundColor: "#111827" }}>
            <div>
              <h2 className="text-2xl font-extrabold text-white sm:text-3xl">{plano.nome}</h2>
              <p className="mt-1 text-sm text-slate-300">{plano.publico}</p>
            </div>

            {/* Preço formatado */}
            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              {preco ? (
                <>
                  {precoDe && (
                    <span className="text-lg text-slate-500 line-through">{precoDe}</span>
                  )}
                  <span className="text-5xl font-extrabold tracking-tight text-white">
                    {preco}
                  </span>
                  <span className="text-sm font-semibold text-slate-300">{plano.unidade}</span>
                  {desconto != null && (
                    <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-extrabold text-emerald-800">
                      −{desconto}%
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-3xl font-extrabold text-white">Sob consulta</span>
                  <span className="text-sm text-slate-300">{plano.unidade}</span>
                </>
              )}
            </div>

            {/* Simulador de Vidas (Requisito estrito de CRO e testes) */}
            {semPrecos ? (
              <p className="mt-5 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-xs leading-relaxed text-slate-300">
                O valor é fechado no contato: ele muda conforme o número de colaboradores e de unidades atendidas.
              </p>
            ) : (
              <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/60 p-5 sm:p-6">
                <label
                  htmlFor="vidas"
                  className="block text-sm font-bold text-white"
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
                    className="h-11 w-28 rounded-xl border border-slate-600 bg-slate-900 px-3 text-lg font-bold text-white shadow-xs focus:border-emerald-500 focus:outline-hidden"
                  />
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-slate-300">fica</span>
                    <span
                      data-testid="total-simulado"
                      aria-live="polite"
                      className="text-3xl font-extrabold tracking-tight text-emerald-700"
                    >
                      {total ?? "—"}
                    </span>
                    <span className="text-sm text-slate-300 font-medium">
                      {total ? "por mês" : "informe de 1 a 100.000"}
                    </span>
                  </div>
                </div>

                {/* Atalhos rápidos por porte */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Selecione rápido:</span>
                  {[25, 50, 100, 250, 500].map((qtd) => (
                    <button
                      key={qtd}
                      type="button"
                      onClick={() => setVidas(qtd)}
                      className={`rounded-lg border px-3 py-1 text-xs font-bold transition-all ${
                        vidas === qtd
                          ? "border-emerald-700 bg-emerald-700 text-white shadow-xs"
                          : "border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-700"
                      }`}
                    >
                      {qtd} colaboradores
                    </button>
                  ))}
                </div>

                <p className="mt-3 text-xs text-slate-400 font-medium">
                  Sem taxa de implantação, sem contrato de fidelidade e sem limite de usuários ou unidades.
                </p>
              </div>
            )}

            {/* O que está incluso */}
            <div className="mt-7 border-t border-slate-700 pt-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tudo incluso no sistema:
              </span>
              <ul className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
                {plano.inclui.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs font-medium text-slate-800 sm:text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 stroke-[3]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ações */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Cta grande />
              {CONTATO.email && (
                <Button size="lg" variant="outline" asChild className="border-slate-300 font-semibold px-6 py-6 text-base">
                  <a href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a>
                </Button>
              )}
            </div>

            <p className="mt-4 text-xs text-slate-400 font-medium">
              Nossa equipe cadastra seus EPIs e seus colaboradores junto com você na implantação.
            </p>
          </div>
        </div>
      </section>

      {/*
        * ── SEGURANÇA DOS DADOS ──
        *
        * Quem compra para a empresa pergunta isso antes de assinar, e a
        * página não respondia. Cada item aqui é coisa que já existe no
        * sistema — separação por empresa feita no banco, perfis de acesso
        * por módulo, conferência pública por código e backup automático.
        * Nada sobre localização de servidor, que eu não tenho como
        * afirmar.
        */}
      <section id="seguranca" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-center lg:gap-16">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Segurança e proteção de dados
              </span>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                Dado de colaborador é dado pessoal.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                A ficha de EPI guarda nome, função, assinatura e, às vezes, a foto
                do trabalhador. O sistema foi montado tratando isso como o que é:
                informação que precisa ficar guardada e separada.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {SEGURANCA.map((item) => {
                const Icone = item.icone;
                return (
                  <div
                    key={item.titulo}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
                  >
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                      <Icone className="h-4 w-4" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-slate-950">{item.titulo}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      {item.texto}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/*
        * ── O QUE OS CLIENTES DIZEM ──
        *
        * A seção só existe quando há depoimento de verdade em
        * DEPOIMENTOS. Página de venda sem prova social é mais fraca —
        * mas página com prova social inventada é pior.
        */}
      {DEPOIMENTOS.length > 0 && (
        <section id="depoimentos" className="border-b border-slate-200 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Quem já usa
              </span>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                O que dizem os técnicos que fazem a entrega
              </h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {DEPOIMENTOS.map((dep) => (
                <figure
                  key={`${dep.nome}-${dep.empresa}`}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/60 p-6"
                >
                  <blockquote className="flex-1 text-sm leading-relaxed text-slate-700">
                    “{dep.texto}”
                  </blockquote>
                  <figcaption className="mt-5 border-t border-slate-200 pt-4">
                    <p className="text-sm font-bold text-slate-950">{dep.nome}</p>
                    <p className="text-xs text-slate-600">
                      {dep.cargo} · {dep.empresa}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 9. PERGUNTAS FREQUENTES (FAQ) ── */}
      <section id="faq" className="border-b border-slate-200 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Esclareça suas dúvidas
            </span>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Perguntas Frequentes sobre o Controle de EPI
            </h2>
          </div>

          <div className="mt-10 space-y-4" data-testid="lista-faq">
            {PERGUNTAS_FREQUENTES.map((faq, idx) => {
              const aberto = faqAberto === idx;
              return (
                <div
                  key={faq.pergunta}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setFaqAberto(aberto ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left font-bold text-slate-950 sm:text-base"
                  >
                    <span>{faq.pergunta}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ${
                        aberto ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {aberto && (
                    <div className="border-t border-slate-200/60 px-5 pb-5 pt-3 text-xs leading-relaxed text-slate-600 sm:text-sm">
                      {faq.resposta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-900 py-16 text-center text-white sm:py-24">
        <div className="mx-auto max-w-3xl space-y-4 px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
            Quer ver funcionando com os seus EPIs?
          </h2>
          <p className="mx-auto max-w-[62ch] text-sm leading-relaxed text-slate-300 sm:text-base">
            Me chama no WhatsApp. Em 15 minutos eu te mostro uma entrega real, do
            cadastro do CA até a ficha em PDF.
          </p>
          <div className="flex justify-center pt-4">
            <Cta grande />
          </div>
        </div>
      </section>

      {/* ── RODAPÉ CORPORATIVO ── */}
      <footer className="bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 text-xs text-slate-600 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="SafetySoluções" className="h-7 w-7 rounded-lg border border-slate-200 object-cover" />
            <div>
              <p className="font-bold text-slate-800">SafetySoluções — Gestão de EPIs</p>
              {/*
                * Identificação de quem vende. Cada pedaço só aparece quando
                * existe de verdade em IDENTIFICACAO: página comercial com CNPJ
                * inventado é pior que página sem CNPJ.
                */}
              <p className="text-[11px] text-slate-600">
                {["SafetySoluções",
                  IDENTIFICACAO.cnpj && `CNPJ ${IDENTIFICACAO.cnpj}`,
                  IDENTIFICACAO.cidade,
                  IDENTIFICACAO.whatsapp && `WhatsApp ${IDENTIFICACAO.whatsapp}`,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex gap-6 font-medium">
            <Link to="/termos" className="hover:text-slate-900">Termos de Uso</Link>
            <Link to="/privacidade" className="hover:text-slate-900">Privacidade</Link>
            <Link to="/login" className="hover:text-slate-900">Acessar Sistema</Link>
          </div>
        </div>
      </footer>

      {/*
        * Botão flutuante no celular, no lugar da barra fixa.
        *
        * A barra ocupava uma faixa inteira da tela o tempo todo e repetia o
        * preço que já está na oferta. O botão redondo fica ao alcance do
        * polegar sem comer área de leitura.
        */}
      {linkPlano && (
        <a
          href={linkPlano}
          target="_blank"
          rel="noreferrer"
          aria-label={TEXTO_BOTAO_WHATSAPP}
          className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl transition-colors hover:bg-emerald-700 sm:hidden"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
    </div>
  );
}

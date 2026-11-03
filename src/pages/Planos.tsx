import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Check, ShieldCheck, Fingerprint, QrCode, PackageSearch, AlertTriangle,
  FileCheck2, ArrowRight, RotateCcw, BarChart3, Boxes,
  CheckCircle2, XCircle, ChevronDown, Building2, UserCheck, DatabaseBackup, Smartphone, WifiOff, FileText,
  Clock, ShieldAlert, Award, HelpCircle
} from "lucide-react";
import logo from "@/assets/logo-episafety.png";
import fichaExemplo from "/marca/ficha-epi-exemplo.png";
import mobileEntregasReal from "/marca/mobile-entregas-real.png";
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

// Casos reais de confronto operacional (Antes vs Depois)
const COMPARATIVO_OPERACIONAL = [
  {
    titulo: "Na Fiscalização do Trabalho",
    papel: "Horas ou dias revirando caixas de arquivo morto, pastas empoeiradas e fichas rasgadas. Risco iminente de auto de infração se faltar uma folha.",
    safety: "Busca instantânea por colaborador: você baixa a ficha completa em PDF em 10 segundos, com histórico de entregas e assinaturas digitais.",
  },
  {
    titulo: "Em Reclamações Trabalhistas",
    papel: "Fichas com assinaturas ausentes, ilegíveis ou contestadas pelo colaborador. Dificuldade de comprovar o CA e a periodicidade das trocas.",
    safety: "Documento digital robusto com data, hora, texto legal do Art. 166 da CLT e o registro do CA impresso em cada equipamento entregue.",
  },
  {
    titulo: "No Balcão do Almoxarifado",
    papel: "Filas no turno da manhã, caneta falhando, folhas molhadas de suor ou graxa e colaboradores saindo com a promessa de 'assinar depois'.",
    safety: "O almoxarife seleciona o colaborador no celular ou tablet, entrega o EPI com CA cadastrado e coleta a assinatura na tela em menos de 1 minuto.",
  },
];

// As dores reais do uso de fichas manuais
const DORES_DO_PAPEL = [
  {
    titulo: "Fichas perdidas no arquivo morto",
    descricao: "Em obras e plantas industriais, o papel rasga, molha e se extravia. Quando a perícia solicita o histórico de 2 anos atrás, ninguém encontra.",
  },
  {
    titulo: "Colaborador recebe e não assina",
    descricao: "Na pressa do início da jornada, o funcionário retira a luva e promete assinar depois. A empresa fica descoberta perante a lei.",
  },
  {
    titulo: "Desalinhamento entre compra e entrega",
    descricao: "Divergência crítica entre as notas fiscais do financeiro, o estoque físico do almoxarifado e o que realmente foi entregue na ponta.",
  },
  {
    titulo: "Desespero às vésperas de auditorias",
    descricao: "Técnicos de segurança e RH perdendo fins de semana para tentar recolher assinaturas retroativas antes da chegada do auditor.",
  },
  {
    titulo: "Falta de controle de trocas e devoluções",
    descricao: "Sem histórico individual de vida útil: não se sabe se o colaborador gasta um EPI por semana ou por mês, nem se devolveu o item anterior.",
  },
  {
    titulo: "Fragilidade jurídica em litígios",
    descricao: "Folhas sem padrão legal ou com emendas são facilmente impugnadas por advogados trabalhistas em pedidos de adicionais de insalubridade.",
  },
];

// Recursos completos da plataforma (Grid estilo OnSafety)
const RECURSOS_MODULO = [
  {
    icone: PackageSearch,
    titulo: "Cadastro de EPI e Registro de CA",
    descricao: "Cadastro do Certificado de Aprovação, fabricante, validade e proteção aprovada de cada equipamento para sair impresso na ficha.",
  },
  {
    icone: Fingerprint,
    titulo: "Assinatura Digital na Tela",
    descricao: "O colaborador assina com o dedo diretamente no celular ou tablet, registrando data, hora e código de conferência.",
  },
  {
    icone: WifiOff,
    titulo: "Operação 100% Offline no Mobile",
    descricao: "Realize entregas em canteiros remotos, galpões ou subsolos sem sinal de internet. Os dados sobem sozinhos quando reconectar.",
  },
  {
    icone: FileCheck2,
    titulo: "Ficha Individual em PDF (NR-06)",
    descricao: "Geração instantânea da Ficha de EPI com o termo de compromisso do Art. 166 da CLT e o histórico de cada item recebido.",
  },
  {
    icone: Boxes,
    titulo: "Controle de Estoque por Obra",
    descricao: "Baixa automática do saldo do almoxarifado a cada entrega realizada, com monitoramento de estoque mínimo.",
  },
  {
    icone: RotateCcw,
    titulo: "Gestão de Troca e Devolução",
    descricao: "Registre quando o equipamento foi substituído por desgaste ou quebra, mantendo a rastreabilidade completa do ciclo de vida.",
  },
  {
    icone: QrCode,
    titulo: "Código de Conferência sem Login",
    descricao: "A fiscalização ou perito pode verificar a autenticidade do documento impresso através do código validador do sistema.",
  },
  {
    icone: BarChart3,
    titulo: "Relatórios de Consumo e Custos",
    descricao: "Indicadores claros de consumo de EPIs por colaborador, função, setor ou unidade operacional para apoiar o setor de compras.",
  },
];

/*
 * Os três pilares. O texto de cada um descreve o que o sistema faz hoje:
 * o CA é cadastrado, gravado na entrega e impresso na ficha — ele não é
 * conferido automaticamente contra a data no momento da entrega, e a
 * página não pode dizer que é.
 */
const PILARES = [
  {
    numero: "01",
    icone: ShieldCheck,
    titulo: "O CA registrado em cada entrega",
    texto:
      "Você cadastra o EPI uma vez e o sistema busca os dados do certificado pelo número do CA — fabricante, validade e proteção aprovada. A partir daí o CA acompanha toda entrega daquele equipamento e sai impresso na ficha.",
    semIsso: "Sem o CA no registro, a entrega não prova proteção adequada.",
  },
  {
    numero: "02",
    icone: Fingerprint,
    titulo: "A assinatura de quem recebeu",
    texto:
      "Quem recebeu, qual equipamento, quantas unidades e em que data. O colaborador assina com o dedo na tela ou por reconhecimento facial, e cada entrega ganha um código de conferência próprio.",
    semIsso: "Sem assinatura, a empresa não tem como provar a entrega.",
  },
  {
    numero: "03",
    icone: FileCheck2,
    titulo: "A ficha individual em PDF",
    texto:
      "Todas as entregas, trocas e devoluções do colaborador num documento só, com o texto do art. 166 da CLT e o código que permite conferir cada assinatura sem login.",
    semIsso: "Sem a ficha pronta, a auditoria vira corrida contra o relógio.",
  },
];

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
    pergunta: "Como o CA do equipamento entra no registro?",
    resposta: "O CA é cadastrado uma vez por EPI — e o sistema busca os dados do certificado automaticamente a partir do número, preenchendo fabricante, validade e proteção aprovada. A partir daí, o número do CA fica gravado em cada entrega daquele equipamento e sai impresso na ficha do colaborador, que é onde o fiscal procura.",
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
            Em conformidade com a <strong>Portaria MTP n° 2.175/2022</strong> e o <strong>Art. 166 da CLT</strong>: Ficha de EPI eletrônica com validade jurídica comprovada.
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
            <div className="leading-tight">
              <span className="text-lg font-extrabold tracking-tight text-slate-950">SafetySoluções</span>
              <p className="text-[11px] font-semibold text-emerald-700">Controle de EPI & Ficha Digital</p>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-[13px] font-semibold text-slate-600 md:flex">
            <a href="#comparativo" className="transition-colors hover:text-slate-950">Por que Digitalizar</a>
            <a href="#mobile-offline" className="transition-colors hover:text-slate-950">App 100% Offline</a>
            <a href="#pilares" className="transition-colors hover:text-slate-950">Os 3 Pilares</a>
            <a href="#recursos" className="transition-colors hover:text-slate-950">Recursos</a>
            <a href="#como-funciona" className="transition-colors hover:text-slate-950">Como Funciona</a>
            <a href="#oferta" className="transition-colors hover:text-slate-950">Preços</a>
            <a href="#seguranca" className="transition-colors hover:text-slate-950">Segurança</a>
            <a href="#faq" className="transition-colors hover:text-slate-950">Dúvidas</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden text-xs font-bold text-slate-700 hover:text-slate-950 sm:inline-block px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Acessar Sistema
            </Link>
            <Cta />
          </div>
        </div>
      </header>

      {/* ── 1. HERO SECTION INSTITUCIONAL (Inspirado no OnSafety) ── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-slate-50/80 via-white to-slate-50/40 py-14 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            
            {/* Texto da Proposta de Valor */}
            <div className="space-y-6 text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800 shadow-xs">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Módulo Especializado · Controle de EPI & Ficha Digital</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.85rem] lg:leading-[1.14]">
                Torne seu controle de EPI mais eficiente.
                <span className="mt-2 block text-emerald-700">Elimine o papel e evite passivos trabalhistas.</span>
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Gerencie a entrega, troca e devolução de EPIs com <strong>assinatura na tela</strong>,
                registro de <strong>CA de cada equipamento</strong> e ficha individual em PDF pronta para
                apresentar ao fiscal do Ministério do Trabalho.
              </p>

              {/* Lista de destaques com ícones verdes */}
              <div className="grid gap-2.5 pt-1 text-xs font-medium text-slate-700 sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span><strong>Ficha de EPI digitalizada</strong> sempre acessível e vitalícia por colaborador</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span><strong>Assinatura digital na hora</strong> pelo trabalhador direto na tela do celular</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span><strong>Funciona 100% offline</strong> no canteiro de obras, galpões e subsolos</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span><strong>Baixa automática no estoque</strong> da obra e controle de saldo em tempo real</span>
                </div>
              </div>

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

              {/* Botões de Ação */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Cta grande />
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-slate-300 bg-white font-semibold text-slate-800 shadow-xs hover:bg-slate-50 px-6 py-6 text-base"
                >
                  <a href="#mobile-offline" className="inline-flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-slate-500" /> Ver App no Canteiro
                  </a>
                </Button>
              </div>

              {/* Garantias comerciais */}
              <div className="border-t border-slate-200/80 pt-4 text-xs text-slate-500">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-medium">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Check className="h-4 w-4 text-emerald-600 stroke-[3]" /> Sem taxa de implantação
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Check className="h-4 w-4 text-emerald-600 stroke-[3]" /> Sem contrato de fidelidade
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Check className="h-4 w-4 text-emerald-600 stroke-[3]" /> Importamos seus colaboradores com você
                  </span>
                </div>
              </div>
            </div>

            {/* Imagem Oficial da Ficha de EPI (Validação Legal) */}
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <div className="relative rounded-2xl border border-slate-300/80 bg-slate-900 p-3.5 shadow-2xl shadow-slate-300/40">
                {/* Header da moldura de documento */}
                <div className="flex items-center justify-between border-b border-slate-800 px-2 pb-2.5 text-slate-300">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500/80" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-xs text-slate-400">ficha_individual_epi.pdf</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                    <Award className="h-3.5 w-3.5" /> Ficha Pronta para Auditoria
                  </span>
                </div>

                {/* Pré-visualização da Ficha Real */}
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-700 bg-white">
                  <img
                    src={fichaExemplo}
                    alt="Ficha de EPI gerada pelo sistema, com as entregas assinadas e o número do CA de cada equipamento"
                    className="w-full object-contain"
                    loading="eager"
                  />
                </div>
              </div>

              {/* Legenda obrigatória de transparência */}
              <p className="mt-3 text-center text-xs text-slate-500 font-medium">
                Ficha de EPI gerada pelo sistema, com as entregas assinadas e o número do CA de cada equipamento. Dados fictícios.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. BARRA DE INDICADORES / PROVA SOCIAL CORPORATIVA ── */}
      <section className="border-b border-slate-200 bg-slate-900 py-10 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4 md:gap-8">
            <div className="border-r border-slate-800 last:border-none">
              <p className="text-3xl font-extrabold text-emerald-400 sm:text-4xl">100%</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Conformidade com a NR-06
              </p>
            </div>
            <div className="border-r border-slate-800 last:border-none">
              <p className="text-3xl font-extrabold text-white sm:text-4xl">0</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Fichas de Papel Perdidas
              </p>
            </div>
            <div className="border-r border-slate-800 last:border-none">
              <p className="text-3xl font-extrabold text-emerald-400 sm:text-4xl">Offline</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Entrega sem Sinal de Internet
              </p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-white sm:text-4xl">10 seg</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Para Baixar a Ficha em PDF
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
              O que o fiscal pede
            </span>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Três coisas sustentam a entrega de um EPI
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Faltando qualquer uma delas, para a fiscalização e para a Justiça do
              Trabalho é como se o equipamento não tivesse sido entregue.
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
                    <p className="mt-4 border-t border-slate-200 pt-3 text-xs font-semibold text-emerald-700">
                      {pilar.semIsso}
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
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Controle Digital vs Ficha de Papel
            </span>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
              Como sua empresa responde quando a auditoria solicita as fichas?
            </h2>
            <p className="mt-3 text-sm text-slate-600 sm:text-base">
              A diferença concreta entre continuar dependendo de pastas físicas ou adotar o registro eletrônico da SafetySoluções:
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {COMPARATIVO_OPERACIONAL.map((item) => (
              <div
                key={item.titulo}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md"
              >
                <div>
                  <span className="inline-flex rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-900">
                    {item.titulo}
                  </span>

                  <div className="mt-5 space-y-4 text-xs">
                    {/* Lado Papel */}
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-slate-800">
                      <div className="flex items-center gap-1.5 font-bold text-red-700">
                        <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                        <span>Com Ficha de Papel:</span>
                      </div>
                      <p className="mt-1.5 leading-relaxed text-slate-600">
                        {item.papel}
                      </p>
                    </div>

                    {/* Lado Safety */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-slate-800">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>Com SafetySoluções:</span>
                      </div>
                      <p className="mt-1.5 leading-relaxed text-slate-700">
                        {item.safety}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. O APLICATIVO NO ATO DA ENTREGA (PRINT REAL 100% OFFLINE) ── */}
      <section id="mobile-offline" className="border-b border-slate-200 bg-white py-16 sm:py-24">
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
                <p className="mt-6 text-center text-xs text-slate-500">
                  Tela real do sistema, com os nomes trocados por fictícios.
                </p>

                {/* Badge flutuante sobre a imagem */}
                <div className="absolute -bottom-4 right-0 rounded-xl border border-emerald-300 bg-white p-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                      <WifiOff className="h-4 w-4" />
                    </div>
                    <div className="leading-tight text-left">
                      <p className="text-xs font-bold text-slate-900">Modo Offline Ativo</p>
                      <p className="text-[10px] text-slate-500 font-medium">Sincroniza automaticamente</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Explicação da Operação no Canteiro de Obras */}
            <div className="space-y-6 text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-900">
                <WifiOff className="h-3.5 w-3.5" />
                <span>Funciona 100% Offline (Sem Sinal de Internet)</span>
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                No canteiro de obras, no galpão ou no subsolo: a entrega não para.
              </h2>

              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                A internet caiu ou você está entregando materiais em uma área remota da obra?
                O almoxarife continua registrando a entrega e colhendo a assinatura do trabalhador
                com o dedo na tela normalmente.
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
                      O colaborador assina diretamente na tela do celular no ato do recebimento do equipamento.
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
                      O número do Certificado de Aprovação e a validade cadastrada do equipamento saem impressos na ficha individual.
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
                      Assim que o aparelho detecta sinal de Wi-Fi ou 4G, todas as entregas e assinaturas sobem sozinhas para a nuvem.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Cta />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. AS 6 DORES DO PAPEL QUE CUSTAM CARO ── */}
      <section className="border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              Risco Operacional & Passivo Trabalhista
            </span>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Seis pontos críticos que custam caro na auditoria
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              A rotina comum de fichas manuais esconde falhas graves de fiscalização:
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DORES_DO_PAPEL.map((dor) => (
              <div
                key={dor.titulo}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900">{dor.titulo}</h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {dor.descricao}
                </p>
              </div>
            ))}
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
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
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
      <section id="como-funciona" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
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
                texto: "O trabalhador assina direto com o dedo na tela, online ou 100% offline.",
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

      {/* ── 8. OFERTA & SIMULADOR DE COLABORADORES (id="oferta") ── */}
      <section id="oferta" className="border-b border-slate-200 bg-slate-100/70 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="relative rounded-3xl border-2 border-emerald-600 bg-white p-7 shadow-xl sm:p-10">
            {/* Tag de destaque */}
            <span className="absolute -top-3.5 left-8 rounded-full bg-emerald-700 px-4 py-1 text-xs font-bold text-white shadow-sm">
              Plano Completo
            </span>

            <div>
              <h2 className="text-2xl font-extrabold text-slate-950 sm:text-3xl">{plano.nome}</h2>
              <p className="mt-1 text-sm text-slate-600">{plano.publico}</p>
            </div>

            {/* Preço formatado */}
            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              {preco ? (
                <>
                  {precoDe && (
                    <span className="text-lg text-slate-400 line-through">{precoDe}</span>
                  )}
                  <span className="text-4xl font-extrabold tracking-tight text-slate-950">
                    {preco}
                  </span>
                  <span className="text-sm font-semibold text-slate-600">{plano.unidade}</span>
                  {desconto != null && (
                    <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-extrabold text-emerald-800">
                      −{desconto}%
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-3xl font-extrabold text-slate-950">Sob consulta</span>
                  <span className="text-sm text-slate-600">{plano.unidade}</span>
                </>
              )}
            </div>

            {/* Simulador de Vidas (Requisito estrito de CRO e testes) */}
            {semPrecos ? (
              <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                O valor é fechado no contato: ele muda conforme o número de colaboradores e de unidades atendidas.
              </p>
            ) : (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6">
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
                    className="h-11 w-28 rounded-xl border border-slate-300 bg-white px-3 text-lg font-bold text-slate-900 shadow-xs focus:border-emerald-600 focus:outline-hidden"
                  />
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-slate-600">fica</span>
                    <span
                      data-testid="total-simulado"
                      aria-live="polite"
                      className="text-3xl font-extrabold tracking-tight text-emerald-700"
                    >
                      {total ?? "—"}
                    </span>
                    <span className="text-sm text-slate-600 font-medium">
                      {total ? "por mês" : "informe de 1 a 100.000"}
                    </span>
                  </div>
                </div>

                {/* Atalhos rápidos por porte */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Selecione rápido:</span>
                  {[25, 50, 100, 250, 500].map((qtd) => (
                    <button
                      key={qtd}
                      type="button"
                      onClick={() => setVidas(qtd)}
                      className={`rounded-lg border px-3 py-1 text-xs font-bold transition-all ${
                        vidas === qtd
                          ? "border-emerald-700 bg-emerald-700 text-white shadow-xs"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {qtd} colaboradores
                    </button>
                  ))}
                </div>

                <p className="mt-3 text-xs text-slate-500 font-medium">
                  Sem taxa de implantação, sem contrato de fidelidade e sem limite de usuários ou unidades.
                </p>
              </div>
            )}

            {/* O que está incluso */}
            <div className="mt-7 border-t border-slate-200 pt-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
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

            <p className="mt-4 text-xs text-slate-500 font-medium">
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
      <section id="seguranca" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
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

      {/* ── 10. FECHAMENTO & CTA FINAL (Inspirado no OnSafety) ── */}
      <section className="border-b border-slate-200 bg-slate-900 py-16 sm:py-24 text-center text-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3.5 py-1 text-xs font-bold text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            <span>Segurança Jurídica & Operacional</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Da próxima fiscalização, a sua ficha já existe.
          </h2>

          <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Veja na prática como funciona a entrega com assinatura na tela e o controle de estoque por obra.
            Sem compromisso e com os dados da sua própria empresa.
          </p>

          <div className="pt-4 flex justify-center">
            <Cta grande />
          </div>
        </div>
      </section>

      {/* ── RODAPÉ CORPORATIVO ── */}
      <footer className="bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="SafetySoluções" className="h-7 w-7 rounded-lg border border-slate-200 object-cover" />
            <div>
              <p className="font-bold text-slate-800">SafetySoluções — Gestão de EPIs</p>
              <p className="text-[11px] text-slate-400">Tecnologia para Segurança do Trabalho e Almoxarifado</p>
            </div>
          </div>
          <div className="flex gap-6 font-medium">
            <Link to="/termos" className="hover:text-slate-900">Termos de Uso</Link>
            <Link to="/privacidade" className="hover:text-slate-900">Privacidade</Link>
            <Link to="/login" className="hover:text-slate-900">Acessar Sistema</Link>
          </div>
        </div>
      </footer>

      {/* ── BARRA FIXA MOBILE DE CONVERSÃO ── */}
      <div className="sticky bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3.5 backdrop-blur-md sm:hidden shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-xs font-bold text-slate-900">{plano.nome}</p>
            <p className="text-[11px] font-semibold text-emerald-700">
              {preco ? `${preco} ${plano.unidade}` : "Sob consulta"}
            </p>
          </div>
          <Cta />
        </div>
      </div>
    </div>
  );
}

/**
 * Os planos da página pública de vendas.
 *
 * TUDO que a página mostra de preço, prazo e contato sai daqui. É de
 * propósito: quem mexe em preço não deveria precisar abrir o código da
 * página, e preço espalhado por uma tela sai errado numa hora dessas.
 *
 * `precoMensal: null` quer dizer "ainda não definido". A página mostra
 * "Sob consulta" e NÃO inventa número — preço errado numa página pública
 * vira promessa que alguém vai cobrar.
 */

export interface PlanoDeVenda {
  id: string;
  nome: string;
  /** Uma linha dizendo para quem é. */
  publico: string;
  /** Em reais, por mês. null = "Sob consulta". */
  precoMensal: number | null;
  /** Texto embaixo do preço: "por empresa", "até 50 colaboradores"... */
  unidade: string;
  /** O que entra neste plano. */
  inclui: string[];
  /** O que NÃO entra, quando importa dizer. */
  naoInclui?: string[];
  /** Marca o plano sugerido. Só um deve ter. */
  destaque?: boolean;
}

/**
 * ====== PREENCHA AQUI ======
 *
 * Troque os `null` pelos valores de verdade e ajuste o que cada plano
 * inclui. Enquanto estiver null, a página mostra "Sob consulta".
 */
export const PLANOS: PlanoDeVenda[] = [
  {
    id: "essencial",
    nome: "Essencial",
    publico: "Para quem precisa manter a documentação em dia.",
    precoMensal: null,
    unidade: "por empresa / mês",
    inclui: [
      "PGR — Programa de Gerenciamento de Riscos",
      "PCMSO — Controle Médico de Saúde Ocupacional",
      "Ordem de Serviço por função",
      "Dossiê do Colaborador com controle de vencimentos",
      "Validação pública dos documentos por QR Code",
    ],
  },
  {
    id: "completo",
    nome: "Completo",
    publico: "Para a consultoria que atende várias empresas.",
    precoMensal: null,
    unidade: "por empresa / mês",
    destaque: true,
    inclui: [
      "Tudo do Essencial",
      "LTCAT, PPP e laudos de Insalubridade e Periculosidade",
      "Gestão de EPIs: estoque, entregas e ficha assinada",
      "Treinamentos e certificados",
      "Inspeções e apontamentos com foto",
      "Extintores (NR-23) com selo digital",
      "eSocial S-2240",
    ],
  },
  {
    id: "sob_medida",
    nome: "Sob medida",
    publico: "Para grupos com várias unidades ou necessidade específica.",
    precoMensal: null,
    unidade: "a combinar",
    inclui: [
      "Tudo do Completo",
      "Multiempresa com matriz e filiais",
      "Implantação acompanhada e migração dos documentos existentes",
      "Treinamento da equipe",
    ],
  },
];

/** Contato que aparece nos botões da página. */
export const CONTATO = {
  /** Só números, com DDI. Ex.: "5588996536252". Vazio esconde o botão. */
  whatsapp: "",
  /** Mensagem que já vai escrita na conversa. */
  mensagem: "Olá! Vi a página de planos do SafetySoluções e quero saber mais.",
  email: "",
};

/** Preço em reais, ou null quando ainda não foi definido. */
export function precoFormatado(plano: PlanoDeVenda): string | null {
  if (plano.precoMensal == null) return null;
  return plano.precoMensal.toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 2,
  });
}

/** O link do WhatsApp já com a mensagem, ou null quando não há número. */
export function linkDoWhatsapp(plano?: PlanoDeVenda): string | null {
  const numero = CONTATO.whatsapp.replace(/\D/g, "");
  if (!numero) return null;
  const texto = plano
    ? `${CONTATO.mensagem} Tenho interesse no plano ${plano.nome}.`
    : CONTATO.mensagem;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Algum plano já tem preço definido? A página avisa quando nenhum tem. */
export function algumPrecoDefinido(planos: PlanoDeVenda[] = PLANOS): boolean {
  return planos.some((p) => p.precoMensal != null);
}

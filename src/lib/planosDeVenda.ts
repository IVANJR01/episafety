/**
 * A oferta da página pública — hoje, só Gestão de EPIs.
 *
 * TUDO que a página mostra de preço e contato sai daqui. É de propósito:
 * quem mexe em preço não deveria precisar abrir o código da página, e
 * preço espalhado por uma tela sai errado numa hora dessas.
 *
 * `precoMensal: null` quer dizer "ainda não definido". A página mostra
 * "Sob consulta" e NÃO inventa número — preço numa página pública é
 * oferta, e vira promessa que alguém vai cobrar.
 */

export interface PlanoDeVenda {
  id: string;
  nome: string;
  /** Uma linha dizendo para quem é. */
  publico: string;
  /** Em reais, por mês. null = "Sob consulta". */
  precoMensal: number | null;
  /** Riscado ao lado do preço, quando existe. null = sem "de/por". */
  precoDe?: number | null;
  /** Texto embaixo do preço: "por empresa", "até 50 colaboradores"... */
  unidade: string;
  inclui: string[];
  destaque?: boolean;
}

/**
 * ====== PREENCHA AQUI ======
 *
 * Troque o `null` pelo valor de verdade. Enquanto estiver null, a página
 * mostra "Sob consulta" e o texto explicando que o valor vem no contato.
 */
export const PLANOS: PlanoDeVenda[] = [
  {
    id: "epi",
    nome: "Gestão de EPIs",
    publico: "Para quem entrega EPI e precisa provar que entregou.",
    precoMensal: null,
    precoDe: null,
    unidade: "por empresa / mês",
    destaque: true,
    inclui: [
      "Cadastro de EPI com consulta automática do CA",
      "Aviso de CA vencido antes de o EPI sair do estoque",
      "Estoque por unidade, com estoque mínimo",
      "Entrega assinada pelo colaborador, com biometria ou assinatura",
      "Ficha de EPI pronta para a fiscalização, em PDF",
      "Conferência pública da ficha por código, sem login",
      "Devolução e troca no mesmo histórico",
      "Solicitação de materiais pelas unidades",
      "Relatórios de entregas por colaborador e por EPI",
    ],
  },
];

/** Contato que aparece nos botões da página. */
export const CONTATO = {
  /** Só números, com DDI. Ex.: "5588996536252". Vazio esconde o botão. */
  whatsapp: "5588996349359",
  /** Mensagem que já vai escrita na conversa. */
  mensagem: "Olá! Vi a página de Gestão de EPIs do SafetySoluções e quero começar.",
  email: "",
};

/** Preço em reais, ou null quando ainda não foi definido. */
export function precoFormatado(valor: number | null | undefined): string | null {
  if (valor == null) return null;
  return valor.toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 2,
  });
}

/** O link do WhatsApp já com a mensagem, ou null quando não há número. */
export function linkDoWhatsapp(plano?: PlanoDeVenda): string | null {
  const numero = CONTATO.whatsapp.replace(/\D/g, "");
  if (!numero) return null;
  const texto = plano
    ? `${CONTATO.mensagem} (plano ${plano.nome})`
    : CONTATO.mensagem;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Algum plano já tem preço definido? A página avisa quando nenhum tem. */
export function algumPrecoDefinido(planos: PlanoDeVenda[] = PLANOS): boolean {
  return planos.some((p) => p.precoMensal != null);
}

/**
 * Quanto por cento o preço "de" caiu até o "por".
 *
 * Só existe quando os DOIS valores existem e o de cima é maior. Desconto
 * calculado sobre preço inventado é a propaganda enganosa mais comum da
 * internet, e aqui ele simplesmente não aparece.
 */
export function descontoPercentual(plano: PlanoDeVenda): number | null {
  const de = plano.precoDe;
  const por = plano.precoMensal;
  if (de == null || por == null || de <= por || de <= 0) return null;
  return Math.round(((de - por) / de) * 100);
}

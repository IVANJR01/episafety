/**
 * Quem responde pelas fichas emitidas no sistema.
 *
 * A ficha de EPI traz o nome da empresa do funcionário no cabeçalho — é ela
 * que entrega o equipamento. Mas quem emite o documento e o assina
 * digitalmente é a consultoria de SST que opera o sistema, e essas duas
 * pessoas jurídicas não são a mesma.
 *
 * Sem dizer isso no rodapé, quem valida a assinatura no Adobe encontra um
 * CNPJ que não aparece em lugar nenhum da ficha e não tem como saber se é
 * legítimo ou se o documento foi assinado por um terceiro qualquer.
 *
 * O certificado configurado nos secrets `CERT_A1_PFX_BASE64` /
 * `CERT_A1_SENHA` da função `assinar-pdf` precisa ser o desta mesma empresa,
 * senão o rodapé e a assinatura passam a se contradizer.
 */
export interface AssinanteDigital {
  nome: string;
  cnpj: string;
}

/** Consultoria responsável pela emissão. Sobrescrevível por ambiente. */
export const ASSINANTE_DIGITAL: AssinanteDigital = {
  nome: import.meta.env.VITE_ASSINANTE_NOME || "3M CURSOS E TREINAMENTOS",
  cnpj: import.meta.env.VITE_ASSINANTE_CNPJ || "51.489.453/0001-64",
};

/**
 * Linha do rodapé que identifica o emissor.
 *
 * O CNPJ é opcional porque uma instalação pode configurar só o nome; nesse
 * caso a linha sai sem o traço solto no fim.
 */
export function linhaDoAssinante(assinante: AssinanteDigital = ASSINANTE_DIGITAL): string {
  const nome = assinante.nome.trim();
  if (!nome) return "";
  const cnpj = assinante.cnpj.trim();
  return cnpj
    ? `Emitido e assinado digitalmente por ${nome} — CNPJ ${cnpj}`
    : `Emitido e assinado digitalmente por ${nome}`;
}

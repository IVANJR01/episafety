/**
 * Qual PGR pode ser excluído.
 *
 * Uma importação feita na empresa errada deixou quatro rascunhos na
 * tela e nenhum jeito de tirá-los: o histórico de versões só oferecia
 * "Ver". Quem errou a empresa ficava com o cadastro sujo para sempre.
 *
 * Só RASCUNHO sai. Documento emitido é documento legal: ele pode ter
 * sido entregue à fiscalização, assinado, usado para fundamentar ação,
 * ASO e treinamento. Para tirar um desses de circulação existe
 * arquivar, que não apaga nada.
 */

export interface PgrParaExcluir {
  status?: string | null;
}

export function podeExcluirPgr(pgr: PgrParaExcluir | null | undefined): boolean {
  return (pgr?.status || "").trim().toLowerCase() === "rascunho";
}

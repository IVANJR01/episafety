/**
 * O número de revisão impresso no documento.
 *
 * Sem revisão registrada o documento está na elaboração, que é a revisão 00 —
 * e é assim que o Controle de Revisões já a chama, e como está no inventário
 * de exemplo do pacote ("REVISAO": "00", "Elaboração do PGR"). Duas casas
 * porque é como a norma pede e como o mercado imprime: "REV. 00".
 *
 * Mora aqui, e não dentro do gerador de PDF, porque o Word precisa da MESMA
 * regra. Enquanto estava só no pgrPdf.ts, o Word numerava pela versão do
 * documento (versao 2 => "02") e o PDF pela contagem de revisões (=> "01"):
 * o mesmo PGR saía com dois números de revisão dependendo do formato.
 */
export function numeroDaRevisao(revisoes?: { created_at: string }[] | null): string {
  return String(revisoes?.length ?? 0).padStart(2, "0");
}

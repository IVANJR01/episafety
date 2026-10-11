/*
 * O que os tipos do ExcelJS deixaram de fora.
 *
 * `worksheet.dataValidations` e `worksheet.conditionalFormattings` existem e
 * funcionam — a planilha gerada por eles passa na comparação com o arquivo do
 * pacote —, mas não estão declarados em exceljs/index.d.ts. Sem isto, usá-los
 * custaria um `as any` em cada chamada, o que apagaria a checagem de TODOS os
 * campos, inclusive os que a biblioteca declara direito.
 *
 * Isto não inventa API: descreve a que já está lá. Se uma versão futura do
 * ExcelJS declarar as duas, este arquivo deixa de ser necessário e o
 * TypeScript avisa, porque as declarações passam a conflitar.
 */
import "exceljs";

declare module "exceljs" {
  interface DataValidationsCollection {
    model: Record<string, DataValidation>;
    add(address: string, validation: DataValidation): DataValidation;
    find(address: string): DataValidation | undefined;
    remove(address: string): void;
  }

  interface ConditionalFormattingBlock {
    ref: string;
    rules: ConditionalFormattingRule[];
  }

  interface Worksheet {
    dataValidations: DataValidationsCollection;
    conditionalFormattings: ConditionalFormattingBlock[];
  }
}

import {
  carregarMatrizDoGes, TIPO_EXAME_COL, type MatrizDoGes,
} from "@/lib/matrizSaudeDoGes";

/**
 * Riscos e exames que entram num ASO.
 *
 * A regra inteira mora em matrizSaudeDoGes.ts, porque é a MESMA Matriz de
 * Saúde que o PCMSO mostra. Antes isto lia só `ghe_riscos` e `ghe_exames`,
 * que estavam vazias, enquanto a Matriz do PCMSO lia o inventário do PGR:
 * o PCMSO prometia os exames e o ASO saía sem nenhum, com todos os
 * fatores de risco em "N.A.".
 *
 * Este arquivo continua existindo pela assinatura — é por ela que o
 * módulo de ASO, o Portal RH e a emissão em lote entram.
 */

export { TIPO_EXAME_COL };

export const GRUPOS_RISCO = [
  { k: "fisico", l: "Físicos" },
  { k: "quimico", l: "Químicos" },
  { k: "biologico", l: "Biológicos" },
  { k: "ergonomico", l: "Ergonômicos" },
  { k: "acidente", l: "Acidentes / Mecânicos" },
  { k: "outro", l: "Outros" },
];

export interface RiscoSnapshot { grupo: string; descricao: string; }
export interface ExameSnapshot {
  nome_exame: string;
  codigo?: string | null;
  tipo?: string | null;
  periodicidade_meses?: number;
}

export async function loadGheRiscosExames(
  gheId: string,
  tipoExame: string,
): Promise<{ riscos: RiscoSnapshot[]; exames: ExameSnapshot[] }> {
  const { riscos, exames } = await carregarMatrizDoGes(gheId, tipoExame);
  return { riscos, exames };
}

/** A mesma coisa, mas dizendo de onde veio — para a tela avisar quem emite. */
export async function loadMatrizDoGes(
  gheId: string, tipoExame: string,
): Promise<MatrizDoGes> {
  return carregarMatrizDoGes(gheId, tipoExame);
}

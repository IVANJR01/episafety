import * as XLSX from "xlsx";

/**
 * Exportação das funções para revisão do gestor.
 *
 * O que vai na planilha é o que o gestor precisa conferir: o nome da função,
 * o setor dela e a descrição das atividades. A descrição sai INTEIRA — na
 * tela ela aparece cortada com reticências, e é justamente esse texto que a
 * pessoa vai ler e corrigir. Exportar o texto cortado tornaria o arquivo
 * inútil para o fim que ele tem.
 */

export interface FuncaoExportavel {
  nome?: string | null;
  setor_id?: string | null;
  descricao_atividades?: string | null;
}

export const CABECALHO_FUNCOES = ["Função", "Setor", "Descrição das atividades"];

const texto = (v?: string | null) => (v ?? "").toString().trim();

/**
 * As linhas da planilha, na mesma ordem em que estão na tela.
 *
 * Função sem setor sai como "Sem setor", não como traço: quem abre a planilha
 * fora do sistema não tem como saber que "—" quer dizer ausente.
 *
 * Descrição vazia sai como célula VAZIA de propósito — é assim que o gestor
 * enxerga de relance o que falta preencher. Escrever "não informado" encheria
 * a coluna de texto e esconderia justamente as pendências.
 */
export function linhasDeFuncoes(
  funcoes: FuncaoExportavel[],
  nomeDoSetor: (id?: string | null) => string | null | undefined,
): string[][] {
  return (funcoes || []).map((f) => [
    texto(f?.nome),
    texto(nomeDoSetor(f?.setor_id)) || "Sem setor",
    texto(f?.descricao_atividades),
  ]);
}

/** Nome do arquivo: identifica empresa, recorte e data sem precisar abrir. */
export function nomeArquivoFuncoes(empresa?: string | null, setor?: string | null): string {
  const limpa = (s?: string | null) =>
    (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  const partes = ["Funcoes", limpa(empresa), limpa(setor), new Date().toISOString().slice(0, 10)];
  return partes.filter(Boolean).join("_") + ".xlsx";
}

/** Largura de cada coluna pelo conteúdo, para a descrição não sair espremida. */
function larguras(dados: string[][]): { wch: number }[] {
  return CABECALHO_FUNCOES.map((_, coluna) => {
    const maior = dados.reduce((m, linha) => Math.max(m, (linha[coluna] || "").length), 0);
    return { wch: Math.min(Math.max(maior + 2, 12), 80) };
  });
}

export function montarPlanilhaFuncoes(linhas: string[][]): XLSX.WorkBook {
  const dados = [CABECALHO_FUNCOES, ...linhas];
  const ws = XLSX.utils.aoa_to_sheet(dados);
  ws["!cols"] = larguras(dados);
  // Cabeçalho congelado e filtro: a lista passa de quarenta funções, e rolar
  // sem saber a coluna é o que faz a planilha ser fechada sem uso.
  ws["!freeze"] = { xSplit: "0", ySplit: "1" } as never;
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: dados.length - 1, c: CABECALHO_FUNCOES.length - 1 },
    }),
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Funções");
  return wb;
}

export function exportarFuncoes(
  funcoes: FuncaoExportavel[],
  nomeDoSetor: (id?: string | null) => string | null | undefined,
  contexto?: { empresa?: string | null; setor?: string | null },
): void {
  const wb = montarPlanilhaFuncoes(linhasDeFuncoes(funcoes, nomeDoSetor));
  XLSX.writeFile(wb, nomeArquivoFuncoes(contexto?.empresa, contexto?.setor));
}

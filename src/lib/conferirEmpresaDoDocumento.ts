/**
 * O documento importado é mesmo desta empresa?
 *
 * Um PGR do G-91 NORDESTE (CNPJ 14.256.653/0001-40) foi importado quatro
 * vezes para a CG3 ENGENHARIA (05.394.053/0001-58). A tela não dizia
 * nada: o seletor de empresa fica no canto da barra lateral, e quem está
 * com o arquivo na mão não olha para lá.
 *
 * O estrago não é só bagunça de cadastro. O PGR é documento legal de UMA
 * organização; inventário de riscos de outra empresa dentro dele
 * descreve ambientes que não existem ali, e fundamenta ação, ASO e
 * treinamento errados.
 *
 * O documento diz de quem é — o CNPJ está escrito nele. Esta conferência
 * compara os dois e avisa ANTES de gravar. Ela não bloqueia: empresa
 * recém-cadastrada pode estar sem CNPJ, e matriz e filial compartilham a
 * raiz. Quem importa decide, sabendo.
 */

/** Só os dígitos — a pontuação varia de um documento para outro. */
export function digitosDoCnpj(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "");
}

/** A raiz do CNPJ: os oito primeiros dígitos, iguais em toda a empresa. */
export function raizDoCnpj(valor: unknown): string {
  const d = digitosDoCnpj(valor);
  return d.length >= 8 ? d.slice(0, 8) : "";
}

export type ConfereEmpresa =
  /** Mesmo CNPJ: é a empresa certa. */
  | "igual"
  /** Mesma raiz, inscrição diferente: é filial da mesma empresa. */
  | "mesma_empresa_outra_unidade"
  /** Empresas diferentes. */
  | "outra_empresa"
  /** Falta o CNPJ de um dos lados: não dá para afirmar nada. */
  | "indeterminado";

/**
 * Compara o CNPJ escrito no documento com o da empresa selecionada.
 *
 * @param doDocumento  CNPJ lido do arquivo importado.
 * @param daEmpresa    CNPJ cadastrado na empresa ativa.
 */
export function conferirEmpresa(
  doDocumento: unknown, daEmpresa: unknown,
): ConfereEmpresa {
  const a = digitosDoCnpj(doDocumento);
  const b = digitosDoCnpj(daEmpresa);
  if (a.length < 14 || b.length < 14) return "indeterminado";
  if (a === b) return "igual";
  if (raizDoCnpj(a) === raizDoCnpj(b)) return "mesma_empresa_outra_unidade";
  return "outra_empresa";
}

export interface AvisoDeEmpresa {
  grave: boolean;
  titulo: string;
  detalhe: string;
}

/** O aviso a mostrar, ou null quando não há o que avisar. */
export function avisoDeEmpresa(
  doDocumento: unknown, daEmpresa: unknown, nomeDaEmpresa?: string | null,
): AvisoDeEmpresa | null {
  const resultado = conferirEmpresa(doDocumento, daEmpresa);
  const empresa = (nomeDaEmpresa || "a empresa selecionada").trim();

  if (resultado === "outra_empresa") {
    return {
      grave: true,
      titulo: `Este documento é de outro CNPJ (${String(doDocumento).trim()}).`,
      detalhe: `A empresa aberta é ${empresa}. O PGR é documento legal de uma organização só: `
        + "importar aqui coloca riscos de outra empresa neste cadastro. Troque a empresa "
        + "no topo da barra lateral antes de aprovar.",
    };
  }
  if (resultado === "mesma_empresa_outra_unidade") {
    return {
      grave: false,
      titulo: "O documento é de outra unidade da mesma empresa.",
      detalhe: `O CNPJ do arquivo (${String(doDocumento).trim()}) tem a mesma raiz de ${empresa}, `
        + "mas é outra inscrição. Confira se é esta a unidade que você quer.",
    };
  }
  return null;
}

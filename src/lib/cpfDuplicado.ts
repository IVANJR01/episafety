/**
 * Reconhece funcionário já cadastrado com o mesmo CPF.
 *
 * Existe por um caso real: um cadastro apareceu três vezes na lista. Dois dos
 * registros nasceram com 1,16 segundo de diferença — clique duplo no botão de
 * cadastrar, que não travava durante a gravação — e o terceiro já estava lá
 * desde março, com o mesmo CPF, sem ninguém ser avisado.
 *
 * Travar o botão resolve o clique duplo. Esta função resolve o outro lado: o
 * CPF que já existe de antes, digitado de novo meses depois.
 */

/** Só os dígitos: o mesmo CPF aparece como "119.047.523-57" e "11904752357". */
export function apenasDigitos(cpf: string | null | undefined): string {
  return (cpf || "").replace(/\D/g, "");
}

export type FuncionarioComparavel = {
  id: string;
  nome: string;
  cpf: string | null;
  cargo?: string | null;
  data_admissao?: string | null;
};

/**
 * Procura na lista alguém com o mesmo CPF.
 *
 * @param idEmEdicao id do registro sendo editado — ele não é duplicata de si
 *                   mesmo, e sem isto salvar uma edição acusaria conflito.
 */
export function acharCpfJaCadastrado<T extends FuncionarioComparavel>(
  cpf: string | null | undefined,
  lista: T[],
  idEmEdicao?: string | null,
): T | null {
  const numero = apenasDigitos(cpf);
  // CPF tem 11 dígitos. Com menos, a pessoa ainda está digitando, e comparar
  // pedaço de CPF acusaria conflito entre pessoas diferentes.
  if (numero.length !== 11) return null;
  return (lista || []).find(
    (f) => f.id !== idEmEdicao && apenasDigitos(f.cpf) === numero,
  ) || null;
}

/** Texto do aviso, dizendo QUEM já está cadastrado — sem isso não dá para agir. */
export function avisoDeCpfRepetido(achado: FuncionarioComparavel): string {
  const partes = [achado.nome];
  if (achado.cargo?.trim()) partes.push(achado.cargo.trim());
  if (achado.data_admissao) {
    const [a, m, d] = achado.data_admissao.split("-");
    if (a && m && d) partes.push(`admitido em ${d}/${m}/${a}`);
  }
  return `Já existe: ${partes.join(" · ")}`;
}

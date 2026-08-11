/**
 * União do Núcleo Mestre com as tabelas legadas, sem cadastro repetido.
 *
 * As listas de setores e funções da tela são a soma de duas fontes: a tabela
 * nova (`sst_setores`, `sst_funcoes`) e a antiga (`aso_setores`, `aso_funcoes`),
 * que continua existindo porque outros módulos ainda leem dela.
 *
 * A união era só por id. Só que a MESMA função cadastrada nos dois lugares tem
 * ids diferentes — e aparecia duas vezes na lista. Pior: a linha legada não
 * carrega setor nenhum, então saía com "-" ao lado de uma linha idêntica que
 * mostrava o setor certo. Na prática o usuário via "Ajudante de Confecção" três
 * vezes: PCP, COMERCIAL e uma terceira sem setor, que é fantasma.
 *
 * Cuidado que a regra precisa ter: a mesma função em setores diferentes é
 * cadastro legítimo e frequente ("Assistente Administrativo" no PCP e no
 * ESCRITÓRIO). Essas linhas vivem todas na tabela nova, e por isso o corte é
 * só do lado legado — nada do Núcleo Mestre é descartado por nome.
 */

const normalizar = (s: unknown): string =>
  (s ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();

/** Só por id: para listas em que repetir o nome não é ambiguidade. */
export function unirPorId<T extends { id: string }>(principal: T[], legado: T[]): T[] {
  const vistos = new Set(principal.map((p) => p.id));
  return [...principal, ...legado.filter((l) => !vistos.has(l.id))];
}

/**
 * Por id e por nome: o registro legado só entra se o Núcleo Mestre ainda não
 * tiver esse nome.
 *
 * Legado sem correspondente continua aparecendo — é o único registro daquele
 * cadastro, e escondê-lo apagaria informação da tela.
 */
export function unirPorIdENome<T extends { id: string; nome?: string | null }>(
  principal: T[],
  legado: T[],
): T[] {
  const vistos = new Set(principal.map((p) => p.id));
  const nomes = new Set(principal.map((p) => normalizar(p.nome)).filter(Boolean));
  return [
    ...principal,
    ...legado.filter((l) => {
      if (vistos.has(l.id)) return false;
      const n = normalizar(l.nome);
      // Legado sem nome não dá para comparar; fica, para não sumir calado.
      return !n || !nomes.has(n);
    }),
  ];
}

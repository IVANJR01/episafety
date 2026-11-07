/**
 * Liga o GES ao setor e à função, a partir do inventário de riscos.
 *
 * O que estava acontecendo: a importação do PGR criava os GES, mas a tela
 * "Estrutura ocupacional" mostrava "0 GES · Sem GES" em todos os setores.
 * Conferido no banco do cliente: 25 GES, 22 setores e ZERO linhas na
 * tabela que liga um ao outro (ghe_setores).
 *
 * A ligação existia em um lugar só: no inventário de riscos, onde cada
 * risco diz o GES e o setor dele. Foi o que o próprio técnico notou —
 * "o GES não apareceu, mas no inventário de risco tem".
 *
 * Então é daí que a ligação é tirada. Sem banco e sem React: entra a
 * lista de itens do inventário, sai o que falta gravar.
 */

/** O que um item do inventário precisa ter para valer como ligação. */
export interface ItemDoInventario {
  /** GES do módulo de PGR (tabela ghe_ges). */
  ghe_id?: string | null;
  /** Setor da estrutura ocupacional (tabela sst_setores). */
  setor_id?: string | null;
  /** Função ligada ao risco, quando a planilha traz. */
  funcao_id?: string | null;
  /** Empresa dona da linha — a tabela exige e recusa sem. */
  empresa_id?: string | null;
  /** Nome do setor, como está escrito no inventário. */
  setor?: string | null;
  /** Nome da função, quando houver. */
  funcao_nome?: string | null;
}

/*
 * As linhas saem COMPLETAS, prontas para gravar.
 *
 * ghe_setores exige empresa_id, ghe_id e nome; ghe_funcoes exige
 * empresa_id, ghe_id e nome_funcao. Faltando qualquer um, o banco recusa
 * a linha inteira. Era exatamente isso que vinha acontecendo: a gravação
 * mandava só os dois ids, o Postgres recusava, e o erro ia para o
 * console — ninguém via, e os setores ficavam "Sem GES" para sempre.
 */
export interface VinculoDeSetor {
  empresa_id: string;
  ghe_id: string;
  setor_id: string;
  nome: string;
}

export interface VinculoDeFuncao {
  empresa_id: string;
  ghe_id: string;
  funcao_id: string;
  nome_funcao: string;
}

function chave(a: string, b: string): string {
  return `${a}|${b}`;
}

/**
 * Os pares GES↔setor que o inventário tem e a estrutura ainda não.
 *
 * Um mesmo par aparece em dezenas de riscos — um GES costuma ter vários
 * perigos no mesmo setor —, então a lista sai sem repetição. Item sem GES
 * ou sem setor não vira ligação: metade de um par não liga nada, e gravar
 * com um dos lados vazio só encheria a tabela de lixo.
 */
export function vinculosDeSetorFaltantes(
  itens: ItemDoInventario[],
  jaExistentes: VinculoDeSetor[] = [],
): VinculoDeSetor[] {
  const vistos = new Set(jaExistentes.map((v) => chave(v.ghe_id, v.setor_id)));
  const saida: VinculoDeSetor[] = [];

  for (const item of itens) {
    const ghe = item.ghe_id?.trim();
    const setor = item.setor_id?.trim();
    const empresa = item.empresa_id?.trim();
    /* Sem empresa a linha é recusada pelo banco; melhor nem montar. */
    if (!ghe || !setor || !empresa) continue;

    const k = chave(ghe, setor);
    if (vistos.has(k)) continue;
    vistos.add(k);
    saida.push({
      empresa_id: empresa,
      ghe_id: ghe,
      setor_id: setor,
      /* A coluna guarda o nome do SETOR — é a convenção das linhas que já existem. */
      nome: item.setor?.trim() || "Setor",
    });
  }

  return saida;
}

/** O mesmo, para as funções que o inventário associa a cada GES. */
export function vinculosDeFuncaoFaltantes(
  itens: ItemDoInventario[],
  jaExistentes: VinculoDeFuncao[] = [],
): VinculoDeFuncao[] {
  const vistos = new Set(jaExistentes.map((v) => chave(v.ghe_id, v.funcao_id)));
  const saida: VinculoDeFuncao[] = [];

  for (const item of itens) {
    const ghe = item.ghe_id?.trim();
    const funcao = item.funcao_id?.trim();
    const empresa = item.empresa_id?.trim();
    if (!ghe || !funcao || !empresa) continue;

    const k = chave(ghe, funcao);
    if (vistos.has(k)) continue;
    vistos.add(k);
    saida.push({
      empresa_id: empresa,
      ghe_id: ghe,
      funcao_id: funcao,
      nome_funcao: item.funcao_nome?.trim() || "Função",
    });
  }

  return saida;
}

/**
 * Quantos setores ficariam sem GES nenhum depois de gravar as ligações.
 *
 * Serve para a tela dizer a verdade depois de importar: "22 setores, 3
 * ainda sem GES" é informação que o técnico usa. "Importado com sucesso"
 * em cima de uma estrutura pela metade é o que fez ele perder a confiança
 * na importação.
 */
export function setoresSemGes(
  setoresDaEmpresa: { id: string }[],
  vinculos: VinculoDeSetor[],
): string[] {
  const comGes = new Set(vinculos.map((v) => v.setor_id));
  return setoresDaEmpresa.map((s) => s.id).filter((id) => !comGes.has(id));
}

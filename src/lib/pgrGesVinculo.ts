/**
 * A qual GES pertence uma linha do inventário que ficou sem grupo.
 *
 * `pgr_inventario_itens.ghe_id` é opcional e sempre foi: perigo trazido do
 * levantamento preliminar sem grupo escolhido, ou item criado antes de o GES
 * existir, nasce sem vínculo — e o PGR emitido imprime "N.A" na coluna GES,
 * que é justamente quem responde pelo risco no documento.
 *
 * A informação, porém, existe do outro lado: o setor e as funções da linha
 * estão cadastrados dentro de algum grupo. Este módulo cruza as duas pontas.
 */

export interface EstruturaVinculos {
  ges: { id: string; codigo?: string; status?: string | null }[];
  /** Vínculo GES↔setor: `nome` nos grupos antigos, `setor_id` nos novos. */
  gheSetores: { ghe_id: string; nome?: string | null; setor_id?: string | null; ativo?: boolean | null }[];
  /** Vínculo GES↔função: `nome_funcao` nos antigos, `funcao_id` nos novos. */
  gheFuncoes: { ghe_id: string; nome_funcao?: string | null; funcao_id?: string | null; status?: string | null }[];
  setores: { id: string; nome: string }[];
  funcoes: { id: string; nome: string }[];
}

/** O que se sabe da linha órfã: o nome do setor e os nomes das funções. */
export interface AlvoVinculo {
  setor?: string | null;
  funcoes?: (string | null | undefined)[] | null;
}

const normalizar = (s: unknown): string =>
  (s ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();

/** Índice nome→grupos, montado uma vez e reusado a cada linha. */
export interface IndiceVinculos {
  porSetor: Map<string, Set<string>>;
  porFuncao: Map<string, Set<string>>;
  ativos: Set<string>;
}

export function indexarVinculos(v: EstruturaVinculos): IndiceVinculos {
  const juntar = (m: Map<string, Set<string>>, chave: string, ges: string) => {
    if (!chave) return;
    if (!m.has(chave)) m.set(chave, new Set());
    m.get(chave)!.add(ges);
  };

  const nomeDoSetor = new Map(v.setores.map((s) => [s.id, normalizar(s.nome)]));
  const porSetor = new Map<string, Set<string>>();
  v.gheSetores.forEach((x) => {
    if (x.ativo === false) return;
    juntar(porSetor, normalizar(x.nome), x.ghe_id);
    if (x.setor_id) juntar(porSetor, nomeDoSetor.get(x.setor_id) || "", x.ghe_id);
  });

  const nomeDaFuncao = new Map(v.funcoes.map((f) => [f.id, normalizar(f.nome)]));
  const porFuncao = new Map<string, Set<string>>();
  v.gheFuncoes.forEach((x) => {
    if ((x.status || "ativo") !== "ativo") return;
    juntar(porFuncao, normalizar(x.nome_funcao), x.ghe_id);
    if (x.funcao_id) juntar(porFuncao, nomeDaFuncao.get(x.funcao_id) || "", x.ghe_id);
  });

  return {
    porSetor,
    porFuncao,
    ativos: new Set(v.ges.filter((g) => (g.status || "ativo") === "ativo").map((g) => g.id)),
  };
}

/**
 * Os grupos possíveis para a linha, do mais específico para o menos.
 *
 * Quando as duas pistas apontam, vale a interseção: um setor pode ter vários
 * grupos, e uma mesma função pode existir em setores diferentes — juntas, a
 * resposta fica bem mais estreita. Só quando a interseção é vazia é que cada
 * pista vale sozinha, começando pela função, que é a mais específica das duas.
 *
 * Devolver mais de um candidato é resposta legítima: significa "não dá para
 * decidir sem perguntar", e é o que impede o vínculo automático de chutar.
 */
export function candidatosDeGes(ix: IndiceVinculos, alvo: AlvoVinculo): string[] {
  const daFuncao = new Set<string>();
  (alvo.funcoes || []).forEach((f) => {
    (ix.porFuncao.get(normalizar(f)) || []).forEach((g) => daFuncao.add(g));
  });
  const doSetor = ix.porSetor.get(normalizar(alvo.setor)) || new Set<string>();

  let cand = [...daFuncao].filter((g) => doSetor.has(g));
  if (!cand.length) cand = daFuncao.size ? [...daFuncao] : [...doSetor];
  return cand.filter((g) => ix.ativos.has(g));
}

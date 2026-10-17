/**
 * A Ordem de Serviço montada a partir do GES.
 *
 * A tela promete no subtítulo: "Documento gerado a partir do GES — riscos,
 * EPIs e medidas são reaproveitados". Não era o que acontecia.
 *
 * "Carregar dados do GES" lia `ghe_riscos`, que tem ZERO linhas em todo o
 * banco; os riscos reais estão em `pgr_inventario_itens`, 30 linhas, que é
 * de onde o PGR e o PCMSO leem. Resultado: "Riscos identificados (0)" e
 * uma OS em branco, num documento que a NR-01 exige que informe ao
 * trabalhador os riscos da função (1.4.1 "b" e 1.4.2).
 *
 * É o mesmo defeito que o ASO tinha, agora no terceiro consumidor das
 * mesmas tabelas vazias.
 */

export interface ItemDoInventario {
  grupo?: string | null;
  tipo_agente?: string | null;
  perigo_descricao?: string | null;
  fonte_geradora?: string | null;
  tipo_exposicao?: string | null;
  lesoes?: string | null;
  limite_tolerancia?: string | number | null;
  epi?: string | string[] | null;
  controles_existentes?: string | string[] | null;
  medidas_existentes?: string | string[] | null;
  setor?: string | null;
}

export interface RiscoDaOs {
  grupo: string;
  descricao: string;
  fonte: string | null;
  exposicao: string | null;
  lesoes: string | null;
  limite: string | null;
}

/** Campo que no banco às vezes é texto e às vezes é lista de textos. */
function comoLista(v?: string | string[] | null): string[] {
  if (!v) return [];
  const bruto = Array.isArray(v) ? v : [v];
  return bruto.map((t) => (t || "").trim()).filter(Boolean);
}

/**
 * Riscos da OS, a partir dos itens do inventário do PGR.
 *
 * O mesmo agente aparece uma vez por setor no inventário; na OS de uma
 * função ele é um risco só.
 */
export function riscosDoInventarioParaOs(itens: ItemDoInventario[]): RiscoDaOs[] {
  const vistos = new Set<string>();
  const riscos: RiscoDaOs[] = [];
  for (const it of itens || []) {
    const descricao = (it.tipo_agente || "").trim() || (it.perigo_descricao || "").trim();
    if (!descricao) continue;
    const grupo = (it.grupo || "outro").trim().toLowerCase();
    const chave = `${grupo}|${descricao.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    riscos.push({
      grupo,
      descricao,
      /*
       * A fonte geradora está em branco em quase todo o inventário desta
       * empresa. O perigo descrito ("Mobiliário; Computador") é o que há
       * de mais próximo, e é melhor que deixar o campo vazio na OS.
       */
      fonte: (it.fonte_geradora || "").trim() || (it.perigo_descricao || "").trim() || null,
      exposicao: (it.tipo_exposicao || "").trim() || null,
      lesoes: (it.lesoes || "").trim() || null,
      limite: it.limite_tolerancia != null ? String(it.limite_tolerancia) : null,
    });
  }
  return riscos;
}

/** EPIs citados no inventário, sem repetir. */
export function episDoInventario(itens: ItemDoInventario[]): string[] {
  const vistos = new Set<string>();
  const epis: string[] = [];
  for (const it of itens || []) {
    for (const e of comoLista(it.epi)) {
      const k = e.toLowerCase();
      if (vistos.has(k)) continue;
      vistos.add(k);
      epis.push(e);
    }
  }
  return epis;
}

/**
 * Medidas de controle do inventário, uma por linha.
 *
 * `controles_existentes` e `medidas_existentes` guardam a mesma coisa em
 * épocas diferentes do cadastro; as duas entram.
 */
export function medidasDoInventario(itens: ItemDoInventario[]): string {
  const vistos = new Set<string>();
  const linhas: string[] = [];
  for (const it of itens || []) {
    for (const m of [...comoLista(it.controles_existentes), ...comoLista(it.medidas_existentes)]) {
      const k = m.toLowerCase();
      if (vistos.has(k)) continue;
      vistos.add(k);
      linhas.push(m);
    }
  }
  return linhas.join("\n");
}

/** O setor que o inventário atribui a este GES. */
export function setorDoInventario(itens: ItemDoInventario[]): string {
  for (const it of itens || []) {
    const s = (it.setor || "").trim();
    if (s) return s;
  }
  return "";
}

/**
 * Como o GES aparece na lista e no título da OS.
 *
 * O GES 01 desta empresa tem código "01" e nome "01", e a tela mostrava
 * "01 — 01" e o título "Ordem de Serviço — 01 01". Quando o nome não
 * acrescenta nada ao código, vale o setor; não havendo setor, fica só o
 * código, que já identifica o grupo.
 */
export function rotuloDoGes(ges: {
  codigo?: string | null; nome?: string | null; setor?: string | null;
}, setorDoPgr?: string): string {
  const codigo = (ges?.codigo || "").trim();
  const nome = (ges?.nome || "").trim();
  const setor = (ges?.setor || "").trim() || (setorDoPgr || "").trim();

  const nomeUtil = nome && nome.toLowerCase() !== codigo.toLowerCase()
    && !/^\d+$/.test(nome);
  const complemento = nomeUtil ? nome : setor;

  if (codigo && complemento) return `${codigo} — ${complemento}`;
  return codigo || complemento || "GES";
}

export interface FuncaoDoGes { id: string; nome_funcao?: string | null }

/**
 * A lista de funções do GES sem nomes repetidos.
 *
 * O GES 01 tem dez vínculos de função e oito nomes distintos: "Ajudante de
 * Confecção" e "Analista de PCP" apareciam duas vezes cada na lista, e não
 * havia como saber qual escolher — as duas levam ao mesmo lugar.
 */
export function funcoesSemRepetir<T extends FuncaoDoGes>(funcoes: T[]): T[] {
  const vistos = new Set<string>();
  const saida: T[] = [];
  for (const f of funcoes || []) {
    const nome = (f?.nome_funcao || "").trim();
    if (!nome) continue;
    const k = nome.toLowerCase().replace(/\s+/g, " ");
    if (vistos.has(k)) continue;
    vistos.add(k);
    saida.push(f);
  }
  return saida;
}

/**
 * O id que vai para a consulta, quando o valor pode não ser um id.
 *
 * O botão "Carregar dados do GES" estava escrito `onClick={carregarDoGhe}`,
 * e o React entrega o EVENTO do clique como primeiro argumento. O evento
 * ia parar no lugar do id: a consulta recebia "[object Object]" e o banco
 * respondia "invalid input syntax for type uuid".
 *
 * O chamador foi corrigido; isto é a tranca na porta, porque o mesmo erro
 * se escreve sozinho de novo em qualquer `onClick` futuro — e o preço é
 * uma mensagem de banco na cara do usuário.
 */
export function idOuPadrao(valor: unknown, padrao?: string | null): string {
  if (typeof valor === "string" && valor.trim()) return valor.trim();
  return (typeof padrao === "string" && padrao.trim()) ? padrao.trim() : "";
}

/**
 * A função do GES que corresponde ao cargo cadastrado no funcionário.
 *
 * O cadastro do funcionário guarda o cargo como texto — "Costureiro(a)" —
 * e o GES guarda a lista de funções com a grafia dele — "COSTUREIRO(A)".
 * A comparação ignora caixa, acento e pontuação, senão a função certa
 * passa batida e a OS sai sem função.
 */
export function funcaoDoCargo<T extends FuncaoDoGes>(
  cargo: string | null | undefined, funcoes: T[],
): T | null {
  const alvo = chaveDoCargo(cargo);
  if (!alvo) return null;
  return (funcoes || []).find((f) => chaveDoCargo(f.nome_funcao) === alvo) || null;
}

/** Nome de cargo reduzido ao que importa para comparar. */
export function chaveDoCargo(nome?: string | null): string {
  return (nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface SelecaoPeloFuncionario {
  gheId: string;
  funcaoId: string;
  /** Null quando não há nada a avisar. */
  aviso: null | { titulo: string; detalhe: string };
}

/**
 * O que escolher o funcionário preenche na OS.
 *
 * O cadastro do funcionário já diz o GES e o cargo dele; a OS pedia os
 * dois de novo. Quem preenchia tinha de lembrar em que grupo aquela
 * pessoa está, e errar aí emite OS com os riscos de outro GES.
 *
 * O que não dá para resolver sozinho vira aviso, nunca palpite.
 */
export function selecaoPeloFuncionario<T extends FuncaoDoGes>(
  pessoa: { nome?: string | null; cargo?: string | null; ghe_id?: string | null } | null,
  funcoesDoGes: T[],
): SelecaoPeloFuncionario {
  if (!pessoa) return { gheId: "", funcaoId: "", aviso: null };

  if (!pessoa.ghe_id) {
    return {
      gheId: "", funcaoId: "",
      aviso: {
        titulo: `${pessoa.nome || "Este funcionário"} está sem GES no cadastro.`,
        detalhe: "Informe o GHS/GES no cadastro do funcionário para a OS trazer os riscos certos.",
      },
    };
  }

  const funcao = funcaoDoCargo(pessoa.cargo, funcoesDoGes);
  if (!funcao && (pessoa.cargo || "").trim()) {
    /*
     * Cargo que não consta no GES não vira "a função mais parecida": isso
     * poria o trabalhador numa OS com os riscos de outra função.
     */
    return {
      gheId: pessoa.ghe_id, funcaoId: "",
      aviso: {
        titulo: `O cargo "${pessoa.cargo}" não consta nas funções deste GES.`,
        detalhe: "A OS sai pelo GES; escolha a função na mão se precisar dela.",
      },
    };
  }

  return { gheId: pessoa.ghe_id, funcaoId: funcao?.id || "", aviso: null };
}

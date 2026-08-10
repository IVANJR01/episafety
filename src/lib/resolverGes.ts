/**
 * Descobre o GES de um colaborador a partir da função e do setor.
 *
 * Hoje o ASO só sai se alguém tiver preenchido `funcionarios.ghe_id` na mão,
 * um a um. O RH abre o portal, escolhe o colaborador e esbarra em "Sem GHE
 * vinculado — não é possível gerar o ASO", sem ter como resolver: quem vincula
 * é o setor de Segurança do Trabalho.
 *
 * Mas a informação já existe. Cada GES declara as funções que o compõem em
 * `ghe_funcoes` (é o que o editor de estrutura do GES cadastra, e é de onde o
 * PGR e o PCMSO já leem). Se o cargo do colaborador é uma dessas funções, o
 * GES dele é determinado — não há o que adivinhar.
 *
 * Este módulo faz só a correspondência, sem tocar no banco, para poder ser
 * testado isoladamente. Quem consulta e quem grava é a tela.
 */

export interface FuncaoDeGes {
  ghe_id: string;
  nome_funcao: string;
  setor?: string | null;
}

export interface GesResolvido {
  ghe_id: string;
  /** Por que este GES foi escolhido — vai para a tela, nunca é implícito. */
  motivo: "funcao" | "funcao+setor";
  nome_funcao: string;
}

export type ResultadoGes =
  | { tipo: "resolvido"; ges: GesResolvido }
  /** Mesma função em GES diferentes e o setor não desempata: quem escolhe é a pessoa. */
  | { tipo: "ambiguo"; candidatos: FuncaoDeGes[] }
  | { tipo: "sem_correspondencia" };

/** Minúsculas, sem acento, sem espaço sobrando. "AJUDANTE  DE CONFECÇÃO" → "ajudante de confeccao". */
export function normalizar(s?: string | null): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function resolverGesPorFuncao(
  cargo: string | null | undefined,
  setor: string | null | undefined,
  funcoesDeGes: FuncaoDeGes[],
): ResultadoGes {
  const alvo = normalizar(cargo);
  if (!alvo) return { tipo: "sem_correspondencia" };

  const porFuncao = funcoesDeGes.filter((f) => normalizar(f.nome_funcao) === alvo);
  if (porFuncao.length === 0) return { tipo: "sem_correspondencia" };

  // Um GES só (ainda que declarado em linhas repetidas) já resolve.
  const ges = new Set(porFuncao.map((f) => f.ghe_id));
  if (ges.size === 1) {
    return { tipo: "resolvido", ges: { ghe_id: porFuncao[0].ghe_id, motivo: "funcao", nome_funcao: porFuncao[0].nome_funcao } };
  }

  // A mesma função em GES diferentes é legítimo: "Auxiliar Administrativo" no
  // escritório e na produção não têm a mesma exposição. Aí o setor desempata.
  const alvoSetor = normalizar(setor);
  if (alvoSetor) {
    const porSetor = porFuncao.filter((f) => normalizar(f.setor) === alvoSetor);
    const gesSetor = new Set(porSetor.map((f) => f.ghe_id));
    if (gesSetor.size === 1) {
      return { tipo: "resolvido", ges: { ghe_id: porSetor[0].ghe_id, motivo: "funcao+setor", nome_funcao: porSetor[0].nome_funcao } };
    }
  }

  // Sem desempate, o usuário prefere que puxe automaticamente o primeiro que encontrar
  // em vez de pedir para escolher.
  return { 
    tipo: "resolvido", 
    ges: { 
      ghe_id: Array.from(ges)[0], 
      motivo: "funcao", 
      nome_funcao: porFuncao[0].nome_funcao 
    } 
  };
}

/**
 * A prestação de contas do que a importação do PGR realmente gravou.
 *
 * A mensagem antiga dizia "PGR importado com sucesso! N riscos e M GES
 * cadastrados" — e o M vinha do que a leitura do documento ACHOU, não do
 * que entrou no banco. Numa importação em que 25 GES foram criados e
 * nenhum ficou ligado a setor, a mensagem continuava dizendo sucesso.
 *
 * É por isso que o técnico disse "não senti tanta firmeza": a tela
 * afirmava uma coisa e a Estrutura ocupacional mostrava outra. Conferir é
 * obrigação de quem importa; empurrar essa conferência para o usuário
 * descobrir sozinho três telas depois é o que queima a confiança.
 *
 * Aqui não há banco nem React: entram os números do que foi gravado, sai
 * o resumo e o texto que a tela mostra.
 */

export interface ResumoDaImportacao {
  /** Itens do inventário de riscos gravados. */
  riscos: number;
  /** Riscos que ficaram sem GES — não entram em nenhum grupo. */
  riscosSemGes: number;
  /** Riscos que ficaram sem setor. */
  riscosSemSetor: number;
  /** Setores da empresa que ficaram com pelo menos um GES. */
  setoresLigados: number;
  /** Setores que continuaram sem GES nenhum. */
  setoresSemGes: number;
  /** Ações do plano de ação gravadas. */
  acoes: number;
}

/** O que a tela precisa para montar a conferência. */
export interface DadosDaImportacao {
  itens: { ghe_id?: string | null; setor_id?: string | null }[];
  /** Pares GES↔setor existentes depois da importação. */
  vinculosDeSetor: { setor_id: string }[];
  /** Todos os setores da empresa. */
  setores: { id: string }[];
  acoes: number;
}

export function conferirImportacao(dados: DadosDaImportacao): ResumoDaImportacao {
  const comGes = new Set(dados.vinculosDeSetor.map((v) => v.setor_id));

  return {
    riscos: dados.itens.length,
    riscosSemGes: dados.itens.filter((i) => !i.ghe_id).length,
    riscosSemSetor: dados.itens.filter((i) => !i.setor_id).length,
    setoresLigados: dados.setores.filter((s) => comGes.has(s.id)).length,
    setoresSemGes: dados.setores.filter((s) => !comGes.has(s.id)).length,
    acoes: dados.acoes,
  };
}

export interface TextoDaConferencia {
  titulo: string;
  linhas: string[];
  /** false quando sobrou alguma coisa para o técnico olhar. */
  completo: boolean;
}

/**
 * O texto que a tela mostra.
 *
 * Quando sobra pendência, o título NÃO diz "sucesso". Dizer sucesso com
 * 22 setores sem GES é o que fez o técnico abrir a Estrutura ocupacional
 * e encontrar "0 GES" em tudo depois de ter lido que deu certo.
 */
export function textoDaConferencia(r: ResumoDaImportacao): TextoDaConferencia {
  const pendencias: string[] = [];

  if (r.riscos === 0) {
    return {
      titulo: "Nenhum risco foi importado",
      linhas: [
        "O documento foi lido, mas nenhum item do inventário entrou. " +
        "Confira se a planilha enviada é o inventário de riscos.",
      ],
      completo: false,
    };
  }

  const linhas = [
    `${r.riscos} ${r.riscos === 1 ? "risco" : "riscos"} no inventário.`,
    `${r.setoresLigados} ${r.setoresLigados === 1 ? "setor" : "setores"} com GES ligado.`,
  ];

  if (r.acoes > 0) {
    linhas.push(`${r.acoes} ${r.acoes === 1 ? "ação" : "ações"} no plano de ação.`);
  }

  if (r.setoresSemGes > 0) {
    pendencias.push(
      `${r.setoresSemGes} ${r.setoresSemGes === 1 ? "setor ficou" : "setores ficaram"} sem GES.`,
    );
  }
  if (r.riscosSemGes > 0) {
    pendencias.push(
      `${r.riscosSemGes} ${r.riscosSemGes === 1 ? "risco ficou" : "riscos ficaram"} sem GES.`,
    );
  }
  if (r.riscosSemSetor > 0) {
    pendencias.push(
      `${r.riscosSemSetor} ${r.riscosSemSetor === 1 ? "risco ficou" : "riscos ficaram"} sem setor.`,
    );
  }

  return {
    titulo: pendencias.length === 0
      ? "PGR importado e conferido"
      : "PGR importado, com pendências",
    linhas: [...linhas, ...pendencias],
    completo: pendencias.length === 0,
  };
}

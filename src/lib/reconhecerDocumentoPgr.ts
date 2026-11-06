/**
 * Diz que documento é esse, antes de gravar qualquer coisa.
 *
 * O caso que obrigou a escrever isto: foram enviados para a importação do
 * PGR um Word e uma planilha de PGRS — Plano de Gerenciamento de RESÍDUOS
 * Sólidos. Nomes quase iguais (PGR x PGRS), conteúdo totalmente
 * diferente: sobras de tecido, aterro sanitário e Classe II-A no lugar de
 * ruído, postura e agente químico.
 *
 * A importação não reclamou. Ela leu o arquivo, não reconheceu risco
 * nenhum e seguiu em frente, deixando o técnico descobrir sozinho três
 * telas depois que não tinha entrado nada. Numa planilha com menos
 * diferença, o estrago seria pior: resíduo virando risco ocupacional
 * dentro do inventário que vai para a fiscalização.
 *
 * Aqui não há banco, nem IA, nem React: entra o texto do arquivo, sai o
 * que ele é e por quê.
 */

export type TipoDeDocumento =
  | "pgr"
  | "residuos"
  | "pcmso"
  | "desconhecido";

export interface Reconhecimento {
  tipo: TipoDeDocumento;
  /** Serve para importar como PGR? */
  serveParaPgr: boolean;
  /** Frase curta para a tela. */
  veredito: string;
  /** As palavras do próprio documento que levaram a essa conclusão. */
  evidencias: string[];
}

/** Marcas de cada tipo de documento, em peso decrescente. */
const MARCAS: { tipo: Exclude<TipoDeDocumento, "desconhecido">; termos: [RegExp, number][] }[] = [
  {
    tipo: "residuos",
    termos: [
      [/plano de gerenciamento de res[ií]duos/i, 10],
      [/\bpgrs\b/i, 8],
      [/log[ií]stica reversa/i, 5],
      [/aterro sanit[áa]rio/i, 5],
      [/classe\s+ii\s*-\s*[ab]/i, 4],
      [/acondicionamento/i, 3],
      [/segrega[çc][ãa]o/i, 3],
      [/pol[ií]tica nacional de res[ií]duos/i, 6],
      [/res[ií]duo/i, 1],
    ],
  },
  {
    tipo: "pgr",
    termos: [
      [/invent[áa]rio de risco/i, 10],
      [/programa de gerenciamento de riscos/i, 10],
      [/\bges\b|\bghe\b/i, 4],
      [/grupo (homog[êe]neo|de exposi[çc][ãa]o)/i, 5],
      [/severidade/i, 4],
      [/probabilidade/i, 3],
      [/n[ií]vel de risco/i, 4],
      [/agente (f[ií]sico|qu[ií]mico|biol[óo]gico)/i, 5],
      [/ergon[ôo]mic/i, 3],
      [/\bnr[-\s]?0?1\b/i, 4],
      [/perigo/i, 2],
      [/plano de a[çc][ãa]o/i, 2],
    ],
  },
  {
    tipo: "pcmso",
    termos: [
      [/controle m[ée]dico de sa[úu]de ocupacional/i, 10],
      [/\bpcmso\b/i, 8],
      [/exame (admissional|peri[óo]dico|demissional)/i, 5],
      [/\baso\b/i, 3],
      [/\bnr[-\s]?0?7\b/i, 4],
    ],
  },
];

/** Quanto o vencedor precisa somar para a conclusão valer alguma coisa. */
const PONTOS_MINIMOS = 8;

interface Pontuacao {
  tipo: Exclude<TipoDeDocumento, "desconhecido">;
  pontos: number;
  evidencias: string[];
}

function pontuar(texto: string): Pontuacao[] {
  return MARCAS.map(({ tipo, termos }) => {
    let pontos = 0;
    const evidencias: string[] = [];
    for (const [expressao, peso] of termos) {
      const achado = texto.match(expressao);
      if (achado) {
        pontos += peso;
        if (peso >= 4 && evidencias.length < 4) evidencias.push(achado[0].trim());
      }
    }
    return { tipo, pontos, evidencias };
  }).sort((a, b) => b.pontos - a.pontos);
}

/**
 * Reconhece o documento pelo que está escrito nele.
 *
 * `riscosEncontrados` é o que a leitura conseguiu extrair. Vale mais que
 * o texto: um documento de onde saiu inventário é um PGR, mesmo que use
 * palavras que este arquivo não conhece. É o contrário que precisa de
 * aviso — texto de PGR e zero risco extraído.
 */
export function reconhecerDocumento(entrada: {
  texto?: string | null;
  nomeArquivo?: string | null;
  riscosEncontrados?: number;
}): Reconhecimento {
  const texto = `${entrada.nomeArquivo || ""}\n${entrada.texto || ""}`;

  if (texto.trim().length < 30) {
    return {
      tipo: "desconhecido",
      serveParaPgr: false,
      veredito: "Não foi possível ler texto suficiente neste arquivo.",
      evidencias: [],
    };
  }

  const [primeiro, segundo] = pontuar(texto);

  /* Risco extraído é prova; o texto é indício. */
  if ((entrada.riscosEncontrados ?? 0) > 0 && primeiro.tipo !== "residuos") {
    return {
      tipo: "pgr",
      serveParaPgr: true,
      veredito: `Inventário de riscos reconhecido: ${entrada.riscosEncontrados} ${
        entrada.riscosEncontrados === 1 ? "risco encontrado" : "riscos encontrados"
      }.`,
      evidencias: primeiro.evidencias,
    };
  }

  if (primeiro.pontos < PONTOS_MINIMOS || primeiro.pontos === segundo?.pontos) {
    return {
      tipo: "desconhecido",
      serveParaPgr: false,
      veredito:
        "Não deu para identificar que documento é este. Nenhum risco ocupacional foi reconhecido no texto.",
      evidencias: [],
    };
  }

  if (primeiro.tipo === "residuos") {
    return {
      tipo: "residuos",
      serveParaPgr: false,
      veredito:
        "Este arquivo é um PGRS — Plano de Gerenciamento de Resíduos Sólidos, " +
        "não o PGR. São documentos diferentes: um trata do descarte de resíduos, " +
        "o outro dos riscos ocupacionais.",
      evidencias: primeiro.evidencias,
    };
  }

  if (primeiro.tipo === "pcmso") {
    return {
      tipo: "pcmso",
      serveParaPgr: false,
      veredito:
        "Este arquivo é um PCMSO. Para importá-lo, use a importação do próprio PCMSO.",
      evidencias: primeiro.evidencias,
    };
  }

  /* Texto de PGR, mas sem risco extraído: o arquivo é o certo e a leitura falhou. */
  return {
    tipo: "pgr",
    serveParaPgr: (entrada.riscosEncontrados ?? 0) > 0,
    veredito:
      (entrada.riscosEncontrados ?? 0) > 0
        ? "PGR reconhecido."
        : "O arquivo parece ser um PGR, mas nenhum risco foi reconhecido nele. " +
          "O inventário costuma vir na planilha (.xlsx ou .xlsm); envie-a também.",
    evidencias: primeiro.evidencias,
  };
}

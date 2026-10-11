/*
 * Extrai de uma planilha tudo o que a define, para comparar duas delas.
 *
 * Comparar os bytes do .xlsx não serve: é um zip, e dois arquivos com o mesmo
 * conteúdo diferem na data de criação, na ordem das partes e em escolhas de
 * codificação que o Excel lê igual. Dois exemplos reais encontrados aqui:
 *
 *  — o ExcelJS junta colunas vizinhas de mesma largura num <col min="7"
 *    max="8">, enquanto o openpyxl escreve uma por coluna;
 *  — o ExcelJS omite operator="between" na validação numérica, porque é o
 *    padrão do formato (e ele mesmo relê como "between").
 *
 * Nos dois casos o Excel abre a planilha exatamente igual. O que se compara
 * aqui é o que o usuário vê e usa: valores, fórmulas, cores, mesclagens,
 * larguras, painéis congelados, formatação condicional e listas suspensas.
 */
import type ExcelJS from "exceljs";

/** Cor em 6 dígitos: os leitores divergem no canal alfa (00 x FF). */
const corDe = (v: unknown): string | null => {
  const argb = (v as { argb?: string } | undefined)?.argb;
  return typeof argb === "string" ? argb.slice(-6).toUpperCase() : null;
};

const fillDe = (fill: unknown): string | null => {
  const f = fill as { type?: string; fgColor?: unknown } | undefined;
  return f && f.type === "pattern" ? corDe(f.fgColor) : null;
};

export interface CelulaComparada {
  v: string | number | null;
  formula: string | null;
  fill: string | null;
  bold: boolean;
  corFonte: string | null;
  tam: number | null;
  al: string | null;
}

export interface AbaComparada {
  nome: string;
  celulas: Record<string, CelulaComparada>;
  mescladas: string[];
  larguras: Record<string, number>;
  alturas: Record<string, number>;
  congelado: string | null;
  cf: { faixa: string; tipo: string; op: string; formula: string[]; fill: string | null; corFonte: string | null }[];
  dv: Record<string, { tipo: string; formulae: string[] }>;
}

function celula(c: ExcelJS.Cell): CelulaComparada | null {
  const bruto = c.value as unknown;
  const formula =
    bruto && typeof bruto === "object" && "formula" in (bruto as object)
      ? String((bruto as { formula: string }).formula)
      : null;
  let v: string | number | null = null;
  if (formula === null && bruto !== null && bruto !== undefined) {
    v = typeof bruto === "number" ? bruto : String(bruto);
    if (v === "") v = null;
  }
  const fill = fillDe(c.fill);
  const fonte = c.font || {};
  /* Célula sem conteúdo e sem cor não distingue nada: fica de fora dos dois
     lados, senão a comparação vira ruído de borda em célula vazia. */
  if (v === null && formula === null && fill === null) return null;
  return {
    v,
    formula,
    fill,
    bold: Boolean(fonte.bold),
    corFonte: corDe(fonte.color),
    tam: fonte.size ?? null,
    al: c.alignment?.horizontal ?? null,
  };
}

export function compararAba(ws: ExcelJS.Worksheet): AbaComparada {
  const celulas: Record<string, CelulaComparada> = {};
  ws.eachRow({ includeEmpty: false }, (linha) => {
    linha.eachCell({ includeEmpty: false }, (c) => {
      /*
       * Dentro de uma mesclagem só a célula do canto existe para quem lê: as
       * outras são sombra dela, e cada gerador decide por conta própria se
       * copia ou não o estilo para a sombra. Comparar a sombra acusaria
       * diferença onde o Excel mostra exatamente a mesma coisa.
       */
      if (c.isMerged && c.master && c.master.address !== c.address) return;
      const dado = celula(c);
      if (dado) celulas[c.address] = dado;
    });
  });

  const larguras: Record<string, number> = {};
  const alturas: Record<string, number> = {};
  for (let i = 1; i <= ws.columnCount; i++) {
    const w = ws.getColumn(i).width;
    if (w != null) larguras[ws.getColumn(i).letter] = w;
  }
  ws.eachRow({ includeEmpty: false }, (linha) => {
    if (linha.height != null) alturas[String(linha.number)] = linha.height;
  });

  const vista = (ws.views || [])[0] as { state?: string; xSplit?: number; ySplit?: number } | undefined;
  const congelado = vista?.state === "frozen" ? `${vista.xSplit ?? 0},${vista.ySplit ?? 0}` : null;

  const cf: AbaComparada["cf"] = [];
  for (const bloco of ws.conditionalFormattings || []) {
    for (const regra of bloco.rules as unknown as {
      type: string; operator?: string; formulae?: string[];
      style?: { fill?: unknown; font?: { color?: unknown } };
    }[]) {
      cf.push({
        faixa: bloco.ref,
        tipo: regra.type,
        op: regra.operator ?? "",
        formula: regra.formulae ?? [],
        fill: fillDe(regra.style?.fill),
        corFonte: corDe(regra.style?.font?.color),
      });
    }
  }
  cf.sort((a, b) => (a.faixa + a.formula.join()).localeCompare(b.faixa + b.formula.join()));

  const dv: AbaComparada["dv"] = {};
  for (const [endereco, regra] of Object.entries(ws.dataValidations?.model || {})) {
    dv[endereco] = { tipo: regra.type, formulae: (regra.formulae || []).map((f) => String(f)) };
  }

  return {
    nome: ws.name,
    celulas,
    mescladas: [...new Set(Object.values((ws as unknown as { _merges?: Record<string, { range?: string }> })._merges || {})
      .map((m) => String(m?.range ?? m)))].sort(),
    larguras,
    alturas,
    congelado,
    cf,
    dv,
  };
}

export function compararPlanilha(wb: ExcelJS.Workbook): AbaComparada[] {
  return wb.worksheets.map(compararAba);
}

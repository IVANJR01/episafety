/*
 * Planilha de Inventário de Riscos + Plano de Ação 5W2H + Matriz 5x5.
 *
 * Porte de ferramentas/documentos/gerador/gerar_planilha.py (Python +
 * openpyxl) para TypeScript + ExcelJS, para rodar no navegador.
 *
 * Por que não chamar o script: não existe servidor Node neste projeto, e Edge
 * Function roda Deno — sem python3 e sem processo filho.
 *
 * Por que ExcelJS e não o `xlsx-js-style` que já estava no projeto: esta
 * planilha usa FORMATAÇÃO CONDICIONAL (a classificação que se pinta sozinha
 * quando o nível muda) e LISTA SUSPENSA (agente, exposição, status,
 * prioridade). O xlsx-js-style não escreve nenhuma das duas — a planilha
 * sairia parecida e morta.
 *
 * A fidelidade é verificada por gerarPlanilha.fidelidade.test.ts, que roda o
 * script Python original e compara célula a célula, cor a cor, regra a regra.
 */
import ExcelJS from "exceljs";

const NAVY = "0F2A44";
const LIGHT = "EEF2F6";
const CINZA = "5B6770";

/** Classificação: faixa, nome, cor e o tratamento no plano de ação. */
export const NIVEIS: [number, number, string, string, string][] = [
  [1, 3, "TRIVIAL", "00B0F0", "Nenhuma ação necessária."],
  [4, 8, "TOLERÁVEL", "92D050", "Nenhum controle adicional necessário."],
  [9, 12, "MODERADO", "FFFF00", "Controle adicional, se possível/viável."],
  [13, 15, "SUBSTANCIAL", "FFC000", "Controle necessário."],
  [16, 25, "INTOLERÁVEL", "C00000", "Ação imediata ou interrupção da atividade."],
];

const STATUS: [string, string][] = [
  ["ATRASADO", "FF7C80"],
  ["EM ANDAMENTO", "FFFF00"],
  ["PROGRAMADO", "9DC3E6"],
  ["REALIZADO", "92D050"],
  ["REPROGRAMADO", "FFC000"],
];

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const FINO = { style: "thin" as const, color: { argb: "FF9AA8B5" } };
const BORDA = { left: FINO, right: FINO, top: FINO, bottom: FINO };
const CENTRO = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
const ESQ = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };

const preenche = (cor: string) => ({
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF" + cor },
});

/*
 * Fixa a largura de uma coluna, inclusive quando ela vale 9.
 *
 * O ExcelJS trata 9 como "largura padrão" (DEFAULT_COLUMN_WIDTH = 9) e, por
 * isso, NÃO escreve o <col> dessa coluna no arquivo. Só que o padrão de
 * verdade do Excel é 8,43 — então as colunas de largura 9 (PROBABILIDADE,
 * SEVERIDADE e NÍVEL, no inventário) sairiam mais estreitas do que na
 * planilha original, sem nenhum aviso.
 *
 * `isCustomWidth` é um getter sem setter na biblioteca; sobrescrevê-lo nesta
 * coluna é o ponto mínimo em que dá para corrigir sem inventar uma largura
 * falsa (9,0001) nem pôr estilo de coluna, que vazaria para todas as células.
 */
function largura(ws: ExcelJS.Worksheet, indice: number, w: number) {
  const coluna = ws.getColumn(indice);
  coluna.width = w;
  Object.defineProperty(coluna, "isCustomWidth", { get: () => true, configurable: true });
}

/** Cabeçalho azul-marinho, opcionalmente mesclado. */
function cab(
  ws: ExcelJS.Worksheet,
  r: number, c: number, txt: string,
  o: { r2?: number; c2?: number; cor?: string } = {},
) {
  const r2 = o.r2 ?? r;
  const c2 = o.c2 ?? c;
  const cor = o.cor ?? NAVY;
  if (r2 !== r || c2 !== c) ws.mergeCells(r, c, r2, c2);
  for (let rr = r; rr <= r2; rr++) {
    for (let cc = c; cc <= c2; cc++) {
      const cel = ws.getCell(rr, cc);
      cel.fill = preenche(cor);
      cel.border = BORDA;
      cel.alignment = CENTRO;
      cel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    }
  }
  ws.getCell(r, c).value = txt;
}

/** Título da aba e a linha de identificação da empresa. */
function titulo(ws: ExcelJS.Worksheet, txt: string, ultCol: number, emp: Record<string, unknown>) {
  ws.mergeCells(1, 1, 1, ultCol);
  const a1 = ws.getCell("A1");
  a1.value = txt;
  a1.font = { bold: true, size: 14, color: { argb: "FF" + NAVY } };
  a1.alignment = CENTRO;
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, ultCol);
  const a2 = ws.getCell("A2");
  a2.value =
    `Empresa: ${emp.RAZAO_SOCIAL ?? ""}    CNPJ: ${emp.CNPJ ?? ""}` +
    `    Atualização: ${emp.DATA_EMISSAO ?? ""}    Responsável: ${emp.RESPONSAVEL_NOME ?? ""}`;
  a2.font = { size: 9, color: { argb: "FF" + CINZA } };
  a2.alignment = CENTRO;
}

export interface LinhaInventario {
  ambiente?: string; setor?: string; ghe?: string; funcao?: string; processo?: string;
  agente?: string; perigo?: string; fonte?: string; lesoes?: string; limite?: string;
  intensidade?: string; exposicao?: string; tecnica?: string; medidas?: string;
  epi?: string; atenuacao?: string;
  probabilidade?: number | string; severidade?: number | string;
}

export interface LinhaPlano {
  setor?: string; ghe?: string; oque?: string; porque?: string; como?: string;
  onde?: string; quanto?: string; prioridade?: string; meses?: string[];
  responsavel?: string; status?: string; afericao?: string;
}

export interface DadosPlanilha {
  empresa?: Record<string, unknown>;
  inventario?: LinhaInventario[];
  plano?: LinhaPlano[];
}

const CHAVES_INV: (keyof LinhaInventario)[] = [
  "ambiente", "setor", "ghe", "funcao", "processo", "agente", "perigo", "fonte", "lesoes",
  "limite", "intensidade", "exposicao", "tecnica", "medidas", "epi", "atenuacao",
  "probabilidade", "severidade",
];

function inventario(wb: ExcelJS.Workbook, dados: LinhaInventario[] | undefined, emp: Record<string, unknown>) {
  const ws = wb.addWorksheet("INVENTÁRIO DE RISCOS");
  titulo(ws, "INVENTÁRIO DE RISCOS OCUPACIONAIS – NR-01 (item 1.5.7.3)", 20, emp);

  const heads = [
    "DESCRIÇÃO DO AMBIENTE", "SETOR", "GES", "FUNÇÃO", "PROCESSO / ATIVIDADES", "AGENTE",
    "PERIGO", "FONTE / CIRCUNSTÂNCIA", "POSSÍVEIS LESÕES OU AGRAVOS À SAÚDE",
    "LIMITE DE EXPOSIÇÃO", "INTENS. / CONC.", "TIPO / TEMPO DE EXPOSIÇÃO", "TÉCNICA UTILIZADA",
  ];
  heads.forEach((h, i) => cab(ws, 4, i + 1, h, { r2: 5 }));
  cab(ws, 4, 14, "MEDIDAS DE PREVENÇÃO EXISTENTES", { c2: 16 });
  ["EPC / PROCEDIMENTO ADMINISTRATIVO", "EPI", "ATENUAÇÃO / FATOR DE PROTEÇÃO"].forEach((h, i) =>
    cab(ws, 5, 14 + i, h));
  ["PROBABILIDADE", "SEVERIDADE", "NÍVEL (P x S)", "CLASSIFICAÇÃO DO RISCO"].forEach((h, i) =>
    cab(ws, 4, 17 + i, h, { r2: 5 }));

  const larg = [34, 14, 7, 26, 32, 13, 22, 22, 30, 11, 11, 13, 16, 34, 16, 13, 9, 9, 9, 15];
  larg.forEach((w, i) => largura(ws, i + 1, w));
  ws.getRow(4).height = 22;
  ws.getRow(5).height = 36;

  /* Sem dados, sai o modelo em branco com 40 linhas prontas para preencher. */
  const linhas: LinhaInventario[] = dados && dados.length
    ? dados
    : Array.from({ length: 40 }, () => ({}));

  const r0 = 6;
  linhas.forEach((reg, k) => {
    const r = r0 + k;
    CHAVES_INV.forEach((ch, i) => {
      const cel = ws.getCell(r, i + 1);
      const v = (reg as Record<string, unknown>)[ch];
      /*
       * Vazio é célula VAZIA, não a string "".
       *
       * O openpyxl converte "" em None ao gravar; o ExcelJS guardaria a
       * string vazia, e a planilha ficaria com milhares de células que
       * "têm conteúdo" sem ter nada — o que atrapalha de CTRL+seta a
       * contagem de preenchidas.
       */
      cel.value = (v === undefined || v === null || v === "" ? null : v) as ExcelJS.CellValue;
      cel.border = BORDA;
      cel.font = { size: 9 };
      cel.alignment = [2, 3, 6, 10, 11, 12, 17, 18].includes(i + 1) ? CENTRO : ESQ;
    });
    /*
     * Nível e classificação são FÓRMULA, não valor gravado.
     *
     * É o que garante a regra na planilha aberta: mexeu em P ou S, o nível e
     * a classe mudam sozinhos. Gravar o número faria a planilha mentir no
     * instante em que alguém corrigisse uma probabilidade.
     */
    const celNivel = ws.getCell(r, 19);
    celNivel.value = { formula: `IF(OR(Q${r}="",R${r}=""),"",Q${r}*R${r})` } as ExcelJS.CellValue;
    const condicoes = NIVEIS.slice(0, -1)
      .map(([, b, n]) => `IF(S${r}<=${b},"${n}",`).join("");
    const celClasse = ws.getCell(r, 20);
    celClasse.value = {
      formula: `IF(S${r}="","",${condicoes}"${NIVEIS[NIVEIS.length - 1][2]}"${")".repeat(NIVEIS.length)}`,
    } as ExcelJS.CellValue;
    for (const col of [19, 20]) {
      const cel = ws.getCell(r, col);
      cel.border = BORDA;
      cel.alignment = CENTRO;
      cel.font = { size: 9, bold: true };
    }
  });
  const ult = r0 + linhas.length - 1;

  /*
   * Mescla as colunas de grupo (ambiente, setor, GES, função, processo) e o
   * agente, como na planilha original: linhas seguidas do mesmo GES viram uma
   * célula só, e o inventário se lê por grupo em vez de repetir tudo.
   */
  if (dados && dados.length) {
    const grupo = (x: LinhaInventario) => JSON.stringify([x.ghe, x.setor, x.funcao]);
    const mescla = (col: number, chaveFn: (x: LinhaInventario) => string) => {
      let ini = r0;
      for (let r = r0 + 1; r <= ult + 1; r++) {
        const atual = r <= ult ? chaveFn(linhas[r - r0]) : null;
        if (atual === null || atual !== chaveFn(linhas[ini - r0])) {
          if (r - 1 > ini) ws.mergeCells(ini, col, r - 1, col);
          ini = r;
        }
      }
    };
    ([[1, "ambiente"], [2, "setor"], [3, "ghe"], [4, "funcao"], [5, "processo"]] as const)
      .forEach(([col, ch]) =>
        mescla(col, (x) => grupo(x) + "|" + String((x as Record<string, unknown>)[ch] ?? "")));
    mescla(6, (x) => grupo(x) + "|" + String(x.agente ?? ""));
  }

  /* A classificação se pinta sozinha, pela palavra que a fórmula escreveu. */
  NIVEIS.forEach(([, , nome, cor]) => {
    ws.addConditionalFormatting({
      ref: `T${r0}:T${ult}`,
      rules: [{
        type: "cellIs", operator: "equal", formulae: [`"${nome}"`], priority: 1,
        style: {
          fill: preenche(cor),
          font: { bold: true, color: { argb: nome === "INTOLERÁVEL" ? "FFFFFFFF" : "FF000000" } },
        },
      }],
    });
  });

  /*
   * Listas suspensas e o limite de 1 a 5 — o que impede digitar errado.
   *
   * Aplicadas à FAIXA inteira, não célula a célula: por célula, o ExcelJS
   * grava um bloco de validação para cada trecho contíguo, e o arquivo sai
   * com dezenas de regras onde a planilha original tem uma.
   */
  ws.dataValidations.add(`F${r0}:F${ult}`, {
    type: "list", allowBlank: true,
    formulae: ['"Físico,Químico,Biológico,Ergonômico,Acidente"'],
  });
  ws.dataValidations.add(`L${r0}:L${ult}`, {
    type: "list", allowBlank: true, formulae: ['"Permanente,Intermitente,Eventual"'],
  });
  ws.dataValidations.add(`Q${r0}:R${ult}`, {
    type: "whole", operator: "between", allowBlank: true,
    formulae: [1, 5], showErrorMessage: true, error: "Use valores de 1 a 5",
  });

  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 5 }];
  ws.pageSetup = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0, fitToPage: true };
  ws.pageSetup.printTitlesRow = "4:5";
}

function plano(wb: ExcelJS.Workbook, dados: LinhaPlano[] | undefined, emp: Record<string, unknown>) {
  const ws = wb.addWorksheet("PLANO DE AÇÃO 5W2H");
  titulo(ws, "PLANO DE AÇÃO 5W2H – NR-01 (item 1.5.5.2)", 23, emp);

  ["SETOR", "GES", "O QUÊ? (MEDIDA DE PREVENÇÃO)", "POR QUÊ?", "COMO?", "ONDE?", "QUANTO?", "PRIORIDADE"]
    .forEach((h, i) => cab(ws, 4, i + 1, h, { r2: 5 }));
  cab(ws, 4, 9, `CRONOGRAMA ${emp.ANO ?? ""}`.trim(), { c2: 20 });
  MESES.forEach((m, i) => cab(ws, 5, 9 + i, m));
  cab(ws, 4, 21, "RESPONSÁVEL", { r2: 5 });
  cab(ws, 4, 22, "STATUS", { r2: 5 });
  cab(ws, 4, 23, "ACOMPANHAMENTO E AFERIÇÃO DE RESULTADOS", { r2: 5 });

  [14, 6, 32, 28, 30, 16, 16, 11, ...Array(12).fill(5), 16, 15, 30]
    .forEach((w, i) => largura(ws, i + 1, w));
  ws.getRow(5).height = 20;

  const linhas: LinhaPlano[] = dados && dados.length ? dados : Array.from({ length: 20 }, () => ({}));
  const r0 = 6;
  linhas.forEach((a, k) => {
    const r = r0 + k;
    const vals: (string | number)[] = [
      a.setor ?? "", a.ghe ?? "", a.oque ?? "", a.porque ?? "", a.como ?? "",
      a.onde ?? "", a.quanto ?? "", a.prioridade ?? "",
      ...MESES.map((m) => ((a.meses ?? []).includes(m) ? "X" : "")),
      a.responsavel ?? "", a.status ?? "", a.afericao ?? "",
    ];
    vals.forEach((v, i) => {
      const cel = ws.getCell(r, i + 1);
      cel.value = (v === "" ? null : v) as ExcelJS.CellValue;
      cel.border = BORDA;
      cel.font = { size: 9, bold: i + 1 >= 9 && i + 1 <= 20 };
      cel.alignment = [3, 4, 5, 6, 7, 23].includes(i + 1) ? ESQ : CENTRO;
    });
    ws.getRow(r).height = 48;
  });
  const ult = r0 + linhas.length - 1;

  ws.addConditionalFormatting({
    ref: `I${r0}:T${ult}`,
    rules: [{
      type: "cellIs", operator: "equal", formulae: ['"X"'], priority: 1,
      style: { fill: preenche(NAVY), font: { bold: true, color: { argb: "FFFFFFFF" } } },
    }],
  });
  STATUS.forEach(([n, cor]) => {
    ws.addConditionalFormatting({
      ref: `V${r0}:V${ult}`,
      rules: [{
        type: "cellIs", operator: "equal", formulae: [`"${n}"`], priority: 1,
        style: { fill: preenche(cor) },
      }],
    });
  });

  ws.dataValidations.add(`V${r0}:V${ult}`, {
    type: "list", allowBlank: true, formulae: [`"${STATUS.map(([n]) => n).join(",")}"`],
  });
  ws.dataValidations.add(`H${r0}:H${ult}`, {
    type: "list", allowBlank: true, formulae: ['"ALTA,MÉDIA,BAIXA"'],
  });

  const lg = ult + 2;
  const titLegenda = ws.getCell(lg, 1);
  titLegenda.value = "LEGENDA DO STATUS";
  titLegenda.font = { bold: true, size: 9, color: { argb: "FF" + NAVY } };
  STATUS.forEach(([n, cor], i) => {
    const cel = ws.getCell(lg + 1 + i, 1);
    cel.value = n;
    cel.fill = preenche(cor);
    cel.font = { size: 9, bold: true };
    cel.border = BORDA;
    ws.mergeCells(lg + 1 + i, 1, lg + 1 + i, 2);
  });

  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 5 }];
  ws.pageSetup = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0, fitToPage: true };
}

function matriz(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("MATRIZ DE RISCO 5X5");
  ws.mergeCells("A1:H1");
  const a1 = ws.getCell("A1");
  a1.value = "MATRIZ DE RISCO 5x5 – NÍVEL DE RISCO = PROBABILIDADE x SEVERIDADE";
  a1.font = { bold: true, size: 13, color: { argb: "FF" + NAVY } };
  a1.alignment = CENTRO;

  cab(ws, 3, 4, "SEVERIDADE", { c2: 8 });
  ["Leve (1)", "Baixa (2)", "Moderada (3)", "Alta (4)", "Extrema (5)"].forEach((s, i) =>
    cab(ws, 4, 4 + i, s, { cor: "1B3F63" }));
  cab(ws, 5, 1, "PROBABILIDADE", { r2: 9 });

  const probs: [string, number][] = [
    ["Muito Provável", 5], ["Provável", 4], ["Possível", 3], ["Pouco Provável", 2], ["Rara", 1],
  ];
  probs.forEach(([nome, p], k) => {
    cab(ws, 5 + k, 2, nome, { cor: "1B3F63" });
    cab(ws, 5 + k, 3, String(p), { cor: "1B3F63" });
    ws.getCell(5 + k, 3).value = p;
    for (let s = 1; s <= 5; s++) {
      const v = p * s;
      const cor = NIVEIS.find(([a, b]) => a <= v && v <= b)![3];
      const cel = ws.getCell(5 + k, 3 + s);
      cel.value = v;
      cel.fill = preenche(cor);
      cel.alignment = CENTRO;
      cel.border = BORDA;
      cel.font = {
        bold: true, size: 12,
        color: { argb: cor === "C00000" ? "FFFFFFFF" : "FF000000" },
      };
    }
    ws.getRow(5 + k).height = 28;
  });

  cab(ws, 12, 1, "NÍVEL DO RISCO", { c2: 2 });
  cab(ws, 12, 3, "CLASSIFICAÇÃO", { c2: 4 });
  cab(ws, 12, 5, "TRATAMENTO NO PLANO DE AÇÃO", { c2: 8 });
  NIVEIS.forEach(([a, b, n, cor, acao], k) => {
    const r = 13 + k;
    ([[1, 2, `${a} a ${b}`, cor], [3, 4, n, cor], [5, 8, acao, null]] as const).forEach(
      ([c1, c2, v, f]) => {
        ws.mergeCells(r, c1 as number, r, c2 as number);
        ws.getCell(r, c1 as number).value = v as string;
        for (let cc = c1 as number; cc <= (c2 as number); cc++) {
          const x = ws.getCell(r, cc);
          x.border = BORDA;
          x.alignment = f ? CENTRO : ESQ;
          if (f) x.fill = preenche(f as string);
        }
        ws.getCell(r, c1 as number).font = {
          bold: Boolean(f), size: 10,
          color: { argb: f === "C00000" ? "FFFFFFFF" : "FF000000" },
        };
      },
    );
  });

  [14, 16, 6, 14, 14, 14, 14, 14].forEach((w, i) => largura(ws, i + 1, w));
}

/** Monta a pasta de trabalho inteira. `dados` vazio dá o modelo em branco. */
export function montarPlanilha(dados: DadosPlanilha = {}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const emp = dados.empresa ?? {};
  inventario(wb, dados.inventario, emp);
  plano(wb, dados.plano, emp);
  matriz(wb);
  return wb;
}

/** A planilha pronta para download no navegador. */
export async function gerarPlanilhaBlob(dados: DadosPlanilha = {}): Promise<Blob> {
  const buffer = await montarPlanilha(dados).xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Mesma planilha em Buffer — usada pelos testes em Node. */
export async function gerarPlanilhaBuffer(dados: DadosPlanilha = {}): Promise<Buffer> {
  return Buffer.from(await montarPlanilha(dados).xlsx.writeBuffer());
}

/** Nome do arquivo, no formato do pacote. */
export function nomePlanilha(dados: DadosPlanilha = {}): string {
  const sufixo = (dados.empresa?.ARQUIVO as string) || "Modelo";
  return `Inventario_${sufixo}.xlsx`;
}

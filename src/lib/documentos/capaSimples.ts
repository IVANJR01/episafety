/*
 * Capa "Simples" com moldura — a capa oficial de todos os documentos SST.
 *
 * Porte fiel da função `simples` de ferramentas/documentos/gerador/niveis.js.
 * Só muda o nome do documento; o resto é igual em PGR, PCMSO, AET, AEP e nos
 * dois laudos. As medidas estão em DXA (1/20 de ponto), como no original — não
 * converter para px ou mm, senão a moldura sai de lugar.
 */
import {
  AlignmentType,
  BorderStyle,
  HeightRule,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { campo } from "./campos";

export const FONT = "Calibri";
/** Folha A4 em DXA. */
export const LARGURA_PAGINA = 11906;
export const ALTURA_PAGINA = 16838;

const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const noB = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const cellNoB = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const line = (c: string, s = 4) => ({ style: BorderStyle.SINGLE, size: s, color: c });
const t = (text: string, o: any = {}) => new TextRun({ text, font: o.font || FONT, ...o });
const p = (runs: any, o: any = {}) =>
  new Paragraph({ children: Array.isArray(runs) ? runs : [runs], ...o });
const sp = (after = 0) => p([t("", { size: 2 })], { spacing: { before: 0, after, line: 240 } });

const cell = (children: any, o: any = {}) =>
  new TableCell({
    children: Array.isArray(children) ? children : [children],
    width: { size: o.w, type: WidthType.DXA },
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    verticalAlign: o.va || VerticalAlign.CENTER,
    margins: o.m || { top: 80, bottom: 80, left: 140, right: 140 },
    borders: o.borders || cellNoB,
    columnSpan: o.span,
  });

const table = (widths: number[], rows: TableRow[], o: any = {}) =>
  new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: o.borders || noB,
    rows,
  });

const row = (cells: any[], h?: number, rule: any = HeightRule.EXACT) =>
  new TableRow({ cantSplit: true, height: h ? { value: h, rule } : undefined, children: cells });

const dashed = (c: string) => ({ style: BorderStyle.DASHED, size: 6, color: c });

/** Caixa tracejada onde entra a logo da empresa. */
const logoBox = (w: number, h: number, c = "9AA8B5", fill = "F3F5F7", tc = "1F6FB2") =>
  table(
    [w],
    [
      row(
        [
          cell([p([campo("LOGO_EMPRESA", { size: 16, color: tc })], { alignment: AlignmentType.CENTER })], {
            w,
            fill,
            borders: { top: dashed(c), bottom: dashed(c), left: dashed(c), right: dashed(c) },
          }),
        ],
        h,
      ),
    ],
  );

/** Sigla curta (PGR, AET) ganha letra gigante; nome longo, letra menor. */
const grande = (d: { titulo: string }) => d.titulo.length <= 6;
const ctr = AlignmentType.CENTER;

export interface CapaDoc {
  titulo: string;
  nome: string;
  norma: string;
}

export function simples(d: CapaDoc) {
  const K = "222222",
    G = "666666",
    CW = LARGURA_PAGINA - 2 * 1418;
  const linhaTab = (k: string, v: any) =>
    row(
      [
        cell([p([t(k, { size: 20, bold: true, color: K })])], {
          w: 2600,
          borders: { top: line("BBBBBB"), bottom: line("BBBBBB"), left: line("BBBBBB"), right: line("BBBBBB") },
        }),
        cell([p(v)], {
          w: CW - 2600,
          borders: { top: line("BBBBBB"), bottom: line("BBBBBB"), left: line("BBBBBB"), right: line("BBBBBB") },
        }),
      ],
      440,
      HeightRule.ATLEAST,
    );
  const lg = 2800;
  return {
    margin: 1418,
    moldura: "222222",
    children: [
      table(
        [(CW - lg) / 2, lg, (CW - lg) / 2],
        [
          row(
            [
              cell([p([t("")])], { w: (CW - lg) / 2 }),
              cell([logoBox(lg, 1000, "AAAAAA", "FFFFFF")], { w: lg, m: { top: 0, bottom: 0, left: 0, right: 0 } }),
              cell([p([t("")])], { w: (CW - lg) / 2 }),
            ],
            1000,
          ),
        ],
      ),
      sp(2600),
      p([t(d.titulo, { size: grande(d) ? 96 : 48, bold: true, color: K })], {
        alignment: ctr,
        spacing: { after: 120 },
      }),
      p([t(d.nome, { size: 30, color: K })], { alignment: ctr, spacing: { after: 80 } }),
      p([t(d.norma, { size: 22, color: G })], { alignment: ctr, spacing: { after: 300 } }),
      p(
        [
          t("Vigência: ", { size: 22, color: G }),
          campo("VIGENCIA_INICIO", { size: 22 }),
          t(" a ", { size: 22, color: G }),
          campo("VIGENCIA_FIM", { size: 22 }),
        ],
        { alignment: ctr, spacing: { after: grande(d) ? 2600 : 2900 } },
      ),
      table(
        [2600, CW - 2600],
        [
          linhaTab("Empresa", [campo("RAZAO_SOCIAL", { size: 20 })]),
          linhaTab("CNPJ", [campo("CNPJ", { size: 20 })]),
          linhaTab("Endereço", [
            campo("ENDERECO", { size: 20 }),
            t(" – ", { size: 20 }),
            campo("CIDADE", { size: 20 }),
            t("/", { size: 20 }),
            campo("UF", { size: 20 }),
          ]),
          linhaTab("Responsável Técnico", [
            campo("RESPONSAVEL_NOME", { size: 20 }),
            t(" – ", { size: 20 }),
            campo("RESPONSAVEL_REGISTRO", { size: 20 }),
          ]),
          linhaTab("Revisão / Data", [
            campo("REVISAO", { size: 20 }),
            t(" – ", { size: 20 }),
            campo("DATA_EMISSAO", { size: 20 }),
          ]),
        ],
      ),
      sp(1200),
      p(
        [
          campo("CIDADE", { size: 20, color: G }),
          t(" / ", { size: 20, color: G }),
          campo("UF", { size: 20, color: G }),
          t(" – ", { size: 20, color: G }),
          campo("ANO", { size: 20, color: G }),
        ],
        { alignment: ctr },
      ),
    ],
  };
}

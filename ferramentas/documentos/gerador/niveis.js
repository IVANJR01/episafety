// Capas em 3 níveis: Simples, Médio e Top. Uso: node niveis.js <saida> [SIGLAS...]
const fs = require('fs');
const path = require('path');
const { PageBorderDisplay, PageBorderOffsetFrom, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign, HeightRule, Document } = require('docx');
const FONT = 'Calibri', SERIF = 'Cambria', MARCA = 'SafetySoluções', W = 11906, H = 16838;
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noB = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const cellNoB = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const line = (c, s = 4) => ({ style: BorderStyle.SINGLE, size: s, color: c });
const t = (text, o = {}) => new TextRun({ text, font: o.font || FONT, ...o });
const p = (runs, o = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [runs], ...o });
const sp = (after = 0) => p([t('', { size: 2 })], { spacing: { before: 0, after, line: 240 } });
const fim = () => new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: 'exact' }, children: [t('', { size: 2 })] });
const campo = (nome, o = {}) => { const v = (globalThis.VALORES || {})[nome]; return v ? t(String(v), { ...o, color: o.color && o.color !== '1F6FB2' ? o.color : undefined }) : t(`{{${nome}}}`, { color: '1F6FB2', ...o }); };
const cell = (children, o = {}) => new TableCell({ children: Array.isArray(children) ? children : [children], width: { size: o.w, type: WidthType.DXA },
  shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined, verticalAlign: o.va || VerticalAlign.CENTER,
  margins: o.m || { top: 80, bottom: 80, left: 140, right: 140 }, borders: o.borders || cellNoB, columnSpan: o.span });
const table = (widths, rows, o = {}) => new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, borders: o.borders || noB, rows });
const row = (cells, h, rule = HeightRule.EXACT) => new TableRow({ cantSplit: true, height: h ? { value: h, rule } : undefined, children: cells });
const dashed = (c) => ({ style: BorderStyle.DASHED, size: 6, color: c });
const logoBox = (w, h, c = '9AA8B5', fill = 'F3F5F7', tc = '1F6FB2') => table([w], [row([cell([p([campo('LOGO_EMPRESA', { size: 16, color: tc })], { alignment: AlignmentType.CENTER })], { w, fill, borders: { top: dashed(c), bottom: dashed(c), left: dashed(c), right: dashed(c) } })], h)]);
const grande = (d) => d.titulo.length <= 6;
const ctr = AlignmentType.CENTER;

// ================= SIMPLES =================
function simples(d) {
  const K = '222222', G = '666666', CW = W - 2 * 1418;
  const linhaTab = (k, v) => row([cell([p([t(k, { size: 20, bold: true, color: K })])], { w: 2600, borders: { top: line('BBBBBB'), bottom: line('BBBBBB'), left: line('BBBBBB'), right: line('BBBBBB') } }),
    cell([p(v)], { w: CW - 2600, borders: { top: line('BBBBBB'), bottom: line('BBBBBB'), left: line('BBBBBB'), right: line('BBBBBB') } })], 440, HeightRule.ATLEAST);
  const lg = 2800;
  return { margin: 1418, moldura: '222222', children: [
    table([(CW - lg) / 2, lg, (CW - lg) / 2], [row([cell([p([t('')])], { w: (CW - lg) / 2 }), cell([logoBox(lg, 1000, 'AAAAAA', 'FFFFFF')], { w: lg, m: { top: 0, bottom: 0, left: 0, right: 0 } }), cell([p([t('')])], { w: (CW - lg) / 2 })], 1000)]),
    sp(2600),
    p([t(d.titulo, { size: grande(d) ? 96 : 48, bold: true, color: K })], { alignment: ctr, spacing: { after: 120 } }),
    p([t(d.nome, { size: 30, color: K })], { alignment: ctr, spacing: { after: 80 } }),
    p([t(d.norma, { size: 22, color: G })], { alignment: ctr, spacing: { after: 300 } }),
    p([t('Vigência: ', { size: 22, color: G }), campo('VIGENCIA_INICIO', { size: 22 }), t(' a ', { size: 22, color: G }), campo('VIGENCIA_FIM', { size: 22 })], { alignment: ctr, spacing: { after: grande(d) ? 2600 : 2900 } }),
    table([2600, CW - 2600], [
      linhaTab('Empresa', [campo('RAZAO_SOCIAL', { size: 20 })]),
      linhaTab('CNPJ', [campo('CNPJ', { size: 20 })]),
      linhaTab('Endereço', [campo('ENDERECO', { size: 20 }), t(' – ', { size: 20 }), campo('CIDADE', { size: 20 }), t('/', { size: 20 }), campo('UF', { size: 20 })]),
      linhaTab('Responsável Técnico', [campo('RESPONSAVEL_NOME', { size: 20 }), t(' – ', { size: 20 }), campo('RESPONSAVEL_REGISTRO', { size: 20 })]),
      linhaTab('Revisão / Data', [campo('REVISAO', { size: 20 }), t(' – ', { size: 20 }), campo('DATA_EMISSAO', { size: 20 })]),
    ]),
    sp(1200),
    p([campo('CIDADE', { size: 20, color: G }), t(' / ', { size: 20, color: G }), campo('UF', { size: 20, color: G }), t(' – ', { size: 20, color: G }), campo('ANO', { size: 20, color: G })], { alignment: ctr }),
  ] };
}

// ================= MÉDIO =================
function medio(d) {
  const N = '1D4E89', N2 = '163C6B', AC = 'F5A623', L = 'EEF3F9', G = '5B6770', CW = W;
  const topo = table([W], [row([cell([
    table([W - 2 * 900 - 3200, 3200], [row([
      cell([p([t(MARCA, { size: 32, bold: true, color: 'FFFFFF' })]), p([t('Segurança e Saúde no Trabalho', { size: 18, color: 'C7D7EA' })])], { w: W - 2 * 900 - 3200, m: { top: 0, bottom: 0, left: 0, right: 0 } }),
      cell([logoBox(3000, 1000, 'C7D7EA', N2, 'FFFFFF')], { w: 3200, m: { top: 0, bottom: 0, left: 200, right: 0 } }),
    ], 1100)]),
  ], { w: W, fill: N, m: { top: 0, bottom: 0, left: 900, right: 900 } })], 2300)]);
  const acento = table([W], [row([cell([p([t('', { size: 2 })])], { w: W, fill: AC, m: { top: 0, bottom: 0, left: 0, right: 0 } })], 120)]);
  const IW = W - 1800;
  const lin = (k, v) => row([cell([p([t(k, { size: 19, bold: true, color: N })])], { w: 2700, fill: L, borders: { ...cellNoB, bottom: line('FFFFFF', 12) } }), cell([p(v)], { w: IW - 2700, borders: { ...cellNoB, bottom: line('D5DEE8') } })], 460, HeightRule.ATLEAST);
  const corpo = cell([
    sp(2500),
    p([t(`DOCUMENTO TÉCNICO  •  ${d.norma}`, { size: 18, bold: true, color: AC, characterSpacing: 50 })], { spacing: { after: 160 } }),
    p([t(d.titulo, { size: grande(d) ? 120 : 56, bold: true, color: N })], { spacing: { after: 120 } }),
    p([t(d.nome, { size: 32, color: G })], { spacing: { after: 240 } }),
    new Paragraph({ border: { top: line(AC, 18) }, indent: { right: IW - 1500 }, children: [t('')] }),
    p([t('Vigência: ', { size: 22, bold: true, color: N }), campo('VIGENCIA_INICIO', { size: 22 }), t(' a ', { size: 22 }), campo('VIGENCIA_FIM', { size: 22 })], { spacing: { after: grande(d) ? 2300 : 2600 } }),
    table([2700, IW - 2700], [
      lin('Razão Social', [campo('RAZAO_SOCIAL', { size: 20, bold: true })]),
      lin('CNPJ', [campo('CNPJ', { size: 20 })]),
      lin('Endereço', [campo('ENDERECO', { size: 20 }), t(' – ', { size: 20 }), campo('CIDADE', { size: 20 }), t('/', { size: 20 }), campo('UF', { size: 20 })]),
      lin('Responsável Técnico', [campo('RESPONSAVEL_NOME', { size: 20 }), t(' – ', { size: 20 }), campo('RESPONSAVEL_REGISTRO', { size: 20 })]),
      lin('Revisão / Emissão', [campo('REVISAO', { size: 20 }), t('  •  ', { size: 20, color: AC }), campo('DATA_EMISSAO', { size: 20 })]),
    ]),
  ], { w: W, va: VerticalAlign.TOP, m: { top: 0, bottom: 0, left: 900, right: 900 } });
  const base = cell([p([campo('CIDADE', { size: 20, color: 'FFFFFF' }), t(' / ', { size: 20, color: 'FFFFFF' }), campo('UF', { size: 20, color: 'FFFFFF' }), t('   •   ', { size: 20, color: AC }), campo('ANO', { size: 20, color: 'FFFFFF' })], { alignment: ctr })], { w: W, fill: N });
  return { margin: 0, children: [table([W], [row([cell([topo, acento], { w: W, m: { top: 0, bottom: 0, left: 0, right: 0 } })], 2420), row([corpo], H - 2420 - 900 - 40), row([base], 900)]), fim()] };
}

// ================= TOP =================
function top(d) {
  const BG = '0A1626', BG2 = '12233A', GD = 'D4AF37', GD2 = 'B8962E', TX = 'E9EEF5', MU = '8C9BB0';
  const IW = W - 2 * 1000;
  const lbl = (s) => p([t(s, { size: 14, bold: true, color: GD, characterSpacing: 80 })], { spacing: { after: 80 } });
  const card = (lb, linhas, w) => cell([lbl(lb), ...linhas.map((r) => p(r))], { w, fill: BG2, va: VerticalAlign.TOP, borders: { ...cellNoB, top: line(GD, 12) }, m: { top: 220, bottom: 200, left: 260, right: 200 } });
  const gap = (w = 240) => cell([p([t('', { size: 2 })])], { w, m: { top: 0, bottom: 0, left: 0, right: 0 } });
  const h3 = Math.floor((IW - 480) / 3), h3b = IW - 480 - 2 * h3;
  const w = (s, o = {}) => campo(s, { color: TX, ...o });
  const cards = table([h3, 240, h3, 240, h3b], [row([
    card('EMPRESA', [[w('RAZAO_SOCIAL', { size: 20, bold: true })], [t('CNPJ ', { size: 16, color: MU }), w('CNPJ', { size: 16 })]], h3), gap(),
    card('LOCAL', [[w('ENDERECO', { size: 17 })], [w('CIDADE', { size: 17 }), t(' / ', { size: 17, color: MU }), w('UF', { size: 17 })]], h3), gap(),
    card('RESPONSÁVEL TÉCNICO', [[w('RESPONSAVEL_NOME', { size: 19, bold: true })], [w('RESPONSAVEL_REGISTRO', { size: 16 })]], h3b),
  ], 1500, HeightRule.ATLEAST)]);
  const topo = table([IW / 2, IW / 2], [row([
    cell([logoBox(2800, 950, '5D6F88', BG2, TX)], { w: IW / 2, m: { top: 0, bottom: 0, left: 0, right: 0 } }),
    cell([p([t(MARCA.toUpperCase(), { size: 22, bold: true, color: GD, characterSpacing: 60 })], { alignment: AlignmentType.RIGHT }), p([t('SEGURANÇA E SAÚDE NO TRABALHO', { size: 14, color: MU, characterSpacing: 60 })], { alignment: AlignmentType.RIGHT })], { w: IW / 2, m: { top: 0, bottom: 0, left: 0, right: 0 } }),
  ], 950)]);
  const selo = table([1500, IW - 1500], [row([
    cell([p([t(d.norma, { size: 26, bold: true, color: BG })], { alignment: ctr })], { w: 1500, fill: GD, m: { top: 60, bottom: 60, left: 60, right: 60 } }),
    cell([p([t('DOCUMENTO TÉCNICO OFICIAL', { size: 16, bold: true, color: GD, characterSpacing: 100 })])], { w: IW - 1500, m: { top: 0, bottom: 0, left: 300, right: 0 } }),
  ], 560)]);
  const conteudo = cell([
    topo,
    sp(grande(d) ? 2600 : 3000),
    selo,
    sp(300),
    p([t(d.titulo, { size: grande(d) ? 200 : 70, bold: true, color: 'FFFFFF' })], { spacing: { after: grande(d) ? 0 : 160 } }),
    p([t(d.nome, { size: 36, color: GD, font: SERIF, italics: true })], { spacing: { after: 400 } }),
    new Paragraph({ border: { top: line(GD, 6) }, children: [t('')], spacing: { after: 160 } }),
    table([IW / 2, IW / 2], [row([
      cell([lbl('VIGÊNCIA'), p([w('VIGENCIA_INICIO', { size: 26, bold: true }), t('  —  ', { size: 26, color: GD }), w('VIGENCIA_FIM', { size: 26, bold: true })])], { w: IW / 2, va: VerticalAlign.TOP, m: { top: 0, bottom: 0, left: 0, right: 0 } }),
      cell([p([t('REVISÃO  ', { size: 14, bold: true, color: GD, characterSpacing: 80 }), w('REVISAO', { size: 20 })], { alignment: AlignmentType.RIGHT, spacing: { after: 80 } }), p([t('EMISSÃO  ', { size: 14, bold: true, color: GD, characterSpacing: 80 }), w('DATA_EMISSAO', { size: 20 })], { alignment: AlignmentType.RIGHT })], { w: IW / 2, va: VerticalAlign.TOP, m: { top: 0, bottom: 0, left: 0, right: 0 } }),
    ], 900)]),
    sp(grande(d) ? 2900 : 3200),
    cards,
    sp(1000),
    p([w('CIDADE', { size: 18, color: MU }), t(' / ', { size: 18, color: MU }), w('UF', { size: 18, color: MU }), t('   ◆   ', { size: 14, color: GD }), w('ANO', { size: 18, color: MU })], { alignment: ctr }),
  ], { w: W - 160, fill: BG, va: VerticalAlign.TOP, m: { top: 1000, bottom: 600, left: 1000, right: 1000 } });
  const filete = cell([p([t('', { size: 2 })])], { w: 160, fill: GD, m: { top: 0, bottom: 0, left: 0, right: 0 } });
  return { margin: 0, children: [table([160, W - 160], [row([filete, conteudo], H - 40)]), fim()] };
}

const NIVEIS = [['1_Simples', simples], ['2_Medio', medio], ['3_Top', top]];
function docCapa(d, fn) {
  const c = fn(d);
  const page = { size: { width: W, height: H }, margin: { top: c.margin, bottom: c.margin, left: c.margin, right: c.margin, header: 0, footer: 0 } };
  if (c.moldura) {
    const b = { style: BorderStyle.SINGLE, size: 12, color: c.moldura, space: 28 };
    page.borders = { pageBorderTop: b, pageBorderBottom: b, pageBorderLeft: b, pageBorderRight: b, pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: PageBorderOffsetFrom.PAGE } };
  }
  return new Document({ styles: { default: { document: { run: { font: FONT, size: 22, color: '222B33' } } } },
    sections: [{ properties: { page }, children: c.children }] });
}
module.exports = { NIVEIS, docCapa, simples };
if (require.main === module) {
  const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
  const docs = require('./docs.js');
  const alvo = process.argv.length > 3 ? docs.filter((d) => process.argv.slice(3).includes(d.sigla)) : [docs[0]];
  (async () => { for (const d of alvo) for (const [n, fn] of NIVEIS) fs.writeFileSync(path.join(OUT, `Capa_${n}_${d.sigla}.docx`), await Packer.toBuffer(docCapa(d, fn))); console.log('ok'); })();
}

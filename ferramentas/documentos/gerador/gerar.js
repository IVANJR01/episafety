const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, AlignmentType, VerticalAlign, HeadingLevel, Header, Footer, PageNumber,
  TableOfContents, PageBreak, HeightRule, TableLayoutType, LevelFormat, PageOrientation,
} = require('docx');

const OUT = process.argv[2] || 'out';
const { simples } = require('./niveis.js');
const { PageBorderDisplay, PageBorderOffsetFrom } = require('docx');
fs.mkdirSync(OUT, { recursive: true });

// Paleta (igual em todos os documentos)
const NAVY = '0F2A44';
const NAVY2 = '1B3F63';
const ACCENT = 'F2A900'; // amarelo segurança
const GREEN = '1E9E6A';
const GRAY = '5B6770';
const LIGHT = 'EEF2F6';
const LINE = 'C9D3DD';
const FONT = 'Calibri';
const MARCA = 'SafetySoluções';

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const thin = (c = LINE) => ({ style: BorderStyle.SINGLE, size: 4, color: c });

const t = (text, o = {}) => new TextRun({ text, font: FONT, ...o });
const p = (runs, o = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [runs], ...o });
const sp = (after = 0, before = 0) => p([t('')], { spacing: { before, after } });
// campo editável: destacado em azul para o usuário achar fácil
const campo = (nome, o = {}) => { const v = (globalThis.VALORES || {})[nome]; return v ? t(String(v), { ...o, color: o.color && o.color !== '1F6FB2' ? o.color : undefined }) : t(`{{${nome}}}`, { color: '1F6FB2', ...o }); };

function cell(children, o = {}) {
  return new TableCell({
    children: Array.isArray(children) ? children : [children],
    width: { size: o.w, type: WidthType.DXA },
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    verticalAlign: o.va || VerticalAlign.CENTER,
    margins: o.m || { top: 80, bottom: 80, left: 140, right: 140 },
    borders: o.borders,
    columnSpan: o.span,
  });
}

// ---------- CAPA ----------
const CW = 10466; // largura útil da capa (margens de 1,27 cm)

function capa(d) {
  const grande = d.titulo.length <= 6;
  const topo = new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [3600, 6866], borders: noBorders,
    rows: [new TableRow({
      height: { value: 1300, rule: HeightRule.ATLEAST },
      children: [
        cell([p([campo('LOGO_EMPRESA', { size: 18 })], { alignment: AlignmentType.CENTER })], {
          w: 3600, fill: LIGHT,
          borders: { top: { style: BorderStyle.DASHED, size: 6, color: '9AA8B5' }, bottom: { style: BorderStyle.DASHED, size: 6, color: '9AA8B5' }, left: { style: BorderStyle.DASHED, size: 6, color: '9AA8B5' }, right: { style: BorderStyle.DASHED, size: 6, color: '9AA8B5' } },
        }),
        cell([
          p([t(MARCA, { bold: true, size: 30, color: NAVY })], { alignment: AlignmentType.RIGHT }),
          p([t('SEGURANÇA E SAÚDE NO TRABALHO', { size: 16, color: GRAY, characterSpacing: 40 })], { alignment: AlignmentType.RIGHT }),
        ], { w: 6866, borders: noBorders }),
      ],
    })],
  });

  const faixaTxt = [
    p([t(`DOCUMENTO TÉCNICO  •  ${d.norma}`, { size: 18, color: ACCENT, bold: true, characterSpacing: 60 })], { spacing: { after: 200 } }),
    p([t(d.titulo, { size: grande ? 150 : 64, bold: true, color: 'FFFFFF' })], { spacing: { before: grande ? 120 : 0, after: grande ? 60 : 160 } }),
    p([t(d.nome, { size: 34, color: 'FFFFFF' })], { spacing: { after: 300 } }),
    new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 } }, spacing: { after: 0 }, indent: { right: 5200 }, children: [t('')] }),
    p([t('VIGÊNCIA  ', { size: 18, color: 'B8C7D6', bold: true, characterSpacing: 40 }), campo('VIGENCIA_INICIO', { color: 'FFFFFF', size: 22 }), t('  a  ', { color: 'B8C7D6', size: 22 }), campo('VIGENCIA_FIM', { color: 'FFFFFF', size: 22 })]),
  ];
  const faixa = new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [260, 10206], borders: noBorders,
    rows: [new TableRow({
      height: { value: 6200, rule: HeightRule.EXACT },
      children: [
        cell([p([t('')])], { w: 260, fill: ACCENT, m: { top: 0, bottom: 0, left: 0, right: 0 } }),
        cell(faixaTxt, { w: 10206, fill: NAVY, m: { top: 300, bottom: 300, left: 700, right: 500 } }),
      ],
    })],
  });

  const rotulo = (txt) => p([t(txt, { size: 18, bold: true, color: GREEN, characterSpacing: 60 })], { spacing: { before: 0, after: 120 } });
  const linhaEmp = (k, v, last) => new TableRow({ children: [
    cell([p([t(k, { size: 19, bold: true, color: NAVY })])], { w: 2700, fill: LIGHT, borders: { top: NONE, left: NONE, right: NONE, bottom: last ? thin() : { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' } } }),
    cell([p(v)], { w: 7766, borders: { top: NONE, left: NONE, right: NONE, bottom: thin() } }),
  ] });
  const empresa = new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [2700, 7766], borders: noBorders,
    rows: [
      linhaEmp('Razão Social', [campo('RAZAO_SOCIAL', { size: 21, bold: true })]),
      linhaEmp('Nome Fantasia', [campo('NOME_FANTASIA', { size: 21 })]),
      linhaEmp('CNPJ', [campo('CNPJ', { size: 21 })]),
      linhaEmp('Endereço', [campo('ENDERECO', { size: 21 }), t(' – ', { size: 21 }), campo('BAIRRO', { size: 21 })]),
      linhaEmp('Cidade / UF', [campo('CIDADE', { size: 21 }), t(' / ', { size: 21 }), campo('UF', { size: 21 }), t('   CEP ', { size: 21, color: GRAY }), campo('CEP', { size: 21 })], true),
    ],
  });

  const box = (lbl, vals, w, fill) => cell([
    p([t(lbl, { size: 15, bold: true, color: fill === NAVY ? ACCENT : GRAY, characterSpacing: 40 })], { spacing: { after: 60 } }),
    ...vals.map((v) => p(v)),
  ], { w, fill, va: VerticalAlign.TOP, m: { top: 160, bottom: 160, left: 200, right: 200 } });
  const rodape = new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [5200, 2633, 2633], borders: { ...noBorders, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF' } },
    rows: [new TableRow({ children: [
      box('RESPONSÁVEL TÉCNICO', [
        [campo('RESPONSAVEL_NOME', { size: 21, bold: true, color: 'FFFFFF' })],
        [t(d.profissional + ' – ', { size: 18, color: 'B8C7D6' }), campo('RESPONSAVEL_REGISTRO', { size: 18, color: 'FFFFFF' })],
      ], 5200, NAVY),
      box('REVISÃO', [[campo('REVISAO', { size: 21, bold: true })]], 2633, LIGHT),
      box('DATA DE EMISSÃO', [[campo('DATA_EMISSAO', { size: 21, bold: true })]], 2633, LIGHT),
    ] })],
  });

  return [
    topo,
    sp(600),
    faixa,
    sp(700),
    rotulo('EMPRESA CONTRATANTE'),
    empresa,
    sp(900),
    rodape,
    sp(0, 300),
    p([campo('CIDADE', { size: 20, color: GRAY }), t(' / ', { size: 20, color: GRAY }), campo('UF', { size: 20, color: GRAY }), t('  •  ', { size: 20, color: ACCENT }), campo('ANO', { size: 20, color: GRAY })], { alignment: AlignmentType.CENTER }),
  ];
}

// ---------- CORPO ----------
const BW = 9638; // largura útil (margens de 2 cm)

const h1 = (txt, pb) => new Paragraph({ pageBreakBefore: !!pb, keepNext: true, heading: HeadingLevel.HEADING_1, numbering: { reference: 'secoes', level: 0 }, children: [t(txt)] });
const h2 = (txt) => new Paragraph({ keepNext: true, heading: HeadingLevel.HEADING_2, numbering: { reference: 'secoes', level: 1 }, children: [t(txt)] });
const corpo = (txt) => p([t(txt, { size: 22 })], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 300 } });
const guia = (txt) => p([t(txt, { size: 21, italics: true, color: '7A8590' })], { keepNext: true, alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 300 } });

function tabelaCampos(linhas, w1 = 3000) {
  const w2 = BW - w1;
  return new Table({
    width: { size: BW, type: WidthType.DXA }, columnWidths: [w1, w2],
    borders: { top: thin(), bottom: thin(), left: thin(), right: thin(), insideHorizontal: thin(), insideVertical: thin() },
    rows: linhas.map(([k, v]) => new TableRow({ children: [
      cell([p([t(k, { size: 20, bold: true, color: NAVY })])], { w: w1, fill: LIGHT }),
      cell([p([campo(v, { size: 20 })])], { w: w2 }),
    ] })),
  });
}

function tabelaGrade(cabec, larguras, linhas, fs = 18) {
  const head = new TableRow({ tableHeader: true, children: cabec.map((c, i) => cell([p([t(c, { size: fs, bold: true, color: 'FFFFFF' })], { alignment: AlignmentType.CENTER })], { w: larguras[i], fill: NAVY })) });
  const rows = linhas.map((l, r) => new TableRow({ height: { value: 400, rule: HeightRule.ATLEAST }, children: l.map((v, i) => cell([p(v ? [campo(v, { size: fs })] : [t('', { size: fs })], { alignment: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT })], { w: larguras[i], fill: r % 2 ? 'F7F9FB' : undefined })) }));
  return new Table({
    width: { size: BW, type: WidthType.DXA }, columnWidths: larguras,
    borders: { top: thin(), bottom: thin(), left: thin(), right: thin(), insideHorizontal: thin(), insideVertical: thin() },
    rows: [head, ...rows],
  });
}


// Matriz de risco 5x5 (Probabilidade x Severidade) – mesmos níveis e cores da planilha de inventário
const NIVEIS = [[1, 3, 'TRIVIAL', '00B0F0', 'Nenhuma ação necessária.'], [4, 8, 'TOLERÁVEL', '92D050', 'Nenhum controle adicional necessário.'],
  [9, 12, 'MODERADO', 'FFFF00', 'Controle adicional, se possível/viável.'], [13, 15, 'SUBSTANCIAL', 'FFC000', 'Controle necessário.'],
  [16, 25, 'INTOLERÁVEL', 'C00000', 'Ação imediata ou interrupção da atividade.']];
const nivel = (v) => NIVEIS.find(([a, b]) => v >= a && v <= b);
const CORES = (v) => nivel(v)[3];
const txtCor = (cor) => (cor === 'C00000' ? 'FFFFFF' : '000000');
function matriz(W = BW) {
  const k = W / BW, ws = [1900, 1400, 1268, 1268, 1268, 1268, 1266].map((x) => Math.round(x * k)); ws[6] = W - ws.slice(0, 6).reduce((a, b) => a + b, 0);
  const b = { top: thin('FFFFFF'), bottom: thin('FFFFFF'), left: thin('FFFFFF'), right: thin('FFFFFF'), insideHorizontal: thin('FFFFFF'), insideVertical: thin('FFFFFF') };
  const c = (txt, w, o = {}) => cell([p([t(txt, { size: o.size || 17, bold: !!o.bold, color: o.color || '222B33' })], { alignment: AlignmentType.CENTER })], { w, fill: o.fill });
  const sev = ['Leve', 'Baixa', 'Moderada', 'Alta', 'Extrema'];
  const prob = [['Muito Provável', 5], ['Provável', 4], ['Possível', 3], ['Pouco Provável', 2], ['Rara', 1]];
  const rows = [
    new TableRow({ children: [c('', ws[0]), c('', ws[1]), new TableCell({ columnSpan: 5, width: { size: ws.slice(2).reduce((a, b) => a + b, 0), type: WidthType.DXA }, shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' }, children: [p([t('SEVERIDADE', { size: 17, bold: true, color: 'FFFFFF' })], { alignment: AlignmentType.CENTER })] })] }),
    new TableRow({ children: [c('', ws[0]), c('', ws[1]), ...sev.map((s, i) => c(`${s} (${i + 1})`, ws[i + 2], { fill: LIGHT, bold: true }))] }),
    ...prob.map(([nome, pv], r) => new TableRow({ height: { value: 400, rule: HeightRule.ATLEAST }, children: [
      r === 0 ? new TableCell({ rowSpan: 5, width: { size: ws[0], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' }, children: [p([t('PROBABILIDADE', { size: 17, bold: true, color: 'FFFFFF' })], { alignment: AlignmentType.CENTER })] }) : null,
      c(`${nome} (${pv})`, ws[1], { fill: LIGHT, bold: true, size: 16 }),
      ...[1, 2, 3, 4, 5].map((sv, i) => c(String(pv * sv), ws[i + 2], { fill: CORES(pv * sv), bold: true, size: 20, color: txtCor(CORES(pv * sv)) })),
    ].filter(Boolean) })),
  ];
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: ws, borders: b, rows });
}
function legenda(W = BW) {
  const ws = [1200, 1600, W - 2800];
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: ws,
    borders: { top: thin(), bottom: thin(), left: thin(), right: thin(), insideHorizontal: thin(), insideVertical: thin() },
    rows: [new TableRow({ tableHeader: true, children: ['NÍVEL (P x S)', 'CLASSIFICAÇÃO', 'TRATAMENTO NO PLANO DE AÇÃO'].map((h, i) => cell([p([t(h, { size: 17, bold: true, color: 'FFFFFF' })], { alignment: AlignmentType.CENTER })], { w: ws[i], fill: NAVY })) }),
      ...NIVEIS.map(([a, b2, c, cor, acao]) => new TableRow({ children: [
        cell([p([t(`${a} a ${b2}`, { size: 18, bold: true, color: txtCor(cor) })], { alignment: AlignmentType.CENTER })], { w: ws[0], fill: cor }),
        cell([p([t(c, { size: 18, bold: true })], { alignment: AlignmentType.CENTER })], { w: ws[1] }),
        cell([p([t(acao, { size: 18 })])], { w: ws[2] }),
      ] }))] });
}

// ---------- INVENTÁRIO E PLANO DE AÇÃO (páginas em paisagem, mesmas colunas da planilha) ----------
const LW = 16838 - 2 * 1134; // largura útil em paisagem
const gradeB = { top: thin(), bottom: thin(), left: thin(), right: thin(), insideHorizontal: thin(), insideVertical: thin() };
const INV_COLS = [['AGENTE', 'agente', 900], ['PERIGO', 'perigo', 1250], ['FONTE / CIRCUNSTÂNCIA', 'fonte', 1300], ['POSSÍVEIS LESÕES OU AGRAVOS', 'lesoes', 1750],
  ['LIMITE DE EXPOSIÇÃO', 'limite', 750], ['INTENS. / CONC.', 'intensidade', 750], ['TIPO / TEMPO DE EXPOSIÇÃO', 'exposicao', 950], ['TÉCNICA UTILIZADA', 'tecnica', 1000],
  ['EPC / PROCEDIMENTO ADMINISTRATIVO', 'medidas', 2250], ['EPI', 'epi', 1050], ['ATENUAÇÃO / FP', 'atenuacao', 750], ['P', 'probabilidade', 380], ['S', 'severidade', 380], ['NÍVEL', 'nivel', 460], ['CLASSIFICAÇÃO', 'classificacao', 850]];
const fs7 = 14;
const celTxt = (txt, w, o = {}) => cell([p(String(txt ?? '').split('\n').length > 1
  ? String(txt).split('\n').flatMap((l, i) => (i ? [t(l, { size: o.size || fs7, break: 1, bold: o.bold, color: o.color })] : [t(l, { size: o.size || fs7, bold: o.bold, color: o.color })]))
  : [txt && /^\{\{/.test(txt) ? campo(txt.slice(2, -2), { size: o.size || fs7 }) : t(String(txt ?? ''), { size: o.size || fs7, bold: o.bold, color: o.color })], { alignment: o.al || AlignmentType.LEFT })],
  { w, fill: o.fill, m: { top: 40, bottom: 40, left: 60, right: 60 }, span: o.span });

function inventarioTabela(dados) {
  const ws = INV_COLS.map((c) => c[2]);
  const head = new TableRow({ tableHeader: true, cantSplit: true, children: INV_COLS.map(([h], i) => celTxt(h, ws[i], { bold: true, color: 'FFFFFF', fill: NAVY, al: AlignmentType.CENTER, size: 13 })) });
  const linhas = dados && dados.length ? dados : [
    { ghe: '{{GES}}', setor: '{{SETOR}}', funcao: '{{FUNCOES}}', ambiente: '{{DESCRICAO_AMBIENTE}}', processo: '{{PROCESSO_ATIVIDADES}}', agente: '{{AGENTE}}', perigo: '{{PERIGO}}', fonte: '{{FONTE}}', lesoes: '{{LESOES_AGRAVOS}}', limite: '{{LIMITE}}', intensidade: '{{INTENSIDADE}}', exposicao: '{{EXPOSICAO}}', tecnica: '{{TECNICA}}', medidas: '{{MEDIDAS_EXISTENTES}}', epi: '{{EPI}}', atenuacao: '{{ATENUACAO}}', probabilidade: '{{P}}', severidade: '{{S}}' },
    ...[0, 1].map(() => ({ ghe: '{{GES}}', setor: '{{SETOR}}', funcao: '{{FUNCOES}}' })),
  ];
  const rows = [head];
  let chave = null;
  for (const r of linhas) {
    const k = [r.ghe, r.setor, r.funcao].join('|');
    if (k !== chave) {
      chave = k;
      const grp = (rot, val) => [t(rot, { size: 14, bold: true, color: NAVY }), ...(/^\{\{/.test(val || '') ? [campo(val.slice(2, -2), { size: 14 })] : [t(String(val || '').replace(/\n/g, ' '), { size: 14 })])];
      // Trabalhadores do grupo (NR-01, 1.5.7.3.2 "e"). Sem o campo, a faixa
      // sai exatamente como saía antes — o pedaço inteiro só existe se houver
      // número. Zero é um número: significa "ninguém exposto", e aparece.
      const nTrab = r.trabalhadores;
      const temTrab = nTrab !== undefined && nTrab !== null && nTrab !== '';
      rows.push(new TableRow({ cantSplit: true, children: [cell([
        p([...grp('GES ', r.ghe), t('    |    ', { size: 14, color: GRAY }), ...grp('SETOR: ', r.setor), t('    |    ', { size: 14, color: GRAY }), ...grp('FUNÇÕES: ', r.funcao),
           ...(temTrab ? [t('    |    ', { size: 14, color: GRAY }), ...grp('TRABALHADORES: ', String(nTrab))] : [])]),
        p([...grp('Ambiente: ', r.ambiente)], { spacing: { before: 40 } }),
        p([...grp('Processo / atividades: ', r.processo)], { spacing: { before: 40 } }),
      ], { w: LW, fill: 'E3EAF2', span: INV_COLS.length, m: { top: 60, bottom: 60, left: 100, right: 100 } })] }));
    }
    const P = Number(r.probabilidade), S = Number(r.severidade);
    const ok = P && S, nv = ok ? P * S : '', nl = ok ? nivel(nv) : null;
    const v = { ...r, nivel: ok ? nv : (r.agente ? '{{NIVEL}}' : ''), classificacao: nl ? nl[2] : (r.agente ? '{{CLASSIFICACAO}}' : '') };
    rows.push(new TableRow({ cantSplit: true, children: INV_COLS.map(([, key], i) => {
      const cen = ['limite', 'intensidade', 'exposicao', 'probabilidade', 'severidade', 'nivel', 'classificacao', 'atenuacao'].includes(key);
      if (key === 'classificacao' && nl) return celTxt(nl[2], ws[i], { bold: true, fill: nl[3], color: txtCor(nl[3]), al: AlignmentType.CENTER, size: 13 });
      return celTxt(v[key] ?? '', ws[i], { al: cen ? AlignmentType.CENTER : AlignmentType.LEFT, bold: key === 'nivel' });
    }) }));
  }
  return new Table({ width: { size: LW, type: WidthType.DXA }, columnWidths: ws, borders: gradeB, rows });
}

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const STATUS_COR = { ATRASADO: 'FF7C80', 'EM ANDAMENTO': 'FFFF00', PROGRAMADO: '9DC3E6', REALIZADO: '92D050', REPROGRAMADO: 'FFC000' };
function planoTabela(dados) {
  const cols = [['SETOR', 'setor', 1050], ['GES', 'ghe', 500], ['O QUÊ? (MEDIDA)', 'oque', 1650], ['POR QUÊ?', 'porque', 1450], ['COMO?', 'como', 1550], ['ONDE?', 'onde', 900],
    ['QUANTO?', 'quanto', 900], ['PRIOR.', 'prioridade', 700], ...MESES.map((m) => [m, m, 265]), ['RESPONSÁVEL', 'responsavel', 1050], ['STATUS', 'status', 1250], ['ACOMPANHAMENTO E AFERIÇÃO', 'afericao', 1390]];
  const ws = cols.map((c) => c[2]);
  const head = new TableRow({ tableHeader: true, cantSplit: true, children: cols.map(([h, k], i) => celTxt(MESES.includes(k) ? h[0] : h, ws[i], { bold: true, color: 'FFFFFF', fill: NAVY, al: AlignmentType.CENTER, size: 13 })) });
  const linhas = dados && dados.length ? dados : [{ setor: '{{SETOR}}', ghe: '{{GES}}', oque: '{{MEDIDA}}', porque: '{{MOTIVO}}', como: '{{COMO}}', onde: '{{ONDE}}', quanto: '{{CUSTO}}', prioridade: '{{PRIORIDADE}}', meses: [], responsavel: '{{RESPONSAVEL_ACAO}}', status: '{{STATUS}}', afericao: '{{AFERICAO}}' }, {}, {}];
  const rows = [head, ...linhas.map((a) => new TableRow({ cantSplit: true, height: { value: 500, rule: HeightRule.ATLEAST }, children: cols.map(([, k], i) => {
    if (MESES.includes(k)) return celTxt((a.meses || []).includes(k) ? 'X' : '', ws[i], { fill: (a.meses || []).includes(k) ? NAVY : undefined, color: 'FFFFFF', bold: true, al: AlignmentType.CENTER });
    if (k === 'status' && STATUS_COR[(a.status || '').toUpperCase()]) return celTxt(a.status, ws[i], { fill: STATUS_COR[a.status.toUpperCase()], bold: true, al: AlignmentType.CENTER });
    return celTxt(a[k] ?? '', ws[i], { al: ['ghe', 'prioridade', 'responsavel'].includes(k) ? AlignmentType.CENTER : AlignmentType.LEFT });
  }) }))];
  return new Table({ width: { size: LW, type: WidthType.DXA }, columnWidths: ws, borders: gradeB, rows });
}

function legendaStatus() {
  return p([t('Status: ', { size: 15, bold: true, color: NAVY }), ...Object.entries(STATUS_COR).flatMap(([n, c]) => [t(` ${n} `, { size: 14, bold: true, shading: { type: ShadingType.CLEAR, fill: c, color: 'auto' } }), t('   ', { size: 14 })]),
    t('   Cronograma: mês marcado = prazo previsto para a ação.', { size: 14, color: GRAY })], { spacing: { before: 120 } });
}

function assinatura(cargoLinha) {
  const col = (titulo, nome, sub) => cell([
    sp(700),
    new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 } }, alignment: AlignmentType.CENTER, children: [campo(nome, { size: 20, bold: true })] }),
    p(sub, { alignment: AlignmentType.CENTER }),
    p([t(titulo, { size: 17, color: GRAY })], { alignment: AlignmentType.CENTER }),
  ], { w: 4619, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE } });
  return new Table({
    width: { size: BW, type: WidthType.DXA }, columnWidths: [4619, 400, 4619], borders: noBorders,
    rows: [new TableRow({ children: [
      col('Responsável Técnico', 'RESPONSAVEL_NOME', [t(cargoLinha + ' – ', { size: 18, color: GRAY }), campo('RESPONSAVEL_REGISTRO', { size: 18 })]),
      cell([p([t('')])], { w: 400, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE } }),
      col('Representante Legal da Empresa', 'REPRESENTANTE_EMPRESA', [campo('RAZAO_SOCIAL', { size: 18 })]),
    ] })],
  });
}

function conteudo(d) {
  const blocos = [{ paisagem: false, itens: [] }];
  let out = blocos[0].itens;
  // Sumário
  out.push(p([t('SUMÁRIO', { bold: true, size: 30, color: NAVY })], { spacing: { after: 300 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 6 } } }));
  out.push(new TableOfContents('Sumário', { hyperlink: true, headingStyleRange: '1-2' }));
  out.push(p([new PageBreak()]));

  // 1. Controle de revisões
  out.push(h1('Controle de Revisões'));
  out.push(tabelaGrade(['REVISÃO', 'DATA', 'DESCRIÇÃO', 'RESPONSÁVEL'], [1100, 1900, 4438, 2200], [
    ['REVISAO', 'DATA_EMISSAO', 'DESCRICAO_REVISAO', 'RESPONSAVEL_NOME'], ['', '', '', ''], ['', '', '', ''], ['', '', '', ''], ['', '', '', ''],
  ]));
  out.push(sp(200));
  if (!d.semAviso) out.push(corpo(`Este documento – ${d.nome} (${d.sigla}) – foi elaborado por profissional legalmente habilitado, em conformidade com a ${d.normaLonga} e demais legislações aplicáveis. É de uso exclusivo da empresa identificada neste documento, não podendo ser reproduzido, total ou parcialmente, sem autorização por escrito do responsável técnico.`));

  // 2. Identificação da empresa
  out.push(h1('Identificação da Empresa', true));
  out.push(tabelaCampos([
    ['Razão Social', 'RAZAO_SOCIAL'], ['Nome Fantasia', 'NOME_FANTASIA'], ['CNPJ', 'CNPJ'],
    ['CNAE Principal', 'CNAE_PRINCIPAL'], ['CNAE Secundário', 'CNAE_SECUNDARIO'], ['Grau de Risco (NR-04)', 'GRAU_RISCO'],
    ['Endereço', 'ENDERECO'], ['Bairro', 'BAIRRO'], ['Cidade / UF', 'CIDADE_UF'], ['CEP', 'CEP'],
    ['Telefone', 'TELEFONE'],
  ]));

  // 3. Responsável técnico
  out.push(h1('Responsável Técnico'));
  out.push(tabelaCampos([
    ['Nome', 'RESPONSAVEL_NOME'], ['Formação / Especialidade', 'RESPONSAVEL_FORMACAO'], ['Registro Profissional', 'RESPONSAVEL_REGISTRO'],
  ]));
  out.push(p([new PageBreak()]));

  // Seções próprias do documento
  const bloco = (s) => {
    if (s.ref) out.push(p([t(s.ref, { size: 17, bold: true, color: GREEN })], { keepNext: true, spacing: { after: 80 } }));
    if (s.texto) out.push(corpo(s.texto));
    if (s.itens) for (const it of s.itens) out.push(p([t(it, { size: 22 })], { alignment: AlignmentType.JUSTIFIED, indent: { left: 360 }, spacing: { after: 80, line: 290 } }));
    if (s.guia) out.push(guia(s.guia));
    if (s.matriz) out.push(new Table({ width: { size: LW, type: WidthType.DXA }, columnWidths: [7800, 300, LW - 8100], borders: noBorders, rows: [new TableRow({ cantSplit: true, children: [
      cell([matriz(7800)], { w: 7800, va: VerticalAlign.TOP, m: { top: 0, bottom: 0, left: 0, right: 0 } }), cell([p([t('')])], { w: 300 }),
      cell([legenda(LW - 8100)], { w: LW - 8100, va: VerticalAlign.TOP, m: { top: 0, bottom: 0, left: 0, right: 0 } })] })] }));
    if (s.exig) { const w = [800, 4638, 4200]; out.push(new Table({ width: { size: BW, type: WidthType.DXA }, columnWidths: w, borders: gradeB, rows: [
      new TableRow({ tableHeader: true, children: ['ITEM', 'EXIGÊNCIA DA NR-01', 'ONDE ESTÁ NO INVENTÁRIO'].map((h, i) => celTxt(h, w[i], { bold: true, color: 'FFFFFF', fill: NAVY, al: AlignmentType.CENTER, size: 17 })) }),
      ...s.exig.map(([a, b, c]) => new TableRow({ cantSplit: true, children: [celTxt(`"${a}"`, w[0], { size: 18, bold: true, al: AlignmentType.CENTER }), celTxt(b, w[1], { size: 18 }), celTxt(c, w[2], { size: 18 })] }))] })); }
    if (s.inventario) out.push(inventarioTabela(d.dados && d.dados.inventario));
    if (s.plano) { out.push(planoTabela(d.dados && d.dados.plano)); out.push(legendaStatus()); }
    if (s.tabela) { out.push(tabelaGrade(s.tabela.cab, s.tabela.w, s.tabela.linhas, s.tabela.fs)); out.push(sp(200)); }
  };
  for (const s of d.secoes) {
    if (!!s.paisagem !== blocos[blocos.length - 1].paisagem) { blocos.push({ paisagem: !!s.paisagem, itens: [] }); out = blocos[blocos.length - 1].itens; }
    out.push(h1(s.t));
    bloco(s);
    if (s.sub) for (const sub of s.sub) { out.push(h2(sub.t)); bloco(sub); }
  }

  // Encerramento
  out.push(h1('Encerramento'));
  out.push(corpo(d.encerramento || `Este documento é composto por páginas numeradas e entra em vigor na data de sua emissão, devendo ser revisado sempre que houver alteração nos processos, ambientes ou condições de trabalho, ou no prazo previsto na ${d.normaLonga}.`));
  out.push(p([campo('CIDADE', { size: 22 }), t(' / ', { size: 22 }), campo('UF', { size: 22 }), t(', ', { size: 22 }), campo('DATA_EMISSAO', { size: 22 }), t('.', { size: 22 })], { alignment: AlignmentType.RIGHT, spacing: { before: 200, after: 400 } }));
  out.push(assinatura(d.profissional));
  return blocos;
}

function cabecalho(d, W = BW) {
  return new Header({ children: [new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [1800, W - 1800],
    borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT } },
    rows: [new TableRow({ children: [
      cell([p([campo('LOGO_EMPRESA', { size: 14 })])], { w: 1800, m: { top: 40, bottom: 80, left: 0, right: 100 } }),
      cell([
        p([t(`${d.sigla} – ${d.nome}`, { size: 18, bold: true, color: NAVY })], { alignment: AlignmentType.RIGHT }),
        p([campo('RAZAO_SOCIAL', { size: 15 }), t('   |   Vigência: ', { size: 15, color: GRAY }), campo('VIGENCIA_INICIO', { size: 15 }), t(' a ', { size: 15, color: GRAY }), campo('VIGENCIA_FIM', { size: 15 })], { alignment: AlignmentType.RIGHT }),
      ], { w: W - 1800, m: { top: 40, bottom: 80, left: 100, right: 0 } }),
    ] })],
  }), sp(0)] });
}

function rodape(W = BW) {
  return new Footer({ children: [new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W - 2800, 2800],
    borders: { ...noBorders, top: thin() },
    rows: [new TableRow({ children: [
      cell([p([t(MARCA, { size: 16, bold: true, color: NAVY }), t('  •  Segurança e Saúde no Trabalho', { size: 16, color: GRAY })])], { w: W - 2800, m: { top: 80, bottom: 0, left: 0, right: 0 } }),
      cell([p([t('Página ', { size: 16, color: GRAY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, bold: true, color: NAVY, font: FONT }), t(' de ', { size: 16, color: GRAY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GRAY, font: FONT })], { alignment: AlignmentType.RIGHT })], { w: 2800, m: { top: 80, bottom: 0, left: 0, right: 0 } }),
    ] })],
  })] });
}

function documento(d) {
  return new Document({
    creator: MARCA,
    title: `${d.sigla} – ${d.nome}`,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: 22, color: '222B33' } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: FONT, size: 28, bold: true, color: NAVY },
          paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 4 } } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: FONT, size: 24, bold: true, color: NAVY2 },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      ],
    },
    numbering: { config: [{ reference: 'secoes', levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 432, hanging: 432 } } } },
      { level: 1, format: LevelFormat.DECIMAL, text: '%1.%2.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 576, hanging: 576 } } } },
    ] }] },
    sections: [
      (() => { const c = simples(d); const b = { style: BorderStyle.SINGLE, size: 12, color: c.moldura, space: 28 };
        return { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: c.margin, bottom: c.margin, left: c.margin, right: c.margin, header: 0, footer: 0 },
          borders: { pageBorderTop: b, pageBorderBottom: b, pageBorderLeft: b, pageBorderRight: b, pageBorders: { display: PageBorderDisplay.FIRST_PAGE, offsetFrom: PageBorderOffsetFrom.PAGE } } } }, children: c.children }; })(),
      ...conteudo(d).map((bl, i) => ({ properties: { page: { size: { width: 11906, height: 16838, orientation: bl.paisagem ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: bl.paisagem ? { top: 1500, bottom: 1100, left: 1134, right: 1134, header: 500, footer: 500 } : { top: 1700, bottom: 1300, left: 1134, right: 1134, header: 567, footer: 567 },
          ...(i === 0 ? { pageNumbers: { start: 2 } } : {}) } },
        headers: { default: cabecalho(d, bl.paisagem ? LW : BW) }, footers: { default: rodape(bl.paisagem ? LW : BW) }, children: bl.itens })),
    ],
  });
}

module.exports = { documento };

if (require.main === module) {
  // node gerar.js <pasta_saida> [dados.json] [SIGLA ...]
  const docs = require('./docs.js');
  const dados = process.argv[3] && process.argv[3] !== '-' ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;
  const so = process.argv.slice(4);
  globalThis.VALORES = (dados && dados.empresa) || {};
  (async () => {
    for (const d of docs) {
      if (so.length && !so.includes(d.sigla)) continue;
      const buf = await Packer.toBuffer(documento({ ...d, dados }));
      const nome = dados ? d.arquivo.replace('_Modelo', '_' + (dados.empresa?.ARQUIVO || 'Empresa')) : d.arquivo;
      fs.writeFileSync(path.join(OUT, nome + '.docx'), buf);
      console.log('ok', nome);
    }
  })();
}

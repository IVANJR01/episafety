// Papel timbrado e primitivas de layout dos documentos técnicos (PGR, PRE).
//
// Estavam privadas dentro de pgrPdf.ts. Saíram de lá quando o segundo
// documento apareceu: o PRE precisa ser reconhecível como o mesmo emissor —
// mesma capa, mesma faixa de título, mesmo rodapé de validação. Copiar o
// desenho garantiria que os dois divergissem na primeira correção.
import type jsPDF from "jspdf";
import QRCode from "qrcode";

export const MARGEM = 18;
export const LARGURA = 210;

export const fmtDate = (s?: string | null) =>
  s ? new Date(s.length <= 10 ? s + "T00:00:00" : s).toLocaleDateString("pt-BR") : "—";
export const fmtDT = (s?: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "—";

export interface ItemSumario { titulo: string; pagina: number; nivel?: number; }
/** O bloco em construção: documento, altura corrente e o que já virou seção. */
export interface B {
  doc: jsPDF;
  y: number;
  toc: ItemSumario[];
  /** Contador de seções, preenchido por `title()`. Começa em 1. */
  secao?: number;
  /** Contador de subseções da seção corrente, zerado por `title()`. */
  sub?: number;
  /*
   * Os limites da página em uso.
   *
   * Eram constantes: 200 mm de borda direita e 278 mm de altura máxima, que
   * é A4 em pé. O inventário do PGR precisa de página deitada — são quinze
   * colunas, e é assim que a planilha e o documento em Word da
   * SafetySoluções sempre imprimiram. Sem isto a tabela quebrava a página na
   * altura errada e desenhava a linha de baixo fora do papel.
   *
   * Ausentes, valem os de A4 em pé; nada que já existia precisou mudar.
   */
  direita?: number;
  limiteY?: number;
}

/** Borda direita útil da página em uso (A4 em pé, quando não dito). */
export const direitaDe = (b: B) => b.direita ?? 200;
/** Altura máxima antes de quebrar a página (A4 em pé, quando não dito). */
export const limiteYDe = (b: B) => b.limiteY ?? 278;

export const ensure = (b: B, h: number) => {
  if (b.y + h > limiteYDe(b)) { b.doc.addPage(); b.y = 15; }
};

/**
 * Abre uma seção e registra a página no sumário.
 *
 * O número é anotado DEPOIS do `ensure`: se o título não coubesse na página
 * atual, ele salta para a próxima e o sumário apontaria a página errada.
 */
/**
 * Abre uma seção numerada e registra a página no sumário.
 *
 * A faixa preta de ponta a ponta que havia aqui pesava a página inteira: num
 * documento com onze seções, são onze tarjas pretas atravessando o A4, e o
 * que devia hierarquizar acabava competindo com o texto. O lugar do peso é o
 * número e o nome da seção; uma régua fina abaixo fecha o bloco.
 *
 * O número não é enfeite: documento técnico se cita por seção ("ver 4.2"), e
 * sem numeração o sumário só serve para achar a página.
 */
export function title(b: B, t: string) {
  ensure(b, 14);
  const n = b.secao ?? 1;
  b.secao = n + 1;
  b.sub = 0;
  const numerado = `${n}. ${t}`;
  b.toc.push({ titulo: numerado, pagina: b.doc.getCurrentPageInfo().pageNumber, nivel: 1 });

  /*
   * O título no estilo do documento em Word: número, recuo, nome em
   * azul-marinho e um filete claro embaixo. A barrinha azul que havia à
   * esquerda não existe no Word e, com o cabeçalho de página novo, somava um
   * terceiro elemento azul na mesma faixa de dois centímetros.
   */
  b.y += 4;
  b.doc.setTextColor(15, 42, 68); b.doc.setFontSize(13); b.doc.setFont("helvetica", "bold");
  b.doc.text(`${n}.`, 10, b.y + 4.2);
  b.doc.text(t, 19, b.y + 4.2);
  b.y += 7;
  b.doc.setDrawColor(210); b.doc.setLineWidth(0.3);
  b.doc.line(10, b.y, direitaDe(b), b.y);
  b.doc.setTextColor(0);
  b.y += 5;
}

/**
 * Subtítulo numerado dentro de uma seção — "4.1. Critérios...".
 *
 * Entra no sumário com recuo, como no Word.
 */
export function subNumerado(b: B, t: string) {
  ensure(b, 10);
  b.sub = (b.sub ?? 0) + 1;
  const n = (b.secao ?? 2) - 1;
  const numerado = `${n}.${b.sub}. ${t}`;
  b.toc.push({ titulo: numerado, pagina: b.doc.getCurrentPageInfo().pageNumber, nivel: 2 });
  b.y += 2;
  b.doc.setTextColor(27, 63, 99); b.doc.setFontSize(10.5); b.doc.setFont("helvetica", "bold");
  b.doc.text(`${n}.${b.sub}.`, 12, b.y + 3.6);
  b.doc.text(t, 25, b.y + 3.6);
  b.doc.setTextColor(0);
  b.y += 7;
}

/** A referência normativa, em verde miúdo acima do texto — como no Word. */
export function refNorma(b: B, texto: string) {
  ensure(b, 6);
  b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(7);
  b.doc.setTextColor(30, 158, 106);
  b.doc.text(texto, 12, b.y + 3);
  b.doc.setTextColor(0);
  b.y += 5;
}

/** Subtítulo dentro de uma seção — não entra no sumário. */
export function sub(b: B, t: string) {
  ensure(b, 8);
  b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(9); b.doc.setTextColor(15, 23, 42);
  b.doc.text(t, 12, b.y + 4); b.doc.setTextColor(0); b.y += 7;
}

/**
 * Cabeçalho de tabela que se repete a cada quebra de página.
 *
 * Devolve a função que desenha uma linha garantindo a repetição: sem isso, uma
 * tabela de 80 riscos vira 3 páginas de números sem nome de coluna.
 */
/*
 * Opções de tamanho de letra.
 *
 * 7,5 pt serve para uma tabela de cinco colunas. Nas quinze colunas do
 * inventário a mesma letra fazia o texto de uma célula encostar na coluna
 * seguinte, e partia rótulo no meio da palavra ("ATENUAÇ" / "ÃO / FP").
 * Quem monta a tabela sabe quantas colunas ela tem; é quem deve escolher.
 */
export interface OpcoesTabela {
  fonte?: number;
  fonteCabecalho?: number;
  /**
   * Grade completa: linha entre todas as colunas e moldura em volta.
   *
   * Sem ela, uma tabela de cinco colunas ainda se lê; uma de quinze, não. No
   * inventário do PGR o texto de uma célula terminava exatamente onde
   * começava o da próxima — "Mobiliário; Computador" colado em "Pressão por
   * metas" —, e não havia como saber onde uma coluna acabava. É a grade que
   * o documento em Word da SafetySoluções sempre teve.
   */
  grade?: boolean;
  /** Cabeçalho azul-marinho com letra branca, como no Word. */
  cabecalhoEscuro?: boolean;
}

export function tabela(
  b: B,
  colunas: { rotulo: string; x: number; w: number }[],
  opcoes: OpcoesTabela = {},
) {
  const FONTE = opcoes.fonte ?? 7.5;
  const FONTE_CAB = opcoes.fonteCabecalho ?? 7;
  const GRADE = opcoes.grade ?? false;

  /** Onde cai cada linha vertical: no meio do vão entre duas colunas. */
  const separadores = (): number[] => {
    if (!GRADE) return [];
    const xs = [10];
    colunas.forEach((c, i) => {
      const prox = colunas[i + 1];
      xs.push(prox ? (c.x + c.w + prox.x) / 2 : direitaDe(b));
    });
    return xs;
  };

  const verticais = (yTopo: number, altura: number) => {
    if (!GRADE) return;
    b.doc.setDrawColor(200);
    b.doc.setLineWidth(0.2);
    separadores().forEach((x) => b.doc.line(x, yTopo, x, yTopo + altura));
  };
  /*
   * O cabeçalho QUEBRA dentro da própria coluna.
   *
   * Escrito numa linha só, um rótulo longo invadia o vizinho: com as quinze
   * colunas do inventário, "FONTE / CIRCUNSTÂNCIA" escrevia por cima de
   * "POSSÍVEIS LESÕES OU AGRAVOS" e a faixa virava um borrão. A altura da
   * faixa passa a ser a do rótulo mais alto.
   */
  const desenhaCabecalho = () => {
    b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(FONTE_CAB);
    const rotulos = colunas.map((c) => b.doc.splitTextToSize(c.rotulo, c.w) as string[]);
    const linhas = Math.max(...rotulos.map((r) => r.length));
    const altura = Math.max(6, linhas * (FONTE_CAB * 0.4) + 2);
    if (opcoes.cabecalhoEscuro) {
      b.doc.setFillColor(15, 42, 68);
      b.doc.rect(10, b.y, direitaDe(b) - 10, altura, "F");
      b.doc.setTextColor(255);
    } else {
      b.doc.setFillColor(240, 240, 240);
      b.doc.rect(10, b.y, direitaDe(b) - 10, altura, "F");
      b.doc.setTextColor(30);
    }
    rotulos.forEach((partes, i) =>
      partes.forEach((parte, j) => b.doc.text(parte, colunas[i].x, b.y + 3 + j * (FONTE_CAB * 0.4))),
    );
    verticais(b.y, altura);
    b.doc.setTextColor(0);
    b.y += altura + (GRADE ? 0 : 1);
  };
  desenhaCabecalho();
  /**
   * Uma célula pintada por dentro: a cor preenche a coluna inteira e a letra
   * sai na cor que se lê em cima dela. É assim que a classificação de risco
   * aparece na tela e no Word; a tarja fina na margem sozinha obrigava a
   * procurar a cor longe do texto que ela qualifica.
   */
  interface CelulaPintada {
    col: number;
    fundo: [number, number, number];
    texto: [number, number, number];
  }

  /**
   * Desenha uma linha. `corBarra` pinta uma tarja fina na margem esquerda —
   * a mesma cor da legenda da matriz, na altura da linha inteira.
   */
  const adicionar = (
    celulas: string[],
    corBarra?: [number, number, number],
    /* Uma ou várias: o cronograma do plano de ação pinta um mês por célula. */
    pintadas?: CelulaPintada | CelulaPintada[],
  ) => {
    const listaPintada: CelulaPintada[] = pintadas
      ? (Array.isArray(pintadas) ? pintadas : [pintadas])
      : [];
    b.doc.setFont("helvetica", "normal"); b.doc.setFontSize(FONTE);
    const textos = colunas.map((c, i) => b.doc.splitTextToSize(celulas[i] ?? "—", c.w));
    const alturaLinha = FONTE * 0.45;
    const h = Math.max(...textos.map((t) => t.length)) * alturaLinha + 3;
    if (b.y + h > limiteYDe(b)) { b.doc.addPage(); b.y = 15; desenhaCabecalho(); }
    b.doc.setDrawColor(GRADE ? 200 : 225); b.doc.setLineWidth(0.2);
    b.doc.line(10, b.y, direitaDe(b), b.y);
    /* Com grade, a linha de baixo também: senão a última fica em aberto. */
    if (GRADE) b.doc.line(10, b.y + h, direitaDe(b), b.y + h);
    if (corBarra) {
      b.doc.setFillColor(...corBarra);
      b.doc.rect(10, b.y, 1.8, h, "F");
    }
    /*
     * A célula pintada vai de uma linha da grade à outra.
     *
     * Antes era a largura do texto mais 1,5 mm para cada lado — um palpite
     * que, na última coluna, pintava para fora da moldura da tabela.
     */
    const xs = separadores();
    listaPintada.forEach((pintada) => {
      const c = colunas[pintada.col];
      const x0 = GRADE ? xs[pintada.col] : c.x - 1.5;
      const x1 = GRADE ? xs[pintada.col + 1] : c.x + c.w + 1.5;
      b.doc.setFillColor(...pintada.fundo);
      b.doc.rect(x0, b.y, x1 - x0, h, "F");
    });
    b.doc.setFont("helvetica", "normal"); b.doc.setFontSize(FONTE);
    textos.forEach((t, i) => {
      const pintada = listaPintada.find((x) => x.col === i);
      if (pintada) b.doc.setTextColor(...pintada.texto);
      else b.doc.setTextColor(0);
      b.doc.text(t, colunas[i].x, b.y + 3.5);
    });
    verticais(b.y, h);
    b.doc.setTextColor(0);
    b.y += h;
  };

  /*
   * Redesenha o cabeçalho das colunas.
   *
   * Quem intercala uma faixa de grupo entre as linhas (o inventário, agrupado
   * por GES) pode quebrar a página por conta própria; sem isto, a página
   * seguinte começaria com linhas soltas, sem dizer o que é cada coluna.
   */
  adicionar.cabecalho = desenhaCabecalho;
  return adicionar;
}

/**
 * Rótulo em cima, valor embaixo — quebrando de página quando o valor é longo.
 *
 * Mesmo defeito que o parágrafo tinha: um `ensure` só, para o rótulo, e
 * depois o valor inteiro de uma vez. O campo "Método" da Metodologia de
 * Avaliação guarda um texto de vários parágrafos, e ele saía por cima do
 * rodapé.
 */
/**
 * Tabela de duas colunas: rótulo com fundo claro, valor ao lado.
 *
 * É o formato da "Identificação da Empresa" e do "Responsável Técnico" no
 * documento em Word. Em rótulo-em-cima-valor-embaixo, como estava, a mesma
 * informação ocupava o dobro da altura e não se lia como ficha.
 */
export function tabelaFicha(b: B, linhas: [string, string][], larguraRotulo = 48) {
  const direita = direitaDe(b);
  for (const [rotulo, valor] of linhas) {
    b.doc.setFont("helvetica", "normal"); b.doc.setFontSize(8.5);
    const texto = b.doc.splitTextToSize(valor || "—", direita - 10 - larguraRotulo - 5) as string[];
    const altura = Math.max(6.5, texto.length * 3.8 + 2.8);
    ensure(b, altura);
    b.doc.setFillColor(238, 242, 246);
    b.doc.rect(10, b.y, larguraRotulo, altura, "F");
    b.doc.setDrawColor(201, 211, 221); b.doc.setLineWidth(0.2);
    b.doc.rect(10, b.y, larguraRotulo, altura);
    b.doc.rect(10 + larguraRotulo, b.y, direita - 10 - larguraRotulo, altura);
    b.doc.setFont("helvetica", "bold"); b.doc.setTextColor(15, 42, 68);
    b.doc.text(rotulo, 12.5, b.y + 4.4);
    b.doc.setFont("helvetica", "normal"); b.doc.setTextColor(0);
    texto.forEach((linha, i) => b.doc.text(linha, 12.5 + larguraRotulo, b.y + 4.4 + i * 3.8));
    b.y += altura;
  }
  b.y += 3;
}

export function kv(b: B, label: string, value: string, full = false) {
  ensure(b, 9);
  b.doc.setFontSize(7); b.doc.setFont("helvetica", "normal"); b.doc.setTextColor(110);
  b.doc.text(label.toUpperCase(), 12, b.y);
  b.doc.setFontSize(9); b.doc.setFont("helvetica", "bold");
  const linhas = b.doc.splitTextToSize(value || "—", full ? 186 : 90) as string[];
  b.y += 4;
  linhas.forEach((linha) => {
    ensure(b, 5);
    b.doc.setTextColor(0); b.doc.setFontSize(9); b.doc.setFont("helvetica", "bold");
    b.doc.text(linha, 12, b.y);
    b.y += 3.5;
  });
  b.y += 1;
}

/**
 * Parágrafo que quebra de página no meio, quando precisa.
 *
 * Antes o texto inteiro era escrito de uma vez depois de um único `ensure`:
 * cabendo a primeira linha, as outras vinte iam junto — e passavam por cima
 * do rodapé de validação. No PGR real isso aconteceu na Metodologia de
 * Avaliação, com o texto do documento impresso em cima do QR Code.
 *
 * Agora a altura é conferida linha a linha, que é a unidade que de fato cabe
 * ou não cabe.
 */
export function para(b: B, txt: string, size = 8, color: [number, number, number] = [60, 60, 60]) {
  b.doc.setFont("helvetica", "normal"); b.doc.setFontSize(size);
  const linhas = b.doc.splitTextToSize(txt, 186) as string[];
  const alturaLinha = size * 0.42;
  b.y += 3;
  linhas.forEach((linha) => {
    ensure(b, alturaLinha + 2);
    b.doc.setFont("helvetica", "normal"); b.doc.setFontSize(size); b.doc.setTextColor(...color);
    b.doc.text(linha, 12, b.y);
    b.y += alturaLinha;
  });
  b.doc.setTextColor(0);
}

export interface CampoCapa {
  rotulo: string;
  valor: string;
  /** Ocupa a largura inteira do painel, para valores longos. */
  largo?: boolean;
}

export interface CapaTimbrada {
  logoDataUrl?: string | null;
  /** Canto superior direito, em destaque: "REV. 00". */
  revisao?: string | null;
  /** Linha fina abaixo da revisão: versões e situação do documento. */
  meta?: string | null;
  /** A sigla grande — "PGR", "PRE". */
  sigla: string;
  titulo: string;
  subtitulo?: string | null;
  nota?: string | null;
  empresaNome: string;
  /** CNPJ e unidade, logo abaixo do nome. */
  identificacao: string[];
  /** Emissão, vigência, responsável técnico. */
  campos: CampoCapa[];
  /** Cidade / UF e ano, no pé da capa. */
  rodapeLocal?: string | null;
  /** As linhas da tabela de identificação, quando se quer ditá-las. */
  linhasTabela?: [string, string][];
}

/*
 * Medidas da capa, em milímetros. São as do pacote (gerador/niveis.js),
 * convertidas de DXA: 1418 dxa = 25 mm de margem.
 */
const CAPA_MARGEM = 25;
const CAPA_LARGURA = LARGURA - 2 * CAPA_MARGEM;

/**
 * A capa "Simples" com moldura — a mesma dos seis documentos em Word.
 *
 * O PDF tinha uma capa só dele: faixa azul-marinho no topo, título à
 * esquerda e um painel de identificação no pé. Era outra capa, e a regra do
 * pacote é uma só para todos os documentos, mudando apenas o nome. Quem
 * recebia o PGR em Word e o mesmo PGR em PDF recebia dois documentos de cara
 * diferente.
 */
export function capaTimbrada(pdf: jsPDF, capa: CapaTimbrada) {
  const PRETO = 34, CINZA = 102;

  /* A moldura da página, 1 mm para fora da margem do texto. */
  pdf.setDrawColor(PRETO);
  pdf.setLineWidth(0.6);
  pdf.rect(CAPA_MARGEM - 1, CAPA_MARGEM - 1, CAPA_LARGURA + 2, 297 - 2 * (CAPA_MARGEM - 1));

  /* Caixa da logo: opcional. Se houver imagem cadastrada, desenha; senão, fica em branco. */
  const LOGO_W = 49, LOGO_H = 17.6;
  const logoX = (LARGURA - LOGO_W) / 2;
  const logoY = CAPA_MARGEM + 4;
  if (capa.logoDataUrl) {
    try { pdf.addImage(capa.logoDataUrl, "PNG", logoX, logoY, LOGO_W, LOGO_H); }
    catch { /* logo inválida: segue em branco */ }
  }

  /* Revisão e situação: não existem no Word, mas o PDF é versionado e a
     versão precisa estar impressa em algum lugar da capa. */
  if (capa.revisao) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(PRETO);
    pdf.text(capa.revisao, LARGURA - CAPA_MARGEM, logoY + 3, { align: "right" });
  }
  if (capa.meta) {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(CINZA);
    pdf.text(capa.meta, LARGURA - CAPA_MARGEM, logoY + 7, { align: "right" });
  }

  /* ── Título ──────────────────────────────────────────────────────────
     Sigla curta ganha letra gigante; nome longo, letra menor — é o
     `grande(d)` do niveis.js. */
  const grande = capa.sigla.length <= 6;
  let y = 108;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(grande ? 48 : 24);
  pdf.setTextColor(PRETO);
  pdf.text(capa.sigla, LARGURA / 2, y, { align: "center" });

  y += 12;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(15);
  pdf.text(capa.titulo, LARGURA / 2, y, { align: "center" });

  if (capa.subtitulo) {
    y += 7;
    pdf.setFontSize(11); pdf.setTextColor(CINZA);
    pdf.text(capa.subtitulo, LARGURA / 2, y, { align: "center" });
  }
  if (capa.nota) {
    y += 7;
    pdf.setFontSize(11); pdf.setTextColor(CINZA);
    pdf.text(capa.nota, LARGURA / 2, y, { align: "center" });
  }

  /* ── Tabela de identificação ────────────────────────────────────── */
  const linhas: [string, string][] = capa.linhasTabela ?? [
    ["Empresa", capa.empresaNome],
    ...capa.identificacao.map((t) => ["", t] as [string, string]),
    ...capa.campos.map((c) => [c.rotulo, c.valor] as [string, string]),
  ];

  const TAB_Y = 196;
  const COL1 = 46;
  pdf.setDrawColor(187);
  pdf.setLineWidth(0.2);
  let ty = TAB_Y;
  for (const [rotulo, valor] of linhas) {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    const texto = pdf.splitTextToSize(valor || "—", CAPA_LARGURA - COL1 - 6) as string[];
    const altura = Math.max(7, texto.length * 4 + 3);
    pdf.rect(CAPA_MARGEM, ty, COL1, altura);
    pdf.rect(CAPA_MARGEM + COL1, ty, CAPA_LARGURA - COL1, altura);
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(PRETO);
    pdf.text(rotulo, CAPA_MARGEM + 2.5, ty + 4.8);
    pdf.setFont("helvetica", "normal");
    texto.forEach((linha, i) => pdf.text(linha, CAPA_MARGEM + COL1 + 2.5, ty + 4.8 + i * 4));
    ty += altura;
  }

  /* ── Local e ano ─────────────────────────────────────────────────── */
  if (capa.rodapeLocal) {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(CINZA);
    pdf.text(capa.rodapeLocal, LARGURA / 2, 258, { align: "center" });
  }
  pdf.setTextColor(0);
}

/** Sumário, inserido como página 2 — só dá para montar depois de tudo desenhado. */
export function sumario(pdf: jsPDF, toc: ItemSumario[]) {
  if (toc.length === 0) return;
  pdf.insertPage(2);
  pdf.setPage(2);
  let y = 15;
  /* "SUMÁRIO" em caixa alta com filete laranja, como no documento em Word. */
  pdf.setTextColor(15, 42, 68); pdf.setFontSize(15); pdf.setFont("helvetica", "bold");
  pdf.text("SUMÁRIO", 10, y + 9);
  y += 13;
  pdf.setDrawColor(242, 169, 0); pdf.setLineWidth(0.7); pdf.line(10, y, 200, y);
  pdf.setTextColor(0); y += 7;

  toc.forEach((item) => {
    if (y > 272) return;
    // A inserção da página 2 empurrou todo o resto: o número anotado durante o
    // desenho vale um a menos do que a página final.
    const pagina = String(item.pagina + 1);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(30);
    const recuo = item.nivel === 2 ? 20 : 12;
    const titulo = pdf.splitTextToSize(item.titulo, 160)[0];
    pdf.text(titulo, recuo, y);
    const larguraTitulo = pdf.getTextWidth(titulo);
    const larguraPagina = pdf.getTextWidth(pagina);
    // Linha pontilhada ligando título e página, para o olho não se perder.
    pdf.setTextColor(170);
    const inicio = recuo + larguraTitulo + 2;
    const fim = 198 - larguraPagina - 2;
    if (fim > inicio) {
      const pontos = ".".repeat(Math.max(0, Math.floor((fim - inicio) / pdf.getTextWidth("."))));
      pdf.text(pontos, inicio, y);
    }
    pdf.setTextColor(30);
    pdf.text(pagina, 198, y, { align: "right" });
    y += 5.4;
  });
  pdf.setTextColor(0);
}

export interface RodapeOpts {
  qrUrl: string;
  /** As linhas ao lado do QR. Recebe a página e o total para numerar. */
  linhas: (pagina: number, total: number) => string[];
  /** Texto da marca d'água; `null` imprime o documento sem marca. */
  marca?: string | null;
  /** Cabeçalho do miolo: "PGR – Programa de Gerenciamento de Riscos". */
  tituloCabecalho?: string;
  /** Segunda linha do cabeçalho: empresa e vigência. */
  subtituloCabecalho?: string;
  logoDataUrl?: string | null;
}

/**
 * Rodapé de validação em todas as páginas, menos a capa.
 *
 * QR, hash, numeração e a nota de assinatura são aparato de documento técnico
 * e pertencem ao miolo. Na capa disputavam espaço com a identificação e faziam
 * a primeira página parecer a última.
 */
export async function rodapePaginas(pdf: jsPDF, opts: RodapeOpts) {
  const qrDataUrl = await QRCode.toDataURL(opts.qrUrl, { margin: 0, width: 220 });
  const total = pdf.getNumberOfPages();
  const NAVY = [15, 42, 68] as const;
  const LARANJA = [242, 169, 0] as const;
  const CINZA = 110;

  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    if (opts.marca) {
      /*
       * Marca d'água discreta. A 18% ela atravessava o texto e o documento
       * ficava com cara de cópia rasurada — quem lê precisa ler. A 8% ainda
       * se vê de longe, que é o que a marca precisa fazer.
       */
      const anyDoc = pdf as any;
      if (typeof anyDoc.GState === "function") { anyDoc.setGState(new anyDoc.GState({ opacity: 0.08 })); }
      pdf.setTextColor(150, 40, 40); pdf.setFont("helvetica", "bold");
      const larguraPagina = pdf.internal.pageSize.getWidth();
      if (p === 1) {
        /*
         * Na CAPA a marca é horizontal, na faixa vazia entre o título e a
         * tabela de identificação. Na diagonal ela cortava a sigla do
         * documento — a coisa que a capa existe para dizer.
         */
        pdf.setFontSize(34);
        const ESPACO = 3;
        const larg = pdf.getTextWidth(opts.marca) + ESPACO * Math.max(0, opts.marca.length - 1);
        pdf.text(opts.marca, larguraPagina / 2 - larg / 2, 170, { charSpace: ESPACO } as any);
      } else {
        pdf.setFontSize(78);
        pdf.text(opts.marca, larguraPagina / 2, 150, { align: "center", angle: 35 } as any);
      }
      if (typeof anyDoc.GState === "function") { anyDoc.setGState(new anyDoc.GState({ opacity: 1 })); }
      pdf.setTextColor(0);
    }
    if (p === 1) continue;

    const larguraPg = pdf.internal.pageSize.getWidth();
    const alturaPg = pdf.internal.pageSize.getHeight();
    const esquerda = 10;
    const direita = larguraPg - 10;

    /*
     * ── Cabeçalho ──────────────────────────────────────────────────────
     * Logo à esquerda, identificação do documento à direita e o filete
     * laranja fechando — o mesmo do documento em Word. O miolo do PDF não
     * tinha cabeçalho nenhum: solta da capa, a folha não dizia de que
     * documento era.
     */
    if (opts.tituloCabecalho) {
      if (opts.logoDataUrl) {
        try { pdf.addImage(opts.logoDataUrl, "PNG", esquerda, 6, 16, 8); }
        catch { /* logo inválida: segue sem ela */ }
      }
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5);
      pdf.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      pdf.text(opts.tituloCabecalho, direita, 9.5, { align: "right" });
      if (opts.subtituloCabecalho) {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(CINZA);
        pdf.text(opts.subtituloCabecalho, direita, 13, { align: "right" });
      }
      pdf.setDrawColor(LARANJA[0], LARANJA[1], LARANJA[2]);
      pdf.setLineWidth(0.7);
      pdf.line(esquerda, 15.5, direita, 15.5);
    }

    /*
     * ── Rodapé ─────────────────────────────────────────────────────────
     * Marca à esquerda, página à direita. O QR e o hash saíram daqui e
     * foram para a última página: são do sistema, não do documento, e
     * repetidos em toda folha davam ao PGR cara de protocolo interno.
     */
    const linhaRodape = alturaPg - 14;
    pdf.setDrawColor(215); pdf.setLineWidth(0.3);
    pdf.line(esquerda, linhaRodape, direita, linhaRodape);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
    pdf.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    pdf.text("SafetySoluções", esquerda, linhaRodape + 4.5);
    const larguraMarca = pdf.getTextWidth("SafetySoluções");
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(CINZA);
    pdf.text("•  Segurança e Saúde no Trabalho", esquerda + larguraMarca + 2, linhaRodape + 4.5);

    /*
     * "Página 3 de 19" com o número em destaque, medido pedaço a pedaço.
     * Posicionar cada parte por conta saía "Página3 de 6", sem o espaço.
     */
    pdf.setFontSize(7.5);
    const parte1 = "Página ";
    const parte2 = String(p);
    const parte3 = ` de ${total}`;
    pdf.setFont("helvetica", "normal");
    const w1 = pdf.getTextWidth(parte1);
    const w3 = pdf.getTextWidth(parte3);
    pdf.setFont("helvetica", "bold");
    const w2 = pdf.getTextWidth(parte2);
    let x = direita - (w1 + w2 + w3);
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(CINZA);
    pdf.text(parte1, x, linhaRodape + 4.5);
    x += w1;
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    pdf.text(parte2, x, linhaRodape + 4.5);
    x += w2;
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(CINZA);
    pdf.text(parte3, x, linhaRodape + 4.5);
    pdf.setTextColor(0);
  }

  /*
   * Validação do sistema, só na ÚLTIMA página: QR, endereço de conferência,
   * hash e a nota sobre assinatura. É o que torna o PDF rastreável, e não
   * existe no Word — por isso fica reunido num lugar só, no fim.
   */
  pdf.setPage(total);
  const larguraUltima = pdf.internal.pageSize.getWidth();
  const alturaUltima = pdf.internal.pageSize.getHeight();
  const yBloco = alturaUltima - 36;
  pdf.setDrawColor(225); pdf.setLineWidth(0.2);
  pdf.line(10, yBloco, larguraUltima - 10, yBloco);
  pdf.addImage(qrDataUrl, "PNG", 10, yBloco + 2, 14, 14);
  pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal"); pdf.setTextColor(CINZA);
  opts.linhas(total, total).slice(0, 3).forEach((linha, i) =>
    pdf.text(linha, 27, yBloco + 5 + i * 3));
  pdf.setTextColor(0);
}

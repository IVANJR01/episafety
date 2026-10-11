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

export interface ItemSumario { titulo: string; pagina: number; }
/** O bloco em construção: documento, altura corrente e o que já virou seção. */
export interface B {
  doc: jsPDF;
  y: number;
  toc: ItemSumario[];
  /** Contador de seções, preenchido por `title()`. Começa em 1. */
  secao?: number;
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
  const numerado = `${n}. ${t}`;
  b.toc.push({ titulo: numerado, pagina: b.doc.getCurrentPageInfo().pageNumber });

  b.y += 2;
  b.doc.setFillColor(15, 23, 42);
  b.doc.rect(10, b.y - 0.5, 3, 6, "F");
  b.doc.setTextColor(15, 23, 42); b.doc.setFontSize(11.5); b.doc.setFont("helvetica", "bold");
  b.doc.text(numerado, 16, b.y + 4.2);
  b.y += 7;
  b.doc.setDrawColor(200); b.doc.setLineWidth(0.3);
  b.doc.line(10, b.y, direitaDe(b), b.y);
  b.doc.setTextColor(0);
  b.y += 4;
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
  /** CNPJ e unidade, logo abaixo do nome, dentro do painel. */
  identificacao: string[];
  /** Emissão, vigência, responsável técnico — em duas colunas no painel. */
  campos: CampoCapa[];
}


/**
 * A capa: papel timbrado, não banner.
 *
 * Marca e revisão no alto, título no corpo, identificação da empresa no pé.
 * A faixa azul-marinho que ocupava o terço superior empurrava tudo para baixo
 * e não dizia nada — o espaço passou a ser do título.
 */
export function capaTimbrada(pdf: jsPDF, capa: CapaTimbrada) {
  /*
   * Faixa no topo, de margem a margem.
   *
   * A capa dependia inteiramente dos dados para ter alguma presença: sem logo
   * cadastrada, o terço superior ficava literalmente em branco, e a página
   * abria com um vazio. A faixa não precisa de dado nenhum e dá à capa um
   * começo — é o que um papel timbrado faz com a marca impressa.
   */
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, LARGURA, 10, "F");

  if (capa.logoDataUrl) {
    // Falha de imagem não pode derrubar a geração do documento inteiro: o
    // documento sai sem logo, e sai.
    try { pdf.addImage(capa.logoDataUrl, "PNG", MARGEM, 20, 24, 24); }
    catch { /* logo inválida: segue sem ela */ }
  }

  if (capa.revisao) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(30);
    pdf.text(capa.revisao, LARGURA - MARGEM, 28, { align: "right" });
  }
  if (capa.meta) {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(120);
    pdf.text(capa.meta, LARGURA - MARGEM, 33, { align: "right" });
  }

  pdf.setDrawColor(200); pdf.setLineWidth(0.4);
  pdf.line(MARGEM, 48, LARGURA - MARGEM, 48);

  // ── Título ────────────────────────────────────────────────────────────────
  pdf.setTextColor(15, 23, 42); pdf.setFont("helvetica", "bold"); pdf.setFontSize(52);
  pdf.text(capa.sigla, MARGEM, 92);
  // Régua curta sob a sigla: ancora o título, que antes flutuava sozinho no
  // meio de uma página em branco.
  pdf.setFillColor(15, 23, 42);
  pdf.rect(MARGEM, 98, 26, 1.6, "F");

  pdf.setFont("helvetica", "normal"); pdf.setFontSize(15); pdf.setTextColor(40);
  pdf.text(capa.titulo, MARGEM, 110);
  if (capa.subtitulo) {
    pdf.setFontSize(11); pdf.setTextColor(110);
    pdf.text(capa.subtitulo, MARGEM, 118);
  }
  if (capa.nota) {
    pdf.setFontSize(9); pdf.setTextColor(130);
    pdf.text(capa.nota, MARGEM, 125);
  }

  /*
   * ── Painel de identificação ───────────────────────────────────────────────
   *
   * A capa tinha o título no terço de cima, a empresa no pé e setecentos
   * pixels de nada no meio — a marca d'água era a única coisa ali. Não era
   * respiro, era buraco: quem abre um PGR procura justamente estes dados, e
   * eles estavam espremidos em linhas corridas no rodapé.
   *
   * Agora o miolo é o painel que identifica o documento: empresa no alto,
   * depois os campos em duas colunas, cada um com rótulo miúdo e valor em
   * destaque. Campo sem dado não entra — quem monta a lista já filtra.
   */
  /*
   * O painel é ancorado pelo PÉ, não pelo topo.
   *
   * Preso no topo, ele terminava a dois terços da altura e o resto da página
   * descia vazio até a borda — a capa ficava com todo o peso em cima e nada
   * embaixo. Ancorado embaixo, o branco fica entre o título e o painel, que é
   * onde respiro é respiro, e a página fecha.
   */
  const PAINEL_BASE = 262;

  /*
   * Os campos são distribuídos em linhas de duas colunas ANTES de desenhar.
   *
   * Contar a altura de um jeito e desenhar de outro, como estava, produzia os
   * dois erros juntos: sobrava uma faixa vazia no pé do painel, e a segunda
   * coluna nunca era usada quando havia um campo largo no meio da lista.
   */
  const linhasDeCampos: CampoCapa[][] = [];
  capa.campos.forEach((campo) => {
    const ultima = linhasDeCampos[linhasDeCampos.length - 1];
    if (!campo.largo && ultima && ultima.length === 1 && !ultima[0].largo) ultima.push(campo);
    else linhasDeCampos.push([campo]);
  });

  const PAINEL_X = MARGEM;
  const PAINEL_L = LARGURA - MARGEM * 2;
  const larguraCol = (PAINEL_L - 16) / 2;

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
  const nomeEmpresa = pdf.splitTextToSize(capa.empresaNome || "Empresa", PAINEL_L - 16) as string[];

  const alturaPainel =
    11 + nomeEmpresa.length * 7 + capa.identificacao.length * 5 + 6 + linhasDeCampos.length * 13 + 2;
  const PAINEL_Y = PAINEL_BASE - alturaPainel;

  pdf.setFillColor(248, 249, 251);
  pdf.setDrawColor(222);
  pdf.setLineWidth(0.3);
  pdf.rect(PAINEL_X, PAINEL_Y, PAINEL_L, alturaPainel, "FD");
  // Faixa na borda esquerda, na cor do documento: liga o painel ao título.
  pdf.setFillColor(15, 23, 42);
  pdf.rect(PAINEL_X, PAINEL_Y, 1.8, alturaPainel, "F");

  let y = PAINEL_Y + 11;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(15, 23, 42);
  pdf.text(nomeEmpresa, PAINEL_X + 8, y);
  y += nomeEmpresa.length * 7;

  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setTextColor(90);
  capa.identificacao.forEach((linha) => { pdf.text(linha, PAINEL_X + 8, y); y += 5; });

  y += 6;
  linhasDeCampos.forEach((linha) => {
    linha.forEach((campo, i) => {
      const x = PAINEL_X + 8 + i * larguraCol;
      const largura = campo.largo ? PAINEL_L - 16 : larguraCol - 6;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(130);
      pdf.text(campo.rotulo.toUpperCase(), x, y);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5); pdf.setTextColor(25);
      pdf.text(pdf.splitTextToSize(campo.valor, largura)[0], x, y + 5);
    });
    y += 13;
  });

  pdf.setTextColor(0);
}


/** Sumário, inserido como página 2 — só dá para montar depois de tudo desenhado. */
export function sumario(pdf: jsPDF, toc: ItemSumario[]) {
  if (toc.length === 0) return;
  pdf.insertPage(2);
  pdf.setPage(2);
  let y = 15;
  pdf.setTextColor(15, 23, 42); pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
  pdf.text("Sumário", 10, y + 4);
  y += 7;
  pdf.setDrawColor(200); pdf.setLineWidth(0.3); pdf.line(10, y, 200, y);
  pdf.setTextColor(0); y += 7;

  toc.forEach((item) => {
    if (y > 272) return;
    // A inserção da página 2 empurrou todo o resto: o número anotado durante o
    // desenho vale um a menos do que a página final.
    const pagina = String(item.pagina + 1);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(30);
    const titulo = pdf.splitTextToSize(item.titulo, 160)[0];
    pdf.text(titulo, 12, y);
    const larguraTitulo = pdf.getTextWidth(titulo);
    const larguraPagina = pdf.getTextWidth(pagina);
    // Linha pontilhada ligando título e página, para o olho não se perder.
    pdf.setTextColor(170);
    const inicio = 12 + larguraTitulo + 2;
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
      if (p === 1) {
        /*
         * Na CAPA a marca é horizontal, na faixa vazia entre o título e o
         * painel da empresa.
         *
         * Na diagonal ela subia pela direita e cortava a sigla do documento e
         * o subtítulo — as duas coisas que a capa existe para dizer. E, de
         * quebra, aquela faixa era o buraco branco da página. Deitada ali, a
         * marca não disputa com nada e ainda ocupa o vazio.
         */
        pdf.setFontSize(40);
        /*
         * Centralizada na mão: o `align: "center"` do jsPDF mede o texto sem
         * contar o `charSpace`, então a palavra saía deslocada para a direita
         * pela soma dos espaços entre as letras.
         */
        const ESPACO_ENTRE_LETRAS = 3;
        const largura =
          pdf.getTextWidth(opts.marca) + ESPACO_ENTRE_LETRAS * Math.max(0, opts.marca.length - 1);
        pdf.text(opts.marca, 105 - largura / 2, 168, { charSpace: ESPACO_ENTRE_LETRAS } as any);
      } else {
        pdf.setFontSize(78);
        pdf.text(opts.marca, 105, 165, { align: "center", angle: 35 } as any);
      }
      if (typeof anyDoc.GState === "function") { anyDoc.setGState(new anyDoc.GState({ opacity: 1 })); }
      pdf.setTextColor(0);
    }
    if (p === 1) continue;
    /*
     * O rodapé segue o tamanho REAL da página.
     *
     * Estava fixo em 284/295 de altura e 200 de borda — A4 em pé. Nas
     * páginas deitadas do inventário isso desenharia o QR Code e o número da
     * página muito abaixo do papel, isto é, fora dele.
     */
    const larguraPg = pdf.internal.pageSize.getWidth();
    const alturaPg = pdf.internal.pageSize.getHeight();
    const borda = larguraPg - 10;
    const linhaRodape = alturaPg - 13;
    pdf.setDrawColor(215); pdf.setLineWidth(0.3); pdf.line(10, linhaRodape, borda, linhaRodape);
    pdf.addImage(qrDataUrl, "PNG", 10, linhaRodape + 2, 11, 11);
    pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal"); pdf.setTextColor(110);
    /*
     * Três linhas, não quatro, e a numeração fora delas: a página é o que
     * mais se procura num documento impresso, e estava no meio de uma frase
     * de 6,5pt entre o hash e o aviso de assinatura.
     */
    opts.linhas(p, total).slice(0, 3).forEach((linha, i) =>
      pdf.text(linha, 24, linhaRodape + 4 + i * 3));
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(60);
    pdf.text(`Página ${p} de ${total}`, borda, linhaRodape + 10, { align: "right" });
    pdf.setTextColor(0);
  }
}

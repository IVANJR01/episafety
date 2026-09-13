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
export interface B { doc: jsPDF; y: number; toc: ItemSumario[]; }

export const ensure = (b: B, h: number) => { if (b.y + h > 278) { b.doc.addPage(); b.y = 15; } };

/**
 * Abre uma seção e registra a página no sumário.
 *
 * O número é anotado DEPOIS do `ensure`: se o título não coubesse na página
 * atual, ele salta para a próxima e o sumário apontaria a página errada.
 */
export function title(b: B, t: string) {
  ensure(b, 10);
  b.toc.push({ titulo: t, pagina: b.doc.getCurrentPageInfo().pageNumber });
  b.doc.setFillColor(15, 23, 42); b.doc.rect(10, b.y, 190, 6, "F");
  b.doc.setTextColor(255); b.doc.setFontSize(10); b.doc.setFont("helvetica", "bold");
  b.doc.text(t, 12, b.y + 4.2); b.doc.setTextColor(0); b.y += 8;
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
export function tabela(b: B, colunas: { rotulo: string; x: number; w: number }[]) {
  const desenhaCabecalho = () => {
    b.doc.setFillColor(240, 240, 240); b.doc.rect(10, b.y, 190, 6, "F");
    b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(7.5); b.doc.setTextColor(30);
    colunas.forEach((c) => b.doc.text(c.rotulo, c.x, b.y + 4));
    b.doc.setTextColor(0); b.y += 7;
  };
  desenhaCabecalho();
  return (celulas: string[]) => {
    const textos = colunas.map((c, i) => b.doc.splitTextToSize(celulas[i] ?? "—", c.w));
    const h = Math.max(...textos.map((t) => t.length)) * 3.4 + 3;
    if (b.y + h > 278) { b.doc.addPage(); b.y = 15; desenhaCabecalho(); }
    b.doc.setDrawColor(225); b.doc.line(10, b.y, 200, b.y);
    b.doc.setFont("helvetica", "normal"); b.doc.setFontSize(7.5);
    textos.forEach((t, i) => b.doc.text(t, colunas[i].x, b.y + 3.5));
    b.y += h;
  };
}

export function kv(b: B, label: string, value: string, full = false) {
  ensure(b, 7);
  b.doc.setFontSize(7); b.doc.setFont("helvetica", "normal"); b.doc.setTextColor(110);
  b.doc.text(label.toUpperCase(), 12, b.y);
  b.doc.setTextColor(0); b.doc.setFontSize(9); b.doc.setFont("helvetica", "bold");
  const lines = b.doc.splitTextToSize(value || "—", full ? 186 : 90);
  b.doc.text(lines, 12, b.y + 4);
  b.y += 4 + lines.length * 3.5 + 1;
}

export function para(b: B, txt: string, size = 8, color: [number, number, number] = [60, 60, 60]) {
  ensure(b, 6);
  b.doc.setFont("helvetica", "normal"); b.doc.setFontSize(size); b.doc.setTextColor(...color);
  const lines = b.doc.splitTextToSize(txt, 186);
  b.doc.text(lines, 12, b.y + 3);
  b.y += 3 + lines.length * (size * 0.42);
  b.doc.setTextColor(0);
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
  /** CNPJ, unidade, código do documento. */
  identificacao: string[];
  /** Emissão, vigência, responsável técnico. */
  dados: string[];
}

/**
 * A capa: papel timbrado, não banner.
 *
 * Marca e revisão no alto, título no corpo, identificação da empresa no pé.
 * A faixa azul-marinho que ocupava o terço superior empurrava tudo para baixo
 * e não dizia nada — o espaço passou a ser do título.
 */
export function capaTimbrada(pdf: jsPDF, capa: CapaTimbrada) {
  if (capa.logoDataUrl) {
    // Falha de imagem não pode derrubar a geração do documento inteiro: o
    // documento sai sem logo, e sai.
    try { pdf.addImage(capa.logoDataUrl, "PNG", MARGEM, 14, 24, 24); }
    catch { /* logo inválida: segue sem ela */ }
  }

  if (capa.revisao) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(30);
    pdf.text(capa.revisao, LARGURA - MARGEM, 22, { align: "right" });
  }
  if (capa.meta) {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(120);
    pdf.text(capa.meta, LARGURA - MARGEM, 27, { align: "right" });
  }

  pdf.setDrawColor(200); pdf.setLineWidth(0.4);
  pdf.line(MARGEM, 42, LARGURA - MARGEM, 42);

  pdf.setTextColor(15, 23, 42); pdf.setFont("helvetica", "bold"); pdf.setFontSize(46);
  pdf.text(capa.sigla, MARGEM, 96);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(14); pdf.setTextColor(40);
  pdf.text(capa.titulo, MARGEM, 107);
  if (capa.subtitulo) {
    pdf.setFontSize(11); pdf.setTextColor(110);
    pdf.text(capa.subtitulo, MARGEM, 114);
  }
  if (capa.nota) {
    pdf.setFontSize(9); pdf.setTextColor(110);
    pdf.text(capa.nota, MARGEM, 121);
  }

  /*
   * Identificação da empresa no pé da capa.
   *
   * Ela ficava logo abaixo do título, e o resto da página descia vazio até a
   * borda. Aqui embaixo ela fecha a capa e o título fica com o espaço que
   * pedia — é a proporção do modelo de referência.
   */
  pdf.setDrawColor(225); pdf.setLineWidth(0.3);
  pdf.line(MARGEM, 228, LARGURA - MARGEM, 228);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.setTextColor(15, 23, 42);
  const nomeEmpresa = pdf.splitTextToSize(capa.empresaNome || "Empresa", LARGURA - MARGEM * 2) as string[];
  pdf.text(nomeEmpresa, MARGEM, 238);
  let y = 238 + nomeEmpresa.length * 7;

  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(60);
  capa.identificacao.forEach((linha) => { pdf.text(linha, MARGEM, y); y += 5.5; });
  y += 4;
  capa.dados.forEach((linha) => { pdf.text(linha, MARGEM, y); y += 5.5; });
  pdf.setTextColor(0);
}

/** Sumário, inserido como página 2 — só dá para montar depois de tudo desenhado. */
export function sumario(pdf: jsPDF, toc: ItemSumario[]) {
  if (toc.length === 0) return;
  pdf.insertPage(2);
  pdf.setPage(2);
  let y = 15;
  pdf.setFillColor(15, 23, 42); pdf.rect(10, y, 190, 6, "F");
  pdf.setTextColor(255); pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
  pdf.text("Sumário", 12, y + 4.2); pdf.setTextColor(0); y += 11;

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
      const anyDoc = pdf as any;
      if (typeof anyDoc.GState === "function") { anyDoc.setGState(new anyDoc.GState({ opacity: 0.18 })); }
      pdf.setTextColor(180, 50, 50); pdf.setFont("helvetica", "bold"); pdf.setFontSize(90);
      pdf.text(opts.marca, 105, 160, { align: "center", angle: 35 } as any);
      if (typeof anyDoc.GState === "function") { anyDoc.setGState(new anyDoc.GState({ opacity: 1 })); }
      pdf.setTextColor(0);
    }
    if (p === 1) continue;
    pdf.setDrawColor(200); pdf.line(10, 283, 200, 283);
    pdf.addImage(qrDataUrl, "PNG", 10, 285, 18, 18);
    pdf.setFontSize(7); pdf.setFont("helvetica", "normal"); pdf.setTextColor(80);
    opts.linhas(p, total).forEach((linha, i) => pdf.text(linha, 30, 288 + i * 3));
    pdf.setTextColor(0);
  }
}

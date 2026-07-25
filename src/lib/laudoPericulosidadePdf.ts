// Gerador de PDF para Laudo Técnico de Periculosidade (NR-16).
import jsPDF from "jspdf";
import { LaudoPericulosidade, CATEGORIA_PERICULOSIDADE_LABEL, FORMA_EXPOSICAO_LABEL } from "@/lib/laudoPericulosidadeTypes";

export interface LaudoPericulosidadePdfContext {
  laudo: LaudoPericulosidade;
  empresaNome: string | null;
  empresaCnpj: string | null;
  funcionarioNome: string | null;
  funcionarioMatricula: string | null;
}

const MARGIN = 15;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

function ensureSpace(doc: jsPDF, y: number, needed = 20): number {
  if (y + needed > 280) {
    doc.addPage();
    return 20;
  }
  return y;
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 12);
  doc.setFillColor(30, 41, 59);
  doc.rect(MARGIN, y, CONTENT_W, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, MARGIN + 2, y + 5);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return y + 10;
}

function paragraph(doc: jsPDF, text: string | null | undefined, y: number, fontSize = 9): number {
  if (!text || !text.trim()) return y;
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  for (const line of lines) {
    y = ensureSpace(doc, y, 5);
    doc.text(line, MARGIN, y);
    y += 5;
  }
  return y + 1;
}

export function gerarLaudoPericulosidadePdf(ctx: LaudoPericulosidadePdfContext): jsPDF {
  const { laudo, empresaNome, empresaCnpj, funcionarioNome, funcionarioMatricula } = ctx;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, PAGE_W, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("LAUDO TÉCNICO DE PERICULOSIDADE", PAGE_W / 2, 10, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("NR-16 — Atividades e Operações Perigosas", PAGE_W / 2, 16, { align: "center" });
  doc.setTextColor(0, 0, 0);

  let y = 30;

  y = sectionTitle(doc, "1. IDENTIFICAÇÃO", y);
  doc.setFontSize(9);
  const dataAval = laudo.data_avaliacao ? new Date(laudo.data_avaliacao).toLocaleDateString("pt-BR") : "—";
  const dataEmissao = laudo.data_emissao ? new Date(laudo.data_emissao).toLocaleDateString("pt-BR") : "—";
  const linhas: [string, string][] = [
    ["Empresa", empresaNome || "—"],
    ["CNPJ", empresaCnpj || "—"],
    ["Documento", `${laudo.titulo}  •  Versão ${laudo.versao}`],
    ["Data da avaliação", dataAval],
    ["Data de emissão", dataEmissao],
    ["Setor", laudo.setor || "—"],
    ["Função avaliada", laudo.funcao || "—"],
    ["Funcionário", funcionarioNome ? `${funcionarioNome}${funcionarioMatricula ? ` (matr. ${funcionarioMatricula})` : ""}` : "—"],
  ];
  for (const [k, v] of linhas) {
    y = ensureSpace(doc, y, 5);
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(v, CONTENT_W - 40);
    doc.text(lines, MARGIN + 37, y);
    y += 5 * lines.length;
  }
  y += 2;

  y = sectionTitle(doc, "2. METODOLOGIA", y);
  y = paragraph(doc, laudo.metodologia || "Análise qualitativa das atividades desenvolvidas, do local de trabalho e do tempo de exposição a agentes ou condições perigosas, conforme critérios técnicos da NR-16 e seus anexos.", y);

  y = sectionTitle(doc, "3. ATIVIDADES PERIGOSAS AVALIADAS", y);
  if (!laudo.atividades.length) {
    y = paragraph(doc, "Nenhuma atividade perigosa identificada.", y);
  } else {
    for (const a of laudo.atividades) {
      y = ensureSpace(doc, y, 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`• ${CATEGORIA_PERICULOSIDADE_LABEL[a.categoria]}`, MARGIN, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const detalhes = [
        a.descricao ? `Descrição: ${a.descricao}` : null,
        `Forma de exposição: ${FORMA_EXPOSICAO_LABEL[a.forma_exposicao]}`,
        a.area_classificada ? `Área classificada / local: ${a.area_classificada}` : null,
      ].filter(Boolean) as string[];
      for (const d of detalhes) {
        const lines = doc.splitTextToSize(`— ${d}`, CONTENT_W - 5);
        for (const line of lines) {
          y = ensureSpace(doc, y, 5);
          doc.text(line, MARGIN + 5, y);
          y += 4.5;
        }
      }
      y += 2;
    }
  }

  y = sectionTitle(doc, "4. CONCLUSÃO", y);
  const conclusaoTexto = laudo.caracterizado
    ? `Caracterizada periculosidade, com adicional de ${laudo.percentual_aplicavel}% sobre o salário base do trabalhador, nos termos da NR-16.`
    : "Não caracterizada periculosidade para a função/setor avaliado.";
  y = paragraph(doc, conclusaoTexto, y);
  if (laudo.base_legal) y = paragraph(doc, `Base legal: ${laudo.base_legal}`, y);
  if (laudo.fundamentacao) y = paragraph(doc, laudo.fundamentacao, y);

  y = sectionTitle(doc, "5. RECOMENDAÇÕES", y);
  y = paragraph(doc, laudo.recomendacoes || "—", y);

  y = ensureSpace(doc, y, 35);
  y = sectionTitle(doc, "6. RESPONSABILIDADE TÉCNICA", y);
  y += 12;
  doc.setFontSize(9);
  doc.line(MARGIN, y, MARGIN + 90, y);
  doc.text("Responsável Técnico", MARGIN, y + 5);
  if (laudo.responsavel_tecnico_nome) {
    doc.setFont("helvetica", "bold");
    doc.text(laudo.responsavel_tecnico_nome, MARGIN, y + 10);
    doc.setFont("helvetica", "normal");
    if (laudo.responsavel_tecnico_registro) doc.text(laudo.responsavel_tecnico_registro, MARGIN, y + 14);
  }

  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${pages}`, PAGE_W - MARGIN, 292, { align: "right" });
    doc.text(`Laudo de Periculosidade — ${laudo.titulo} • v${laudo.versao}`, MARGIN, 292);
    doc.setTextColor(0, 0, 0);
  }

  return doc;
}

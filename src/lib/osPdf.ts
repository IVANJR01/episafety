// Gerador de PDF profissional para Ordem de Serviço de SST.
// Layout: capa + identificação + atividades + riscos + EPIs + medidas + proibições +
// procedimentos em caso de acidente + responsabilidades + campo de assinatura.
import jsPDF from "jspdf";
import { OrdemServicoSst, OsRiscoSnapshot, OsEpiSnapshot } from "@/lib/osTypes";
import { GRUPO_RISCO_LABEL } from "@/lib/gesFicha";

export interface OsPdfContext {
  os: OrdemServicoSst;
  empresaNome: string | null;
  empresaCnpj: string | null;
  gheNome: string | null;
  funcaoNome: string | null;
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

function riscosSection(doc: jsPDF, riscos: OsRiscoSnapshot[], y: number): number {
  if (!riscos.length) {
    return paragraph(doc, "Não há riscos identificados para este GES/GHE.", y);
  }
  const grouped: Record<string, OsRiscoSnapshot[]> = {};
  for (const r of riscos) {
    const g = r.grupo || "outro";
    (grouped[g] = grouped[g] || []).push(r);
  }
  doc.setFontSize(9);
  for (const grupo of Object.keys(grouped)) {
    y = ensureSpace(doc, y, 8);
    doc.setFont("helvetica", "bold");
    doc.text(`• ${GRUPO_RISCO_LABEL[grupo] || grupo}:`, MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    for (const r of grouped[grupo]) {
      const desc = `— ${r.descricao}${r.fonte ? ` (fonte: ${r.fonte})` : ""}${r.exposicao ? ` — exposição: ${r.exposicao}` : ""}`;
      const lines = doc.splitTextToSize(desc, CONTENT_W - 5);
      for (const line of lines) {
        y = ensureSpace(doc, y, 5);
        doc.text(line, MARGIN + 5, y);
        y += 4.5;
      }
    }
    y += 2;
  }
  return y;
}

function episSection(doc: jsPDF, epis: OsEpiSnapshot[], y: number): number {
  if (!epis.length) {
    return paragraph(doc, "Nenhum EPI vinculado no cadastro. Preencher conforme análise de risco.", y);
  }
  doc.setFontSize(9);
  for (const e of epis) {
    y = ensureSpace(doc, y, 5);
    doc.text(`• ${e.nome}${e.ca ? ` — CA ${e.ca}` : ""}`, MARGIN, y);
    y += 5;
  }
  return y + 1;
}

export function gerarOsPdf(ctx: OsPdfContext): jsPDF {
  const { os, empresaNome, empresaCnpj, gheNome, funcaoNome, funcionarioNome, funcionarioMatricula } = ctx;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Cabeçalho
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, PAGE_W, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ORDEM DE SERVIÇO DE SEGURANÇA DO TRABALHO", PAGE_W / 2, 10, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("NR-01 — item 1.4.1 alínea b (obrigação do empregador)", PAGE_W / 2, 16, { align: "center" });
  doc.setTextColor(0, 0, 0);

  let y = 30;

  // Identificação
  y = sectionTitle(doc, "1. IDENTIFICAÇÃO", y);
  doc.setFontSize(9);
  const dataEmissao = os.data_emissao ? new Date(os.data_emissao).toLocaleDateString("pt-BR") : "—";
  const linhas = [
    ["Empresa", empresaNome || "—"],
    ["CNPJ", empresaCnpj || "—"],
    ["Documento", `${os.titulo}  •  Versão ${os.versao}  •  Emitida em ${dataEmissao}`],
    ["Escopo", os.escopo === "funcionario" ? "Por funcionário" : os.escopo === "funcao" ? "Por função" : "Por GES/GHE"],
    ["GES/GHE", gheNome || "—"],
    ["Função", funcaoNome || "—"],
    ["Funcionário", funcionarioNome ? `${funcionarioNome}${funcionarioMatricula ? ` (matr. ${funcionarioMatricula})` : ""}` : "—"],
  ];
  for (const [k, v] of linhas) {
    y = ensureSpace(doc, y, 5);
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(v, CONTENT_W - 35);
    doc.text(lines, MARGIN + 32, y);
    y += 5 * lines.length;
  }
  y += 2;

  // Atividades
  y = sectionTitle(doc, "2. ATIVIDADES DESENVOLVIDAS", y);
  y = paragraph(doc, os.atividades || "—", y);

  // Riscos
  y = sectionTitle(doc, "3. RISCOS OCUPACIONAIS", y);
  y = riscosSection(doc, os.riscos_snapshot || [], y);

  // EPIs
  y = sectionTitle(doc, "4. EPIs OBRIGATÓRIOS", y);
  y = episSection(doc, os.epis_snapshot || [], y);

  // Medidas preventivas
  y = sectionTitle(doc, "5. MEDIDAS PREVENTIVAS E DE CONTROLE", y);
  y = paragraph(doc, os.medidas_preventivas || "—", y);

  // Proibições
  y = sectionTitle(doc, "6. PROIBIÇÕES", y);
  y = paragraph(doc, os.proibicoes || "—", y);

  // Procedimentos em caso de acidente
  y = sectionTitle(doc, "7. PROCEDIMENTOS EM CASO DE ACIDENTE", y);
  y = paragraph(doc, os.procedimentos_acidente || "—", y);

  // Responsabilidades
  y = sectionTitle(doc, "8. RESPONSABILIDADES DO TRABALHADOR", y);
  y = paragraph(
    doc,
    os.responsabilidades ||
      "O trabalhador declara que recebeu, leu e compreendeu as orientações desta Ordem de Serviço. Compromete-se a cumprir integralmente as medidas de segurança, usar corretamente os EPIs fornecidos, comunicar imediatamente ao superior qualquer condição insegura e não realizar atividade para a qual não tenha sido treinado, sob pena das sanções previstas em lei e no regulamento interno.",
    y,
  );

  // Assinaturas
  y = ensureSpace(doc, y, 45);
  y = sectionTitle(doc, "9. ASSINATURAS", y);
  y += 10;
  doc.setFontSize(9);

  // Coluna trabalhador
  doc.line(MARGIN, y, MARGIN + 80, y);
  doc.text("Trabalhador", MARGIN, y + 5);
  if (funcionarioNome) {
    doc.setFont("helvetica", "bold");
    doc.text(funcionarioNome, MARGIN, y + 10);
    doc.setFont("helvetica", "normal");
  }

  // Coluna responsável técnico
  const rx = MARGIN + 100;
  doc.line(rx, y, rx + 80, y);
  doc.text("Responsável Técnico (SST)", rx, y + 5);
  if (os.responsavel_tecnico_nome) {
    doc.setFont("helvetica", "bold");
    doc.text(os.responsavel_tecnico_nome, rx, y + 10);
    doc.setFont("helvetica", "normal");
    if (os.responsavel_tecnico_registro) doc.text(os.responsavel_tecnico_registro, rx, y + 14);
  }

  // Rodapé
  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${pages}`, PAGE_W - MARGIN, 292, { align: "right" });
    doc.text(`OS ${os.titulo} • v${os.versao}`, MARGIN, 292);
    doc.setTextColor(0, 0, 0);
  }

  return doc;
}

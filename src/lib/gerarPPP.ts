import jsPDF from "jspdf";
import previdenciaLogo from "@/assets/previdencia-logo.png";

export interface PPPData {
  // Dados Administrativos
  cnpj: string;
  nomeEmpresa: string;
  cnae: string;
  nomeTrabalhador: string;
  brPdh: string; // BR, PDH ou NA
  cpf: string;
  dataNascimento: string;
  sexo: string;
  matriculaEsocial: string;
  dataAdmissao: string;
  dataDemissao: string;
  regime: string;
  cargo: string;
  funcao: string;
  cbo: string;
  setor: string;
  codigoGfip: string;
  // CAT
  cats: { dataRegistro: string; numeroCat: string }[];
  // Registros Ambientais
  riscos: {
    tipo: string;
    fatorRisco: string;
    intensidade: string;
    tecnica: string;
    epcEficaz: string;
    epiEficaz: string;
    caEpi: string;
  }[];
  profissiografia: string;
  // Responsáveis
  engenheiro: { nome: string; cpf: string; registro: string; periodo: string } | null;
  medico: { nome: string; cpf: string; registro: string; periodo: string } | null;
  // Seção V
  dataEmissao: string;
  representanteLegal: { nome: string; cpf: string } | null;
  observacoes: string;
}

const TIPO_RISCO_LABEL: Record<string, string> = {
  fisico: "F",
  quimico: "Q",
  biologico: "B",
  ergonomico: "E",
  acidente: "A",
};

export function gerarPPPPdf(data: PPPData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const M = 8;
  const CW = W - 2 * M;
  let y = M;

  const setFont = (style: "normal" | "bold" = "normal", size = 7) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };

  const drawCell = (
    x: number, cy: number, w: number, h: number, text: string,
    opts?: { bold?: boolean; size?: number; align?: "left" | "center"; bg?: string; valign?: "top" | "middle" }
  ) => {
    if (opts?.bg) {
      doc.setFillColor(opts.bg);
      doc.rect(x, cy, w, h, "F");
    }
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(x, cy, w, h);
    setFont(opts?.bold ? "bold" : "normal", opts?.size || 7);
    const textX = opts?.align === "center" ? x + w / 2 : x + 1.2;
    const textY = opts?.valign === "top" ? cy + 3 : cy + h / 2 + 1;
    doc.text(text, textX, textY, { align: opts?.align || "left", maxWidth: w - 2.5 });
  };

  const drawRow = (
    cy: number,
    cells: { w: number; text: string; bold?: boolean; bg?: string; align?: "center" | "left"; size?: number }[],
    h = 7
  ) => {
    let cx = M;
    cells.forEach((cell) => {
      drawCell(cx, cy, cell.w, h, cell.text, { bold: cell.bold, bg: cell.bg, align: cell.align, size: cell.size });
      cx += cell.w;
    });
    return cy + h;
  };

  const checkPage = (needed = 30) => {
    if (y + needed > 287) { doc.addPage(); y = M; }
  };

  const headerBg = "#d9d9d9";
  const periodo = `${data.dataAdmissao || "__/__/____"} a ${data.dataDemissao || "atual"}`;

  // ========== CABEÇALHO ==========
  try {
    doc.addImage(previdenciaLogo, "PNG", M, y, 22, 10);
  } catch { /* logo não disponível */ }
  setFont("bold", 8);
  doc.text("INSTITUTO NACIONAL DO SEGURO SOCIAL", W / 2, y + 4, { align: "center" });
  setFont("bold", 10);
  doc.text("PERFIL PROFISSIOGRÁFICO PREVIDENCIÁRIO – PPP", W / 2, y + 9, { align: "center" });
  y += 13;

  // ========== DADOS ADMINISTRATIVOS ==========
  y = drawRow(y, [{ w: CW, text: "DADOS ADMINISTRATIVOS", bold: true, bg: headerBg, align: "center", size: 8 }], 6);

  // Campos 1-3
  const w13 = [CW * 0.38, CW * 0.38, CW * 0.24];
  y = drawRow(y, [
    { w: w13[0], text: `1 – Nº CNPJ: ${data.cnpj}`, size: 6 },
    { w: w13[1], text: `2 – Nome Empresarial: ${data.nomeEmpresa}`, size: 6 },
    { w: w13[2], text: `3 – CNAE: ${data.cnae}`, size: 6 },
  ]);

  // Campos 4-6
  y = drawRow(y, [
    { w: CW * 0.45, text: `4 – Nome do Trabalhador: ${data.nomeTrabalhador}`, size: 6 },
    { w: CW * 0.15, text: `5 – BR/PDH: ${data.brPdh || "NA"}`, size: 6 },
    { w: CW * 0.40, text: `6 – CPF nº: ${data.cpf}`, size: 6 },
  ]);

  // Campos 7-9
  y = drawRow(y, [
    { w: CW / 3, text: `7 – Data de Nascimento: ${data.dataNascimento}`, size: 6 },
    { w: CW / 3, text: `8 – Sexo (F/M): ${data.sexo}`, size: 6 },
    { w: CW / 3, text: `9 – Matrícula eSocial: ${data.matriculaEsocial || ""}`, size: 6 },
  ]);

  // Campos 10-11
  y = drawRow(y, [
    { w: CW / 2, text: `10 – Data de Admissão: ${data.dataAdmissao}`, size: 6 },
    { w: CW / 2, text: `11 – Regime Revezamento: ${data.regime || "NA"}`, size: 6 },
  ]);

  // 12 – CAT REGISTRADA
  y = drawRow(y, [{ w: CW, text: "12 – CAT REGISTRADA", bold: true, bg: headerBg, size: 7 }], 5);
  y = drawRow(y, [
    { w: CW / 2, text: "12.1 – Data do Registro", bold: true, size: 6 },
    { w: CW / 2, text: "12.2 – Número da CAT", bold: true, size: 6 },
  ], 5);

  if (data.cats && data.cats.length > 0) {
    data.cats.forEach((cat) => {
      y = drawRow(y, [
        { w: CW / 2, text: cat.dataRegistro || "N/A", size: 6 },
        { w: CW / 2, text: cat.numeroCat || "N/A", size: 6 },
      ], 5);
    });
  } else {
    y = drawRow(y, [
      { w: CW / 2, text: "N/A", size: 6 },
      { w: CW / 2, text: "Inexistente", size: 6 },
    ], 5);
  }

  // 13 – LOTAÇÃO E ATRIBUIÇÃO
  y = drawRow(y, [{ w: CW, text: "13 – LOTAÇÃO E ATRIBUIÇÃO", bold: true, bg: headerBg, size: 7 }], 5);
  const c13 = [CW * 0.16, CW * 0.16, CW * 0.13, CW * 0.15, CW * 0.13, CW * 0.12, CW * 0.15];
  y = drawRow(y, [
    { w: c13[0], text: "13.1 – Período", bold: true, size: 5 },
    { w: c13[1], text: "13.2 – Nº CNPJ", bold: true, size: 5 },
    { w: c13[2], text: "13.3 – Setor", bold: true, size: 5 },
    { w: c13[3], text: "13.4 – Cargo", bold: true, size: 5 },
    { w: c13[4], text: "13.5 – Função", bold: true, size: 5 },
    { w: c13[5], text: "13.6 – Cód. CBO", bold: true, size: 5 },
    { w: c13[6], text: "13.7 – GFIP/eSocial", bold: true, size: 5 },
  ], 5);
  y = drawRow(y, [
    { w: c13[0], text: periodo, size: 5 },
    { w: c13[1], text: data.cnpj, size: 5 },
    { w: c13[2], text: data.setor || "—", size: 5 },
    { w: c13[3], text: data.cargo, size: 5 },
    { w: c13[4], text: data.funcao || "—", size: 5 },
    { w: c13[5], text: data.cbo || "", size: 5 },
    { w: c13[6], text: data.codigoGfip || "01", size: 5 },
  ], 6);

  // 14 – PROFISSIOGRAFIA
  y = drawRow(y, [{ w: CW, text: "14 – PROFISSIOGRAFIA", bold: true, bg: headerBg, size: 7 }], 5);
  y = drawRow(y, [
    { w: CW * 0.16, text: "14.1 – Período", bold: true, size: 5 },
    { w: CW * 0.84, text: "14.2 – Descrição das Atividades", bold: true, size: 5 },
  ], 5);

  const profLines = doc.splitTextToSize(data.profissiografia || "—", CW * 0.84 - 3);
  const profH = Math.max(8, profLines.length * 3.2 + 3);
  drawCell(M, y, CW * 0.16, profH, periodo, { size: 5 });
  doc.rect(M + CW * 0.16, y, CW * 0.84, profH);
  setFont("normal", 5);
  doc.text(profLines, M + CW * 0.16 + 1.2, y + 3);
  y += profH;

  // ========== REGISTROS AMBIENTAIS ==========
  checkPage(40);
  y = drawRow(y, [{ w: CW, text: "REGISTROS AMBIENTAIS", bold: true, bg: headerBg, align: "center", size: 8 }], 6);
  y = drawRow(y, [{ w: CW, text: "15 – EXPOSIÇÃO A FATORES DE RISCOS", bold: true, bg: headerBg, size: 7 }], 5);

  const c15 = [CW * 0.13, CW * 0.06, CW * 0.15, CW * 0.12, CW * 0.12, CW * 0.08, CW * 0.08, CW * 0.26];
  y = drawRow(y, [
    { w: c15[0], text: "15.1 – Período", bold: true, size: 5 },
    { w: c15[1], text: "15.2 – Tipo", bold: true, size: 5 },
    { w: c15[2], text: "15.3 – Fator de Risco", bold: true, size: 5 },
    { w: c15[3], text: "15.4 – Intens./Conc.", bold: true, size: 5 },
    { w: c15[4], text: "15.5 – Técnica", bold: true, size: 5 },
    { w: c15[5], text: "15.6 – EPC Eficaz", bold: true, size: 4 },
    { w: c15[6], text: "15.7 – EPI Eficaz", bold: true, size: 4 },
    { w: c15[7], text: "15.8 – CA EPI informados", bold: true, size: 4 },
  ], 6);

  if (data.riscos.length === 0) {
    y = drawRow(y, [
      { w: c15[0], text: periodo, size: 5 },
      { w: c15[1], text: "—", size: 5 },
      { w: c15[2], text: "Ausência de Agente Nocivo", size: 5 },
      { w: c15[3], text: "NA", size: 5 },
      { w: c15[4], text: "NA", size: 5 },
      { w: c15[5], text: "NA", size: 5 },
      { w: c15[6], text: "NA", size: 5 },
      { w: c15[7], text: "09.01.001", size: 5 },
    ], 6);
  } else {
    data.riscos.forEach((r) => {
      checkPage(8);
      y = drawRow(y, [
        { w: c15[0], text: periodo, size: 5 },
        { w: c15[1], text: TIPO_RISCO_LABEL[r.tipo] || r.tipo, size: 5 },
        { w: c15[2], text: r.fatorRisco, size: 5 },
        { w: c15[3], text: r.intensidade || "—", size: 5 },
        { w: c15[4], text: r.tecnica || "—", size: 5 },
        { w: c15[5], text: r.epcEficaz || "—", size: 5 },
        { w: c15[6], text: r.epiEficaz || "—", size: 5 },
        { w: c15[7], text: r.caEpi || "—", size: 5 },
      ], 6);
    });
  }

  // 16 – RESPONSÁVEL PELOS REGISTROS AMBIENTAIS
  checkPage(20);
  y = drawRow(y, [{ w: CW, text: "16 – RESPONSÁVEL PELOS REGISTROS AMBIENTAIS", bold: true, bg: headerBg, size: 7 }], 5);
  y = drawRow(y, [
    { w: CW * 0.20, text: "16.1 – Período", bold: true, size: 5 },
    { w: CW * 0.20, text: "16.2 – CPF nº", bold: true, size: 5 },
    { w: CW * 0.25, text: "16.3 – Reg. Conselho de Classe", bold: true, size: 5 },
    { w: CW * 0.35, text: "16.4 – Nome do Profissional", bold: true, size: 5 },
  ], 5);
  y = drawRow(y, [
    { w: CW * 0.20, text: data.engenheiro?.periodo || periodo, size: 5 },
    { w: CW * 0.20, text: data.engenheiro?.cpf || "", size: 5 },
    { w: CW * 0.25, text: data.engenheiro?.registro || "", size: 5 },
    { w: CW * 0.35, text: data.engenheiro?.nome || "", size: 5 },
  ], 6);

  // ========== RESULTADOS DE MONITORAÇÃO BIOLÓGICA ==========
  checkPage(35);
  y = drawRow(y, [{ w: CW, text: "RESULTADOS DE MONITORAÇÃO BIOLÓGICA", bold: true, bg: headerBg, align: "center", size: 8 }], 6);

  // Seção de exames (placeholder – mesma estrutura)
  y = drawRow(y, [{ w: CW, text: "Exames médicos clínicos e complementares (Quadros I e II, NR-07)", bold: true, bg: headerBg, size: 6 }], 5);
  y = drawRow(y, [
    { w: CW * 0.15, text: "Data", bold: true, size: 5 },
    { w: CW * 0.15, text: "Tipo", bold: true, size: 5 },
    { w: CW * 0.20, text: "Natureza", bold: true, size: 5 },
    { w: CW * 0.15, text: "Exame (R/S)", bold: true, size: 5 },
    { w: CW * 0.35, text: "Indicação de Resultados", bold: true, size: 5 },
  ], 5);
  y = drawRow(y, [
    { w: CW * 0.15, text: "" },
    { w: CW * 0.15, text: "" },
    { w: CW * 0.20, text: "" },
    { w: CW * 0.15, text: "" },
    { w: CW * 0.35, text: "" },
  ], 8);

  // Responsável biológico
  y = drawRow(y, [{ w: CW, text: "RESPONSÁVEL PELA MONITORAÇÃO BIOLÓGICA", bold: true, bg: headerBg, size: 7 }], 5);
  y = drawRow(y, [
    { w: CW * 0.20, text: "Período", bold: true, size: 5 },
    { w: CW * 0.20, text: "CPF nº", bold: true, size: 5 },
    { w: CW * 0.25, text: "Reg. Conselho de Classe", bold: true, size: 5 },
    { w: CW * 0.35, text: "Nome do Profissional", bold: true, size: 5 },
  ], 5);
  y = drawRow(y, [
    { w: CW * 0.20, text: data.medico?.periodo || periodo, size: 5 },
    { w: CW * 0.20, text: data.medico?.cpf || "", size: 5 },
    { w: CW * 0.25, text: data.medico?.registro || "", size: 5 },
    { w: CW * 0.35, text: data.medico?.nome || "", size: 5 },
  ], 6);

  // ========== RESPONSÁVEIS PELAS INFORMAÇÕES ==========
  checkPage(50);
  y = drawRow(y, [{ w: CW, text: "RESPONSÁVEIS PELAS INFORMAÇÕES", bold: true, bg: headerBg, align: "center", size: 8 }], 6);

  setFont("normal", 5.5);
  const declText = "Declaramos, para todos fins de direito, que as informações prestadas neste documento são verídicas e foram transcritas fielmente dos registros administrativos, das demonstrações ambientais e dos programas médicos de responsabilidade da empresa. É de nosso conhecimento que a prestação de informações falsas neste documento constitui crime de falsificação de documento público, nos termos do art. 297 do Código Penal e, também, que tais informações são de caráter privativo do trabalhador, constituindo crime, nos termos da Lei nº 9.029, de 13 de abril de 1995, práticas discriminatórias decorrentes de sua exigibilidade por outrem, bem como de sua divulgação para terceiros, ressalvado quando exigida pelos órgãos públicos competentes.";
  const declLines = doc.splitTextToSize(declText, CW - 4);
  const declH = declLines.length * 2.8 + 4;
  doc.rect(M, y, CW, declH);
  doc.text(declLines, M + 2, y + 3);
  y += declH;

  // 17 – Data emissão / 18 – Representante Legal
  y = drawRow(y, [
    { w: CW / 2, text: `17 – Data da Emissão do PPP: ${data.dataEmissao}`, bold: true, size: 6 },
    { w: CW / 2, text: "18 – Representante Legal da Empresa", bold: true, size: 6 },
  ], 6);

  y = drawRow(y, [
    { w: CW / 2, text: "", size: 6 },
    { w: CW / 4, text: `18.1 – CPF: ${data.representanteLegal?.cpf || ""}`, size: 5 },
    { w: CW / 4, text: `18.2 – Nome: ${data.representanteLegal?.nome || ""}`, size: 5 },
  ], 6);

  // Área de assinatura
  y += 2;
  doc.rect(M, y, CW / 2 - 1, 18);
  setFont("normal", 5);
  doc.text("(Assinatura física ou eletrônica)", M + 5, y + 14);

  doc.rect(M + CW / 2 + 1, y, CW / 2 - 1, 18);
  doc.text("(Assinatura física ou eletrônica)", M + CW / 2 + 6, y + 14);
  y += 20;

  // ========== OBSERVAÇÕES ==========
  checkPage(20);
  y = drawRow(y, [{ w: CW, text: "OBSERVAÇÕES", bold: true, bg: headerBg, align: "center", size: 8 }], 6);

  const obsText = data.observacoes || "Informação declarada com base nas avaliações quantitativas e qualitativas constantes no LTCAT da empresa, em conformidade com o Anexo IV do Decreto 3.048/99.";
  const obsLines = doc.splitTextToSize(obsText, CW - 4);
  const obsH = Math.max(12, obsLines.length * 3 + 4);
  doc.rect(M, y, CW, obsH);
  setFont("normal", 6);
  doc.text(obsLines, M + 2, y + 3.5);
  y += obsH;

  return doc;
}

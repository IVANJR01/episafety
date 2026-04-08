import jsPDF from "jspdf";

interface PPPData {
  // Seção I - Dados Administrativos
  cnpj: string;
  nomeEmpresa: string;
  cnae: string;
  nomeTrabalhador: string;
  nit: string;
  dataNascimento: string;
  sexo: string;
  ctps: string;
  dataAdmissao: string;
  dataDemissao: string;
  regime: string;
  cpf: string;
  cargo: string;
  funcao: string;
  cbo: string;
  setor: string;
  // Seção II - Registros Ambientais
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
  engenheiro: { nome: string; nit: string; registro: string; periodo: string } | null;
  medico: { nome: string; nit: string; registro: string; periodo: string } | null;
  dataEmissao: string;
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
  const M = 10; // margin
  const CW = W - 2 * M; // content width
  let y = M;

  const setFont = (style: "normal" | "bold" = "normal", size = 7) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };

  const drawCell = (x: number, cy: number, w: number, h: number, text: string, opts?: { bold?: boolean; size?: number; align?: "left" | "center"; bg?: string }) => {
    if (opts?.bg) {
      doc.setFillColor(opts.bg);
      doc.rect(x, cy, w, h, "F");
    }
    doc.setDrawColor(0);
    doc.rect(x, cy, w, h);
    setFont(opts?.bold ? "bold" : "normal", opts?.size || 7);
    const textX = opts?.align === "center" ? x + w / 2 : x + 1.5;
    const textY = cy + h / 2 + 1;
    doc.text(text, textX, textY, { align: opts?.align || "left", maxWidth: w - 3 });
  };

  const drawRow = (cy: number, cells: { w: number; text: string; bold?: boolean; bg?: string; align?: "center" | "left"; size?: number }[], h = 7) => {
    let cx = M;
    cells.forEach((cell) => {
      drawCell(cx, cy, cell.w, h, cell.text, { bold: cell.bold, bg: cell.bg, align: cell.align, size: cell.size });
      cx += cell.w;
    });
    return cy + h;
  };

  // === HEADER ===
  setFont("bold", 9);
  doc.text("PREVIDÊNCIA SOCIAL", W / 2, y + 5, { align: "center" });
  setFont("bold", 10);
  doc.text("PERFIL PROFISSIOGRÁFICO PREVIDENCIÁRIO – PPP", W / 2, y + 10, { align: "center" });
  y += 14;

  // === SEÇÃO I ===
  const headerBg = "#e0e0e0";
  y = drawRow(y, [{ w: CW, text: "I – SEÇÃO DE DADOS ADMINISTRATIVOS", bold: true, bg: headerBg, align: "center", size: 8 }], 6);

  // Row 1-3
  y = drawRow(y, [
    { w: CW / 2, text: `1 – CNPJ: ${data.cnpj}`, bold: false },
    { w: CW / 2, text: `2 – Nome Empresarial: ${data.nomeEmpresa}`, bold: false },
  ]);
  y = drawRow(y, [
    { w: CW / 3, text: `3 – CNAE: ${data.cnae}` },
    { w: CW * 2 / 3, text: `4 – Nome do Trabalhador: ${data.nomeTrabalhador}` },
  ]);
  y = drawRow(y, [
    { w: CW / 4, text: `5 – CPF: ${data.cpf}` },
    { w: CW / 4, text: `6 – NIT: ${data.nit}` },
    { w: CW / 4, text: `7 – Data Nasc.: ${data.dataNascimento}` },
    { w: CW / 4, text: `8 – Sexo: ${data.sexo}` },
  ]);
  y = drawRow(y, [
    { w: CW / 3, text: `9 – CTPS: ${data.ctps}` },
    { w: CW / 3, text: `10 – Data Admissão: ${data.dataAdmissao}` },
    { w: CW / 3, text: `11 – Regime: ${data.regime}` },
  ]);

  // 12 - CAT
  y = drawRow(y, [{ w: CW, text: "12 – CAT REGISTRADA", bold: true, bg: headerBg, size: 7 }], 5);
  y = drawRow(y, [
    { w: CW / 4, text: "12.1 – Data do Registro", bold: true, size: 6 },
    { w: CW / 4, text: "12.2 – Número da CAT", bold: true, size: 6 },
    { w: CW / 4, text: "12.1 – Data do Registro", bold: true, size: 6 },
    { w: CW / 4, text: "12.2 – Número da CAT", bold: true, size: 6 },
  ], 5);
  y = drawRow(y, [
    { w: CW / 4, text: "" },
    { w: CW / 4, text: "" },
    { w: CW / 4, text: "" },
    { w: CW / 4, text: "" },
  ], 5);

  // 13 - Lotação
  y = drawRow(y, [{ w: CW, text: "13 – LOTAÇÃO E ATRIBUIÇÃO", bold: true, bg: headerBg, size: 7 }], 5);
  const periodo = `${data.dataAdmissao} a ${data.dataDemissao || "atual"}`;
  const colW13 = [CW * 0.18, CW * 0.18, CW * 0.12, CW * 0.15, CW * 0.12, CW * 0.10, CW * 0.15];
  y = drawRow(y, [
    { w: colW13[0], text: "13.1 – Período", bold: true, size: 6 },
    { w: colW13[1], text: "13.2 – CNPJ", bold: true, size: 6 },
    { w: colW13[2], text: "13.3 – Setor", bold: true, size: 6 },
    { w: colW13[3], text: "13.4 – Cargo", bold: true, size: 6 },
    { w: colW13[4], text: "13.5 – Função", bold: true, size: 6 },
    { w: colW13[5], text: "13.6 – CBO", bold: true, size: 6 },
    { w: colW13[6], text: "13.7 – Cód. GFIP", bold: true, size: 6 },
  ], 5);
  y = drawRow(y, [
    { w: colW13[0], text: periodo, size: 6 },
    { w: colW13[1], text: data.cnpj, size: 6 },
    { w: colW13[2], text: data.setor || "—", size: 6 },
    { w: colW13[3], text: data.cargo, size: 6 },
    { w: colW13[4], text: data.funcao || "—", size: 6 },
    { w: colW13[5], text: data.cbo || "", size: 6 },
    { w: colW13[6], text: "01", size: 6 },
  ], 6);

  // 14 - Profissiografia
  y = drawRow(y, [{ w: CW, text: "14 – PROFISSIOGRAFIA", bold: true, bg: headerBg, size: 7 }], 5);
  y = drawRow(y, [
    { w: CW * 0.18, text: "14.1 – Período", bold: true, size: 6 },
    { w: CW * 0.82, text: "14.2 – Descrição das Atividades", bold: true, size: 6 },
  ], 5);

  // Profissiografia text needs wrapping
  const profLines = doc.splitTextToSize(data.profissiografia || "—", CW * 0.82 - 3);
  const profH = Math.max(8, profLines.length * 3.5 + 3);
  drawCell(M, y, CW * 0.18, profH, periodo, { size: 6 });
  doc.rect(M + CW * 0.18, y, CW * 0.82, profH);
  setFont("normal", 6);
  doc.text(profLines, M + CW * 0.18 + 1.5, y + 3.5);
  y += profH;

  // === SEÇÃO II ===
  y = drawRow(y, [{ w: CW, text: "II – SEÇÃO DE REGISTROS AMBIENTAIS", bold: true, bg: headerBg, align: "center", size: 8 }], 6);
  y = drawRow(y, [{ w: CW, text: "15 – EXPOSIÇÃO A FATORES DE RISCOS", bold: true, bg: headerBg, size: 7 }], 5);

  const colW15 = [CW * 0.15, CW * 0.06, CW * 0.14, CW * 0.14, CW * 0.14, CW * 0.10, CW * 0.10, CW * 0.17];
  y = drawRow(y, [
    { w: colW15[0], text: "15.1 – Período", bold: true, size: 5 },
    { w: colW15[1], text: "15.2 – Tipo", bold: true, size: 5 },
    { w: colW15[2], text: "15.3 – Fator de Risco", bold: true, size: 5 },
    { w: colW15[3], text: "15.4 – Intens./Conc.", bold: true, size: 5 },
    { w: colW15[4], text: "15.5 – Técnica", bold: true, size: 5 },
    { w: colW15[5], text: "15.6 – EPC", bold: true, size: 5 },
    { w: colW15[6], text: "15.7 – EPI", bold: true, size: 5 },
    { w: colW15[7], text: "15.8 – CA EPI", bold: true, size: 5 },
  ], 5);

  if (data.riscos.length === 0) {
    y = drawRow(y, [{ w: CW, text: "Nenhum risco cadastrado", align: "center", size: 6 }], 6);
  } else {
    data.riscos.forEach((r) => {
      y = drawRow(y, [
        { w: colW15[0], text: periodo, size: 5 },
        { w: colW15[1], text: TIPO_RISCO_LABEL[r.tipo] || r.tipo, size: 5 },
        { w: colW15[2], text: r.fatorRisco, size: 5 },
        { w: colW15[3], text: r.intensidade || "—", size: 5 },
        { w: colW15[4], text: r.tecnica || "—", size: 5 },
        { w: colW15[5], text: r.epcEficaz, size: 5 },
        { w: colW15[6], text: r.epiEficaz, size: 5 },
        { w: colW15[7], text: r.caEpi || "—", size: 5 },
      ], 5);
    });
  }

  // 16 - Responsável Registros Ambientais
  y = drawRow(y, [{ w: CW, text: "16 – RESPONSÁVEL PELOS REGISTROS AMBIENTAIS", bold: true, bg: headerBg, size: 7 }], 5);
  y = drawRow(y, [
    { w: CW * 0.18, text: "16.1 – Período", bold: true, size: 6 },
    { w: CW * 0.18, text: "16.2 – NIT", bold: true, size: 6 },
    { w: CW * 0.30, text: "16.3 – Reg. Conselho de Classe", bold: true, size: 6 },
    { w: CW * 0.34, text: "16.4 – Nome do Profissional", bold: true, size: 6 },
  ], 5);
  y = drawRow(y, [
    { w: CW * 0.18, text: data.engenheiro?.periodo || periodo, size: 6 },
    { w: CW * 0.18, text: data.engenheiro?.nit || "", size: 6 },
    { w: CW * 0.30, text: data.engenheiro?.registro || "", size: 6 },
    { w: CW * 0.34, text: data.engenheiro?.nome || "", size: 6 },
  ], 6);

  // === SEÇÃO III ===
  if (y > 230) { doc.addPage(); y = M; }
  y = drawRow(y, [{ w: CW, text: "III – SEÇÃO DE RESULTADOS DE MONITORAÇÃO BIOLÓGICA", bold: true, bg: headerBg, align: "center", size: 8 }], 6);
  y = drawRow(y, [{ w: CW, text: "17 – EXAMES MÉDICOS CLÍNICOS E COMPLEMENTARES (Quadros I e II, da NR-07)", bold: true, bg: headerBg, size: 7 }], 5);
  y = drawRow(y, [
    { w: CW * 0.15, text: "17.1 – Data", bold: true, size: 6 },
    { w: CW * 0.15, text: "17.2 – Tipo", bold: true, size: 6 },
    { w: CW * 0.20, text: "17.3 – Natureza", bold: true, size: 6 },
    { w: CW * 0.15, text: "17.4 – Exame (R/S)", bold: true, size: 6 },
    { w: CW * 0.35, text: "17.5 – Indicação de Resultados", bold: true, size: 6 },
  ], 5);
  // Empty row for exams
  y = drawRow(y, [
    { w: CW * 0.15, text: "" },
    { w: CW * 0.15, text: "" },
    { w: CW * 0.20, text: "" },
    { w: CW * 0.15, text: "" },
    { w: CW * 0.35, text: "" },
  ], 8);

  // 18 - Responsável Registros Biológicos
  y = drawRow(y, [{ w: CW, text: "18 – RESPONSÁVEL PELOS REGISTROS BIOLÓGICOS", bold: true, bg: headerBg, size: 7 }], 5);
  y = drawRow(y, [
    { w: CW * 0.18, text: "18.1 – Período", bold: true, size: 6 },
    { w: CW * 0.18, text: "18.2 – NIT", bold: true, size: 6 },
    { w: CW * 0.30, text: "18.3 – Reg. Conselho de Classe", bold: true, size: 6 },
    { w: CW * 0.34, text: "18.4 – Nome do Profissional", bold: true, size: 6 },
  ], 5);
  y = drawRow(y, [
    { w: CW * 0.18, text: data.medico?.periodo || periodo, size: 6 },
    { w: CW * 0.18, text: data.medico?.nit || "", size: 6 },
    { w: CW * 0.30, text: data.medico?.registro || "", size: 6 },
    { w: CW * 0.34, text: data.medico?.nome || "", size: 6 },
  ], 6);

  // === SEÇÃO V ===
  if (y > 230) { doc.addPage(); y = M; }
  y = drawRow(y, [{ w: CW, text: "V – RESPONSÁVEIS PELAS INFORMAÇÕES", bold: true, bg: headerBg, align: "center", size: 8 }], 6);

  setFont("normal", 6);
  const declText = "Declaramos, para todos os fins de direito, que as informações prestadas neste documento são verídicas e foram transcritas fielmente dos registros administrativos, das demonstrações ambientais e dos programas médicos de responsabilidade da empresa. É de nosso conhecimento que a prestação de informações falsas neste documento constitui crime de falsificação de documento público, nos termos do artigo 297 do Código Penal.";
  const declLines = doc.splitTextToSize(declText, CW - 4);
  const declH = declLines.length * 3 + 4;
  doc.rect(M, y, CW, declH);
  doc.text(declLines, M + 2, y + 3.5);
  y += declH;

  // 19 - Data emissão
  y = drawRow(y, [
    { w: CW / 2, text: `19 – Data Emissão PPP: ${data.dataEmissao}`, bold: true },
    { w: CW / 2, text: "20 – Representante Legal da Empresa", bold: true },
  ], 7);

  // Signature area
  y += 5;
  doc.rect(M, y, CW / 2 - 2, 20);
  setFont("normal", 6);
  doc.text("(Carimbo)", M + 5, y + 8);
  doc.text("_________________________________", M + 5, y + 15);
  doc.text("(Assinatura)", M + 5, y + 18);

  doc.rect(M + CW / 2 + 2, y, CW / 2 - 2, 20);
  doc.text("(Carimbo)", M + CW / 2 + 7, y + 8);
  doc.text("_________________________________", M + CW / 2 + 7, y + 15);
  doc.text("(Assinatura)", M + CW / 2 + 7, y + 18);
  y += 25;

  // Protocolo de Entrega
  y = drawRow(y, [{ w: CW, text: "PROTOCOLO DE ENTREGA", bold: true, bg: headerBg, align: "center", size: 8 }], 6);
  y += 3;
  setFont("normal", 7);
  doc.text(`Recebi em: _____/_____/________`, M + 5, y + 4);
  y += 8;
  doc.text(`Nome do Funcionário: ${data.nomeTrabalhador}`, M + 5, y + 4);
  y += 8;
  doc.text("Assinatura do Funcionário: _______________________________________________", M + 5, y + 4);

  return doc;
}

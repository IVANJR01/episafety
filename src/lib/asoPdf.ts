import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";

const TIPO: Record<string, string> = {
  admissional: "Admissional", periodico: "Periódico", retorno: "Retorno ao Trabalho",
  mudanca_risco: "Mudança de Risco", demissional: "Demissional",
};

const GRUPO: Record<string, string> = {
  fisico: "Físicos", quimico: "Químicos", biologico: "Biológicos",
  ergonomico: "Ergonômicos", acidente: "Acidentes/Mecânicos", outro: "Outros",
};

function check(b: boolean) { return b ? "[X]" : "[ ]"; }
function dt(s?: string | null) { return s ? format(parseISO(s), "dd/MM/yyyy") : "—"; }

export async function gerarPdfAso(asoId: string) {
  const { data: aso, error } = await supabase
    .from("asos")
    .select(`*, funcionarios:funcionario_id (nome, cpf, cargo, setor, matricula, data_admissao), aso_medicos:medico_id (nome, crm, uf_crm), empresa_config:empresa_id (nome, cnpj, endereco, logo_url)`)
    .eq("id", asoId).single();
  if (error || !aso) throw error || new Error("ASO não encontrado");

  const [{ data: riscos = [] }, { data: exames = [] }, { data: verif = [] }] = await Promise.all([
    supabase.from("aso_riscos").select("*").eq("aso_id", asoId),
    supabase.from("aso_exames").select("*").eq("aso_id", asoId),
    supabase.from("aso_verificacao").select("hash").eq("aso_id", asoId).limit(1),
  ]);

  const hash = verif?.[0]?.hash;
  const url = hash ? `${window.location.origin}/verificar-aso/${hash}` : window.location.origin;
  const qrData = await QRCode.toDataURL(url, { width: 120, margin: 1 });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 12;
  let y = M;

  // Borda
  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.rect(M, M, W - 2 * M, 297 - 2 * M);

  // Título
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("ATESTADO DE SAÚDE OCUPACIONAL — ASO", W / 2, y + 7, { align: "center" });
  y += 12;
  doc.setLineWidth(0.2); doc.line(M, y, W - M, y);
  y += 4;

  // Cabeçalho empresa
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("EMPRESA:", M + 2, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(`${aso.empresa_config?.nome || "—"}`, M + 24, y + 4);
  doc.setFont("helvetica", "bold"); doc.text("CNPJ:", M + 2, y + 9);
  doc.setFont("helvetica", "normal"); doc.text(`${aso.empresa_config?.cnpj || "—"}`, M + 24, y + 9);
  doc.setFont("helvetica", "bold"); doc.text("Nº ASO:", W - M - 50, y + 4);
  doc.setFont("helvetica", "normal"); doc.text(`${aso.numero_aso}`, W - M - 30, y + 4);
  if (aso.empresa_config?.endereco) {
    doc.setFont("helvetica", "bold"); doc.text("Endereço:", M + 2, y + 14);
    doc.setFont("helvetica", "normal"); doc.text(`${aso.empresa_config.endereco}`.slice(0, 90), M + 24, y + 14);
  }
  y += 18;
  doc.line(M, y, W - M, y); y += 4;

  // Dados trabalhador
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("DADOS DO TRABALHADOR", M + 2, y + 4); y += 7;
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  const f = aso.funcionarios;
  doc.text(`Nome: ${f?.nome || "—"}`, M + 2, y); y += 5;
  doc.text(`CPF: ${f?.cpf || "—"}`, M + 2, y);
  doc.text(`Matrícula: ${f?.matricula || "—"}`, M + 90, y); y += 5;
  doc.text(`Função: ${f?.cargo || "—"}`, M + 2, y);
  doc.text(`Setor: ${f?.setor || "—"}`, M + 90, y); y += 5;
  doc.text(`Data de admissão: ${dt(f?.data_admissao)}`, M + 2, y); y += 6;
  doc.line(M, y, W - M, y); y += 4;

  // Tipo de exame
  doc.setFont("helvetica", "bold"); doc.text("TIPO DE EXAME OCUPACIONAL", M + 2, y); y += 5;
  doc.setFont("helvetica", "normal");
  const tipos = ["admissional", "periodico", "retorno", "mudanca_risco", "demissional"];
  let tx = M + 2;
  tipos.forEach((t) => {
    const s = `${check(aso.tipo_exame === t)} ${TIPO[t]}`;
    doc.text(s, tx, y);
    tx += doc.getTextWidth(s) + 5;
  });
  y += 6; doc.line(M, y, W - M, y); y += 4;

  // Riscos
  doc.setFont("helvetica", "bold"); doc.text("FATORES DE RISCO / PERIGO", M + 2, y); y += 5;
  doc.setFont("helvetica", "normal");
  Object.entries(GRUPO).forEach(([k, label]) => {
    const itens = riscos.filter((r: any) => r.grupo === k).map((r: any) => r.descricao).filter(Boolean);
    const txt = `${label}: ${itens.length ? itens.join("; ") : "N.A. (Não se aplica)"}`;
    const lines = doc.splitTextToSize(txt, W - 2 * M - 4);
    doc.text(lines, M + 2, y);
    y += 4 * lines.length + 1;
  });
  y += 2; doc.line(M, y, W - M, y); y += 4;

  // Exames realizados
  doc.setFont("helvetica", "bold"); doc.text("PROCEDIMENTOS REALIZADOS", M + 2, y); y += 3;
  const rows = exames.map((e: any) => [e.nome_exame, dt(e.data_realizacao), e.resultado || "—"]);
  if (rows.length === 0) rows.push(["—", "—", "—"]);
  autoTable(doc, {
    startY: y + 1,
    head: [["Exame", "Data", "Resultado"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20 },
    margin: { left: M + 2, right: M + 2 },
    theme: "grid",
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Conclusão
  doc.setFont("helvetica", "bold"); doc.text("CONCLUSÃO SOBRE A CAPACIDADE LABORATIVA", M + 2, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`${check(!!aso.apto_cargo)} Apto para as atividades do cargo`, M + 2, y); y += 4;
  doc.text(`${check(!!aso.apto_restricao)} Apto com restrições`, M + 2, y); y += 4;
  doc.text(`${check(!!aso.inapto_cargo)} Inapto para as atividades do cargo`, M + 2, y); y += 4;
  doc.text(`${check(!!aso.apto_nr35)} Apto trabalho em altura NR-35   ${check(!!aso.inapto_nr35)} Inapto NR-35   ${check(!!aso.nr35_nao_aplica)} Não se aplica`, M + 2, y); y += 6;

  if (aso.observacoes) {
    doc.setFont("helvetica", "bold"); doc.text("Observações:", M + 2, y); y += 4;
    doc.setFont("helvetica", "normal");
    const obs = doc.splitTextToSize(aso.observacoes, W - 2 * M - 4);
    doc.text(obs, M + 2, y); y += 4 * obs.length + 2;
  }

  // Validade
  doc.line(M, y, W - M, y); y += 4;
  doc.setFont("helvetica", "bold"); doc.text(`Validade do exame: ${dt(aso.data_vencimento)}`, M + 2, y); y += 6;

  // Médico e assinaturas
  doc.line(M, y, W - M, y); y += 6;
  const med = aso.aso_medicos;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`${aso.local_emissao || ""}, ${dt(aso.data_emissao)}`, M + 2, y); y += 10;

  doc.line(M + 10, y, M + 80, y);
  doc.line(W - M - 80, y, W - M - 10, y);
  y += 4;
  doc.text(`${med?.nome || "—"}`, M + 45, y, { align: "center" });
  doc.text("Assinatura do colaborador", W - M - 45, y, { align: "center" });
  y += 4;
  doc.text(`CRM ${med?.crm || "—"}${med?.uf_crm ? "/" + med.uf_crm : ""}`, M + 45, y, { align: "center" });
  y += 8;

  // Rodapé NR
  doc.setFontSize(7); doc.setFont("helvetica", "italic");
  const foot = "Em caso de transferência, mudança de função, alteração dos riscos ocupacionais ou mudança de risco, o ASO deverá ser reavaliado conforme PCMSO e PGR da organização.";
  const footLines = doc.splitTextToSize(foot, W - 2 * M - 35);
  doc.text(footLines, M + 2, 297 - M - 8);

  // QR code
  doc.addImage(qrData, "PNG", W - M - 28, 297 - M - 30, 22, 22);
  doc.setFontSize(6); doc.text("Verificação", W - M - 17, 297 - M - 6, { align: "center" });

  doc.save(`ASO-${aso.numero_aso}.pdf`);
}

// PPP Parte 5 — PDF técnico interno + assinatura visual + QR Code + Drive BYOK.
// Hash SHA-256, sem ICP-Brasil, sem binário no banco.
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { uploadDocumentoSeguro } from "@/lib/secureStorage";
import { PppDocumento, PPP_STATUS_LABEL, PPP_MOTIVO_LABEL } from "@/lib/pppTypes";

export interface PppPdfContext {
  doc: PppDocumento;
  empresaNome: string | null;
  empresaCnpj: string | null;
  funcionario: any | null;
  periodos: any[];
  exposicoes: any[];
  respAmbientais: any[];
  respMedicos: any[];
  exames: any[];
  revisoes: any[];
  assinaturas: any[];
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const fmtD = (s?: string | null) => s ? new Date(s.length <= 10 ? s + "T00:00:00" : s).toLocaleDateString("pt-BR") : "—";
const fmtDT = (s?: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "—";

interface B { doc: jsPDF; y: number; }
const ensure = (b: B, h: number) => { if (b.y + h > 278) { b.doc.addPage(); b.y = 15; } };
function title(b: B, t: string) {
  ensure(b, 10);
  b.doc.setFillColor(15, 23, 42); b.doc.rect(10, b.y, 190, 6, "F");
  b.doc.setTextColor(255); b.doc.setFontSize(10); b.doc.setFont("helvetica", "bold");
  b.doc.text(t, 12, b.y + 4.2); b.doc.setTextColor(0); b.y += 8;
}
function kv(b: B, label: string, value: string, full = false) {
  ensure(b, 7);
  b.doc.setFontSize(7); b.doc.setFont("helvetica", "normal"); b.doc.setTextColor(110);
  b.doc.text(label.toUpperCase(), 12, b.y);
  b.doc.setTextColor(0); b.doc.setFontSize(9); b.doc.setFont("helvetica", "bold");
  const lines = b.doc.splitTextToSize(value || "—", full ? 186 : 90);
  b.doc.text(lines, 12, b.y + 4);
  b.y += 4 + lines.length * 3.5 + 1;
}
function para(b: B, txt: string, size = 8, color: [number, number, number] = [60, 60, 60]) {
  ensure(b, 6);
  b.doc.setFont("helvetica", "normal"); b.doc.setFontSize(size); b.doc.setTextColor(...color);
  const lines = b.doc.splitTextToSize(txt, 186);
  b.doc.text(lines, 12, b.y + 3);
  b.y += 3 + lines.length * (size * 0.42);
  b.doc.setTextColor(0);
}

async function render(
  ctx: PppPdfContext,
  opts: { qrUrl: string; pdfVersao: number; comMarca: boolean; marcaLabel: string },
): Promise<jsPDF> {
  const { doc: pp } = ctx;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const b: B = { doc: pdf, y: 12 };
  const f = ctx.funcionario || {};

  // CAPA
  pdf.setFillColor(15, 23, 42); pdf.rect(0, 0, 210, 70, "F");
  pdf.setTextColor(255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(22);
  pdf.text("PPP", 105, 28, { align: "center" });
  pdf.setFontSize(11); pdf.setFont("helvetica", "normal");
  pdf.text("Perfil Profissiográfico Previdenciário", 105, 36, { align: "center" });
  pdf.setFontSize(9);
  pdf.text("Documento técnico interno · Base: IN PRES/INSS 128/2022", 105, 44, { align: "center" });
  pdf.text(`Versão do PPP: v${pp.versao}  ·  Versão do PDF: v${opts.pdfVersao}  ·  ${PPP_STATUS_LABEL[pp.status]}`, 105, 54, { align: "center" });
  pdf.text(`Motivo: ${PPP_MOTIVO_LABEL[pp.motivo_emissao]}`, 105, 60, { align: "center" });
  pdf.setTextColor(0); b.y = 80;

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
  pdf.text(ctx.empresaNome || "Empresa", 12, b.y); b.y += 7;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  pdf.text(`CNPJ: ${ctx.empresaCnpj || "—"}`, 12, b.y); b.y += 10;

  // 1) Trabalhador
  title(b, "1. Dados do trabalhador");
  kv(b, "Nome", f.nome || "—", true);
  kv(b, "CPF", f.cpf || "—");
  kv(b, "Matrícula", f.matricula || "—");
  kv(b, "Função atual", f.cargo || pp.cbo_consolidado || "—");
  kv(b, "CBO consolidado", pp.cbo_consolidado || "—");
  kv(b, "Setor", f.setor || "—");
  kv(b, "Data de admissão", fmtD(f.data_admissao));
  kv(b, "Data de demissão", fmtD(f.data_demissao));
  if (pp.descricao_atividade_consolidada) {
    kv(b, "Descrição da atividade", pp.descricao_atividade_consolidada, true);
  }

  // 2) Histórico laboral
  title(b, "2. Histórico laboral / Períodos");
  if (ctx.periodos.length === 0) para(b, "Sem períodos cadastrados.");
  ctx.periodos.forEach((p, i) => {
    ensure(b, 14);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`Período ${i + 1}: ${fmtD(p.data_inicio)} → ${p.data_fim ? fmtD(p.data_fim) : "atual"}`, 12, b.y);
    b.y += 4;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const line1 = `Função: ${p.funcao_nome || "—"}  ·  CBO: ${p.cbo || "—"}  ·  Setor: ${p.setor_nome || "—"}  ·  GHE: ${p.ghe_codigo || "—"}`;
    pdf.text(pdf.splitTextToSize(line1, 186), 12, b.y); b.y += 4;
    if (p.descricao_atividade) {
      const ll = pdf.splitTextToSize("Atividades: " + p.descricao_atividade, 186);
      ensure(b, ll.length * 3.5);
      pdf.text(ll, 12, b.y); b.y += ll.length * 3.5;
    }
    b.y += 2;
  });

  // 3) Exposições
  title(b, "3. Exposições a agentes nocivos");
  if (ctx.exposicoes.length === 0) para(b, "Nenhuma exposição registrada.");
  ctx.exposicoes.forEach((e, i) => {
    ensure(b, 18);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`${i + 1}. ${e.agente_nome || "—"}${e.agente_grupo ? ` [${e.agente_grupo}]` : ""}${e.codigo_esocial ? ` · ${e.codigo_esocial}` : ""}`, 12, b.y);
    b.y += 4;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const det = [
      `Intensidade: ${e.intensidade ?? "—"} ${e.unidade_medida || ""}`,
      `LT: ${e.limite_tolerancia ?? "—"}`,
      `Técnica: ${e.tecnica_avaliacao || "—"}`,
      `Data: ${fmtD(e.data_medicao)}`,
      e.acima_limite ? "ACIMA DO LT" : "",
    ].filter(Boolean).join("  ·  ");
    pdf.text(pdf.splitTextToSize(det, 186), 12, b.y); b.y += 4;
    const epi = `EPI: ${e.epi_descricao || "—"}${e.epi_ca ? ` (CA ${e.epi_ca})` : ""}  ·  Eficácia: ${e.epi_eficacia || "—"}  ·  EPC: ${e.epc_descricao || "—"}`;
    pdf.text(pdf.splitTextToSize(epi, 186), 12, b.y); b.y += 4;
    const concl = `Conclusão: ${e.conclusao_previdenciaria || "—"}  ·  Fundamento: ${e.fundamento_legal || "—"}`;
    pdf.text(pdf.splitTextToSize(concl, 186), 12, b.y); b.y += 4;
    if (e.observacoes) {
      const ll = pdf.splitTextToSize("Obs.: " + e.observacoes, 186);
      ensure(b, ll.length * 3.3);
      pdf.text(ll, 12, b.y); b.y += ll.length * 3.3;
    }
    b.y += 2;
  });

  // 4) Responsáveis ambientais
  title(b, "4. Responsáveis pelos registros ambientais");
  if (ctx.respAmbientais.length === 0) para(b, "Não informado.");
  ctx.respAmbientais.forEach((r) => {
    ensure(b, 10);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(r.nome || r.responsavel_nome || "—", 12, b.y); b.y += 4;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const l = [
      r.cargo, r.registro_profissional,
      r.conselho ? `${r.conselho}${r.conselho_uf ? "/" + r.conselho_uf : ""}` : null,
      r.cpf, `${fmtD(r.periodo_inicio)} → ${r.periodo_fim ? fmtD(r.periodo_fim) : "atual"}`,
    ].filter(Boolean).join("  ·  ");
    pdf.text(pdf.splitTextToSize(l, 186), 12, b.y); b.y += 4;
    if (r.observacoes) { pdf.text(pdf.splitTextToSize("Obs.: " + r.observacoes, 186), 12, b.y); b.y += 4; }
    b.y += 1;
  });

  // 5) Responsáveis médicos
  title(b, "5. Responsáveis pelas informações médicas");
  if (ctx.respMedicos.length === 0) para(b, "Não informado.");
  ctx.respMedicos.forEach((r) => {
    ensure(b, 10);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(r.nome || "—", 12, b.y); b.y += 4;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const l = [
      r.crm ? `CRM ${r.crm}${r.uf_crm ? "/" + r.uf_crm : ""}` : null,
      `${fmtD(r.periodo_inicio)} → ${r.periodo_fim ? fmtD(r.periodo_fim) : "atual"}`,
    ].filter(Boolean).join("  ·  ");
    pdf.text(pdf.splitTextToSize(l, 186), 12, b.y); b.y += 4;
    if (r.observacoes) { pdf.text(pdf.splitTextToSize("Obs.: " + r.observacoes, 186), 12, b.y); b.y += 4; }
    b.y += 1;
  });

  // 6) Exames referenciados
  title(b, "6. Exames referenciados (ASO/PCMSO)");
  if (ctx.exames.length === 0) para(b, "Nenhum exame referenciado.");
  ctx.exames.forEach((x) => {
    ensure(b, 6);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const l = `${fmtD(x.data)}  ·  ${x.tipo || "—"}  ·  ${x.aptidao || x.resultado_resumo || "—"}  ·  origem: ${x.origem || (x.aso_id ? "ASO" : "—")}`;
    pdf.text(pdf.splitTextToSize(l, 186), 12, b.y + 3); b.y += 5;
    if (x.observacoes) { pdf.text(pdf.splitTextToSize("Obs.: " + x.observacoes, 186), 12, b.y + 3); b.y += 5; }
  });

  // 7) Observações
  if (pp.observacoes) {
    title(b, "7. Observações");
    para(b, pp.observacoes);
  }

  // 8) Revisões
  title(b, "8. Histórico de revisões");
  if (ctx.revisoes.length === 0) para(b, "Sem revisões.");
  ctx.revisoes.forEach((r) => {
    ensure(b, 5);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const linha = `${fmtDT(r.created_at)} · ${r.acao || "—"}${r.descricao ? " — " + r.descricao : ""}`;
    const ll = pdf.splitTextToSize(linha, 186);
    pdf.text(ll, 12, b.y + 3); b.y += 3 + ll.length * 3.2;
  });

  // 9) Assinaturas
  title(b, "9. Assinatura visual");
  para(b, "Assinatura visual com hash SHA-256 e MFA verificado. Não constitui assinatura digital ICP-Brasil.");
  if (ctx.assinaturas.length === 0) para(b, "Nenhuma assinatura visual registrada até a geração deste PDF.");
  ctx.assinaturas.forEach((a: any) => {
    ensure(b, 22);
    pdf.setDrawColor(180); pdf.line(12, b.y + 12, 100, b.y + 12);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(a.responsavel_nome || a.nome || "—", 12, b.y + 16);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
    pdf.text(`${a.responsavel_registro || "—"}  ·  ${fmtDT(a.assinado_em)}  ·  MFA ${a.auth_aal || "—"}  ·  PDF v${a.pdf_versao ?? "—"}`, 12, b.y + 19);
    pdf.text(`Hash assinado: ${a.pdf_hash || "—"}`, 12, b.y + 22);
    b.y += 26;
  });

  // Rodapé com QR + hash + marca d'água
  const qrDataUrl = await QRCode.toDataURL(opts.qrUrl, { margin: 0, width: 220 });
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    if (opts.comMarca) {
      const anyDoc = pdf as any;
      if (typeof anyDoc.GState === "function") { anyDoc.setGState(new anyDoc.GState({ opacity: 0.18 })); }
      pdf.setTextColor(180, 50, 50); pdf.setFont("helvetica", "bold"); pdf.setFontSize(90);
      pdf.text(opts.marcaLabel, 105, 160, { align: "center", angle: 35 } as any);
      if (typeof anyDoc.GState === "function") { anyDoc.setGState(new anyDoc.GState({ opacity: 1 })); }
      pdf.setTextColor(0);
    }
    pdf.setDrawColor(200); pdf.line(10, 283, 200, 283);
    pdf.addImage(qrDataUrl, "PNG", 10, 285, 18, 18);
    pdf.setFontSize(7); pdf.setFont("helvetica", "normal"); pdf.setTextColor(80);
    pdf.text("QR Code de validação interna — abre o PPP no sistema (acesso restrito à empresa).", 30, 288);
    pdf.text(opts.qrUrl, 30, 291);
    pdf.text(`Gerado em ${fmtDT(new Date().toISOString())}  ·  PDF v${opts.pdfVersao}  ·  PPP v${pp.versao}  ·  Página ${p}/${pages}`, 30, 294);
    pdf.text("Documento técnico interno. Assinatura ICP-Brasil não implementada nesta fase. Não enviado ao eSocial.", 30, 297);
    pdf.setTextColor(0);
  }

  return pdf;
}

export interface GeneratePppPdfResult {
  pdfVersao: number;
  hash: string;
  fileId: string;
  viewLink: string;
  fileName: string;
  blob: Blob;
}

export async function generateAndUploadPppPdf(ctx: PppPdfContext): Promise<GeneratePppPdfResult> {
  const { doc: pp } = ctx;
  const comMarca = pp.status === "rascunho" || pp.status === "em_revisao";
  const marcaLabel = pp.status === "em_revisao" ? "EM REVISÃO" : "RASCUNHO";

  const { data: ultimaV } = await (supabase.from as any)("ppp_pdf_versoes")
    .select("pdf_versao").eq("ppp_id", pp.id)
    .order("pdf_versao", { ascending: false }).limit(1).maybeSingle();
  const proxVersao = ((ultimaV?.pdf_versao as number | undefined) ?? 0) + 1;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrUrl = `${origin}/ppp/validar/${pp.id}?v=${proxVersao}`;

  const pdf = await render(ctx, { qrUrl, pdfVersao: proxVersao, comMarca, marcaLabel });
  const blob = pdf.output("blob");
  const buffer = await blob.arrayBuffer();
  const hash = await sha256Hex(buffer);

  const cpfSlug = (ctx.funcionario?.cpf || ctx.funcionario?.id || "anon").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 20);
  const funcSlug = (ctx.funcionario?.nome || "func").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30);
  const fileName = `PPP_${funcSlug}_v${pp.versao}_pdf${proxVersao}${comMarca ? "_RASCUNHO" : ""}.pdf`;

  const up = await uploadDocumentoSeguro({
    empresa_id: (pp as any).empresa_id,
    kind: "pdf",
    modulo: "ppp",
    documento_id: pp.id,
    versao: proxVersao,
    fileName,
    blob,
    driveFolderFallback: `PPP/${cpfSlug}/v${pp.versao}/Documento`,
  });

  const { data, error } = await (supabase.rpc as any)("ppp_pdf_registrar", {
    _ppp_id: pp.id,
    _drive_file_id: up.ref,
    _drive_view_link: up.viewLink,
    _drive_path: up.path,
    _nome_arquivo: fileName,
    _tamanho_bytes: blob.size,
    _pdf_hash: hash,
    _com_marca_dagua: comMarca,
  });
  if (error) throw error;

  return {
    pdfVersao: (data as any)?.pdf_versao ?? proxVersao,
    hash,
    fileId: up.ref,
    viewLink: up.viewLink || up.ref,
    fileName,
    blob,
  };
}

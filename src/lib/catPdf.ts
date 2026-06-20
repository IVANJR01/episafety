// Geração do PDF gerencial da CAT (Parte 3 — Fase 1, sem envio eSocial)
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { uploadToDrive } from "@/lib/googleDriveStorage";
import {
  CatRow,
  STATUS_LABEL,
  TIPO_LABEL,
  TIPO_ACIDENTE_LABEL,
  EMITENTE_LABEL,
  prazoLegal,
} from "@/lib/catTypes";

export interface CatPdfContext {
  cat: CatRow;
  empresaNome?: string | null;
  empresaCnpj?: string | null;
  funcionarioNome?: string | null;
  funcionarioCpf?: string | null;
  funcionarioCargo?: string | null;
  situacaoGeradora?: string | null;
  agenteCausador?: string | null;
  parteAtingida?: string | null;
  naturezaLesao?: string | null;
  testemunhas?: Array<{ nome: string; cpf?: string | null; cargo?: string | null; telefone?: string | null }>;
  historico?: Array<{ acao: string; status_anterior?: string | null; status_novo?: string | null; created_at: string; user_email?: string | null; motivo?: string | null }>;
  anexos?: Array<{ nome_arquivo: string; categoria: string }>;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s.length <= 10 ? s + "T00:00:00" : s).toLocaleDateString("pt-BR");
  } catch {
    return s;
  }
}
function fmtDT(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR");
  } catch {
    return s;
  }
}

interface PdfBuilder {
  doc: jsPDF;
  y: number;
}

function ensureSpace(b: PdfBuilder, h: number) {
  if (b.y + h > 285) {
    b.doc.addPage();
    b.y = 15;
  }
}

function sectionTitle(b: PdfBuilder, title: string) {
  ensureSpace(b, 10);
  b.doc.setFillColor(30, 41, 59);
  b.doc.rect(10, b.y, 190, 6, "F");
  b.doc.setTextColor(255, 255, 255);
  b.doc.setFontSize(9);
  b.doc.setFont("helvetica", "bold");
  b.doc.text(title, 12, b.y + 4.2);
  b.doc.setTextColor(0, 0, 0);
  b.y += 8;
}

function field(b: PdfBuilder, label: string, value: string | null | undefined, col: 0 | 1 | 2 = 0, width: 1 | 2 | 3 = 1) {
  const colX = [10, 73, 136];
  const colW = [60, 60, 64];
  const x = colX[col];
  const w = width === 1 ? colW[col] : width === 2 ? colW[col] + colW[col + 1] + 3 : 190;
  ensureSpace(b, 9);
  b.doc.setFontSize(7);
  b.doc.setFont("helvetica", "normal");
  b.doc.setTextColor(100);
  b.doc.text(label.toUpperCase(), x, b.y);
  b.doc.setTextColor(0);
  b.doc.setFontSize(9);
  b.doc.setFont("helvetica", "bold");
  const text = value && value.trim() !== "" ? value : "—";
  const lines = b.doc.splitTextToSize(text, w);
  b.doc.text(lines, x, b.y + 4);
  if (col === 2 || width >= 2) b.y += 4 + lines.length * 3.5 + 1;
}

function row(b: PdfBuilder, items: Array<[string, string | null | undefined]>) {
  ensureSpace(b, 12);
  const startY = b.y;
  let maxLines = 1;
  items.forEach(([label, value], i) => {
    const col = i as 0 | 1 | 2;
    const x = [10, 73, 136][col];
    b.doc.setFontSize(7);
    b.doc.setFont("helvetica", "normal");
    b.doc.setTextColor(100);
    b.doc.text(label.toUpperCase(), x, startY);
    b.doc.setTextColor(0);
    b.doc.setFontSize(9);
    b.doc.setFont("helvetica", "bold");
    const text = value && value.trim() !== "" ? value : "—";
    const lines = b.doc.splitTextToSize(text, 60);
    b.doc.text(lines, x, startY + 4);
    if (lines.length > maxLines) maxLines = lines.length;
  });
  b.y = startY + 4 + maxLines * 3.5 + 2;
}

async function renderPdf(ctx: CatPdfContext, opts: { qrUrl: string; versao: number }): Promise<jsPDF> {
  const { cat } = ctx;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const b: PdfBuilder = { doc, y: 12 };

  // Cabeçalho
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("COMUNICAÇÃO DE ACIDENTE DE TRABALHO — CAT", 12, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Documento interno/gerencial — não substitui envio oficial ao eSocial", 12, 15);
  doc.setTextColor(0, 0, 0);
  b.y = 22;

  // Identificação
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Nº ${cat.numero_cat || "(rascunho)"}`, 12, b.y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Versão PDF: v${opts.versao}`, 70, b.y);
  doc.text(`Tipo: ${TIPO_LABEL[cat.tipo_cat]}`, 110, b.y);
  doc.text(`Status: ${STATUS_LABEL[cat.status]}`, 150, b.y);
  b.y += 6;

  // Alertas
  if (cat.obito) {
    doc.setFillColor(220, 38, 38);
    doc.setTextColor(255, 255, 255);
    doc.rect(10, b.y, 190, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("⚠ ACIDENTE FATAL — Comunicação imediata exigida pelo eSocial (S-2210)", 12, b.y + 5);
    doc.setTextColor(0, 0, 0);
    b.y += 9;
  }
  const prazo = prazoLegal(cat);
  if (prazo.vencido || (prazo.critico && cat.status !== "concluida" && cat.status !== "enviada_esocial")) {
    doc.setFillColor(prazo.vencido ? 239 : 250, prazo.vencido ? 68 : 204, prazo.vencido ? 68 : 21);
    doc.setTextColor(255, 255, 255);
    doc.rect(10, b.y, 190, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`⚠ ${prazo.label}`, 12, b.y + 4.2);
    doc.setTextColor(0, 0, 0);
    b.y += 8;
  }

  // 1. Empresa
  sectionTitle(b, "1. Identificação do Empregador");
  row(b, [
    ["Razão Social", ctx.empresaNome],
    ["CNPJ", ctx.empresaCnpj],
    ["Unidade/Contrato", [cat.unidade_id ? "Unidade vinculada" : null, cat.contrato_id ? "Contrato vinculado" : null].filter(Boolean).join(" · ") || "—"],
  ]);

  // 2. Funcionário
  sectionTitle(b, "2. Identificação do Acidentado");
  row(b, [
    ["Nome", ctx.funcionarioNome],
    ["CPF", ctx.funcionarioCpf],
    ["Cargo", ctx.funcionarioCargo],
  ]);
  row(b, [
    ["CBO", cat.cbo],
    ["Remuneração mensal", cat.remuneracao_mensal != null ? `R$ ${Number(cat.remuneracao_mensal).toFixed(2)}` : null],
    ["Jornada semanal (h)", cat.jornada_semanal_horas != null ? String(cat.jornada_semanal_horas) : null],
  ]);

  // 3. Acidente
  sectionTitle(b, "3. Acidente — Quando e Onde");
  row(b, [
    ["Data do acidente", fmtDate(cat.data_acidente)],
    ["Hora do acidente", cat.hora_acidente || "—"],
    ["Tipo de acidente", TIPO_ACIDENTE_LABEL[cat.tipo_acidente]],
  ]);
  row(b, [
    ["Local", cat.local_acidente],
    ["Município/UF", [cat.municipio, cat.uf].filter(Boolean).join("/")],
    ["País", cat.pais || "BRA"],
  ]);
  field(b, "Endereço do local", [cat.endereco_local, cat.cep].filter(Boolean).join(" — "), 0, 3);

  // 4. Lesão
  sectionTitle(b, "4. Lesão — Natureza e Origem");
  row(b, [
    ["Situação geradora", ctx.situacaoGeradora],
    ["Agente causador", ctx.agenteCausador],
    ["Parte atingida", `${ctx.parteAtingida || "—"}${cat.lateralidade ? ` (${cat.lateralidade})` : ""}`],
  ]);
  row(b, [
    ["Natureza da lesão", ctx.naturezaLesao],
    ["CID-10", cat.cid_codigo ? `${cat.cid_codigo} — ${cat.cid_descricao || ""}` : null],
    ["Houve internação", cat.houve_internacao ? "Sim" : "Não"],
  ]);
  if (cat.descricao_lesao) {
    field(b, "Descrição da lesão / acidente", cat.descricao_lesao, 0, 3);
  }

  // 5. Atendimento médico
  sectionTitle(b, "5. Atendimento Médico");
  row(b, [
    ["Hospital / Local", cat.hospital],
    ["Data atendimento", fmtDate(cat.data_atendimento)],
    ["Hora atendimento", cat.hora_atendimento || "—"],
  ]);
  row(b, [
    ["Médico assistente", cat.medico_nome],
    ["CRM", cat.medico_crm],
    ["UF do CRM", cat.medico_uf],
  ]);

  // 6. Afastamento / óbito
  sectionTitle(b, "6. Afastamento e Óbito");
  row(b, [
    ["Houve afastamento", cat.houve_afastamento ? "Sim" : "Não"],
    ["Último dia trabalhado", fmtDate(cat.ultimo_dia_trabalhado)],
    ["Óbito", cat.obito ? "SIM" : "Não"],
  ]);
  if (cat.obito) {
    row(b, [["Data do óbito", fmtDate(cat.data_obito)], ["", ""], ["", ""]]);
  }

  // 7. Testemunhas
  sectionTitle(b, "7. Testemunhas");
  const t = ctx.testemunhas || [];
  if (t.length === 0) {
    ensureSpace(b, 6);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Nenhuma testemunha registrada.", 12, b.y + 3);
    b.y += 7;
  } else {
    t.forEach((w, i) => {
      ensureSpace(b, 7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${i + 1}. ${w.nome}`, 12, b.y);
      doc.setFont("helvetica", "normal");
      const meta = [w.cpf && `CPF ${w.cpf}`, w.cargo, w.telefone].filter(Boolean).join(" · ");
      if (meta) doc.text(meta, 12, b.y + 4);
      b.y += meta ? 8 : 5;
    });
  }

  // 8. Emitente
  sectionTitle(b, "8. Emitente");
  row(b, [
    ["Tipo", EMITENTE_LABEL[cat.emitente_tipo]],
    ["Nome", cat.emitente_nome],
    ["CPF", cat.emitente_cpf],
  ]);
  field(b, "Cargo / função do emitente", cat.emitente_cargo, 0, 3);

  // 9. Anexos
  sectionTitle(b, "9. Anexos Relacionados");
  const ax = (ctx.anexos || []).filter((a) => a.categoria !== "pdf_cat");
  if (ax.length === 0) {
    ensureSpace(b, 6);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Nenhum anexo.", 12, b.y + 3);
    b.y += 7;
  } else {
    ax.forEach((a, i) => {
      ensureSpace(b, 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`• [${a.categoria}] ${a.nome_arquivo}`, 12, b.y + 3);
      b.y += 5;
    });
  }

  // 10. Histórico
  sectionTitle(b, "10. Histórico Resumido");
  const hist = (ctx.historico || []).slice(0, 12);
  if (hist.length === 0) {
    ensureSpace(b, 6);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Sem histórico registrado.", 12, b.y + 3);
    b.y += 7;
  } else {
    hist.forEach((h) => {
      ensureSpace(b, 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const linha =
        `${fmtDT(h.created_at)} — ${h.acao}` +
        (h.status_novo ? ` (${h.status_anterior || "—"} → ${h.status_novo})` : "") +
        (h.user_email ? ` · ${h.user_email}` : "") +
        (h.motivo ? ` — ${h.motivo}` : "");
      const lines = doc.splitTextToSize(linha, 190);
      doc.text(lines, 12, b.y + 3);
      b.y += 3 + lines.length * 3.3;
    });
  }

  // Rodapé com QR + hash em todas as páginas
  const pageCount = doc.getNumberOfPages();
  const qrDataUrl = await QRCode.toDataURL(opts.qrUrl, { margin: 0, width: 200 });
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(200);
    doc.line(10, 287, 200, 287);
    doc.addImage(qrDataUrl, "PNG", 10, 289, 16, 16);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text("QR Code de validação interna — abre a CAT no sistema (acesso restrito à empresa).", 28, 292);
    doc.text(opts.qrUrl, 28, 295);
    doc.text(`Gerado em ${fmtDT(new Date().toISOString())} · Página ${p}/${pageCount} · Versão v${opts.versao}`, 28, 298);
    doc.setTextColor(0);
  }

  return doc;
}

export interface GeneratePdfResult {
  versao: number;
  fileId: string;
  viewLink: string;
  hash: string;
  fileName: string;
  blob: Blob;
}

/** Gera o PDF, calcula SHA-256, sobe para o Drive da empresa e registra via RPC. */
export async function generateAndUploadCatPdf(ctx: CatPdfContext): Promise<GeneratePdfResult> {
  const { cat } = ctx;

  // Versão preliminar baseada no que está no banco; a RPC vai incrementar e devolver o oficial.
  const versaoPrev = ((cat as any).pdf_versao ?? 0) + 1;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrUrl = `${origin}/cat/${cat.id}?v=${versaoPrev}`;

  // 1. Renderiza PDF
  const doc = await renderPdf(ctx, { qrUrl, versao: versaoPrev });
  const blob = doc.output("blob");
  const buffer = await blob.arrayBuffer();

  // 2. Hash SHA-256
  const hash = await sha256Hex(buffer);

  // 3. Reembala incluindo o hash no rodapé final em uma página adicional? Não — para manter hash imutável,
  //    o hash é do PDF gerado e gravado externamente. Não voltamos a alterar o blob.
  const fileName = `CAT_${cat.numero_cat || cat.id.slice(0, 8)}_v${versaoPrev}.pdf`;
  const folder = `CAT/${cat.numero_cat || cat.id}`;

  // 4. Upload Drive BYOK (pasta da empresa via gdrive-token)
  const file = new File([blob], fileName, { type: "application/pdf" });
  const up = await uploadToDrive(file, folder, fileName);

  // 5. Registra no banco via RPC com tenant guard
  const { data, error } = await (supabase.rpc as any)("cat_registrar_pdf", {
    _cat_id: cat.id,
    _drive_file_id: up.fileId,
    _drive_view_link: up.webViewLink,
    _drive_path: folder,
    _nome_arquivo: fileName,
    _tamanho_bytes: blob.size,
    _pdf_hash: hash,
  });
  if (error) throw error;
  const versao = (data as any)?.versao ?? versaoPrev;

  return { versao, fileId: up.fileId, viewLink: up.webViewLink, hash, fileName, blob };
}

/** Marca download no histórico (auditoria). */
export async function logCatPdfDownload(catId: string) {
  await (supabase.rpc as any)("cat_registrar_pdf_download", { _cat_id: catId });
}

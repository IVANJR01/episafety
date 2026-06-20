// PGR Parte 5 — PDF técnico interno + assinatura visual + QR Code + Drive BYOK
// Nada de ICP-Brasil. Hash SHA-256 + assinatura visual + QR de validação interna.
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { uploadToDrive } from "@/lib/googleDriveStorage";
import { PgrDocumento, PGR_STATUS_LABEL } from "@/lib/pgrTypes";
import { CLASSE_LABEL as CLASSIF_LABEL, classificarRisco as classificarMatriz, PgrClasse } from "@/lib/pgrMatriz";
const ACAO_CLASSE_LABEL = CLASSIF_LABEL;

export interface PgrInventarioItem {
  id: string;
  ghe_id: string | null;
  grupo: string;
  perigo_descricao: string;
  fonte_geradora: string | null;
  tipo_exposicao: string | null;
  avaliacao_tipo: string;
  severidade: number;
  probabilidade: number;
  classificacao: string;
  necessita_acao: boolean;
  trabalhadores_expostos: number | null;
  controles_existentes: string | null;
}
export interface PgrAcaoItem {
  id: string;
  descricao: string;
  what: string | null;
  why: string | null;
  who: string | null;
  where_local: string | null;
  when_inicio: string | null;
  prazo: string | null;
  how: string | null;
  how_much: number | null;
  status: string;
  classe_risco: string | null;
  prioridade: number | null;
  data_conclusao: string | null;
}
export interface PgrEvidenciaItem {
  id: string;
  acao_id: string;
  nome_arquivo: string;
  uploaded_at: string;
  uploaded_by_email: string | null;
  drive_view_link: string | null;
}
export interface PgrRevisaoItem {
  acao: string;
  motivo: string | null;
  user_email: string | null;
  created_at: string;
  versao_anterior: number | null;
  versao_nova: number | null;
}
export interface PgrAssinaturaItem {
  responsavel_nome: string;
  responsavel_registro: string | null;
  pdf_versao: number;
  pdf_hash: string;
  assinado_em: string;
  mfa_verificado: boolean;
}

export interface PgrPdfContext {
  doc: PgrDocumento;
  empresaNome: string | null;
  empresaCnpj: string | null;
  unidadeNome: string | null;
  inventario: PgrInventarioItem[];
  acoes: PgrAcaoItem[];
  evidencias: PgrEvidenciaItem[];
  revisoes: PgrRevisaoItem[];
  assinaturas: PgrAssinaturaItem[];
  ghes: Record<string, string>;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const fmtDate = (s?: string | null) => s ? new Date(s.length <= 10 ? s + "T00:00:00" : s).toLocaleDateString("pt-BR") : "—";
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

function drawMatriz(b: B) {
  ensure(b, 70);
  const x0 = 60, y0 = b.y + 4, cs = 14;
  b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(8);
  b.doc.text("Matriz de Risco 5×5 (Severidade × Probabilidade)", 12, b.y + 2);
  // axes
  for (let s = 5; s >= 1; s--) {
    for (let p = 1; p <= 5; p++) {
      const c = classificarMatriz(s, p);
      const rgb: Record<string, [number, number, number]> = {
        baixo: [34, 197, 94], moderado: [234, 179, 8], alto: [249, 115, 22], critico: [220, 38, 38],
      };
      const [r, g, bl] = rgb[c] || [200, 200, 200];
      b.doc.setFillColor(r, g, bl);
      const px = x0 + (p - 1) * cs;
      const py = y0 + (5 - s) * cs;
      b.doc.rect(px, py, cs, cs, "F");
      b.doc.setTextColor(255); b.doc.setFontSize(8);
      b.doc.text(String(s * p), px + cs / 2, py + cs / 2 + 1, { align: "center" });
    }
  }
  b.doc.setTextColor(0); b.doc.setFontSize(7);
  for (let p = 1; p <= 5; p++) b.doc.text(String(p), x0 + (p - 1) * cs + cs / 2, y0 + 5 * cs + 4, { align: "center" });
  for (let s = 5; s >= 1; s--) b.doc.text(String(s), x0 - 3, y0 + (5 - s) * cs + cs / 2 + 1, { align: "right" });
  b.doc.text("Probabilidade →", x0 + 35, y0 + 5 * cs + 9, { align: "center" });
  b.doc.text("Sev.", x0 - 8, y0 + 35, { align: "center" });

  // legend
  const legX = x0 + 5 * cs + 8;
  const legend: Array<["baixo" | "moderado" | "alto" | "critico", string]> = [
    ["baixo", "Baixo (≤4)"], ["moderado", "Moderado (≤9)"], ["alto", "Alto (≤16)"], ["critico", "Crítico (>16)"],
  ];
  legend.forEach(([c, lbl], i) => {
    const rgb: Record<string, [number, number, number]> = {
      baixo: [34, 197, 94], moderado: [234, 179, 8], alto: [249, 115, 22], critico: [220, 38, 38],
    };
    const [r, g, bl] = rgb[c];
    b.doc.setFillColor(r, g, bl);
    b.doc.rect(legX, y0 + i * 8, 5, 5, "F");
    b.doc.setTextColor(0); b.doc.setFontSize(8);
    b.doc.text(lbl, legX + 7, y0 + i * 8 + 4);
  });
  b.y = y0 + 5 * cs + 14;
}

async function render(ctx: PgrPdfContext, opts: { qrUrl: string; pdfVersao: number; comMarca: boolean }): Promise<jsPDF> {
  const { doc: pgr } = ctx;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const b: B = { doc: pdf, y: 12 };

  // CAPA
  pdf.setFillColor(15, 23, 42); pdf.rect(0, 0, 210, 65, "F");
  pdf.setTextColor(255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(22);
  pdf.text("PGR", 105, 28, { align: "center" });
  pdf.setFontSize(12); pdf.setFont("helvetica", "normal");
  pdf.text("Programa de Gerenciamento de Riscos", 105, 36, { align: "center" });
  pdf.setFontSize(10); pdf.text("Documento técnico interno — NR-01", 105, 44, { align: "center" });
  pdf.setFontSize(9); pdf.text(`Versão do PGR: v${pgr.versao}  ·  Versão do PDF: v${opts.pdfVersao}  ·  ${PGR_STATUS_LABEL[pgr.status]}`, 105, 54, { align: "center" });
  pdf.setTextColor(0); b.y = 75;

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
  pdf.text(ctx.empresaNome || "Empresa", 12, b.y); b.y += 7;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  if (ctx.empresaCnpj) { pdf.text(`CNPJ: ${ctx.empresaCnpj}`, 12, b.y); b.y += 5; }
  if (ctx.unidadeNome) { pdf.text(`Unidade: ${ctx.unidadeNome}`, 12, b.y); b.y += 5; }
  b.y += 4;
  pdf.text(`Emitido em: ${fmtDate(pgr.data_emissao) || fmtDate(new Date().toISOString())}`, 12, b.y); b.y += 5;
  pdf.text(`Vigência: ${fmtDate(pgr.data_vigencia_inicio)} a ${fmtDate(pgr.data_vigencia_fim)}`, 12, b.y); b.y += 5;
  pdf.text(`Responsável Técnico: ${pgr.resp_tec_nome || "—"}`, 12, b.y); b.y += 5;
  pdf.text(`Registro Profissional: ${pgr.resp_tec_registro || "—"}`, 12, b.y); b.y += 8;

  // Aviso
  pdf.setFillColor(254, 243, 199); pdf.rect(10, b.y, 190, 16, "F");
  pdf.setTextColor(146, 64, 14); pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
  pdf.text("AVISO LEGAL", 12, b.y + 5);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
  pdf.text("Documento técnico interno. Assinatura ICP-Brasil não implementada nesta fase.", 12, b.y + 10);
  pdf.text("Validação por hash SHA-256 e QR Code de uso restrito à empresa.", 12, b.y + 14);
  pdf.setTextColor(0); b.y += 20;

  pdf.addPage(); b.y = 15;

  // 1. Escopo e metodologia
  title(b, "1. Escopo");
  kv(b, "Escopo do PGR", pgr.escopo || "—", true);
  title(b, "2. Metodologia de avaliação");
  kv(b, "Método", pgr.metodologia_avaliacao || "Matriz 5×5 (Severidade × Probabilidade)", true);
  drawMatriz(b);

  // 3. Resumo quantitativo
  title(b, "3. Resumo quantitativo dos riscos");
  const counts = { baixo: 0, moderado: 0, alto: 0, critico: 0 } as Record<string, number>;
  ctx.inventario.forEach((i) => { counts[i.classificacao] = (counts[i.classificacao] || 0) + 1; });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
  (["baixo", "moderado", "alto", "critico"] as const).forEach((c, i) => {
    pdf.text(`${CLASSIF_LABEL[c]}: ${counts[c] || 0}`, 12 + i * 45, b.y + 4);
  });
  b.y += 9;

  // 4. Inventário por GHE
  title(b, "4. Inventário de riscos por GHE/GES");
  const byGhe = new Map<string, PgrInventarioItem[]>();
  ctx.inventario.forEach((i) => {
    const k = i.ghe_id || "_";
    if (!byGhe.has(k)) byGhe.set(k, []);
    byGhe.get(k)!.push(i);
  });
  if (byGhe.size === 0) para(b, "Nenhum item de inventário registrado.");
  for (const [gid, items] of byGhe) {
    ensure(b, 10);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(15, 23, 42);
    pdf.text(`GHE/GES: ${ctx.ghes[gid] || "Sem GHE"}  (${items.length} riscos)`, 12, b.y + 3);
    pdf.setTextColor(0); b.y += 6;
    items.forEach((i) => {
      ensure(b, 14);
      pdf.setDrawColor(220); pdf.line(12, b.y, 198, b.y);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
      pdf.text(`• ${i.perigo_descricao} [${i.grupo}]`, 12, b.y + 4);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
      const cls = CLASSIF_LABEL[i.classificacao as keyof typeof CLASSIF_LABEL] || i.classificacao;
      pdf.text(`Sev ${i.severidade} × Prob ${i.probabilidade} = ${i.severidade * i.probabilidade}  ·  ${cls}  ·  ${i.trabalhadores_expostos ?? 0} expostos`, 12, b.y + 8);
      if (i.fonte_geradora) { pdf.text(`Fonte: ${i.fonte_geradora}`, 12, b.y + 11.5); b.y += 14; } else { b.y += 11; }
      if (i.controles_existentes) {
        const ll = pdf.splitTextToSize(`Controles: ${i.controles_existentes}`, 186);
        pdf.text(ll, 12, b.y); b.y += ll.length * 3.3 + 1;
      }
    });
    b.y += 2;
  }

  // 5. Plano de ação 5W2H
  pdf.addPage(); b.y = 15;
  title(b, "5. Plano de Ação (5W2H)");
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasadas = ctx.acoes.filter((a) => a.prazo && a.prazo < hoje && a.status !== "concluida" && a.status !== "cancelada");
  if (ctx.acoes.length === 0) para(b, "Nenhuma ação registrada.");
  ctx.acoes.forEach((a) => {
    ensure(b, 22);
    pdf.setDrawColor(200); pdf.rect(10, b.y, 190, 0.2, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`• ${a.descricao}`, 12, b.y + 4);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const risco = a.classe_risco ? ACAO_CLASSE_LABEL[a.classe_risco as keyof typeof ACAO_CLASSE_LABEL] : "—";
    pdf.text(`Status: ${a.status}  ·  Risco: ${risco}  ·  Prazo: ${fmtDate(a.prazo)}  ·  Conclusão: ${fmtDate(a.data_conclusao)}`, 12, b.y + 8);
    const linhas = [
      a.what && `What: ${a.what}`,
      a.why && `Why: ${a.why}`,
      a.who && `Who: ${a.who}`,
      a.where_local && `Where: ${a.where_local}`,
      a.when_inicio && `When: ${fmtDate(a.when_inicio)}`,
      a.how && `How: ${a.how}`,
      a.how_much != null && `How much: R$ ${Number(a.how_much).toFixed(2)}`,
    ].filter(Boolean) as string[];
    b.y += 11;
    linhas.forEach((l) => {
      const ll = pdf.splitTextToSize(l, 186);
      ensure(b, ll.length * 3.5 + 2);
      pdf.text(ll, 12, b.y);
      b.y += ll.length * 3.3 + 1;
    });
    // evidências da ação (apenas metadados)
    const evs = ctx.evidencias.filter((e) => e.acao_id === a.id);
    if (evs.length > 0) {
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(7); pdf.setTextColor(80);
      pdf.text(`Evidências (${evs.length}) — acesso depende das permissões da empresa:`, 12, b.y);
      b.y += 3;
      evs.forEach((e) => {
        const ll = pdf.splitTextToSize(`  · ${e.nome_arquivo}  ·  ${fmtDT(e.uploaded_at)}  ·  ${e.uploaded_by_email || "—"}`, 186);
        ensure(b, ll.length * 3.2 + 1);
        pdf.text(ll, 12, b.y); b.y += ll.length * 3 + 1;
      });
      pdf.setTextColor(0);
    }
    b.y += 3;
  });

  // 6. Ações atrasadas
  title(b, "6. Ações atrasadas");
  if (atrasadas.length === 0) para(b, "Nenhuma ação atrasada.");
  else atrasadas.forEach((a) => {
    ensure(b, 6);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    pdf.text(`• ${a.descricao} — prazo ${fmtDate(a.prazo)} — ${a.status}`, 12, b.y + 3);
    b.y += 5;
  });

  // 7. Revisões
  title(b, "7. Histórico de revisões");
  if (ctx.revisoes.length === 0) para(b, "Sem revisões.");
  ctx.revisoes.forEach((r) => {
    ensure(b, 6);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const linha = `${fmtDT(r.created_at)} · ${r.acao}` +
      (r.versao_anterior != null && r.versao_nova != null ? ` · v${r.versao_anterior}→v${r.versao_nova}` : "") +
      (r.user_email ? ` · ${r.user_email}` : "") + (r.motivo ? ` — ${r.motivo}` : "");
    const ll = pdf.splitTextToSize(linha, 186);
    pdf.text(ll, 12, b.y + 3); b.y += 3 + ll.length * 3.2;
  });

  // 8. Assinaturas visuais
  title(b, "8. Assinatura visual do responsável técnico");
  para(b, "Assinatura visual com hash SHA-256 e MFA verificado. Não constitui assinatura digital ICP-Brasil.");
  if (ctx.assinaturas.length === 0) para(b, "Nenhuma assinatura visual registrada até a geração deste PDF.");
  ctx.assinaturas.forEach((a) => {
    ensure(b, 18);
    pdf.setDrawColor(180); pdf.line(12, b.y + 12, 100, b.y + 12);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(a.responsavel_nome, 12, b.y + 16);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
    pdf.text(`${a.responsavel_registro || "—"}  ·  ${fmtDT(a.assinado_em)}  ·  MFA ${a.mfa_verificado ? "OK" : "—"}  ·  PDF v${a.pdf_versao}`, 12, b.y + 19);
    pdf.text(`Hash assinado: ${a.pdf_hash}`, 12, b.y + 22);
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
      pdf.text(pgr.status === "em_revisao" ? "EM REVISÃO" : "RASCUNHO", 105, 160, { align: "center", angle: 35 } as any);
      if (typeof anyDoc.GState === "function") { anyDoc.setGState(new anyDoc.GState({ opacity: 1 })); }
      pdf.setTextColor(0);
    }
    pdf.setDrawColor(200); pdf.line(10, 283, 200, 283);
    pdf.addImage(qrDataUrl, "PNG", 10, 285, 18, 18);
    pdf.setFontSize(7); pdf.setFont("helvetica", "normal"); pdf.setTextColor(80);
    pdf.text("QR Code de validação interna — abre o PGR no sistema (acesso restrito à empresa).", 30, 288);
    pdf.text(opts.qrUrl, 30, 291);
    pdf.text(`Gerado em ${fmtDT(new Date().toISOString())}  ·  PDF v${opts.pdfVersao}  ·  PGR v${pgr.versao}  ·  Página ${p}/${pages}`, 30, 294);
    pdf.text("Documento técnico interno. Assinatura ICP-Brasil não implementada nesta fase.", 30, 297);
    pdf.setTextColor(0);
  }

  return pdf;
}

export interface GeneratePgrPdfResult {
  pdfVersao: number;
  hash: string;
  fileId: string;
  viewLink: string;
  fileName: string;
  blob: Blob;
}

export async function generateAndUploadPgrPdf(ctx: PgrPdfContext): Promise<GeneratePgrPdfResult> {
  const { doc: pgr } = ctx;
  const comMarca = pgr.status === "rascunho" || pgr.status === "em_revisao";

  // Versão preliminar (RPC vai conferir e gravar o oficial)
  const { data: ultimaV } = await (supabase.from as any)("pgr_pdf_versoes")
    .select("pdf_versao").eq("pgr_id", pgr.id).order("pdf_versao", { ascending: false }).limit(1).maybeSingle();
  const proxVersao = ((ultimaV?.pdf_versao as number | undefined) ?? 0) + 1;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrUrl = `${origin}/pgr/validar/${pgr.id}?v=${proxVersao}`;

  const pdf = await render(ctx, { qrUrl, pdfVersao: proxVersao, comMarca });
  const blob = pdf.output("blob");
  const buffer = await blob.arrayBuffer();
  const hash = await sha256Hex(buffer);

  const empSlug = (ctx.empresaNome || "empresa").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30);
  const uniSlug = (ctx.unidadeNome || "matriz").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30);
  const fileName = `PGR_${empSlug}_${uniSlug}_v${pgr.versao}_pdf${proxVersao}${comMarca ? "_RASCUNHO" : ""}.pdf`;
  const folder = `PGR/v${pgr.versao}/Documento`;

  const file = new File([blob], fileName, { type: "application/pdf" });
  const up = await uploadToDrive(file, folder, fileName, { makePublic: false });

  const { data, error } = await (supabase.rpc as any)("pgr_pdf_registrar", {
    _pgr_id: pgr.id,
    _drive_file_id: up.fileId,
    _drive_view_link: up.webViewLink,
    _drive_path: folder,
    _nome_arquivo: fileName,
    _tamanho_bytes: blob.size,
    _pdf_hash: hash,
    _com_marca_dagua: comMarca,
  });
  if (error) throw error;

  return {
    pdfVersao: (data as any)?.pdf_versao ?? proxVersao,
    hash,
    fileId: up.fileId,
    viewLink: up.webViewLink,
    fileName,
    blob,
  };
}

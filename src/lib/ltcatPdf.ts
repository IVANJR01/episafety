// LTCAT Parte 5 — PDF técnico interno + assinatura visual + QR Code + Drive BYOK.
// Hash SHA-256 + assinatura visual. Sem ICP-Brasil. Sem binário no banco.
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { uploadToDrive } from "@/lib/googleDriveStorage";
import {
  LtcatDocumento, LTCAT_STATUS_LABEL, LTCAT_MOTIVO_LABEL,
  LTCAT_CONCLUSAO_LABEL, LTCAT_ENQUADRAMENTO_LABEL,
} from "@/lib/ltcatTypes";

export interface LtcatPdfContext {
  doc: LtcatDocumento;
  empresaNome: string | null;
  empresaCnpj: string | null;
  unidadeNome: string | null;
  responsaveis: any[];
  ghes: any[];
  funcoes: any[];
  agentes: any[];
  avaliacoes: any[];
  conclusoes: any[];
  revisoes: any[];
  assinaturas: any[];
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

async function render(ctx: LtcatPdfContext, opts: { qrUrl: string; pdfVersao: number; comMarca: boolean }): Promise<jsPDF> {
  const { doc: lt } = ctx;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const b: B = { doc: pdf, y: 12 };
  const rtPrincipal = ctx.responsaveis[0];

  // CAPA
  pdf.setFillColor(15, 23, 42); pdf.rect(0, 0, 210, 70, "F");
  pdf.setTextColor(255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(22);
  pdf.text("LTCAT", 105, 28, { align: "center" });
  pdf.setFontSize(11); pdf.setFont("helvetica", "normal");
  pdf.text("Laudo Técnico das Condições Ambientais do Trabalho", 105, 36, { align: "center" });
  pdf.setFontSize(9); pdf.text("Documento técnico interno — Lei 8.213/91 · Dec. 3.048/99", 105, 44, { align: "center" });
  pdf.setFontSize(9);
  pdf.text(`Versão do LTCAT: v${lt.versao}  ·  Versão do PDF: v${opts.pdfVersao}  ·  ${LTCAT_STATUS_LABEL[lt.status]}`, 105, 54, { align: "center" });
  pdf.text(`Motivo: ${LTCAT_MOTIVO_LABEL[lt.motivo_emissao]}`, 105, 60, { align: "center" });
  pdf.setTextColor(0); b.y = 80;

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
  pdf.text(ctx.empresaNome || "Empresa", 12, b.y); b.y += 7;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  if (ctx.empresaCnpj) { pdf.text(`CNPJ: ${ctx.empresaCnpj}`, 12, b.y); b.y += 5; }
  if (ctx.unidadeNome) { pdf.text(`Unidade avaliada: ${ctx.unidadeNome}`, 12, b.y); b.y += 5; }
  if (lt.cnae) { pdf.text(`CNAE: ${lt.cnae}${lt.grau_risco ? ` · Grau de risco: ${lt.grau_risco}` : ""}`, 12, b.y); b.y += 5; }
  b.y += 3;
  pdf.text(`Emitido em: ${fmtDate(lt.data_emissao) || fmtDate(new Date().toISOString())}`, 12, b.y); b.y += 5;
  pdf.text(`Período avaliado: ${fmtDate(lt.data_vigencia_inicio)} a ${fmtDate(lt.data_vigencia_fim)}`, 12, b.y); b.y += 5;
  if (rtPrincipal) {
    pdf.text(`Responsável Técnico: ${rtPrincipal.nome}`, 12, b.y); b.y += 5;
    pdf.text(`Registro: ${rtPrincipal.profissao || ""} ${rtPrincipal.registro_profissional || ""}${rtPrincipal.uf_registro ? `/${rtPrincipal.uf_registro}` : ""}`, 12, b.y); b.y += 5;
    if (rtPrincipal.numero_art) { pdf.text(`ART/RRT: ${rtPrincipal.numero_art}`, 12, b.y); b.y += 5; }
  }
  b.y += 4;

  // AVISO
  pdf.setFillColor(254, 243, 199); pdf.rect(10, b.y, 190, 18, "F");
  pdf.setTextColor(146, 64, 14); pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
  pdf.text("AVISO LEGAL", 12, b.y + 5);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
  pdf.text("Documento técnico interno. Assinatura ICP-Brasil não implementada nesta fase.", 12, b.y + 10);
  pdf.text("Análise técnica para fins previdenciários — não constitui promessa de concessão de benefício pelo INSS.", 12, b.y + 14);
  pdf.setTextColor(0);

  pdf.addPage(); b.y = 15;

  // 1) Escopo e metodologia
  title(b, "1. Escopo e metodologia");
  kv(b, "Escopo", lt.escopo || "—", true);
  kv(b, "Metodologia geral", lt.metodologia_geral || "—", true);
  if (lt.observacoes) kv(b, "Observações", lt.observacoes, true);

  // 2) Responsáveis técnicos
  title(b, "2. Responsáveis técnicos");
  if (ctx.responsaveis.length === 0) para(b, "Nenhum responsável técnico cadastrado.");
  ctx.responsaveis.forEach((r) => {
    ensure(b, 10);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`• ${r.nome}`, 12, b.y + 4);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    pdf.text(`${r.profissao || ""}  ·  ${r.registro_profissional || ""}${r.uf_registro ? `/${r.uf_registro}` : ""}  ·  ART/RRT ${r.numero_art || "—"}`, 12, b.y + 8);
    b.y += 11;
  });

  // 3) GHE/GES
  title(b, "3. Setores / GHE / GES avaliados");
  if (ctx.ghes.length === 0) para(b, "Nenhum GHE/GES cadastrado.");
  ctx.ghes.forEach((g) => {
    ensure(b, 8);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`• ${g.codigo} — ${g.nome}`, 12, b.y + 4);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const extras = [g.setor_nome && `Setor: ${g.setor_nome}`, g.numero_trabalhadores != null && `Trabalhadores: ${g.numero_trabalhadores}`].filter(Boolean).join("  ·  ");
    if (extras) { pdf.text(extras, 12, b.y + 8); b.y += 11; } else { b.y += 7; }
    if (g.descricao_atividade) {
      const ll = pdf.splitTextToSize(`Atividades: ${g.descricao_atividade}`, 186);
      pdf.text(ll, 12, b.y); b.y += ll.length * 3.3;
    }
    b.y += 2;
  });

  // 4) Funções
  title(b, "4. Funções avaliadas");
  if (ctx.funcoes.length === 0) para(b, "Nenhuma função vinculada.");
  ctx.funcoes.forEach((f) => {
    const g = ctx.ghes.find((x) => x.id === f.grupo_homogeneo_id);
    ensure(b, 7);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const linha = `• ${f.nome_funcao}${f.cbo ? ` · CBO ${f.cbo}` : ""}${g ? ` · ${g.codigo}` : ""} · ${f.numero_trabalhadores ?? 0} trab.`;
    pdf.text(linha, 12, b.y + 3); b.y += 5;
    if (f.descricao_atividade) {
      const ll = pdf.splitTextToSize(`  ${f.descricao_atividade}`, 184);
      pdf.text(ll, 12, b.y); b.y += ll.length * 3.2;
    }
  });

  // 5) Agentes e avaliações
  pdf.addPage(); b.y = 15;
  title(b, "5. Agentes nocivos e avaliações");
  if (ctx.agentes.length === 0) para(b, "Nenhum agente cadastrado.");
  ctx.agentes.forEach((a) => {
    const g = ctx.ghes.find((x) => x.id === a.grupo_homogeneo_id);
    const avs = ctx.avaliacoes.filter((v) => v.agente_id === a.id);
    ensure(b, 14);
    pdf.setDrawColor(220); pdf.line(12, b.y, 198, b.y);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`• ${a.nome} [${a.grupo}]${g ? ` · ${g.codigo}` : ""}`, 12, b.y + 4);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const linhaTipo = [
      a.tipo_exposicao && `Exposição: ${a.tipo_exposicao}`,
      a.frequencia && `Freq.: ${a.frequencia}`,
      a.duracao && `Duração: ${a.duracao}`,
    ].filter(Boolean).join("  ·  ");
    if (linhaTipo) { pdf.text(linhaTipo, 12, b.y + 8); b.y += 11; } else b.y += 8;
    if (a.fonte_geradora) { pdf.text(`Fonte: ${a.fonte_geradora}`, 12, b.y); b.y += 3.5; }
    if (a.epi_descricao || a.epc_descricao) {
      const epiStr = [
        a.epi_descricao && `EPI: ${a.epi_descricao}${a.epi_ca ? ` (CA ${a.epi_ca})` : ""}${a.epi_eficacia ? ` · eficácia ${a.epi_eficacia}` : ""}`,
        a.epc_descricao && `EPC: ${a.epc_descricao}${a.epc_eficacia ? ` · eficácia ${a.epc_eficacia}` : ""}`,
      ].filter(Boolean).join(" | ");
      const ll = pdf.splitTextToSize(epiStr, 186);
      pdf.text(ll, 12, b.y); b.y += ll.length * 3.3 + 1;
    }
    if (avs.length > 0) {
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(7); pdf.setTextColor(80);
      pdf.text(`Avaliações (${avs.length}):`, 12, b.y); b.y += 3;
      pdf.setFont("helvetica", "normal"); pdf.setTextColor(0);
      avs.forEach((v) => {
        ensure(b, 5);
        const acima = v.intensidade != null && v.limite_tolerancia != null && Number(v.intensidade) > Number(v.limite_tolerancia);
        const linha = `  · ${v.tecnica}  ·  ${v.intensidade ?? "—"} ${v.unidade_medida || ""}  (LT ${v.limite_tolerancia ?? "—"} ${v.unidade_medida || ""})${acima ? "  ⚠ ACIMA" : ""}` +
          `${v.data_medicao ? `  ·  ${fmtDate(v.data_medicao)}` : ""}${v.metodologia ? `  ·  ${v.metodologia}` : ""}`;
        const ll = pdf.splitTextToSize(linha, 186);
        pdf.text(ll, 12, b.y); b.y += ll.length * 3.2;
        const inst = [
          v.instrumento_marca && `Instr.: ${v.instrumento_marca} ${v.instrumento_modelo || ""}`,
          v.instrumento_serie && `Série: ${v.instrumento_serie}`,
          v.instrumento_calibracao_data && `Calibração: ${fmtDate(v.instrumento_calibracao_data)}`,
          v.instrumento_calibracao_validade && `Validade calibração: ${fmtDate(v.instrumento_calibracao_validade)}`,
        ].filter(Boolean).join("  ·  ");
        if (inst) {
          const ll2 = pdf.splitTextToSize(`    ${inst}`, 184);
          pdf.text(ll2, 12, b.y); b.y += ll2.length * 3.2;
        }
      });
    }
    b.y += 2;
  });

  // 6) Conclusões previdenciárias
  pdf.addPage(); b.y = 15;
  title(b, "6. Conclusões previdenciárias por GHE × Função");
  if (ctx.conclusoes.length === 0) para(b, "Nenhuma conclusão registrada.");
  ctx.conclusoes.forEach((c: any) => {
    const g = ctx.ghes.find((x) => x.id === c.grupo_homogeneo_id);
    const f = c.funcao_id ? ctx.funcoes.find((x) => x.id === c.funcao_id) : null;
    ensure(b, 24);
    pdf.setDrawColor(200); pdf.rect(10, b.y, 190, 0.2, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`• ${g ? `${g.codigo} — ${g.nome}` : "GHE"}  ${f ? `× ${f.nome_funcao}` : "(genérica)"}`, 12, b.y + 4);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    pdf.text(
      `Conclusão: ${LTCAT_CONCLUSAO_LABEL[c.conclusao as keyof typeof LTCAT_CONCLUSAO_LABEL]}  ·  Habitualidade: ${c.enquadramento ? LTCAT_ENQUADRAMENTO_LABEL[c.enquadramento as keyof typeof LTCAT_ENQUADRAMENTO_LABEL] : "—"}`,
      12, b.y + 8
    );
    b.y += 11;
    if (c.tipo_exposicao) { pdf.text(`Tipo de exposição: ${c.tipo_exposicao}`, 12, b.y); b.y += 3.5; }
    if (c.fundamento_legal) {
      const ll = pdf.splitTextToSize(`Fundamento legal: ${c.fundamento_legal}`, 186);
      pdf.text(ll, 12, b.y); b.y += ll.length * 3.3;
    }
    if (c.justificativa) {
      const ll = pdf.splitTextToSize(`Justificativa técnica: ${c.justificativa}`, 186);
      pdf.text(ll, 12, b.y); b.y += ll.length * 3.3;
    }
    if (c.epi_considerados || c.epc_considerados) {
      const ll = pdf.splitTextToSize(
        `EPI: ${c.epi_considerados || "—"}  |  EPC: ${c.epc_considerados || "—"}`, 186
      );
      pdf.text(ll, 12, b.y); b.y += ll.length * 3.3;
    }
    const ags = (c.agentes_considerados || []) as any[];
    if (ags.length > 0) {
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(7); pdf.setTextColor(80);
      pdf.text(`Agentes considerados (${ags.length}):`, 12, b.y); b.y += 3;
      pdf.setFont("helvetica", "normal"); pdf.setTextColor(0);
      ags.forEach((ag: any) => {
        const ll = pdf.splitTextToSize(
          `  · ${ag.agente_nome} [${ag.grupo}] · ${ag.intensidade ?? "—"} ${ag.unidade_medida || ""} (LT ${ag.limite_tolerancia ?? "—"})${ag.acima_limite ? " ⚠ ACIMA" : ""}${ag.data_medicao ? ` · ${fmtDate(ag.data_medicao)}` : ""}`,
          186
        );
        ensure(b, ll.length * 3.3 + 1);
        pdf.text(ll, 12, b.y); b.y += ll.length * 3.2;
      });
    }
    if (c.observacoes) {
      const ll = pdf.splitTextToSize(`Observações: ${c.observacoes}`, 186);
      pdf.text(ll, 12, b.y); b.y += ll.length * 3.3;
    }
    b.y += 3;
  });

  // 7) Histórico
  title(b, "7. Histórico de revisões");
  if (ctx.revisoes.length === 0) para(b, "Sem revisões.");
  ctx.revisoes.forEach((r: any) => {
    ensure(b, 5);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const linha = `${fmtDT(r.created_at)} · ${r.status_novo === "vigente" ? "Publicação" : "Revisão"}` +
      (r.versao_anterior != null && r.versao_nova != null ? ` · v${r.versao_anterior}→v${r.versao_nova}` : "") +
      (r.user_email ? ` · ${r.user_email}` : "") + (r.motivo ? ` — ${r.motivo}` : "");
    const ll = pdf.splitTextToSize(linha, 186);
    pdf.text(ll, 12, b.y + 3); b.y += 3 + ll.length * 3.2;
  });

  // 8) Assinaturas
  title(b, "8. Assinatura visual do responsável técnico");
  para(b, "Assinatura visual com hash SHA-256 e MFA verificado. Não constitui assinatura digital ICP-Brasil.");
  if (ctx.assinaturas.length === 0) para(b, "Nenhuma assinatura visual registrada até a geração deste PDF.");
  ctx.assinaturas.forEach((a: any) => {
    ensure(b, 18);
    pdf.setDrawColor(180); pdf.line(12, b.y + 12, 100, b.y + 12);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(a.responsavel_nome, 12, b.y + 16);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
    pdf.text(`${a.responsavel_registro || "—"}  ·  ${fmtDT(a.assinado_em)}  ·  MFA ${a.user_id ? "OK" : "—"}  ·  PDF v${a.pdf_versao}`, 12, b.y + 19);
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
      pdf.text(lt.status === "em_revisao" ? "EM REVISÃO" : "RASCUNHO", 105, 160, { align: "center", angle: 35 } as any);
      if (typeof anyDoc.GState === "function") { anyDoc.setGState(new anyDoc.GState({ opacity: 1 })); }
      pdf.setTextColor(0);
    }
    pdf.setDrawColor(200); pdf.line(10, 283, 200, 283);
    pdf.addImage(qrDataUrl, "PNG", 10, 285, 18, 18);
    pdf.setFontSize(7); pdf.setFont("helvetica", "normal"); pdf.setTextColor(80);
    pdf.text("QR Code de validação interna — abre o LTCAT no sistema (acesso restrito à empresa).", 30, 288);
    pdf.text(opts.qrUrl, 30, 291);
    pdf.text(`Gerado em ${fmtDT(new Date().toISOString())}  ·  PDF v${opts.pdfVersao}  ·  LTCAT v${lt.versao}  ·  Página ${p}/${pages}`, 30, 294);
    pdf.text("Documento técnico interno. Assinatura ICP-Brasil não implementada nesta fase.", 30, 297);
    pdf.setTextColor(0);
  }

  return pdf;
}

export interface GenerateLtcatPdfResult {
  pdfVersao: number;
  hash: string;
  fileId: string;
  viewLink: string;
  fileName: string;
  blob: Blob;
}

export async function generateAndUploadLtcatPdf(ctx: LtcatPdfContext): Promise<GenerateLtcatPdfResult> {
  const { doc: lt } = ctx;
  const comMarca = lt.status === "rascunho" || lt.status === "em_revisao";

  const { data: ultimaV } = await (supabase.from as any)("ltcat_pdf_versoes")
    .select("pdf_versao").eq("ltcat_id", lt.id)
    .order("pdf_versao", { ascending: false }).limit(1).maybeSingle();
  const proxVersao = ((ultimaV?.pdf_versao as number | undefined) ?? 0) + 1;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrUrl = `${origin}/ltcat/validar/${lt.id}?v=${proxVersao}`;

  const pdf = await render(ctx, { qrUrl, pdfVersao: proxVersao, comMarca });
  const blob = pdf.output("blob");
  const buffer = await blob.arrayBuffer();
  const hash = await sha256Hex(buffer);

  const empSlug = (ctx.empresaNome || "empresa").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30);
  const uniSlug = (ctx.unidadeNome || "matriz").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30);
  const fileName = `LTCAT_${empSlug}_${uniSlug}_v${lt.versao}_pdf${proxVersao}${comMarca ? "_RASCUNHO" : ""}.pdf`;
  const folder = `LTCAT/v${lt.versao}/Documento`;

  const file = new File([blob], fileName, { type: "application/pdf" });
  const up = await uploadToDrive(file, folder, fileName, { makePublic: false });

  const { data, error } = await (supabase.rpc as any)("ltcat_pdf_registrar", {
    _ltcat_id: lt.id,
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

// PGR Parte 5 — PDF técnico interno + assinatura visual + QR Code
// Storage: Supabase Storage privado (default) ou Google Drive BYOK (opcional).
// Banco recebe apenas hash SHA-256 + bucket/path + tamanho — nunca o binário.
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { uploadDocumentoSeguro } from "@/lib/secureStorage";
import { PgrDocumento, PGR_STATUS_LABEL } from "@/lib/pgrTypes";
import {
  CLASSE_LABEL as CLASSIF_LABEL,
  CLASSE_HEX,
  CLASSES_ORDENADAS,
  classeLabel,
  classificarRisco as classificarMatriz,
  PgrClasse,
} from "@/lib/pgrMatriz";

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
  where_local: string | null;
  prazo: string | null;
  how: string | null;
  status: string;
  /** Coluna real: responsavel_nome. Preenchido por carregarContexto(). */
  who: string | null;
  /** Coluna real: custo_estimado. Preenchido por carregarContexto(). */
  how_much: number | null;
  /** Derivado: classificação do item de inventário vinculado (não é coluna de pgr_acoes). */
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

export interface PgrQuadroEpiLinha {
  ghe_codigo: string;
  ghe_nome: string;
  funcao: string;
  medida_controle: string;
  epis: string;
}

/** Unidade (matriz ou filial) com os campos de identificação exigidos na Etapa 1. */
export interface PgrUnidadeItem {
  id: string;
  nome: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  cnae_principal?: string | null;
  grau_risco?: number | null;
  telefone?: string | null;
  email?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  /** Texto corrido legado, usado como fallback quando não há endereço decomposto. */
  endereco?: string | null;
  empresa_pai_id?: string | null;
}

export interface PgrResponsavelItem {
  papel: string;
  nome: string;
  cpf?: string | null;
  profissao?: string | null;
  registro_profissional?: string | null;
  uf_registro?: string | null;
  numero_art?: string | null;
  ordem: number;
}

export interface PgrCenarioItem {
  nome: string;
  tipo: string;
  descricao?: string | null;
  grande_magnitude: boolean;
  procedimento_resposta?: string | null;
  primeiros_socorros?: string | null;
  meios_recursos?: string | null;
  responsaveis?: string | null;
  abandono_ponto_encontro?: string | null;
  periodicidade_simulado?: string | null;
  ultimo_simulado?: string | null;
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
  textos?: Record<string, string>;
  quadroEpis?: PgrQuadroEpiLinha[];
  /** Matriz + filiais, para a seção de identificação. */
  unidades?: PgrUnidadeItem[];
  responsaveis?: PgrResponsavelItem[];
  cenarios?: PgrCenarioItem[];
}

/** Rótulos dos papéis de responsável, para o PDF (jsPDF não importa a UI). */
const PAPEL_PDF_LABEL: Record<string, string> = {
  elaborador: "Elaborador",
  responsavel_tecnico: "Responsável Técnico",
  revisor_tecnico: "Revisor Técnico",
  aprovador: "Aprovador",
  responsavel_organizacao: "Responsável pela Organização",
};

const MESES_PDF = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

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
      const [r, g, bl] = (c && CLASSE_HEX[c]) || [200, 200, 200];
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

  // Controle de revisões (visível logo após a capa)
  title(b, "Controle de Revisões");
  if (!ctx.revisoes || ctx.revisoes.length === 0) {
    para(b, "00 — Elaboração do Programa de Gerenciamento de Riscos");
  } else {
    ctx.revisoes.slice().reverse().forEach((r, idx) => {
      ensure(b, 6);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
      const rev = String(idx).padStart(2, "0");
      const desc = r.motivo || (r.acao === "publicar" ? "Publicação da versão" : r.acao);
      const ll = pdf.splitTextToSize(`${rev}  ·  ${fmtDate(r.created_at)}  ·  ${desc}`, 186);
      pdf.text(ll, 12, b.y + 3); b.y += 3 + ll.length * 3.2;
    });
  }

  // Identificação da empresa e dos estabelecimentos abrangidos.
  // Fica logo após o controle de revisões porque é o que identifica o documento;
  // vem dos campos de escopo travados na emissão, não do cadastro atual.
  title(b, "Identificação da Empresa e do Estabelecimento");
  const unidades = ctx.unidades && ctx.unidades.length > 0 ? ctx.unidades : null;
  if (!unidades) {
    kv(b, "Razão social", ctx.empresaNome || "—");
    kv(b, "CNPJ", ctx.empresaCnpj || "—");
  } else {
    unidades.forEach((u, idx) => {
      ensure(b, 26);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      pdf.text(
        `${u.empresa_pai_id ? "Filial" : "Matriz"}: ${u.nome_fantasia || u.nome}`,
        12, b.y + 4,
      );
      pdf.setTextColor(0); b.y += 6;
      if (u.nome_fantasia && u.nome_fantasia !== u.nome) kv(b, "Razão social", u.nome);
      kv(b, "CNPJ", u.cnpj || "—");
      if (u.cnae_principal || u.grau_risco != null) {
        kv(b, "CNAE / Grau de risco",
          `${u.cnae_principal || "—"}${u.grau_risco != null ? `  ·  Grau ${u.grau_risco}` : ""}`);
      }
      const linha1 = [u.logradouro, u.numero].filter(Boolean).join(", ");
      const endDecomposto = [
        [linha1, u.complemento].filter(Boolean).join(" - "),
        u.bairro,
        [u.cidade, u.uf].filter(Boolean).join("/"),
        u.cep,
      ].filter((x) => x && String(x).trim()).join(" · ");
      kv(b, "Endereço", endDecomposto || u.endereco || "—", true);
      if (u.telefone || u.email) {
        kv(b, "Contato", [u.telefone, u.email].filter(Boolean).join("  ·  ") || "—");
      }
      if (idx < unidades.length - 1) b.y += 2;
    });
  }
  if (pgr.qtd_trabalhadores != null) kv(b, "Trabalhadores", String(pgr.qtd_trabalhadores));
  if (pgr.jornada_turnos) kv(b, "Jornada / turnos", pgr.jornada_turnos, true);
  if (pgr.cno) kv(b, "CNO", pgr.cno);
  if (pgr.contratante_nome) {
    kv(b, "Contratante", `${pgr.contratante_nome}${pgr.contratante_cnpj ? ` (${pgr.contratante_cnpj})` : ""}`);
    if (pgr.contrato_numero) kv(b, "Contrato", pgr.contrato_numero);
    if (pgr.local_prestacao) kv(b, "Local de prestação", pgr.local_prestacao, true);
  }
  if (pgr.periodo_ref_inicio || pgr.periodo_ref_fim) {
    kv(b, "Período de referência", `${fmtDate(pgr.periodo_ref_inicio)} a ${fmtDate(pgr.periodo_ref_fim)}`);
  }
  if (pgr.data_levantamento) kv(b, "Data do levantamento", fmtDate(pgr.data_levantamento));
  if (pgr.proxima_revisao) {
    kv(b, "Próxima revisão", `${fmtDate(pgr.proxima_revisao)}${
      pgr.sgsst_certificado ? "  (prazo de 3 anos — organização certificada em SGSST)" : ""}`, true);
  }
  if (pgr.sgsst_certificado) {
    kv(b, "Certificação SGSST",
      [pgr.sgsst_norma, pgr.sgsst_certificadora, pgr.sgsst_validade ? `válida até ${fmtDate(pgr.sgsst_validade)}` : null]
        .filter(Boolean).join("  ·  ") || "Sim", true);
  }

  // Elaboração e habilidade técnica — quem elaborou, revisou e aprovou.
  title(b, "Elaboração e Habilidade Técnica");
  const T = ctx.textos || {};
  const textoHab = (T["elaboracao_habilidade"] || "").trim();
  if (textoHab) para(b, textoHab, 9, [40, 40, 40]);
  const resps = ctx.responsaveis || [];
  if (resps.length === 0) {
    kv(b, "Responsável Técnico", pgr.resp_tec_nome || "—");
    kv(b, "Registro Profissional", pgr.resp_tec_registro || "—");
  } else {
    resps.forEach((r) => {
      ensure(b, 10);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
      pdf.text(`${PAPEL_PDF_LABEL[r.papel] || r.papel}: ${r.nome}`, 12, b.y + 4);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
      const det = [
        r.profissao,
        r.registro_profissional ? `Registro ${r.registro_profissional}${r.uf_registro ? `/${r.uf_registro}` : ""}` : null,
        r.numero_art ? `ART ${r.numero_art}` : null,
      ].filter(Boolean).join("  ·  ");
      if (det) { pdf.text(det, 12, b.y + 8); b.y += 11; } else { b.y += 6; }
    });
  }

  // Textos institucionais editáveis, na ordem do documento oficial.
  // "registro_divulgacao" saiu daqui e foi para o fim: divulgar é o que se faz
  // DEPOIS de o programa existir, não antes de apresentá-lo.
  const secoesTexto: Array<[string, string]> = [
    ["introducao", "Introdução"],
    ["apresentacao", "Apresentação"],
    ["objetivos", "Objetivos"],
    ["objetivo_geral", "Objetivo geral"],
    ["objetivos_especificos", "Objetivos específicos"],
    ["politica_seguranca", "Política de segurança"],
    ["resp_empregador", "Cabe ao empregador"],
    ["resp_empregados", "Cabe aos empregados"],
    ["seguranca_trabalho", "Segurança do Trabalho"],
    ["cipa", "CIPA, quando aplicável"],
    ["consideracoes_preliminares", "Considerações preliminares"],
  ];
  secoesTexto.forEach(([k, tit]) => {
    const conteudo = (T[k] || "").trim();
    if (!conteudo) return;
    title(b, tit);
    para(b, conteudo, 9, [40, 40, 40]);
  });

  title(b, "Escopo");
  kv(b, "Escopo do PGR", pgr.escopo || "—", true);
  title(b, "Critérios e Metodologia de Avaliação");
  kv(b, "Método", pgr.metodologia_avaliacao || "Matriz 5×5 (Severidade × Probabilidade)", true);
  drawMatriz(b);

  // 3. Resumo quantitativo
  title(b, "Resumo quantitativo dos riscos");
  const counts: Record<string, number> = {};
  let semAvaliacao = 0;
  ctx.inventario.forEach((i) => {
    if (i.classificacao) counts[i.classificacao] = (counts[i.classificacao] || 0) + 1;
    else semAvaliacao++;
  });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
  CLASSES_ORDENADAS.forEach((c, i) => {
    pdf.text(`${CLASSIF_LABEL[c]}: ${counts[c] || 0}`, 12 + i * 37, b.y + 4);
  });
  b.y += 9;
  if (semAvaliacao > 0) {
    pdf.setFontSize(8); pdf.setTextColor(100);
    pdf.text(`Itens sem avaliação de severidade/probabilidade: ${semAvaliacao}`, 12, b.y + 2);
    pdf.setTextColor(0); b.y += 6;
  }

  // 4. Inventário por GHE
  title(b, "Inventário de Riscos Ocupacionais");
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
    pdf.text(`GES: ${ctx.ghes[gid] || "Sem GHE"}  (${items.length} riscos)`, 12, b.y + 3);
    pdf.setTextColor(0); b.y += 6;
    items.forEach((i) => {
      ensure(b, 14);
      pdf.setDrawColor(220); pdf.line(12, b.y, 198, b.y);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
      pdf.text(`• ${i.perigo_descricao} [${i.grupo}]`, 12, b.y + 4);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
      const cls = classeLabel(i.classificacao);
      pdf.text(`Sev ${i.severidade} × Prob ${i.probabilidade} = ${i.severidade * i.probabilidade}  ·  ${cls}  ·  ${i.trabalhadores_expostos ?? 0} expostos`, 12, b.y + 8);
      if (i.fonte_geradora) { pdf.text(`Fonte: ${i.fonte_geradora}`, 12, b.y + 11.5); b.y += 14; } else { b.y += 11; }
      if (i.controles_existentes) {
        const ll = pdf.splitTextToSize(`Controles: ${i.controles_existentes}`, 186);
        pdf.text(ll, 12, b.y); b.y += ll.length * 3.3 + 1;
      }
    });
    b.y += 2;
  }

  // Quadro Sinóptico de EPIs
  if (ctx.quadroEpis && ctx.quadroEpis.length > 0) {
    pdf.addPage(); b.y = 15;
    title(b, "Quadro Sinóptico de Utilização de EPIs");
    // Cabeçalho da tabela
    ensure(b, 8);
    pdf.setFillColor(240, 240, 240); pdf.rect(10, b.y, 190, 6, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(30);
    pdf.text("GES", 12, b.y + 4);
    pdf.text("Função", 55, b.y + 4);
    pdf.text("Medida de controle existente", 100, b.y + 4);
    pdf.text("EPIs indicados", 155, b.y + 4);
    b.y += 7;
    pdf.setTextColor(0);
    ctx.quadroEpis.forEach((l) => {
      const gesTxt = pdf.splitTextToSize(`${l.ghe_codigo}\n${l.ghe_nome}`, 41);
      const funcTxt = pdf.splitTextToSize(l.funcao, 43);
      const medTxt = pdf.splitTextToSize(l.medida_controle, 53);
      const epiTxt = pdf.splitTextToSize(l.epis, 43);
      const h = Math.max(gesTxt.length, funcTxt.length, medTxt.length, epiTxt.length) * 3.4 + 3;
      ensure(b, h + 1);
      pdf.setDrawColor(220); pdf.line(10, b.y, 200, b.y);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
      pdf.text(gesTxt, 12, b.y + 3);
      pdf.text(funcTxt, 55, b.y + 3);
      pdf.text(medTxt, 100, b.y + 3);
      pdf.text(epiTxt, 155, b.y + 3);
      b.y += h;
    });
  }

  // 5. Plano de ação 5W2H
  pdf.addPage(); b.y = 15;
  title(b, "Plano de Ação (5W2H)");
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasadas = ctx.acoes.filter((a) => a.prazo && a.prazo < hoje && a.status !== "concluida" && a.status !== "cancelada");
  if (ctx.acoes.length === 0) para(b, "Nenhuma ação registrada.");
  ctx.acoes.forEach((a) => {
    ensure(b, 22);
    pdf.setDrawColor(200); pdf.rect(10, b.y, 190, 0.2, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`• ${a.descricao}`, 12, b.y + 4);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const risco = a.classe_risco ? classeLabel(a.classe_risco) : "—";
    pdf.text(`Status: ${a.status}  ·  Risco: ${risco}  ·  Prazo: ${fmtDate(a.prazo)}  ·  Conclusão: ${fmtDate(a.data_conclusao)}`, 12, b.y + 8);
    const linhas = [
      a.what && `What: ${a.what}`,
      a.why && `Why: ${a.why}`,
      a.who && `Who: ${a.who}`,
      a.where_local && `Where: ${a.where_local}`,
      a.prazo && `When: até ${fmtDate(a.prazo)}`,
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
    // Cronograma mensal — mini-tabela JAN..DEZ com "X" nos meses previstos,
    // no formato da planilha 5W2H do cliente.
    const meses: number[] = (a as any).meses_execucao || [];
    if (meses.length > 0) {
      ensure(b, 12);
      const cw = 14.5, x0 = 12, yTop = b.y + 1;
      pdf.setFontSize(6); pdf.setFont("helvetica", "normal");
      MESES_PDF.forEach((m, i) => {
        const x = x0 + i * cw;
        const marcado = meses.includes(i + 1);
        pdf.setDrawColor(190);
        if (marcado) { pdf.setFillColor(15, 23, 42); pdf.rect(x, yTop, cw, 7, "F"); }
        else pdf.rect(x, yTop, cw, 7, "S");
        pdf.setTextColor(marcado ? 255 : 90);
        pdf.text(m, x + cw / 2, yTop + 3, { align: "center" });
        if (marcado) pdf.text("X", x + cw / 2, yTop + 6, { align: "center" });
        pdf.setTextColor(0);
      });
      b.y = yTop + 9;
    }

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
  title(b, "Apêndice A — Ações atrasadas");
  if (atrasadas.length === 0) para(b, "Nenhuma ação atrasada.");
  else atrasadas.forEach((a) => {
    ensure(b, 6);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    pdf.text(`• ${a.descricao} — prazo ${fmtDate(a.prazo)} — ${a.status}`, 12, b.y + 3);
    b.y += 5;
  });

  // 7. Revisões
  title(b, "Apêndice B — Histórico de revisões");
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
  title(b, "Assinaturas");
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

  // Seções finais (textos padrão editáveis)
  // Preparação e resposta a emergências (Etapa 7), antes das seções de fecho.
  if (ctx.cenarios && ctx.cenarios.length > 0) {
    title(b, "Preparação e Resposta a Emergências");
    ctx.cenarios.forEach((c) => {
      ensure(b, 16);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
      pdf.text(`• ${c.nome}${c.grande_magnitude ? "  (grande magnitude)" : ""}`, 12, b.y + 4);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
      b.y += 6;
      const campos: Array<[string, string | null | undefined]> = [
        ["Procedimento de resposta", c.procedimento_resposta],
        ["Primeiros socorros", c.primeiros_socorros],
        ["Meios e recursos", c.meios_recursos],
        ["Responsáveis", c.responsaveis],
        ["Abandono / ponto de encontro", c.abandono_ponto_encontro],
        ["Simulados", [c.periodicidade_simulado,
          c.ultimo_simulado ? `último em ${fmtDate(c.ultimo_simulado)}` : null]
          .filter(Boolean).join("  ·  ") || null],
      ];
      campos.forEach(([rot, val]) => {
        if (!val) return;
        const ll = pdf.splitTextToSize(`${rot}: ${val}`, 184);
        ensure(b, ll.length * 3.5 + 2);
        pdf.text(ll, 14, b.y); b.y += ll.length * 3.3 + 1;
      });
      b.y += 2;
    });
  }

  const secoesFim: Array<[string, string]> = [
    ["area_abrangencia", "Área de abrangência do PGR na empresa"],
    // Divulgar é o que se faz DEPOIS de o programa existir: esta seção estava
    // no início do documento, antes mesmo da apresentação.
    ["registro_divulgacao", "Registro e Divulgação dos Dados"],
    ["recomendacoes", "Recomendações à empresa"],
    ["consideracoes_finais", "Considerações finais"],
    ["encerramento", "Encerramento"],
  ];
  secoesFim.forEach(([k, tit]) => {
    const conteudo = ((ctx.textos || {})[k] || "").trim();
    if (!conteudo) return;
    title(b, tit);
    para(b, conteudo, 9, [40, 40, 40]);
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

  const up = await uploadDocumentoSeguro({
    empresa_id: (pgr as any).empresa_id,
    kind: "pdf",
    modulo: "pgr",
    documento_id: pgr.id,
    versao: proxVersao,
    fileName,
    blob,
    driveFolderFallback: `PGR/v${pgr.versao}/Documento`,
  });

  const { data, error } = await (supabase.rpc as any)("pgr_pdf_registrar", {
    _pgr_id: pgr.id,
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

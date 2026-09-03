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
  /** Caracterização da estrutura, vinda do Núcleo Mestre. */
  ambientes?: any[];
  processos?: any[];
  setores?: any[];
  gesDetalhes?: any[];
  funcoes?: any[];
  atividades?: any[];
  /** Logomarca em data URL — jsPDF não busca imagem por http. */
  logoDataUrl?: string | null;
  /** Código interno do documento, impresso na capa e no rodapé. */
  codigoDocumento?: string | null;
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
/** Dinheiro no formato daqui: R$ 18.000,00. */
const fmtMoeda = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ItemSumario { titulo: string; pagina: number; }
interface B { doc: jsPDF; y: number; toc: ItemSumario[]; }
const ensure = (b: B, h: number) => { if (b.y + h > 278) { b.doc.addPage(); b.y = 15; } };

/**
 * Abre uma seção e registra a página no sumário.
 *
 * O número é anotado DEPOIS do `ensure`: se o título não coubesse na página
 * atual, ele salta para a próxima e o sumário apontaria a página errada.
 */
function title(b: B, t: string) {
  ensure(b, 10);
  b.toc.push({ titulo: t, pagina: b.doc.getCurrentPageInfo().pageNumber });
  b.doc.setFillColor(15, 23, 42); b.doc.rect(10, b.y, 190, 6, "F");
  b.doc.setTextColor(255); b.doc.setFontSize(10); b.doc.setFont("helvetica", "bold");
  b.doc.text(t, 12, b.y + 4.2); b.doc.setTextColor(0); b.y += 8;
}

/** Subtítulo dentro de uma seção — não entra no sumário. */
function sub(b: B, t: string) {
  ensure(b, 8);
  b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(9); b.doc.setTextColor(15, 23, 42);
  b.doc.text(t, 12, b.y + 4); b.doc.setTextColor(0); b.y += 7;
}

/**
 * Cabeçalho de tabela que se repete a cada quebra de página.
 *
 * Devolve a função que desenha uma linha garantindo a repetição: sem isso, uma
 * tabela de 80 riscos vira 3 páginas de números sem nome de coluna.
 */
function tabela(b: B, colunas: { rotulo: string; x: number; w: number }[]) {
  const desenhaCabecalho = () => {
    b.doc.setFillColor(240, 240, 240); b.doc.rect(10, b.y, 190, 6, "F");
    b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(7.5); b.doc.setTextColor(30);
    colunas.forEach((c) => b.doc.text(c.rotulo, c.x, b.y + 4));
    b.doc.setTextColor(0); b.y += 7;
  };
  desenhaCabecalho();
  return (celulas: string[]) => {
    const textos = colunas.map((c, i) => b.doc.splitTextToSize(celulas[i] ?? "—", c.w));
    const h = Math.max(...textos.map((t) => t.length)) * 3.4 + 3;
    if (b.y + h > 278) { b.doc.addPage(); b.y = 15; desenhaCabecalho(); }
    b.doc.setDrawColor(225); b.doc.line(10, b.y, 200, b.y);
    b.doc.setFont("helvetica", "normal"); b.doc.setFontSize(7.5);
    textos.forEach((t, i) => b.doc.text(t, colunas[i].x, b.y + 3.5));
    b.y += h;
  };
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
  /*
   * Sem a seta "→": a fonte padrao do jsPDF e WinAnsi, que nao tem esse
   * caractere. Ele nao saia como seta — saia como lixo ("!'"), e ainda
   * embaralhava o espacamento do resto da frase. O mesmo valia para o "≤" da
   * legenda abaixo. Os numeros 1 a 5 ja estao desenhados no eixo.
   */
  b.doc.text("Probabilidade", x0 + 35, y0 + 5 * cs + 9, { align: "center" });
  b.doc.text("Sev.", x0 - 8, y0 + 35, { align: "center" });

  /*
   * A legenda sai da MESMA regra que pinta as celulas e que classifica os
   * itens do inventario (classificarRisco, que replica a funcao do banco).
   *
   * Antes era uma lista escrita a mao com quatro classes inventadas — "Baixo
   * (<=4)", "Moderado (<=9)", "Alto (<=16)", "Critico (>16)" — que nao existem
   * em lugar nenhum do sistema. As classes de verdade sao cinco (Trivial,
   * Toleravel, Moderado, Substancial, Intoleravel) e as faixas sao outras. O
   * resultado: na mesma pagina, a legenda dizia "Alto" para a celula 15 e o
   * quadro logo abaixo contava esse mesmo item como "Substancial", com cor que
   * nao correspondia a nenhuma linha da legenda. Num documento tecnico isso e
   * a escala descrevendo errado o proprio desenho.
   *
   * Escrita assim, mexer na regra de classificacao nao deixa a legenda para
   * tras — ela e derivada, nao copiada.
   */
  const faixas = new Map<PgrClasse, number[]>();
  for (let sev = 1; sev <= 5; sev++) {
    for (let prob = 1; prob <= 5; prob++) {
      const c = classificarMatriz(sev, prob);
      if (!c) continue;
      if (!faixas.has(c)) faixas.set(c, []);
      faixas.get(c)!.push(sev * prob);
    }
  }
  const legX = x0 + 5 * cs + 8;
  const ordem: PgrClasse[] = ["trivial", "toleravel", "moderado", "substancial", "intoleravel"];
  ordem.filter((c) => faixas.has(c)).forEach((c, i) => {
    const valores = faixas.get(c)!;
    const menor = Math.min(...valores), maior = Math.max(...valores);
    const [r, g, bl] = CLASSE_HEX[c];
    b.doc.setFillColor(r, g, bl);
    b.doc.rect(legX, y0 + i * 8, 5, 5, "F");
    b.doc.setTextColor(0); b.doc.setFontSize(8);
    b.doc.text(`${CLASSIF_LABEL[c]} (${menor === maior ? menor : `${menor} a ${maior}`})`, legX + 7, y0 + i * 8 + 4);
  });
  b.y = y0 + 5 * cs + 14;
}

/**
 * Monta o documento sem gravar nada. Útil para pré-visualizar e para testar a
 * paginação sem depender de Storage nem de banco.
 */
export async function renderPgrPdf(
  ctx: PgrPdfContext,
  opts: { qrUrl: string; pdfVersao: number; comMarca: boolean },
): Promise<jsPDF> {
  return render(ctx, opts);
}

async function render(ctx: PgrPdfContext, opts: { qrUrl: string; pdfVersao: number; comMarca: boolean }): Promise<jsPDF> {
  const { doc: pgr } = ctx;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const b: B = { doc: pdf, y: 12, toc: [] };

  // CAPA
  pdf.setFillColor(15, 23, 42); pdf.rect(0, 0, 210, 65, "F");
  // Logomarca da empresa, quando houver. Falha de imagem não pode derrubar a
  // geração do documento inteiro — o PGR sai sem logo, e sai.
  if (ctx.logoDataUrl) {
    try { pdf.addImage(ctx.logoDataUrl, "PNG", 12, 8, 26, 26); }
    catch { /* logo inválida: segue sem ela */ }
  }
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
  if (ctx.codigoDocumento) { pdf.text(`Código do documento: ${ctx.codigoDocumento}`, 12, b.y); b.y += 5; }
  b.y += 4;
  /*
   * O `||` de antes nunca entrava em acao: sem data de emissao, `fmtDate`
   * devolve "—", que e texto valido — o lado direito era codigo morto e a capa
   * saia com "Emitido em: —". A alternativa e testar o dado, nao o texto dele.
   */
  pdf.text(`Emitido em: ${fmtDate(pgr.data_emissao || new Date().toISOString())}`, 12, b.y); b.y += 5;
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

  title(b, "Abrangência");
  kv(b, "Escopo do PGR", pgr.escopo || "—", true);
  if ((T["area_abrangencia"] || "").trim()) para(b, T["area_abrangencia"], 9, [40, 40, 40]);

  // Referências normativas. Lista fixa das normas que regem o documento — não é
  // dado da empresa, é o arcabouço legal, igual em qualquer PGR.
  title(b, "Referências");
  [
    "NR-01 — Disposições Gerais e Gerenciamento de Riscos Ocupacionais",
    "NR-04 — Serviços Especializados em Segurança e em Medicina do Trabalho",
    "NR-05 — Comissão Interna de Prevenção de Acidentes e de Assédio",
    "NR-06 — Equipamento de Proteção Individual",
    "NR-07 — Programa de Controle Médico de Saúde Ocupacional",
    "NR-09 — Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos",
    "NR-15 — Atividades e Operações Insalubres",
    "NR-16 — Atividades e Operações Perigosas",
    "NR-17 — Ergonomia",
    "Lei nº 8.213/1991 e Decreto nº 3.048/1999 — legislação previdenciária",
  ].forEach((r) => { ensure(b, 5); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    pdf.text(`• ${r}`, 12, b.y + 3); b.y += 4.4; });
  b.y += 2;

  title(b, "Definições");
  ([
    ["Perigo", "Fonte com potencial de causar lesão ou agravo à saúde."],
    ["Risco ocupacional", "Combinação da probabilidade de ocorrer um evento perigoso com a severidade da lesão ou agravo que ele pode causar."],
    ["Fonte geradora", "Elemento, equipamento ou condição de onde o perigo se origina."],
    ["Circunstância", "Situação em que o perigo se manifesta, ainda que a fonte esteja controlada."],
    ["GES / GHE", "Grupo de trabalhadores que experimentam exposição semelhante, de modo que o resultado da avaliação de um representa a exposição de todos. Não é sinônimo de setor."],
    ["Risco residual", "Risco que permanece após a implantação das medidas de prevenção."],
    ["Medida de prevenção", "Ação adotada para eliminar o perigo ou reduzir o risco, seguindo a hierarquia da NR-01."],
    ["Inventário de riscos", "Relação consolidada dos riscos identificados, avaliados e classificados."],
  ] as [string, string][]).forEach(([termo, def]) => {
    ensure(b, 9);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text(`${termo}:`, 12, b.y + 3);
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(60);
    const ll = pdf.splitTextToSize(def, 186 - 2);
    pdf.text(ll, 14, b.y + 7); pdf.setTextColor(0);
    b.y += 7 + ll.length * 3.3 + 1;
  });

  // ── Caracterização da estrutura ────────────────────────────────────────────
  if (ctx.ambientes && ctx.ambientes.length > 0) {
    title(b, "Caracterização dos Ambientes de Trabalho");
    ctx.ambientes.forEach((a: any) => {
      sub(b, a.codigo ? `${a.codigo} — ${a.nome}` : a.nome);
      const campos: [string, any][] = [
        ["Tipo", a.tipo_ambiente], ["Localização", a.localizacao],
        ["Área aproximada", a.area_m2 ? `${a.area_m2} m²` : null],
        ["Pé-direito", a.pe_direito], ["Piso", a.piso], ["Paredes", a.paredes],
        ["Cobertura", a.cobertura], ["Ventilação", a.ventilacao],
        ["Iluminação", a.iluminacao], ["Climatização", a.climatizacao],
        ["Máquinas e instalações", a.maquinas_instalacoes],
        ["Trabalhadores", a.qtd_trabalhadores],
      ];
      const linha = campos.filter(([, v]) => v != null && String(v).trim())
        .map(([r, v]) => `${r}: ${v}`).join("  ·  ");
      if (linha) para(b, linha, 8);
      if (a.descricao) para(b, a.descricao, 8);
      b.y += 1;
    });
  }

  if (ctx.processos && ctx.processos.length > 0) {
    title(b, "Processos de Trabalho");
    const setorNome = (id: string) =>
      (ctx.setores || []).find((s: any) => s.id === id)?.nome || "—";
    // Sem a coluna "Máquinas e produtos": os campos que a alimentavam saíram do
    // cadastro de Processo, então ela sairia "—" em toda linha. A largura foi
    // para "Etapas / descrição", que é o conteúdo que interessa aqui.
    const linha = tabela(b, [
      { rotulo: "Processo", x: 12, w: 42 },
      { rotulo: "Setor", x: 57, w: 30 },
      { rotulo: "Etapas / descrição", x: 90, w: 107 },
    ]);
    ctx.processos.forEach((p: any) => linha([
      p.codigo ? `${p.codigo} — ${p.nome}` : p.nome,
      setorNome(p.setor_id),
      p.descricao_etapas || "—",
    ]));
    b.y += 3;
  }

  if ((ctx.setores && ctx.setores.length > 0) || (ctx.gesDetalhes && ctx.gesDetalhes.length > 0)) {
    title(b, "Setores e Grupos de Exposição Semelhante");
    if (ctx.setores && ctx.setores.length > 0) {
      sub(b, "Setores");
      const linha = tabela(b, [
        { rotulo: "Setor", x: 12, w: 45 },
        { rotulo: "Responsável", x: 60, w: 40 },
        { rotulo: "Trabalhadores", x: 103, w: 22 },
        { rotulo: "Jornada / turnos", x: 128, w: 68 },
      ]);
      ctx.setores.forEach((s: any) => linha([
        s.codigo ? `${s.codigo} — ${s.nome}` : s.nome,
        s.responsavel_setor || "—",
        s.qtd_trabalhadores != null ? String(s.qtd_trabalhadores) : "—",
        [s.jornada_turnos, s.turnos].filter(Boolean).join(" · ") || "—",
      ]));
      b.y += 3;
    }
    if (ctx.gesDetalhes && ctx.gesDetalhes.length > 0) {
      sub(b, "Grupos de Exposição Semelhante (GES/GHE)");
      ctx.gesDetalhes.forEach((g: any) => {
        ensure(b, 12);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5);
        pdf.text(`${g.codigo ? g.codigo + " — " : ""}${g.nome}`, 12, b.y + 3);
        b.y += 5;
        const meta = [
          g.qtd_trabalhadores != null ? `${g.qtd_trabalhadores} trabalhador(es)` : null,
          g.jornada, g.frequencia_exposicao,
        ].filter(Boolean).join("  ·  ");
        if (meta) para(b, meta, 8);
        // O critério é o que distingue GES de setor. Quando falta, o documento
        // precisa dizer que falta — não pode simplesmente omitir a linha.
        para(b,
          `Critério de agrupamento: ${g.justificativa_similaridade || g.criterio_agrupamento
            || "não declarado — pendente de justificativa técnica"}`, 8);
        b.y += 1;
      });
    }
  }

  if (ctx.funcoes && ctx.funcoes.length > 0) {
    title(b, "Funções e Atividades");
    const setorNome = (id: string) =>
      (ctx.setores || []).find((s: any) => s.id === id)?.nome || "—";
    ctx.funcoes.forEach((f: any) => {
      ensure(b, 12);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5);
      pdf.text(`${f.nome}${f.cbo ? `  (CBO ${f.cbo})` : ""}`, 12, b.y + 3);
      b.y += 5;
      const meta = [
        `Setor: ${setorNome(f.setor_id)}`,
        f.qtd_trabalhadores != null ? `${f.qtd_trabalhadores} trabalhador(es)` : null,
        f.jornada, f.turnos,
        [f.exige_nr10 && "NR-10", f.exige_nr33 && "NR-33", f.exige_nr35 && "NR-35"]
          .filter(Boolean).join(", ") || null,
      ].filter(Boolean).join("  ·  ");
      para(b, meta, 8);
      if (f.descricao_atividades) para(b, f.descricao_atividades, 8);
      const ats = (ctx.atividades || []).filter((a: any) => a.funcao_id === f.id);
      ats.forEach((a: any) => {
        const det = [
          a.caracteristica, a.frequencia, a.duracao, a.postura_esforco,
          a.trabalhadores_envolvidos != null ? `${a.trabalhadores_envolvidos} envolvido(s)` : null,
        ].filter(Boolean).join(" · ");
        para(b, `– ${a.nome}${det ? `  (${det})` : ""}`, 8);
      });
      b.y += 1;
    });
  }

  title(b, "Metodologia de Avaliação");
  kv(b, "Método", pgr.metodologia_avaliacao || "Matriz 5×5 (Severidade × Probabilidade)", true);
  title(b, "Critérios da Matriz");
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
      // Item sem avaliação imprimia "Sev null × Prob null = 0", que num documento
      // legal sugere risco nulo. Sem nota, o texto diz que a avaliação falta.
      const temAval = i.severidade != null && i.probabilidade != null;
      const aval = temAval
        ? `Sev ${i.severidade} × Prob ${i.probabilidade} = ${i.severidade * i.probabilidade}  ·  ${cls}`
        : "Sem avaliação de severidade e probabilidade";
      pdf.text(`${aval}  ·  ${i.trabalhadores_expostos ?? 0} expostos`, 12, b.y + 8);
      if (i.fonte_geradora) { pdf.text(`Fonte: ${i.fonte_geradora}`, 12, b.y + 11.5); b.y += 14; } else { b.y += 11; }
      const controles = Array.isArray(i.controles_existentes)
        ? i.controles_existentes.join("; ")
        : i.controles_existentes;
      if (controles) {
        const ll = pdf.splitTextToSize(`Controles: ${controles}`, 186);
        pdf.text(ll, 12, b.y); b.y += ll.length * 3.3 + 1;
      }
    });
    b.y += 2;
  }

  // Quadro Sinóptico de EPIs
  if (ctx.quadroEpis && ctx.quadroEpis.length > 0) {
    pdf.addPage(); b.y = 15;
    title(b, "Quadro Sinóptico de Utilização de EPIs");
    // Cabeçalho repetido a cada quebra: o quadro costuma passar de uma página,
    // e sem repetir ninguém sabe qual coluna é "medida" e qual é "EPI".
    const linha = tabela(b, [
      { rotulo: "GES", x: 12, w: 41 },
      { rotulo: "Função", x: 55, w: 43 },
      { rotulo: "Medida de controle existente", x: 100, w: 53 },
      { rotulo: "EPIs indicados", x: 155, w: 43 },
    ]);
    ctx.quadroEpis.forEach((l) => linha([
      `${l.ghe_codigo}\n${l.ghe_nome}`, l.funcao, l.medida_controle, l.epis,
    ]));
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
      // `toFixed` escreve no formato americano: "R$ 18000.00". Num documento em
      // português, com valores que chegam à casa dos milhares, isso se lê
      // errado — o ponto vira separador de milhar aos olhos de quem assina.
      a.how_much != null && `How much: ${fmtMoeda(a.how_much)}`,
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

  // Monitoramento e revisão: quando o programa precisa ser reavaliado. Sai dos
  // campos reais do documento — periodicidade legal e gatilhos registrados.
  title(b, "Monitoramento e Revisão");
  kv(b, "Próxima revisão prevista", fmtDate(pgr.proxima_revisao));
  kv(b, "Periodicidade máxima", pgr.sgsst_certificado
    ? "3 anos — organização certificada em sistema de gestão de SST"
    : "2 anos — NR-01 item 1.5.4.4.5");
  if (pgr.sgsst_certificado) {
    kv(b, "Certificação", [pgr.sgsst_norma, pgr.sgsst_certificadora,
      pgr.sgsst_validade ? `válida até ${fmtDate(pgr.sgsst_validade)}` : null]
      .filter(Boolean).join("  ·  ") || "—", true);
  }
  para(b,
    "O programa é revisado antes do prazo sempre que ocorrer: alteração de processo, ambiente, "
    + "máquina, produto, função ou atividade; acidente ou doença relacionada ao trabalho; "
    + "constatação de ineficácia das medidas adotadas; alteração de requisito legal; resultado "
    + "de avaliação ambiental que modifique a classificação de risco; mudança significativa na "
    + "organização do trabalho; identificação de novos fatores psicossociais; ou por determinação "
    + "da fiscalização ou do responsável técnico.", 8);

  const secoesFim: Array<[string, string]> = [
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

  // Assinaturas fecham o documento, depois do encerramento — assinar é o
  // último ato, não algo que acontece no meio do texto.
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


  // ANEXOS. Conteúdo de auditoria interna, separado do corpo do documento.
  pdf.addPage(); b.y = 15;
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
      // "de v1 para v2" e nao "v1→v2": a fonte padrao nao desenha a seta.
      (r.versao_anterior != null && r.versao_nova != null ? ` · de v${r.versao_anterior} para v${r.versao_nova}` : "") +
      (r.user_email ? ` · ${r.user_email}` : "") + (r.motivo ? ` — ${r.motivo}` : "");
    const ll = pdf.splitTextToSize(linha, 186);
    pdf.text(ll, 12, b.y + 3); b.y += 3 + ll.length * 3.2;
  });



  // ── SUMÁRIO ───────────────────────────────────────────────────────────────
  // Só dá para montar depois de tudo renderizado: antes disso não se sabe em que
  // página cada seção caiu. A página é inserida na posição 2 (logo após a capa),
  // o que empurra todo o resto — por isso cada número anotado ganha +1.
  if (b.toc.length > 0) {
    pdf.insertPage(2);
    pdf.setPage(2);
    const s: B = { doc: pdf, y: 15, toc: [] };
    pdf.setFillColor(15, 23, 42); pdf.rect(10, s.y, 190, 6, "F");
    pdf.setTextColor(255); pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
    pdf.text("Sumário", 12, s.y + 4.2); pdf.setTextColor(0); s.y += 11;

    b.toc.forEach((item) => {
      if (s.y > 272) { return; }
      const pagina = String(item.pagina + 1);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(30);
      const titulo = pdf.splitTextToSize(item.titulo, 160)[0];
      pdf.text(titulo, 12, s.y);
      const larguraTitulo = pdf.getTextWidth(titulo);
      const larguraPagina = pdf.getTextWidth(pagina);
      // Linha pontilhada ligando título e página, para o olho não se perder.
      pdf.setTextColor(170);
      const inicio = 12 + larguraTitulo + 2;
      const fim = 198 - larguraPagina - 2;
      if (fim > inicio) {
        const pontos = ".".repeat(Math.max(0, Math.floor((fim - inicio) / pdf.getTextWidth("."))));
        pdf.text(pontos, inicio, s.y);
      }
      pdf.setTextColor(30);
      pdf.text(pagina, 198, s.y, { align: "right" });
      s.y += 5.4;
    });
    pdf.setTextColor(0);
  }

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

/**
 * Abre o PDF numa aba, sem gravar nada.
 *
 * O caminho de sempre (`generateAndUploadPgrPdf`) faz muito mais do que
 * desenhar: sobe o arquivo para o Drive, consome um numero de versao de PDF e
 * registra a versao no banco. Para quem so quer CONFERIR como o rascunho vai
 * sair antes de publicar, isso e caro e deixa rastro — cada olhada viraria uma
 * versao a mais na lista, com pedido de MFA no meio.
 *
 * Aqui o documento e o MESMO: mesma funcao de desenho, mesma marca d'agua de
 * rascunho. So nao existe depois de fechada a aba.
 */
export async function previsualizarPgrPdf(ctx: PgrPdfContext): Promise<void> {
  const { doc: pgr } = ctx;
  const comMarca = pgr.status === "rascunho" || pgr.status === "em_revisao";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // A proxima versao ainda NAO existe: e so o que sairia impresso se a pessoa
  // gerasse agora. Nada e reservado no banco por causa desta conferida.
  const { data: ultimaV } = await (supabase.from as any)("pgr_pdf_versoes")
    .select("pdf_versao").eq("pgr_id", pgr.id).order("pdf_versao", { ascending: false }).limit(1).maybeSingle();
  const proxVersao = ((ultimaV?.pdf_versao as number | undefined) ?? 0) + 1;

  const pdf = await render(ctx, {
    qrUrl: `${origin}/pgr/validar/${pgr.id}?v=${proxVersao}`,
    pdfVersao: proxVersao,
    comMarca,
  });
  const url = URL.createObjectURL(pdf.output("blob"));
  window.open(url, "_blank", "noopener,noreferrer");
  // Solta o endereco depois de o navegador ter tido tempo de abrir a aba; sem
  // isso o binario do PDF fica preso na memoria ate a aba principal fechar.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

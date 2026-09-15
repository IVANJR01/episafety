// PGR Parte 5 — PDF técnico interno + assinatura visual + QR Code
// Storage: Supabase Storage privado (default) ou Google Drive BYOK (opcional).
// Banco recebe apenas hash SHA-256 + bucket/path + tamanho — nunca o binário.
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { uploadDocumentoSeguro } from "@/lib/secureStorage";
import { PgrDocumento, PGR_STATUS_LABEL } from "@/lib/pgrTypes";
import {
  B, MARGEM, LARGURA, capaTimbrada, ensure, fmtDT, fmtDate, kv, para,
  rodapePaginas, sub, sumario, tabela, title,
} from "@/lib/pdfTimbrado";
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
  /* Vieram com a tabela do inventário e não estavam declarados: o `any`
     implícito escondia erro de digitação em nome de coluna. */
  setor_id?: string | null;
  lesoes?: string | null;
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

/**
 * O número de revisão impresso na capa.
 *
 * Sem revisão registrada o documento está na elaboração, que é a revisão 00 —
 * e é assim que o Controle de Revisões logo adiante já a chama. Duas casas
 * porque é como a norma pede e como o mercado imprime: "REV. 00".
 */
export function numeroDaRevisao(revisoes?: { created_at: string }[] | null): string {
  return String(revisoes?.length ?? 0).padStart(2, "0");
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
  /** Matriz + filiais, para a seção de identificação. */
  unidades?: PgrUnidadeItem[];
  responsaveis?: PgrResponsavelItem[];
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
  /**
   * Rodapé da capa: quem elaborou o documento.
   *
   * A capa leva a marca da empresa COBERTA no alto e o crédito de quem
   * ELABOROU embaixo — são pessoas jurídicas diferentes, e misturar as duas
   * faz o documento parecer emitido por quem não o emitiu.
   */
  emissorNome?: string | null;
  emissorLinhas?: string[] | null;
  emissorLogoDataUrl?: string | null;
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
const fmtMoeda = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

/**
 * Desenha o documento inteiro. Exportada para o teste conseguir olhar o que
 * saiu impresso sem subir arquivo nem consumir número de versão.
 */
export async function render(ctx: PgrPdfContext, opts: { qrUrl: string; pdfVersao: number; comMarca: boolean }): Promise<jsPDF> {
  const { doc: pgr } = ctx;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const b: B = { doc: pdf, y: 12, toc: [] };

  capaTimbrada(pdf, {
    logoDataUrl: ctx.logoDataUrl,
    revisao: `REV. ${numeroDaRevisao(ctx.revisoes)}`,
    meta: `PGR v${pgr.versao} · PDF v${opts.pdfVersao} · ${PGR_STATUS_LABEL[pgr.status]}`,
    sigla: "PGR",
    titulo: "Programa de Gerenciamento de Riscos",
    subtitulo: "Inventário de Riscos e Plano de Ação",
    nota: "Documento técnico — NR-01",
    empresaNome: ctx.empresaNome || "Empresa",
    identificacao: [
      ctx.empresaCnpj ? `CNPJ: ${ctx.empresaCnpj}` : null,
      ctx.unidadeNome ? `Unidade: ${ctx.unidadeNome}` : null,
      ctx.codigoDocumento ? `Código do documento: ${ctx.codigoDocumento}` : null,
    ].filter(Boolean) as string[],
    /*
     * O `||` de antes nunca entrava em ação: sem data de emissão, `fmtDate`
     * devolve "—", que é texto válido — o lado direito era código morto e a
     * capa saía com "Emitido em: —". A alternativa é testar o dado, não o
     * texto dele.
     */
    /*
     * Campo sem dado não vai para a capa.
     *
     * Saía "Vigência: — a —" e "Registro Profissional: —" na primeira página
     * de um documento que vai para fiscalização: travessão ali não informa
     * nada e faz o documento parecer abandonado no meio do preenchimento. O
     * que falta aparece nas pendências, antes de publicar.
     */
    dados: [
      `Emitido em: ${fmtDate(pgr.data_emissao || new Date().toISOString())}`,
      pgr.data_vigencia_inicio && pgr.data_vigencia_fim
        ? `Vigência: ${fmtDate(pgr.data_vigencia_inicio)} a ${fmtDate(pgr.data_vigencia_fim)}`
        : null,
      pgr.resp_tec_nome ? `Responsável Técnico: ${pgr.resp_tec_nome}` : null,
      pgr.resp_tec_registro ? `Registro Profissional: ${pgr.resp_tec_registro}` : null,
    ].filter(Boolean) as string[],
  });

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

  const T = ctx.textos || {};

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

  // ── Caracterização da estrutura ────────────────────────────────────────────
  if (ctx.ambientes && ctx.ambientes.length > 0) {
    title(b, "Caracterização dos Ambientes de Trabalho");
    /*
     * Tabela, e não uma ficha por ambiente.
     *
     * Em prosa, cada ambiente gastava título, linha de características, uma
     * linha em branco e um parágrafo: perto de 30 mm por ambiente. Com 22
     * ambientes, a seção sozinha ocupava três páginas e meia do PGR, e quem
     * precisa comparar dois ambientes tinha que folhear. Aqui a mesma
     * informação — toda ela, nada resumido — entra numa linha por ambiente,
     * com o cabeçalho repetido a cada quebra de página.
     */
    /*
     * Duas colunas, e a segunda larga.
     *
     * A primeira tentativa foi três colunas — nome, características,
     * descrição — e medindo o resultado ela ocupava exatamente o mesmo
     * espaço da prosa: 7 ambientes por página nos dois casos. O que gasta
     * altura não é o formato, é a largura: o mesmo parágrafo quebrado em 86
     * mm ocupa o dobro de linhas que em 164 mm. Juntar as duas colunas de
     * texto foi o que de fato encolheu a seção.
     */
    const linhaAmb = tabela(b, [
      { rotulo: "Ambiente", x: 12, w: 32 },
      { rotulo: "Características e descrição", x: 46, w: 152 },
    ]);
    ctx.ambientes.forEach((a: any) => {
      const campos: [string, any][] = [
        ["Tipo", a.tipo_ambiente], ["Localização", a.localizacao],
        ["Área", a.area_m2 ? `${a.area_m2} m²` : null],
        ["Pé-direito", a.pe_direito], ["Piso", a.piso], ["Paredes", a.paredes],
        ["Cobertura", a.cobertura], ["Ventilação", a.ventilacao],
        ["Iluminação", a.iluminacao], ["Climatização", a.climatizacao],
        ["Máquinas e instalações", a.maquinas_instalacoes],
        ["Trabalhadores", a.qtd_trabalhadores],
      ];
      const caracteristicas = campos
        .filter(([, v]) => v != null && String(v).trim())
        .map(([r, v]) => `${r}: ${v}`)
        .join("  ·  ");
      linhaAmb([
        a.codigo ? `${a.codigo} — ${a.nome}` : a.nome,
        [caracteristicas, a.descricao].filter(Boolean).join("\n") || "—",
      ]);
    });
    b.y += 3;
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
    /*
     * Mesmo tratamento dos ambientes, pelo mesmo motivo: em prosa, 40 funções
     * viravam cinco páginas em que cada função repetia o mesmo formato de
     * "nome / setor / parágrafo". Em tabela, a lista de funções é o que ela
     * é — uma lista.
     */
    const linhaFun = tabela(b, [
      { rotulo: "Função", x: 12, w: 32 },
      { rotulo: "Setor, jornada e atividades", x: 46, w: 152 },
    ]);
    ctx.funcoes.forEach((f: any) => {
      const meta = [
        setorNome(f.setor_id),
        f.qtd_trabalhadores != null ? `${f.qtd_trabalhadores} trabalhador(es)` : null,
        f.jornada, f.turnos,
        [f.exige_nr10 && "NR-10", f.exige_nr33 && "NR-33", f.exige_nr35 && "NR-35"]
          .filter(Boolean).join(", ") || null,
      ].filter(Boolean).join("  ·  ");
      const ats = (ctx.atividades || []).filter((a: any) => a.funcao_id === f.id);
      const detalhes = ats.map((a: any) => {
        const det = [
          a.caracteristica, a.frequencia, a.duracao, a.postura_esforco,
          a.trabalhadores_envolvidos != null ? `${a.trabalhadores_envolvidos} envolvido(s)` : null,
        ].filter(Boolean).join(" · ");
        return `– ${a.nome}${det ? `  (${det})` : ""}`;
      });
      linhaFun([
        `${f.nome}${f.cbo ? `\n(CBO ${f.cbo})` : ""}`,
        [meta, f.descricao_atividades, ...detalhes].filter(Boolean).join("\n") || "—",
      ]);
    });
    b.y += 3;
  }

  title(b, "Metodologia de Avaliação");
  kv(b, "Método", pgr.metodologia_avaliacao || "Matriz 5×5 (Severidade × Probabilidade)", true);
  title(b, "Critérios da Matriz");
  drawMatriz(b);

  // Inventário de riscos — 1.5.7.1 "a" da NR-01.
  title(b, "Inventário de Riscos Ocupacionais");

  if (ctx.inventario.length === 0) {
    para(b, "Nenhum item de inventário registrado.");
  } else {
    // Para caber no formato A4 retrato (190mm úteis), combinamos campos afins.
    const addLinha = tabela(b, [
      { rotulo: "GES / Expostos", x: 12, w: 30 },
      { rotulo: "Perigo / Fonte", x: 44, w: 40 },
      { rotulo: "Lesões", x: 86, w: 35 },
      { rotulo: "Controles", x: 123, w: 45 },
      { rotulo: "Avaliação", x: 170, w: 28 },
    ]);

    // Ordena por GHE para manter os itens do mesmo grupo próximos
    const itensOrdenados = [...ctx.inventario].sort((a, b) => 
      (ctx.ghes[a.ghe_id || ""] || "").localeCompare(ctx.ghes[b.ghe_id || ""] || "")
    );

    itensOrdenados.forEach((i) => {
      const ges = ctx.ghes[i.ghe_id || ""] || "Sem GES";
      const setor = (ctx.setores || []).find((x: any) => x.id === i.setor_id)?.nome || "Sem setor";
      const expostos = i.trabalhadores_expostos != null ? `${i.trabalhadores_expostos} expostos` : "";
      
      const colGes = [ges, expostos, setor].filter(Boolean).join("\n");
      const colPerigo = [`[${i.grupo}] ${i.perigo_descricao}`, i.fonte_geradora ? `Fonte: ${i.fonte_geradora}` : ""].filter(Boolean).join("\n");
      const colLesoes = i.lesoes || "—";
      
      const controlesStr = Array.isArray(i.controles_existentes) 
        ? i.controles_existentes.join("; ") 
        : (i.controles_existentes || "—");

      const cls = classeLabel(i.classificacao);
      const temAval = i.severidade != null && i.probabilidade != null;
      const avalStr = temAval
        ? `S${i.severidade} x P${i.probabilidade} = ${i.severidade * i.probabilidade}\n${cls}`
        : "Sem avaliação";

      // A cor é a mesma da legenda da matriz, logo acima: quem lê o inventário
      // enxerga o nível de risco antes de ler a conta que levou até ele.
      const cor = i.classificacao ? CLASSE_HEX[i.classificacao as PgrClasse] : undefined;
      addLinha([colGes, colPerigo, colLesoes, controlesStr, avalStr], cor);
    });
    b.y += 2;
  }

  // Plano de ação — 1.5.7.1 "b" da NR-01.
  pdf.addPage(); b.y = 15;
  title(b, "Plano de Ação (5W2H)");
  if (ctx.acoes.length === 0) para(b, "Nenhuma ação registrada.");
  ctx.acoes.forEach((a) => {
    ensure(b, 22);
    pdf.setDrawColor(200); pdf.rect(10, b.y, 190, 0.2, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`• ${a.descricao}`, 12, b.y + 4);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const risco = a.classe_risco ? classeLabel(a.classe_risco) : "—";
    // Um ponto na cor da classe: a mesma legenda da matriz e do inventário,
    // para o plano e o risco que o originou se lerem juntos.
    if (a.classe_risco && CLASSE_HEX[a.classe_risco as PgrClasse]) {
      const [cr, cg, cb] = CLASSE_HEX[a.classe_risco as PgrClasse];
      pdf.setFillColor(cr, cg, cb);
      pdf.circle(13.2, b.y + 6.9, 1.1, "F");
    }
    pdf.text(
      `Status: ${a.status}  ·  Risco: ${risco}  ·  Prazo: ${fmtDate(a.prazo)}  ·  Conclusão: ${fmtDate(a.data_conclusao)}`,
      a.classe_risco ? 16 : 12, b.y + 8,
    );
    /*
     * 5W2H com os rótulos em português.
     *
     * O método se chama assim, mas o documento é brasileiro e vai para
     * fiscalização: "Why", "Who", "Where" no meio de um texto em português
     * fazem o plano parecer planilha importada pela metade. O nome do método
     * fica no título da seção; as linhas dizem o que perguntam.
     */
    const linhas = [
      a.what && `O que será feito: ${a.what}`,
      a.why && `Por quê: ${a.why}`,
      a.who && `Responsável: ${a.who}`,
      a.where_local && `Onde: ${a.where_local}`,
      a.prazo && `Quando: até ${fmtDate(a.prazo)}`,
      a.how && `Como: ${a.how}`,
      // `toFixed` escreve no formato americano: "R$ 18000.00". Num documento em
      // português, com valores que chegam à casa dos milhares, isso se lê
      // errado — o ponto vira separador de milhar aos olhos de quem assina.
      a.how_much != null && `Quanto custa: ${fmtMoeda(a.how_much)}`,
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
  title(b, "Assinaturas");
  // 1.5.7.2 da NR-01: os documentos do PGR são elaborados sob responsabilidade
  // da organização, datados e assinados. Quem responde tecnicamente aparece
  // aqui, junto das assinaturas — antes tinha seção própria, que repetia o
  // mesmo dado da capa sem exigência que a justificasse.
  const resps = ctx.responsaveis || [];
  if (resps.length === 0) {
    kv(b, "Responsável Técnico", pgr.resp_tec_nome || "—");
    // Registro em branco vira "REGISTRO PROFISSIONAL —" logo abaixo do nome
    // de quem assina: um campo vazio anunciado no fecho do documento.
    if (pgr.resp_tec_registro) kv(b, "Registro Profissional", pgr.resp_tec_registro);
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
  para(b, "Assinatura visual com hash SHA-256 e MFA verificado. Não constitui assinatura digital ICP-Brasil.");
  /*
   * Sem assinatura registrada, o documento ganha as linhas para assinar à
   * mão.
   *
   * Antes o fecho era a frase "Nenhuma assinatura visual registrada" e mais
   * nada — um PGR impresso para levar à fiscalização terminava sem lugar
   * onde assinar, e o item 1.5.7.2 da NR-01 pede documento datado e assinado.
   * As duas linhas são as duas responsabilidades que a norma distingue: quem
   * elabora tecnicamente e a organização, que responde pelo programa.
   */
  if (ctx.assinaturas.length === 0) {
    para(b, "Nenhuma assinatura eletrônica registrada até a geração deste PDF.");
    ensure(b, 34);
    b.y += 10;
    const linhaAssinatura = (x: number, nome: string, papel: string) => {
      pdf.setDrawColor(120); pdf.setLineWidth(0.3);
      pdf.line(x, b.y, x + 78, b.y);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5); pdf.setTextColor(15, 23, 42);
      pdf.text(nome, x, b.y + 4);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(110);
      pdf.text(papel, x, b.y + 7.5);
      pdf.setTextColor(0);
    };
    linhaAssinatura(12, pgr.resp_tec_nome || "", "Responsável técnico pela elaboração");
    linhaAssinatura(110, ctx.empresaNome || "", "Pela organização (NR-01, item 1.5.7.2)");
    b.y += 14;
  }
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



  sumario(pdf, b.toc);

  await rodapePaginas(pdf, {
    qrUrl: opts.qrUrl,
    marca: opts.comMarca ? (pgr.status === "em_revisao" ? "EM REVISÃO" : "RASCUNHO") : null,
    /*
     * Três linhas em vez de quatro: a explicação do que é um QR Code ocupava
     * a linha mais larga do rodapé para dizer o que o próprio QR ao lado já
     * diz. O endereço fica, porque quem tem o papel na mão precisa digitá-lo.
     */
    linhas: () => [
      `Validação interna: ${opts.qrUrl}`,
      `Gerado em ${fmtDT(new Date().toISOString())}  ·  PDF v${opts.pdfVersao}  ·  PGR v${pgr.versao}`,
      "Documento técnico interno  ·  assinatura ICP-Brasil não aplicada a este documento.",
    ],
  });

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

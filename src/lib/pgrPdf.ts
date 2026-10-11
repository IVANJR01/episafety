// PGR Parte 5 — PDF técnico interno + assinatura visual + QR Code
// Storage: Supabase Storage privado (default) ou Google Drive BYOK (opcional).
// Banco recebe apenas hash SHA-256 + bucket/path + tamanho — nunca o binário.
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { uploadDocumentoSeguro } from "@/lib/secureStorage";
import { PgrDocumento, PGR_STATUS_LABEL } from "@/lib/pgrTypes";
import {
  B, type CampoCapa, MARGEM, LARGURA, capaTimbrada, ensure, fmtDT, fmtDate, kv, para,
  rodapePaginas, sub, sumario, tabela, title,
} from "@/lib/pdfTimbrado";
import {
  CLASSE_LABEL as CLASSIF_LABEL,
  CLASSE_HEX,
  CLASSES_ORDENADAS,
  classeLabel,
  classificarRisco as classificarMatriz,
  CLASSE_TEXTO_HEX,
  GRUPO_LABEL,
  PgrClasse,
} from "@/lib/pgrMatriz";
import { ACAO_STATUS_LABEL, type PgrAcaoStatus } from "@/lib/pgrAcoes";

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

/*
 * A regra do número de revisão mora em pgrRevisao.ts, porque o gerador de
 * Word usa a mesma. Reexportada para não quebrar quem já importava daqui.
 */
import { numeroDaRevisao } from "./pgrRevisao";
export { numeroDaRevisao };

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
      /*
       * O numero sai na cor que se le em cima do fundo — nao sempre em branco.
       * Com as cores oficiais da planilha (amarelo FFFF00, laranja FFC000,
       * verde 92D050, azul 00B0F0) o branco sumia: a matriz saia com metade
       * dos numeros invisiveis. Mesma regra do gerador de Word: so o
       * Intoleravel (C00000) leva letra branca.
       */
      const [tr, tg, tb] = (c && CLASSE_TEXTO_HEX[c]) || [0, 0, 0];
      b.doc.setTextColor(tr, tg, tb); b.doc.setFontSize(8);
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
      ctx.empresaCnpj ? `CNPJ ${ctx.empresaCnpj}` : null,
      ctx.unidadeNome ? `Unidade: ${ctx.unidadeNome}` : null,
    ].filter(Boolean) as string[],
    /*
     * Campo sem dado não vai para a capa.
     *
     * Saía "Vigência: — a —" e "Registro Profissional: —" na primeira página
     * de um documento que vai para fiscalização: travessão ali não informa
     * nada e faz o documento parecer abandonado no meio do preenchimento. O
     * que falta aparece nas pendências, antes de publicar.
     */
    campos: [
      { rotulo: "Emitido em", valor: fmtDate(pgr.data_emissao || new Date().toISOString()) },
      pgr.data_vigencia_inicio && pgr.data_vigencia_fim
        ? { rotulo: "Vigência", valor: `${fmtDate(pgr.data_vigencia_inicio)} a ${fmtDate(pgr.data_vigencia_fim)}` }
        : null,
      pgr.resp_tec_nome ? { rotulo: "Responsável técnico", valor: pgr.resp_tec_nome } : null,
      pgr.resp_tec_registro ? { rotulo: "Registro profissional", valor: pgr.resp_tec_registro } : null,
      pgr.qtd_trabalhadores != null
        ? { rotulo: "Trabalhadores abrangidos", valor: String(pgr.qtd_trabalhadores) }
        : null,
      ctx.codigoDocumento ? { rotulo: "Código do documento", valor: ctx.codigoDocumento } : null,
    ].filter(Boolean) as CampoCapa[],
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

  /*
   * ── Caracterização da estrutura ───────────────────────────────────────────
   *
   * Aqui havia quatro seções inteiras — Caracterização dos Ambientes de
   * Trabalho, Processos de Trabalho, Setores e Grupos de Exposição Semelhante,
   * e Funções e Atividades. Num PGR real elas ocupavam 8 das 14 páginas,
   * enquanto o inventário e o plano de ação — o que a NR-01 de fato exige —
   * couberam em 3.
   *
   * A informação não foi jogada fora: ela é exigida pelo item 1.5.7.3.2,
   * letras "a" (caracterização dos processos e ambientes), "b" (caracterização
   * das atividades) e "e" (grupos de trabalhadores expostos). O que mudou é
   * ONDE ela aparece. A norma pede esse conteúdo DENTRO do inventário, e é
   * assim que a planilha e o documento em Word da SafetySoluções sempre
   * fizeram: um cabeçalho por GES, com setor, funções, ambiente e processo,
   * seguido das linhas de risco daquele grupo.
   *
   * Em seção separada o mesmo ambiente era descrito longe dos riscos que
   * acontecem nele, e quem lê tinha de folhear para ligar os dois.
   */

  title(b, "Metodologia de Avaliação");
  kv(b, "Método", pgr.metodologia_avaliacao || "Matriz 5×5 (Severidade × Probabilidade)", true);
  title(b, "Critérios da Matriz");
  drawMatriz(b);

  // Inventário de riscos — 1.5.7.1 "a" da NR-01.
  title(b, "Inventário de Riscos Ocupacionais");

  if (ctx.inventario.length === 0) {
    para(b, "Nenhum item de inventário registrado.");
  } else {
    /*
     * O inventário é agrupado por GES, com o cabeçalho do grupo trazendo o
     * que a NR-01 1.5.7.3.2 pede nas letras "a", "b" e "e": o ambiente, o
     * processo/atividades e o grupo de trabalhadores exposto. É o formato da
     * planilha e do documento em Word da SafetySoluções — e é o que permitiu
     * tirar daqui quatro seções que repetiam essa informação longe dos riscos
     * que acontecem em cada lugar.
     */
    const addLinha = tabela(b, [
      { rotulo: "Expostos", x: 12, w: 20 },
      { rotulo: "Perigo / Fonte", x: 34, w: 46 },
      { rotulo: "Lesões", x: 82, w: 36 },
      { rotulo: "Controles", x: 120, w: 48 },
      { rotulo: "Avaliação", x: 170, w: 28 },
    ]);

    const mapaGes: Record<string, string> = (ctx.ghes as any) || {};
    const nomeGes = (i: any) => mapaGes[i.ges_id] || mapaGes[i.ghe_id] || "";
    const nomeSetor = (i: any) =>
      i.setor || ((ctx.setores as any[]) || []).find((s: any) => s.id === i.setor_id)?.nome || "";

    /* Um grupo por GES, na ordem do nome; sem GES fica por último. */
    const grupos = new Map<string, any[]>();
    for (const i of ctx.inventario as any[]) {
      const chave = i.ges_id || i.ghe_id || "__sem_ges__";
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(i);
    }
    const chavesOrdenadas = [...grupos.keys()].sort((a, c) => {
      if (a === "__sem_ges__") return 1;
      if (c === "__sem_ges__") return -1;
      return (mapaGes[a] || "").localeCompare(mapaGes[c] || "");
    });

    /**
     * A faixa que abre cada GES.
     *
     * Desenhada fora do fluxo da tabela, então ela mesma cuida da quebra de
     * página — e manda redesenhar o cabeçalho das colunas quando quebra,
     * senão a página seguinte começaria com linhas sem dizer o que é cada uma.
     */
    const faixaDoGes = (itens: any[]) => {
      const primeiro = itens[0];
      const ges = nomeGes(primeiro) || "Sem GES";
      const setor = nomeSetor(primeiro);
      const funcoes = (primeiro.funcoes_snapshot || []).filter(Boolean).join(", ");
      const ambiente = primeiro.descricao_ambiente || "";
      const processo = primeiro.processo || "";

      const cabecalho = ["GES: " + ges, setor && `Setor: ${setor}`, funcoes && `Funções: ${funcoes}`]
        .filter(Boolean)
        .join("    ·    ");
      const detalhes = [
        ambiente && `Ambiente: ${ambiente}`,
        processo && `Processo / atividades: ${processo}`,
      ].filter(Boolean) as string[];

      pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
      const linhasCab = pdf.splitTextToSize(cabecalho, 184) as string[];
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
      const linhasDet = detalhes.flatMap((d) => pdf.splitTextToSize(d, 184) as string[]);
      const altura = linhasCab.length * 3.6 + linhasDet.length * 3.2 + 3;

      if (b.y + altura + 8 > 278) {
        pdf.addPage();
        b.y = 15;
        addLinha.cabecalho();
      }
      pdf.setFillColor(227, 234, 242);
      pdf.rect(10, b.y, 190, altura, "F");
      let yTexto = b.y + 3.4;
      pdf.setTextColor(15, 23, 42);
      linhasCab.forEach((l) => {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
        pdf.text(l, 12, yTexto);
        yTexto += 3.6;
      });
      linhasDet.forEach((l) => {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
        pdf.text(l, 12, yTexto);
        yTexto += 3.2;
      });
      pdf.setTextColor(0);
      b.y += altura;
    };

    for (const chave of chavesOrdenadas) {
      const itens = grupos.get(chave)!;
      faixaDoGes(itens);

      itens.forEach((i: any) => {
        /*
         * "0 expostos" não é informação: é uma afirmação falsa.
         *
         * O PGR real saiu com "0 expostos" em TODAS as linhas, porque o campo
         * fica em zero enquanto ninguém o preenche. A NR-01 1.5.7.3.2 "e"
         * pede os grupos de trabalhadores expostos; imprimir zero diz à
         * fiscalização que aquele risco não atinge ninguém — o contrário do
         * que o inventário existe para registrar. Sem número, o documento diz
         * que o número não foi informado, que é a verdade.
         */
        const n = i.trabalhadores_expostos;
        const expostos = n != null && n > 0
          ? `${n} ${n === 1 ? "exposto" : "expostos"}`
          : "não informado";

        /*
         * O grupo sai pelo rótulo, não pelo valor do banco. Saía "[fisico]",
         * "[quimico]", "[psicossocial]" — minúsculo, sem acento e entre
         * colchetes, que é o nome do enum, não português. Num documento que
         * vai para fiscalização isso é o sistema aparecendo por baixo do
         * documento.
         */
        const agente = GRUPO_LABEL[i.grupo] || i.grupo;
        const colPerigo = [
          `${agente} — ${i.perigo_descricao}`,
          i.fonte_geradora ? `Fonte: ${i.fonte_geradora}` : "",
        ].filter(Boolean).join("\n");

        const controlesStr = Array.isArray(i.controles_existentes)
          ? i.controles_existentes.join("; ")
          : (i.controles_existentes || "—");

        const cls = classeLabel(i.classificacao);
        const temAval = i.severidade != null && i.probabilidade != null;
        const avalStr = temAval
          ? `S${i.severidade} x P${i.probabilidade} = ${i.severidade * i.probabilidade}\n${cls}`
          : "Sem avaliação";

        const classe = i.classificacao as PgrClasse | undefined;
        const cor = classe ? CLASSE_HEX[classe] : undefined;
        addLinha(
          [expostos, colPerigo, i.lesoes || "—", controlesStr, avalStr],
          cor,
          cor && classe ? { col: 4, fundo: cor, texto: CLASSE_TEXTO_HEX[classe] } : undefined,
        );
      });
    }
    b.y += 2;
  }

  // Plano de ação — 1.5.7.1 "b" da NR-01.
  pdf.addPage(); b.y = 15;
  title(b, "Plano de Ação (5W2H)");
  if (ctx.acoes.length === 0) para(b, "Nenhuma ação registrada.");
  ctx.acoes.forEach((a) => {
    ensure(b, 22);
    pdf.setDrawColor(200); pdf.rect(10, b.y, 190, 0.2, "F");
    /*
     * O cabeçalho da ação FLUI pela altura que ocupa — nada é desenhado em
     * deslocamento fixo.
     *
     * Era `b.y + 4` para o título e `b.y + 8` para a situação, com um
     * `b.y += 13` no fim. Isso só funciona com título de uma linha. Num PGR
     * real apareceu uma ação cujo "o quê" tinha quebra de linha no cadastro
     * ("Implantar controle do risco ...\n\nKit Ergonômico- Suporte Para
     * Notebook..."): o jsPDF quebra em \n, desenhou três linhas, e as duas
     * de baixo saíram POR CIMA do 5W2H. Texto impresso sobre texto, num
     * documento que vai para fiscalização.
     *
     * Agora mede-se o que se escreve, e o resto desce.
     */
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    /*
     * Título da ação: o "o quê" do 5W2H quando existe, senão a descrição.
     *
     * Saíam os dois, um debaixo do outro — "• Enclausurar as máquinas" e
     * logo abaixo "O que será feito: Enclausurar as máquinas de costura". É a
     * mesma medida escrita duas vezes, e a repetição fazia a ação parecer
     * duas.
     */
    const tituloAcao = (a.what || a.descricao || "").replace(/\s*\n+\s*/g, " ").trim();
    const linhasTitulo = pdf.splitTextToSize(`• ${tituloAcao}`, 186) as string[];
    b.y += 4;
    linhasTitulo.forEach((linha) => {
      ensure(b, 5);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
      pdf.text(linha, 12, b.y);
      b.y += 4;
    });

    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const risco = a.classe_risco ? classeLabel(a.classe_risco) : "—";
    // Um ponto na cor da classe: a mesma legenda da matriz e do inventário,
    // para o plano e o risco que o originou se lerem juntos.
    if (a.classe_risco && CLASSE_HEX[a.classe_risco as PgrClasse]) {
      const [cr, cg, cb] = CLASSE_HEX[a.classe_risco as PgrClasse];
      pdf.setFillColor(cr, cg, cb);
      pdf.circle(13.2, b.y - 1, 1.1, "F");
    }
    /*
     * A linha de situação só mostra o que existe.
     *
     * Antes ela era fixa e saía "Status: programada · Risco: — · Prazo:
     * 30/06/2026 · Conclusão: —": metade travessão, e o status com o nome do
     * enum do banco em vez do rótulo em português. Travessão em documento
     * técnico não é "vazio", é "não se aplica" — e aqui só queria dizer que a
     * ação ainda não acabou.
     */
    const situacao = [
      `Status: ${ACAO_STATUS_LABEL[a.status as PgrAcaoStatus] || a.status}`,
      a.classe_risco ? `Risco: ${risco}` : "",
      a.prazo ? `Prazo: ${fmtDate(a.prazo)}` : "",
      a.data_conclusao ? `Concluída em ${fmtDate(a.data_conclusao)}` : "",
    ].filter(Boolean).join("  ·  ");
    ensure(b, 5);
    pdf.text(situacao, a.classe_risco ? 16 : 12, b.y);
    b.y += 5;
    /*
     * 5W2H com os rótulos em português.
     *
     * O método se chama assim, mas o documento é brasileiro e vai para
     * fiscalização: "Why", "Who", "Where" no meio de um texto em português
     * fazem o plano parecer planilha importada pela metade. O nome do método
     * fica no título da seção; as linhas dizem o que perguntam.
     */
    const linhas = [
      /* O "o quê" já é o título da ação, logo acima. */
      a.what && a.descricao && a.what !== a.descricao ? `Medida registrada: ${a.descricao}` : "",
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

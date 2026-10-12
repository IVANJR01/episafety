// PGR Parte 5 — PDF técnico interno + assinatura visual + QR Code
// Storage: Supabase Storage privado (default) ou Google Drive BYOK (opcional).
// Banco recebe apenas hash SHA-256 + bucket/path + tamanho — nunca o binário.
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { uploadDocumentoSeguro } from "@/lib/secureStorage";
import { PgrDocumento, PGR_STATUS_LABEL } from "@/lib/pgrTypes";
import {
  B, type CampoCapa, MARGEM, LARGURA, capaTimbrada, ensure, fmtDT, fmtDate, kv, para,
  refNorma, subNumerado, tabelaFicha,
  rodapePaginas, sub, sumario, tabela, title,
} from "@/lib/pdfTimbrado";
import { DOCUMENTOS_SST } from "@/lib/documentos/docsSst";
import {
  CLASSE_LABEL as CLASSIF_LABEL,
  CLASSE_HEX,
  CLASSES_ORDENADAS,
  classeLabel,
  classificarRisco as classificarMatriz,
  CLASSE_TEXTO_HEX,
  CLASSE_FAIXA,
  GRUPO_LABEL,
  PgrClasse,
  corDaClasse,
  corDoGrupo,
} from "@/lib/pgrMatriz";
import { ACAO_STATUS_LABEL, type PgrAcaoStatus } from "@/lib/pgrAcoes";
import { pesoDoGrupo, ordenarInventario } from "@/lib/inventarioOrdem";
import { descreverAmbiente, descreverProcesso } from "@/lib/sstEstrutura";

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
  setor_id?: string | null;
  lesoes?: string | null;
  setor?: string | null;
  descricao_ambiente?: string | null;
  ambiente?: string | null;
  processo?: string | null;
  processo_id?: string | null;
  ambiente_id?: string | null;
  funcoes_snapshot?: string[] | null;
  ges_id?: string | null;
  ges_codigo?: string | null;
  tipo_agente?: string | null;
  limite_tolerancia?: string | null;
  intensidade?: string | null;
  medicao_valor?: number | string | null;
  medicao_unidade?: string | null;
  tempo_exposicao?: string | null;
  tecnica_utilizada?: string | null;
  metodologia_avaliacao?: string | null;
  tipo_avaliacao?: string | null;
  epi?: string | null;
  atenuacao?: string | null;
  fator_protecao?: string | null;
  epi_fator_protecao?: string | null;
  nivel_risco?: number | null;
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
  ghesCodigos?: Record<string, string>;
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

/*
 * Cores do status no plano de ação — as mesmas da planilha da
 * SafetySoluções. A chave é o rótulo em português, que é o que sai impresso.
 */
const STATUS_PDF_COR: Record<string, [number, number, number]> = {
  Atrasada: [255, 124, 128],
  "Em andamento": [255, 255, 0],
  Programada: [157, 195, 230],
  Pendente: [157, 195, 230],
  Concluída: [146, 208, 80],
  Reprogramada: [255, 192, 0],
};

/**
 * Prioridade 1 a 5 -> ALTA / MÉDIA / BAIXA, como a planilha escreve.
 *
 * Mesma regra de src/lib/documentos/montarDados.ts: no sistema, 4 ou mais é
 * ação crítica.
 */
function prioridadePdf(v?: number | null): string {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (n >= 4) return "ALTA";
  if (n === 3) return "MÉDIA";
  if (n >= 1) return "BAIXA";
  return "";
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/*
 * Tipo de exposição do banco -> rótulo da planilha. Os mesmos pares de
 * src/lib/documentos/montarDados.ts, para o PDF e o Word dizerem o mesmo.
 */
/*
 * O tratamento de cada faixa, na redação do pacote.
 *
 * É a coluna "TRATAMENTO NO PLANO DE AÇÃO" da legenda da matriz, igual à do
 * documento em Word e à da planilha. CLASSE_DECISAO, em pgrMatriz.ts, diz a
 * mesma coisa com outras palavras e é usada na tela; aqui vale a redação do
 * documento, porque é o documento que vai para fiscalização.
 */
/**
 * Grau de risco como a NR-04 escreve: 2 vira "02 (Dois)".
 *
 * Saía o número cru — "1" —, e o documento em Word imprime por extenso. É a
 * mesma regra de src/lib/documentos/montarDados.ts, para os dois formatos
 * dizerem a mesma coisa.
 */
const GRAU_EXTENSO = ["", "Um", "Dois", "Três", "Quatro"];
function grauDeRisco(v?: number | null): string {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 4) return "";
  return `${String(n).padStart(2, "0")} (${GRAU_EXTENSO[n]})`;
}

const CLASSE_DECISAO_CURTA: Record<PgrClasse, string> = {
  trivial: "Nenhuma ação necessária.",
  toleravel: "Nenhum controle adicional necessário.",
  moderado: "Controle adicional, se possível/viável.",
  substancial: "Controle necessário.",
  intoleravel: "Ação imediata ou interrupção da atividade.",
};

const EXPOSICAO_PDF: Record<string, string> = {
  continua: "Permanente",
  intermitente: "Intermitente",
  eventual: "Eventual",
  nao_aplicavel: "",
};

const fmtMoeda = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/*
 * Matriz de risco 5x5, no formato do documento em Word e da planilha.
 *
 * A versão anterior era um quadriculado com os eixos numerados de 1 a 5 e uma
 * legenda em lista ao lado. O Word traz o nome de cada faixa — "Muito
 * Provável (5)", "Leve (1)" —, a palavra PROBABILIDADE escrita na vertical ao
 * longo das cinco linhas, e a legenda como tabela de três colunas que diz o
 * que fazer com cada classificação. Quem lê a matriz precisa saber o que é o
 * número; sem os rótulos, "3 x 4" não diz nada a quem não decorou a escala.
 */
function drawMatriz(b: B) {
  const NAVY: [number, number, number] = [15, 42, 68];
  const NAVY2: [number, number, number] = [27, 63, 99];
  const CLARO: [number, number, number] = [238, 242, 246];

  const SEV = ["Leve (1)", "Baixa (2)", "Moderada (3)", "Alta (4)", "Extrema (5)"];
  const PROB: [string, number][] = [
    ["Muito Provável", 5], ["Provável", 4], ["Possível", 3], ["Pouco Provável", 2], ["Rara", 1],
  ];

  /* Em paisagem a matriz e a legenda cabem lado a lado; em pé, uma embaixo
     da outra — é o mesmo arranjo do Word, que imprime a seção deitada. */
  const direita = b.direita ?? 200;
  const ladoALado = direita > 230;

  const LARG_PROB = 10;        // a faixa vertical "PROBABILIDADE"
  const LARG_ROTULO = 26;      // "Muito Provável (5)"
  const CEL = ladoALado ? 20 : 17;
  const ALT = 11;
  const larguraMatriz = LARG_PROB + LARG_ROTULO + 5 * CEL;

  ensure(b, 6 * ALT + 22);
  const x0 = 12;
  let y = b.y;

  b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(7.5);

  /* Faixa "SEVERIDADE" por cima das cinco colunas. */
  b.doc.setFillColor(...NAVY);
  b.doc.rect(x0 + LARG_PROB + LARG_ROTULO, y, 5 * CEL, 6, "F");
  b.doc.setTextColor(255);
  b.doc.text("SEVERIDADE", x0 + LARG_PROB + LARG_ROTULO + (5 * CEL) / 2, y + 4, { align: "center" });
  y += 6;

  /* Cabeçalho das severidades. */
  b.doc.setFillColor(...NAVY2);
  b.doc.rect(x0 + LARG_PROB + LARG_ROTULO, y, 5 * CEL, 8, "F");
  b.doc.setTextColor(255); b.doc.setFontSize(6.5);
  SEV.forEach((t, i) =>
    b.doc.text(t, x0 + LARG_PROB + LARG_ROTULO + i * CEL + CEL / 2, y + 5, { align: "center" }));
  const yCelulas = y + 8;

  /* Faixa vertical "PROBABILIDADE", ao lado das cinco linhas. */
  b.doc.setFillColor(...NAVY);
  b.doc.rect(x0, yCelulas, LARG_PROB, 5 * ALT, "F");
  b.doc.setTextColor(255); b.doc.setFontSize(7);
  /*
   * Texto girado é posicionado pelo início da linha de base, e o `align` do
   * jsPDF não vale com `angle` — centralizar pede a conta na mão: sobe-se
   * metade da largura do texto a partir do meio da faixa.
   */
  const rotulo = "PROBABILIDADE";
  const larguraRotulo = b.doc.getTextWidth(rotulo);
  b.doc.text(rotulo, x0 + LARG_PROB / 2 + 2.4, yCelulas + (5 * ALT) / 2 + larguraRotulo / 2, {
    angle: 90,
  } as never);

  /* As cinco linhas: rótulo e as células coloridas. */
  PROB.forEach(([nome, p], linha) => {
    const yl = yCelulas + linha * ALT;
    b.doc.setFillColor(...NAVY2);
    b.doc.rect(x0 + LARG_PROB, yl, LARG_ROTULO, ALT, "F");
    b.doc.setTextColor(255); b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(6.5);
    b.doc.text(`${nome} (${p})`, x0 + LARG_PROB + LARG_ROTULO / 2, yl + ALT / 2 + 1.2, {
      align: "center",
    });

    for (let sv = 1; sv <= 5; sv++) {
      const valor = p * sv;
      const classe = classificarMatriz(sv, p);
      const [r, g, bl] = (classe && CLASSE_HEX[classe]) || [200, 200, 200];
      const x = x0 + LARG_PROB + LARG_ROTULO + (sv - 1) * CEL;
      b.doc.setFillColor(r, g, bl);
      b.doc.rect(x, yl, CEL, ALT, "F");
      b.doc.setDrawColor(255); b.doc.setLineWidth(0.3);
      b.doc.rect(x, yl, CEL, ALT);
      const [tr, tg, tb] = (classe && CLASSE_TEXTO_HEX[classe]) || [0, 0, 0];
      b.doc.setTextColor(tr, tg, tb); b.doc.setFontSize(8.5);
      b.doc.text(String(valor), x + CEL / 2, yl + ALT / 2 + 1.4, { align: "center" });
    }
  });

  const fimMatriz = yCelulas + 5 * ALT;

  /* ── Legenda: faixa, classificação e o que fazer ──────────────────────── */
  const legX = ladoALado ? x0 + larguraMatriz + 8 : x0;
  let legY = ladoALado ? b.y : fimMatriz + 6;
  const legLarg = ladoALado ? direita - legX - 2 : larguraMatriz;
  const cols = [legLarg * 0.18, legLarg * 0.26, legLarg * 0.56];

  b.doc.setFillColor(...NAVY);
  b.doc.rect(legX, legY, legLarg, 6, "F");
  b.doc.setTextColor(255); b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(6.5);
  ["NÍVEL (P x S)", "CLASSIFICAÇÃO", "TRATAMENTO NO PLANO DE AÇÃO"].forEach((t, i) => {
    const x = legX + cols.slice(0, i).reduce((a, c) => a + c, 0);
    b.doc.text(t, x + cols[i] / 2, legY + 4, { align: "center" });
  });
  legY += 6;

  /*
   * As faixas saem da MESMA regra que pinta as células e que classifica os
   * itens do inventário. Antes era uma lista escrita à mão, com classes e
   * faixas que não existiam em lugar nenhum do sistema.
   */
  const ordem: PgrClasse[] = ["trivial", "toleravel", "moderado", "substancial", "intoleravel"];
  ordem.forEach((c) => {
    const [menor, maior] = CLASSE_FAIXA[c];
    const [r, g, bl] = CLASSE_HEX[c];
    const [tr, tg, tb] = CLASSE_TEXTO_HEX[c];
    const alturaLinha = 7;
    b.doc.setDrawColor(201, 211, 221); b.doc.setLineWidth(0.2);

    b.doc.setFillColor(r, g, bl);
    b.doc.rect(legX, legY, cols[0], alturaLinha, "F");
    b.doc.rect(legX, legY, cols[0], alturaLinha);
    b.doc.setTextColor(tr, tg, tb); b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(7);
    b.doc.text(`${menor} a ${maior}`, legX + cols[0] / 2, legY + 4.7, { align: "center" });

    b.doc.setFillColor(...CLARO);
    b.doc.rect(legX + cols[0], legY, cols[1], alturaLinha, "F");
    b.doc.rect(legX + cols[0], legY, cols[1], alturaLinha);
    b.doc.setTextColor(0);
    b.doc.text(CLASSIF_LABEL[c].toUpperCase(), legX + cols[0] + cols[1] / 2, legY + 4.7, {
      align: "center",
    });

    b.doc.rect(legX + cols[0] + cols[1], legY, cols[2], alturaLinha);
    b.doc.setFont("helvetica", "normal"); b.doc.setFontSize(7);
    b.doc.text(CLASSE_DECISAO_CURTA[c], legX + cols[0] + cols[1] + 2, legY + 4.7);
    legY += alturaLinha;
  });

  b.doc.setTextColor(0);
  b.y = Math.max(fimMatriz, legY) + 5;
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

  /*
   * A capa é a Simples com moldura do pacote — a mesma dos seis documentos
   * em Word, com a moldura da página e a sigla grande no centro.
   */
  const matriz = (ctx.unidades || [])[0] as PgrUnidadeItem | undefined;
  const anoCapa = (pgr.data_emissao || new Date().toISOString()).slice(0, 4);

  capaTimbrada(pdf, {
    logoDataUrl: ctx.logoDataUrl,
    sigla: "PGR",
    titulo: "Programa de Gerenciamento de Riscos",
    subtitulo: "NR-01",
    nota: pgr.data_vigencia_inicio && pgr.data_vigencia_fim
      ? `Vigência: ${fmtDate(pgr.data_vigencia_inicio)} a ${fmtDate(pgr.data_vigencia_fim)}`
      : null,
    empresaNome: ctx.empresaNome || "Empresa",
    identificacao: [],
    campos: [],
    /*
     * A capa não repete a identificação da empresa.
     *
     * Ela trazia uma tabela com Empresa, CNPJ, Endereço, Responsável Técnico e
     * Revisão / Data, e um bloco de "REV. 00 · PGR v1 · PDF v1" no alto. Tudo
     * isso já está dentro do documento: a identificação completa no item 2, a
     * revisão no item 1 e as versões no bloco de validação da última página.
     * Repetir na capa só a deixava poluída. A capa diz o que o documento é —
     * sigla, título, norma e vigência — e nada mais.
     */
    linhasTabela: [],
    rodapeLocal: [matriz?.cidade, matriz?.uf].filter(Boolean).join(" / ")
      ? `${[matriz?.cidade, matriz?.uf].filter(Boolean).join(" / ")} – ${anoCapa}`
      : anoCapa,
  });

  pdf.addPage(); b.y = 15;

  // Controle de revisões (visível logo após a capa)
  /*
   * Controle de revisões — a MESMA tabela do Word: REVISÃO | DATA |
   * DESCRIÇÃO | RESPONSÁVEL, com linhas em branco para as próximas revisões
   * serem anotadas. Saía como uma linha de texto corrido ("00 — Elaboração
   * do Programa..."), que não é o quadro que o documento do pacote tem.
   */
  title(b, "Controle de Revisões");
  {
    const largura = (b.direita ?? 200) - 20;
    const linhaRev = tabela(
      b,
      [
        { rotulo: "REVISÃO", x: 12, w: 18 },
        { rotulo: "DATA", x: 34, w: 24 },
        { rotulo: "DESCRIÇÃO", x: 62, w: largura - 18 - 24 - 38 },
        { rotulo: "RESPONSÁVEL", x: (b.direita ?? 200) - 48, w: 44 },
      ],
      { fonte: 8, fonteCabecalho: 7.5, grade: true, cabecalhoEscuro: true },
    );
    const registradas = (ctx.revisoes || []).slice().reverse();
    const linhas: [string, string, string, string][] = registradas.length
      ? registradas.map((r, idx) => [
          String(idx).padStart(2, "0"),
          fmtDate(r.created_at),
          r.motivo || (r.acao === "publicar" ? "Publicação da versão" : String(r.acao ?? "")),
          pgr.resp_tec_nome || "",
        ])
      : [[
          "00",
          fmtDate(pgr.data_emissao),
          "Elaboração do Programa de Gerenciamento de Riscos",
          pgr.resp_tec_nome || "",
        ]];
    linhas.forEach((l) => linhaRev(l.map((x) => x || "")));
    /* Linhas em branco para as próximas revisões, como no Word. */
    for (let i = linhas.length; i < 5; i++) linhaRev(["", "", "", ""]);
    b.y += 3;
  }

  // Identificação da empresa e dos estabelecimentos abrangidos.
  // Fica logo após o controle de revisões porque é o que identifica o documento;
  // vem dos campos de escopo travados na emissão, não do cadastro atual.
  /*
   * Identificação da empresa e responsável técnico, no formato de ficha do
   * documento em Word: rótulo à esquerda com fundo claro, valor ao lado.
   */
  title(b, "Identificação da Empresa");
  const unidades = (ctx.unidades && ctx.unidades.length > 0 ? ctx.unidades : []) as any[];
  const principal = unidades[0];
  const enderecoDe = (u: any) => {
    const rua = [u?.logradouro, u?.numero].filter(Boolean).join(", ");
    return [rua, u?.complemento].filter(Boolean).join(" - ") || u?.endereco || "";
  };
  const cnaeSecundario = Array.isArray(principal?.cnae_secundario)
    ? principal.cnae_secundario.filter(Boolean).join("; ")
    : (principal?.cnae_secundario || "");

  tabelaFicha(b, [
    ["Razão Social", principal?.nome || ctx.empresaNome || ""],
    ["Nome Fantasia", principal?.nome_fantasia || ""],
    ["CNPJ", principal?.cnpj || ctx.empresaCnpj || ""],
    ["CNAE Principal", principal?.cnae_principal || ""],
    ["CNAE Secundário", cnaeSecundario],
    ["Grau de Risco (NR-04)", grauDeRisco(principal?.grau_risco)],
    ["Endereço", enderecoDe(principal)],
    ["Bairro", principal?.bairro || ""],
    ["Cidade / UF", [principal?.cidade, principal?.uf].filter(Boolean).join(" – ")],
    ["CEP", principal?.cep || ""],
    ["Telefone", principal?.telefone || ""],
  ]);

  /* As filiais, quando existem, seguem na mesma ficha, uma por bloco. */
  unidades.slice(1).forEach((u: any) => {
    sub(b, `Filial: ${u.nome_fantasia || u.nome}`);
    tabelaFicha(b, [
      ["Razão Social", u.nome || ""],
      ["CNPJ", u.cnpj || ""],
      ["Endereço", enderecoDe(u)],
      ["Cidade / UF", [u.cidade, u.uf].filter(Boolean).join(" – ")],
    ]);
  });

  title(b, "Responsável Técnico");
  const respTecnico = (ctx.responsaveis || []).find(
    (r: any) => r.papel === "responsavel_tecnico" || r.papel === "elaborador",
  ) as any;
  tabelaFicha(b, [
    ["Nome", respTecnico?.nome || pgr.resp_tec_nome || ""],
    ["Formação / Especialidade", respTecnico?.profissao || ""],
    [
      "Registro Profissional",
      [respTecnico?.registro_profissional, respTecnico?.uf_registro].filter(Boolean).join("/")
        || pgr.resp_tec_registro || "",
    ],
  ]);

  /*
   * ── O corpo do documento vem de docsSst.ts ───────────────────────────────
   *
   * É o MESMO arquivo que gera o PGR em Word, e ele é gerado a partir do
   * pacote (ferramentas/documentos/gerador/docs.js). Antes o PDF tinha a sua
   * própria lista de seções, escrita à mão: o Word dizia "4.2. Conteúdo
   * Mínimo do Inventário" com as letras "a" a "i" do item 1.5.7.3.2, e o PDF
   * nem tinha essa seção. Dois documentos com o mesmo nome e conteúdos
   * diferentes.
   *
   * Agora a estrutura é uma só. O que o PDF acrescenta — e o Word não tem —
   * é o aparato de rastreio: marca d'água, QR, hash e numeração de versão.
   */
  const DEF_PGR = DOCUMENTOS_SST.find((d) => d.sigla === "PGR")!;

  /** Abre uma página deitada e ajusta os limites da folha. */
  const paisagem = () => {
    pdf.addPage([297, 210], "landscape");
    b.y = 15;
    b.direita = 287;
    b.limiteY = 190;
  };
  /** Volta ao retrato. */
  const retrato = () => {
    pdf.addPage("a4", "portrait");
    b.y = 15;
    b.direita = undefined;
    b.limiteY = undefined;
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    const h = (hex || "#000000").replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16) || 0,
      parseInt(h.slice(2, 4), 16) || 0,
      parseInt(h.slice(4, 6), 16) || 0,
    ];
  };

  const desenharInventario = () => {
    if (ctx.inventario.length === 0) {
      para(b, "Nenhum item de inventário registrado.");
      return;
    }

    /*
     * Tabela mestre oficial integrada de 20 colunas — espelhando exatamente a
     * tela do sistema (InventarioTab) e a planilha oficial de SST da SafetySoluções.
     * Cabendo perfeitamente nos 277 mm úteis da folha deitada (10 mm a 287 mm).
     */
    const COLS = [
      { chave: "ambiente", rotulo: "DESCRIÇÃO DO AMBIENTE", w: 23, align: "left" as const },
      { chave: "setor", rotulo: "SETOR", w: 17, align: "left" as const },
      { chave: "ges", rotulo: "GES", w: 7, align: "center" as const },
      { chave: "funcoes", rotulo: "FUNÇÃO", w: 18, align: "left" as const },
      { chave: "processo", rotulo: "PROCESSO", w: 22, align: "left" as const },
      { chave: "agente", rotulo: "AGENTE", w: 14, align: "center" as const },
      { chave: "tipo_agente", rotulo: "PERIGO / TIPO DE AGENTE", w: 17, align: "left" as const },
      { chave: "fonte", rotulo: "FONTE / CIRCUNSTÂNCIA", w: 18, align: "left" as const },
      { chave: "lesoes", rotulo: "POSSÍVEIS LESÕES OU AGRAVOS", w: 20, align: "left" as const },
      { chave: "limite", rotulo: "LIMITE DE EXPOSIÇÃO", w: 10, align: "center" as const },
      { chave: "intensidade", rotulo: "INTENS. / CONC.", w: 10, align: "center" as const },
      { chave: "exposicao", rotulo: "TIPO / TEMPO DE EXPOSIÇÃO", w: 13, align: "center" as const },
      { chave: "tecnica", rotulo: "TÉCNICA UTILIZADA", w: 12, align: "center" as const },
      { chave: "medidas", rotulo: "EPC / PROCEDIMENTO ADMINISTRATIVO", w: 22, align: "left" as const },
      { chave: "epi", rotulo: "EPI", w: 13, align: "center" as const },
      { chave: "atenuacao", rotulo: "ATENUAÇÃO / FP", w: 10, align: "center" as const },
      { chave: "probabilidade", rotulo: "P", w: 6, align: "center" as const },
      { chave: "severidade", rotulo: "S", w: 6, align: "center" as const },
      { chave: "nivel", rotulo: "NÍVEL", w: 6, align: "center" as const },
      { chave: "classificacao", rotulo: "CLASSIFICAÇÃO", w: 13, align: "center" as const },
    ];

    let xAcumulado = 10;
    const colunasComX = COLS.map((c) => {
      const col = { ...c, x: xAcumulado };
      xAcumulado += c.w;
      return col;
    });

    const mapaGesNome: Record<string, string> = (ctx.ghes as any) || {};
    const mapaGesCodigo: Record<string, string> = (ctx.ghesCodigos as any) || {};

    const obterCodigoGes = (i: any): string => {
      if (i.ges_codigo) return i.ges_codigo;
      if (mapaGesCodigo[i.ges_id]) return mapaGesCodigo[i.ges_id];
      if (mapaGesCodigo[i.ghe_id]) return mapaGesCodigo[i.ghe_id];
      if (ctx.gesDetalhes) {
        const det = ctx.gesDetalhes.find((g: any) => g.id === i.ges_id || g.id === i.ghe_id);
        if (det?.codigo) return det.codigo;
      }
      const nome = mapaGesNome[i.ges_id] || mapaGesNome[i.ghe_id] || "";
      const match = nome.match(/GES\s*([0-9A-Za-z]+)/i);
      if (match) return match[1];
      return nome || "—";
    };

    const obterSetor = (i: any): string => {
      if (i.setor && i.setor !== "N.A") return i.setor;
      if (i.setor_id && ctx.setores) {
        const s = ctx.setores.find((sec: any) => sec.id === i.setor_id);
        if (s?.nome) return s.nome;
      }
      return "—";
    };

    const obterAmbiente = (i: any): string => {
      const direto = i.descricao_ambiente || i.ambiente;
      if (direto && direto !== "N.A") return direto;
      if (ctx.ambientes && i.ambiente_id) {
        const amb = ctx.ambientes.find((a: any) => a.id === i.ambiente_id);
        if (amb) return descreverAmbiente(amb);
      }
      return "—";
    };

    const obterProcesso = (i: any): string => {
      const direto = i.processo;
      if (direto && direto !== "N.A") return direto;
      if (ctx.processos && i.processo_id) {
        const proc = ctx.processos.find((p: any) => p.id === i.processo_id);
        if (proc) return descreverProcesso(proc);
      }
      return "—";
    };

    const expostosPorGes = new Map<string, number>();
    for (const itemInv of ctx.inventario as any[]) {
      const g = itemInv.ges_id || itemInv.ghe_id || "__sem_ges__";
      const exp = Number(itemInv.trabalhadores_expostos) || 0;
      const atual = expostosPorGes.get(g) || 0;
      if (exp > atual) expostosPorGes.set(g, exp);
    }

    const obterFuncoes = (i: any): string => {
      if (Array.isArray(i.funcoes_snapshot) && i.funcoes_snapshot.length > 0) {
        return i.funcoes_snapshot.filter(Boolean).join(", ");
      }
      if (typeof i.funcoes_snapshot === "string" && i.funcoes_snapshot) {
        return i.funcoes_snapshot;
      }
      return "—";
    };

    const chaveSetor = (i: any) => [obterSetor(i), obterAmbiente(i), obterProcesso(i)].join("§");
    const chaveGes = (i: any) => [chaveSetor(i), obterCodigoGes(i)].join("§");
    const chaveAgente = (i: any) => [chaveGes(i), i.grupo || ""].join("§");

    const itensOrdenados = ordenarInventario(ctx.inventario as any[], {
      chaveSetor,
      codigoGes: obterCodigoGes,
      grupo: (i) => i.grupo,
      desempate: (i) => `${i.perigo_descricao || ""}§${i.id}`,
    });

    const itensPreparados = itensOrdenados.map((i: any) => {
      const temAval = i.probabilidade != null && i.severidade != null;
      const nivelNum = temAval ? Number(i.probabilidade) * Number(i.severidade) : null;
      const classe: PgrClasse | null =
        nivelNum != null ? classificarMatriz(i.severidade, i.probabilidade) : (i.classificacao as PgrClasse | null);
      const classeTexto = classe ? (CLASSIF_LABEL[classe] || classe).toUpperCase() : "—";

      const dados: Record<string, string> = {
        ambiente: obterAmbiente(i),
        setor: obterSetor(i),
        ges: obterCodigoGes(i),
        funcoes: obterFuncoes(i),
        processo: obterProcesso(i),
        agente: GRUPO_LABEL[i.grupo] || i.grupo || "—",
        tipo_agente: i.tipo_agente || i.perigo_descricao || "—",
        fonte: i.fonte_geradora || (i.tipo_agente ? i.perigo_descricao : "") || "—",
        lesoes: i.lesoes || "—",
        limite: i.limite_tolerancia || "N.A",
        intensidade: i.intensidade
          || (i.medicao_valor != null
            ? `${i.medicao_valor}${i.medicao_unidade ? " " + i.medicao_unidade : ""}`
            : "N.A"),
        exposicao: i.tempo_exposicao || EXPOSICAO_PDF[i.tipo_exposicao] || i.tipo_exposicao || "N.A",
        tecnica: i.tecnica_utilizada || i.metodologia_avaliacao || i.tipo_avaliacao || "N.A",
        medidas: Array.isArray(i.controles_existentes)
          ? i.controles_existentes.filter(Boolean).join("; ")
          : (i.controles_existentes || "N.A"),
        epi: i.epi || "N.A",
        atenuacao: i.atenuacao || i.fator_protecao || i.epi_fator_protecao || "N.A",
        probabilidade: i.probabilidade != null ? String(i.probabilidade) : "—",
        severidade: i.severidade != null ? String(i.severidade) : "—",
        nivel: nivelNum != null ? String(nivelNum) : (i.nivel_risco != null ? String(i.nivel_risco) : "—"),
        classificacao: classeTexto,
      };

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(5.0);
      const linhasTexto: Record<string, string[]> = {};
      for (const col of colunasComX) {
        linhasTexto[col.chave] = pdf.splitTextToSize(dados[col.chave] || "—", col.w - 1.2) as string[];
      }

      // Altura requerida pelas colunas do item
      const maxLinhasItem = Math.max(
        linhasTexto.tipo_agente.length,
        linhasTexto.fonte.length,
        linhasTexto.lesoes.length,
        linhasTexto.limite.length,
        linhasTexto.intensidade.length,
        linhasTexto.exposicao.length,
        linhasTexto.tecnica.length,
        linhasTexto.medidas.length,
        linhasTexto.epi.length,
        linhasTexto.atenuacao.length,
        linhasTexto.probabilidade.length,
        linhasTexto.severidade.length,
        linhasTexto.nivel.length,
        linhasTexto.classificacao.length,
      );

      const altura = Math.max(6.5, maxLinhasItem * 2.1 + 2.0);

      return {
        item: i,
        dados,
        linhasTexto,
        altura,
        classe,
        chaveSetor: chaveSetor(i),
        chaveGes: chaveGes(i),
        chaveAgente: chaveAgente(i),
      };
    });

    // Ajuste de altura se o texto mesclado (Ambiente/Processo) exigir mais espaço vertical
    for (let i = 0; i < itensPreparados.length; ) {
      const chaveSec = itensPreparados[i].chaveSetor;
      let j = i;
      while (j < itensPreparados.length && itensPreparados[j].chaveSetor === chaveSec) j++;
      const qtdLinhas = j - i;
      const alturaAtual = itensPreparados.slice(i, j).reduce((s, row) => s + row.altura, 0);

      const altAmbNecessaria = itensPreparados[i].linhasTexto.ambiente.length * 2.1 + 3.0;
      const altProcNecessaria = itensPreparados[i].linhasTexto.processo.length * 2.1 + 3.0;
      const maxNecessaria = Math.max(altAmbNecessaria, altProcNecessaria);

      if (maxNecessaria > alturaAtual) {
        const extraPorLinha = (maxNecessaria - alturaAtual) / qtdLinhas;
        for (let k = i; k < j; k++) {
          itensPreparados[k].altura += extraPorLinha;
        }
      }
      i = j;
    }

    const desenharCabecalho = () => {
      const hCab = 9.5;
      pdf.setFillColor(253, 230, 138); // Fundo âmbar oficial (#FDE68A)
      pdf.rect(10, b.y, 277, hCab, "F");

      pdf.setDrawColor(245, 158, 11); // Borda âmbar oficial (#F59E0B)
      pdf.setLineWidth(0.35);
      pdf.rect(10, b.y, 277, hCab);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(4.7);
      pdf.setTextColor(69, 26, 3); // #451A03 (âmbar escuro da tela)

      colunasComX.forEach((c) => {
        pdf.setDrawColor(245, 158, 11);
        pdf.setLineWidth(0.35);
        pdf.line(c.x + c.w, b.y, c.x + c.w, b.y + hCab);

        const partes = pdf.splitTextToSize(c.rotulo, c.w - 1.0) as string[];
        const altTexto = partes.length * 2.1;
        let ty = b.y + (hCab - altTexto) / 2 + 1.8;
        partes.forEach((p) => {
          if (c.align === "center") {
            pdf.text(p, c.x + c.w / 2, ty, { align: "center" });
          } else {
            pdf.text(p, c.x + 0.8, ty);
          }
          ty += 2.1;
        });
      });

      pdf.setTextColor(0);
      b.y += hCab;
    };

    desenharCabecalho();

    let idx = 0;
    while (idx < itensPreparados.length) {
      const limiteY = b.limiteY ?? 190;
      let idxFim = idx;
      let yAccum = b.y;

      while (idxFim < itensPreparados.length) {
        const h = itensPreparados[idxFim].altura;
        if (yAccum + h > limiteY && idxFim > idx) {
          break;
        }
        yAccum += h;
        idxFim++;
      }

      if (idxFim === idx) {
        pdf.addPage([297, 210], "landscape");
        b.y = 15;
        desenharCabecalho();
        idxFim = idx + 1;
      }

      const linhasPagina = itensPreparados.slice(idx, idxFim);
      const yLinhas: { y: number; h: number }[] = [];
      let yPos = b.y;
      for (const itemPrep of linhasPagina) {
        yLinhas.push({ y: yPos, h: itemPrep.altura });
        yPos += itemPrep.altura;
      }

      const colAmb = colunasComX[0];
      const colSetor = colunasComX[1];
      const colGes = colunasComX[2];
      const colFun = colunasComX[3];
      const colProc = colunasComX[4];
      const colAgente = colunasComX[5];

      // 1. Células mescladas por SETOR (Ambiente, Setor, Processo)
      for (let i = 0; i < linhasPagina.length; ) {
        const chave = linhasPagina[i].chaveSetor;
        let j = i;
        while (j < linhasPagina.length && linhasPagina[j].chaveSetor === chave) j++;

        const yTop = yLinhas[i].y;
        const hBloco = (yLinhas[j - 1].y + yLinhas[j - 1].h) - yTop;
        const rowData = linhasPagina[i];

        // Ambiente: fundo suave #FFFBEB
        pdf.setFillColor(255, 251, 235);
        pdf.rect(colAmb.x, yTop, colAmb.w, hBloco, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(4.8);
        pdf.setTextColor(15, 23, 42);
        let yAmb = yTop + 2.5;
        for (const linha of rowData.linhasTexto.ambiente) {
          if (yAmb > yTop + hBloco - 1) break;
          pdf.text(linha, colAmb.x + 0.8, yAmb);
          yAmb += 2.1;
        }

        // Setor: fundo branco
        pdf.setFillColor(255, 255, 255);
        pdf.rect(colSetor.x, yTop, colSetor.w, hBloco, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(5.2);
        pdf.setTextColor(15, 23, 42);
        const altSetor = rowData.linhasTexto.setor.length * 2.2;
        let ySet = yTop + (hBloco - altSetor) / 2 + 1.8;
        for (const linha of rowData.linhasTexto.setor) {
          pdf.text(linha, colSetor.x + 0.8, ySet);
          ySet += 2.2;
        }

        // Processo: fundo branco
        pdf.setFillColor(255, 255, 255);
        pdf.rect(colProc.x, yTop, colProc.w, hBloco, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(4.8);
        pdf.setTextColor(15, 23, 42);
        let yProc = yTop + 2.5;
        for (const linha of rowData.linhasTexto.processo) {
          if (yProc > yTop + hBloco - 1) break;
          pdf.text(linha, colProc.x + 0.8, yProc);
          yProc += 2.1;
        }

        i = j;
      }

      // 2. Células mescladas por GES (GES, Função)
      for (let i = 0; i < linhasPagina.length; ) {
        const chave = linhasPagina[i].chaveGes;
        let j = i;
        while (j < linhasPagina.length && linhasPagina[j].chaveGes === chave) j++;

        const yTop = yLinhas[i].y;
        const hBloco = (yLinhas[j - 1].y + yLinhas[j - 1].h) - yTop;
        const rowData = linhasPagina[i];

        // GES: fundo suave #FFFBEB, negrito centralizado
        pdf.setFillColor(255, 251, 235);
        pdf.rect(colGes.x, yTop, colGes.w, hBloco, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.0);
        pdf.setTextColor(15, 23, 42);
        pdf.text(rowData.dados.ges, colGes.x + colGes.w / 2, yTop + hBloco / 2 + 1.2, { align: "center" });

        // Função: fundo branco
        pdf.setFillColor(255, 255, 255);
        pdf.rect(colFun.x, yTop, colFun.w, hBloco, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(4.8);
        pdf.setTextColor(15, 23, 42);
        let yFun = yTop + 2.5;
        for (const linha of rowData.linhasTexto.funcoes) {
          if (yFun > yTop + hBloco - 1) break;
          pdf.text(linha, colFun.x + 0.8, yFun);
          yFun += 2.1;
        }

        i = j;
      }

      // 3. Célula mesclada por AGENTE (Grupo de risco NR-09 com cor oficial)
      for (let i = 0; i < linhasPagina.length; ) {
        const chave = linhasPagina[i].chaveAgente;
        let j = i;
        while (j < linhasPagina.length && linhasPagina[j].chaveAgente === chave) j++;

        const yTop = yLinhas[i].y;
        const hBloco = (yLinhas[j - 1].y + yLinhas[j - 1].h) - yTop;
        const rowData = linhasPagina[i];
        const grupo = rowData.item.grupo;
        const cor = corDoGrupo(grupo);
        const rgbFundo = hexToRgb(cor.fundo);
        const rgbTexto = hexToRgb(cor.texto);

        pdf.setFillColor(...rgbFundo);
        pdf.rect(colAgente.x, yTop, colAgente.w, hBloco, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.0);
        pdf.setTextColor(...rgbTexto);

        const partesAgente = pdf.splitTextToSize(GRUPO_LABEL[grupo] || grupo || "—", colAgente.w - 1.0) as string[];
        let yAg = yTop + (hBloco - partesAgente.length * 2.4) / 2 + 1.8;
        for (const linha of partesAgente) {
          pdf.text(linha, colAgente.x + colAgente.w / 2, yAg, { align: "center" });
          yAg += 2.4;
        }

        i = j;
      }

      // 4. Células individuais por item de risco (colunas 6 a 19)
      linhasPagina.forEach((row, k) => {
        const rowY = yLinhas[k].y;
        const rowH = yLinhas[k].h;

        // Fundo branco padrão nas colunas 6 a 18
        for (let cIdx = 6; cIdx <= 18; cIdx++) {
          const col = colunasComX[cIdx];
          pdf.setFillColor(255, 255, 255);
          pdf.rect(col.x, rowY, col.w, rowH, "F");

          pdf.setFont("helvetica", cIdx >= 16 ? "bold" : "normal");
          pdf.setFontSize(cIdx >= 16 ? 5.5 : 4.8);
          pdf.setTextColor(15, 23, 42);

          const linhas = row.linhasTexto[col.chave];
          if (col.align === "center") {
            const altT = linhas.length * 2.1;
            let ty = rowY + (rowH - altT) / 2 + 1.8;
            for (const l of linhas) {
              pdf.text(l, col.x + col.w / 2, ty, { align: "center" });
              ty += 2.1;
            }
          } else {
            let ty = rowY + 2.4;
            for (const l of linhas) {
              if (ty > rowY + rowH - 1) break;
              pdf.text(l, col.x + 0.8, ty);
              ty += 2.1;
            }
          }
        }

        // Coluna 19: Classificação do risco com cor oficial
        const colCls = colunasComX[19];
        const classe = row.classe;
        if (classe) {
          const corCls = corDaClasse(classe);
          const rgbClsFundo = hexToRgb(corCls.fundo);
          const rgbClsTexto = hexToRgb(corCls.texto);
          pdf.setFillColor(...rgbClsFundo);
          pdf.rect(colCls.x, rowY, colCls.w, rowH, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(5.2);
          pdf.setTextColor(...rgbClsTexto);
          pdf.text(row.dados.classificacao, colCls.x + colCls.w / 2, rowY + rowH / 2 + 1.2, { align: "center" });
        } else {
          pdf.setFillColor(241, 245, 249);
          pdf.rect(colCls.x, rowY, colCls.w, rowH, "F");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(5.0);
          pdf.setTextColor(100);
          pdf.text("—", colCls.x + colCls.w / 2, rowY + rowH / 2 + 1.2, { align: "center" });
        }

        // Linha divisória horizontal entre itens nas colunas 6 a 19
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.2);
        pdf.line(colunasComX[6].x, rowY + rowH, 287, rowY + rowH);
      });

      // Grade e bordas verticais da página
      pdf.setDrawColor(215, 220, 228);
      pdf.setLineWidth(0.2);

      colunasComX.forEach((c) => {
        pdf.line(c.x, b.y, c.x, yPos);
      });
      pdf.line(287, b.y, 287, yPos);

      // Linhas horizontais separadoras de setor
      for (let i = 0; i < linhasPagina.length; i++) {
        const chaveAtual = linhasPagina[i].chaveSetor;
        const chaveProx = i + 1 < linhasPagina.length ? linhasPagina[i + 1].chaveSetor : null;
        if (chaveProx !== chaveAtual) {
          pdf.setDrawColor(245, 158, 11);
          pdf.setLineWidth(0.35);
          pdf.line(10, yLinhas[i].y + yLinhas[i].h, 287, yLinhas[i].y + yLinhas[i].h);
          pdf.setDrawColor(215, 220, 228);
          pdf.setLineWidth(0.2);
        }
      }

      b.y = yPos;
      idx = idxFim;

      if (idx < itensPreparados.length) {
        pdf.addPage([297, 210], "landscape");
        b.y = 15;
        desenharCabecalho();
      }
    }

    b.y += 3;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(100);

    const expostosLista = (ctx.inventario as any[])
      .map((i) => i.trabalhadores_expostos)
      .filter((n) => n != null && n > 0) as number[];
    const maiorExp = expostosLista.length ? Math.max(...expostosLista) : 0;
    const expTexto = maiorExp > 0 ? `Trabalhadores expostos: ${maiorExp}` : "Trabalhadores expostos: não informado";

    pdf.text(
      `Classificação PGR — Trivial (1-3) · Tolerável (4-8) · Moderado (9-12) · Substancial (13-15) · Intolerável (16-25). Campos sem dado exibem N.A.    ·    ${expTexto}`,
      10,
      b.y,
    );
    pdf.setTextColor(0);
    b.y += 4;
  };

  const desenharPlano = () => {
  if (ctx.acoes.length === 0) {
      para(b, "Nenhuma ação registrada.");
    } else {
      /*
       * Vinte e três colunas: as oito do 5W2H, os doze meses do cronograma e
       * mais três. A soma, com a margem de 12 mm e 0,8 mm entre colunas, tem
       * de caber nos 287 mm da borda. Estourando, as últimas são desenhadas
       * fora do papel — e no PDF não há aviso: elas simplesmente somem.
       */
      const MES_W = 3.8;
      const COLS_PLANO: { rotulo: string; chave: string; w: number }[] = [
        { rotulo: "SETOR", chave: "setor", w: 17 },
        { rotulo: "GES", chave: "ges", w: 8 },
        { rotulo: "O QUÊ? (MEDIDA)", chave: "oque", w: 27 },
        { rotulo: "POR QUÊ?", chave: "porque", w: 21 },
        { rotulo: "COMO?", chave: "como", w: 23 },
        { rotulo: "ONDE?", chave: "onde", w: 13 },
        { rotulo: "QUANTO?", chave: "quanto", w: 13 },
        { rotulo: "PRIOR.", chave: "prioridade", w: 10 },
        ...MESES_PDF.map((m) => ({ rotulo: m[0], chave: `mes_${m}`, w: MES_W })),
        { rotulo: "RESPONSÁVEL", chave: "responsavel", w: 16 },
        { rotulo: "STATUS", chave: "status", w: 17 },
        { rotulo: "ACOMPANHAMENTO E AFERIÇÃO", chave: "afericao", w: 20 },
      ];
      let xPlano = 12;
      const colunasPlano = COLS_PLANO.map((c) => {
        const col = { rotulo: c.rotulo, x: xPlano, w: c.w };
        xPlano += c.w + 2;
        return col;
      });
      const addAcao = tabela(b, colunasPlano, {
        fonte: 6, fonteCabecalho: 5.6, grade: true, cabecalhoEscuro: true,
      });

      const setorDaAcao = (a: any) => {
        const item = (ctx.inventario as any[]).find((i) => i.id === a.inventario_item_id);
        return item?.setor
          || ((ctx.setores as any[]) || []).find((s: any) => s.id === item?.setor_id)?.nome
          || "";
      };
      const gesDaAcao = (a: any) => {
        const item = (ctx.inventario as any[]).find((i) => i.id === a.inventario_item_id);
        const mapa: Record<string, string> = (ctx.ghes as any) || {};
        return item ? (mapa[item.ges_id] || mapa[item.ghe_id] || "") : "";
      };

      ctx.acoes.forEach((a: any) => {
        const meses: number[] = a.meses_execucao || [];
        const statusLabel = ACAO_STATUS_LABEL[a.status as PgrAcaoStatus] || a.status || "";

        const celulas = COLS_PLANO.map((c) => {
          if (c.chave.startsWith("mes_")) {
            const indice = MESES_PDF.indexOf(c.chave.slice(4));
            return meses.includes(indice + 1) ? "X" : "";
          }
          switch (c.chave) {
            case "setor": return setorDaAcao(a);
            case "ges": return gesDaAcao(a);
            /* A quebra de linha vinda do cadastro vira espaço: o jsPDF quebra
               em \n e a célula sairia mais alta do que a linha reservada. */
            case "oque": return String(a.what || a.descricao || "").replace(/\s*\n+\s*/g, " ");
            case "porque": return a.why || "";
            case "como": return a.how || "";
            case "onde": return a.where_local || "";
            case "quanto": return a.how_much != null ? fmtMoeda(a.how_much) : (a.quanto_texto || "");
            case "prioridade": return prioridadePdf(a.prioridade);
            case "responsavel": return a.who || a.responsavel_nome || "";
            case "status": return statusLabel;
            case "afericao":
              return [a.forma_acompanhamento, a.indicador].filter(Boolean).join("; ");
            default: return "";
          }
        });

        /*
         * O mês previsto é CÉLULA PINTADA, como na planilha — não um "X" solto.
         * É o que faz o cronograma se ler de cima a baixo numa olhada.
         */
        const pintadas: { col: number; fundo: [number, number, number]; texto: [number, number, number] }[] = [];
        COLS_PLANO.forEach((c, i) => {
          if (!c.chave.startsWith("mes_")) return;
          const indice = MESES_PDF.indexOf(c.chave.slice(4));
          if (meses.includes(indice + 1)) {
            pintadas.push({ col: i, fundo: [15, 42, 68], texto: [255, 255, 255] });
          }
        });
        const corStatus = STATUS_PDF_COR[statusLabel];
        if (corStatus) {
          pintadas.push({
            col: COLS_PLANO.findIndex((c) => c.chave === "status"),
            fundo: corStatus,
            texto: [0, 0, 0],
          });
        }
        addAcao(celulas, undefined, pintadas);
      });

      /* Legenda do status e do cronograma, como na planilha. */
      b.y += 2;
      ensure(b, 8);
      pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal"); pdf.setTextColor(90);
      /*
       * A legenda lista os status QUE ESTÃO na tabela. Antes listava as chaves
       * do mapa de cores, e uma ação "Cancelada" — que não tem cor — aparecia
       * na coluna sem constar da legenda logo abaixo.
       */
      const statusNaTabela = [...new Set(
        (ctx.acoes as any[]).map((a: any) => ACAO_STATUS_LABEL[a.status as PgrAcaoStatus] || a.status)
          .filter(Boolean),
      )];
      pdf.text(
        "Mês marcado = prazo previsto para a ação."
          + (statusNaTabela.length ? "  ·  Status: " + statusNaTabela.join("  ·  ") : ""),
        12, b.y,
      );
      pdf.setTextColor(0);
      b.y += 6;
    }
  };

  /** A tabela das letras "a" a "i" do item 1.5.7.3.2. */
  const desenharExigencias = (exig: [string, string, string][]) => {
    const larguraTotal = (b.direita ?? 200) - 20;
    const linha = tabela(
      b,
      [
        { rotulo: "ITEM", x: 12, w: 14 },
        { rotulo: "EXIGÊNCIA DA NR-01", x: 28, w: larguraTotal * 0.45 },
        { rotulo: "ONDE ESTÁ NO INVENTÁRIO", x: 30 + larguraTotal * 0.45, w: larguraTotal * 0.45 },
      ],
      { fonte: 7.5, fonteCabecalho: 7, grade: true, cabecalhoEscuro: true },
    );
    exig.forEach(([item, exigencia, onde]) => linha([`"${item}"`, exigencia, onde]));
    b.y += 3;
  };

  /** Um bloco de seção, no mesmo formato do gerador de Word. */
  const bloco = (sec: typeof DEF_PGR.secoes[number]) => {
    if (sec.ref) refNorma(b, sec.ref);
    if (sec.texto) para(b, sec.texto, 9, [40, 40, 40]);
    if (sec.itens) {
      sec.itens.forEach((it) => {
        ensure(b, 6);
        const linhas = pdf.splitTextToSize(it, (b.direita ?? 200) - 24) as string[];
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(40);
        linhas.forEach((l) => { pdf.text(l, 18, b.y); b.y += 4; });
        b.y += 1.5;
      });
      pdf.setTextColor(0);
    }
    if (sec.matriz) drawMatriz(b);
    if (sec.exig) desenharExigencias(sec.exig);
    if (sec.inventario) desenharInventario();
    if (sec.plano) desenharPlano();
  };

  let emPaisagem = false;
  for (const sec of DEF_PGR.secoes) {
    const querPaisagem = Boolean(sec.paisagem);
    if (querPaisagem !== emPaisagem) {
      if (querPaisagem) paisagem(); else retrato();
      emPaisagem = querPaisagem;
    } else {
      pdf.addPage(querPaisagem ? [297, 210] : "a4", querPaisagem ? "landscape" : "portrait");
      b.y = 15;
    }
    title(b, sec.t);
    bloco(sec);
    (sec.sub || []).forEach((filho) => {
      subNumerado(b, filho.t);
      bloco(filho);
    });
  }

  /* O encerramento do pacote, com a data e o local. */
  if (emPaisagem) { retrato(); emPaisagem = false; }
  else { pdf.addPage("a4", "portrait"); b.y = 15; }
  title(b, "Encerramento");
  para(b, DEF_PGR.encerramento || "", 9, [40, 40, 40]);
  const cidadeFecho = [principal?.cidade, principal?.uf].filter(Boolean).join(" / ");
  if (cidadeFecho || pgr.data_emissao) {
    ensure(b, 10);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(40);
    pdf.text(
      [cidadeFecho, fmtDate(pgr.data_emissao)].filter(Boolean).join(", ") + ".",
      (b.direita ?? 200), b.y + 4, { align: "right" },
    );
    pdf.setTextColor(0);
    b.y += 12;
  }

  /*
   * As assinaturas fecham o ENCERRAMENTO, sem seção própria.
   *
   * No documento em Word o documento termina em "7. Encerramento": o texto,
   * a data e, logo abaixo, as duas linhas de assinatura. O PDF abria uma
   * "8. Assinaturas" que o Word não tem — uma seção a mais no sumário e uma
   * numeração que deixava de bater entre os dois documentos.
   *
   * 1.5.7.2 da NR-01: os documentos do PGR são elaborados sob
   * responsabilidade da organização, datados e assinados.
   */
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
  /*
   * A nota sobre hash e MFA descreve as assinaturas REGISTRADAS. Saindo
   * sempre, o documento sem assinatura nenhuma afirmava "assinatura visual com
   * hash SHA-256 e MFA verificado" e, duas linhas abaixo, "nenhuma assinatura
   * eletrônica registrada" — uma contradição no fecho do documento.
   */
  if (ctx.assinaturas.length > 0) {
    para(b, "Assinatura visual com hash SHA-256 e MFA verificado. Não constitui assinatura digital ICP-Brasil.");
  }
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
    ensure(b, 34);
    b.y += 6;
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
    /* Nome em branco no registro não pode derrubar a geração do PDF inteiro:
       o jsPDF recusa `undefined` e o documento não sai. */
    pdf.text(a.responsavel_nome || "—", 12, b.y + 16);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
    pdf.text(`${a.responsavel_registro || "—"}  ·  ${fmtDT(a.assinado_em)}  ·  MFA ${a.mfa_verificado ? "OK" : "—"}  ·  PDF v${a.pdf_versao}`, 12, b.y + 19);
    pdf.text(`Hash assinado: ${a.pdf_hash || "—"}`, 12, b.y + 22);
    b.y += 26;
  });



  sumario(pdf, b.toc);

  await rodapePaginas(pdf, {
    qrUrl: opts.qrUrl,
    marca: opts.comMarca ? (pgr.status === "em_revisao" ? "EM REVISÃO" : "RASCUNHO") : null,
    logoDataUrl: ctx.logoDataUrl,
    tituloCabecalho: "PGR – Programa de Gerenciamento de Riscos",
    subtituloCabecalho: [
      ctx.empresaNome,
      pgr.data_vigencia_inicio && pgr.data_vigencia_fim
        ? `Vigência: ${fmtDate(pgr.data_vigencia_inicio)} a ${fmtDate(pgr.data_vigencia_fim)}`
        : null,
    ].filter(Boolean).join("   |   "),
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

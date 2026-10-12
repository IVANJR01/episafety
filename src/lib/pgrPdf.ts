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
const EXPOSICAO_PDF: Record<string, string> = {
  continua: "Permanente",
  intermitente: "Intermitente",
  eventual: "Eventual",
  nao_aplicavel: "",
};

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

  /*
   * A capa é a Simples com moldura do pacote — a mesma dos seis documentos
   * em Word. As linhas da tabela são as de niveis.js: Empresa, CNPJ,
   * Endereço, Responsável Técnico e Revisão / Data.
   */
  const matriz = (ctx.unidades || [])[0] as PgrUnidadeItem | undefined;
  const enderecoCapa = [
    matriz?.endereco || [matriz?.logradouro, matriz?.numero].filter(Boolean).join(", "),
    [matriz?.cidade, matriz?.uf].filter(Boolean).join("/"),
  ].filter(Boolean).join(" – ");
  const respCapa = [pgr.resp_tec_nome, pgr.resp_tec_registro].filter(Boolean).join(" – ");
  const anoCapa = (pgr.data_emissao || new Date().toISOString()).slice(0, 4);

  capaTimbrada(pdf, {
    logoDataUrl: ctx.logoDataUrl,
    revisao: `REV. ${numeroDaRevisao(ctx.revisoes)}`,
    meta: `PGR v${pgr.versao} · PDF v${opts.pdfVersao} · ${PGR_STATUS_LABEL[pgr.status]}`,
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
     * Campo sem dado não vai para a capa, mas a LINHA fica: a tabela da capa
     * do Word tem sempre as mesmas cinco linhas, e tirar uma delas mudaria o
     * desenho da capa de uma empresa para outra.
     */
    linhasTabela: [
      ["Empresa", ctx.empresaNome || ""],
      ["CNPJ", ctx.empresaCnpj || ""],
      ["Endereço", enderecoCapa],
      ["Responsável Técnico", respCapa],
      ["Revisão / Data", `${numeroDaRevisao(ctx.revisoes)} – ${fmtDate(pgr.data_emissao)}`],
    ],
    rodapeLocal: [matriz?.cidade, matriz?.uf].filter(Boolean).join(" / ")
      ? `${[matriz?.cidade, matriz?.uf].filter(Boolean).join(" / ")} – ${anoCapa}`
      : anoCapa,
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
    ["Grau de Risco (NR-04)", principal?.grau_risco != null ? String(principal.grau_risco) : ""],
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

  const desenharInventario = () => {
  if (ctx.inventario.length === 0) {
      para(b, "Nenhum item de inventário registrado.");
    } else {
      /*
       * As larguras são as do pacote, proporcionais, cabendo nos 277 mm úteis
       * da página deitada. Mexer numa exige recalcular o conjunto: a tabela não
       * se ajusta sozinha, e sobra ou falta acaba desenhado fora do papel.
       */
      const COLS: { rotulo: string; chave: string; w: number }[] = [
        { rotulo: "AGENTE", chave: "agente", w: 15 },
        { rotulo: "PERIGO", chave: "perigo", w: 22 },
        { rotulo: "FONTE / CIRCUNSTÂNCIA", chave: "fonte", w: 22 },
        { rotulo: "POSSÍVEIS LESÕES OU AGRAVOS", chave: "lesoes", w: 28 },
        { rotulo: "LIMITE DE EXPOSIÇÃO", chave: "limite", w: 14 },
        { rotulo: "INTENS. / CONC.", chave: "intensidade", w: 13 },
        { rotulo: "TIPO / TEMPO DE EXPOSIÇÃO", chave: "exposicao", w: 16 },
        { rotulo: "TÉCNICA UTILIZADA", chave: "tecnica", w: 17 },
        { rotulo: "EPC / PROCEDIMENTO ADMINISTRATIVO", chave: "medidas", w: 32 },
        { rotulo: "EPI", chave: "epi", w: 18 },
        { rotulo: "ATENUAÇÃO / FP", chave: "atenuacao", w: 14 },
        { rotulo: "P", chave: "probabilidade", w: 5 },
        { rotulo: "S", chave: "severidade", w: 5 },
        { rotulo: "NÍVEL", chave: "nivel", w: 8 },
        { rotulo: "CLASSIFICAÇÃO", chave: "classificacao", w: 18 },
      ];
      /*
       * 12 mm de margem + as larguras + 0,8 mm entre colunas tem de caber nos
       * 287 mm da borda direita. Somando mais do que isso, as últimas colunas
       * saem desenhadas fora do papel — foi o que aconteceu com
       * CLASSIFICAÇÃO, que saía cortada na metade.
       */
      /*
       * 2 mm de vão entre colunas: é nele que a linha da grade passa, com 1 mm
       * de folga de cada lado. Com 0,8 mm o texto encostava na linha.
       */
      let xAcumulado = 12;
      const colunas = COLS.map((c) => {
        const col = { rotulo: c.rotulo, x: xAcumulado, w: c.w };
        xAcumulado += c.w + 2;
        return col;
      });
      const addLinha = tabela(b, colunas, {
        fonte: 6.3, fonteCabecalho: 6, grade: true, cabecalhoEscuro: true,
      });

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
       * A faixa que abre cada GES — letras "a", "b" e "e" do 1.5.7.3.2.
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
        const expostosGrupo = itens
          .map((i) => i.trabalhadores_expostos)
          .filter((n) => n != null && n > 0) as number[];
        const maior = expostosGrupo.length ? Math.max(...expostosGrupo) : 0;

        const cabecalho = [
          `GES: ${ges}`,
          setor && `Setor: ${setor}`,
          funcoes && `Funções: ${funcoes}`,
          maior > 0 ? `Trabalhadores expostos: ${maior}` : "Trabalhadores expostos: não informado",
        ].filter(Boolean).join("    ·    ");
        const detalhes = [
          primeiro.descricao_ambiente && `Ambiente: ${primeiro.descricao_ambiente}`,
          primeiro.processo && `Processo / atividades: ${primeiro.processo}`,
        ].filter(Boolean) as string[];

        const larguraUtil = (b.direita ?? 200) - 14;
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
        const linhasCab = pdf.splitTextToSize(cabecalho, larguraUtil) as string[];
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
        const linhasDet = detalhes.flatMap((d) => pdf.splitTextToSize(d, larguraUtil) as string[]);
        const altura = linhasCab.length * 3.6 + linhasDet.length * 3.2 + 3;

        if (b.y + altura + 8 > (b.limiteY ?? 278)) {
          pdf.addPage([297, 210], "landscape");
          b.y = 15;
          addLinha.cabecalho();
        }
        pdf.setFillColor(227, 234, 242);
        pdf.rect(10, b.y, (b.direita ?? 200) - 10, altura, "F");
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

      /** O valor de cada coluna, do jeito que a planilha escreve. */
      const valorDaColuna = (i: any, chave: string): string => {
        switch (chave) {
          /*
           * O agente sai pelo rótulo, não pelo valor do banco. Saía "[fisico]",
           * "[quimico]", "[psicossocial]" — minúsculo, sem acento e entre
           * colchetes, que é o nome do enum, não português.
           */
          case "agente": return GRUPO_LABEL[i.grupo] || i.grupo || "";
          case "perigo": return i.perigo_descricao || "";
          case "fonte": return i.fonte_geradora || "";
          case "lesoes": return i.lesoes || "";
          case "limite": return i.limite_tolerancia || "";
          case "intensidade":
            return i.intensidade
              || (i.medicao_valor != null
                ? `${i.medicao_valor}${i.medicao_unidade ? " " + i.medicao_unidade : ""}`
                : "");
          /* O tempo descrito diz mais que o tipo; na falta dele, o tipo. */
          case "exposicao": return i.tempo_exposicao || EXPOSICAO_PDF[i.tipo_exposicao] || "";
          case "tecnica": return i.tecnica_utilizada || "";
          case "medidas":
            return Array.isArray(i.controles_existentes)
              ? i.controles_existentes.filter(Boolean).join("; ")
              : (i.controles_existentes || "");
          case "epi": return i.epi || "";
          case "atenuacao": return i.atenuacao || "";
          case "probabilidade": return i.probabilidade != null ? String(i.probabilidade) : "";
          case "severidade": return i.severidade != null ? String(i.severidade) : "";
          default: return "";
        }
      };

      for (const chave of chavesOrdenadas) {
        const itens = grupos.get(chave)!;
        faixaDoGes(itens);

        itens.forEach((i: any) => {
          /*
           * Nível e classificação são CALCULADOS aqui, nunca lidos do dado —
           * a mesma regra do Word e da planilha.
           */
          const temAval = i.probabilidade != null && i.severidade != null;
          const nivel = temAval ? Number(i.probabilidade) * Number(i.severidade) : null;
          const classe: PgrClasse | null =
            nivel != null ? classificarMatriz(i.severidade, i.probabilidade) : null;

          const celulas = COLS.map((c) => {
            if (c.chave === "nivel") return nivel != null ? String(nivel) : "";
            if (c.chave === "classificacao") return classe ? CLASSIF_LABEL[classe].toUpperCase() : "";
            return valorDaColuna(i, c.chave);
          });

          /*
           * Sem a tarja na margem: com a célula de classificação pintada dentro
           * da grade, a tarja ficava do lado de fora da moldura, repetindo a
           * mesma informação e parecendo sobra de desenho.
           */
          const cor = classe ? CLASSE_HEX[classe] : undefined;
          addLinha(
            celulas,
            undefined,
            cor && classe
              ? { col: COLS.length - 1, fundo: cor, texto: CLASSE_TEXTO_HEX[classe] }
              : undefined,
          );
        });
      }
    }
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
      pdf.text(
        "Mês marcado = prazo previsto para a ação.  ·  Status: "
          + Object.keys(STATUS_PDF_COR).join("  ·  "),
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

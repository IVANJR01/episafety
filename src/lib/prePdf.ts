// PRE — Plano de Preparação para Emergências (NR-01, item 1.5.6).
//
// Documento próprio, e não capítulo do PGR. O FAQ GRO/PGR do Ministério do
// Trabalho, pergunta 59, é explícito: a documentação dos procedimentos de
// resposta a emergências deve estar na organização de forma rastreável, "no
// entanto, sem integrar o PGR". Por isso os cenários saíram do PDF do PGR e
// ganharam este gerador, com o mesmo timbre — é o mesmo emissor.
import jsPDF from "jspdf";
import {
  B, capaTimbrada, ensure, fmtDT, fmtDate, para, rodapePaginas, sub, sumario,
  tabela, title,
} from "@/lib/pdfTimbrado";

export const TIPO_CENARIO_LABEL: Record<string, string> = {
  incendio: "Incêndio",
  explosao: "Explosão",
  vazamento_quimico: "Vazamento químico",
  choque_eletrico: "Choque elétrico",
  soterramento: "Soterramento",
  queda_altura: "Queda de altura",
  espaco_confinado: "Emergência em espaço confinado",
  acidente_pessoal: "Acidente pessoal",
  desastre_natural: "Desastre natural",
  contaminacao_biologica: "Contaminação biológica",
  falha_energia: "Falha de energia",
  outro: "Outro",
};

export interface PreCenario {
  id: string;
  nome: string;
  tipo: string;
  descricao?: string | null;
  grande_magnitude: boolean;
  medidas_prevencao?: string | null;
  procedimento_resposta?: string | null;
  primeiros_socorros?: string | null;
  meios_recursos?: string | null;
  responsaveis?: string | null;
  encaminhamento_acidentados?: string | null;
  abandono_ponto_encontro?: string | null;
  comunicacao?: string | null;
  periodicidade_simulado?: string | null;
  ultimo_simulado?: string | null;
  proximo_simulado?: string | null;
  licoes_aprendidas?: string | null;
}

export interface PreContext {
  pgrId: string;
  /** Situação do PGR de origem: decide a marca d'água de rascunho. */
  status: string;
  dataEmissao?: string | null;
  respTecNome?: string | null;
  respTecRegistro?: string | null;
  empresaNome: string | null;
  empresaCnpj: string | null;
  unidadeNome: string | null;
  codigoDocumento?: string | null;
  logoDataUrl?: string | null;
  cenarios: PreCenario[];
}

const tipoLabel = (t: string) => TIPO_CENARIO_LABEL[t] || t;

/**
 * Um campo do cenário, impresso só quando preenchido.
 *
 * Campo vazio vira "—" na tela, mas num plano de emergência uma linha
 * "Primeiros socorros: —" é pior que a ausência: parece procedimento definido
 * como "nada". O que falta aparece na conferência, no fim do documento.
 */
function campo(b: B, rotulo: string, valor?: string | null) {
  if (!valor || !String(valor).trim()) return;
  ensure(b, 8);
  b.doc.setFont("helvetica", "bold"); b.doc.setFontSize(8); b.doc.setTextColor(15, 23, 42);
  b.doc.text(rotulo, 12, b.y + 3);
  b.y += 4;
  para(b, String(valor).trim(), 8);
  b.y += 1;
}

/** O que a NR-01 1.5.6.2 exige de cada cenário — usado na conferência final. */
const EXIGIDOS: Array<[keyof PreCenario, string]> = [
  ["procedimento_resposta", "procedimento de resposta"],
  ["primeiros_socorros", "primeiros socorros"],
  ["encaminhamento_acidentados", "encaminhamento de acidentados"],
  ["abandono_ponto_encontro", "abandono"],
  ["meios_recursos", "meios e recursos"],
];

export function faltasDoCenario(c: PreCenario): string[] {
  return EXIGIDOS
    .filter(([campo]) => !String(c[campo] ?? "").trim())
    .map(([, rotulo]) => rotulo);
}

/** Desenha o documento inteiro. Exportada para o teste conferir o impresso. */
export async function render(
  ctx: PreContext,
  opts: { qrUrl: string; comMarca: boolean },
): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const b: B = { doc: pdf, y: 12, toc: [] };

  capaTimbrada(pdf, {
    logoDataUrl: ctx.logoDataUrl,
    meta: ctx.codigoDocumento ? `Vinculado ao ${ctx.codigoDocumento}` : null,
    sigla: "PRE",
    titulo: "Plano de Preparação para Emergências",
    subtitulo: "Cenários e procedimentos de resposta",
    nota: "Documento técnico — NR-01, item 1.5.6",
    empresaNome: ctx.empresaNome || "Empresa",
    identificacao: [
      ctx.empresaCnpj ? `CNPJ: ${ctx.empresaCnpj}` : null,
      ctx.unidadeNome ? `Unidade: ${ctx.unidadeNome}` : null,
    ].filter(Boolean) as string[],
    dados: [
      `Emitido em: ${fmtDate(ctx.dataEmissao || new Date().toISOString())}`,
      `Responsável Técnico: ${ctx.respTecNome || "—"}`,
      `Registro Profissional: ${ctx.respTecRegistro || "—"}`,
    ],
  });
  pdf.addPage(); b.y = 15;

  title(b, "Objeto e Base Normativa");
  para(b,
    "Este plano reúne os cenários de emergência identificados a partir dos riscos do "
    + "inventário e os procedimentos de resposta correspondentes, conforme o item 1.5.6 da "
    + "NR-01, que obriga a organização a estabelecer, implementar e manter procedimentos de "
    + "resposta de acordo com os riscos, as características e as circunstâncias das atividades.", 8);
  para(b,
    "É documento próprio: segundo o FAQ de Perguntas e Respostas GRO e PGR do Ministério do "
    + "Trabalho, pergunta 59, a documentação dos procedimentos de resposta a emergências deve "
    + "estar na organização de forma rastreável e organizada, sem integrar o PGR.", 8);

  title(b, "Cenários Identificados");
  if (ctx.cenarios.length === 0) {
    para(b, "Nenhum cenário de emergência registrado.");
  } else {
    const linha = tabela(b, [
      { rotulo: "Cenário", x: 12, w: 62 },
      { rotulo: "Tipo", x: 76, w: 42 },
      { rotulo: "Magnitude", x: 120, w: 30 },
      { rotulo: "Responsáveis", x: 152, w: 46 },
    ]);
    ctx.cenarios.forEach((c) => linha([
      c.nome,
      tipoLabel(c.tipo),
      c.grande_magnitude ? "Grande magnitude" : "Resposta própria",
      c.responsaveis || "—",
    ]));
    b.y += 3;
  }

  ctx.cenarios.forEach((c) => {
    title(b, `Procedimento de Resposta — ${c.nome}`);
    sub(b, `${tipoLabel(c.tipo)}${c.grande_magnitude ? "  ·  Emergência de grande magnitude" : ""}`);
    campo(b, "Descrição do cenário", c.descricao);
    campo(b, "Medidas de prevenção", c.medidas_prevencao);
    campo(b, "Procedimento de resposta", c.procedimento_resposta);
    campo(b, "Primeiros socorros", c.primeiros_socorros);
    campo(b, "Encaminhamento de acidentados", c.encaminhamento_acidentados);
    campo(b, "Abandono e ponto de encontro", c.abandono_ponto_encontro);
    campo(b, "Meios e recursos", c.meios_recursos);
    campo(b, "Comunicação e acionamento externo", c.comunicacao);
    campo(b, "Responsáveis", c.responsaveis);
    campo(b, "Lições aprendidas", c.licoes_aprendidas);
  });

  if (ctx.cenarios.length > 0) {
    title(b, "Exercícios Simulados");
    const linha = tabela(b, [
      { rotulo: "Cenário", x: 12, w: 70 },
      { rotulo: "Periodicidade", x: 84, w: 44 },
      { rotulo: "Último", x: 130, w: 30 },
      { rotulo: "Próximo", x: 162, w: 36 },
    ]);
    ctx.cenarios.forEach((c) => linha([
      c.nome,
      c.periodicidade_simulado || "—",
      c.ultimo_simulado ? fmtDate(c.ultimo_simulado) : "—",
      c.proximo_simulado ? fmtDate(c.proximo_simulado) : "—",
    ]));
    b.y += 3;
  }

  /*
   * Conferência ao fim, e não campo por campo no corpo.
   *
   * O plano é lido em emergência: intercalar "não informado" no meio do
   * procedimento atrapalha justamente quem precisa dele. A falta continua
   * visível, num lugar só, para quem revisa o documento.
   */
  const pendencias = ctx.cenarios
    .map((c) => [c.nome, faltasDoCenario(c)] as const)
    .filter(([, faltas]) => faltas.length > 0);
  if (pendencias.length > 0) {
    title(b, "Pendências de Preenchimento");
    para(b,
      "O item 1.5.6.2 da NR-01 exige que os procedimentos prevejam os meios e recursos "
      + "para primeiros socorros, encaminhamento de acidentados e abandono. Faltam:", 8);
    pendencias.forEach(([nome, faltas]) => {
      ensure(b, 6);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(150, 40, 40);
      pdf.text(`• ${nome}: ${faltas.join(", ")}`, 12, b.y + 3);
      pdf.setTextColor(0); b.y += 5;
    });
  }

  title(b, "Assinatura");
  para(b, "Elaborado sob responsabilidade da organização.");
  ensure(b, 22);
  pdf.setDrawColor(180); pdf.line(12, b.y + 12, 100, b.y + 12);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
  pdf.text(ctx.respTecNome || "—", 12, b.y + 16);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
  pdf.text(ctx.respTecRegistro || "—", 12, b.y + 19);
  b.y += 24;

  sumario(pdf, b.toc);

  await rodapePaginas(pdf, {
    qrUrl: opts.qrUrl,
    marca: opts.comMarca ? "RASCUNHO" : null,
    linhas: (p, total) => [
      "QR Code de validação interna — abre o documento no sistema (acesso restrito à empresa).",
      opts.qrUrl,
      `Gerado em ${fmtDT(new Date().toISOString())}  ·  Página ${p}/${total}`,
      "Plano de Preparação para Emergências (NR-01 1.5.6). Documento próprio, não integra o PGR.",
    ],
  });

  return pdf;
}

/** Abre o PRE numa aba, sem gravar nada. */
export async function previsualizarPre(ctx: PreContext): Promise<void> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pdf = await render(ctx, {
    qrUrl: `${origin}/pgr/validar/${ctx.pgrId}?doc=pre`,
    comMarca: ctx.status === "rascunho" || ctx.status === "em_revisao",
  });
  const url = URL.createObjectURL(pdf.output("blob"));
  window.open(url, "_blank", "noopener,noreferrer");
  // Solta o endereço depois de o navegador ter tido tempo de abrir a aba; sem
  // isso o binário do PDF fica preso na memória até a aba principal fechar.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

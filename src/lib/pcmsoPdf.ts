import jsPDF from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { uploadDocumentoSeguro } from "@/lib/secureStorage";
import type { PcmsoPdfContext } from "./pcmsoPdfContextoLoader";

const LARGURA = 210;
const ALTURA = 297;
const MARGEM = 15;
const DIREITA = LARGURA - MARGEM;
const LARGURA_UTIL = DIREITA - MARGEM;

const COR_PRIMARIA: [number, number, number] = [15, 42, 68]; // Azul Marinho
const COR_SECUNDARIA: [number, number, number] = [59, 130, 246]; // Azul Médio
const COR_TEXTO: [number, number, number] = [30, 41, 59];
const COR_CINZA_CLARO: [number, number, number] = [241, 245, 249];
const COR_BORDA: [number, number, number] = [203, 213, 225];

interface BuilderState {
  doc: jsPDF;
  y: number;
  paginaAtual: number;
  totalPaginasEstimada?: number;
}

const fmtDate = (s?: string | null) =>
  s ? new Date(s.length <= 10 ? s + "T00:00:00" : s).toLocaleDateString("pt-BR") : "—";

function ensureSpace(b: BuilderState, needed: number, ctx: PcmsoPdfContext) {
  if (b.y + needed > ALTURA - 22) {
    b.doc.addPage();
    b.paginaAtual++;
    desenharCabecalhoTimbrado(b, ctx);
    b.y = 38;
  }
}

function desenharCabecalhoTimbrado(b: BuilderState, ctx: PcmsoPdfContext) {
  const doc = b.doc;
  const emissor = ctx.emissor;
  const logo = ctx.emissorLogoDataUrl || ctx.empresaLogoDataUrl;

  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.setLineWidth(0.3);

  // Logo ou placeholder do emissor
  if (logo) {
    try {
      doc.addImage(logo, "PNG", MARGEM, 8, 22, 14);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
      doc.text(emissor?.nome || "SAFETY SOLUÇÕES", MARGEM, 16);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(emissor?.nome || "SAFETY SOLUÇÕES", MARGEM, 16);
  }

  // Texto centralizado/alinhado do emissor
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  const nomeEmissor = emissor?.nome ? `${emissor.nome} - PCMSO` : "PCMSO - Programa de Controle Médico de Saúde Ocupacional";
  doc.text(nomeEmissor, LARGURA / 2, 11, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const endEmissor = emissor?.endereco || "Consultoria em Gestão de Saúde e Segurança do Trabalho";
  doc.text(endEmissor, LARGURA / 2, 15, { align: "center" });

  const cnpjEmissor = emissor?.cnpj ? `CNPJ: ${emissor.cnpj}` : "";
  const telEmissor = emissor?.contato ? `Telefone: ${emissor.contato}` : "";
  const infoEmissor = [cnpjEmissor, telEmissor].filter(Boolean).join("  •  ");
  if (infoEmissor) {
    doc.text(infoEmissor, LARGURA / 2, 19, { align: "center" });
  }

  doc.line(MARGEM, 23, DIREITA, 23);
}

function desenharTituloSecao(b: BuilderState, num: string, titulo: string, ctx: PcmsoPdfContext) {
  ensureSpace(b, 16, ctx);
  const doc = b.doc;
  b.y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text(`${num} – ${titulo.toUpperCase()}`, MARGEM, b.y);
  b.y += 3;
  doc.setDrawColor(COR_SECUNDARIA[0], COR_SECUNDARIA[1], COR_SECUNDARIA[2]);
  doc.setLineWidth(0.8);
  doc.line(MARGEM, b.y, MARGEM + 45, b.y);
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.setLineWidth(0.3);
  doc.line(MARGEM + 45, b.y, DIREITA, b.y);
  b.y += 6;
}

function desenharParagrafo(b: BuilderState, texto: string, ctx: PcmsoPdfContext, fontSize = 8.5, espacoAbaixo = 4) {
  const doc = b.doc;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
  const linhas = doc.splitTextToSize(texto, LARGURA_UTIL);
  const altura = linhas.length * (fontSize * 0.44);
  ensureSpace(b, altura + espacoAbaixo, ctx);
  doc.text(linhas, MARGEM, b.y);
  b.y += altura + espacoAbaixo;
}

export async function renderPcmsoPdf(ctx: PcmsoPdfContext): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const b: BuilderState = {
    doc,
    y: 0,
    paginaAtual: 1,
  };

  const { empresa, medicoCoordenador, pcmso, emissor } = ctx;

  // =========================================================================
  // PÁGINA 1: CAPA OFICIAL
  // =========================================================================
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, LARGURA, ALTURA, "F");

  // Faixa lateral estética
  doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.rect(0, 0, 10, ALTURA, "F");
  doc.setFillColor(COR_SECUNDARIA[0], COR_SECUNDARIA[1], COR_SECUNDARIA[2]);
  doc.rect(10, 0, 3, ALTURA, "F");

  // Logo da consultoria/emissor no topo
  if (ctx.emissorLogoDataUrl || ctx.empresaLogoDataUrl) {
    try {
      doc.addImage(ctx.emissorLogoDataUrl || ctx.empresaLogoDataUrl!, "PNG", 30, 30, 45, 25);
    } catch {}
  }

  // Título e Subtítulo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text("PCMSO", 30, 105);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(COR_SECUNDARIA[0], COR_SECUNDARIA[1], COR_SECUNDARIA[2]);
  doc.text("Programa de Controle Médico de Saúde Ocupacional", 30, 116);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Norma Regulamentadora NR-07 (Portaria SEPRT nº 6.734/2020)", 30, 124);

  // Linha divisória
  doc.setDrawColor(COR_SECUNDARIA[0], COR_SECUNDARIA[1], COR_SECUNDARIA[2]);
  doc.setLineWidth(1);
  doc.line(30, 132, 175, 132);

  // Caixa de identificação da empresa na capa
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(30, 155, 150, 65, 3, 3, "FD");
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.setLineWidth(0.3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("EMPREGADOR / EMPRESA CONTRATANTE", 36, 166);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  const nomeEmpLinhas = doc.splitTextToSize(empresa.nome, 138);
  doc.text(nomeEmpLinhas, 36, 174);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
  doc.text(`CNPJ: ${empresa.cnpj || "Não informado"}`, 36, 187);
  doc.text(`CNAE: ${empresa.cnae_principal || "—"}  •  Grau de Risco: ${empresa.grau_risco || "02"}`, 36, 193);
  doc.text(`Endereço: ${empresa.endereco_completo || "—"}`, 36, 199, { maxWidth: 138 });

  // Rodapé da capa com vigência
  const vigenciaInicio = fmtDate(pcmso.data_vigencia_inicio);
  const vigenciaFim = fmtDate(pcmso.data_vigencia_fim);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text(`Vigência: ${vigenciaInicio} a ${vigenciaFim}`, 30, 255);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Médico do Trabalho Coordenador: ${medicoCoordenador.nome} — CRM/${medicoCoordenador.uf} ${medicoCoordenador.crm}`, 30, 261);
  doc.text(`Documento emitido via Sistema Integrado SSAS Safety Soluções`, 30, 267);

  // =========================================================================
  // PÁGINA 2: FOLHA DE ROSTO E SUMÁRIO COMPLETO
  // =========================================================================
  doc.addPage();
  b.paginaAtual++;
  desenharCabecalhoTimbrado(b, ctx);
  b.y = 28;

  // Tabela superior de vigência
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 12, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text(`INÍCIO DA VALIDADE: ${vigenciaInicio}`, MARGEM + 5, b.y + 7);
  doc.text(`REVISAR ATÉ: ${vigenciaFim}`, MARGEM + 95, b.y + 7);
  b.y += 14;

  // Bloco de Identificação Detalhado
  const dadosId: [string, string][] = [
    ["Empregador:", `${empresa.nome} (Grau de Risco: ${empresa.grau_risco || "2"})`],
    ["Endereço:", empresa.endereco_completo || "—"],
    ["CNPJ:", `${empresa.cnpj || "—"}          Telefone: ${empresa.telefone || "—"}`],
    ["CNAE:", `(${empresa.cnae_principal || "—"}) ${empresa.cnae_descricao || "Atividade Econômica"}`],
    ["Autor / Médico Resp.:", `${medicoCoordenador.nome}          CRM: ${medicoCoordenador.crm} / ${medicoCoordenador.uf}`],
  ];

  doc.rect(MARGEM, b.y, LARGURA_UTIL, dadosId.length * 7.5, "FD");
  let iy = b.y;
  dadosId.forEach(([rotulo, val], index) => {
    doc.line(MARGEM, iy + 7.5, DIREITA, iy + 7.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(rotulo, MARGEM + 3, iy + 5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(val, MARGEM + 40, iy + 5, { maxWidth: 135 });
    iy += 7.5;
  });
  b.y = iy + 8;

  // Sumário das 15 Seções do PCMSO Oficial
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text("SUMÁRIO", MARGEM, b.y);
  b.y += 3;
  doc.setDrawColor(COR_SECUNDARIA[0], COR_SECUNDARIA[1], COR_SECUNDARIA[2]);
  doc.setLineWidth(0.6);
  doc.line(MARGEM, b.y, MARGEM + 30, b.y);
  b.y += 5;

  const sumarioItens = [
    "01 – APRESENTAÇÃO",
    "02 – LEGISLAÇÕES APLICADAS",
    "03 – CONSIDERAÇÕES GERAIS SOBRE O PCMSO",
    "04 – RESPONSABILIDADES DA EMPRESA",
    "05 – EXAMES E PLANEJAMENTO CONFORME NR-7",
    "06 – DEFINIÇÕES SOBRE O ASO - ATESTADO DE SAÚDE OCUPACIONAL",
    "07 – MÉDICO RESPONSÁVEL E RELATÓRIO ANALÍTICO MEDIANTE NR-7",
    "08 – TELEFONES ÚTEIS EM CASO DE EMERGÊNCIA",
    "09 – CAIXA DE PRIMEIROS SOCORROS",
    "10 – AMBIENTES, CARGOS, RISCOS OCUPACIONAIS E EXAMES CLÍNICOS",
    "11 – MÉDICOS EXAMINADORES",
    "12 – CONSIDERAÇÕES FINAIS",
    "13 – TERMO DE COMPROMISSO",
    "14 – REFERÊNCIA BIBLIOGRÁFICA",
    "15 – CRONOGRAMA DE AÇÕES",
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
  sumarioItens.forEach((item) => {
    doc.text(item, MARGEM + 2, b.y);
    b.y += 5.2;
  });

  // =========================================================================
  // SEÇÃO 01: APRESENTAÇÃO
  // =========================================================================
  desenharTituloSecao(b, "01", "Apresentação", ctx);
  desenharParagrafo(
    b,
    "O Programa de Controle Médico de Saúde Ocupacional – PCMSO é um programa médico de atenção à saúde do trabalhador, implementado pela Organização, visando a prevenção e/ou o diagnóstico precoce de danos causados à saúde por agentes agressivos presentes no ambiente de trabalho. O programa deve considerar todos os aspectos e questões que incidem na saúde dos trabalhadores, tanto no plano individual quanto coletivo.",
    ctx
  );
  desenharParagrafo(
    b,
    "A Norma Regulamentadora 07 estabelece diretrizes e requisitos para o desenvolvimento do Programa de Controle Médico de Saúde Ocupacional - PCMSO nas organizações, com o objetivo de proteger e preservar a saúde de seus empregados em relação aos riscos ocupacionais, conforme avaliação de riscos do Programa de Gerenciamento de Risco - PGR da organização.",
    ctx
  );
  desenharParagrafo(
    b,
    "Esta Norma se aplica às organizações e aos órgãos públicos da administração direta e indireta, bem como aos órgãos dos poderes legislativo e judiciário e ao Ministério Público, que possuam empregados regidos pela Consolidação das Leis do Trabalho - CLT.",
    ctx
  );

  // =========================================================================
  // SEÇÃO 02: LEGISLAÇÕES APLICADAS
  // =========================================================================
  desenharTituloSecao(b, "02", "Legislações Aplicadas", ctx);
  desenharParagrafo(
    b,
    "O Programa de Controle Médico de Saúde Ocupacional – PCMSO tem sua origem e vigência baseado nas seguintes legislações:",
    ctx
  );
  desenharParagrafo(
    b,
    "• A Lei N. 6.514, de 22 de dezembro de 1977 – Alteração do Capítulo V do Título II da Consolidação das Leis do Trabalho, aprovado pelo Decreto-Lei N. 5.452 de 1 de Maio de 1943: Incumbe ao Ministério do Trabalho estabelecer normas, coordenar, orientar e supervisionar a fiscalização em todo o Território Nacional na matéria de Segurança e Medicina do Trabalho.",
    ctx
  );
  desenharParagrafo(
    b,
    "• Portaria N. 3.214, de 08 de junho de 1978 – Aprova as Normas Regulamentadoras – NRs – relativas à Segurança e Medicina do Trabalho.",
    ctx
  );
  desenharParagrafo(
    b,
    "• A Portaria SEPRT n.º 6.734, de 10 de março de 2020, estabelece a nova NR 7 - PROGRAMA DE CONTROLE MÉDICO DE SAÚDE OCUPACIONAL, regulamentando todo o processo de desenvolvimento e execução do PCMSO.",
    ctx
  );
  desenharParagrafo(
    b,
    "Este documento está atualizado de acordo com a versão mais recente da NR-7 (Portaria SEPRT n.º 6.734/2020, que passou a vigorar em 03 de janeiro de 2022). Os parâmetros e diretrizes deste PCMSO estão plenamente harmonizados com o Inventário de Riscos do PGR (NR-01) da organização.",
    ctx
  );

  // =========================================================================
  // SEÇÃO 03: CONSIDERAÇÕES GERAIS SOBRE O PCMSO
  // =========================================================================
  desenharTituloSecao(b, "03", "Considerações Gerais sobre o PCMSO", ctx);
  desenharParagrafo(
    b,
    "O PCMSO é parte integrante do conjunto mais amplo de iniciativas da organização no campo da saúde de seus empregados, devendo estar harmonizado com o disposto nas demais Normas Regulamentadoras. São diretrizes do PCMSO:",
    ctx
  );

  const diretrizes = [
    "a) rastrear e detectar precocemente os agravos à saúde relacionados ao trabalho;",
    "b) detectar possíveis exposições excessivas a agentes nocivos ocupacionais;",
    "c) definir a aptidão de cada empregado para exercer suas funções ou tarefas determinadas;",
    "d) subsidiar a implantação e o monitoramento da eficácia das medidas de prevenção adotadas na organização;",
    "e) subsidiar análises epidemiológicas e estatísticas sobre os agravos à saúde e sua relação com os riscos ocupacionais;",
    "f) subsidiar decisões sobre o afastamento de empregados de situações de trabalho que possam comprometer sua saúde;",
    "g) subsidiar a emissão de notificações de agravos relacionados ao trabalho, de acordo com a regulamentação pertinente;",
    "h) subsidiar o encaminhamento de empregados à Previdência Social;",
    "i) acompanhar de forma diferenciada o empregado cujo estado de saúde possa ser especialmente afetado pelos riscos ocupacionais;",
    "j) subsidiar a Previdência Social nas ações de reabilitação profissional;",
    "k) subsidiar ações de readaptação profissional;",
    "l) controlar a imunização ativa dos empregados, relacionada a riscos ocupacionais, sempre que houver recomendação do Ministério da Saúde.",
  ];
  diretrizes.forEach((d) => desenharParagrafo(b, d, ctx, 8, 2.5));

  desenharParagrafo(
    b,
    "O PCMSO inclui ações de vigilância passiva da saúde ocupacional (demanda espontânea) e vigilância ativa (exames dirigidos com foco em sinais e sintomas de agravos à saúde ocupacional). O PCMSO não tem caráter de seleção de pessoal.",
    ctx,
    8.5,
    5
  );

  // =========================================================================
  // SEÇÃO 04: RESPONSABILIDADES DA EMPRESA
  // =========================================================================
  desenharTituloSecao(b, "04", "Responsabilidades da Empresa", ctx);
  desenharParagrafo(
    b,
    "Compete ao empregador: garantir a elaboração e efetiva implantação do PCMSO; custear sem ônus para o empregado todos os procedimentos e exames relacionados ao programa; indicar médico do trabalho responsável pelo PCMSO.",
    ctx
  );
  desenharParagrafo(
    b,
    "Em caso de substituição do médico responsável pelo PCMSO, a organização deve garantir que os prontuários médicos sejam formalmente transferidos para seu sucessor. O prontuário do empregado deve ser mantido pela organização, no mínimo, por 20 (vinte) anos após o seu desligamento, exceto em caso de previsão diversa constante nos Anexos da NR-07.",
    ctx
  );

  // =========================================================================
  // SEÇÃO 05: EXAMES E PLANEJAMENTO CONFORME NR-7
  // =========================================================================
  desenharTituloSecao(b, "05", "Exames e Planejamento conforme NR-7", ctx);
  desenharParagrafo(
    b,
    "O PCMSO inclui a realização obrigatória dos exames médicos ocupacionais nas seguintes modalidades: a) Admissional; b) Periódico; c) Retorno ao trabalho; d) Mudança de riscos ocupacionais; e) Demissional.",
    ctx
  );
  desenharParagrafo(
    b,
    "Periodicidade estabelecida pela NR-07:",
    ctx,
    8.5,
    2
  );
  desenharParagrafo(
    b,
    "• Admissional: realizado antes que o empregado assuma suas atividades.\n" +
      "• Periódico: a cada 1 ano para empregados expostos a riscos ocupacionais identificados e classificados no PGR ou portadores de doenças crônicas; a cada 2 anos para os demais empregados não expostos a riscos ocupacionais específicos.\n" +
      "• Retorno ao Trabalho: realizado antes do retorno às funções quando ausente por período igual ou superior a 30 (trinta) dias por motivo de doença ou acidente, de natureza ocupacional ou não.\n" +
      "• Mudança de Riscos Ocupacionais: realizado obrigatoriamente antes da data da mudança de função ou setor que implique novos riscos.\n" +
      "• Demissional: realizado em até 10 (dez) dias contados do término do contrato, sendo dispensado se o exame mais recente tiver sido feito há menos de 135 dias (Grau de Risco 1 e 2) ou menos de 90 dias (Grau de Risco 3 e 4).",
    ctx,
    8,
    4
  );

  // =========================================================================
  // SEÇÃO 06: DEFINIÇÕES SOBRE O ASO
  // =========================================================================
  desenharTituloSecao(b, "06", "Definições sobre o ASO - Atestado de Saúde Ocupacional", ctx);
  desenharParagrafo(
    b,
    "Para cada exame clínico ocupacional realizado, o médico emitirá o ASO (em duas vias físicas ou meio digital formal), contendo: razão social e CNPJ da empresa; nome, CPF e função do empregado; descrição dos perigos ou fatores de risco identificados no PGR; indicação e data dos exames clínicos e complementares; definição de apto ou inapto para a função; nome e registro profissional do médico responsável pelo PCMSO e do médico examinador que realizou o exame.",
    ctx
  );

  // =========================================================================
  // SEÇÃO 07: MÉDICO RESPONSÁVEL E RELATÓRIO ANALÍTICO
  // =========================================================================
  desenharTituloSecao(b, "07", "Médico Responsável e Relatório Analítico mediante NR-7", ctx);
  desenharParagrafo(
    b,
    "O médico responsável pelo PCMSO elabora anualmente o Relatório Analítico, contendo estatística dos exames realizados, resultados anormais, incidência de doenças ocupacionais e dados epidemiológicos.",
    ctx
  );

  // Tabela de Balanço Estatístico de ASOs
  const estat = ctx.estatisticasAsos;
  ensureSpace(b, 35, ctx);
  doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("BALANÇO ESTATÍSTICO DE EXAMES OCUPACIONAIS E ASOS EMITIDOS", MARGEM + 3, b.y + 4.2);
  b.y += 6;

  const colW = LARGURA_UTIL / 4;
  const linhasEstat: [string, number][] = [
    ["Exames Admissionais", estat.admissional],
    ["Exames Periódicos", estat.periodico],
    ["Retorno ao Trabalho", estat.retorno],
    ["Mudança de Risco", estat.mudanca],
    ["Exames Demissionais", estat.demissional],
    ["Total de ASOs Emitidos", estat.total],
    ["Colaboradores Aptos", estat.aptos],
    ["Aptos com Restrição / Inaptos", estat.restricoes + estat.inaptos],
  ];

  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.setFillColor(255, 255, 255);
  for (let i = 0; i < linhasEstat.length; i += 2) {
    const item1 = linhasEstat[i];
    const item2 = linhasEstat[i + 1];

    doc.rect(MARGEM, b.y, colW * 2, 6, "FD");
    doc.rect(MARGEM + colW * 2, b.y, colW * 2, 6, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);

    doc.text(item1[0], MARGEM + 3, b.y + 4.2);
    doc.setFont("helvetica", "bold");
    doc.text(String(item1[1]), MARGEM + colW * 2 - 6, b.y + 4.2, { align: "right" });

    if (item2) {
      doc.setFont("helvetica", "normal");
      doc.text(item2[0], MARGEM + colW * 2 + 3, b.y + 4.2);
      doc.setFont("helvetica", "bold");
      doc.text(String(item2[1]), DIREITA - 6, b.y + 4.2, { align: "right" });
    }

    b.y += 6;
  }
  b.y += 4;

  if (ctx.relatorioAnaliticoTexto) {
    desenharParagrafo(b, `Parecer do Médico Coordenador:\n${ctx.relatorioAnaliticoTexto}`, ctx, 8, 4);
  }

  // =========================================================================
  // SEÇÃO 08: TELEFONES ÚTEIS EM CASO DE EMERGÊNCIA
  // =========================================================================
  desenharTituloSecao(b, "08", "Telefones Úteis em Caso de Emergência", ctx);
  const telefones = [
    ["Ambulância / SAMU - Serviço Público de Remoção de Doentes", "192"],
    ["Corpo de Bombeiros Militar", "193"],
    ["Polícia Militar", "190"],
    ["Defesa Civil", "199"],
    ["Disque Intoxicação (ANVISA / CEATOX)", "0800 722 6001"],
  ];

  ensureSpace(b, telefones.length * 6 + 5, ctx);
  telefones.forEach(([servico, numero]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(servico, MARGEM + 2, b.y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(COR_SECUNDARIA[0], COR_SECUNDARIA[1], COR_SECUNDARIA[2]);
    doc.text(numero, DIREITA - 2, b.y, { align: "right" });

    doc.setDrawColor(230, 235, 240);
    doc.line(MARGEM, b.y + 2, DIREITA, b.y + 2);
    b.y += 6;
  });
  b.y += 4;

  // =========================================================================
  // SEÇÃO 09: CAIXA DE PRIMEIROS SOCORROS (NR 1.5.6.2)
  // =========================================================================
  desenharTituloSecao(b, "09", "Caixa de Primeiros Socorros", ctx);
  desenharParagrafo(
    b,
    "(NR 1.5.6.2) Os procedimentos de respostas aos cenários de emergências da organização devem prever os meios e recursos necessários para os primeiros socorros e encaminhamento de acidentados.",
    ctx
  );
  desenharParagrafo(
    b,
    "A empresa deve manter caixa de primeiros socorros de madeira ou de plástico na cor branca com uma cruz verde encimada na porta ou na tampa, afixada em local de fácil acesso aos colaboradores, com materiais, instrumentos e soluções prescritos pelo médico do trabalho:",
    ctx
  );

  const kitPrimeirosSocorros: [string, string][] = [
    ["INSTRUMENTOS:", "Pinça anatômica, termômetro clínico digital e tesoura de ponta romba."],
    ["MATERIAIS:", "Óculos de proteção, máscara facial descartável, luvas cirúrgicas/procedimento, ataduras de crepe, algodão hidrófilo, hastes flexíveis (cotonetes), gazes esterilizadas, esparadrapo antialérgico e curativos adesivos de pronto uso."],
    ["SOLUÇÕES:", "Água oxigenada (10 volumes), soro fisiológico a 0,9% para lavagem ocular/ferimentos e solução antisséptica tópica (clorexidina ou iodopovidona)."],
  ];

  ensureSpace(b, 25, ctx);
  kitPrimeirosSocorros.forEach(([tipo, desc]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(tipo, MARGEM + 2, b.y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    const dLinhas = doc.splitTextToSize(desc, LARGURA_UTIL - 30);
    doc.text(dLinhas, MARGEM + 30, b.y);
    b.y += dLinhas.length * 4 + 2;
  });
  b.y += 4;

  // =========================================================================
  // SEÇÃO 10: AMBIENTES, CARGOS, RISCOS OCUPACIONAIS E EXAMES CLÍNICOS
  // =========================================================================
  desenharTituloSecao(b, "10", "Ambientes, Cargos, Riscos Ocupacionais e Exames Clínicos", ctx);
  desenharParagrafo(
    b,
    `Abaixo estão relacionados todos os ${ctx.ambientes.length} ambientes identificados no levantamento da empresa onde os trabalhadores desempenham suas atividades:`,
    ctx
  );

  // Listagem dos Ambientes
  ctx.ambientes.forEach((amb) => {
    const descLines = doc.splitTextToSize(`Descrição do Ambiente: ${amb.descricao}`, LARGURA_UTIL - 6);
    const boxHeight = descLines.length * 4 + 9;
    ensureSpace(b, boxHeight + 3, ctx);

    doc.setFillColor(COR_CINZA_CLARO[0], COR_CINZA_CLARO[1], COR_CINZA_CLARO[2]);
    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, boxHeight, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(`⬛  ${amb.nome.toUpperCase()}`, MARGEM + 3, b.y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(descLines, MARGEM + 3, b.y + 9);

    b.y += boxHeight + 2.5;
  });

  b.y += 6;

  // Detalhamento Cargo a Cargo (Fichas Oficiais idênticas ao modelo de 52 páginas)
  ctx.cargos.forEach((cargo) => {
    ensureSpace(b, 55, ctx);

    // Faixa do Cargo
    doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`CARGO: ${cargo.nome.toUpperCase()}`, MARGEM + 3, b.y + 5);
    b.y += 7;

    // Tabela de Ambientes e Atividades do Cargo
    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(255, 255, 255);

    const ativLines = doc.splitTextToSize(cargo.atividades, LARGURA_UTIL - 28);
    const hAtiv = Math.max(7, ativLines.length * 3.8 + 3);

    // Linha Ambientes
    doc.rect(MARGEM, b.y, 25, 7, "FD");
    doc.rect(MARGEM + 25, b.y, LARGURA_UTIL - 25, 7, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text("Ambientes:", MARGEM + 2, b.y + 4.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(cargo.ambientes.join(", ") || "Todos os ambientes", MARGEM + 27, b.y + 4.8, { maxWidth: LARGURA_UTIL - 30 });
    b.y += 7;

    // Linha Atividades
    doc.rect(MARGEM, b.y, 25, hAtiv, "FD");
    doc.rect(MARGEM + 25, b.y, LARGURA_UTIL - 25, hAtiv, "FD");
    doc.setFont("helvetica", "bold");
    doc.text("Atividades:", MARGEM + 2, b.y + 4.8);
    doc.setFont("helvetica", "normal");
    doc.text(ativLines, MARGEM + 27, b.y + 4.5);
    b.y += hAtiv + 2;

    // Quadro CONTROLE MÉDICO
    ensureSpace(b, 35, ctx);
    doc.setFillColor(248, 250, 252);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 5.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(`CONTROLE MÉDICO - ${cargo.nome.toUpperCase()}`, LARGURA / 2, b.y + 4, { align: "center" });
    b.y += 5.5;

    // Avaliação Clínica Ocupacional (Código eSocial: 0295)
    doc.rect(MARGEM, b.y, 55, 20, "FD");
    doc.rect(MARGEM + 55, b.y, 65, 20, "FD");
    doc.rect(MARGEM + 120, b.y, LARGURA_UTIL - 120, 20, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text("Avaliação Clínica Ocupacional:", MARGEM + 2, b.y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Código eSocial: 0295", MARGEM + 2, b.y + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text("✔ Fazer no Admissional", MARGEM + 58, b.y + 4.5);
    doc.text("✔ Fazer no Demissional", MARGEM + 58, b.y + 8);
    doc.text("✔ Fazer no Retorno ao Trabalho", MARGEM + 58, b.y + 11.5);
    doc.text("✔ Fazer na Mudança de Riscos*", MARGEM + 58, b.y + 15);
    doc.text("✔ Fazer no Periódico", MARGEM + 58, b.y + 18.5);

    doc.setFont("helvetica", "bold");
    doc.text(cargo.exameClinicoPeriodicidade || "O periódico será feito a cada 12 meses.", MARGEM + 123, b.y + 10, { maxWidth: 55 });
    b.y += 20;

    // Exames complementares do cargo (se houver)
    cargo.examesComplementares.forEach((ec) => {
      ensureSpace(b, 14, ctx);
      doc.rect(MARGEM, b.y, 55, 12, "FD");
      doc.rect(MARGEM + 55, b.y, 65, 12, "FD");
      doc.rect(MARGEM + 120, b.y, LARGURA_UTIL - 120, 12, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
      doc.text(ec.nome, MARGEM + 2, b.y + 5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Código eSocial: ${ec.codigoEsocial}`, MARGEM + 2, b.y + 9);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
      doc.text("✔ Fazer no Admissional", MARGEM + 58, b.y + 5);
      doc.text("✔ Fazer no Periódico", MARGEM + 58, b.y + 9);

      doc.setFont("helvetica", "bold");
      doc.text(ec.periodicidade, MARGEM + 123, b.y + 7, { maxWidth: 55 });
      b.y += 12;
    });

    b.y += 2;

    // Tabelas de Riscos Ocupacionais do Cargo
    const desenharQuadroRisco = (tituloGrupo: string, bgCor: [number, number, number], listaRiscos: any[]) => {
      if (listaRiscos.length === 0) return;
      ensureSpace(b, 25, ctx);

      // Faixa do Grupo
      doc.setFillColor(bgCor[0], bgCor[1], bgCor[2]);
      doc.rect(MARGEM, b.y, LARGURA_UTIL, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(tituloGrupo, LARGURA / 2, b.y + 3.8, { align: "center" });
      b.y += 5;

      listaRiscos.forEach((r) => {
        const pLines = doc.splitTextToSize(`Perigos, fontes e circunstâncias: ${r.fonte}`, LARGURA_UTIL - 4);
        const mLines = doc.splitTextToSize(`Medidas administrativas ou de organização do trabalho: ${r.medidas}`, LARGURA_UTIL - 4);
        const dLines = doc.splitTextToSize(`Possíveis danos à saúde: ${r.danos}`, LARGURA_UTIL - 4);
        const totH = (pLines.length + mLines.length + dLines.length) * 3.6 + 14;

        ensureSpace(b, totH, ctx);
        doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
        doc.setFillColor(255, 255, 255);
        doc.rect(MARGEM, b.y, LARGURA_UTIL, totH, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
        doc.text(`■  ${r.agente}`, MARGEM + 2, b.y + 4.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
        let ry = b.y + 8;
        doc.text(pLines, MARGEM + 2, ry);
        ry += pLines.length * 3.6;

        doc.text(`Metodologia: ${r.metodologia || "Critério Qualitativo."}`, MARGEM + 2, ry);
        ry += 3.6;

        doc.text(mLines, MARGEM + 2, ry);
        ry += mLines.length * 3.6;

        doc.setFont("helvetica", "bold");
        doc.text(dLines, MARGEM + 2, ry);

        b.y += totH;
      });
      b.y += 2;
    };

    desenharQuadroRisco(`RISCOS ACIDENTES / MECÂNICOS - ${cargo.nome.toUpperCase()}`, [71, 85, 105], cargo.riscosAcidentes);
    desenharQuadroRisco(`RISCOS ERGONÔMICOS - ${cargo.nome.toUpperCase()}`, [202, 138, 4], cargo.riscosErgonomicos);
    desenharQuadroRisco(`RISCOS QUÍMICOS - ${cargo.nome.toUpperCase()}`, [185, 28, 28], cargo.riscosQuimicos);
    desenharQuadroRisco(`RISCOS FÍSICOS - ${cargo.nome.toUpperCase()}`, [37, 99, 235], cargo.riscosFisicos);
    desenharQuadroRisco(`RISCOS BIOLÓGICOS - ${cargo.nome.toUpperCase()}`, [16, 149, 193], cargo.riscosBiologicos);

    b.y += 5;
  });

  // =========================================================================
  // SEÇÃO 11: PROFISSIONAIS EXAMINADORES
  // =========================================================================
  desenharTituloSecao(b, "11", "Profissionais Examinadores", ctx);
  desenharParagrafo(
    b,
    "Médicos examinadores e profissionais capacitados autorizados a realizar os exames clínicos ocupacionais (ASO) vinculados a este PCMSO:",
    ctx
  );

  ensureSpace(b, ctx.medicosExaminadores.length * 5 + 6, ctx);
  ctx.medicosExaminadores.forEach((med) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(`${med.nome}`, MARGEM + 4, b.y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`CRM-${med.uf} ${med.crm}`, DIREITA - 4, b.y, { align: "right" });
    b.y += 5.2;
  });
  b.y += 4;

  // =========================================================================
  // SEÇÃO 12: CONSIDERAÇÕES FINAIS
  // =========================================================================
  desenharTituloSecao(b, "12", "Considerações Finais", ctx);
  desenharParagrafo(
    b,
    "Este programa PCMSO poderá sofrer modificações quando forem constatadas significativas alterações nas condições ambientais ou no exercício profissional que justifiquem novas medidas ou ações de saúde, tendo por objetivo a preservação e promoção da saúde dos colaboradores. Sendo assim, sempre que houver qualquer modificação nos processos produtivos, aquisição de novos maquinários ou novos locais de trabalho devem ser imediatamente comunicados ao elaborador do PGR, a fim de manter-se informado e tomar as medidas necessárias para as boas práticas de saúde e segurança no local de trabalho, dentre elas a atualização dos programas PGR e PCMSO.",
    ctx
  );

  // =========================================================================
  // SEÇÃO 13: TERMO DE COMPROMISSO
  // =========================================================================
  desenharTituloSecao(b, "13", "Termo de Compromisso", ctx);
  desenharParagrafo(
    b,
    "Pelo presente instrumento, nos propomos garantir a viabilização e efetiva implantação do Programa de Controle Médico de Saúde Ocupacional (PCMSO), zelando e custeando sem ônus para os funcionários, os procedimentos e exames em todas as suas etapas, por ser parte integrante do conjunto mais amplo da iniciativa da empresa no campo da prevenção da saúde dos trabalhadores.",
    ctx
  );

  ensureSpace(b, 45, ctx);
  b.y += 12;

  // Assinatura Médico
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.line(MARGEM + 15, b.y, MARGEM + 85, b.y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text(medicoCoordenador.nome, MARGEM + 50, b.y + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Médico do Trabalho — CRM/${medicoCoordenador.uf} ${medicoCoordenador.crm}`, MARGEM + 50, b.y + 8.5, { align: "center" });
  doc.text("Responsável Técnico pelo PCMSO", MARGEM + 50, b.y + 12, { align: "center" });

  // Assinatura Empregador
  doc.line(DIREITA - 85, b.y, DIREITA - 15, b.y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text(empresa.nome, DIREITA - 50, b.y + 4.5, { align: "center", maxWidth: 70 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Direção da Empresa / Representante Legal", DIREITA - 50, b.y + 8.5, { align: "center" });
  doc.text("Responsável pela Execução do PCMSO", DIREITA - 50, b.y + 12, { align: "center" });

  b.y += 22;

  // =========================================================================
  // SEÇÃO 14: REFERÊNCIA BIBLIOGRÁFICA
  // =========================================================================
  desenharTituloSecao(b, "14", "Referência Bibliográfica", ctx);
  const biblio = [
    "• NR-7 - Programa de Controle Médico de Saúde Ocupacional: Portaria SEPRT n.º 6.734, de 09/03/2020.",
    "• NR-1 - Disposições Gerais e Gerenciamento de Riscos Ocupacionais: Portaria SEPRT n.º 6.730, de 09/03/2020.",
    "• NR-17 - Ergonomia: Portaria MTP n.º 423, de 07 de outubro de 2021.",
    "• NR-5 - Comissão Interna de Prevenção de Acidentes e Assédio: Portaria MTP nº 4.219, de 20/12/2022.",
    "• FUNDACENTRO: Guias de Vigilância em Saúde dos Trabalhadores e Critérios de Avaliação de Riscos Ocupacionais.",
    "• CLT - Consolidação das Leis do Trabalho: Decreto-Lei 5.452/1943 e Lei 6.514/1977.",
  ];
  biblio.forEach((item) => desenharParagrafo(b, item, ctx, 8, 2.5));

  // =========================================================================
  // SEÇÃO 15: CRONOGRAMA DE AÇÕES
  // =========================================================================
  desenharTituloSecao(b, "15", "Cronograma de Ações", ctx);
  desenharParagrafo(
    b,
    "Plano de Ação e Cronograma Anual do PCMSO para atendimento aos requisitos normativos e prevenção da saúde dos colaboradores:",
    ctx
  );

  ctx.cronograma.forEach((acao) => {
    ensureSpace(b, 28, ctx);

    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(COR_CINZA_CLARO[0], COR_CINZA_CLARO[1], COR_CINZA_CLARO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(`CRONOGRAMA ANUAL — ${acao.acao}`, MARGEM + 3, b.y + 4.2);
    doc.text(`Status: ${acao.status || "Planejado"}`, DIREITA - 3, b.y + 4.2, { align: "right" });
    b.y += 6;

    doc.setFillColor(255, 255, 255);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 18, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text("Responsável:", MARGEM + 3, b.y + 5);
    doc.text("Previsão / Data:", MARGEM + 95, b.y + 5);
    doc.text("Observações:", MARGEM + 3, b.y + 11);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(acao.responsavel || "Direção da empresa", MARGEM + 26, b.y + 5);
    doc.text(fmtDate(acao.data_planejada) || "Durante a vigência", MARGEM + 120, b.y + 5);
    doc.text(acao.observacoes || "Atendimento às determinações do programa.", MARGEM + 26, b.y + 11, { maxWidth: LARGURA_UTIL - 30 });

    b.y += 20;
  });

  // =========================================================================
  // RODAPÉ COM PAGINAÇÃO EM TODAS AS PÁGINAS (Menos a Capa)
  // =========================================================================
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, ALTURA - 14, DIREITA, ALTURA - 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `PCMSO — ${empresa.nome} (Vigência: ${vigenciaInicio} a ${vigenciaFim})`,
      MARGEM,
      ALTURA - 9
    );
    doc.text(
      `Página ${p} de ${total}`,
      DIREITA,
      ALTURA - 9,
      { align: "right" }
    );
  }

  return doc;
}

export async function generateAndUploadPcmsoPdf(pcmsoId: string): Promise<{ blob: Blob; fileName: string; viewLink?: string }> {
  const { carregarPcmsoPdfContexto } = await import("./pcmsoPdfContextoLoader");
  const ctx = await carregarPcmsoPdfContexto(pcmsoId);
  const pdf = await renderPcmsoPdf(ctx);

  const blob = pdf.output("blob");
  const empSlug = (ctx.empresa.nome || "empresa").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30);
  const fileName = `PCMSO_${empSlug}_v${ctx.pcmso.versao || 1}.pdf`;

  // Download automático no navegador do usuário
  if (typeof window !== "undefined") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // Tenta upload seguro no storage
  try {
    const up = await uploadDocumentoSeguro({
      empresa_id: ctx.empresa.id,
      kind: "pdf",
      modulo: "pcmso" as any,
      documento_id: pcmsoId,
      versao: ctx.pcmso.versao || 1,
      fileName,
      blob,
      driveFolderFallback: `PCMSO/Documento`,
    });

    await (supabase.from as any)("pcmso_documentos")
      .update({
        pdf_drive_file_id: up.ref,
        pdf_drive_view_link: up.viewLink,
        pdf_gerado_em: new Date().toISOString(),
      })
      .eq("id", pcmsoId);

    return { blob, fileName, viewLink: up.viewLink };
  } catch (err) {
    console.warn("[pcmsoPdf] Aviso: upload no storage retornou fallback, download local garantido.", err);
    return { blob, fileName };
  }
}

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInDays } from "date-fns";

const GRUPOS: { k: string; l: string }[] = [
  { k: "fisico", l: "Físicos" },
  { k: "quimico", l: "Químicos" },
  { k: "biologico", l: "Biológicos" },
  { k: "ergonomico", l: "Ergonômicos" },
  { k: "acidente", l: "Acidentes" },
];

function chk(b: boolean) { return b ? "(X)" : "( )"; }

function formatarNumeroAsoParaPdf(n?: string | null): string {
  if (!n) return "—";
  const m = String(n).match(/(\d+)\s*$/);
  return m ? m[1] : String(n);
}

function inferValidadeTipo(aso: any): string | null {
  // Regra automática: demissional => 90 dias; demais => 1 ano
  const tipo = String(aso.tipo_exame || "").toLowerCase();
  if (tipo === "demissional") return "90dias";
  if (["admissional", "periodico", "retorno", "mudanca_risco", "mudanca_funcao"].includes(tipo)) return "1ano";
  // fallback ao salvo
  if (aso.validade_tipo) {
    const v = String(aso.validade_tipo).toLowerCase();
    if (v.includes("90")) return "90dias";
    if (v.includes("6m") || v.includes("semestr")) return "6meses";
    if (v.includes("2")) return "2anos";
    if (v.includes("1")) return "1ano";
  }
  if (aso.data_emissao && aso.data_vencimento) {
    const d = differenceInDays(parseISO(aso.data_vencimento), parseISO(aso.data_emissao));
    if (d <= 100) return "90dias";
    if (d <= 200) return "6meses";
    if (d <= 400) return "1ano";
    return "2anos";
  }
  return null;
}

async function buildPdf(asoId: string): Promise<{ doc: jsPDF; numero: string; nomeFunc: string }> {
  const { data: aso, error } = await supabase
    .from("asos")
    .select(`*, funcionarios:funcionario_id (nome, cpf, cargo), aso_medicos:medico_id (nome, crm, uf_crm), empresa_config:empresa_id (nome, cnpj, endereco)`)
    .eq("id", asoId).single();
  if (error || !aso) throw error || new Error("ASO não encontrado");

  const [{ data: riscos = [] }] = await Promise.all([
    supabase.from("aso_riscos").select("*").eq("aso_id", asoId),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 10;
  const innerW = W - 2 * M;

  const empresa = aso.empresa_config?.nome || "—";
  const cnpj = aso.empresa_config?.cnpj || "—";
  const nome = aso.funcionarios?.nome || "—";
  const cpf = aso.funcionarios?.cpf || "—";
  const cargo = aso.funcionarios?.cargo || "—";
  const numero = formatarNumeroAsoParaPdf(aso.numero_aso);
  const tipo = aso.tipo_exame as string;
  const local = (aso.local_emissao && String(aso.local_emissao).trim()) || (aso.empresa_config?.endereco && String(aso.empresa_config.endereco).trim()) || "—";
  const med = aso.aso_medicos;
  const validadeTipo = inferValidadeTipo(aso);
  const autoConclusao = !!(aso as any).preencher_conclusao_automaticamente;

  const riscosPorGrupo = (k: string) => {
    const items = riscos.filter((r: any) => r.grupo === k).map((r: any) => (r.descricao || "").trim()).filter(Boolean);
    return items.length ? items.join(", ") : "N.A (Não se Aplica)";
  };
  const outrosTxt = (() => {
    const items = riscos.filter((r: any) => r.grupo === "outro").map((r: any) => (r.descricao || "").trim()).filter(Boolean);
    return items.length ? items.join(", ") : "";
  })();

  // Título
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("Atestado de Saúde Ocupacional (ASO)", W / 2, M + 6, { align: "center" });

  let startY = M + 9;
  const tableOpts: any = {
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: 20, valign: "middle" },
    margin: { left: M, right: M },
  };

  // Bloco identificação — linha EMPRESA / CNPJ / N°
  autoTable(doc, {
    ...tableOpts,
    startY,
    body: [
      [
        { content: "EMPRESA:", styles: { fontStyle: "bold", cellWidth: 22 } },
        { content: empresa, styles: { cellWidth: 92 } },
        { content: "CNPJ:", styles: { fontStyle: "bold", cellWidth: 16 } },
        { content: cnpj, styles: { cellWidth: 38 } },
        { content: "N°", styles: { fontStyle: "bold", cellWidth: 8, halign: "center" } },
        { content: numero, styles: { halign: "center" } },
      ],
    ],
  });
  startY = (doc as any).lastAutoTable.finalY;

  // Linha NOME / CPF
  autoTable(doc, {
    ...tableOpts,
    startY,
    body: [
      [
        { content: "NOME:", styles: { fontStyle: "bold", cellWidth: 22 } },
        { content: nome, styles: { cellWidth: 116 } },
        { content: "CPF:", styles: { fontStyle: "bold", cellWidth: 16 } },
        { content: cpf },
      ],
    ],
  });
  startY = (doc as any).lastAutoTable.finalY;

  // Linha FUNÇÃO (largura total — não quebra em coluna estreita)
  autoTable(doc, {
    ...tableOpts,
    startY,
    body: [
      [
        { content: "FUNÇÃO:", styles: { fontStyle: "bold", cellWidth: 22 } },
        { content: cargo, styles: { overflow: "linebreak" } },
      ],
    ],
  });
  startY = (doc as any).lastAutoTable.finalY;

  // Tipo de exame
  autoTable(doc, {
    ...tableOpts,
    startY,
    head: [[{ content: "TIPO DE EXAME", colSpan: 10, styles: { halign: "center", fontStyle: "bold", fillColor: [230, 230, 230] } }]],
    body: [[
      { content: "Admissional" }, { content: chk(tipo === "admissional"), styles: { halign: "center", cellWidth: 8 } },
      { content: "Periódico" }, { content: chk(tipo === "periodico"), styles: { halign: "center", cellWidth: 8 } },
      { content: "Retorno ao Trabalho" }, { content: chk(tipo === "retorno"), styles: { halign: "center", cellWidth: 8 } },
      { content: "Mudança de Risco" }, { content: chk(tipo === "mudanca_risco"), styles: { halign: "center", cellWidth: 8 } },
      { content: "Demissional" }, { content: chk(tipo === "demissional"), styles: { halign: "center", cellWidth: 8 } },
    ]],
    styles: { ...tableOpts.styles, fontSize: 8 },
  });
  startY = (doc as any).lastAutoTable.finalY;

  // Riscos
  const riscoRows: any[] = GRUPOS.map((g) => [
    { content: g.l, styles: { fontStyle: "bold", cellWidth: 28 } },
    { content: riscosPorGrupo(g.k) },
  ]);
  riscoRows.push([
    { content: "Outros:", styles: { fontStyle: "bold" } },
    { content: outrosTxt },
  ]);
  autoTable(doc, {
    ...tableOpts,
    startY,
    head: [[{ content: "FATORES DE RISCO/PERIGO:", colSpan: 2, styles: { halign: "left", fontStyle: "bold", fillColor: [230, 230, 230] } }]],
    body: riscoRows,
  });
  startY = (doc as any).lastAutoTable.finalY;

  // Procedimentos
  const linha = "____/____/____";
  autoTable(doc, {
    ...tableOpts,
    startY,
    head: [
      [{ content: "PROCEDIMENTOS REALIZADOS", colSpan: 6, styles: { halign: "center", fontStyle: "bold", fillColor: [230, 230, 230] } }],
      [{ content: "Exames Complementares", colSpan: 6, styles: { halign: "center", fontStyle: "bold", fillColor: [245, 245, 245] } }],
    ],
    body: [
      [
        { content: "Anamnese" }, { content: linha, styles: { halign: "center" } },
        { content: "Eletrocardiograma" }, { content: linha, styles: { halign: "center" } },
        { content: "Espirometria" }, { content: linha, styles: { halign: "center" } },
      ],
      [
        { content: "Glicemia" }, { content: linha, styles: { halign: "center" } },
        { content: "Eletroencefalograma" }, { content: linha, styles: { halign: "center" } },
        { content: "PA _______mmHg" }, { content: linha, styles: { halign: "center" } },
      ],
      [
        { content: "Urina" }, { content: linha, styles: { halign: "center" } },
        { content: "Audiometria" }, { content: linha, styles: { halign: "center" } },
        { content: "Hemograma" }, { content: linha, styles: { halign: "center" } },
      ],
    ],
  });
  startY = (doc as any).lastAutoTable.finalY;

  // Conclusão
  const aC = autoConclusao;
  autoTable(doc, {
    ...tableOpts,
    startY,
    head: [[{ content: "Conclusão sobre a Capacidade Laborativa", colSpan: 2, styles: { halign: "center", fontStyle: "bold", fillColor: [230, 230, 230] } }]],
    body: [[
      {
        content:
          `${aC ? chk(!!aso.apto_cargo) : "( )"} APTO para as atividades do cargo\n` +
          `${aC ? chk(!!aso.apto_nr35) : "( )"} APTO para trabalho em altura (NR-35)\n` +
          `${aC ? chk(!!aso.apto_restricao) : "( )"} APTO para as atividades do cargo com restrições`,
        styles: { cellWidth: innerW / 2 },
      },
      {
        content:
          `${aC ? chk(!!aso.inapto_cargo) : "( )"} INAPTO para as atividades do cargo\n` +
          `${aC ? chk(!!aso.inapto_nr35) : "( )"} INAPTO para trabalho em altura (NR-35)\n` +
          `${aC ? chk(!!aso.nr35_nao_aplica) : "( )"} Não se aplica (NR-35)`,
      },
    ]],
  });
  startY = (doc as any).lastAutoTable.finalY;

  // Obs padrão + observações livres
  autoTable(doc, {
    ...tableOpts,
    startY,
    body: [
      [{
        content: "Obs.: Em caso de transferência o ASO deverá ser refeito e adaptado aos agentes de risco do local de trabalho",
        styles: { halign: "center", fillColor: [225, 225, 225], fontStyle: "italic", fontSize: 8 },
      }],
      [{ content: "OBSERVAÇÕES:\n" + (aso.observacoes || "") + "\n\n", styles: { minCellHeight: 14 } }],
    ],
  });
  startY = (doc as any).lastAutoTable.finalY;

  // Validade
  autoTable(doc, {
    ...tableOpts,
    startY,
    head: [[{ content: "VALIDADE DO EXAME", colSpan: 8, styles: { halign: "center", fontStyle: "bold", fillColor: [230, 230, 230] } }]],
    body: [[
      { content: "90 Dias" }, { content: chk(validadeTipo === "90dias"), styles: { halign: "center", cellWidth: 8 } },
      { content: "6 Meses" }, { content: chk(validadeTipo === "6meses"), styles: { halign: "center", cellWidth: 8 } },
      { content: "1 (um) ano" }, { content: chk(validadeTipo === "1ano"), styles: { halign: "center", cellWidth: 8 } },
      { content: "2 (dois) anos" }, { content: chk(validadeTipo === "2anos"), styles: { halign: "center", cellWidth: 8 } },
    ]],
  });
  startY = (doc as any).lastAutoTable.finalY;

  // Médico
  autoTable(doc, {
    ...tableOpts,
    startY,
    head: [[{ content: "Nome do Médico Responsável Pelo Exame", styles: { halign: "center", fontStyle: "bold", fillColor: [230, 230, 230] } }]],
    body: [[{
      content: med?.nome ? `${med.nome}${med.crm ? "  —  CRM " + med.crm + (med.uf_crm ? "/" + med.uf_crm : "") : ""}` : " ",
      styles: { minCellHeight: 8 },
    }]],
  });
  startY = (doc as any).lastAutoTable.finalY;

  // Local e data
  autoTable(doc, {
    ...tableOpts,
    startY,
    head: [[{ content: "LOCAL E DATA", styles: { halign: "left", fontStyle: "bold", fillColor: [230, 230, 230] } }]],
    body: [[{
      content: `Local: ${local}` + " ".repeat(120) + "...... / ...... / ......",
    }]],
  });
  startY = (doc as any).lastAutoTable.finalY;

  // Assinaturas
  autoTable(doc, {
    ...tableOpts,
    startY,
    body: [[
      { content: "\n\n_________________________________________________\nAssinatura Médico", styles: { halign: "center", minCellHeight: 22, cellWidth: innerW / 2 } },
      { content: "\n\n_________________________________________________\nAssinatura Colaborador", styles: { halign: "center", minCellHeight: 22 } },
    ]],
  });

  return { doc, numero, nomeFunc: nome };
}

export async function gerarPdfAso(asoId: string) {
  const { doc, numero, nomeFunc } = await buildPdf(asoId);
  const slug = (nomeFunc || "FUNCIONARIO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
  doc.save(`ASO_${slug}_${numero}.pdf`);
}

export async function gerarPdfAsoBlob(asoId: string): Promise<Blob> {
  const { doc } = await buildPdf(asoId);
  return doc.output("blob");
}

import * as XLSX from "xlsx";

export interface ItemInventarioExportavel {
  descricao_ambiente?: string | null;
  setor?: string | null;
  ghe?: { codigo?: string | null; nome?: string | null } | null;
  funcoes_snapshot?: string[] | null;
  processo?: string | null;
  grupo?: string | null;
  tipo_agente?: string | null;
  perigo_descricao?: string | null;
  fonte_geradora?: string | null;
  lesoes?: string | null;
  limite_tolerancia?: string | null;
  intensidade?: string | null;
  medicao_valor?: number | null;
  medicao_unidade?: string | null;
  tempo_exposicao?: string | null;
  tipo_exposicao?: string | null;
  tecnica_utilizada?: string | null;
  metodologia_avaliacao?: string | null;
  controles_existentes?: string[] | string | null;
  epi?: string | null;
  atenuacao?: string | null;
  probabilidade?: number | null;
  severidade?: number | null;
  classificacao?: string | null;
  trabalhadores_expostos?: number | null;
  [key: string]: any;
}

const GRUPO_LABEL: Record<string, string> = {
  fisico: "Físico",
  quimico: "Químico",
  biologico: "Biológico",
  ergonomico: "Ergonômico",
  acidente: "Acidente",
  psicossocial: "Psicossocial",
};

const CLASSE_LABEL: Record<string, string> = {
  trivial: "Trivial",
  toleravel: "Tolerável",
  moderado: "Moderado",
  substancial: "Substancial",
  intoleravel: "Intolerável",
};

export function exportarInventarioXlsx(
  itens: ItemInventarioExportavel[],
  nomeArquivo = "Inventario_de_Riscos.xlsx"
) {
  const cabecalho = [
    "Descrição do ambiente",
    "Setor",
    "GES",
    "Função",
    "Processo",
    "Agente",
    "Tipo de agente",
    "Fonte de exposição",
    "Possíveis lesões ou agravos à saúde",
    "Limite de exposição",
    "Intensidade / concentração",
    "Tipo / tempo de exposição",
    "Técnica utilizada",
    "Proc. administrativo / EPC / organização do trabalho",
    "EPI",
    "Atenuação / fator de proteção",
    "Prob.",
    "Sev.",
    "Total",
    "Classificação do risco",
    "Trabalhadores expostos",
  ];

  const linhas = itens.map((i) => {
    const P = Number(i.probabilidade) || 0;
    const S = Number(i.severidade) || 0;
    const total = P && S ? P * S : "";
    
    let classe = i.classificacao;
    if (!classe && total) {
      if (total <= 3) classe = "trivial";
      else if (total <= 8) classe = "toleravel";
      else if (total <= 12) classe = "moderado";
      else if (total <= 15) classe = "substancial";
      else classe = "intoleravel";
    }

    const medicao = i.intensidade || (i.medicao_valor != null ? `${i.medicao_valor} ${i.medicao_unidade || ""}`.trim() : "");
    const controles = Array.isArray(i.controles_existentes)
      ? i.controles_existentes.join("; ")
      : (i.controles_existentes || "");
    const funcoes = Array.isArray(i.funcoes_snapshot)
      ? i.funcoes_snapshot.join(", ")
      : (i.funcoes_snapshot || (i.funcao?.nome || ""));

    return [
      i.descricao_ambiente || i.ambiente || "",
      i.setor || "",
      i.ghe?.codigo || i.ghe?.nome || i.ges || "",
      funcoes,
      i.processo || "",
      GRUPO_LABEL[i.grupo || ""] || i.grupo || "",
      i.tipo_agente || i.perigo_descricao || "",
      i.fonte_geradora || "",
      i.lesoes || "",
      i.limite_tolerancia || "",
      medicao,
      i.tempo_exposicao || i.tipo_exposicao || "",
      i.tecnica_utilizada || i.metodologia_avaliacao || "",
      controles,
      i.epi || "",
      i.atenuacao || "",
      P || "",
      S || "",
      total || "",
      CLASSE_LABEL[classe || ""] || classe || "",
      i.trabalhadores_expostos ?? "",
    ];
  });

  const dadosCompletos = [cabecalho, ...linhas];
  const ws = XLSX.utils.aoa_to_sheet(dadosCompletos);

  // Ajusta larguras de colunas automaticamente
  ws["!cols"] = cabecalho.map((_, colIdx) => {
    let max = cabecalho[colIdx].length;
    for (const linha of linhas) {
      const val = String(linha[colIdx] ?? "");
      if (val.length > max) max = val.length;
    }
    return { wch: Math.min(Math.max(max + 2, 10), 50) };
  });

  // Congela cabeçalho
  ws["!freeze"] = { xSplit: "0", ySplit: "1" } as any;

  // Adiciona filtro automático
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: dadosCompletos.length - 1, c: cabecalho.length - 1 },
    }),
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventário de Riscos");
  XLSX.writeFile(wb, nomeArquivo.endsWith(".xlsx") ? nomeArquivo : `${nomeArquivo}.xlsx`);
}

export function gerarModeloInventarioXlsx() {
  const colunasExemplo = [
    [
      "Descrição do ambiente",
      "Setor",
      "GES",
      "Função",
      "Processo",
      "Agente",
      "Tipo de agente",
      "Fonte de exposição",
      "Possíveis lesões ou agravos à saúde",
      "Limite de exposição",
      "Intensidade / concentração",
      "Tipo / tempo de exposição",
      "Técnica utilizada",
      "Proc. administrativo / EPC / organização do trabalho",
      "EPI",
      "Atenuação / fator de proteção",
      "Prob.",
      "Sev.",
      "Trabalhadores expostos",
    ],
    [
      "Galpão industrial, piso concreto, ventilação natural por janelas",
      "Costura",
      "01",
      "Costureira, Auxiliar de Costura",
      "Costura e confecção de peças têxteis",
      "Ergonômico",
      "Movimentos repetitivos",
      "Máquina de costura industrial",
      "LER/DORT, dores nos membros superiores",
      "N.A",
      "N.A",
      "Intermitente",
      "Avaliação Qualitativa",
      "Pausas regulares e revezamento de posturas",
      "N.A",
      "N.A",
      2,
      3,
      12,
    ],
    [
      "Galpão industrial com máquinas de corte",
      "Corte",
      "02",
      "Operador de Máquina de Corte",
      "Corte de tecidos e enfesto",
      "Acidente",
      "Cortes e perfurações",
      "Disco de corte rotativo",
      "Cortes nas mãos e dedos",
      "N.A",
      "N.A",
      "Intermitente",
      "Avaliação Qualitativa",
      "Proteção de lâmina e sensor de parada",
      "Luva de malha de aço",
      "Eficaz",
      2,
      4,
      5,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(colunasExemplo);
  ws["!cols"] = colunasExemplo[0].map((c) => ({ wch: Math.max(c.length + 3, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo Inventário");
  XLSX.writeFile(wb, "Modelo_Inventario_de_Riscos.xlsx");
}

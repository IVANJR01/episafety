/*
 * Os dados da vitrine. Fictícios de ponta a ponta — empresa, EPIs e CAs
 * inventados — para que nenhum print saia com informação de cliente.
 */
const EPIS = [
  { id: "1", nome: "CAPACETE DE SEGURANÇA CLASSE B", ca: "31469", validade: "2028-04-30", estoque: 42, estoque_minimo: 10, tamanho: null, categoria: "Proteção da cabeça", fabricante: "MODELO EPIs LTDA", descricao: "Capacete aba frontal", valor: 28.9, empresa_id: "emp-1" },
  { id: "2", nome: "LUVA DE VAQUETA PUNHO CURTO", ca: "40985", validade: "2027-11-20", estoque: 8, estoque_minimo: 15, tamanho: "G", categoria: "Proteção das mãos", fabricante: "MODELO EPIs LTDA", descricao: "Luva de raspa", valor: 14.5, empresa_id: "emp-1" },
  { id: "3", nome: "ÓCULOS DE SEGURANÇA INCOLOR", ca: "16900", validade: "2026-11-25", estoque: 25, estoque_minimo: 10, tamanho: null, categoria: "Proteção dos olhos", fabricante: "MODELO EPIs LTDA", descricao: "Lente incolor antirrisco", valor: 9.9, empresa_id: "emp-1" },
  { id: "4", nome: "PROTETOR AUDITIVO TIPO PLUG", ca: "5745", validade: "2025-08-10", estoque: 60, estoque_minimo: 20, tamanho: null, categoria: "Proteção auditiva", fabricante: "MODELO EPIs LTDA", descricao: "Plug de silicone", valor: 3.2, empresa_id: "emp-1" },
  { id: "5", nome: "BOTINA DE SEGURANÇA BICO COMPOSITE", ca: "42117", validade: "2029-02-15", estoque: 31, estoque_minimo: 12, tamanho: "42", categoria: "Proteção dos pés", fabricante: "MODELO EPIs LTDA", descricao: "Botina elástico", valor: 119.9, empresa_id: "emp-1" },
];

export const DADOS: Record<string, any[]> = { epis: EPIS };

/**
 * Inventário de riscos fictício: três setores, o GES 01 atendendo dois
 * deles, ambiente com texto longo como nos PGRs reais. Nenhum dado de
 * cliente.
 */
const AMBIENTE =
  "Ambiente de trabalho interno, pé direito em torno de 4m, piso industrial, " +
  "paredes de alvenaria, iluminação artificial por lâmpadas tubulares de LED e " +
  "ventilação natural e artificial por ventiladores.";
const ges = (codigo: string, funcoes: string[]) => ({
  id: `ghe-${codigo}`, codigo, nome: `GES ${codigo}`,
  funcoes: funcoes.map((nome_funcao) => ({ nome_funcao })),
});
const risco = (n: number, setor: string, g: any, grupo: string, perigo: string, p: number, s: number) => ({
  id: `item-${n}`, setor, ghe_id: g.id, ghe: g, grupo, tipo_agente: grupo,
  descricao_ambiente: AMBIENTE, processo: "Recebe, confere e organiza os materiais do setor.",
  perigo_descricao: perigo, fonte_geradora: "Mobiliário e equipamentos",
  lesoes: "Dores nos membros superiores e na coluna vertebral",
  tipo_exposicao: "Intermitente", tecnica_utilizada: "Avaliação Qualitativa",
  controles_existentes: ["Revezamento de atividades e pausas"], epi: null,
  probabilidade: p, severidade: s, nivel_risco: p * s,
  classificacao: p * s <= 3 ? "trivial" : p * s <= 8 ? "toleravel" : "moderado",
  created_at: `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`,
});
const g1 = ges("01", ["Auxiliar Administrativo", "Assistente Financeiro"]);
const g2 = ges("02", ["Operador de Produção"]);
export const inventarioFicticio = [
  risco(1, "ADMINISTRATIVO", g1, "ergonomico", "Postura sentada prolongada", 1, 1),
  risco(2, "FINANCEIRO", g1, "ergonomico", "Postura sentada prolongada", 1, 1),
  risco(3, "FINANCEIRO", g1, "ergonomico", "Excesso de demandas no trabalho", 3, 3),
  risco(4, "PRODUÇÃO", g2, "fisico", "Ruído contínuo das máquinas", 2, 4),
  risco(5, "PRODUÇÃO", g2, "ergonomico", "Trabalho em pé", 2, 4),
  risco(6, "PRODUÇÃO", g2, "ergonomico", "Movimentos repetitivos", 2, 2),
  risco(7, "PRODUÇÃO", g2, "acidente", "Partes móveis de máquinas", 2, 5),
  risco(8, "PRODUÇÃO", g2, "acidente", "Queda do mesmo nível", 2, 4),
];

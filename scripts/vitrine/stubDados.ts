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

/* ?tela=analise-epi — dados fictícios: 30 trabalhadores, 6 EPIs, ~6 meses de entregas. */
export const analiseEpiFicticia = (() => {
  const ghes = [{ id: "g1", codigo: "01", nome: "Montagem" }, { id: "g2", codigo: "02", nome: "Elétrica" }];
  const funcionarios = Array.from({ length: 30 }, (_, i) => ({
    id: `f${i}`, nome: `Trabalhador Fictício ${i + 1}`, ghe_id: i % 2 ? "g1" : "g2", setor: i % 3 ? "Produção" : "Manutenção",
  }));
  const epis = [
    { id: "luva", nome: "Luva de vaqueta (fictícia)", estoque: 40, estoque_minimo: 20 },
    { id: "oculos", nome: "Óculos de proteção incolor", estoque: 120, estoque_minimo: 10 },
    { id: "protetor", nome: "Protetor auditivo plug", estoque: 8, estoque_minimo: 30 },
    { id: "bota", nome: "Botina de segurança", estoque: 0, estoque_minimo: 5 },
    { id: "capacete", nome: "Capacete aba frontal", estoque: 25, estoque_minimo: 5 },
    { id: "mascara", nome: "Respirador PFF2", estoque: 300, estoque_minimo: 50 },
  ];
  const prazo: Record<string, number> = { luva: 15, oculos: 60, protetor: 10, bota: 120, capacete: 365, mascara: 7 };
  const hoje = new Date();
  const entregas: { funcionario_id: string; epi_id: string; quantidade: number; data: string; created_at: string; tipo: string }[] = [];
  let semente = 7;
  const aleatorio = () => ((semente = (semente * 9301 + 49297) % 233280) / 233280);
  for (const f of funcionarios) {
    for (const e of epis) {
      const p = f.id === "f3" && e.id === "luva" ? 4 : prazo[e.id];
      for (let d = Math.floor(aleatorio() * p); d < 180; d += Math.max(1, Math.round(p * (0.8 + aleatorio() * 0.4)))) {
        const dt = new Date(hoje.getTime() - (180 - d) * 86400000);
        const hora = 7 + Math.floor(aleatorio() * aleatorio() * 10);
        dt.setUTCHours(hora + 3, Math.floor(aleatorio() * 60));
        entregas.push({ funcionario_id: f.id, epi_id: e.id, quantidade: 1, data: dt.toISOString().slice(0, 10), created_at: dt.toISOString(), tipo: "entrega" });
      }
    }
  }
  return { ghes, funcionarios, epis, entregas };
})();

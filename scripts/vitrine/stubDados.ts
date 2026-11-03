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

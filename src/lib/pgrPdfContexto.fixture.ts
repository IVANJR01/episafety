/*
 * Contexto de PGR para os testes do PDF: uma empresa, um GES, um perigo
 * avaliado (P=4, S=3 → 12, MODERADO) e uma ação de plano. É o mínimo para o
 * documento ter todas as seções, e fica num arquivo só para os testes do PDF
 * não divergirem uns dos outros.
 */
import type { PgrPdfContext } from "./pgrPdf";

const item = {
  id: "i1", ges_id: "g1", ghe_id: "g1", grupo: "fisico", perigo_descricao: "Ruído",
  fonte_geradora: "Máquinas", lesoes: "PAIR", limite_tolerancia: "85 dB(A)",
  intensidade: "88 dB(A)", tipo_exposicao: "continua", tecnica_utilizada: "NHO-01",
  controles_existentes: ["Enclausuramento"], epi: "Protetor auricular", atenuacao: "NRRsf 17",
  avaliacao_tipo: "quantitativa", probabilidade: 4, severidade: 3, classificacao: "moderado",
  trabalhadores_expostos: 5, setor: "PRODUÇÃO", descricao_ambiente: "Galpão",
  processo: "Corte", funcoes_snapshot: ["Operador"],
};

export const CTX: PgrPdfContext = {
  doc: { id: "d1", empresa_id: "e1", unidade_id: null, versao: 2, status: "rascunho",
    data_emissao: "2026-07-01", data_vigencia_inicio: "2026-07-01", data_vigencia_fim: "2027-07-01",
    resp_tec_nome: "Maria Souza", resp_tec_registro: "CREA 123" } as never,
  empresaNome: "EMPRESA TESTE LTDA", empresaCnpj: "11.222.333/0001-44", unidadeNome: null,
  inventario: [item] as never,
  acoes: [{ id: "a1", inventario_item_id: "i1", what: "Enclausurar", why: "Ruído alto",
    how: "Cabine", where_local: "Produção", how_much: 1000, prioridade: 5,
    meses_execucao: [3], who: "SESMT", status: "pendente", classe_risco: "moderado",
    forma_acompanhamento: "Medição", indicador: "< 85 dB" }] as never,
  evidencias: [], revisoes: [], assinaturas: [],
  ghes: { g1: "01" }, textos: {},
  unidades: [{ id: "e1", nome: "EMPRESA TESTE LTDA", cnpj: "11.222.333/0001-44",
    cnae_principal: "14.12-6-01", cnae_secundario: ["13.40-5-01"], grau_risco: 2,
    cidade: "Fortaleza", uf: "CE", endereco: "Rua A, 1", bairro: "Centro",
    cep: "60000-000", telefone: "(85) 3333-4444" }] as never,
  responsaveis: [{ papel: "responsavel_tecnico", nome: "Maria Souza",
    profissao: "Engenheira de Segurança", registro_profissional: "CREA 123",
    uf_registro: "CE" }] as never,
  ambientes: [], processos: [], setores: [], gesDetalhes: [], funcoes: [], atividades: [],
};


import { describe, expect, it } from "vitest";
import {
  montarDadosDocumento, dataBr, grauRisco, prioridadeLabel, mesesLabel,
  sufixoArquivo, AGENTE_POR_GRUPO, EXPOSICAO_LABEL, STATUS_PLANILHA,
  FontesDoDocumento,
} from "./montarDados";

const BASE: FontesDoDocumento = {
  empresa: {
    nome: "Tecelagem São José Ltda", nome_fantasia: "São José", cnpj: "11.222.333/0001-44",
    cnae_principal: "13.51-1-00 - Fabricação de artefatos têxteis", cnae_secundario: ["14.12-6-01", "46.41-9-02"],
    grau_risco: 3, endereco: "Rua das Palmeiras, 250", bairro: "Industrial",
    cidade: "Fortaleza", uf: "CE", cep: "60000-000", telefone: "(85) 3333-4444",
  },
  pgr: {
    versao: 2, data_emissao: "2026-03-15", data_vigencia_inicio: "2026-03-15",
    data_vigencia_fim: "2028-03-14", resp_tec_nome: "Fallback", resp_tec_registro: "999",
  },
  responsaveis: [
    { papel: "responsavel_tecnico", nome: "Maria Souza", formacao: "Engenheira de Segurança", registro: "CREA 12345/CE" },
    { papel: "responsavel_organizacao", nome: "João Diretor" },
  ],
  descricaoRevisao: "Revisão bienal",
};

describe("dados da empresa", () => {
  const d = montarDadosDocumento(BASE).empresa;

  it("preenche os campos da capa e da identificação", () => {
    expect(d.RAZAO_SOCIAL).toBe("Tecelagem São José Ltda");
    expect(d.CNPJ).toBe("11.222.333/0001-44");
    expect(d.CIDADE_UF).toBe("Fortaleza – CE");
    expect(d.CNAE_SECUNDARIO).toBe("14.12-6-01; 46.41-9-02");
    expect(d.GRAU_RISCO).toBe("03 (Três)");
  });

  it("usa o responsável técnico cadastrado, não o nome solto do PGR", () => {
    expect(d.RESPONSAVEL_NOME).toBe("Maria Souza");
    expect(d.RESPONSAVEL_REGISTRO).toBe("CREA 12345/CE");
    expect(d.REPRESENTANTE_EMPRESA).toBe("João Diretor");
  });

  it("cai no nome do PGR quando não há responsável cadastrado", () => {
    const sem = montarDadosDocumento({ ...BASE, responsaveis: [] }).empresa;
    expect(sem.RESPONSAVEL_NOME).toBe("Fallback");
    expect(sem.RESPONSAVEL_REGISTRO).toBe("999");
  });

  it("formata datas, revisão e ano", () => {
    expect(d.DATA_EMISSAO).toBe("15/03/2026");
    expect(d.VIGENCIA_INICIO).toBe("15/03/2026");
    expect(d.VIGENCIA_FIM).toBe("14/03/2028");
    expect(d.REVISAO).toBe("02");
    expect(d.ANO).toBe("2026");
  });

  it("campo ausente fica vazio — nunca inventado", () => {
    const vazio = montarDadosDocumento({ empresa: {}, pgr: {} }).empresa;
    for (const k of ["RAZAO_SOCIAL", "CNPJ", "TELEFONE", "GRAU_RISCO", "DATA_EMISSAO", "ANO"]) {
      expect(vazio[k], `${k} deveria estar vazio`).toBe("");
    }
    /* Vazio é o que faz o gerador escrever {{CAMPO}} em azul. */
    expect(vazio.ARQUIVO).toBe("Empresa");
  });
});

describe("conversões de valor", () => {
  it("data inválida vira vazio, não texto torto", () => {
    expect(dataBr(null)).toBe("");
    expect(dataBr("")).toBe("");
    expect(dataBr("amanhã")).toBe("");
    expect(dataBr("2026-12-31")).toBe("31/12/2026");
  });

  it("grau de risco sai como a NR-04 escreve", () => {
    expect(grauRisco(1)).toBe("01 (Um)");
    expect(grauRisco(4)).toBe("04 (Quatro)");
    expect(grauRisco(null)).toBe("");
    expect(grauRisco(9)).toBe("");
  });

  it("prioridade numérica vira ALTA, MÉDIA ou BAIXA", () => {
    /* No sistema, 4 ou mais é ação crítica. */
    expect(prioridadeLabel(5)).toBe("ALTA");
    expect(prioridadeLabel(4)).toBe("ALTA");
    expect(prioridadeLabel(3)).toBe("MÉDIA");
    expect(prioridadeLabel(1)).toBe("BAIXA");
    expect(prioridadeLabel(null)).toBe("");
  });

  it("meses viram as siglas do cronograma", () => {
    expect(mesesLabel([3, 4])).toEqual(["MAR", "ABR"]);
    expect(mesesLabel([1, 12])).toEqual(["JAN", "DEZ"]);
    expect(mesesLabel([0, 13, 7])).toEqual(["JUL"]);
    expect(mesesLabel(null)).toEqual([]);
  });

  it("o nome do arquivo perde acento e espaço", () => {
    expect(sufixoArquivo("Tecelagem São José Ltda")).toBe("Tecelagem_Sao_Jose_Ltda");
    expect(sufixoArquivo("")).toBe("Empresa");
  });
});

describe("linhas do inventário", () => {
  const inv = (extra: Record<string, unknown> = {}) =>
    montarDadosDocumento({
      ...BASE,
      inventario: [
        {
          descricao_ambiente: "Galpão", setor: "COSTURA", ges_codigo: "3.1",
          funcoes_snapshot: ["Costureira", "Auxiliar"], processo: "Costura de peças",
          grupo: "fisico", perigo_descricao: "Ruído", fonte_geradora: "Máquinas",
          lesoes: "PAIR", limite_tolerancia: "85 dB(A)", tipo_exposicao: "continua",
          tecnica_utilizada: "NHO-01", controles_existentes: ["Enclausuramento", "Rodízio"],
          epi: "Protetor auricular", atenuacao: "NRRsf 17 dB",
          probabilidade: 4, severidade: 3, ...extra,
        },
      ],
    }).inventario![0];

  it("traduz cada coluna da planilha", () => {
    const l = inv();
    expect(l.ambiente).toBe("Galpão");
    expect(l.ghe).toBe("3.1");
    expect(l.funcao).toBe("Costureira, Auxiliar");
    expect(l.agente).toBe("Físico");
    expect(l.exposicao).toBe("Permanente");
    expect(l.medidas).toBe("Enclausuramento\nRodízio");
    expect(l.probabilidade).toBe(4);
    expect(l.severidade).toBe(3);
  });

  it("não traz nível nem classificação: quem calcula é o documento", () => {
    expect(Object.keys(inv())).not.toContain("nivel");
    expect(Object.keys(inv())).not.toContain("classificacao");
  });

  it("psicossocial entra como Ergonômico, conforme a NR-01 1.5.3.1.4", () => {
    expect(inv({ grupo: "psicossocial" }).agente).toBe("Ergonômico");
    expect(AGENTE_POR_GRUPO.psicossocial).toBe("Ergonômico");
  });

  it("grupo sem equivalente na planilha fica em branco, não num agente errado", () => {
    expect(inv({ grupo: "outro" }).agente).toBe("");
    expect(inv({ grupo: "inexistente" }).agente).toBe("");
  });

  it("intensidade sai do texto livre ou do valor medido com unidade", () => {
    expect(inv({ medicao_valor: 88.5, medicao_unidade: "dB(A)" }).intensidade).toBe("88.5 dB(A)");
    expect(inv({ intensidade: "88,5 dB(A)", medicao_valor: 1 }).intensidade).toBe("88,5 dB(A)");
    expect(inv().intensidade).toBe("");
  });

  it("o tempo de exposição escrito tem preferência sobre o tipo", () => {
    expect(inv({ tempo_exposicao: "6h/dia" }).exposicao).toBe("6h/dia");
    expect(inv({ tipo_exposicao: "nao_aplicavel" }).exposicao).toBe("");
    expect(EXPOSICAO_LABEL.continua).toBe("Permanente");
  });
});

describe("linhas do plano de ação", () => {
  const acao = (extra: Record<string, unknown> = {}) =>
    montarDadosDocumento({
      ...BASE,
      acoes: [
        {
          setor: "COSTURA", ges_codigo: "3", what: "Enclausurar as máquinas",
          why: "Reduzir o ruído abaixo do limite", how: "Contratar serviço especializado",
          where_local: "Setor de Costura", quanto_texto: "A orçar",
          prioridade: 5, meses_execucao: [3, 4], responsavel_nome: "Empresa",
          status: "programada", forma_acompanhamento: "Medição após a obra",
          indicador: "dB(A) abaixo de 85", ...extra,
        },
      ],
    }).plano![0];

  it("monta o 5W2H completo", () => {
    const a = acao();
    expect(a.oque).toBe("Enclausurar as máquinas");
    expect(a.porque).toBe("Reduzir o ruído abaixo do limite");
    expect(a.como).toBe("Contratar serviço especializado");
    expect(a.onde).toBe("Setor de Costura");
    expect(a.quanto).toBe("A orçar");
    expect(a.prioridade).toBe("ALTA");
    expect(a.meses).toEqual(["MAR", "ABR"]);
    expect(a.status).toBe("PROGRAMADO");
    expect(a.afericao).toBe("Medição após a obra\ndB(A) abaixo de 85");
  });

  it("traduz cada status que a planilha conhece", () => {
    expect(acao({ status: "em_andamento" }).status).toBe("EM ANDAMENTO");
    expect(acao({ status: "atrasada" }).status).toBe("ATRASADO");
    expect(acao({ status: "concluida" }).status).toBe("REALIZADO");
    expect(acao({ status: "reprogramada" }).status).toBe("REPROGRAMADO");
    expect(acao({ status: "pendente" }).status).toBe("PROGRAMADO");
  });

  it("status sem equivalente não é falsificado: fica em branco e é explicado", () => {
    const bloqueada = acao({ status: "bloqueada" });
    expect(bloqueada.status).toBe("");
    expect(bloqueada.afericao).toContain("Ação bloqueada");

    const cancelada = acao({ status: "cancelada", motivo_cancelamento: "Processo desativado" });
    expect(cancelada.status).toBe("");
    expect(cancelada.afericao).toContain("Ação cancelada: Processo desativado");

    expect(STATUS_PLANILHA.bloqueada).toBe("");
  });

  it("custo em número vira moeda quando não há texto", () => {
    expect(acao({ quanto_texto: null, custo_estimado: 1500 }).quanto).toMatch(/1\.500,00/);
  });

  it("usa os campos antigos quando os do 5W2H estão vazios", () => {
    const a = acao({ what: null, descricao: "Medida antiga", why: null, objetivo: "Motivo antigo" });
    expect(a.oque).toBe("Medida antiga");
    expect(a.porque).toBe("Motivo antigo");
  });
});

import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { montarDadosDocumento, type FontesDoDocumento } from "./montarDados";
import { gerarDocumentoBuffer, nomeArquivo } from "./gerarDocx";

/*
 * Da linha do banco até o Word baixado.
 *
 * Os outros testes cobrem os pedaços: montarDados.test.ts prova a tradução,
 * gerarDocx.fidelidade.test.ts prova que o gerador é o do pacote. Falta a
 * corrente inteira — é onde moram os erros que nenhum dos dois pega, como um
 * campo traduzido com o nome certo mas que o documento não lê.
 *
 * As linhas abaixo têm a forma exata das tabelas: pgr_inventario_itens com
 * `grupo` e `tipo_exposicao` em enum, pgr_acoes com `meses_execucao` em
 * número, pgr_responsaveis com `registro_profissional`.
 */
const BANCO: FontesDoDocumento = {
  empresa: {
    nome: "Tecelagem São José Ltda", nome_fantasia: "São José", cnpj: "11.222.333/0001-44",
    cnae_principal: "13.51-1-00", cnae_secundario: ["14.12-6-01"], grau_risco: 3,
    endereco: "Rua das Palmeiras, 250", bairro: "Industrial", cidade: "Fortaleza",
    uf: "CE", cep: "60000-000", telefone: "(85) 3333-4444",
  },
  pgr: {
    versao: 2, data_emissao: "2026-03-15", data_vigencia_inicio: "2026-03-15",
    data_vigencia_fim: "2028-03-14",
  },
  responsaveis: [
    { papel: "responsavel_tecnico", nome: "Maria Souza", profissao: "Engenheira de Segurança", registro_profissional: "CREA 12345", uf_registro: "CE" },
    { papel: "responsavel_organizacao", nome: "João Diretor" },
  ],
  inventario: [
    {
      descricao_ambiente: "Galpão de produção", setor: "COSTURA", ges_codigo: "3.1",
      funcoes_snapshot: ["Costureira", "Auxiliar de produção"], processo: "Costura de peças",
      grupo: "fisico", perigo_descricao: "Ruído contínuo", fonte_geradora: "Máquinas de costura",
      lesoes: "PAIR", limite_tolerancia: "85 dB(A)", medicao_valor: 88.5, medicao_unidade: "dB(A)",
      tipo_exposicao: "continua", tecnica_utilizada: "NHO-01",
      controles_existentes: ["Enclausuramento parcial"], epi: "Protetor auricular",
      atenuacao: "NRRsf 17 dB", probabilidade: 4, severidade: 3,
    },
    {
      descricao_ambiente: "Galpão de produção", setor: "COSTURA", ges_codigo: "3.1",
      funcoes_snapshot: ["Costureira"], processo: "Costura de peças",
      grupo: "psicossocial", perigo_descricao: "Sobrecarga de demandas",
      lesoes: "Transtorno mental", tipo_exposicao: "intermitente",
      probabilidade: 5, severidade: 5,
    },
  ],
  acoes: [
    {
      setor: "COSTURA", ges_codigo: "3.1", what: "Enclausurar as máquinas",
      why: "Reduzir o ruído abaixo do limite de tolerância", how: "Serviço especializado",
      where_local: "Setor de Costura", quanto_texto: "A orçar", prioridade: 5,
      meses_execucao: [3, 4], responsavel_nome: "Empresa", status: "programada",
      forma_acompanhamento: "Nova medição após a obra", indicador: "dB(A) abaixo de 85",
    },
  ],
  descricaoRevisao: "Revisão bienal",
};

async function textoDoWord() {
  const dados = montarDadosDocumento(BANCO);
  const zip = await JSZip.loadAsync(await gerarDocumentoBuffer("PGR", dados));
  const xml = await zip.file("word/document.xml")!.async("string");
  return { xml, texto: xml.replace(/<[^>]+>/g, ""), dados };
}

describe("do banco ao Word", () => {
  it("leva a identificação da empresa e o responsável para o documento", async () => {
    const { texto } = await textoDoWord();
    expect(texto).toContain("Tecelagem São José Ltda");
    expect(texto).toContain("11.222.333/0001-44");
    expect(texto).toContain("Fortaleza");
    expect(texto).toContain("03 (Três)");
    expect(texto).toContain("Maria Souza");
    expect(texto).toContain("CREA 12345/CE");
    expect(texto).toContain("João Diretor");
    expect(texto).toContain("Revisão bienal");
  }, 30_000);

  it("agrupa o inventário por GES, com setor, funções, ambiente e processo", async () => {
    const { texto } = await textoDoWord();
    expect(texto).toContain("GES 3.1");
    expect(texto).toContain("COSTURA");
    expect(texto).toContain("Costureira, Auxiliar de produção");
    expect(texto).toContain("Galpão de produção");
    expect(texto).not.toMatch(/GHE/);
  }, 30_000);

  it("calcula cada risco e pinta com a cor da faixa", async () => {
    const { xml, texto } = await textoDoWord();
    /* Ruído: 4 x 3 = 12, MODERADO, amarelo. */
    const linhaRuido = xml.split("<w:tr").find((tr) => tr.includes("Ruído contínuo"))!;
    expect(linhaRuido.replace(/<[^>]+>/g, "")).toContain("12");
    expect(linhaRuido.replace(/<[^>]+>/g, "")).toContain("MODERADO");
    expect(linhaRuido).toContain('w:fill="FFFF00"');
    /* Sobrecarga: 5 x 5 = 25, INTOLERÁVEL, vermelho. */
    const linhaCarga = xml.split("<w:tr").find((tr) => tr.includes("Sobrecarga de demandas"))!;
    expect(linhaCarga.replace(/<[^>]+>/g, "")).toContain("25");
    expect(linhaCarga).toContain('w:fill="C00000"');
    expect(texto).toContain("88.5 dB(A)");
  }, 30_000);

  it("o risco psicossocial entra como agente Ergonômico", async () => {
    const { xml } = await textoDoWord();
    const linha = xml.split("<w:tr").find((tr) => tr.includes("Sobrecarga de demandas"))!;
    expect(linha.replace(/<[^>]+>/g, "")).toContain("Ergonômico");
  }, 30_000);

  it("leva o plano de ação com o 5W2H e o cronograma marcado", async () => {
    const { xml, texto } = await textoDoWord();
    expect(texto).toContain("Enclausurar as máquinas");
    expect(texto).toContain("Reduzir o ruído abaixo do limite de tolerância");
    expect(texto).toContain("PROGRAMADO");
    expect(texto).toContain("ALTA");
    expect(texto).toContain("Nova medição após a obra");
    /* MAR e ABR marcados: duas células com o X no fundo azul-marinho. */
    const linhaAcao = xml.split("<w:tr").find((tr) => tr.includes("Enclausurar as máquinas"))!;
    expect((linhaAcao.match(/w:fill="0F2A44"/g) || []).length).toBe(2);
  }, 30_000);

  it("nomeia o arquivo com o nome da empresa, sem acento", async () => {
    const { dados } = await textoDoWord();
    expect(nomeArquivo("PGR", dados)).toBe("01_PGR_Tecelagem_Sao_Jose_Ltda.docx");
  }, 30_000);

  it("empresa com cadastro incompleto gera assim mesmo, com os marcadores", async () => {
    const dados = montarDadosDocumento({
      empresa: { nome: "Só o Nome Ltda" },
      pgr: {},
      inventario: BANCO.inventario,
    });
    const zip = await JSZip.loadAsync(await gerarDocumentoBuffer("PGR", dados));
    const texto = (await zip.file("word/document.xml")!.async("string")).replace(/<[^>]+>/g, "");
    expect(texto).toContain("Só o Nome Ltda");
    expect(texto).toContain("{{CNPJ}}");
    expect(texto).toContain("{{DATA_EMISSAO}}");
    expect(texto).toContain("{{RESPONSAVEL_NOME}}");
    /* E o inventário continua inteiro: a falta de cadastro não derruba o resto. */
    expect(texto).toContain("Ruído contínuo");
    expect(texto).toContain("MODERADO");
  }, 30_000);
});

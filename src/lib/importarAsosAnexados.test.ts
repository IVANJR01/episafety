import { describe, expect, it } from "vitest";
import {
  anexosPendentes, asoDoAnexo, type DocumentoComVersoes,
} from "./importarAsosAnexados";

/**
 * Importar para o módulo os ASOs que só existem como PDF anexado.
 *
 * Esta empresa tem 32 documentos de ASO e 50 versões no Arquivo Digital,
 * e a lista do módulo diz "Nenhum ASO encontrado". Os arquivos foram
 * anexados direto no dossiê: não geram vencimento, não entram nos
 * relatórios e não alimentam o Relatório Analítico do 7.5.4 "e".
 */

const NOMES = new Map([["f1", "ANA COSTUREIRA"], ["f2", "BRUNO CORTADOR"]]);

const DOCS: DocumentoComVersoes[] = [
  {
    id: "d1", colaborador_id: "f2",
    internal_document_versions: [
      { id: "v1", versao: 1, nome_original: "aso.pdf",
        data_emissao: "2025-10-24", data_validade: "2026-10-24", origem_tabela: "dossie" },
    ],
  },
  {
    id: "d2", colaborador_id: "f1",
    internal_document_versions: [
      { id: "v2", versao: 2, nome_original: "aso.pdf",
        data_emissao: "2026-03-10", data_validade: "2027-03-10", origem_tabela: "dossie" },
      { id: "v3", versao: 1, nome_original: "aso.pdf",
        data_emissao: "2025-03-10", data_validade: "2026-03-10", origem_tabela: "dossie" },
    ],
  },
];

describe("quais anexos ainda faltam importar", () => {
  it("lista cada versão anexada, não um por colaborador", () => {
    /* Cada ASO é um exame: duas versões da mesma pessoa são dois ASOs. */
    expect(anexosPendentes(DOCS, NOMES).length).toBe(3);
  });

  it("versão que já veio do módulo não aparece", () => {
    const comModulo: DocumentoComVersoes[] = [{
      id: "d3", colaborador_id: "f1",
      internal_document_versions: [
        { id: "v9", versao: 1, nome_original: "aso.pdf",
          data_emissao: "2026-01-01", data_validade: null, origem_tabela: "asos" },
      ],
    }];
    expect(anexosPendentes(comModulo, NOMES).length,
      "ia criar um ASO duplicado para o mesmo papel").toBe(0);
  });

  it("ordena pela pessoa e, nela, do exame mais antigo ao mais novo", () => {
    const p = anexosPendentes(DOCS, NOMES);
    expect(p.map((a) => `${a.colaboradorNome} ${a.dataEmissao}`)).toEqual([
      "ANA COSTUREIRA 2025-03-10",
      "ANA COSTUREIRA 2026-03-10",
      "BRUNO CORTADOR 2025-10-24",
    ]);
  });

  it("documento sem versão nenhuma não estoura", () => {
    expect(anexosPendentes([{ id: "d", colaborador_id: "f1" }], NOMES)).toEqual([]);
    expect(anexosPendentes([], NOMES)).toEqual([]);
  });
});

describe("o registro que o anexo vira", () => {
  const anexo = anexosPendentes(DOCS, NOMES)[0];

  it("aproveita colaborador e datas do anexo", () => {
    const a = asoDoAnexo({ anexo, tipoExame: "periodico", empresaId: "e1", numero: "0001" })!;
    expect(a.funcionario_id).toBe("f1");
    expect(a.data_emissao).toBe("2025-03-10");
    expect(a.data_vencimento).toBe("2026-03-10");
    expect(a.validade_tipo).toBe("1ano");
  });

  it("sem tipo de exame escolhido, não grava nada", () => {
    /*
     * Os 50 arquivos desta empresa têm o mesmo nome: não há de onde
     * deduzir o tipo. Chutar "periódico" criaria admissional errado em
     * documento legal.
     */
    expect(asoDoAnexo({ anexo, tipoExame: "", empresaId: "e1", numero: "0001" })).toBeNull();
  });

  it("anexo sem data de emissão não vira ASO", () => {
    /* Usar a data de hoje marcaria como atual um exame de anos atrás. */
    const semData = { ...anexo, dataEmissao: null };
    expect(asoDoAnexo({ anexo: semData, tipoExame: "periodico", empresaId: "e1", numero: "1" }))
      .toBeNull();
  });

  it("demissional entra sem vencimento, mesmo que o anexo traga um", () => {
    /*
     * O demissional não vence (NR-07, 7.5.11). Muitos anexos trazem
     * vencimento porque o tipo de documento tinha 12 meses fixos.
     */
    const a = asoDoAnexo({ anexo, tipoExame: "demissional", empresaId: "e1", numero: "1" })!;
    expect(a.data_vencimento, "o demissional ganhou vencimento").toBeNull();
    expect(a.validade_tipo).toBe("nao_vence");
  });

  it("o registro diz que veio de papel digitalizado", () => {
    /* Aptidão, exames e médico estão no arquivo, não nos campos. */
    const a = asoDoAnexo({ anexo, tipoExame: "periodico", empresaId: "e1", numero: "1" })!;
    expect(a.observacoes).toContain("digitalizado");
    expect(a.observacoes).toContain("arquivo original");
  });

  it("não inventa aptidão", () => {
    const a = asoDoAnexo({ anexo, tipoExame: "periodico", empresaId: "e1", numero: "1" })!;
    expect(Object.keys(a), "gravou aptidão que ninguém leu no papel")
      .not.toContain("status_aptidao");
  });
});

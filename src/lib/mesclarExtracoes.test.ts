import { describe, it, expect } from "vitest";
import { mesclarExtracoes, resumoDaExtracao } from "./mesclarExtracoes";

/**
 * O PGR do cliente vem em dois arquivos: o Word com a identificação da
 * empresa, o responsável técnico e a lista de GES; a planilha com os 66
 * riscos do inventário. A tela obrigava a escolher um caminho por vez, e
 * a segunda leitura apagava a primeira — importar completo era importar
 * duas vezes e perder metade.
 */

const DO_WORD = {
  documento: {
    empresa_nome: "G91 NORDESTE",
    cnpj: "14.256.653/0001-40",
    resp_tec_nome: "Ivan Júnior",
    resp_tec_registro: "TST 12345",
    metodologia_avaliacao: "",
  },
  setores: [{ nome: "COSTURA" }, { nome: "CORTE" }],
  ghes: [{ codigo: "01", nome: "GES 01" }],
  inventario: [],
};

const DA_PLANILHA = {
  documento: { empresa_nome: "", metodologia_avaliacao: "Matriz 5x5" },
  setores: [{ nome: "COSTURA" }, { nome: "ESTAMPARIA" }],
  ghes: [{ codigo: "01", nome: "GES 01" }, { codigo: "02", nome: "GES 02" }],
  inventario: [
    { ges_codigo: "01", setor: "COSTURA", perigo_descricao: "Ruído contínuo" },
    { ges_codigo: "02", setor: "ESTAMPARIA", perigo_descricao: "Vapores orgânicos" },
  ],
};

describe("juntar o Word com a planilha", () => {
  it("fica com os dados dos dois", () => {
    const j = mesclarExtracoes(DO_WORD, DA_PLANILHA);
    expect(j.documento?.resp_tec_nome, "perdeu o responsável que veio do Word")
      .toBe("Ivan Júnior");
    expect(j.documento?.metodologia_avaliacao, "perdeu a metodologia da planilha")
      .toBe("Matriz 5x5");
    expect(j.inventario).toHaveLength(2);
  });

  it("campo vazio do segundo arquivo não apaga o do primeiro", () => {
    /*
     * A planilha traz empresa_nome em branco. Deixar ela sobrescrever
     * apagaria o nome que o Word trouxe — e a importação gravaria um PGR
     * sem empresa.
     */
    const j = mesclarExtracoes(DO_WORD, DA_PLANILHA);
    expect(j.documento?.empresa_nome).toBe("G91 NORDESTE");
  });

  it("setor repetido nos dois arquivos entra uma vez só", () => {
    const j = mesclarExtracoes(DO_WORD, DA_PLANILHA);
    expect(j.setores?.map((s) => s.nome)).toEqual(["COSTURA", "CORTE", "ESTAMPARIA"]);
  });

  it("GES repetido entra uma vez só", () => {
    const j = mesclarExtracoes(DO_WORD, DA_PLANILHA);
    expect(j.ghes).toHaveLength(2);
  });

  it("não importa a ordem dos arquivos para o conteúdo total", () => {
    /* O técnico pode soltar a planilha antes do Word. */
    const a = mesclarExtracoes(DO_WORD, DA_PLANILHA);
    const b = mesclarExtracoes(DA_PLANILHA, DO_WORD);
    expect(resumoDaExtracao(a)).toEqual(resumoDaExtracao(b));
    expect(b.documento?.resp_tec_nome).toBe("Ivan Júnior");
  });
});

describe("riscos repetidos", () => {
  it("o mesmo perigo, no mesmo GES e setor, não duplica", () => {
    const risco = { ges_codigo: "01", setor: "COSTURA", perigo_descricao: "Ruído contínuo" };
    const j = mesclarExtracoes({ inventario: [risco] }, { inventario: [{ ...risco }] });
    expect(j.inventario).toHaveLength(1);
  });

  it("o mesmo perigo em setores diferentes são dois riscos", () => {
    /*
     * Ruído na costura e ruído no corte são exposições distintas, com
     * trabalhadores distintos. Unir os dois esconderia um setor inteiro
     * do inventário.
     */
    const j = mesclarExtracoes(
      { inventario: [{ ges_codigo: "01", setor: "COSTURA", perigo_descricao: "Ruído" }] },
      { inventario: [{ ges_codigo: "02", setor: "CORTE", perigo_descricao: "Ruído" }] },
    );
    expect(j.inventario).toHaveLength(2);
  });

  it("acento e caixa não fazem o mesmo risco virar dois", () => {
    const j = mesclarExtracoes(
      { inventario: [{ ges_codigo: "01", setor: "Costura", perigo_descricao: "Ruído Contínuo" }] },
      { inventario: [{ ges_codigo: "01", setor: "COSTURA", perigo_descricao: "RUIDO CONTINUO" }] },
    );
    expect(j.inventario).toHaveLength(1);
  });

  it("risco sem nada que o identifique é mantido, não descartado", () => {
    /*
     * Perder um risco é pior que repetir um: o repetido o técnico vê e
     * apaga; o perdido ninguém percebe até a fiscalização.
     */
    const j = mesclarExtracoes(
      { inventario: [{}] },
      { inventario: [{}] },
    );
    expect(j.inventario).toHaveLength(2);
  });
});

describe("casos de borda", () => {
  it("juntar com nada devolve o que tinha", () => {
    expect(mesclarExtracoes(DO_WORD, null)).toBe(DO_WORD);
    expect(mesclarExtracoes(null, DA_PLANILHA)).toBe(DA_PLANILHA);
    expect(mesclarExtracoes(null, null)).toEqual({});
  });

  it("três arquivos somam, não se anulam", () => {
    const terceiro = {
      inventario: [{ ges_codigo: "03", setor: "ALMOXARIFADO", perigo_descricao: "Queda" }],
    };
    const j = mesclarExtracoes(mesclarExtracoes(DO_WORD, DA_PLANILHA), terceiro);
    expect(resumoDaExtracao(j).riscos).toBe(3);
    expect(j.documento?.resp_tec_nome).toBe("Ivan Júnior");
  });

  it("o resumo conta o que a tela vai mostrar", () => {
    const j = mesclarExtracoes(DO_WORD, DA_PLANILHA);
    expect(resumoDaExtracao(j)).toEqual({ setores: 3, ges: 2, riscos: 2, unidades: 0 });
  });
});

describe("o mesmo GES escrito de dois jeitos", () => {
  it("o Word com 'GES 01' e a planilha com 1.0 não viram dois GES", () => {
    /*
     * Foi assim que o banco do cliente ficou com um "GES 01" sem risco
     * nenhum ao lado do GES 01 de verdade.
     */
    const j = mesclarExtracoes(
      { ghes: [{ codigo: "GES 01", nome: "GES 01" }] },
      { ghes: [{ codigo: "01", nome: "GES 01" }] },
    );
    expect(j.ghes).toHaveLength(1);
  });

  it("GES diferentes continuam dois", () => {
    const j = mesclarExtracoes(
      { ghes: [{ codigo: "03" }] },
      { ghes: [{ codigo: "3.1" }] },
    );
    expect(j.ghes).toHaveLength(2);
  });
});

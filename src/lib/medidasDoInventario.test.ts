import { describe, it, expect } from "vitest";
import {
  medidasExistentes,
  epiDoRisco,
  celulaVazia,
  cabecalhoCombinado,
} from "./medidasDoInventario";

/*
 * Os textos abaixo são os da planilha real da G91 — "Inventário de Risco
 * e Plano de Ação 2026", coluna "MEDIDAS DE PREVENÇÃO EXISTENTE".
 */
const PROCEDIMENTO =
  "Revezamento do posicionamento das atividades utilizados posições diferentes, " +
  "modificando a musculatura exigida / Descanso quando há necessidade / Roupas " +
  "confortáveis e com tecido mais leve, evitando peças justas / Organismo bem " +
  "hidratado com água.";

describe("o texto não entra duas vezes", () => {
  it("quando o EPI repete o procedimento, grava uma vez só", () => {
    /*
     * Era o estado do inventário do cliente: o mesmo parágrafo gravado
     * duas vezes em cada risco, a segunda com "EPI: " na frente.
     */
    const medidas = medidasExistentes({ procedimento: PROCEDIMENTO, epi: PROCEDIMENTO, atenuacao: "N.A" });
    expect(medidas).toEqual([PROCEDIMENTO]);
  });

  it("acento, caixa e ponto final não escapam da conferência", () => {
    const medidas = medidasExistentes({
      procedimento: "Assento dentro do padrão da NR-17",
      epi: "assento dentro do padrao da nr-17.",
    });
    expect(medidas).toHaveLength(1);
  });

  it("espaço repetido no meio também não escapa", () => {
    const medidas = medidasExistentes({
      procedimento: "Descanso quando há  necessidade",
      epi: "Descanso quando há necessidade",
    });
    expect(medidas).toHaveLength(1);
  });

  it("EPI de verdade entra, sim", () => {
    const medidas = medidasExistentes({
      procedimento: "Proteção da correia conforme NR-12",
      epi: "Luva de malha de aço",
    });
    expect(medidas).toEqual([
      "Proteção da correia conforme NR-12",
      "EPI: Luva de malha de aço",
    ]);
  });

  it("a atenuação entra quando é informação nova", () => {
    const medidas = medidasExistentes({
      procedimento: "Enclausuramento da máquina",
      epi: "Protetor auricular tipo concha",
      atenuacao: "NRRsf 17 dB",
    });
    expect(medidas).toHaveLength(3);
    expect(medidas[2]).toBe("Atenuação: NRRsf 17 dB");
  });
});

describe("a planilha dizendo 'não se aplica'", () => {
  it("N.A em qualquer grafia é célula vazia", () => {
    for (const v of ["N.A", "N.A ", "n.a.", "NA", "N/A", "-", "—", "", "   ", "N", "N ", "n"]) {
      expect(celulaVazia(v), `"${v}" devia contar como vazio`).toBe(true);
    }
  });

  it("EPI de uma letra não entra no inventário", () => {
    /* Quatro linhas da planilha da G91 têm "N " na coluna de EPI. */
    expect(epiDoRisco({ epi: "N " })).toBeNull();
    expect(medidasExistentes({ procedimento: "Sinalização", epi: "N" })).toEqual(["Sinalização"]);
  });

  it("texto de verdade não é vazio", () => {
    expect(celulaVazia("Protetor auricular")).toBe(false);
    expect(celulaVazia("Nada menos que isso")).toBe(false);
  });

  it("risco sem medida nenhuma devolve lista vazia, sem inventar texto", () => {
    /*
     * Escrever "Medidas preventivas gerais" aqui esconderia do técnico
     * um risco que está sem controle — e é esse risco que precisa de
     * plano de ação.
     */
    expect(medidasExistentes({ procedimento: "N.A", epi: "N.A", atenuacao: "N.A" })).toEqual([]);
    expect(medidasExistentes({})).toEqual([]);
  });

  it("só EPI, sem procedimento, ainda é uma medida", () => {
    expect(medidasExistentes({ procedimento: "N.A", epi: "Luva nitrílica" }))
      .toEqual(["EPI: Luva nitrílica"]);
  });
});

describe("o campo EPI do risco", () => {
  it("não guarda o procedimento administrativo disfarçado de EPI", () => {
    /* "Revezamento do posicionamento das atividades" não é EPI. */
    expect(epiDoRisco({ procedimento: PROCEDIMENTO, epi: PROCEDIMENTO })).toBeNull();
  });

  it("N.A não vira EPI", () => {
    expect(epiDoRisco({ epi: "N.A " })).toBeNull();
  });

  it("EPI de verdade é guardado", () => {
    expect(epiDoRisco({ procedimento: "Sinalização", epi: "Botina de segurança" }))
      .toBe("Botina de segurança");
  });
});

describe("cabeçalho em duas linhas", () => {
  it("título de cima vazio deixa o de baixo limpo", () => {
    /*
     * A coluna EPI da planilha tem a célula de cima mesclada, logo
     * vazia. Virando "_epi" ela não casava exato com "epi", e a busca
     * caía na coluna vizinha, que contém a palavra "equipamento".
     */
    expect(cabecalhoCombinado("", "epi")).toBe("epi");
    expect(cabecalhoCombinado("", "atenuacaofatordeprotecao")).toBe("atenuacaofatordeprotecao");
  });

  it("os dois preenchidos ficam juntos", () => {
    expect(cabecalhoCombinado("medidasdeprevencao", "procedimentoadministrativo"))
      .toBe("medidasdeprevencao_procedimentoadministrativo");
  });

  it("sub vazio devolve o de cima", () => {
    expect(cabecalhoCombinado("setor", "")).toBe("setor");
  });

  it("título repetido nas duas linhas não duplica", () => {
    expect(cabecalhoCombinado("setor", "setor")).toBe("setor");
  });
});

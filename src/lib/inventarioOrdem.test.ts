import { describe, it, expect } from "vitest";
import { ordenarInventario, alcanceDoBloco, abreBloco } from "./inventarioOrdem";

/**
 * "GES 01 primeiro, depois 02."
 *
 * A tabela saía com ESCRITÓRIO (02) antes de PCP (01), porque ordenava por
 * nome do setor.
 *
 * A armadilha: a tabela mescla Ambiente, Setor e Processo ao longo das linhas
 * de um mesmo setor, e mesclar só funciona em linhas VIZINHAS. Ordenar direto
 * pelo GES separa as linhas de um setor com mais de um grupo, e o parágrafo do
 * ambiente volta a ser reimpresso em cada grupo — defeito que já existiu aqui.
 */

type Linha = { id: string; setor: string; ges: string; perigo: string };
const ler = {
  chaveSetor: (l: Linha) => l.setor,
  codigoGes: (l: Linha) => l.ges,
  desempate: (l: Linha) => l.perigo + l.id,
};
const linha = (id: string, setor: string, ges: string, perigo = "P") =>
  ({ id, setor, ges, perigo });

describe("ordenarInventario", () => {
  it("põe o GES 01 antes do 02, mesmo com o setor do 02 vindo antes no alfabeto", () => {
    const r = ordenarInventario([
      linha("a", "ESCRITÓRIO", "02"),
      linha("b", "PCP", "01"),
    ], ler);
    expect(r.map((l) => l.ges)).toEqual(["01", "02"]);
  });

  it("MANTÉM as linhas de um setor grudadas — é o que preserva a mesclagem", () => {
    // COSTURA tem dois grupos (01 e 03) e ESCRITÓRIO tem o 02. Ordenar só pelo
    // GES daria 01(COSTURA), 02(ESCRITÓRIO), 03(COSTURA) — e o ambiente da
    // COSTURA seria reimpresso, porque as linhas dela ficariam separadas.
    const r = ordenarInventario([
      linha("c", "ESCRITÓRIO", "02"),
      linha("a", "COSTURA", "01"),
      linha("b", "COSTURA", "03"),
    ], ler);
    expect(r.map((l) => l.setor)).toEqual(["COSTURA", "COSTURA", "ESCRITÓRIO"]);
    expect(r.map((l) => l.ges)).toEqual(["01", "03", "02"]);
  });

  it("dentro do setor, ordena por GES", () => {
    const r = ordenarInventario([
      linha("b", "COSTURA", "07"),
      linha("a", "COSTURA", "03"),
    ], ler);
    expect(r.map((l) => l.ges)).toEqual(["03", "07"]);
  });

  it("09 vem antes de 10 — comparação numérica, não de texto", () => {
    const r = ordenarInventario([
      linha("a", "A", "10"), linha("b", "B", "9"),
    ], ler);
    expect(r.map((l) => l.ges)).toEqual(["9", "10"]);
  });

  it("linha sem GES vai para o fim, sem atropelar as numeradas", () => {
    const r = ordenarInventario([
      linha("a", "SEM", ""), linha("b", "PCP", "01"),
    ], ler);
    expect(r.map((l) => l.setor)).toEqual(["PCP", "SEM"]);
  });

  it("dois setores com o mesmo menor GES ficam em ordem estável, por nome", () => {
    const r = ordenarInventario([
      linha("b", "ZELADORIA", "05"), linha("a", "ALMOXARIFADO", "05"),
    ], ler);
    expect(r.map((l) => l.setor)).toEqual(["ALMOXARIFADO", "ZELADORIA"]);
  });

  it("mesmo GES e mesmo setor: desempata pelo perigo", () => {
    const r = ordenarInventario([
      linha("b", "PCP", "01", "Ruído"), linha("a", "PCP", "01", "Postura"),
    ], ler);
    expect(r.map((l) => l.perigo)).toEqual(["Postura", "Ruído"]);
  });

  it("ordena grupos de risco na ordem oficial: Físico, Químico, Biológico, Ergonômico, Acidentes", () => {
    type LinhaComGrupo = Linha & { grupo: string };
    const lerGrupo = {
      ...ler,
      grupo: (l: LinhaComGrupo) => l.grupo,
    };
    const r = ordenarInventario<LinhaComGrupo>([
      { id: "5", setor: "PCP", ges: "01", perigo: "P5", grupo: "acidente" },
      { id: "4", setor: "PCP", ges: "01", perigo: "P4", grupo: "ergonomico" },
      { id: "1", setor: "PCP", ges: "01", perigo: "P1", grupo: "fisico" },
      { id: "3", setor: "PCP", ges: "01", perigo: "P3", grupo: "biologico" },
      { id: "2", setor: "PCP", ges: "01", perigo: "P2", grupo: "quimico" },
    ], lerGrupo);
    expect(r.map((l) => l.grupo)).toEqual([
      "fisico",
      "quimico",
      "biologico",
      "ergonomico",
      "acidente",
    ]);
  });

  it("lista vazia não quebra", () => {
    expect(ordenarInventario([], ler)).toEqual([]);
  });
});

describe("células mescladas da tabela", () => {
  /*
   * As quatro primeiras linhas do inventário da G91: quatro setores
   * diferentes, todos do GES 01, cada um com o seu ambiente e as suas
   * funções. Na planilha o GES é uma célula só cobrindo as quatro.
   */
  const G91 = [
    { setor: "FINANCEIRO", ges: "01", funcoes: "Assistente Financeiro" },
    { setor: "PCP", ges: "01", funcoes: "Supervisor de Produção" },
    { setor: "RH", ges: "01", funcoes: "Auxiliar Administrativo" },
    { setor: "SESMT", ges: "01", funcoes: "Técnico em Segurança do Trabalho" },
    { setor: "DISTRIBUIÇÃO", ges: "02", funcoes: "Encarregado" },
  ];
  const porGes = (x: { ges: string }) => x.ges;
  const porSetor = (x: { setor: string }) => x.setor;

  it("o GES 01 vira uma célula só, cobrindo os quatro setores", () => {
    expect(alcanceDoBloco(G91, 0, porGes)).toBe(4);
    expect(abreBloco(G91, 0, porGes)).toBe(true);
  });

  it("as linhas de dentro do bloco não abrem célula nova", () => {
    expect(abreBloco(G91, 1, porGes)).toBe(false);
    expect(abreBloco(G91, 2, porGes)).toBe(false);
    expect(abreBloco(G91, 3, porGes)).toBe(false);
  });

  it("o GES seguinte abre a sua própria célula", () => {
    expect(abreBloco(G91, 4, porGes)).toBe(true);
    expect(alcanceDoBloco(G91, 4, porGes)).toBe(1);
  });

  it("o setor continua uma célula por setor, sem se juntar ao vizinho", () => {
    /* Juntar os setores apagaria da tela a quem o risco pertence. */
    for (let i = 0; i < G91.length; i++) {
      expect(alcanceDoBloco(G91, i, porSetor), `setor ${G91[i].setor} juntou com o vizinho`).toBe(1);
    }
  });

  it("conteúdo diferente nunca é escondido debaixo de uma célula só", () => {
    /*
     * As funções mudam de setor para setor mesmo dentro do GES 01.
     * Mesclar por GES esconderia três listas de funções atrás da
     * primeira — e a ficha sairia dizendo que o SESMT é "Assistente
     * Financeiro".
     */
    const porFuncao = (x: { ges: string; funcoes: string }) => `${x.ges}§${x.funcoes}`;
    for (let i = 0; i < 4; i++) {
      expect(alcanceDoBloco(G91, i, porFuncao)).toBe(1);
    }
  });

  it("a soma dos blocos cobre todas as linhas, sem sobra nem buraco", () => {
    let i = 0;
    let total = 0;
    while (i < G91.length) {
      const n = alcanceDoBloco(G91, i, porGes);
      expect(n).toBeGreaterThan(0);
      total += n;
      i += n;
    }
    expect(total).toBe(G91.length);
  });

  it("lista vazia não produz bloco", () => {
    expect(alcanceDoBloco([], 0, porGes)).toBe(0);
    expect(alcanceDoBloco(G91, 99, porGes)).toBe(0);
  });

  it("GES vazio em linhas seguidas junta, porque mostram a mesma coisa", () => {
    const semGes = [{ ges: "" }, { ges: "" }, { ges: "03" }];
    expect(alcanceDoBloco(semGes, 0, porGes)).toBe(2);
  });
});

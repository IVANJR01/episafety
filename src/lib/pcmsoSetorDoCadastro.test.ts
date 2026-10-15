import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * De onde sai o setor de cada ficha de exame.
 *
 * O PCMSO emitido em 10/2026 imprimiu 6 setores enquanto o PGR da mesma
 * empresa tinha 13 GES cadastrados — conferido no banco: 13 GES, 13 setores
 * distintos no inventário, 6 fichas no PCMSO. Dois documentos contando
 * histórias diferentes da mesma empresa é o que uma fiscalização encontra
 * primeiro.
 *
 * A causa: uma lista de palavras-chave decidia o setor pelo NOME DO CARGO, e
 * tudo que não casasse caía em "ADMINISTRAÇÃO E GESTÃO". CORTADOR não ia para
 * CORTE porque a palavra procurada era "corte" e o cargo é "cortador" — ia
 * para a Administração, levando o risco "Cortes / Perfurações — Máquinas de
 * costura" para dentro do setor administrativo.
 *
 * O teste usa a função real, extraída do módulo pela leitura do arquivo: ela é
 * local ao carregador e não tem export próprio. O que importa aqui é a REGRA,
 * e ela é testada executando o código de verdade, não relendo o texto dele.
 */

function mapearSetorCanonico(): (nome: string, setor?: string | null) => string {
  const fonte = readFileSync(
    join(process.cwd(), "src", "lib", "pcmsoPdfContextoLoader.ts"),
    "utf-8",
  );
  const inicio = fonte.indexOf("const mapearSetorCanonico =");
  const fim = fonte.indexOf("const gruposFichas", inicio);
  expect(inicio, "a função de mapeamento sumiu do carregador").toBeGreaterThan(0);

  const corpo = fonte
    .slice(inicio, fim)
    .replace(/const mapearSetorCanonico = /, "")
    .replace(/:\s*string\b/g, "")
    .replace(/\(nome, setorOriginal\?/, "(nome, setorOriginal")
    .replace(/setorOriginal\?:[^)]*\)/, "setorOriginal)")
    .replace(/\(nome\s*,\s*setorOriginal[^)]*\)/, "(nome, setorOriginal)")
    .trim()
    .replace(/;$/, "");
  // eslint-disable-next-line no-new-func
  return new Function(`return (${corpo});`)() as (n: string, s?: string | null) => string;
}

describe("o setor da ficha vem do cadastro", () => {
  const mapear = mapearSetorCanonico();

  it("usa o setor cadastrado, qualquer que seja o nome do cargo", () => {
    expect(mapear("CORTADOR", "CORTE")).toBe("CORTE");
    expect(mapear("MODELISTA/ESTILISTA", "ATELIER")).toBe("ATELIER");
    expect(mapear("ANALISTA DE PCP", "PCP")).toBe("PCP");
    expect(mapear("AUXILIAR DE SERVIÇOS GERAIS", "ZELADORIA")).toBe("ZELADORIA");
  });

  it("não joga mais no administrativo o que tem setor próprio", () => {
    /* Era aqui que o cortador e o gerente de produção se perdiam. */
    for (const [cargo, setor] of [
      ["CORTADOR", "CORTE"],
      ["GERENTE DE PRODUÇÃO", "PRODUÇÃO"],
      ["SUPERVISOR DE PRODUÇÃO", "PRODUÇÃO"],
      ["CRONOMETRISTA", "PCP"],
    ] as const) {
      expect(mapear(cargo, setor), `${cargo} caiu no administrativo`)
        .not.toBe("ADMINISTRAÇÃO E GESTÃO");
    }
  });

  it("cargo SEM setor cadastrado ainda recebe um palpite pelas palavras", () => {
    /* Sem cadastro não há de onde tirar a resposta; o palpite fica. */
    expect(mapear("COZINHEIRA", null)).toBe("COZINHA");
    expect(mapear("COSTUREIRA", "")).toBe("COSTURA");
    expect(mapear("CARGO SEM PALAVRA CONHECIDA", null)).toBe("ADMINISTRAÇÃO E GESTÃO");
  });

  it("o setor cadastrado sai em caixa alta, sem espaço sobrando", () => {
    /* "costura " e "COSTURA" não podem virar duas fichas diferentes. */
    expect(mapear("COSTUREIRA", " costura ")).toBe("COSTURA");
  });
});

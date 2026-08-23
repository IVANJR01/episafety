import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Aba com conteúdo mas sem gatilho que a abra.
 *
 * Aconteceu duas vezes no mesmo arquivo, e a segunda passou despercebida por
 * meses: o cadastro de Funções só podia ser aberto por dentro do assistente do
 * PGR, porque o gatilho da Base Técnica tinha sido removido em favor de uma
 * seção que outra mudança removeu depois. Cada passo era defensável sozinho; o
 * resultado foi uma tela viva e sem porta.
 *
 * É um erro invisível: o código compila, os testes passam, a tela existe — só
 * não há como chegar nela. Este teste lê o arquivo e cobra o par.
 *
 * A exceção legítima é o conteúdo aberto por fora, via `only=` (o assistente
 * do PGR monta "setores" e "funcoes" assim). Esses continuam precisando de
 * gatilho na Base Técnica: é justamente o caso que falhou.
 */

const ARQUIVOS = [
  "src/components/documentacao/EstruturaOcupacionalTab.tsx",
];

const valores = (fonte: string, tag: "TabsTrigger" | "TabsContent") =>
  [...fonte.matchAll(new RegExp(`${tag} value="([a-z_]+)"`, "g"))].map((m) => m[1]);

describe("abas sem porta de entrada", () => {
  for (const caminho of ARQUIVOS) {
    it(`${caminho}: todo conteúdo de aba tem um gatilho`, () => {
      const fonte = readFileSync(resolve(process.cwd(), caminho), "utf-8");
      const gatilhos = new Set(valores(fonte, "TabsTrigger"));
      const conteudos = valores(fonte, "TabsContent");
      const semPorta = conteudos.filter((v) => !gatilhos.has(v));
      expect(semPorta, `conteúdo sem gatilho: ${semPorta.join(", ")}`).toEqual([]);
    });

    it(`${caminho}: todo gatilho leva a algum conteúdo`, () => {
      const fonte = readFileSync(resolve(process.cwd(), caminho), "utf-8");
      const conteudos = new Set(valores(fonte, "TabsContent"));
      const gatilhos = valores(fonte, "TabsTrigger");
      const semDestino = gatilhos.filter((v) => !conteudos.has(v));
      expect(semDestino, `gatilho sem conteúdo: ${semDestino.join(", ")}`).toEqual([]);
    });
  }

  it("Funções continua alcançável pela Base Técnica", () => {
    // O caso concreto que motivou o teste.
    const fonte = readFileSync(
      resolve(process.cwd(), "src/components/documentacao/EstruturaOcupacionalTab.tsx"), "utf-8",
    );
    expect(fonte).toContain('TabsTrigger value="funcoes"');
    expect(fonte).toContain('TabsContent value="funcoes"');
  });
});

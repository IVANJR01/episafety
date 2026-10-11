import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/*
 * As citações da NR-01 na conferência normativa.
 *
 * A tela mostra o item da norma ao lado de cada conferência, e é por ele que
 * o responsável técnico defende o documento numa fiscalização. Estavam
 * erradas: "datado e assinado" citava 1.5.7.3.2 (que é o conteúdo do
 * inventário) em vez de 1.5.7.2; o prazo de dois anos citava 1.5.4.4.4 e os
 * gatilhos 1.5.4.4.5, quando os dois estão no 1.5.4.4.6; a hierarquia de
 * controles citava 1.5.4.4.3, que trata da gradação da severidade.
 *
 * Também havia alíneas inventadas — "1.5.7.3.2 alínea k" não existe.
 *
 * Fonte das correções: o FAQ GRO/PGR da NR-01 do Ministério do Trabalho, que
 * transcreve os itens.
 */
const ARQUIVO = fs.readFileSync(
  path.resolve(__dirname, "PgrChecklistTab.tsx"),
  "utf8",
);
/* Comentário não é tela: o bloco que explica a correção cita a frase antiga. */
const FONTE = ARQUIVO
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("citações da NR-01 na conferência", () => {
  it("não cita item inexistente nem alínea inventada", () => {
    expect(FONTE).not.toMatch(/alínea [a-z]/i);
    expect(FONTE).not.toContain("1.5.4.4.4");
  });

  it("atribui cada conferência ao item que a sustenta", () => {
    // Datado e assinado: 1.5.7.2.
    expect(FONTE).toContain('norma: "NR-01 1.5.7.2 — documento datado e assinado"');
    // Plano de ação: 1.5.5.2.1.
    expect(FONTE).toContain('norma: "NR-01 1.5.5.2.1"');
    // EPI depois da proteção coletiva: 1.5.5.1.2.
    expect(FONTE).toContain("1.5.5.1.2 — EPI não é controle suficiente");
    // Revisão a cada dois anos e gatilhos: 1.5.4.4.6.
    expect(FONTE).toContain("Máx. 2 anos (NR-01 1.5.4.4.6)");
  });

  it("não afirma que o sistema deixa de ter ICP-Brasil", () => {
    // A Ficha de EPI sai assinada com A1 e passou no validador do ITI; a
    // negativa geral que estava aqui envelheceu no dia em que isso entrou.
    expect(FONTE).not.toMatch(/não.{0,20}implementa\s*\n?\s*ICP-Brasil/i);
  });
});

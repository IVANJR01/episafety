import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/*
 * O card do topo da conferência listava, item por item, todas as pendências
 * bloqueantes — as mesmas linhas que apareciam nos blocos logo abaixo. Na
 * tela, "PDF gerado" e "Riscos que exigem ação possuem ação vinculada"
 * apareciam duas vezes, uma embaixo da outra.
 *
 * O topo agora é resumo (percentual + contadores) e a lista vive nos blocos,
 * com um filtro entre "pendências" e "tudo". Este teste existe para que a
 * duplicação não volte na próxima mexida de layout.
 */
const ARQUIVO = fs.readFileSync(
  path.resolve(__dirname, "PgrChecklistTab.tsx"),
  "utf8",
);
/* Comentário não é tela: os blocos de explicação citam o jeito antigo. */
const FONTE = ARQUIVO
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("layout da conferência normativa", () => {
  it("não renderiza a lista de bloqueantes fora dos blocos", () => {
    expect(FONTE).not.toMatch(/bloqueantes\.map/);
  });

  it("mostra o resumo como percentual e contadores", () => {
    expect(FONTE).toContain("<Progress value={pct}");
    expect(FONTE).toContain('<Contador sev="bloqueante"');
    expect(FONTE).toContain('<Contador sev="alerta"');
    expect(FONTE).toContain('<Contador sev="recomendacao"');
  });

  it("deixa filtrar entre pendências e tudo", () => {
    expect(FONTE).toContain("setSomentePendencias");
    /* Abre filtrado quando há bloqueio: a pendência é a primeira coisa a ver. */
    expect(FONTE).toContain("useState(!podeEmitir)");
  });

  it("usa um único critério de pendência em vez de repetir a condição", () => {
    expect(FONTE).toContain('const ehPendencia = (i: Item) => i.sev !== "ok" && i.sev !== "info"');
    /* A condição solta não deve reaparecer espalhada pelo JSX. */
    const soltas = FONTE.match(/sev !== "ok" && \w+\.sev !== "info"/g) || [];
    expect(soltas).toHaveLength(1);
  });
});

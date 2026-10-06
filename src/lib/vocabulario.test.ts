import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/*
 * "GES, nunca GHE" na interface.
 *
 * A sigla é a mesma coisa — Grupo de Exposição Similar/Homogêneo —, mas o
 * sistema falava das duas formas, às vezes nas duas na mesma frase
 * ("GHE/GES"), e o PDF do PGR saía assim para a fiscalização. Este teste olha
 * o que a pessoa lê: texto dentro de aspas e texto solto no JSX.
 *
 * O que NÃO é interface continua livre: nome de coluna (`ghe_id`), chave de
 * consulta, nome de componente e o cabeçalho "GHE Codigo" que as planilhas
 * antigas trazem e a importação precisa seguir aceitando.
 */
const RAIZ = path.resolve(__dirname, "..");
const PERMITIDO = /ghe_id|ghe_riscos|ghe_funcoes|ghe_codigo|ghe_nome|ghe_ges|gheId|GheDialog|queryKey|grupo_homogeneo|grupos_homogeneos|PcmsoImportDialog/;

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("vocabulário da interface", () => {
  it("não diz GHE em texto que a pessoa lê", () => {
    const achados: string[] = [];
    for (const arquivo of arquivos(RAIZ)) {
      if (PERMITIDO.test(arquivo)) continue;
      const linhas = fs.readFileSync(arquivo, "utf8").split("\n");
      linhas.forEach((linha, i) => {
        if (!/\bGHEs?\b/.test(linha)) return;
        if (PERMITIDO.test(linha)) return;
        // Comentário de código não é interface.
        if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return;
        achados.push(`${path.relative(RAIZ, arquivo)}:${i + 1}  ${linha.trim().slice(0, 80)}`);
      });
    }
    expect(achados, `GHE visível em:\n${achados.join("\n")}`).toEqual([]);
  });
});

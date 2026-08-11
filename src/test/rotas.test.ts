import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Todo destino de navegação tem rota?
 *
 * O botão "Continuar elaboração" — o principal do módulo PGR — apontava para
 * /pgr/wizard/:id, caminho que nunca existiu no roteador: caía direto no 404.
 * Nada quebrava em compilação nem em teste, porque é só uma string.
 *
 * Este teste lê as rotas declaradas em App.tsx (inclusive as aninhadas) e
 * confere contra cada `navigate("/...")` e `to="/..."` do código. Erro de
 * digitação em caminho passa a falhar aqui, e não na mão do usuário.
 */

const raiz = path.resolve(__dirname, "..");

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/**
 * Rotas declaradas, com o aninhamento resolvido.
 *
 * `<Route path="/arquivo-digital">` com filhas `dossies`, `vencimentos`… vale
 * como /arquivo-digital/dossies. Ignorar o aninhamento daria falso positivo em
 * sete caminhos que funcionam.
 */
function rotasDeclaradas(): string[] {
  const app = fs.readFileSync(path.join(raiz, "App.tsx"), "utf-8");
  const rotas: string[] = [];
  const pilha: { prefixo: string; profundidade: number }[] = [];
  let profundidade = 0;

  for (const linha of app.split("\n")) {
    const abre = linha.match(/<Route\s+path="([^"]+)"/);
    const fecha = /<\/Route>/.test(linha);
    if (abre) {
      const bruto = abre[1];
      const pai = pilha.length ? pilha[pilha.length - 1].prefixo : "";
      const completo = bruto.startsWith("/") ? bruto : `${pai}/${bruto}`;
      rotas.push(completo);
      // Rota-mãe: a tag não se fecha na própria linha.
      if (!/\/>\s*$/.test(linha)) {
        pilha.push({ prefixo: completo, profundidade });
        profundidade++;
      }
    }
    if (fecha && pilha.length) { pilha.pop(); profundidade--; }
  }
  return rotas.filter((r) => r !== "*");
}

const paraRegex = (rota: string) =>
  new RegExp("^" + rota.split("/").map((seg) => (seg.startsWith(":") ? "[^/]+" : seg
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/") + "$");

describe("rotas de navegação", () => {
  const padroes = rotasDeclaradas().map(paraRegex);

  const destinos = arquivos(raiz).flatMap((f) => {
    const s = fs.readFileSync(f, "utf-8");
    const achados: { arquivo: string; caminho: string }[] = [];
    for (const m of s.matchAll(/navigate\(\s*[`"']([^`"']+)[`"']/g)) {
      achados.push({ arquivo: path.relative(raiz, f), caminho: m[1] });
    }
    for (const m of s.matchAll(/to=\{?[`"']([^`"']+)[`"']/g)) {
      achados.push({ arquivo: path.relative(raiz, f), caminho: m[1] });
    }
    // Só caminhos absolutos: relativo depende da rota-mãe em tempo de execução.
    return achados.filter((a) => a.caminho.startsWith("/"));
  });

  it("encontra as rotas e os destinos, senão o teste não prova nada", () => {
    expect(padroes.length).toBeGreaterThan(50);
    expect(destinos.length).toBeGreaterThan(50);
  });

  it("todo destino absoluto tem rota correspondente", () => {
    const orfaos = destinos.filter(({ caminho }) => {
      // Tira query/hash e troca ${...} por um segmento qualquer.
      const limpo = caminho.split("?")[0].split("#")[0].replace(/\$\{[^}]*\}/g, "X");
      return !padroes.some((p) => p.test(limpo));
    });
    expect(orfaos.map((o) => `${o.caminho} (${o.arquivo})`)).toEqual([]);
  });
});

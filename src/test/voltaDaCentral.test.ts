import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Toda tela que a Central de Documentação abre precisa saber voltar.
 *
 * Eram sete telas de documento — PGR, PCMSO, LTCAT, PPP, Ordem de Serviço e os
 * dois Laudos — e nenhuma tinha volta. Quem entrava por "Elaborar documentos"
 * ficava sem caminho de retorno dentro da tela: a única saída era achar
 * "Documentação SST" no menu lateral, dentro de um grupo recolhível e sem
 * nada que diga que leva ao Repositório Técnico.
 *
 * O detalhe que mostra que foi descuido, e não escolha: as telas de DENTRO do
 * PGR (detalhe, assistente, painel) já tinham "Voltar para a lista". Faltava
 * só o degrau de cima — em todas as sete, do mesmo jeito.
 *
 * O teste lê os destinos direto da Central, então uma tela nova entra na
 * cobrança sozinha.
 */

const CENTRAL = "src/components/documentacao/CentralDocumentacaoTab.tsx";

/** Rotas que a Central abre, tiradas dela mesma. */
function destinosDaCentral(): string[] {
  const fonte = readFileSync(resolve(process.cwd(), CENTRAL), "utf-8");
  return [...fonte.matchAll(/navigate\("(\/[^"]+)"\)/g)].map((m) => m[1]);
}

/** Onde mora a tela de cada rota. */
const TELA_DA_ROTA: Record<string, string> = {
  "/pgr": "src/pages/pgr/PgrModule.tsx",
  "/pcmso/dashboard": "src/pages/pcmso/PcmsoDashboard.tsx",
  "/ltcat": "src/pages/ltcat/LtcatModule.tsx",
  "/ppp": "src/pages/ppp/PppModule.tsx",
  "/programas/ordem-servico": "src/pages/programas/OrdemServico.tsx",
  "/programas/laudo-insalubridade": "src/pages/programas/LaudoInsalubridade.tsx",
  "/programas/laudo-periculosidade": "src/pages/programas/LaudoPericulosidade.tsx",
};

describe("volta para a Central de Documentação", () => {
  it("a Central abre as rotas que este teste conhece", () => {
    // Se alguém adicionar um documento novo na Central, esta asserção falha e
    // lembra de mapear a tela — em vez de deixá-la sem volta em silêncio.
    const naoMapeadas = destinosDaCentral().filter((r) => !TELA_DA_ROTA[r]);
    expect(naoMapeadas, `rota sem tela mapeada: ${naoMapeadas.join(", ")}`).toEqual([]);
  });

  for (const [rota, arquivo] of Object.entries(TELA_DA_ROTA)) {
    it(`${rota} tem como voltar`, () => {
      const caminho = resolve(process.cwd(), arquivo);
      expect(existsSync(caminho), `${arquivo} não existe`).toBe(true);
      expect(readFileSync(caminho, "utf-8")).toContain("<VoltarParaCentral");
    });
  }

  it("o link leva para a aba de onde se veio, não para a primeira", () => {
    // Cair na Base Técnica ao sair de um documento faz parecer que a
    // navegação se perdeu.
    const fonte = readFileSync(
      resolve(process.cwd(), "src/components/documentacao/VoltarParaCentral.tsx"), "utf-8");
    expect(fonte).toContain("/documentacao-sst?aba=");
    expect(fonte).toContain('aba = "elaborar"');
  });
});

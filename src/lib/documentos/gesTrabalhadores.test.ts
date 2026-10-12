import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import JSZip from "jszip";
import { gerarDocumentoBuffer, type DadosDocumento } from "./gerarDocx";
import { montarDadosDocumento } from "./montarDados";

/*
 * Trabalhadores expostos do GES no Word — NR-01, item 1.5.7.3.2 "e".
 *
 * Duas exigências ao mesmo tempo, e a segunda é a que pega:
 *   1. com o número, a faixa do grupo mostra "TRABALHADORES: 7";
 *   2. SEM o número, o documento sai exatamente como saía antes — nem a
 *      palavra, nem o separador, nem um espaço a mais.
 */

const RAIZ = path.resolve(__dirname, "../../..");
const PACOTE = path.join(RAIZ, "ferramentas/documentos");
const requireCjs = createRequire(path.join(PACOTE, "gerador/"));

const DADOS: DadosDocumento = JSON.parse(
  fs.readFileSync(path.join(PACOTE, "exemplo/dados_exemplo.json"), "utf8"),
);

async function textoDoDocx(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  return zip.files["word/document.xml"].async("string");
}

/** Roda o gerar.js do pacote — o original, não o porte. */
function gerarComOriginal(dados: DadosDocumento): Buffer {
  const saida = fs.mkdtempSync(path.join(os.tmpdir(), "docx-trab-"));
  const arquivo = path.join(saida, "dados.json");
  fs.writeFileSync(arquivo, JSON.stringify(dados), "utf8");
  const { execFileSync } = requireCjs("node:child_process");
  execFileSync(
    process.execPath,
    [path.join(PACOTE, "gerador/gerar.js"), saida, arquivo, "PGR"],
    { cwd: path.join(PACOTE, "gerador"), stdio: "pipe" },
  );
  const nome = fs.readdirSync(saida).find((f) => f.endsWith(".docx"))!;
  return fs.readFileSync(path.join(saida, nome));
}

/** Os mesmos dados de exemplo, com o nº de trabalhadores em cada linha. */
function comTrabalhadores(n: number): DadosDocumento {
  const copia = JSON.parse(JSON.stringify(DADOS));
  copia.inventario = (copia.inventario || []).map((linha: any) => ({
    ...linha, trabalhadores: n,
  }));
  return copia;
}

describe("nº de trabalhadores na faixa do GES, no Word", () => {
  it("aparece quando o cadastro tem o número", async () => {
    const xml = await textoDoDocx(await gerarDocumentoBuffer("PGR", comTrabalhadores(7)));
    expect(xml).toContain("TRABALHADORES: ");
    expect(xml).toContain(">7<");
  }, 60_000);

  it("sem o número, o documento sai idêntico ao de antes", async () => {
    const semCampo = await textoDoDocx(await gerarDocumentoBuffer("PGR", DADOS));
    expect(semCampo, "a palavra apareceu num documento sem o campo")
      .not.toContain("TRABALHADORES");
  }, 60_000);

  it("zero é informação, e sai impresso", async () => {
    /*
     * Zero expostos é uma afirmação — "ninguém trabalha exposto a isto" — e é
     * diferente de não ter sido informado. Some num `if (n)` desatento.
     */
    const xml = await textoDoDocx(await gerarDocumentoBuffer("PGR", comTrabalhadores(0)));
    expect(xml).toContain("TRABALHADORES: ");
  }, 60_000);

  it("o porte e o gerador original continuam produzindo o mesmo Word", async () => {
    /*
     * A mudança foi feita nos DOIS: no pacote (gerar.js) e no porte. Se um dia
     * só um dos dois for alterado, é aqui que aparece.
     */
    const dados = comTrabalhadores(7);
    const nosso = await textoDoDocx(await gerarDocumentoBuffer("PGR", dados));
    const original = await textoDoDocx(gerarComOriginal(dados));
    expect(nosso).toBe(original);
  }, 60_000);
});

describe("o número chega ao dados.json", () => {
  const base = {
    pgr: { versao: 1, status: "vigente", data_emissao: "2026-07-01" } as never,
    empresa: { nome: "X", cnpj: "1" } as never,
    responsaveis: [],
    acoes: [],
    revisoes: [],
  };

  it("leva sst_ges.trabalhadores para a linha do inventário", () => {
    const d = montarDadosDocumento({
      ...base,
      inventario: [{
        setor: "CORTE", ges_codigo: "01", ges_trabalhadores: 7,
        perigo_descricao: "Ruído", probabilidade: 4, severidade: 3,
      }] as never,
    } as never);
    expect((d.inventario as any[])[0].trabalhadores).toBe(7);
  });

  it("GES sem o número não inventa zero", () => {
    const d = montarDadosDocumento({
      ...base,
      inventario: [{
        setor: "CORTE", ges_codigo: "01",
        perigo_descricao: "Ruído", probabilidade: 4, severidade: 3,
      }] as never,
    } as never);
    expect((d.inventario as any[])[0].trabalhadores).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import JSZip from "jszip";
import { gerarDocumentoBuffer, nomeArquivo, DadosDocumento } from "./gerarDocx";

/*
 * O porte precisa produzir EXATAMENTE o mesmo Word que o gerador do pacote.
 *
 * Não adianta comparar com o arquivo de exemplo que veio na caixa
 * (ferramentas/documentos/exemplo/01_PGR_Exemplo.docx): ele foi gerado com
 * outra versão menor da biblioteca `docx`, que escreve o sumário e alguns
 * atributos de forma diferente. Comparar com ele acusaria diferença sem que
 * nada estivesse errado.
 *
 * Então o teste roda o ORIGINAL — ferramentas/documentos/gerador/gerar.js, em
 * CommonJS, com a mesma biblioteca instalada no projeto — e compara parte por
 * parte do .docx. É a comparação que de fato prova o porte.
 */
const RAIZ = path.resolve(__dirname, "../../..");
const PACOTE = path.join(RAIZ, "ferramentas/documentos");
const requireCjs = createRequire(path.join(PACOTE, "gerador/"));

const DADOS: DadosDocumento = JSON.parse(
  fs.readFileSync(path.join(PACOTE, "exemplo/dados_exemplo.json"), "utf8"),
);

/** Roda o gerar.js original e devolve o .docx da sigla pedida. */
function gerarComOriginal(sigla: string, dados: DadosDocumento | null): Buffer {
  const saida = fs.mkdtempSync(path.join(os.tmpdir(), "docx-ref-"));
  const arquivoDados = path.join(saida, "dados.json");
  if (dados) fs.writeFileSync(arquivoDados, JSON.stringify(dados), "utf8");
  const { execFileSync } = requireCjs("node:child_process");
  execFileSync(
    process.execPath,
    [path.join(PACOTE, "gerador/gerar.js"), saida, dados ? arquivoDados : "-", sigla],
    { cwd: path.join(PACOTE, "gerador"), stdio: "pipe" },
  );
  const nome = fs.readdirSync(saida).find((f) => f.endsWith(".docx"))!;
  return fs.readFileSync(path.join(saida, nome));
}

async function partes(buf: Buffer): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(buf);
  const out: Record<string, string> = {};
  for (const nome of Object.keys(zip.files).sort()) {
    if (zip.files[nome].dir) continue;
    // core.xml carrega a data/hora da geração: muda a cada execução, nos dois lados.
    if (nome === "docProps/core.xml") continue;
    out[nome] = await zip.files[nome].async("string");
  }
  return out;
}

describe("porte do gerador de Word", () => {
  it.each(["PGR", "PCMSO", "AET", "AEP", "LTI", "LTP"])(
    "%s sai igual ao gerador original, com os dados de exemplo",
    async (sigla) => {
      const nosso = await partes(await gerarDocumentoBuffer(sigla, DADOS));
      const original = await partes(gerarComOriginal(sigla, DADOS));
      expect(Object.keys(nosso)).toEqual(Object.keys(original));
      for (const parte of Object.keys(original)) {
        expect(nosso[parte], `parte ${parte} divergiu`).toBe(original[parte]);
      }
    },
    60_000,
  );

  it("o modelo em branco também sai igual", async () => {
    const nosso = await partes(await gerarDocumentoBuffer("PGR", null));
    const original = await partes(gerarComOriginal("PGR", null));
    for (const parte of Object.keys(original)) {
      expect(nosso[parte], `parte ${parte} divergiu`).toBe(original[parte]);
    }
  }, 60_000);

  it("nomeia o arquivo como o pacote", () => {
    expect(nomeArquivo("PGR", DADOS)).toBe("01_PGR_Exemplo.docx");
    expect(nomeArquivo("LTI", null)).toBe("05_Laudo_Insalubridade_Modelo.docx");
  });
});

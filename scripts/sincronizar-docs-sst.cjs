/*
 * Regera src/lib/documentos/docsSst.ts a partir do pacote original
 * (ferramentas/documentos/gerador/docs.js).
 *
 * O pacote é a fonte dos textos de norma. Copiar à mão abriria espaço para
 * erro de digitação exatamente onde não pode haver: a palavra da NR.
 *
 * Uso: npm run documentos:sincronizar
 */
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..");
const docs = require(path.join(RAIZ, "ferramentas/documentos/gerador/docs.js"));
const DESTINO = path.join(RAIZ, "src/lib/documentos/docsSst.ts");

const CABECALHO = fs.readFileSync(DESTINO, "utf8").split("export const DOCUMENTOS_SST: DocumentoSst[] = ")[0];

fs.writeFileSync(
  DESTINO,
  CABECALHO + "export const DOCUMENTOS_SST: DocumentoSst[] = " + JSON.stringify(docs, null, 2) + ";\n",
  "utf8",
);
console.log(`docsSst.ts atualizado: ${docs.length} documentos (${docs.map((d) => d.sigla).join(", ")})`);

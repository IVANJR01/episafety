/*
 * Campos preenchíveis dos documentos SST.
 *
 * Porte de uma ideia que está igual em gerador/gerar.js e gerador/niveis.js:
 * o documento é escrito uma vez com marcadores, e cada marcador vira o valor
 * da empresa quando existe, ou aparece como {{CAMPO}} em azul quando não
 * existe. É essa regra que garante que nada seja inventado.
 *
 * No pacote original isso vivia em `globalThis.VALORES`, porque eram scripts
 * de linha de comando. Aqui o valor fica num módulo e é trocado por
 * `comValores()`, que repõe o anterior ao final — assim duas gerações
 * seguidas não se misturam.
 */
import { TextRun } from "docx";

/** Azul do pacote original: a cor que marca "falta preencher". */
export const COR_CAMPO_VAZIO = "1F6FB2";

export type ValoresEmpresa = Record<string, string | number | undefined | null>;

let VALORES: ValoresEmpresa = {};

export function definirValores(v: ValoresEmpresa | null | undefined) {
  VALORES = v || {};
}

/** Roda `fn` com estes valores e devolve os anteriores ao terminar. */
export async function comValores<T>(v: ValoresEmpresa | null | undefined, fn: () => Promise<T>): Promise<T> {
  const anterior = VALORES;
  definirValores(v);
  try {
    return await fn();
  } finally {
    VALORES = anterior;
  }
}

export const valorDe = (nome: string) => VALORES[nome];

/**
 * Um campo do documento. Com valor, sai como texto normal; sem valor, sai como
 * {{NOME}} em azul.
 *
 * Diferença deliberada do original: lá o teste é `v ? ...`, então o número 0
 * cairia como "não preenchido". Aqui 0 é um valor e sai como 0. Nenhum campo
 * de empresa é numérico hoje, então os documentos saem iguais; mas a regra
 * certa é a daqui.
 *
 * O `o.color` recebido é descartado quando há valor — menos quando é o próprio
 * azul de marcador, caso em que também se descarta. É assim no original: a cor
 * passada serve para o placeholder; o valor real herda a cor do parágrafo.
 */
export function campo(nome: string, o: Record<string, unknown> = {}): TextRun {
  const v = VALORES[nome];
  if (v !== undefined && v !== null && v !== "") {
    return new TextRun({
      text: String(v),
      font: "Calibri",
      ...o,
      color: o.color && o.color !== COR_CAMPO_VAZIO ? (o.color as string) : undefined,
    });
  }
  return new TextRun({ text: `{{${nome}}}`, font: "Calibri", color: COR_CAMPO_VAZIO, ...o });
}

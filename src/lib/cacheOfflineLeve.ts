/**
 * O que vai para a cópia offline — e o que fica só no servidor.
 *
 * O modo offline guarda uma cópia das tabelas no localStorage do
 * navegador, que tem limite de ~5 MB por site (medido no Chromium: 4,98
 * MB). A assinatura de cada entrega é uma IMAGEM guardada como texto,
 * ~40 KB cada. Medido no banco em 18/11/2026: a maior empresa tinha 109
 * entregas ocupando 4,61 MB — 93% do limite só com elas. Somando as
 * outras tabelas, 4,93 MB de 4,98.
 *
 * E a fila do que foi feito offline mora no MESMO espaço. Com a cópia
 * ocupando tudo, sobrava lugar para UMA entrega com assinatura; a
 * segunda dava "Memória offline cheia" — justamente em campo, sem
 * internet, que é quando o modo offline existe para funcionar. E a
 * cópia, quando não cabia, falhava calada: a lista de entregas aparecia
 * vazia sem nenhum aviso.
 *
 * Offline ninguém precisa ver a imagem da assinatura: precisa saber que
 * ela EXISTE (a tela mostra "Assinado", a ficha não pede assinatura de
 * novo). Então a cópia guarda uma marca no lugar da imagem. Online, a
 * tela continua lendo do servidor, com a imagem.
 *
 * Sem banco, sem React: entra a linha, sai a linha mais leve.
 */

/** O que fica no lugar da imagem na cópia offline. */
export const MARCA_IMAGEM_NO_SERVIDOR = "__IMAGEM_NO_SERVIDOR__";

/**
 * Campos que guardam imagem de assinatura ou foto e não são usados
 * offline. O logo da empresa NÃO entra: ele vai nos PDFs gerados sem
 * internet.
 */
const CAMPOS_DE_IMAGEM = ["assinatura_colaborador", "foto_reconhecimento", "assinatura"] as const;

/** Imagem embutida em texto, do tamanho que pesa. */
function imagemPesada(valor: unknown): boolean {
  return typeof valor === "string" && valor.startsWith("data:") && valor.length > 512;
}

/** A versão da linha que vai para a cópia offline. */
export function linhaParaCache<T>(linha: T): T {
  if (!linha || typeof linha !== "object") return linha;
  let copia: Record<string, unknown> | null = null;
  for (const campo of CAMPOS_DE_IMAGEM) {
    const valor = (linha as Record<string, unknown>)[campo];
    if (imagemPesada(valor)) {
      copia = copia || { ...(linha as Record<string, unknown>) };
      copia[campo] = MARCA_IMAGEM_NO_SERVIDOR;
    }
  }
  return (copia as T) || linha;
}

/** Aplica a todas as linhas. Lista que não é lista passa como está. */
export function linhasParaCache<T>(linhas: T[]): T[] {
  return Array.isArray(linhas) ? linhas.map(linhaParaCache) : linhas;
}

/** A imagem desta assinatura está só no servidor? */
export function imagemSoNoServidor(valor: unknown): boolean {
  return valor === MARCA_IMAGEM_NO_SERVIDOR;
}

/**
 * Código de verificação da assinatura na Ficha de EPI.
 *
 * A ficha já trazia a assinatura e a data/hora, mas nada que ligasse aquele
 * desenho àquele registro: duas linhas com assinaturas parecidas eram
 * indistinguíveis no papel, e não havia como conferir depois se a imagem
 * impressa é mesmo a que está guardada.
 *
 * O código resolve isso. Ele é derivado do próprio registro — id da entrega,
 * imagem da assinatura e instante em que foi coletada —, então:
 *
 *   · a mesma entrega gera sempre o mesmo código (dá para conferir depois);
 *   · trocar a assinatura muda o código (a troca fica visível);
 *   · entregas diferentes têm códigos diferentes, mesmo com assinatura igual.
 *
 * Não é assinatura digital ICP-Brasil, e o rodapé da ficha continua dizendo
 * isso. É um código de conferência, do mesmo tipo que o sistema já usa em PGR,
 * LTCAT e PPP.
 */

/**
 * O texto que vira código. Separado da parte criptográfica para poder ser
 * testado sem depender de `crypto`, e para deixar explícito o que entra na
 * conta — mudar isso muda todos os códigos já impressos.
 */
export function textoParaCodigo(entrega: {
  id?: string | null;
  created_at?: string | null;
  assinatura_colaborador?: string | null;
}): string {
  return [
    entrega.id || "",
    entrega.created_at || "",
    entrega.assinatura_colaborador || "",
  ].join("|");
}

/** Quantos caracteres do resumo entram no papel. */
export const TAMANHO_DO_CODIGO = 40;

/**
 * Calcula o código de uma entrega. Devolve null quando não há assinatura —
 * código embaixo de espaço em branco sugeriria assinatura que não existe.
 */
export async function calcularCodigoDeAssinatura(entrega: {
  id?: string | null;
  created_at?: string | null;
  assinatura_colaborador?: string | null;
}): Promise<string | null> {
  if (!entrega.assinatura_colaborador) return null;
  try {
    const bytes = new TextEncoder().encode(textoParaCodigo(entrega));
    const resumo = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(resumo))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, TAMANHO_DO_CODIGO);
  } catch {
    // Sem `crypto` disponível a ficha sai sem o código, e não deixa de sair.
    return null;
  }
}

/** Calcula os códigos de uma ficha inteira, na ordem das entregas. */
export async function calcularCodigosDaFicha<T extends {
  id?: string | null; created_at?: string | null; assinatura_colaborador?: string | null;
}>(entregas: T[]): Promise<(string | null)[]> {
  return Promise.all((entregas || []).map(calcularCodigoDeAssinatura));
}

/** Data e hora com segundos, como o comprovante de assinatura pede. */
export function dataHoraComSegundos(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

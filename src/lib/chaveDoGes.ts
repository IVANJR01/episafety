/**
 * O código de um GES, em uma forma só.
 *
 * O caso real: no PGR da G91 a planilha guarda o GES como número do
 * Excel — "1.0", "2.0", "3.1". A leitura transformava "1.0" em "01" e
 * "3.1" continuava "3.1". Quando faltava o GES na linha, o código
 * inventava o texto "GES 01". Resultado: o MESMO grupo de expostos
 * existia no banco com três grafias — "1", "01" e "GES 01" — e nenhuma
 * delas reconhecia a outra.
 *
 * Dois estragos saíram disso, os dois vistos no banco do cliente:
 *
 * 1. Os quatro riscos de PCP, FINANCEIRO, RH e SESMT — que na planilha
 *    são todos do GES 1.0, numa célula mesclada — ficaram sem GES
 *    nenhum, porque procuraram por "01" e no banco estava "GES 01".
 * 2. Reimportar o mesmo PGR em outra empresa criou 34 GES onde a
 *    planilha tem 25: os nove primeiros nasceram de novo, agora como
 *    "01".."09", ao lado dos "1".."9" da importação anterior.
 *
 * Aqui não há banco, nem IA, nem React: entra o código como veio, saem
 * duas coisas — a CHAVE, que serve para comparar, e o código VISÍVEL,
 * que serve para mostrar.
 */

interface PartesDoCodigo {
  /** A parte inteira, sem zeros à esquerda: "1", "10". */
  inteiro: string;
  /** O subgrupo, quando existe: o "1" de "3.1". Sem o ".0" inútil. */
  subgrupo: string;
}

/** Tira acento, caixa e espaço repetido. */
function semEnfeite(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tira o "GES"/"GHE" da frente, com o que vier separando ele do número.
 *
 * Só tira quando a palavra termina ali: "GESTÃO" não vira "TÃO".
 */
function semPrefixo(bruto: string): string {
  return bruto.replace(/^(ges|ghe|grupo)\b[\s:.\-–—]*(?:n[º°o]?[\s.]*)?/i, "").trim();
}

function separar(codigo: unknown): PartesDoCodigo | null {
  const bruto = String(codigo ?? "").trim().replace(",", ".");
  if (!bruto) return null;

  const numero = semPrefixo(bruto).match(/^(\d+)(?:\.(\d+))?$/);
  if (!numero) return null;

  /* "1.0" é o jeito do Excel escrever 1 — o ".0" não é subgrupo. */
  const subgrupo = numero[2] && Number(numero[2]) !== 0 ? numero[2] : "";
  /* "01" e "1" são o mesmo GES. */
  const inteiro = String(Number(numero[1]));

  return { inteiro, subgrupo };
}

/**
 * A chave de comparação: dois códigos com a mesma chave são o MESMO GES.
 *
 * É ela que decide se a importação encontra o GES que já existe ou cria
 * um irmão gêmeo ao lado dele.
 */
export function chaveDoGes(codigo: unknown): string {
  const partes = separar(codigo);

  if (!partes) {
    /* Código que não é número ("ADMINISTRATIVO") ainda precisa casar consigo mesmo. */
    return semEnfeite(semPrefixo(String(codigo ?? "").trim()));
  }

  return partes.subgrupo ? `${partes.inteiro}.${partes.subgrupo}` : partes.inteiro;
}

/**
 * O código como a tela mostra: dois dígitos na parte inteira.
 *
 * Sem isso a Estrutura ocupacional escrevia "03, 3.1" lado a lado, no
 * mesmo setor, para dois GES irmãos.
 */
export function codigoVisivelDoGes(codigo: unknown): string {
  const partes = separar(codigo);
  if (!partes) return String(codigo ?? "").trim();

  const inteiro = partes.inteiro.padStart(2, "0");
  return partes.subgrupo ? `${inteiro}.${partes.subgrupo}` : inteiro;
}

/** O nome que acompanha o código, quando o documento não dá um. */
export function nomeVisivelDoGes(codigo: unknown, nome?: unknown): string {
  const dado = String(nome ?? "").trim();
  if (dado) return dado;

  const visivel = codigoVisivelDoGes(codigo);
  if (!visivel) return "GES";
  return /^ges\b/i.test(visivel) ? visivel : `GES ${visivel}`;
}

/**
 * Os códigos que, vindos do mesmo documento, apontam para o mesmo GES.
 *
 * Serve para a tela avisar antes de gravar, em vez de o técnico
 * descobrir o duplicado três meses depois, na auditoria.
 */
export function codigosDuplicados(codigos: unknown[]): string[][] {
  const porChave = new Map<string, string[]>();

  for (const codigo of codigos) {
    const texto = String(codigo ?? "").trim();
    if (!texto) continue;
    const chave = chaveDoGes(texto);
    if (!chave) continue;
    const lista = porChave.get(chave) || [];
    /* A mesma grafia repetida não é divergência; grafias diferentes são. */
    if (!lista.includes(texto)) lista.push(texto);
    porChave.set(chave, lista);
  }

  return [...porChave.values()].filter((lista) => lista.length > 1);
}

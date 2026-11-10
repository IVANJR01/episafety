/**
 * O que a página de assinatura mostra quando alguma coisa dá errado.
 *
 * Quem abre esse link é o trabalhador, no celular dele, muitas vezes no
 * portão da obra. Quando faltou a função no banco, a tela mostrou para
 * ele exatamente isto:
 *
 *   "Could not find the function
 *    public.consultar_entregas_pendentes_publico(p_funcionario_id)
 *    in the schema cache"
 *
 * Em inglês, com nome de função de banco de dados. Para o trabalhador não
 * significa nada, e ele não tem o que fazer com isso — vai achar que a
 * culpa é dele ou que o link é golpe.
 *
 * Aqui dentro não há React nem banco: entra o que deu errado, sai o que
 * a pessoa lê. O texto técnico continua existindo, separado, para ir ao
 * console e para quem dá suporte.
 */

export interface RecadoDeErro {
  /** O que o trabalhador lê na tela. */
  mensagem: string;
  /** O texto original, para o console. Null quando não houve falha técnica. */
  tecnico: string | null;
}

/** O texto cru de um erro, venha ele de onde vier. */
function textoDoErro(falha: unknown): string | null {
  if (falha == null) return null;
  if (typeof falha === "string") return falha.trim() || null;
  if (typeof falha === "object") {
    const o = falha as { message?: unknown; details?: unknown; error?: unknown };
    for (const campo of [o.message, o.details, o.error]) {
      if (typeof campo === "string" && campo.trim()) return campo.trim();
    }
  }
  return String(falha);
}

/**
 * Monta o recado da tela.
 *
 * `recusaDoServidor` é o motivo que o próprio sistema devolveu — já vem
 * escrito em português, pensado para o trabalhador ("Não há entregas
 * pendentes de assinatura"), então é mostrado como está.
 *
 * `falhaTecnica` é o que quebrou sem ninguém prever: função faltando,
 * permissão, servidor fora do ar. Esse nunca vai para a tela.
 */
export function recadoDeErro(entrada: {
  acao: "carregar" | "assinar";
  recusaDoServidor?: string | null;
  falhaTecnica?: unknown;
  /** false quando o aparelho está sem rede. */
  comInternet?: boolean;
}): RecadoDeErro {
  const recusa = entrada.recusaDoServidor?.trim();
  if (recusa) return { mensagem: recusa, tecnico: null };

  const tecnico = textoDoErro(entrada.falhaTecnica);

  if (entrada.comInternet === false || pareceFalhaDeRede(tecnico)) {
    return {
      mensagem:
        "Sem conexão com a internet. Verifique o sinal do seu celular e abra o link de novo.",
      tecnico,
    };
  }

  if (falhaQueNaoAdiantaRepetir(tecnico)) {
    return { mensagem: recadoDeFalhaDoSistema(entrada.acao), tecnico };
  }

  if (!tecnico) {
    return { mensagem: recadoPadrao(entrada.acao), tecnico: null };
  }

  return { mensagem: recadoPadrao(entrada.acao), tecnico };
}

/**
 * A falha é do sistema, e tentar de novo não resolve.
 *
 * Aconteceu de verdade: a API respondeu 404 em
 * /rest/v1/rpc/assinar_entregas_publico durante quatro dias, porque o
 * catálogo dela estava desatualizado e a função não aparecia. A
 * trabalhadora tirou a selfie, clicou em "Confirmar e Assinar" e leu
 * "Tente de novo" — sete vezes, pelos registros. Nenhuma delas tinha
 * chance de funcionar, e o técnico não ficou sabendo de nada.
 *
 * Quando o motivo é esse, mandar tentar de novo é mentira. O recado tem
 * que ser: pare e avise alguém.
 */
function falhaQueNaoAdiantaRepetir(tecnico: string | null): boolean {
  if (!tecnico) return false;
  return /PGRST\d+|could not find the function|schema cache|does not exist|permission denied|42883|42501/i
    .test(tecnico);
}

function pareceFalhaDeRede(tecnico: string | null): boolean {
  if (!tecnico) return false;
  return /failed to fetch|networkerror|network request failed|load failed|err_internet/i
    .test(tecnico);
}

/**
 * O recado padrão diz o que fazer, e para quem falar.
 *
 * Mandar o trabalhador procurar "o responsável pela entrega dos EPIs" é o
 * caminho que existe de verdade: é quem mandou o link e quem consegue
 * resolver. Pedir para ele "tentar mais tarde" e parar por aí deixa a
 * entrega sem assinatura e ninguém sabendo.
 */
function recadoPadrao(acao: "carregar" | "assinar"): string {
  return acao === "carregar"
    ? "Não foi possível abrir seus EPIs pendentes agora. Tente de novo em alguns minutos; se continuar assim, avise o responsável pela entrega dos EPIs na sua empresa."
    : "Não foi possível registrar sua assinatura agora. Tente de novo; se continuar assim, avise o responsável pela entrega dos EPIs na sua empresa.";
}

/**
 * O recado de quando repetir não adianta.
 *
 * Nenhuma menção a "tente de novo": o problema está do lado do sistema e
 * só quem administra resolve. A frase manda avisar AGORA, porque a
 * entrega fica sem assinatura até alguém mexer.
 */
function recadoDeFalhaDoSistema(acao: "carregar" | "assinar"): string {
  const oQue = acao === "carregar" ? "abrir seus EPIs pendentes" : "registrar sua assinatura";
  return (
    `O sistema está com uma falha e não consegue ${oQue}. ` +
    "Não é problema do seu celular, e tentar de novo não vai adiantar. " +
    "Avise agora o responsável pela entrega dos EPIs na sua empresa."
  );
}

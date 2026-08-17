/**
 * Pegar a versão nova sozinho, em segundos, sem atropelar quem está digitando.
 *
 * O problema que isto resolve: o aplicativo instalado no celular ficava preso
 * no pacote antigo. Um cadastro feito nele não aparecia — não porque o
 * cadastro se perdesse, mas porque aquele pacote era anterior às correções de
 * sincronização. A detecção de versão dependia de uma constante escrita à mão
 * que ficou parada por 290 commits, então nunca disparava.
 *
 * Agora o id da versão vem do build (ver vite.config.ts) e é publicado em
 * /version.json. Este módulo compara de tempos em tempos e recarrega.
 *
 * A parte delicada é QUANDO recarregar. Recarregar no meio de um cadastro
 * apaga o que a pessoa digitou — trocaria um problema por outro pior, porque
 * perder trabalho digitado é mais grave do que rodar cinco minutos numa versão
 * antiga. Por isso a decisão é explícita e está em `decidirRecarga`, separada
 * do resto para poder ser testada.
 */

/** Id da versão em execução, injetado pelo build. */
declare const __BUILD_ID__: string;

export const ID_DESTA_VERSAO: string =
  typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "desenvolvimento";

/**
 * Versão para mostrar na tela.
 *
 * O rodapé do menu mostrava `APP_VERSION`, a constante escrita à mão que ficou
 * em "2.4.6" por 290 commits. Quem clicava em "Atualizar" e via o mesmo número
 * de sempre não tinha como saber se o aplicativo tinha trocado de versão ou
 * não — que era exatamente a dúvida.
 *
 * O id do build é `<commit>-<carimbo>`; para a tela basta o commit.
 */
export function versaoParaMostrar(id: string = ID_DESTA_VERSAO): string {
  return id.split("-")[0] || id;
}

export interface EstadoDaTela {
  /** A aba está em segundo plano? */
  oculta: boolean;
  /** O foco está num campo de digitação? */
  digitando: boolean;
}

export type Decisao = "recarregar" | "esperar";

/**
 * Recarrega agora ou espera?
 *
 * - Aba oculta: recarrega. É o caso do celular com o aplicativo em segundo
 *   plano, e é exatamente quando não há nada a perder.
 * - Pessoa digitando: espera. Vale para campo de texto e para qualquer área
 *   editável — recarregar aqui apagaria o cadastro pela metade.
 * - Aba visível e ninguém digitando: recarrega. A tela pode estar aberta há
 *   horas sem ninguém na frente, e é assim que o celular fica desatualizado.
 */
export function decidirRecarga(estado: EstadoDaTela): Decisao {
  if (estado.oculta) return "recarregar";
  if (estado.digitando) return "esperar";
  return "recarregar";
}

/** Lê o estado real da tela. Fora do navegador devolve algo seguro. */
export function lerEstadoDaTela(): EstadoDaTela {
  if (typeof document === "undefined") return { oculta: false, digitando: true };
  const ativo = document.activeElement as HTMLElement | null;
  const tag = ativo?.tagName?.toLowerCase();
  const digitando = tag === "input" || tag === "textarea" || tag === "select"
    || ativo?.isContentEditable === true;
  return { oculta: document.visibilityState === "hidden", digitando };
}

/**
 * Busca o id publicado. `no-store` é obrigatório: sem ele o próprio cache
 * devolveria o arquivo antigo e a verificação nunca acusaria nada.
 */
export async function buscarVersaoPublicada(): Promise<string | null> {
  try {
    const resp = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) return null;
    const dados = await resp.json();
    return typeof dados?.build === "string" ? dados.build : null;
  } catch {
    // Sem rede, ou servindo de um lugar que não tem o arquivo. Não é erro:
    // simplesmente não há o que comparar agora.
    return null;
  }
}

/**
 * Marca de qual versão já provocou recarga nesta sessão.
 *
 * Sem isto existe um laço: se o recarregamento não trouxer o pacote novo — CDN
 * servindo cópia velha, cache intermediário, publicação pela metade —, a
 * página volta, detecta a mesma diferença e recarrega de novo, para sempre. O
 * aplicativo ficaria piscando na mão do usuário, e a causa (cache do
 * servidor) não seria nem percebida.
 *
 * Uma recarga por versão detectada. Se a diferença persistir, o problema é do
 * outro lado e insistir não resolve.
 */
const CHAVE_RECARGA = "versao-ja-recarregada";

function jaRecarregouPor(id: string): boolean {
  try { return sessionStorage.getItem(CHAVE_RECARGA) === id; } catch { return false; }
}

function marcarRecarga(id: string): void {
  try { sessionStorage.setItem(CHAVE_RECARGA, id); } catch { /* sessão sem storage */ }
}

export interface OpcoesVerificacao {
  intervaloMs?: number;
  aoDetectar?: (idNovo: string) => void;
  recarregar?: () => void;
}

/**
 * Liga a verificação periódica. Devolve a função que desliga.
 *
 * Além do intervalo, verifica quando a aba volta ao primeiro plano e quando a
 * rede volta — os dois momentos em que o aparelho pode ter passado horas
 * desligado do mundo, que é justamente o caso do celular.
 */
export function iniciarVerificacaoDeVersao(opcoes: OpcoesVerificacao = {}): () => void {
  const intervalo = opcoes.intervaloMs ?? 60_000;
  const recarregar = opcoes.recarregar ?? (() => window.location.reload());

  let pendente: string | null = null;
  let parado = false;

  const aplicarSePuder = () => {
    if (!pendente || parado) return;
    if (jaRecarregouPor(pendente)) {
      // Já se recarregou por esta versão e a diferença continua: recarregar de
      // novo só produziria laço. Fica registrado para quem for investigar.
      parado = true;
      console.warn(
        "[versão] recarga já tentada para", pendente,
        "e a versão em execução continua", ID_DESTA_VERSAO,
        "— provável cache do servidor servindo o pacote antigo.",
      );
      return;
    }
    if (decidirRecarga(lerEstadoDaTela()) === "recarregar") {
      parado = true;
      marcarRecarga(pendente);
      recarregar();
    }
  };

  const verificar = async () => {
    if (parado || pendente) { aplicarSePuder(); return; }
    const publicada = await buscarVersaoPublicada();
    if (!publicada || publicada === ID_DESTA_VERSAO) return;
    pendente = publicada;
    opcoes.aoDetectar?.(publicada);
    aplicarSePuder();
  };

  const timer = setInterval(() => void verificar(), intervalo);
  const aoVoltar = () => void verificar();
  // `blur` num campo é o instante em que "esperar" pode virar "recarregar".
  const aoSairDoCampo = () => aplicarSePuder();

  window.addEventListener("focus", aoVoltar);
  window.addEventListener("online", aoVoltar);
  document.addEventListener("visibilitychange", aoVoltar);
  document.addEventListener("focusout", aoSairDoCampo);

  void verificar();

  return () => {
    parado = true;
    clearInterval(timer);
    window.removeEventListener("focus", aoVoltar);
    window.removeEventListener("online", aoVoltar);
    document.removeEventListener("visibilitychange", aoVoltar);
    document.removeEventListener("focusout", aoSairDoCampo);
  };
}

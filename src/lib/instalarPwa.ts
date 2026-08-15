/**
 * Pedir para instalar o aplicativo, sem virar erro de tela.
 *
 * O navegador EXIGE que `prompt()` seja chamado durante um gesto do usuário —
 * um clique. Não é limitação contornável: é a regra que impede site de abrir
 * caixa de instalação sozinho.
 *
 * O código tinha três chamadas fora de clique. A pior ficava na tela de login:
 * o `InstallBanner` com `autoTrigger` chamava `prompt()` DENTRO do próprio
 * evento `beforeinstallprompt`, que dispara ao carregar a página. O navegador
 * recusava com
 *
 *   Failed to execute 'prompt' on 'BeforeInstallPromptEvent':
 *   The prompt() method must be called with a user gesture
 *
 * e, como ninguém tratava a promessa, a recusa subia como "promessa sem
 * tratamento" e estourava o aviso de erro em cima da tela de login — em toda
 * abertura, em todo navegador que suporta instalação.
 *
 * Aqui a chamada é sempre embrulhada. Instalação que não rola é evento comum
 * (usuário cancela, já instalado, navegador sem suporte) e não pode parecer
 * defeito do sistema.
 */

export type ResultadoInstalacao = "aceito" | "recusado" | "indisponivel";

interface EventoInstalacao {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Dispara a caixa de instalação. CHAME DIRETO DO onClick.
 *
 * Qualquer `await` antes desta chamada perde o gesto do usuário e o navegador
 * recusa — por isso ela não faz nenhum trabalho assíncrono antes de `prompt()`.
 *
 * Nunca rejeita: devolve "indisponivel" quando não deu, para quem chama
 * decidir o que mostrar.
 */
export async function pedirInstalacao(evento: unknown): Promise<ResultadoInstalacao> {
  const e = evento as EventoInstalacao | null;
  if (!e || typeof e.prompt !== "function") return "indisponivel";

  try {
    // Em navegador atual isto devolve promessa; em versões antigas pode lançar
    // direto. Os dois casos caem no mesmo tratamento.
    await e.prompt();
    const escolha = await e.userChoice;
    return escolha?.outcome === "accepted" ? "aceito" : "recusado";
  } catch (erro) {
    // Registrar sem alarde: é informação para quem desenvolve, não para quem
    // está tentando entrar no sistema.
    console.warn("[instalarPwa] instalação não pôde ser iniciada:", erro);
    return "indisponivel";
  }
}

/** O aplicativo já está rodando instalado? */
export function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

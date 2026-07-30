import { useEffect, useState } from "react";

/**
 * Mostra, em cima de tudo, o erro que derrubou a tela.
 *
 * Uma barreira de erro do React so pega o que estoura durante a renderizacao de
 * um componente ABAIXO dela. Erro em callback assincrono, em listener de evento
 * ou em promessa sem catch escapa: a tela pode ficar vazia sem que nada apareca
 * — foi o que aconteceu na Solicitacao de Materiais, um retangulo branco sem
 * mensagem nenhuma e sem pista do que quebrou.
 *
 * Este aviso fica acima do dialogo (z-index alto de proposito) justamente para
 * ser visto e fotografado quando isso acontecer de novo.
 */
export default function AvisoErroGlobal() {
  const [erro, setErro] = useState<{ msg: string; onde: string } | null>(null);

  useEffect(() => {
    // Ruido conhecido do navegador, sem efeito para quem usa.
    const ignorar = (m: string) => /ResizeObserver loop|Script error\.?$/i.test(m);

    const aoErro = (e: ErrorEvent) => {
      // Falha ao baixar imagem/script dispara no elemento, nao na janela: nao e
      // quebra de tela e nao deve virar aviso.
      if (e.target && e.target !== window) return;
      if (!e.message || ignorar(e.message)) return;
      setErro({ msg: e.message, onde: `${e.filename || ""}:${e.lineno || 0}` });
    };

    const aoRejeitar = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg = r instanceof Error ? r.message : String(r ?? "");
      if (!msg || ignorar(msg)) return;
      setErro({ msg, onde: "promessa sem tratamento" });
    };

    window.addEventListener("error", aoErro, true);
    window.addEventListener("unhandledrejection", aoRejeitar);
    return () => {
      window.removeEventListener("error", aoErro, true);
      window.removeEventListener("unhandledrejection", aoRejeitar);
    };
  }, []);

  if (!erro) return null;

  return (
    <div
      role="alert"
      // pointer-events-auto e obrigatorio: enquanto um dialogo do Radix esta
      // aberto, o body fica com pointer-events:none e os botoes daqui ficariam
      // visiveis mas sem responder ao clique.
      className="pointer-events-auto fixed inset-x-2 top-2 z-[99999] rounded-lg border border-destructive bg-background p-3 shadow-lg sm:inset-x-auto sm:right-2 sm:max-w-md"
    >
      <div className="text-sm font-semibold text-destructive">Ocorreu um erro nesta tela</div>
      <p className="mt-1 break-words text-xs text-muted-foreground">{erro.msg}</p>
      <p className="mt-0.5 break-all text-[10px] text-muted-foreground">{erro.onde}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs hover:bg-accent"
          onClick={() => navigator.clipboard?.writeText(`${erro.msg} — ${erro.onde}`).catch(() => {})}
        >
          Copiar
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs hover:bg-accent"
          onClick={() => window.location.reload()}
        >
          Recarregar
        </button>
        <button type="button" className="ml-auto rounded px-2 py-1 text-xs hover:bg-accent" onClick={() => setErro(null)}>
          Fechar
        </button>
      </div>
    </div>
  );
}

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";

/**
 * Ações que a etapa ativa expõe para o rodapé do assistente.
 *
 * O rodapé ("Voltar · Salvar rascunho · Salvar e continuar") é único e fica no
 * mesmo cartão do formulário, como manda o desenho. Mas quem sabe salvar é a
 * etapa, não o assistente. Em vez de duplicar um rodapé por etapa, cada etapa
 * registra aqui o que sabe fazer, e o rodapé habilita só o que existe.
 */
export interface AcoesEtapa {
  /** Grava e devolve true quando pode avançar. Ausente = etapa sem formulário. */
  salvar?: () => Promise<boolean>;
  /** Grava sem exigir os campos obrigatórios. */
  salvarRascunho?: () => Promise<void>;
  /** Bloqueia os botões enquanto a gravação está em curso. */
  ocupado?: boolean;
}

interface Registro {
  /** O que o rodapé desenha. */
  flags: { temSalvar: boolean; temRascunho: boolean; ocupado: boolean };
  /** O que o rodapé executa — sempre a closure mais recente da etapa. */
  atual: React.MutableRefObject<AcoesEtapa | null>;
  registrar: (a: AcoesEtapa | null) => void;
}

const VAZIO = { temSalvar: false, temRascunho: false, ocupado: false };

const Ctx = createContext<Registro>({
  flags: VAZIO,
  atual: { current: null },
  registrar: () => {},
});

export function PgrEtapaProvider({ children }: { children: React.ReactNode }) {
  const atual = useRef<AcoesEtapa | null>(null);
  const [flags, setFlags] = useState(VAZIO);

  // A etapa chama isto a cada render para manter a closure fresca. O estado só
  // é atualizado quando algo visível muda, senão todo render do formulário
  // dispararia um render do assistente inteiro.
  const registrar = useCallback((a: AcoesEtapa | null) => {
    atual.current = a;
    const novo = {
      temSalvar: !!a?.salvar,
      temRascunho: !!a?.salvarRascunho,
      ocupado: !!a?.ocupado,
    };
    setFlags((ant) =>
      ant.temSalvar === novo.temSalvar
      && ant.temRascunho === novo.temRascunho
      && ant.ocupado === novo.ocupado
        ? ant
        : novo,
    );
  }, []);

  const valor = useMemo(() => ({ flags, atual, registrar }), [flags, registrar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** Lido pelo rodapé do assistente. */
export function useAcoesEtapa() {
  const { flags, atual } = useContext(Ctx);
  return {
    ...flags,
    salvar: () => atual.current?.salvar?.() ?? Promise.resolve(true),
    salvarRascunho: () => atual.current?.salvarRascunho?.() ?? Promise.resolve(),
  };
}

/**
 * Chamado pela etapa. Passe `null` quando não houver formulário aberto — sem
 * isso o rodapé continuaria oferecendo "Salvar" numa tela de listagem.
 */
export function useRegistrarEtapa(acoes: AcoesEtapa | null) {
  const { registrar } = useContext(Ctx);
  // Sem lista de dependências de propósito: roda depois de todo render da etapa,
  // então a closure guardada nunca fica velha. Não vira laço porque `registrar`
  // só mexe no estado quando algo visível muda. Chamar direto no corpo do
  // componente atualizaria o assistente durante o render da etapa, que o React
  // recusa.
  useEffect(() => { registrar(acoes); });
  useEffect(() => () => registrar(null), [registrar]);
}

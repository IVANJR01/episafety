import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
} from "react";

/**
 * Ações que os formulários da etapa ativa expõem para o rodapé do assistente.
 *
 * O rodapé ("Voltar · Salvar rascunho · Salvar e continuar") é único e fica no
 * mesmo cartão do formulário, como manda o desenho. Mas quem sabe salvar é o
 * formulário, não o assistente.
 *
 * Uma etapa pode ter MAIS DE UM formulário — a etapa 1 tem o bloco de empresa e
 * o de datas, a de ambientes tem ambientes e processos. Por isso o registro é
 * uma coleção: "Salvar e continuar" grava todos e só avança se todos passarem.
 * Com um único registrante, o segundo formulário sobrescreveria o primeiro e o
 * botão salvaria metade da tela em silêncio.
 */
export interface AcoesEtapa {
  /** Grava e devolve true quando pode avançar. */
  salvar?: () => Promise<boolean>;
  /** Grava sem exigir os campos obrigatórios. */
  salvarRascunho?: () => Promise<void>;
  /** Bloqueia os botões enquanto a gravação está em curso. */
  ocupado?: boolean;
}

interface Registro {
  flags: { temSalvar: boolean; temRascunho: boolean; ocupado: boolean };
  registrados: React.MutableRefObject<Map<string, AcoesEtapa>>;
  registrar: (chave: string, a: AcoesEtapa | null) => void;
}

const VAZIO = { temSalvar: false, temRascunho: false, ocupado: false };

const Ctx = createContext<Registro>({
  flags: VAZIO,
  registrados: { current: new Map() },
  registrar: () => {},
});

export function PgrEtapaProvider({ children }: { children: React.ReactNode }) {
  const registrados = useRef<Map<string, AcoesEtapa>>(new Map());
  const [flags, setFlags] = useState(VAZIO);

  const registrar = useCallback((chave: string, a: AcoesEtapa | null) => {
    if (a) registrados.current.set(chave, a);
    else registrados.current.delete(chave);

    const todos = [...registrados.current.values()];
    const novo = {
      temSalvar: todos.some((x) => x.salvar),
      temRascunho: todos.some((x) => x.salvarRascunho),
      ocupado: todos.some((x) => x.ocupado),
    };
    // Só atualiza quando algo visível muda, senão cada render do formulário
    // dispararia um render do assistente inteiro.
    setFlags((ant) =>
      ant.temSalvar === novo.temSalvar
      && ant.temRascunho === novo.temRascunho
      && ant.ocupado === novo.ocupado
        ? ant
        : novo,
    );
  }, []);

  const valor = useMemo(() => ({ flags, registrados, registrar }), [flags, registrar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** Lido pelo rodapé do assistente. */
export function useAcoesEtapa() {
  const { flags, registrados } = useContext(Ctx);
  return {
    ...flags,
    /** Grava todos os formulários da etapa. Um "false" impede o avanço. */
    salvar: async () => {
      const todos = [...registrados.current.values()];
      let ok = true;
      // Em série, não em paralelo: dois updates simultâneos na mesma linha de
      // pgr_documentos fazem o último sobrescrever o primeiro.
      for (const a of todos) {
        if (a.salvar && !(await a.salvar())) ok = false;
      }
      return ok;
    },
    salvarRascunho: async () => {
      for (const a of [...registrados.current.values()]) {
        if (a.salvarRascunho) await a.salvarRascunho();
      }
    },
  };
}

/**
 * Chamado pelo formulário. Passe `null` quando não houver nada a salvar — sem
 * isso o rodapé continuaria oferecendo "Salvar" numa tela de listagem.
 */
export function useRegistrarEtapa(acoes: AcoesEtapa | null) {
  const { registrar } = useContext(Ctx);
  // Identidade estável por instância: dois formulários do mesmo componente na
  // mesma etapa precisam de chaves distintas para não se sobrescreverem.
  const chave = useId();
  // Sem lista de dependências de propósito: roda depois de todo render do
  // formulário, então a closure guardada nunca fica velha. Não vira laço porque
  // `registrar` só mexe no estado quando algo visível muda. Chamar direto no
  // corpo do componente atualizaria o assistente durante o render do filho, que
  // o React recusa.
  useEffect(() => { registrar(chave, acoes); });
  useEffect(() => () => registrar(chave, null), [registrar, chave]);
}

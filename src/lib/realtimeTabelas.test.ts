import { describe, it, expect, vi, beforeEach } from "vitest";
import { assinarTabela, canaisAbertos, fecharTodosOsCanais } from "./realtimeTabelas";

/**
 * O que se protege aqui: um canal POR TABELA, e não por tela.
 *
 * Oito telas leem `funcionarios`. Sem a contagem de uso, seriam oito conexões
 * abertas para receber o mesmo aviso oito vezes — e, pior, a primeira tela a
 * ser fechada derrubaria o canal das outras sete, que ficariam mudas sem
 * ninguém perceber.
 */

const canaisCriados: { nome: string; disparar: () => void }[] = [];
const removidos: string[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const channel = (nome: string) => {
    const alvo: any = {
      nome,
      on: (_evt: string, _filtro: unknown, cb: () => void) => {
        canaisCriados.push({ nome, disparar: cb });
        return alvo;
      },
      subscribe: () => alvo,
    };
    return alvo;
  };
  return {
    supabase: {
      channel,
      removeChannel: (c: any) => { removidos.push(c.nome); },
    },
  };
});

beforeEach(() => {
  fecharTodosOsCanais();
  canaisCriados.length = 0;
  removidos.length = 0;
});

describe("assinarTabela", () => {
  it("abre um canal só, por mais telas que escutem a mesma tabela", () => {
    const a = vi.fn(); const b = vi.fn(); const c = vi.fn();
    assinarTabela("funcionarios", a);
    assinarTabela("funcionarios", b);
    assinarTabela("funcionarios", c);

    expect(canaisCriados).toHaveLength(1);
    expect(canaisAbertos()).toEqual(["funcionarios"]);
  });

  it("avisa todos os ouvintes quando a tabela muda", () => {
    const a = vi.fn(); const b = vi.fn();
    assinarTabela("funcionarios", a);
    assinarTabela("funcionarios", b);

    canaisCriados[0].disparar();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("uma tela sair não cala as outras", () => {
    const a = vi.fn(); const b = vi.fn();
    const sairA = assinarTabela("funcionarios", a);
    assinarTabela("funcionarios", b);

    sairA();
    expect(canaisAbertos()).toEqual(["funcionarios"]);
    expect(removidos).toEqual([]);

    canaisCriados[0].disparar();
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("fecha o canal quando o último ouvinte sai", () => {
    const sairA = assinarTabela("epis", vi.fn());
    const sairB = assinarTabela("epis", vi.fn());

    sairA();
    expect(canaisAbertos()).toEqual(["epis"]);
    sairB();
    expect(canaisAbertos()).toEqual([]);
    expect(removidos).toEqual(["tabela:epis"]);
  });

  it("tabelas diferentes têm canais diferentes", () => {
    assinarTabela("funcionarios", vi.fn());
    assinarTabela("entregas", vi.fn());
    expect(canaisAbertos()).toEqual(["entregas", "funcionarios"]);
    expect(canaisCriados.map((c) => c.nome)).toEqual(["tabela:funcionarios", "tabela:entregas"]);
  });

  it("cancelar duas vezes não derruba canal de outra tela", () => {
    // Acontece de verdade: React em modo estrito monta, desmonta e monta de
    // novo, e o cancelamento antigo pode ser chamado depois do novo assinar.
    const sair = assinarTabela("obras", vi.fn());
    sair();
    sair();
    assinarTabela("obras", vi.fn());
    expect(canaisAbertos()).toEqual(["obras"]);
  });

  it("fecharTodosOsCanais limpa tudo — é o que roda na troca de empresa", () => {
    assinarTabela("funcionarios", vi.fn());
    assinarTabela("epis", vi.fn());
    fecharTodosOsCanais();
    expect(canaisAbertos()).toEqual([]);
    expect(removidos.sort()).toEqual(["tabela:epis", "tabela:funcionarios"]);
  });
});

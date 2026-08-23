import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InventarioTab from "./InventarioTab";

/*
 * COBERTURA REMOVIDA em 15/08: o painel "perigos levantados antes ainda não
 * estão no inventário" saiu da tela em cad3eb38 ("ocultar painel de importação
 * de levantamentos antigos a pedido do cliente"). Os cinco testes que
 * dirigiam aquele painel — importação em lote, fechamento da pendência do
 * levantamento e as regras de quando cobrar — foram retirados junto: teste que
 * aciona botão inexistente não protege nada, e teste que confere ausência numa
 * tela que sumiu passa sozinho, o que é pior.
 *
 * A lógica continua no arquivo (trazerTodos, naoAproveitados, gesSugeridoPara,
 * ligarAoLevantamento), agora sem caminho na interface e sem teste. Se o painel
 * voltar, os testes estão no histórico deste arquivo.
 */

/**
 * O que este teste protege: a linha do inventário que ficou sem GES tem de
 * ser religada sozinha quando a estrutura da empresa dá uma resposta única, e
 * NÃO pode ser chutada quando dá mais de uma. Era a reclamação real — o item
 * do setor PCP, com a função "Ajudante de Confecção" cadastrada dentro do GES
 * 01, imprimindo "N.A" na coluna GES do PGR.
 */

const item = (extra: Record<string, unknown>) => ({
  id: "x", pgr_id: "pgr-1", grupo: "ergonomico", perigo_descricao: "Sobrecarga",
  severidade: 3, probabilidade: 3, ghe_id: null, ges_id: null, ...extra,
});

let tabelas: Record<string, unknown[]>;
const updates: { tabela: string; payload: unknown; ids: unknown }[] = [];
const inserts: { tabela: string; linhas: Record<string, unknown>[] }[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    let modo: "select" | "update" | "insert" | "delete" = "select";
    let payload: unknown = null;
    let criadas: { id: string }[] = [];
    const alvo: any = {
      select: () => alvo,
      eq: (_col: string, valor: unknown) => {
        if (modo === "update") updates.push({ tabela, payload, ids: valor });
        return alvo;
      },
      order: () => alvo,
      update: (p: unknown) => { modo = "update"; payload = p; return alvo; },
      insert: (linhas: Record<string, unknown>[]) => {
        modo = "insert";
        const lista = Array.isArray(linhas) ? linhas : [linhas];
        inserts.push({ tabela, linhas: lista });
        criadas = lista.map((_, i) => ({ id: `novo-${i}` }));
        return alvo;
      },
      delete: () => { modo = "delete"; return alvo; },
      in: (_col: string, ids: unknown) => {
        if (modo === "update") updates.push({ tabela, payload, ids });
        return alvo;
      },
      then: (ok: (r: unknown) => unknown) => {
        // O insert devolve os ids criados, como o PostgREST com .select("id")
        // faz — é deles que sai o vínculo de volta no levantamento.
        const resposta = modo === "select" ? { data: tabelas[tabela] || [], error: null }
          : modo === "insert" ? { data: criadas, error: null }
          : { data: null, error: null };
        return Promise.resolve(resposta).then(ok);
      },
    };
    return alvo;
  };
  return { supabase: { from: consulta } };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// O diálogo abre as próprias consultas e não é o objeto deste teste.
vi.mock("./InventarioItemDialog", () => ({ default: () => null }));

const montar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <InventarioTab pgrId="pgr-1" empresaId="emp-1" status={"rascunho" as never} canEdit />
    </QueryClientProvider>,
  );
};

const estruturaPcp = {
  ghe_ges: [{ id: "g01", codigo: "01", nome: "PCP", status: "ativo" }],
  ghe_setores: [{ ghe_id: "g01", nome: "PCP", setor_id: "s-pcp", ativo: true }],
  ghe_funcoes: [{ ghe_id: "g01", nome_funcao: "Ajudante de Confecção", funcao_id: "f-aj", status: "ativo" }],
  sst_setores: [{ id: "s-pcp", nome: "PCP" }],
  sst_funcoes: [{ id: "f-aj", nome: "Ajudante de Confecção" }],
  sst_ges: [{ id: "g01" }],
  pgr_levantamento_preliminar: [],
};

beforeEach(() => {
  updates.length = 0;
  inserts.length = 0;
  vi.clearAllMocks();
});

describe("InventarioTab — item sem GES", () => {
  it("religa sozinho quando a estrutura aponta um único grupo", async () => {
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [item({ setor: "PCP", funcoes_snapshot: ["Ajudante de Confecção"] })],
    };
    montar();

    await waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0].tabela).toBe("pgr_inventario_itens");
    // ges_id junto porque o grupo existe no Núcleo Mestre (sst_ges).
    expect(updates[0].payload).toEqual({ ghe_id: "g01", ges_id: "g01" });
    expect(updates[0].ids).toEqual(["x"]);
  });

  it("não grava ges_id quando o grupo só existe no legado", async () => {
    tabelas = {
      ...estruturaPcp,
      sst_ges: [], // grupo antigo, fora do Núcleo Mestre: FK recusaria o id
      pgr_inventario_itens: [item({ setor: "PCP", funcoes_snapshot: ["Ajudante de Confecção"] })],
    };
    montar();

    await waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0].payload).toEqual({ ghe_id: "g01" });
  });

  it("não chuta quando dois grupos servem — pede para escolher", async () => {
    tabelas = {
      ...estruturaPcp,
      ghe_ges: [
        { id: "g01", codigo: "01", nome: "PCP", status: "ativo" },
        { id: "g02", codigo: "02", nome: "PCP tarde", status: "ativo" },
      ],
      ghe_setores: [
        { ghe_id: "g01", nome: "PCP", setor_id: "s-pcp", ativo: true },
        { ghe_id: "g02", nome: "PCP", setor_id: "s-pcp", ativo: true },
      ],
      ghe_funcoes: [],
      pgr_inventario_itens: [item({ setor: "PCP", funcoes_snapshot: null })],
    };
    montar();

    expect(await screen.findByText(/2 grupos possíveis: 01, 02/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Escolher GES" })).toBeInTheDocument();
    expect(updates).toHaveLength(0);
  });

  it("avisa quando nenhum grupo bate, em vez de deixar a linha muda", async () => {
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [item({ setor: "ALMOXARIFADO", funcoes_snapshot: ["Empilhadeirista"] })],
    };
    montar();

    expect(await screen.findByText(/nenhum grupo bate com o setor\/função/)).toBeInTheDocument();
    expect(updates).toHaveLength(0);
  });

  it("não mexe em item que já tem grupo", async () => {
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [item({ id: "y", ghe_id: "g01", setor: "PCP", funcoes_snapshot: ["Ajudante de Confecção"] })],
    };
    montar();

    await screen.findByText("Sobrecarga");
    expect(updates).toHaveLength(0);
  });
});

/**
 * A numeração dos itens — 01, 02, 03 — pedida pelo cliente.
 *
 * O teste monta a tabela de verdade porque o risco não está na conta do
 * número, que é trivial e já tem teste próprio em inventarioOrdem: está em
 * ligá-la à linha certa. Uma coluna a mais desloca as colunas congeladas à
 * esquerda, e errar aí sobrepõe células.
 */
describe("InventarioTab — numeração dos itens", () => {
  it("numera as linhas na ordem exibida, com dois dígitos", async () => {
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [
        item({ id: "b", setor: "PCP", ghe_id: "g01", ges_id: "g01", perigo_descricao: "Ruído" }),
        item({ id: "a", setor: "ALMOXARIFADO", ghe_id: "g01", ges_id: "g01", perigo_descricao: "Queda" }),
      ],
    };
    montar();

    // ALMOXARIFADO vem antes de PCP na ordem da tabela, então leva o 01
    // mesmo tendo chegado depois do banco.
    const linhas = await waitFor(() => {
      const l = document.querySelectorAll("tbody tr");
      expect(l.length).toBe(2);
      return l;
    });
    const numeroDaLinha = (tr: Element) => tr.querySelector("td")?.textContent?.trim();
    expect(numeroDaLinha(linhas[0])).toBe("01");
    expect(numeroDaLinha(linhas[1])).toBe("02");
    expect(linhas[0].textContent).toContain("ALMOXARIFADO");
  });

  it("o número NÃO muda com a busca — ele serve para apontar de fora", async () => {
    // Numerar a lista filtrada faria o mesmo item trocar de número enquanto se
    // digita, e um plano de ação que cita "item 02" passaria a apontar errado.
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [
        item({ id: "b", setor: "PCP", ghe_id: "g01", ges_id: "g01", perigo_descricao: "Ruído" }),
        item({ id: "a", setor: "ALMOXARIFADO", ghe_id: "g01", ges_id: "g01", perigo_descricao: "Queda" }),
      ],
    };
    montar();
    await waitFor(() => expect(document.querySelectorAll("tbody tr").length).toBe(2));

    const busca = screen.getByPlaceholderText(/Buscar por perigo/i);
    fireEvent.change(busca, { target: { value: "Ruído" } });

    const restante = await waitFor(() => {
      const l = document.querySelectorAll("tbody tr");
      expect(l.length).toBe(1);
      return l[0];
    });
    // Sozinho na tela, o item do PCP continua sendo o 02.
    expect(restante.querySelector("td")?.textContent?.trim()).toBe("02");
  });

  it("a coluna Item aparece no cabeçalho", async () => {
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [item({ setor: "PCP", ghe_id: "g01", ges_id: "g01" })],
    };
    montar();
    await waitFor(() => expect(screen.getByText("Item")).toBeTruthy());
  });
});

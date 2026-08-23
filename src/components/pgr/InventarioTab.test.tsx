import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
 * A ordem das linhas: GES 01 antes do 02.
 *
 * O teste monta a tabela de verdade porque a regra em si já tem teste próprio
 * em inventarioOrdem — o que falta provar aqui é que a tela usa essa regra, e
 * não a ordenação por nome de setor que existia antes.
 */
describe("InventarioTab — ordem das linhas", () => {
  it("o GES 01 vem antes do 02, mesmo com o setor do 02 antes no alfabeto", async () => {
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [
        item({ id: "esc", setor: "ESCRITÓRIO", ghe_id: "g02", ges_id: "g02",
          perigo_descricao: "Postura", ghe: { id: "g02", codigo: "02", nome: "02" } }),
        item({ id: "pcp", setor: "PCP", ghe_id: "g01", ges_id: "g01",
          perigo_descricao: "Ruído", ghe: { id: "g01", codigo: "01", nome: "01" } }),
      ],
    };
    montar();

    const linhas = await waitFor(() => {
      const l = document.querySelectorAll("tbody tr");
      expect(l.length).toBe(2);
      return l;
    });
    expect(linhas[0].textContent).toContain("PCP");
    expect(linhas[1].textContent).toContain("ESCRITÓRIO");
  });

  it("setor com dois grupos não se parte ao meio — é o que preserva a mesclagem", async () => {
    // COSTURA (01 e 03) e ESCRITÓRIO (02). Ordenar só pelo GES daria
    // COSTURA, ESCRITÓRIO, COSTURA — e o ambiente da COSTURA sairia duas vezes.
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [
        item({ id: "esc", setor: "ESCRITÓRIO", ghe_id: "g02",
          perigo_descricao: "Postura", ghe: { id: "g02", codigo: "02", nome: "02" } }),
        item({ id: "cos3", setor: "COSTURA", ghe_id: "g03",
          perigo_descricao: "Ruído", ghe: { id: "g03", codigo: "03", nome: "03" } }),
        item({ id: "cos1", setor: "COSTURA", ghe_id: "g01",
          perigo_descricao: "Calor", ghe: { id: "g01", codigo: "01", nome: "01" } }),
      ],
    };
    montar();

    await waitFor(() => expect(document.querySelectorAll("tbody tr").length).toBe(3));

    /*
     * A prova é o rowSpan, não o texto das linhas: quando a mesclagem
     * funciona, a célula do setor aparece UMA vez cobrindo as duas linhas —
     * a segunda linha nem tem essa célula. Foi essa a primeira versão errada
     * deste teste, que lia o texto de cada linha e via "COSTURA" só na
     * primeira.
     */
    const celulas = [...document.querySelectorAll("tbody td")];
    const daCostura = celulas.filter((td) => td.textContent?.trim() === "COSTURA");
    expect(daCostura).toHaveLength(1);
    expect(daCostura[0].getAttribute("rowspan")).toBe("2");

    const doEscritorio = celulas.filter((td) => td.textContent?.trim() === "ESCRITÓRIO");
    expect(doEscritorio).toHaveLength(1);
    expect(doEscritorio[0].getAttribute("rowspan")).toBe("1");
  });
});

/**
 * A cor do mapa de riscos na coluna Agente.
 *
 * A regra de cores tem teste próprio; o que falta provar aqui é que a célula
 * da tabela realmente recebe a cor — e que ela acompanha a mesclagem, saindo
 * uma vez por bloco de agente e não uma por linha.
 */
describe("InventarioTab — cor do agente", () => {
  const corDaCelula = (texto: string) => {
    const td = [...document.querySelectorAll("tbody td")]
      .find((c) => c.textContent?.trim() === texto) as HTMLElement | undefined;
    return td?.style.backgroundColor;
  };

  it("pinta cada agente com a cor da convenção", async () => {
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [
        item({ id: "a", setor: "PCP", ghe_id: "g01", grupo: "fisico",
          perigo_descricao: "Ruído", ghe: { id: "g01", codigo: "01", nome: "01" } }),
        item({ id: "b", setor: "PCP", ghe_id: "g01", grupo: "quimico",
          perigo_descricao: "Poeira", ghe: { id: "g01", codigo: "01", nome: "01" } }),
        item({ id: "c", setor: "PCP", ghe_id: "g01", grupo: "ergonomico",
          perigo_descricao: "Postura", ghe: { id: "g01", codigo: "01", nome: "01" } }),
      ],
    };
    montar();
    await waitFor(() => expect(document.querySelectorAll("tbody tr").length).toBe(3));

    expect(corDaCelula("Físico")).toBe("rgb(22, 163, 74)");      // verde
    expect(corDaCelula("Químico")).toBe("rgb(220, 38, 38)");     // vermelho
    expect(corDaCelula("Ergonômico")).toBe("rgb(250, 204, 21)"); // amarelo
  });

  it("a cor sai uma vez por bloco, acompanhando a mesclagem", async () => {
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [
        item({ id: "a", setor: "PCP", ghe_id: "g01", grupo: "fisico",
          perigo_descricao: "Calor", ghe: { id: "g01", codigo: "01", nome: "01" } }),
        item({ id: "b", setor: "PCP", ghe_id: "g01", grupo: "fisico",
          perigo_descricao: "Ruído", ghe: { id: "g01", codigo: "01", nome: "01" } }),
      ],
    };
    montar();
    await waitFor(() => expect(document.querySelectorAll("tbody tr").length).toBe(2));

    const celulas = [...document.querySelectorAll("tbody td")]
      .filter((c) => c.textContent?.trim() === "Físico");
    expect(celulas).toHaveLength(1);
    expect(celulas[0].getAttribute("rowspan")).toBe("2");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InventarioTab from "./InventarioTab";

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

  it("importa em lote gravando nas colunas que existem, já com o grupo e o contexto", async () => {
    tabelas = {
      ...estruturaPcp,
      sst_setores: [{ id: "s-pcp", nome: "PCP", ambiente_id: "a-1" }],
      sst_ambientes: [{ id: "a-1", nome: "Escritório PCP" }],
      sst_processos: [{ id: "p-1", setor_id: "s-pcp", nome: "Planejamento" }],
      pgr_inventario_itens: [],
      pgr_levantamento_preliminar: [{
        id: "l1", pgr_id: "pgr-1", grupo: "ergonomico", perigo_descricao: "Sobrecarga",
        fonte_circunstancia: "Pressão por metas", possiveis_lesoes: "Estresse",
        trabalhadores_expostos: "Ajudante de Confecção", medidas_existentes: "Pausas; Rodízio",
        setor_id: "s-pcp", ges_id: null,
      }],
    };
    montar();

    fireEvent.click(await screen.findByRole("button", { name: /Importar todos automaticamente/ }));
    await waitFor(() => expect(inserts).toHaveLength(1));

    const linha = inserts[0].linhas[0];
    // O defeito era gravar os nomes dos campos do formulário: a tabela tem
    // funcoes_snapshot (text[]) e controles_existentes (text[]), e o insert
    // inteiro era recusado por coluna inexistente.
    expect(linha).not.toHaveProperty("funcoes_text");
    expect(linha).not.toHaveProperty("controles_text");
    expect(linha.funcoes_snapshot).toEqual(["Ajudante de Confecção"]);
    expect(linha.controles_existentes).toEqual(["Pausas", "Rodízio"]);
    // E nasce ligada ao grupo, com o "onde" que vem dele — não órfã.
    expect(linha.ghe_id).toBe("g01");
    expect(linha.ges_id).toBe("g01");
    expect(linha.setor).toBe("PCP");
    expect(linha.descricao_ambiente).toContain("Escritório PCP");
    expect(linha.processo).toContain("Planejamento");
  });

  it("fecha a pendência do levantamento ao importar, para o aviso não voltar", async () => {
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [],
      pgr_levantamento_preliminar: [{
        id: "l1", pgr_id: "pgr-1", grupo: "ergonomico", perigo_descricao: "Sobrecarga",
        setor_id: "s-pcp", tratamento: "avaliacao_aprofundada", inventario_item_id: null,
      }],
    };
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /Importar todos automaticamente/ }));

    // O update grava inventario_item_id no levantamento com o id devolvido
    // pelo insert — é o que a etapa 5 lê como "No inventário".
    await waitFor(() => expect(
      updates.filter((u) => u.tabela === "pgr_levantamento_preliminar"),
    ).toHaveLength(1));
  });

  it("não cobra perigo tratado na hora nem descartado com justificativa", async () => {
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [],
      pgr_levantamento_preliminar: [
        { id: "l1", perigo_descricao: "Piso molhado", tratamento: "tratado_diretamente" },
        { id: "l2", perigo_descricao: "Radiação ionizante", tratamento: "nao_identificado",
          justificativa: "Não há fonte radioativa na operação." },
        { id: "l3", perigo_descricao: "Ruído de prensa", tratamento: "avaliacao_aprofundada" },
      ],
    };
    montar();

    // Só o terceiro é pendência de verdade.
    expect(await screen.findByTitle("Ruído de prensa")).toBeInTheDocument();
    expect(screen.queryByTitle("Piso molhado")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Radiação ionizante")).not.toBeInTheDocument();
  });

  it("não cobra perigo já trazido cuja descrição foi detalhada no item", async () => {
    tabelas = {
      ...estruturaPcp,
      pgr_inventario_itens: [item({
        ghe_id: "g01",
        perigo_descricao: "Pressão por metas, prazos curtos, sobrecarga",
      })],
      pgr_levantamento_preliminar: [
        { id: "l1", perigo_descricao: "Sobrecarga", tratamento: "avaliacao_aprofundada" },
      ],
    };
    montar();

    await screen.findByText("Pressão por metas, prazos curtos, sobrecarga");
    expect(screen.queryByTitle("Sobrecarga")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Trazer" })).not.toBeInTheDocument();
  });

  it("continua cobrando quando o perigo curto só coincide por acaso", async () => {
    tabelas = {
      ...estruturaPcp,
      // "Gás" tem 3 letras e aparece dentro de "Gases de solda" por acaso —
      // curto demais para valer como "já está coberto".
      pgr_inventario_itens: [item({ ghe_id: "g01", perigo_descricao: "Gases de solda" })],
      pgr_levantamento_preliminar: [
        { id: "l1", perigo_descricao: "Gás", tratamento: "avaliacao_aprofundada" },
      ],
    };
    montar();

    expect(await screen.findByTitle("Gás")).toBeInTheDocument();
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

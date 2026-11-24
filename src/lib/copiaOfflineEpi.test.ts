import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

/*
 * A cópia automática só serve se gravar na MESMA gaveta que a tela lê.
 * Estes testes amarram as duas pontas.
 */
const linhas: any[] = [];
const chamadas: string[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    const q: any = {
      select: (c: string) => { chamadas.push(`${tabela}:select:${c}`); return q; },
      in: (_c: string, ids: string[]) => { chamadas.push(`${tabela}:in:${ids.join(",")}`); return q; },
      eq: () => q,
      order: () => q,
      then: (ok: any, erro: any) => Promise.resolve({ data: linhas, error: null }).then(ok, erro),
    };
    return q;
  };
  return { supabase: { from: consulta, auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } };
});

import { buscarTabelaEGuardar } from "@/hooks/useSupabaseData";
import { tabelasDaCopia, guardarCopiaOfflineEpi } from "./copiaOfflineEpi";
import { getCachedData, setCacheUserScope, setCacheEmpresaScope } from "./offlineStorage";
import { COLUNAS_DA_LISTA_DE_ENTREGAS } from "./entregasLeves";

describe("cópia automática da Gestão de EPIs", () => {
  beforeEach(() => {
    localStorage.clear(); linhas.length = 0; chamadas.length = 0;
    setCacheUserScope("u1"); setCacheEmpresaScope(["emp-1", "emp-0"]);
  });

  it("entregas vão para a gaveta que a tela de Entregas lê, só da empresa", async () => {
    linhas.push({ id: "a", empresa_id: "emp-1" }, { id: "b", empresa_id: "emp-9" });
    await buscarTabelaEGuardar(tabelasDaCopia(["emp-1", "emp-0"])[0]);
    expect(getCachedData<any>("entregas")!.map((l) => l.id)).toEqual(["a"]);
    expect(chamadas).toContain(`entregas:select:${COLUNAS_DA_LISTA_DE_ENTREGAS}`);
    expect(chamadas).toContain("entregas:in:emp-1,emp-0");
  });

  it("guarda entregas, colaboradores, EPIs e solicitações de uma vez", async () => {
    linhas.push({ id: "x", empresa_id: "emp-1" });
    await guardarCopiaOfflineEpi(["emp-1", "emp-0"], "emp-1");
    for (const gaveta of ["entregas", "funcionarios", "epis", "solicitacoes_materiais:emp-1"]) {
      expect(getCachedData<any>(gaveta), gaveta).toHaveLength(1);
    }
  });

  it("as consultas das telas continuam iguais às da cópia", () => {
    const entregas = readFileSync("src/pages/Entregas.tsx", "utf8");
    expect(entregas).toContain('useSupabaseCrud<Entrega>("entregas", "created_at", undefined, COLUNAS_DA_LISTA_DE_ENTREGAS)');
    expect(entregas).toContain('useSupabaseQuery<Funcionario>("funcionarios")');
    expect(entregas).toContain('useSupabaseQuery<EPI>("epis")');
    expect(readFileSync("src/pages/epis/SolicitacoesMateriais.tsx", "utf8")).toContain("buscarSolicitacoes(empresaId)");
  });
});

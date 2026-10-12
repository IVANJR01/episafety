import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  unirCadastro, REFERENCIAS, TABELAS_UNIVEIS, type TabelaUnivel,
} from "./unirCadastroEstrutura";

/* ------------------------------------------------------------------------ */
/* Um banco de mentira, que registra a ORDEM das operações.                   */
/* ------------------------------------------------------------------------ */

interface Operacao { tabela: string; acao: string; dados?: unknown }

function bancoFalso(opcoes: {
  linhas?: Record<string, any[]>;
  /** Tabelas que devolvem 23505 no update em lote. */
  colidem?: string[];
  /** Tabelas que não existem neste banco. */
  ausentes?: string[];
} = {}) {
  const linhas = opcoes.linhas || {};
  const colidem = new Set(opcoes.colidem || []);
  const ausentes = new Set(opcoes.ausentes || []);
  const ops: Operacao[] = [];
  let colisaoPendente = new Set(colidem);

  const db = {
    from(tabela: string) {
      const registrar = (acao: string, dados?: unknown) => ops.push({ tabela, acao, dados });
      const resultado = (data: any, error: any = null) => Promise.resolve({ data, error });
      return {
        select() {
          return {
            in(_coluna: string, _valores: string[]) {
              registrar("select");
              if (ausentes.has(tabela)) {
                return resultado(null, { code: "PGRST205", message: "Could not find the table" });
              }
              return resultado(linhas[tabela] || []);
            },
          };
        },
        upsert(dados: unknown) { registrar("upsert", dados); return resultado(dados); },
        update(dados: unknown) {
          return {
            in() {
              registrar("update-lote", dados);
              if (colisaoPendente.has(tabela)) {
                return resultado(null, { code: "23505", message: "duplicate key" });
              }
              return resultado(null);
            },
            eq(_coluna: string, valor: string) {
              registrar("update-linha", { dados, valor });
              /* A primeira linha colide; as outras passam. */
              if (colisaoPendente.has(tabela)) {
                colisaoPendente.delete(tabela);
                return resultado(null, { code: "23505", message: "duplicate key" });
              }
              return resultado(null);
            },
          };
        },
        delete() {
          return {
            in() { registrar("delete-lote"); return resultado(null); },
            eq(_c: string, valor: string) { registrar("delete-linha", valor); return resultado(null); },
          };
        },
      };
    },
  };
  return { db, ops };
}

const SETORES = {
  sst_setores: [
    { id: "fica", empresa_id: "e1", nome: "CORTE", descricao: null, responsavel_setor: "" },
    { id: "sai", empresa_id: "e1", nome: "CORTE", descricao: "Sala de corte", responsavel_setor: "João" },
  ],
};

describe("a ordem da união", () => {
  it("copia, completa, move os vínculos e só então apaga", async () => {
    const { db, ops } = bancoFalso({ linhas: { ...SETORES, ghe_setores: [{ id: "v1" }] } });
    await unirCadastro(db, { tabela: "sst_setores", manter: "fica", remover: ["sai"] });

    const passos = ops.map((o) => `${o.acao} ${o.tabela}`);
    const copia = passos.indexOf("upsert sst_cadastros_unificados_backup");
    const moveu = passos.indexOf("update-lote ghe_setores");
    const apagou = passos.indexOf("delete-lote sst_setores");

    expect(copia, "não guardou a cópia de segurança").toBeGreaterThanOrEqual(0);
    expect(moveu, "não moveu os vínculos").toBeGreaterThan(copia);
    expect(apagou, "apagou antes de mover os vínculos — o CASCADE levaria tudo")
      .toBeGreaterThan(moveu);
  });

  it("completa no que fica os campos que só o removido tinha", async () => {
    const { db, ops } = bancoFalso({ linhas: SETORES });
    const r = await unirCadastro(db, { tabela: "sst_setores", manter: "fica", remover: ["sai"] });

    expect(r.camposPreenchidos.sort()).toEqual(["descricao", "responsavel_setor"]);
    const completou = ops.find((o) => o.acao === "update-linha" && o.tabela === "sst_setores");
    expect((completou?.dados as any).dados).toEqual({
      descricao: "Sala de corte", responsavel_setor: "João",
    });
  });

  it("não sobrescreve o que o cadastro que fica já tinha", async () => {
    const { db } = bancoFalso({
      linhas: {
        sst_setores: [
          { id: "fica", empresa_id: "e1", nome: "CORTE", descricao: "Texto bom" },
          { id: "sai", empresa_id: "e1", nome: "CORTE", descricao: "Texto velho" },
        ],
      },
    });
    const r = await unirCadastro(db, { tabela: "sst_setores", manter: "fica", remover: ["sai"] });
    expect(r.camposPreenchidos).toEqual([]);
  });
});

describe("vínculo repetido", () => {
  it("o que já existe no cadastro que fica é descartado, e os outros passam", async () => {
    const { db, ops } = bancoFalso({
      linhas: { ...SETORES, ghe_setores: [{ id: "v1" }, { id: "v2" }] },
      colidem: ["ghe_setores"],
    });
    const r = await unirCadastro(db, { tabela: "sst_setores", manter: "fica", remover: ["sai"] });

    expect(r.vinculosDuplicadosDescartados).toBe(1);
    expect(r.vinculosMovidos).toBe(1);
    expect(ops.some((o) => o.acao === "delete-linha" && o.tabela === "ghe_setores")).toBe(true);
  });
});

describe("o que a união recusa", () => {
  it("cadastros de empresas diferentes", async () => {
    const { db } = bancoFalso({
      linhas: {
        sst_setores: [
          { id: "fica", empresa_id: "e1", nome: "CORTE" },
          { id: "sai", empresa_id: "OUTRA", nome: "CORTE" },
        ],
      },
    });
    await expect(unirCadastro(db, { tabela: "sst_setores", manter: "fica", remover: ["sai"] }))
      .rejects.toThrow(/empresas diferentes/i);
  });

  it("tabela que não está na lista", async () => {
    const { db } = bancoFalso();
    await expect(unirCadastro(db, {
      tabela: "funcionarios" as TabelaUnivel, manter: "a", remover: ["b"],
    })).rejects.toThrow(/não se une por aqui/i);
  });

  it("o cadastro que ficaria já não existe", async () => {
    const { db } = bancoFalso({ linhas: { sst_setores: [{ id: "sai", empresa_id: "e1" }] } });
    await expect(unirCadastro(db, { tabela: "sst_setores", manter: "fica", remover: ["sai"] }))
      .rejects.toThrow(/não existe mais/i);
  });

  it("não apaga nada se a cópia de segurança falhar", async () => {
    const ops: Operacao[] = [];
    const db = {
      from(tabela: string) {
        return {
          select: () => ({ in: () => Promise.resolve({ data: SETORES.sst_setores, error: null }) }),
          upsert: () => Promise.resolve({ data: null, error: { message: "sem permissão" } }),
          update: () => ({
            in: () => { ops.push({ tabela, acao: "update" }); return Promise.resolve({ error: null }); },
            eq: () => { ops.push({ tabela, acao: "update" }); return Promise.resolve({ error: null }); },
          }),
          delete: () => ({
            in: () => { ops.push({ tabela, acao: "delete" }); return Promise.resolve({ error: null }); },
            eq: () => { ops.push({ tabela, acao: "delete" }); return Promise.resolve({ error: null }); },
          }),
        };
      },
    };
    await expect(unirCadastro(db, { tabela: "sst_setores", manter: "fica", remover: ["sai"] }))
      .rejects.toThrow(/cópia de segurança/i);
    expect(ops, "mexeu no cadastro mesmo sem ter guardado a cópia").toEqual([]);
  });
});

describe("tabela ainda não implantada", () => {
  it("é pulada, em vez de impedir a união", async () => {
    const { db } = bancoFalso({
      linhas: SETORES,
      ausentes: ["sst_coletas_campo", "sst_trabalhadores_historico", "pgr_levantamento_preliminar"],
    });
    const r = await unirCadastro(db, { tabela: "sst_setores", manter: "fica", remover: ["sai"] });
    expect(r.removidos).toBe(1);
  });
});

/* ------------------------------------------------------------------------ */
/* A lista de vínculos contra as migrations.                                  */
/* ------------------------------------------------------------------------ */

/**
 * Lê nas migrations quem aponta para os cadastros de estrutura.
 *
 * É a conferência que impede o pior defeito possível aqui: uma tabela nova
 * apontando para um setor, não entrar na lista de REFERENCIAS, e o vínculo
 * dela morrer calado no CASCADE quando o cadastro repetido for apagado.
 */
function referenciasNasMigrations(): Record<string, Set<string>> {
  const dir = join(process.cwd(), "supabase", "migrations");
  const achado: Record<string, Set<string>> = {};
  for (const alvo of TABELAS_UNIVEIS) achado[alvo] = new Set();

  for (const arquivo of readdirSync(dir).filter((a) => a.endsWith(".sql"))) {
    const sql = readFileSync(join(dir, arquivo), "utf-8");

    for (const bloco of sql.matchAll(
      /CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi,
    )) {
      const [, tabela, corpo] = bloco;
      for (const col of corpo.matchAll(
        /^\s*(\w+)\s+[^,\n]*REFERENCES\s+public\.(\w+)\s*\(id\)/gim,
      )) {
        if (achado[col[2]]) achado[col[2]].add(`${tabela}.${col[1]}`);
      }
    }

    for (const bloco of sql.matchAll(
      /ALTER TABLE\s+(?:IF EXISTS\s+)?(?:public\.)?(\w+)([\s\S]*?);/gi,
    )) {
      const [, tabela, corpo] = bloco;
      for (const col of corpo.matchAll(
        /ADD COLUMN(?: IF NOT EXISTS)?\s+(\w+)\s+[^,;]*?REFERENCES\s+public\.(\w+)\s*\(id\)/gi,
      )) {
        if (achado[col[2]]) achado[col[2]].add(`${tabela}.${col[1]}`);
      }
    }
  }
  return achado;
}

describe("a lista de quem aponta para cada cadastro", () => {
  const nasMigrations = referenciasNasMigrations();

  it("a leitura das migrations encontra alguma coisa", () => {
    /* Se o extrator quebrar, as comparações abaixo passariam vazias. */
    for (const alvo of TABELAS_UNIVEIS) {
      expect(nasMigrations[alvo].size, `nada encontrado para ${alvo}`).toBeGreaterThan(4);
    }
  });

  for (const alvo of TABELAS_UNIVEIS) {
    it(`cobre tudo que aponta para ${alvo}`, () => {
      const naLista = new Set(
        REFERENCIAS[alvo as TabelaUnivel].map((r) => `${r.tabela}.${r.coluna}`),
      );
      const faltando = [...nasMigrations[alvo]].filter((r) => !naLista.has(r));
      expect(
        faltando,
        `estas tabelas apontam para ${alvo} e ficariam para trás numa união`,
      ).toEqual([]);
    });

    it(`não inventa vínculo em ${alvo}`, () => {
      const sobrando = REFERENCIAS[alvo as TabelaUnivel]
        .map((r) => `${r.tabela}.${r.coluna}`)
        .filter((r) => !nasMigrations[alvo].has(r));
      expect(sobrando, "vínculo que não existe em migration nenhuma").toEqual([]);
    });
  }
});

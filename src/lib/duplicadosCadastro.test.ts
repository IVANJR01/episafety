import { describe, expect, it } from "vitest";
import {
  agruparIguais, agruparParecidos, duplicadosDoCadastro, chaveDoNome,
  semelhanca, sugerirPrincipal, camposPreenchidos, CORTE_PARECIDO,
} from "./duplicadosCadastro";

let proximoId = 0;
const item = (nome: string, extra: Record<string, unknown> = {}) => ({
  /* Id único por chamada: dois cadastros com o MESMO nome são o caso todo. */
  id: `id-${++proximoId}`, nome, ...extra,
});

/*
 * Os nomes de GES de uma empresa real. É contra esta lista que o corte do
 * "parecido" foi calibrado: ela tem os erros de digitação que precisam
 * aparecer e os setores diferentes que não podem ser confundidos.
 */
const NOMES_REAIS = [
  "PCP", "ALMOXARIDADO", "ATELIER", "CORMECIAL", "CORTE", "COSTURA", "COZINHA",
  "EMBALAGEM / EXPEDIÇÃO", "ESCRITÓRIO", "LIMPEZA", "LOJA", "SEPARAÇÃO",
  "ZELADORIA", "MANUTENÇÃO",
];

describe("nomes iguais", () => {
  it("junta o mesmo nome escrito de formas diferentes", () => {
    const g = agruparIguais([
      item("ESCRITORIO"), item("ESCRITÓRIO"), item("Loja"), item("LOJA "),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].itens).toHaveLength(2);
  });

  it("junta a entrada marcada como cópia", () => {
    const g = agruparIguais([item("SEPARAÇÃO"), item("SEPARAÇÃO (Cópia)")]);
    expect(g).toHaveLength(1);
    expect(g[0].itens).toHaveLength(2);
  });

  it("não junta setores diferentes", () => {
    expect(agruparIguais(NOMES_REAIS.map((n) => item(n)))).toHaveLength(0);
  });

  it("cadastro sem nome fica de fora, em vez de virar um grupo", () => {
    const g = agruparIguais([
      { id: "a", nome: "" }, { id: "b", nome: null }, { id: "c", nome: "   " },
    ]);
    expect(g).toHaveLength(0);
  });
});

describe("nomes parecidos", () => {
  it("mostra os dois erros de digitação do almoxarifado", () => {
    const g = agruparParecidos([item("ALMOXARIDADO"), item("ALMOXARIFADDO")]);
    expect(g).toHaveLength(1);
    expect(g[0].itens.map((i) => i.nome)).toEqual(["ALMOXARIDADO", "ALMOXARIFADDO"]);
  });

  it("NÃO confunde COSTURA com COZINHA nem com CORTE", () => {
    /* O erro que destruiria o cadastro: unir dois setores de verdade. */
    expect(semelhanca("costura", "cozinha")).toBeLessThan(CORTE_PARECIDO);
    expect(semelhanca("costura", "corte")).toBeLessThan(CORTE_PARECIDO);
    expect(agruparParecidos(NOMES_REAIS.map((n) => item(n)))).toHaveLength(0);
  });

  it("não sugere nada para nomes curtos", () => {
    /* Com quatro letras, uma letra de diferença já daria 0,75. */
    expect(agruparParecidos([item("LOJA"), item("SOJA")])).toHaveLength(0);
  });

  it("três nomes parecidos entre si viram um grupo só", () => {
    const g = agruparParecidos([
      item("ALMOXARIFADO"), item("ALMOXARIDADO"), item("ALMOXARIFADDO"),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].itens).toHaveLength(3);
  });

  it("o mesmo cadastro nunca aparece em dois grupos", () => {
    const itens = [
      item("CORTE"), item("CORTE"), item("ALMOXARIDADO"), item("ALMOXARIFADDO"),
    ];
    const todos = duplicadosDoCadastro(itens);
    const ids = todos.flatMap((g) => g.itens.map((i) => i.id));
    expect(new Set(ids).size, "um cadastro caiu em dois grupos").toBe(ids.length);
    expect(todos.map((g) => g.tipo)).toEqual(["iguais", "parecidos"]);
  });
});

describe("qual manter", () => {
  it("sugere o cadastro mais completo", () => {
    const magro = item("CORTE", { created_at: "2026-01-01" });
    const cheio = item("CORTE", {
      created_at: "2026-06-01", descricao: "Sala de corte", piso: "Cerâmico",
      ventilacao: "Natural",
    });
    expect(sugerirPrincipal([magro, cheio])).toBe(cheio);
  });

  it("empatando, fica o mais antigo — é o que os outros cadastros já apontam", () => {
    const velho = item("CORTE", { created_at: "2026-01-01", descricao: "x" });
    const novo = item("CORTE", { created_at: "2026-09-01", descricao: "y" });
    expect(sugerirPrincipal([velho, novo])).toBe(velho);
  });

  it("campo do sistema não conta como preenchimento", () => {
    const so_sistema = { id: "a", empresa_id: "e", created_at: "x", updated_at: "y" };
    expect(camposPreenchidos(so_sistema)).toBe(0);
  });
});

describe("chave do nome", () => {
  it("tira acento, caixa, pontuação e o sufixo de cópia", () => {
    expect(chaveDoNome("SEPARAÇÃO (Cópia 2)")).toBe("separacao");
    expect(chaveDoNome("Embalagem / Expedição")).toBe("embalagem expedicao");
  });
});

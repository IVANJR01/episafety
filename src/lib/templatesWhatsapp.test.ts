import { describe, it, expect } from "vitest";
import {
  cabecalhoDeTexto,
  camposDoTemplate,
  corpoDoTemplate,
  ehNomeado,
  marcadores,
  parametrosParaEnvio,
  preencher,
  previaDoTemplate,
  rotuloDoCampo,
  templateCompleto,
  type TemplateWhatsapp,
} from "./templatesWhatsapp";

/*
 * O que se protege aqui: um template preenchido errado não vira mensagem
 * torta — vira mensagem recusada pela Meta, fora da janela de 24h, que é
 * justamente quando não há segunda chance de falar com o cliente.
 */

const numerado: TemplateWhatsapp = {
  nome: "aviso_vencimento",
  idioma: "pt_BR",
  categoria: "UTILITY",
  componentes: [
    { tipo: "HEADER", formato: "TEXT", texto: "Olá, {{1}}" },
    { tipo: "BODY", texto: "O treinamento {{1}} vence em {{2}}. Quer renovar?" },
    { tipo: "FOOTER", texto: "Safety Soluções" },
  ],
};

const nomeado: TemplateWhatsapp = {
  nome: "retomada",
  idioma: "pt_BR",
  categoria: "MARKETING",
  componentes: [{ tipo: "BODY", texto: "Oi {{nome}}, falamos sobre o {{servico}} semana passada." }],
};

const comImagem: TemplateWhatsapp = {
  nome: "catalogo",
  idioma: "pt_BR",
  categoria: "MARKETING",
  componentes: [
    { tipo: "HEADER", formato: "IMAGE" },
    { tipo: "BODY", texto: "Segue o catálogo." },
  ],
};

describe("leitura do template", () => {
  it("separa cabeçalho, corpo e rodapé", () => {
    expect(cabecalhoDeTexto(numerado)).toBe("Olá, {{1}}");
    expect(corpoDoTemplate(numerado)).toBe("O treinamento {{1}} vence em {{2}}. Quer renovar?");
  });

  it("ignora cabeçalho que não é texto", () => {
    // O parâmetro dele seria um arquivo; oferecer campo de texto aqui geraria
    // um envio recusado.
    expect(cabecalhoDeTexto(comImagem)).toBeNull();
    expect(camposDoTemplate(comImagem)).toEqual({ cabecalho: [], corpo: [] });
  });

  it("lista os marcadores na ordem e sem repetir", () => {
    expect(marcadores("{{1}} e {{2}}, de novo {{1}}")).toEqual(["1", "2"]);
    expect(marcadores("{{ nome }} com espaço")).toEqual(["nome"]);
    expect(marcadores("sem marcador nenhum")).toEqual([]);
    expect(marcadores(null)).toEqual([]);
  });

  it("distingue marcador nomeado de numerado", () => {
    expect(ehNomeado("1")).toBe(false);
    expect(ehNomeado("nome")).toBe(true);
  });

  it("o cabeçalho tem numeração própria, separada do corpo", () => {
    // O {{1}} do cabeçalho não é o {{1}} do corpo — misturar os dois manda o
    // nome da pessoa no lugar do nome do treinamento.
    expect(camposDoTemplate(numerado)).toEqual({ cabecalho: ["1"], corpo: ["1", "2"] });
  });
});

describe("preenchimento", () => {
  it("troca os marcadores pelos valores", () => {
    expect(preencher("Oi {{nome}}, tudo bem?", { nome: "Maria" })).toBe("Oi Maria, tudo bem?");
  });

  it("mantém o marcador à vista quando o valor ainda não foi digitado", () => {
    // Apagar deixaria a frase sem sentido e sem explicação.
    expect(preencher("Oi {{nome}}!", {})).toBe("Oi {{nome}}!");
    expect(preencher("Oi {{nome}}!", { nome: "   " })).toBe("Oi {{nome}}!");
  });

  it("só libera o envio com todos os campos preenchidos", () => {
    expect(templateCompleto(nomeado, { cabecalho: {}, corpo: { nome: "Ana" } })).toBe(false);
    expect(templateCompleto(nomeado, { cabecalho: {}, corpo: { nome: "Ana", servico: "PGR" } })).toBe(true);
  });

  it("cobra o campo do cabeçalho também", () => {
    const soCorpo = { cabecalho: {}, corpo: { "1": "NR-35", "2": "12/10/2026" } };
    expect(templateCompleto(numerado, soCorpo)).toBe(false);
    expect(templateCompleto(numerado, { ...soCorpo, cabecalho: { "1": "Maria" } })).toBe(true);
  });
});

describe("parâmetros do envio", () => {
  it("numerado vai na ordem, sem nome", () => {
    expect(parametrosParaEnvio(["1", "2"], { "1": "NR-35", "2": "12/10/2026" })).toEqual([
      { valor: "NR-35" },
      { valor: "12/10/2026" },
    ]);
  });

  it("nomeado leva o nome junto, que é o que a Meta exige", () => {
    expect(parametrosParaEnvio(["nome", "servico"], { nome: "Ana", servico: "PGR" })).toEqual([
      { valor: "Ana", nome: "nome" },
      { valor: "PGR", nome: "servico" },
    ]);
  });
});

describe("prévia", () => {
  it("junta cabeçalho e corpo como o cliente vai ler", () => {
    // O {{1}} do cabeçalho recebe "Maria" e o do corpo recebe "NR-35": é o
    // caso que um mapa único de valores mandaria errado, sem erro nenhum.
    const texto = previaDoTemplate(numerado, {
      cabecalho: { "1": "Maria" },
      corpo: { "1": "NR-35", "2": "12/10/2026" },
    });
    expect(texto).toBe("Olá, Maria\n\nO treinamento NR-35 vence em 12/10/2026. Quer renovar?");
  });

  it("dá rótulo legível para o campo", () => {
    expect(rotuloDoCampo("1")).toBe("Campo 1");
    expect(rotuloDoCampo("nome_cliente")).toBe("nome cliente");
  });
});

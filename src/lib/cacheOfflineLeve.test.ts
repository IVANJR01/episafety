import { describe, it, expect } from "vitest";
import { linhaParaCache, linhasParaCache, imagemSoNoServidor, MARCA_IMAGEM_NO_SERVIDOR } from "./cacheOfflineLeve";

/* Uma assinatura de verdade tem ~40 KB; aqui, o suficiente para pesar. */
const ASSINATURA = "data:image/png;base64," + "A".repeat(40_000);
const FOTO = "data:image/jpeg;base64," + "B".repeat(60_000);

describe("a cópia offline não leva a imagem", () => {
  it("troca a assinatura desenhada pela marca", () => {
    const linha = linhaParaCache({ id: "e1", assinatura_colaborador: ASSINATURA });
    expect(linha.assinatura_colaborador).toBe(MARCA_IMAGEM_NO_SERVIDOR);
  });

  it("troca a foto do reconhecimento facial", () => {
    const linha = linhaParaCache({ id: "e1", assinatura_colaborador: "RECONHECIMENTO_FACIAL", foto_reconhecimento: FOTO });
    expect(linha.foto_reconhecimento).toBe(MARCA_IMAGEM_NO_SERVIDOR);
  });

  it("a entrega continua ASSINADA para a tela: a marca não é vazia", () => {
    /* A lista decide "Assinado" pela presença do valor. Vazio faria a
       entrega parecer pendente e pedir assinatura de novo offline. */
    const linha = linhaParaCache({ id: "e1", assinatura_colaborador: ASSINATURA });
    expect(!!linha.assinatura_colaborador).toBe(true);
  });

  it("o tipo de assinatura (facial, biometria) é preservado", () => {
    const linha = linhaParaCache({ assinatura_colaborador: "RECONHECIMENTO_FACIAL" });
    expect(linha.assinatura_colaborador).toBe("RECONHECIMENTO_FACIAL");
  });

  it("a assinatura de participante de DDS também sai", () => {
    expect(linhaParaCache({ assinatura: ASSINATURA }).assinatura).toBe(MARCA_IMAGEM_NO_SERVIDOR);
  });

  it("o logo da empresa fica: ele vai nos PDFs gerados offline", () => {
    const logo = "data:image/png;base64," + "C".repeat(20_000);
    expect(linhaParaCache({ logo_url: logo }).logo_url).toBe(logo);
  });

  it("link para o arquivo (não imagem embutida) fica como está", () => {
    const linha = linhaParaCache({ foto_reconhecimento: "https://exemplo/foto.jpg" });
    expect(linha.foto_reconhecimento).toBe("https://exemplo/foto.jpg");
  });

  it("o resto da linha não muda, e a original não é alterada", () => {
    const original = { id: "e1", quantidade: 2, codigo_verificacao: "abc", assinatura_colaborador: ASSINATURA };
    const leve = linhaParaCache(original);
    expect(leve).toMatchObject({ id: "e1", quantidade: 2, codigo_verificacao: "abc" });
    expect(original.assinatura_colaborador).toBe(ASSINATURA);
  });
});

describe("o tamanho que importa", () => {
  it("109 entregas assinadas cabem com folga, em vez de ocupar o limite inteiro", () => {
    /* O caso medido no banco: 109 entregas, 4,61 MB, 93% do limite. */
    const entregas = Array.from({ length: 109 }, (_, i) => ({
      id: `entrega-${i}`, funcionario_id: "f", epi_id: "e", quantidade: 1, data: "2026-11-09",
      tipo: "entrega", status: "ativo", codigo_verificacao: "0".repeat(40), assinatura_colaborador: ASSINATURA,
    }));
    const antes = JSON.stringify(entregas).length;
    const depois = JSON.stringify(linhasParaCache(entregas)).length;
    const LIMITE = 5_222_400; // medido no Chromium
    expect(antes / LIMITE).toBeGreaterThan(0.8);
    expect(depois / LIMITE, `a cópia ainda ocupa ${(100 * depois / LIMITE).toFixed(1)}% do limite`).toBeLessThan(0.01);
  });
});

describe("reconhecer a marca", () => {
  it("só a marca é imagem no servidor", () => {
    expect(imagemSoNoServidor(MARCA_IMAGEM_NO_SERVIDOR)).toBe(true);
    expect(imagemSoNoServidor(ASSINATURA)).toBe(false);
    expect(imagemSoNoServidor(null)).toBe(false);
  });
});

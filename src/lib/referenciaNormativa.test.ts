import { describe, expect, it } from "vitest";
import {
  referenciasNormativas, rotuloCurto, temDescricao,
} from "./referenciaNormativa";

/**
 * A referência normativa dos apontamentos.
 *
 * A IA escreve linhas inteiras no campo, e três delas ocupavam mais
 * espaço no cartão do que a situação detectada e a ação corretiva — que
 * é o que a pessoa precisa ler.
 */

const TEXTO = [
  "NR-18 — Item 18.6.10 — Quadros de distribuição devem possuir partes vivas inacessíveis e protegidas.",
  "IT-16/CE — Item 5.1.1 — Plano de emergência contra incêndio e pânico.",
].join("\n");

describe("quebrar o texto em peças", () => {
  it("uma referência por linha", () => {
    expect(referenciasNormativas(TEXTO).length).toBe(2);
  });

  it("separa norma, item e descrição", () => {
    const [primeira] = referenciasNormativas(TEXTO);
    expect(primeira.norma).toBe("NR-18");
    expect(primeira.item).toBe("18.6.10");
    expect(primeira.descricao).toContain("partes vivas inacessíveis");
  });

  it("a palavra 'Item' não vai para a etiqueta", () => {
    /* O número já diz o que é; repetir "Item" em cada etiqueta não soma. */
    expect(rotuloCurto(referenciasNormativas(TEXTO)[0])).toBe("NR-18 18.6.10");
  });

  it("norma sem item mostra só a norma", () => {
    const [r] = referenciasNormativas("NBR 5410 — Normatiza instalações de baixa tensão.");
    expect(r.norma).toBe("NBR 5410");
    expect(r.item).toBe("");
    expect(rotuloCurto(r)).toBe("NBR 5410");
    expect(r.descricao).toContain("baixa tensão");
  });

  it("o 'Item a confirmar' da IA não vira número inventado", () => {
    /* Aparece assim nos apontamentos: não é item nenhum. */
    const [r] = referenciasNormativas(
      "NBR 5410 — Item a confirmar pelo responsável técnico — Normatiza instalações.",
    );
    expect(r.item).toBe("a confirmar pelo responsável técnico");
    expect(r.descricao).toContain("Normatiza");
  });

  it("linha fora do formato não some: vira a própria norma", () => {
    /* Em documento de fiscalização, texto que some é pior que texto feio. */
    const [r] = referenciasNormativas("Verificar com o engenheiro");
    expect(r.norma).toBe("Verificar com o engenheiro");
    expect(rotuloCurto(r)).toBe("Verificar com o engenheiro");
  });

  it("guarda a linha inteira, que é o que vai para o PDF", () => {
    const [r] = referenciasNormativas(TEXTO);
    expect(r.textoCompleto).toBe(TEXTO.split("\n")[0]);
  });

  it("campo vazio não vira etiqueta nenhuma", () => {
    expect(referenciasNormativas("")).toEqual([]);
    expect(referenciasNormativas(null)).toEqual([]);
    expect(referenciasNormativas("\n\n   \n")).toEqual([]);
  });

  it("hífen comum também separa", () => {
    /* Nem todo texto vem com o travessão da IA. */
    const [r] = referenciasNormativas("NR-10 - Item 10.3.8.2 - Instalações elétricas seguras.");
    expect(r.norma).toBe("NR-10");
    expect(r.item).toBe("10.3.8.2");
  });

  it("não quebra no hífen de dentro do código da norma", () => {
    /* "NR-18" tem hífen; quebrar ali deixaria a norma como "NR". */
    expect(referenciasNormativas("NR-18 — Item 18.6.10 — Quadros.")[0].norma).toBe("NR-18");
  });
});

describe("saber se há o que abrir", () => {
  it("há descrição quando alguma linha traz a frase", () => {
    expect(temDescricao(referenciasNormativas(TEXTO))).toBe(true);
  });

  it("só códigos: nada a abrir", () => {
    expect(temDescricao(referenciasNormativas("NR-18 — Item 18.6.10"))).toBe(false);
    expect(temDescricao([])).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  textoParaCodigo, calcularCodigoDeAssinatura, calcularCodigosDaFicha,
  dataHoraComSegundos, TAMANHO_DO_CODIGO,
} from "./codigoAssinatura";

const entrega = (over: Partial<Parameters<typeof calcularCodigoDeAssinatura>[0]> = {}) => ({
  id: "e1", created_at: "2026-05-26T09:33:48.000Z",
  assinatura_colaborador: "data:image/png;base64,AAA", ...over,
});

describe("calcularCodigoDeAssinatura", () => {
  it("dá sempre o mesmo código para a mesma entrega — senão não dá para conferir depois", async () => {
    const a = await calcularCodigoDeAssinatura(entrega());
    const b = await calcularCodigoDeAssinatura(entrega());
    expect(a).toBe(b);
    expect(a).toHaveLength(TAMANHO_DO_CODIGO);
    expect(a).toMatch(/^[0-9a-f]+$/);
  });

  it("muda quando a assinatura muda — é o que torna a troca visível", async () => {
    const original = await calcularCodigoDeAssinatura(entrega());
    const trocada = await calcularCodigoDeAssinatura(entrega({ assinatura_colaborador: "data:image/png;base64,BBB" }));
    expect(trocada).not.toBe(original);
  });

  it("entregas diferentes têm códigos diferentes, mesmo com a MESMA assinatura", async () => {
    /* Duas entregas no mesmo dia, assinadas igual pela mesma pessoa: sem o id
       na conta, as duas linhas sairiam com o mesmo código e o código deixaria
       de identificar qual é qual. */
    const a = await calcularCodigoDeAssinatura(entrega({ id: "e1" }));
    const b = await calcularCodigoDeAssinatura(entrega({ id: "e2" }));
    expect(a).not.toBe(b);
  });

  it("muda quando o instante da coleta muda", async () => {
    const a = await calcularCodigoDeAssinatura(entrega());
    const b = await calcularCodigoDeAssinatura(entrega({ created_at: "2026-05-26T09:33:49.000Z" }));
    expect(a).not.toBe(b);
  });

  it("entrega sem assinatura não ganha código — seria sugerir assinatura que não existe", async () => {
    expect(await calcularCodigoDeAssinatura(entrega({ assinatura_colaborador: null }))).toBeNull();
    expect(await calcularCodigoDeAssinatura(entrega({ assinatura_colaborador: "" }))).toBeNull();
  });

  it("a ficha inteira sai na mesma ordem das entregas", async () => {
    const codigos = await calcularCodigosDaFicha([
      entrega({ id: "a" }), entrega({ id: "b", assinatura_colaborador: null }), entrega({ id: "c" }),
    ]);
    expect(codigos).toHaveLength(3);
    expect(codigos[1]).toBeNull();
    expect(codigos[0]).not.toBe(codigos[2]);
  });
});

describe("textoParaCodigo", () => {
  it("junta id, instante e assinatura — os três precisam entrar na conta", () => {
    expect(textoParaCodigo({ id: "e1", created_at: "X", assinatura_colaborador: "S" })).toBe("e1|X|S");
  });
  it("campo ausente não quebra", () => {
    expect(textoParaCodigo({})).toBe("||");
  });
});

describe("dataHoraComSegundos", () => {
  it("mostra os segundos — a ficha só trazia hora e minuto", () => {
    const d = new Date(2026, 4, 26, 9, 33, 48);
    expect(dataHoraComSegundos(d.toISOString())).toBe("26/05/2026 09:33:48");
  });
  it("preenche com zero à esquerda", () => {
    const d = new Date(2026, 0, 5, 7, 4, 9);
    expect(dataHoraComSegundos(d.toISOString())).toBe("05/01/2026 07:04:09");
  });
  it("data ausente ou inválida não quebra a ficha", () => {
    expect(dataHoraComSegundos(null)).toBe("—");
    expect(dataHoraComSegundos("nao-e-data")).toBe("—");
  });
});

import { describe, it, expect, vi } from "vitest";
import { COLUNAS_DA_LISTA_DE_ENTREGAS, completarImagens, idsSemImagem, juntarImagens } from "./entregasLeves";
import { MARCA_IMAGEM_NO_SERVIDOR as M } from "./cacheOfflineLeve";

const IMG = "data:image/jpeg;base64," + "A".repeat(600);

describe("lista de entregas sem imagem", () => {
  it("pede as imagens como resumo, com o mesmo nome de coluna", () => {
    expect(COLUNAS_DA_LISTA_DE_ENTREGAS).toContain("assinatura_colaborador:assinatura_resumo");
    expect(COLUNAS_DA_LISTA_DE_ENTREGAS).toContain("foto_reconhecimento:foto_resumo");
    expect(COLUNAS_DA_LISTA_DE_ENTREGAS.split(",")).not.toContain("assinatura_colaborador");
  });

  it("só busca as que têm imagem no servidor", () => {
    expect(idsSemImagem([
      { id: "a", assinatura_colaborador: M },
      { id: "b", assinatura_colaborador: "BIOMETRIA_DIGITAL", foto_reconhecimento: M },
      { id: "c", assinatura_colaborador: null },
      { id: "d", assinatura_colaborador: "RECONHECIMENTO_FACIAL", foto_reconhecimento: null },
    ])).toEqual(["a", "b"]);
  });

  it("troca a marca pela imagem e não mexe no resto", () => {
    const [a, b] = juntarImagens(
      [{ id: "a", assinatura_colaborador: M, foto_reconhecimento: null, x: 1 }, { id: "b", assinatura_colaborador: "BIOMETRIA_DIGITAL", foto_reconhecimento: M, x: 2 }],
      [{ id: "a", assinatura_colaborador: IMG, foto_reconhecimento: null }, { id: "b", assinatura_colaborador: "BIOMETRIA_DIGITAL", foto_reconhecimento: IMG }],
    );
    expect(a).toEqual({ id: "a", assinatura_colaborador: IMG, foto_reconhecimento: null, x: 1 });
    expect(b.foto_reconhecimento).toBe(IMG);
    expect(b.assinatura_colaborador).toBe("BIOMETRIA_DIGITAL");
  });

  it("busca em lotes e, sem internet, segue com a marca", async () => {
    const linhas = Array.from({ length: 120 }, (_, i) => ({ id: `e${i}`, assinatura_colaborador: M }));
    const buscar = vi.fn(async (ids: string[]) => {
      if (ids.includes("e100")) throw new Error("Failed to fetch");
      return ids.map((id) => ({ id, assinatura_colaborador: IMG }));
    });
    const r = await completarImagens(linhas, buscar, 50);
    expect(buscar).toHaveBeenCalledTimes(3);
    expect(r[0].assinatura_colaborador).toBe(IMG);
    expect(r[119].assinatura_colaborador).toBe(M);
  });

  it("nada para buscar: não chama o servidor", async () => {
    const buscar = vi.fn();
    await completarImagens([{ id: "a", assinatura_colaborador: null }], buscar);
    expect(buscar).not.toHaveBeenCalled();
  });
});

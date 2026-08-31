import { describe, it, expect } from "vitest";
import { imagemDeTransferencia } from "./solicitacaoMateriaisImagens";

/**
 * Monta um `DataTransfer` de mentira igual ao que o navegador entrega numa
 * colagem ou num arrastar. Não dá para usar o `DataTransfer` de verdade aqui:
 * ele não existe fora do navegador e não é construível a partir de arquivos.
 */
function transferencia(
  arquivos: File[],
  { via = "items" as "items" | "files" | "ambos" } = {},
): DataTransfer {
  const items = arquivos.map((f) => ({ kind: "file", type: f.type, getAsFile: () => f }));
  return {
    items: via === "files" ? [] : items,
    files: via === "items" ? [] : arquivos,
  } as unknown as DataTransfer;
}

const png = (nome: string) => new File([new Uint8Array([1, 2, 3])], nome, { type: "image/png" });

describe("imagemDeTransferencia", () => {
  it("pega a imagem colada pela lista de itens (é assim que chega o print de tela)", () => {
    const achado = imagemDeTransferencia(transferencia([png("captura.png")], { via: "items" }));
    expect(achado?.type).toBe("image/png");
    expect(achado?.name).toBe("captura.png");
  });

  it("pega a imagem arrastada pela lista de arquivos", () => {
    const achado = imagemDeTransferencia(transferencia([png("foto-do-capacete.png")], { via: "files" }));
    expect(achado?.name).toBe("foto-do-capacete.png");
  });

  it("dá nome próprio ao print de tela — o navegador manda todos como 'image.png'", () => {
    /*
     * Sem isto, colar três prints deixaria os três itens com a mesma linha
     * "image.png" embaixo da foto, e não daria para saber qual é qual.
     */
    const achado = imagemDeTransferencia(transferencia([png("image.png")]));
    expect(achado?.name).toMatch(/^colado-\d{6}\.png$/);
    expect(achado?.name).not.toBe("image.png");
  });

  it("nome vazio também ganha nome próprio", () => {
    const achado = imagemDeTransferencia(transferencia([png("")]));
    expect(achado?.name).toMatch(/^colado-\d{6}\.png$/);
  });

  it("preserva o conteúdo ao renomear — o que sobe é a imagem, não um arquivo vazio", async () => {
    const achado = imagemDeTransferencia(transferencia([png("image.png")]));
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(new Uint8Array(leitor.result as ArrayBuffer));
      leitor.onerror = reject;
      leitor.readAsArrayBuffer(achado!);
    });
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("colar texto não vira foto", () => {
    const texto = {
      items: [{ kind: "string", type: "text/plain", getAsFile: () => null }],
      files: [],
    } as unknown as DataTransfer;
    expect(imagemDeTransferencia(texto)).toBeNull();
  });

  it("colar um PDF não vira foto", () => {
    const pdf = new File(["x"], "nota.pdf", { type: "application/pdf" });
    expect(imagemDeTransferencia(transferencia([pdf]))).toBeNull();
  });

  it("entre um arquivo qualquer e uma imagem, escolhe a imagem", () => {
    const pdf = new File(["x"], "nota.pdf", { type: "application/pdf" });
    const achado = imagemDeTransferencia(transferencia([pdf, png("capacete.png")]));
    expect(achado?.name).toBe("capacete.png");
  });

  it("colagem vazia não quebra a tela", () => {
    expect(imagemDeTransferencia(null)).toBeNull();
    expect(imagemDeTransferencia(undefined)).toBeNull();
    expect(imagemDeTransferencia({} as DataTransfer)).toBeNull();
  });
});

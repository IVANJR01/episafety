/*
 * Logomarca da empresa em data URL, para o jsPDF.
 *
 * O jsPDF não busca imagem por http: o que ele aceita é o conteúdo já
 * embutido. Daí o caminho passar por fetch, canvas e `toDataURL`.
 *
 * O fundo branco pintado antes do desenho não é enfeite: logo em PNG com
 * transparência vira fundo preto no PDF, porque o canvas começa com pixels
 * transparentes e o JPEG/PNG achatado interpreta isso como zero.
 *
 * Estava duplicado em dois arquivos, com as mesmas vinte linhas.
 */
export async function carregarLogoDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = URL.createObjectURL(blob);
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 300;
    canvas.height = img.naturalHeight || 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (e) {
    // Documento sem logo sai; documento que não sai não serve para nada.
    console.warn("[logo] falha ao carregar logo para PDF", e);
    return null;
  }
}

/**
 * A linha de contato do rodapé: só o que existe, separado por barras.
 *
 * Juntar com template deixava " | | " onde o cadastro estava incompleto, e
 * endereço vazio é comum — várias filiais só têm nome e CNPJ.
 */
export function linhaDeContato(partes: (string | null | undefined)[]): string {
  return partes
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join("  |  ");
}

/** Endereço em uma linha, a partir dos campos soltos do cadastro. */
export function enderecoEmUmaLinha(e: {
  logradouro?: string | null; numero?: string | null; bairro?: string | null;
  cidade?: string | null; uf?: string | null; cep?: string | null; endereco?: string | null;
}): string {
  const rua = [e.logradouro, e.numero].map((p) => (p || "").trim()).filter(Boolean).join(", ");
  const cidadeUf = [e.cidade, e.uf].map((p) => (p || "").trim()).filter(Boolean).join("/");
  const montado = [rua, (e.bairro || "").trim(), cidadeUf, (e.cep || "").trim()]
    .filter(Boolean).join(" - ");
  // `endereco` é o campo antigo, de texto livre. Vale quando os campos
  // separados ainda não foram preenchidos.
  return montado || (e.endereco || "").trim();
}

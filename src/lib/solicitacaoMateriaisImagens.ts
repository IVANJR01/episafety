import { supabase } from "@/integrations/supabase/client";

export const SOLIC_MAT_IMG_BUCKET = "solicitacoes-materiais-imagens";
export const MAX_IMG_BYTES = 20 * 1024 * 1024; // 20MB antes da compressão
export const ACCEPTED_IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Reduz um bitmap ja decodificado para `maxSide` e devolve o canvas pronto. */
function desenharReduzido(bitmap: ImageBitmap, maxSide: number) {
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Largura e altura da foto sem decodificar a imagem toda. */
function medirImagem(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("imagem ilegivel")); };
    img.src = url;
  });
}

/**
 * Decodifica a foto JA no tamanho reduzido.
 *
 * `createImageBitmap(file)` puro decodifica no tamanho original: uma foto de
 * celular de 12 MP vira uma textura de 3000x4000x4 bytes — mais de 48 MB — só
 * para ser desenhada com 1600px. Passando resizeWidth/resizeHeight, o navegador
 * entrega o bitmap já pequeno e aquela textura gigante nunca chega a existir.
 */
async function decodificarNoTamanho(file: File, maxSide: number) {
  const { w, h } = await medirImagem(file);
  const ratio = Math.min(1, maxSide / Math.max(w, h));
  return createImageBitmap(file, {
    resizeWidth: Math.max(1, Math.round(w * ratio)),
    resizeHeight: Math.max(1, Math.round(h * ratio)),
    resizeQuality: "high",
  });
}

/** JPEG do canvas como endereco de blob. */
function canvasParaUrl(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error("falha ao gerar miniatura"))),
      "image/jpeg",
      quality,
    );
  });
}

/** Libera o endereco de blob de uma miniatura que nao esta mais na tela. */
export function descartarPreview(url?: string | null) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

/** Descarta o buffer do canvas — em alguns navegadores so sai da memoria assim. */
function liberarCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

export type ImagemPreparada = { blob: Blob; type: string; ext: string; thumb: string };

/**
 * Decodifica a foto UMA vez e produz, do mesmo bitmap, o arquivo que sobe e a
 * miniatura da tela.
 *
 * Antes eram duas decodificacoes por foto — uma na escolha (miniatura) e outra
 * no salvamento (compressao) — e nenhuma liberava o bitmap. Uma foto de celular
 * de 12 MP ocupa mais de 48 MB decodificada; com varias fotos na mesma
 * solicitacao isso somava centenas de MB presos ate o coletor de lixo passar,
 * e a aba ficava em branco.
 */
export async function prepararImagemItem(
  file: File, maxSide = 1600, quality = 0.85, thumbSide = 480, thumbQuality = 0.7,
): Promise<ImagemPreparada> {
  const semImagem = () => ({
    blob: file as Blob, type: file.type, ext: (file.name.split(".").pop() || "bin").toLowerCase(),
    thumb: URL.createObjectURL(file),
  });
  if (!file.type.startsWith("image/")) return semImagem();

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await decodificarNoTamanho(file, maxSide);
    const grande = desenharReduzido(bitmap, maxSide);
    const blob: Blob = await new Promise((res) => grande.toBlob((b) => res(b || file), "image/jpeg", quality));
    const pequeno = desenharReduzido(bitmap, thumbSide);
    // `toDataURL` obriga o navegador a trazer o desenho de volta da placa de
    // video e transformar tudo em texto base64, que ainda fica preso no
    // atributo src de cada foto. `toBlob` + endereco de blob evita as duas
    // coisas: o dado continua binario e o DOM guarda so um endereco curto.
    const thumb = await canvasParaUrl(pequeno, thumbQuality);
    liberarCanvas(grande);
    liberarCanvas(pequeno);
    return { blob, type: "image/jpeg", ext: "jpg", thumb };
  } catch {
    return semImagem();
  } finally {
    bitmap?.close?.();
  }
}

/** Comprime imagem para no máximo `maxSide` px no maior lado, retornando JPEG blob. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<{ blob: Blob; type: string; ext: string }> {
  if (!file.type.startsWith("image/")) return { blob: file, type: file.type, ext: (file.name.split(".").pop() || "bin").toLowerCase() };
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await decodificarNoTamanho(file, maxSide);
    const canvas = desenharReduzido(bitmap, maxSide);
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b || file), "image/jpeg", quality));
    liberarCanvas(canvas);
    return { blob, type: "image/jpeg", ext: "jpg" };
  } catch {
    return { blob: file, type: file.type, ext: (file.name.split(".").pop() || "jpg").toLowerCase() };
  } finally {
    bitmap?.close?.();
  }
}

/** Gera thumbnail leve (dataURL) para preview em tela, sem travar mobile. */
export async function makeThumbnailDataUrl(file: File, maxSide = 480, quality = 0.7): Promise<string> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await decodificarNoTamanho(file, maxSide);
    const canvas = desenharReduzido(bitmap, maxSide);
    const url = await canvasParaUrl(canvas, quality);
    liberarCanvas(canvas);
    return url;
  } catch {
    return URL.createObjectURL(file);
  } finally {
    bitmap?.close?.();
  }
}

export function buildItemImagePath(empresaId: string, solicitacaoId: string, itemKey: string, ext: string) {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const stamp = Date.now();
  return `${empresaId}/solicitacoes/${solicitacaoId}/itens/${itemKey}/${stamp}.${safeExt}`;
}

export async function uploadItemImage(path: string, blob: Blob, contentType: string) {
  const { error } = await supabase.storage
    .from(SOLIC_MAT_IMG_BUCKET)
    .upload(path, blob, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw error;
  return path;
}

export async function getSignedImageUrl(path: string, ttl = 600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(SOLIC_MAT_IMG_BUCKET).createSignedUrl(path, ttl);
  if (error) {
    console.warn("[solic-mat-img] signed url failed", error.message);
    return null;
  }
  return data?.signedUrl || null;
}

export async function removeItemImage(path?: string | null) {
  if (!path) return;
  try {
    const { error } = await supabase.storage.from(SOLIC_MAT_IMG_BUCKET).remove([path]);
    if (error) console.warn("[solic-mat-img] remove failed", error.message);
  } catch (e) {
    console.warn("[solic-mat-img] remove threw", e);
  }
}

/**
 * Copia a imagem de um item para a pasta de outra solicitação.
 *
 * Ao duplicar uma solicitação não dá para reaproveitar o `imagem_path` da
 * original: o caminho carrega o id dela, e `removeSolicitacaoImages` apaga a
 * pasta inteira quando a original é excluída — a cópia ficaria com as fotos
 * quebradas, sem nada indicando o porquê. Aqui cada foto vira arquivo próprio,
 * sob o id novo, e as duas solicitações passam a ser independentes.
 *
 * Falha em copiar devolve `null` (item fica sem foto) em vez de devolver o
 * caminho antigo: apontar para o arquivo alheio é justamente o que se evita.
 */
export async function copiarImagemParaSolicitacao(
  path: string, solicitacaoOrigemId: string, solicitacaoDestinoId: string,
): Promise<string | null> {
  const destino = path.replace(
    `/solicitacoes/${solicitacaoOrigemId}/`,
    `/solicitacoes/${solicitacaoDestinoId}/`,
  );
  if (destino === path) return null; // caminho fora do padrão desta lib
  try {
    const { error } = await supabase.storage.from(SOLIC_MAT_IMG_BUCKET).copy(path, destino);
    if (error) { console.warn("[solic-mat-img] copy failed", error.message); return null; }
    return destino;
  } catch (e) {
    console.warn("[solic-mat-img] copy threw", e);
    return null;
  }
}

/** Lista recursivamente e apaga todas as imagens de uma solicitação. */
export async function removeSolicitacaoImages(empresaId: string, solicitacaoId: string) {
  const base = `${empresaId}/solicitacoes/${solicitacaoId}/itens`;
  try {
    const { data: itemDirs } = await supabase.storage.from(SOLIC_MAT_IMG_BUCKET).list(base, { limit: 1000 });
    if (!itemDirs?.length) return;
    const toRemove: string[] = [];
    for (const d of itemDirs) {
      const sub = `${base}/${d.name}`;
      const { data: files } = await supabase.storage.from(SOLIC_MAT_IMG_BUCKET).list(sub, { limit: 1000 });
      files?.forEach((f) => toRemove.push(`${sub}/${f.name}`));
    }
    if (toRemove.length) await supabase.storage.from(SOLIC_MAT_IMG_BUCKET).remove(toRemove);
  } catch (e) {
    console.warn("[solic-mat-img] cleanup falhou", e);
  }
}

/** Fetch signed URL and convert to dataURL (para embutir no PDF). */
export async function loadImageAsDataUrl(path: string): Promise<string | null> {
  const url = await getSignedImageUrl(path, 300);
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("[solic-mat-img] dataurl fetch failed", e);
    return null;
  }
}

/**
 * Acha a imagem dentro de uma colagem (Ctrl+V) ou de um arrastar-e-soltar.
 *
 * Serve para os dois porque o navegador entrega os dois do mesmo jeito: um
 * `DataTransfer` com uma lista de itens. Print de tela colado chega como item
 * do tipo "file" com `type: "image/png"` e SEM nome de arquivo de verdade —
 * por isso o nome é gerado aqui, senão a linha embaixo da foto ficaria vazia
 * ou com "image.png" repetido em todos os itens.
 *
 * Devolve `null` quando não há imagem nenhuma (colar texto, por exemplo), e é
 * quem chama que decide se avisa ou fica quieto.
 */
export function imagemDeTransferencia(dt: DataTransfer | null | undefined): File | null {
  if (!dt) return null;

  const candidatos: File[] = [];
  // `items` é o caminho da colagem; `files` é o do arrastar. Os dois podem
  // existir ao mesmo tempo, e um navegador pode trazer só um deles.
  for (const item of Array.from(dt.items || [])) {
    if (item.kind !== "file") continue;
    const arquivo = item.getAsFile();
    if (arquivo) candidatos.push(arquivo);
  }
  for (const arquivo of Array.from(dt.files || [])) candidatos.push(arquivo);

  const imagem = candidatos.find((f) => f.type.startsWith("image/"));
  if (!imagem) return null;

  // Nome vazio ou genérico vira um nome próprio, com hora, para dar de
  // distinguir uma colagem da outra na lista de itens.
  const generico = !imagem.name || /^(image|imagem)\.\w+$/i.test(imagem.name);
  if (!generico) return imagem;

  const ext = (imagem.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const hora = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  return new File([imagem], `colado-${hora}.${ext}`, { type: imagem.type });
}

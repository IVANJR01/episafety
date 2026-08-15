import { describe, it, expect } from "vitest";
import { extractGDriveFileId, isGDriveUrl, getGDriveImageProxyUrl } from "./googleDrive";

/**
 * O caso real: um relatório de inspeção com 28 não conformidades saiu com 11
 * fotos faltando. Todas as 11 estavam gravadas como link do Google Drive
 * (`drive.google.com/uc?export=view&id=...`), e não como arquivo no storage.
 *
 * Esse endereço não devolve os bytes da imagem para o navegador — não manda
 * cabeçalho de CORS e costuma responder uma página HTML de confirmação —,
 * então o carregamento falhava sempre. O proxy do próprio projeto resolve, e
 * era só não estar sendo usado na geração do PDF.
 */

describe("extractGDriveFileId", () => {
  it("reconhece o formato que as inspeções gravaram", () => {
    expect(extractGDriveFileId("https://drive.google.com/uc?export=view&id=1QDkGSRkOn01PdcfU_FoPiE2QqAz2dSkY"))
      .toBe("1QDkGSRkOn01PdcfU_FoPiE2QqAz2dSkY");
  });

  it("reconhece os outros formatos de compartilhamento", () => {
    expect(extractGDriveFileId("https://drive.google.com/file/d/ABC123_-xyz/view?usp=sharing")).toBe("ABC123_-xyz");
    expect(extractGDriveFileId("https://drive.google.com/open?id=ABC123_-xyz")).toBe("ABC123_-xyz");
  });

  it("devolve nulo para o que não é Drive", () => {
    expect(extractGDriveFileId("https://estmuducawmftvpbeutm.supabase.co/storage/v1/object/sign/x.jpg")).toBeNull();
    expect(extractGDriveFileId("")).toBeNull();
  });
});

describe("isGDriveUrl", () => {
  it("separa link do Drive de URL do storage", () => {
    expect(isGDriveUrl("https://drive.google.com/uc?export=view&id=abc")).toBe(true);
    expect(isGDriveUrl("https://exemplo.com/foto.jpg")).toBe(false);
  });
});

describe("getGDriveImageProxyUrl", () => {
  it("devolve nulo para URL que não é do Drive — assim o chamador usa a original", () => {
    // É o que garante que foto do storage continue indo direto, sem passar
    // pelo proxy à toa.
    expect(getGDriveImageProxyUrl("https://exemplo.com/foto.jpg")).toBeNull();
  });

  it("com o ambiente configurado, aponta para o proxy e pede o conteúdo bruto", () => {
    const config = (import.meta as any).env;
    if (!config?.VITE_SUPABASE_URL) {
      // Sem as variáveis do ambiente o helper devolve nulo de propósito, e o
      // chamador cai no link original. Registrar isso é melhor do que fingir
      // que o caso foi coberto.
      expect(getGDriveImageProxyUrl("https://drive.google.com/uc?export=view&id=abc")).toBeNull();
      return;
    }
    const url = getGDriveImageProxyUrl("https://drive.google.com/uc?export=view&id=abc")!;
    expect(url).toContain("/functions/v1/gdrive-proxy/");
    expect(url).toContain("id=abc");
    expect(url).toContain("raw=1");
  });
});

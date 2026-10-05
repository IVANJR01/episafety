/*
 * Downloads em celular (iOS e Android).
 *
 * Problema: o sistema gera PDF/Excel/CSV no navegador e baixa com um <a download>
 * criado por código (jsPDF.save, XLSX.writeFile, exportações CSV) ou abre com
 * window.open(blob) DEPOIS de um await. No celular, o navegador bloqueia isso
 * (não é mais "gesto do usuário") e, no app instalado (PWA/nativo), o atributo
 * download é ignorado — o arquivo simplesmente não aparece.
 *
 * Solução: no celular, qualquer download/abertura de blob: ou data: é
 * interceptado e vira um cartão com botões "Compartilhar/Salvar", "Baixar" e
 * "Abrir". Como o usuário toca num botão de verdade, o aparelho deixa salvar.
 * No computador nada muda.
 */

const ehCelular = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  // iPadOS se apresenta como Mac
  return navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
};

const EXT_POR_MIME: Record<string, string> = {
  "application/pdf": "documento.pdf",
  "text/csv": "planilha.csv",
  "application/json": "dados.json",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "planilha.xlsx",
  "application/vnd.ms-excel": "planilha.xls",
  "application/zip": "arquivos.zip",
};

let aberto = false;

async function obterBlob(url: string): Promise<Blob> {
  const r = await fetch(url);
  return await r.blob();
}

function mostrarCartao(blob: Blob, nome: string) {
  if (aberto) return;
  aberto = true;
  const urlLocal = URL.createObjectURL(blob);
  const fundo = document.createElement("div");
  fundo.setAttribute("data-download-mobile", "1");
  fundo.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;padding:16px;font-family:system-ui,sans-serif";
  const cartao = document.createElement("div");
  cartao.style.cssText =
    "background:#fff;color:#111;width:100%;max-width:420px;border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:10px;margin-bottom:env(safe-area-inset-bottom,0)";
  const titulo = document.createElement("div");
  titulo.textContent = "Arquivo pronto";
  titulo.style.cssText = "font-weight:700;font-size:18px";
  const sub = document.createElement("div");
  sub.textContent = nome;
  sub.style.cssText = "font-size:13px;color:#555;word-break:break-all";
  cartao.append(titulo, sub);

  const estiloBtn = (primario: boolean) =>
    `display:block;text-align:center;padding:14px;border-radius:12px;font-size:16px;font-weight:600;border:0;text-decoration:none;cursor:pointer;${
      primario ? "background:#2563eb;color:#fff" : "background:#eef2f7;color:#111"
    }`;

  const fechar = () => {
    fundo.remove();
    aberto = false;
    setTimeout(() => URL.revokeObjectURL(urlLocal), 120_000);
  };

  const file = new File([blob], nome, { type: blob.type || "application/octet-stream" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare && nav.canShare({ files: [file] })) {
    const b = document.createElement("button");
    b.textContent = "Compartilhar / Salvar";
    b.style.cssText = estiloBtn(true);
    b.onclick = async () => {
      try {
        await nav.share({ files: [file], title: nome });
        fechar();
      } catch {
        /* cancelado pelo usuário */
      }
    };
    cartao.append(b);
  }

  const baixar = document.createElement("a");
  baixar.href = urlLocal;
  baixar.download = nome;
  baixar.setAttribute("data-download-mobile", "1");
  baixar.textContent = "Baixar";
  baixar.style.cssText = estiloBtn(false);
  baixar.onclick = () => setTimeout(fechar, 800);

  const abrir = document.createElement("a");
  abrir.href = urlLocal;
  abrir.target = "_blank";
  abrir.rel = "noopener";
  abrir.setAttribute("data-download-mobile", "1");
  abrir.textContent = "Abrir";
  abrir.style.cssText = estiloBtn(false);

  const cancelar = document.createElement("button");
  cancelar.textContent = "Fechar";
  cancelar.style.cssText = "padding:10px;background:none;border:0;color:#666;font-size:14px";
  cancelar.onclick = fechar;

  cartao.append(baixar, abrir, cancelar);
  fundo.append(cartao);
  document.body.append(fundo);
}

async function tratar(url: string, nomeSugerido?: string) {
  try {
    const blob = await obterBlob(url);
    const nome =
      (nomeSugerido && nomeSugerido.trim()) || EXT_POR_MIME[blob.type] || "arquivo";
    mostrarCartao(blob, nome);
  } catch (e) {
    console.warn("[download] falhou:", e);
  }
}

const interceptavel = (href: string) => href.startsWith("blob:") || href.startsWith("data:");

export function instalarDownloadMobile() {
  if (typeof window === "undefined" || !ehCelular()) return;
  if ((window as unknown as { __dlMobile?: boolean }).__dlMobile) return;
  (window as unknown as { __dlMobile?: boolean }).__dlMobile = true;

  const anchorPendente = (a: HTMLAnchorElement): boolean =>
    !a.hasAttribute("data-download-mobile") &&
    a.hasAttribute("download") &&
    interceptavel(a.href || "");

  // <a download>.click() — usado pelas exportações CSV e pelo XLSX
  const clickOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (anchorPendente(this)) {
      void tratar(this.href, this.download);
      return;
    }
    return clickOriginal.call(this);
  };

  // jsPDF.save (FileSaver) dispara dispatchEvent(new MouseEvent("click"))
  const dispatchOriginal = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (this: EventTarget, ev: Event) {
    if (
      ev.type === "click" &&
      this instanceof HTMLAnchorElement &&
      anchorPendente(this)
    ) {
      void tratar(this.href, this.download);
      return true;
    }
    return dispatchOriginal.call(this, ev);
  };

  // window.open(blob) depois de await é bloqueado no celular
  const openOriginal = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const u = url ? String(url) : "";
    if (interceptavel(u)) {
      void tratar(u);
      return null;
    }
    return openOriginal(url, target, features);
  }) as typeof window.open;
}

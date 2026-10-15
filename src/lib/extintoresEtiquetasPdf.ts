import jsPDF from "jspdf";
import QRCode from "qrcode";
import { fmtDate } from "@/lib/pdfTimbrado";

export interface ExtintorEtiquetaItem {
  id: string;
  numero: string;
  agente: string;
  capacidade: number;
  unidade_capacidade: string;
  local_setor?: string | null;
  local_descricao?: string | null;
  data_proxima_recarga?: string | null;
  data_proximo_teste_hidrostatico?: string | null;
  qr_token: string;
  empresaNome?: string;
}

export async function gerarEtiquetasExtintoresPdf(
  extintores: ExtintorEtiquetaItem[],
  empresaNome: string
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const LARGURA = 210;
  const ALTURA = 297;
  const MARGEM_X = 12;
  const MARGEM_Y = 12;

  // Grade de 2 colunas x 4 linhas por página (8 etiquetas por folha A4)
  const COLUNAS = 2;
  const LINHAS = 4;
  const ETIQUETAS_POR_PAGINA = COLUNAS * LINHAS;

  const LARGURA_ETIQUETA = 90;
  const ALTURA_ETIQUETA = 64;
  const ESPACAMENTO_X = 6;
  const ESPACAMENTO_Y = 6;

  const NAVY = [15, 42, 68] as const;
  const LARANJA = [242, 169, 0] as const;
  const BORDA = [203, 213, 225] as const;
  const TEXTO = [30, 41, 59] as const;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://safetysolucoes.com";

  for (let idx = 0; idx < extintores.length; idx++) {
    const ext = extintores[idx];
    const indiceNaPagina = idx % ETIQUETAS_POR_PAGINA;

    if (idx > 0 && indiceNaPagina === 0) {
      doc.addPage();
    }

    const col = indiceNaPagina % COLUNAS;
    const lin = Math.floor(indiceNaPagina / COLUNAS);

    const x = MARGEM_X + col * (LARGURA_ETIQUETA + ESPACAMENTO_X);
    const y = MARGEM_Y + lin * (ALTURA_ETIQUETA + ESPACAMENTO_Y);

    // Borda da etiqueta e fundo branco
    doc.setDrawColor(BORDA[0], BORDA[1], BORDA[2]);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, LARGURA_ETIQUETA, ALTURA_ETIQUETA, 2.5, 2.5, "FD");

    // Faixa superior com identificação SafetySoluções e NR-23
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(x, y, LARGURA_ETIQUETA, 7.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("INSPEÇÃO DE EXTINTOR — NR-23 / NBR 12962", x + 3, y + 5);

    // TAG do Extintor
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(ext.numero, x + 4, y + 15);

    // Agente e Capacidade
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(LARANJA[0], LARANJA[1], LARANJA[2]);
    doc.text(`${ext.agente.replace(/_/g, " ")} · ${ext.capacidade} ${ext.unidade_capacidade}`, x + 4, y + 20);

    // Local / Setor
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
    const setorTexto = ext.local_setor ? `Setor: ${ext.local_setor}` : "Setor: Geral";
    doc.text(setorTexto, x + 4, y + 26);
    if (ext.local_descricao) {
      doc.text(doc.splitTextToSize(ext.local_descricao, 52)[0] || "", x + 4, y + 30.5);
    }

    // Datas de Vencimento
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text("Próxima Recarga:", x + 4, y + 38);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
    doc.text(fmtDate(ext.data_proxima_recarga), x + 30, y + 38);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text("Próximo Teste H.:", x + 4, y + 43);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
    doc.text(fmtDate(ext.data_proximo_teste_hidrostatico), x + 30, y + 43);

    // Empresa
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(empresaNome, 52)[0] || "", x + 4, y + 50);

    // Rodapé da etiqueta
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text("SafetySoluções", x + 4, y + 60);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140);
    doc.text("· Leitura via QR Code", x + 23, y + 60);

    // QR Code na direita da etiqueta
    const qrUrl = `${baseUrl}/extintores/qr/${ext.qr_token}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 140 });
      doc.addImage(qrDataUrl, "PNG", x + 58, y + 11, 28, 28);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(120);
      doc.text("Aponte a câmera", x + 72, y + 42, { align: "center" });
      doc.text("para inspecionar", x + 72, y + 45, { align: "center" });
    } catch (e) {
      // Caso ocorra falha de imagem, mantém texto de contingência
    }
  }

  return doc;
}

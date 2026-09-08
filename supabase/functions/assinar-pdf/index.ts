/*
 * Assina um PDF com certificado ICP-Brasil A1, no padrão PAdES.
 *
 * Por que existe: a Ficha de EPI trazia a imagem da assinatura do trabalhador
 * e um código de conferência, e isso basta entre as partes (MP 2.200-2, Art.
 * 10, §2). Mas o validador oficial (validar.iti.gov.br) recusava o arquivo —
 * "documento sem assinatura reconhecível" —, e com razão: o PDF não tinha
 * nenhum objeto de assinatura. Conferido no arquivo gerado: zero ocorrências
 * de /Sig, /ByteRange e adbe.pkcs7.
 *
 * O §1 da mesma MP, que dá presunção de veracidade, exige certificado
 * ICP-Brasil. É o que esta função acrescenta.
 *
 * Por que no servidor e não no navegador: a chave privada do certificado não
 * pode passar pela máquina de quem usa o sistema. Aqui ela vive como segredo
 * do projeto e nunca sai daqui — nem em log, nem em resposta.
 */
import { resolveCors } from "../_shared/cors.ts";
import { checkRateLimit, clientKey } from "../_shared/rateLimit.ts";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { pdflibAddPlaceholder } from "npm:@signpdf/placeholder-pdf-lib@3.3.0";
import { SignPdf } from "npm:@signpdf/signpdf@3.3.0";
import { P12Signer } from "npm:@signpdf/signer-p12@3.3.0";
import forge from "npm:node-forge@1.3.1";
import { Buffer } from "node:buffer";
import { escolherFolha, titularDe, type CertificadoLike } from "./escolherCertificado.ts";

/** Teto do arquivo aceito. Ficha de EPI tem ~40 KB; isto é folga larga. */
const LIMITE_PDF_BYTES = 15 * 1024 * 1024;

function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  const passo = 0x8000; // em blocos: String.fromCharCode estoura com array grande
  for (let i = 0; i < bytes.length; i += passo) {
    bin += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(bin);
}

/**
 * Titular e vencimento do certificado, para o front avisar antes de expirar.
 *
 * Um A1 vale um ano. Sem esse aviso, no dia seguinte ao vencimento as fichas
 * simplesmente voltariam a sair sem assinatura ICP-Brasil e ninguém
 * perceberia — o PDF continua sendo gerado normalmente.
 *
 * Falha aqui não pode derrubar a assinatura: se não der para ler a validade,
 * a ficha sai assinada do mesmo jeito e o front só não mostra o aviso.
 */
function lerDadosDoCertificado(pfx: Uint8Array, senha: string): { titular: string; validoAte: string } | null {
  try {
    let bin = "";
    for (let i = 0; i < pfx.length; i++) bin += String.fromCharCode(pfx[i]);
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(bin));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certs = (bags[forge.pki.oids.certBag] ?? [])
      .map((b: { cert?: CertificadoLike }) => b.cert)
      .filter((c): c is CertificadoLike => !!c?.validity?.notAfter);
    const folha = escolherFolha(certs);
    if (!folha) return null;
    return { titular: titularDe(folha), validoAte: folha.validity.notAfter.toISOString() };
  } catch (e) {
    console.error("[assinar-pdf] nao consegui ler a validade do certificado:", e instanceof Error ? e.message : e);
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ok = await checkRateLimit({ key: clientKey(req, null, "assinar-pdf"), limit: 30, windowSeconds: 60 });
  if (!ok) {
    return new Response(JSON.stringify({ success: false, error: "Muitas assinaturas seguidas. Aguarde um instante." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const pfxB64 = Deno.env.get("CERT_A1_PFX_BASE64");
    const senha = Deno.env.get("CERT_A1_SENHA");
    if (!pfxB64 || !senha) {
      // Mensagem que diz o que fazer: sem isto, a falha vira "erro 500" e
      // ninguém descobre que faltava cadastrar o certificado.
      return new Response(JSON.stringify({
        success: false,
        configuracaoAusente: true,
        error: "Certificado A1 não configurado. Cadastre CERT_A1_PFX_BASE64 e CERT_A1_SENHA nos segredos do projeto.",
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { pdfBase64, motivo, nome, local, contato } = await req.json() as {
      pdfBase64?: string; motivo?: string; nome?: string; local?: string; contato?: string;
    };
    if (!pdfBase64) {
      return new Response(JSON.stringify({ success: false, error: "PDF não enviado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = base64ParaBytes(pdfBase64);
    if (bytes.byteLength > LIMITE_PDF_BYTES) {
      return new Response(JSON.stringify({ success: false, error: "PDF acima do limite de 15 MB" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfDoc = await PDFDocument.load(bytes);
    pdflibAddPlaceholder({
      pdfDoc,
      reason: motivo || "Ficha de EPI - NR-6",
      contactInfo: contato || "sst@safetysolucoes.com",
      name: nome || "SafetySoluções",
      location: local || "Brasil",
    });
    /*
     * `useObjectStreams: false` não é detalhe de gosto: o assinador precisa
     * encontrar o /ByteRange no texto do arquivo para saber que trecho cobrir,
     * e o fluxo de objetos comprime tudo, escondendo-o.
     */
    const comPlaceholder = await pdfDoc.save({ useObjectStreams: false });

    const pfxBytes = base64ParaBytes(pfxB64);
    const signer = new P12Signer(Buffer.from(pfxBytes), { passphrase: senha });
    const assinado = await new SignPdf().sign(Buffer.from(comPlaceholder), signer);

    return new Response(JSON.stringify({
      success: true,
      pdfBase64: bytesParaBase64(new Uint8Array(assinado)),
      certificado: lerDadosDoCertificado(pfxBytes, senha),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    /*
     * A mensagem do erro é devolvida, mas o certificado nunca: `P12Signer`
     * lança "PKCS#12 MAC could not be verified" quando a senha está errada, e
     * é justamente isso que quem configurou precisa ler.
     */
    const msg = e instanceof Error ? e.message : "Falha desconhecida ao assinar";
    console.error("[assinar-pdf]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

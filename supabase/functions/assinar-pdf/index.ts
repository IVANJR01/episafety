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

/**
 * Decodifica base64 dizendo O QUE falhou.
 *
 * O `atob` solta sempre a mesma frase — "Failed to decode base64" — e nesta
 * função há duas entradas em base64: o PDF que chegou na requisição e o
 * certificado guardado no segredo. Sem dizer qual das duas quebrou, quem
 * está configurando fica adivinhando entre um problema no front e um erro de
 * colagem no painel do Supabase.
 *
 * O tamanho entra na mensagem porque distingue os dois enganos mais comuns
 * no segredo: colar vazio (0) e colar o caminho do arquivo em vez do
 * conteúdo (algumas dezenas de caracteres, quando um .pfx dá milhares).
 * O conteúdo em si nunca é registrado — é a chave privada.
 */
function decodificarBase64(b64: string, oQueE: string): Uint8Array {
  // Quebra de linha e espaço entram fácil ao colar num campo de textarea, e
  // não fazem parte do dado. Tirar antes é mais útil do que recusar.
  const limpo = b64.replace(/\s+/g, "");
  try {
    return base64ParaBytes(limpo);
  } catch {
    throw new Error(
      `${oQueE} não está em base64 válido (${limpo.length} caracteres úteis recebidos).`,
    );
  }
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

/**
 * O certificado guardado no Vault, quando o segredo do painel está vazio.
 *
 * O .pfx em base64 tem ~5.400 caracteres, e colar isso no campo de segredo do
 * painel falhou três vezes na configuração real — o valor simplesmente não
 * era salvo. O Vault guarda o mesmo conteúdo criptografado e aceita ser
 * preenchido por SQL. A leitura passa pela RPC `certificado_a1_pfx_base64`,
 * que só a service_role executa.
 *
 * A senha continua fora daqui, como segredo de ambiente: guardar o arquivo e
 * a senha no mesmo lugar é o que transforma um vazamento de banco numa
 * assinatura falsificada.
 *
 * Falha de rede devolve null, e o chamador trata como "não configurado" — o
 * que nunca acontece é o conteúdo aparecer em log.
 */
async function certificadoDoVault(): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chave) return null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/certificado_a1_pfx_base64`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: chave,
        Authorization: `Bearer ${chave}`,
      },
      body: "{}",
    });
    if (!r.ok) {
      console.error("[assinar-pdf] Vault respondeu", r.status);
      return null;
    }
    const valor = await r.json();
    return typeof valor === "string" && valor.trim() ? valor.trim() : null;
  } catch (e) {
    console.error("[assinar-pdf] falha ao ler o Vault:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** O texto do erro do node-forge quando a senha não abre o arquivo. */
const ERRO_SENHA = /MAC could not be verified/i;

/**
 * Assina, tolerando o espaço invisível que a colagem deixa na senha.
 *
 * Senha copiada de um PDF ou de um e-mail chega com "\n" ou espaço no fim, e
 * o PKCS#12 rejeita igual a uma senha errada — mesma mensagem, mesma tela.
 * A segunda tentativa só acontece quando há o que aparar, e só depois de a
 * primeira falhar exatamente por senha: a senha cadastrada continua sendo a
 * verdade, isto apenas evita perder uma rodada por um caractere que ninguém
 * vê.
 */
async function assinar(
  pdf: Uint8Array, pfx: Uint8Array, senha: string,
): Promise<{ assinado: Buffer; senhaUsada: string }> {
  const tentar = (p: string) =>
    new SignPdf().sign(Buffer.from(pdf), new P12Signer(Buffer.from(pfx), { passphrase: p }));
  try {
    return { assinado: await tentar(senha), senhaUsada: senha };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const aparada = senha.trim();
    if (aparada && aparada !== senha && ERRO_SENHA.test(msg)) {
      // Devolve a senha que funcionou: quem lê a validade do certificado logo
      // adiante precisa da mesma, senão o aviso de vencimento some sem motivo.
      return { assinado: await tentar(aparada), senhaUsada: aparada };
    }
    throw e;
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
    // Segredo do painel primeiro, Vault como reserva: quem administra pode
    // trocar o certificado pelo painel sem mexer no banco, e quem não
    // consegue colar 5.400 caracteres ali tem o outro caminho.
    const pfxB64 = Deno.env.get("CERT_A1_PFX_BASE64")?.trim() || await certificadoDoVault();
    const senha = Deno.env.get("CERT_A1_SENHA");
    /*
     * Qual dos dois falta, e não "algum dos dois".
     *
     * A mensagem antiga citava os dois nomes sempre, e quem estava
     * configurando não tinha como saber se faltava o certificado, a senha ou
     * os dois. Na configuração do A1 de verdade isso custou uma rodada de
     * adivinhação: a resposta era a mesma nos três casos. Nomear o que falta
     * troca essa rodada por uma correção direta.
     */
    const faltando = [
      !pfxB64 ? "CERT_A1_PFX_BASE64 (conteúdo do .pfx em base64, no painel ou no Vault)" : null,
      !senha ? "CERT_A1_SENHA (senha do certificado)" : null,
    ].filter(Boolean);
    if (faltando.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        configuracaoAusente: true,
        error: `Certificado A1 não configurado. Falta cadastrar nos segredos do projeto: ${faltando.join(" e ")}.`,
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

    const bytes = decodificarBase64(pdfBase64, "O PDF enviado");
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

    const pfxBytes = decodificarBase64(
      pfxB64,
      "O segredo CERT_A1_PFX_BASE64 (cole o conteúdo do arquivo .base64, não o caminho dele)",
    );
    const { assinado, senhaUsada } = await assinar(comPlaceholder, pfxBytes, senha);

    return new Response(JSON.stringify({
      success: true,
      pdfBase64: bytesParaBase64(new Uint8Array(assinado)),
      certificado: lerDadosDoCertificado(pfxBytes, senhaUsada),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    /*
     * A mensagem do erro é devolvida, mas o certificado nunca: `P12Signer`
     * lança "PKCS#12 MAC could not be verified" quando a senha está errada, e
     * é justamente isso que quem configurou precisa ler.
     */
    const bruto = e instanceof Error ? e.message : "Falha desconhecida ao assinar";
    console.error("[assinar-pdf]", bruto);
    /*
     * "PKCS#12 MAC could not be verified. Invalid password?" é a frase certa
     * para quem programa e inútil para quem administra: não diz qual segredo
     * corrigir nem que a senha do certificado anterior não serve para o novo.
     */
    const msg = ERRO_SENHA.test(bruto)
      ? "A senha cadastrada em CERT_A1_SENHA não abre este certificado. "
        + "Confira se é a senha do arquivo .pfx atual — a senha de um certificado anterior não serve."
      : bruto;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

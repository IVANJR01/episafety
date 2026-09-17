/**
 * WhatsApp Cloud API — o que é comum ao webhook e ao envio.
 *
 * Só este arquivo conhece o formato da Meta. As Edge Functions trabalham com
 * `MensagemRecebida` e `StatusRecebido`, que são estruturas planas: quando a
 * Meta mudar a versão do Graph, é aqui que se mexe.
 *
 * As funções de leitura de payload (`extrairMensagens`, `extrairStatus`,
 * `assinaturaConfere`, `variantesBrasil`) são puras de propósito — elas são
 * importadas pelo teste em `src/test/whatsappWebhook.test.ts`, que roda em
 * Node, não em Deno. Por isso nada de `Deno.env` no corpo do módulo: só dentro
 * das funções que realmente precisam.
 */

declare const Deno: { env: { get(nome: string): string | undefined } };

/** Versão do Graph API. Fixa no código para a Meta não trocar o contrato embaixo da gente. */
export const VERSAO_GRAPH = "v21.0";

export interface MensagemRecebida {
  /** `wamid...` — identificador da Meta. É a chave da idempotência. */
  waMessageId: string;
  /** Número da linha que RECEBEU (nosso número). Diz de qual empresa é a conversa. */
  phoneNumberId: string;
  /** Número de quem escreveu, só dígitos, com DDI. */
  waId: string;
  /** Nome do perfil do WhatsApp, quando a Meta manda. */
  nome: string | null;
  /** text, image, audio, document, interactive, button, ... */
  tipo: string;
  /** Texto legível. Para mídia, uma descrição — o conteúdo em si fica em `bruto`. */
  texto: string;
  /** Instante em que a Meta registrou a mensagem (ISO). */
  recebidaEm: string;
  /** O objeto original da mensagem, guardado no banco para depuração. */
  bruto: Record<string, unknown>;
}

export interface StatusRecebido {
  waMessageId: string;
  phoneNumberId: string;
  /** sent, delivered, read, failed */
  status: string;
  erro: string | null;
}

/** O que a Meta chama de `type` e não traz texto nenhum. */
const DESCRICAO_MIDIA: Record<string, string> = {
  image: "[imagem]",
  audio: "[áudio]",
  video: "[vídeo]",
  document: "[documento]",
  sticker: "[figurinha]",
  location: "[localização]",
  contacts: "[contato]",
  unsupported: "[mensagem não suportada]",
};

/*
 * O payload vem da rede: nada nele é garantido. Estes três ajudantes leem
 * campo a campo sem `any` — o que não for do tipo esperado vira vazio, e a
 * função de cima segue sem `?.` em cima de `?.` em cima de `?.`.
 */
type Objeto = Record<string, unknown>;

function obj(valor: unknown): Objeto {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (valor as Objeto) : {};
}

function comoTexto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function textoDaMensagem(msg: Objeto): string {
  const tipo = comoTexto(msg.type);
  switch (tipo) {
    case "text":
      return comoTexto(obj(msg.text).body).trim();
    // Resposta de botão de template.
    case "button":
      return comoTexto(obj(msg.button).text).trim();
    // Botão ou item de lista de mensagem interativa.
    case "interactive": {
      const i = obj(msg.interactive);
      const titulo = comoTexto(obj(i.button_reply).title) || comoTexto(obj(i.list_reply).title);
      return titulo.trim();
    }
    default: {
      // Mídia pode vir com legenda; a legenda é o que a pessoa quis dizer.
      const legenda = (
        comoTexto(obj(msg.image).caption) ||
        comoTexto(obj(msg.video).caption) ||
        comoTexto(obj(msg.document).caption)
      ).trim();
      const rotulo = DESCRICAO_MIDIA[tipo] ?? `[${tipo || "desconhecido"}]`;
      return legenda ? `${rotulo} ${legenda}` : rotulo;
    }
  }
}

function mudancasDeMensagem(payload: unknown): Objeto[] {
  const valores: Objeto[] = [];
  for (const entrada of lista(obj(payload).entry)) {
    for (const mudanca of lista(obj(entrada).changes)) {
      const m = obj(mudanca);
      // `field` também pode ser account_update, message_template_status_update etc.
      if (m.field !== "messages") continue;
      if (m.value) valores.push(obj(m.value));
    }
  }
  return valores;
}

/**
 * Tira do payload da Meta as mensagens que uma pessoa mandou.
 *
 * Um mesmo POST pode trazer várias mensagens, de várias linhas, e pode trazer
 * só confirmações de entrega (`statuses`) — nesse caso a lista volta vazia, e
 * quem chamou não tem nada a responder.
 */
export function extrairMensagens(payload: unknown): MensagemRecebida[] {
  const saida: MensagemRecebida[] = [];
  for (const valor of mudancasDeMensagem(payload)) {
    const phoneNumberId = comoTexto(obj(valor.metadata).phone_number_id);
    const perfis = new Map<string, string>();
    for (const contato of lista(valor.contacts)) {
      const c = obj(contato);
      const nome = comoTexto(obj(c.profile).name);
      const waId = comoTexto(c.wa_id);
      if (waId && nome) perfis.set(waId, nome);
    }
    for (const mensagem of lista(valor.messages)) {
      const msg = obj(mensagem);
      const waId = comoTexto(msg.from);
      const id = comoTexto(msg.id);
      if (!id || !waId) continue;
      const segundos = Number(msg.timestamp);
      saida.push({
        waMessageId: id,
        phoneNumberId,
        waId,
        nome: perfis.get(waId) ?? null,
        tipo: comoTexto(msg.type) || "unknown",
        texto: textoDaMensagem(msg),
        recebidaEm: Number.isFinite(segundos) && segundos > 0
          ? new Date(segundos * 1000).toISOString()
          : new Date().toISOString(),
        bruto: msg,
      });
    }
  }
  return saida;
}

/** Confirmações de entrega/leitura das mensagens que NÓS enviamos. */
export function extrairStatus(payload: unknown): StatusRecebido[] {
  const saida: StatusRecebido[] = [];
  for (const valor of mudancasDeMensagem(payload)) {
    const phoneNumberId = comoTexto(obj(valor.metadata).phone_number_id);
    for (const item of lista(valor.statuses)) {
      const s = obj(item);
      const id = comoTexto(s.id);
      if (!id) continue;
      const primeiroErro = obj(lista(s.errors)[0]);
      const erro = lista(s.errors).length > 0
        ? `${comoTexto(primeiroErro.code) || String(primeiroErro.code ?? "")} ${comoTexto(primeiroErro.title)}`.trim()
        : null;
      saida.push({
        waMessageId: id,
        phoneNumberId,
        status: comoTexto(s.status) || "unknown",
        erro: erro || null,
      });
    }
  }
  return saida;
}

/** Só os dígitos. O que a pessoa digitou no cadastro vem com (), - e espaço. */
export function apenasDigitos(numero: string): string {
  return (numero || "").replace(/\D+/g, "");
}

/**
 * As duas formas que um celular brasileiro tem na Meta.
 *
 * Isto não é preciosismo: a Meta devolve o `wa_id` de número brasileiro SEM o
 * nono dígito (5585988887777 chega como 558588887777), enquanto o telefone
 * cadastrado em `clientes_comerciais` foi digitado por uma pessoa, com o nove.
 * Procurar só pela forma recebida não acha o cliente, e o atendimento perde o
 * nome de quem está falando logo na primeira mensagem.
 *
 * Devolve as variantes sem repetir, começando pela recebida.
 */
export function variantesBrasil(numero: string): string[] {
  const d = apenasDigitos(numero);
  const variantes = [d];
  if (d.startsWith("55")) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    if (resto.length === 8 && /^[6-9]/.test(resto)) variantes.push(`55${ddd}9${resto}`);
    if (resto.length === 9 && resto.startsWith("9")) variantes.push(`55${ddd}${resto.slice(1)}`);
  }
  return [...new Set(variantes.filter(Boolean))];
}

/** Comparação sem atalho: o tempo da comparação não pode contar o quanto acertou. */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/**
 * Confere o `X-Hub-Signature-256` que a Meta manda em todo POST.
 *
 * Sem isso o webhook aceita qualquer POST de qualquer um: o endereço dele é
 * público, e o corpo é o que decide a quem o sistema vai responder e o que vai
 * gastar de IA. É o único controle de acesso que esta function tem.
 *
 * O corpo tem que ser o texto CRU, exatamente como chegou — `JSON.parse` e
 * `JSON.stringify` de volta muda espaço e ordem, e a assinatura não bate mais.
 */
export async function assinaturaConfere(
  corpoCru: string,
  cabecalho: string | null,
  segredo: string,
): Promise<boolean> {
  if (!cabecalho || !segredo) return false;
  const esperado = cabecalho.startsWith("sha256=") ? cabecalho.slice(7) : cabecalho;
  if (!/^[0-9a-f]+$/i.test(esperado)) return false;

  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpoCru));
  const calculado = [...new Uint8Array(assinatura)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return iguaisEmTempoConstante(calculado, esperado.toLowerCase());
}

export interface RespostaEnvio {
  ok: boolean;
  waMessageId: string | null;
  erro: string | null;
}

async function chamarGraph(phoneNumberId: string, corpo: Record<string, unknown>): Promise<RespostaEnvio> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  if (!token) return { ok: false, waMessageId: null, erro: "WHATSAPP_TOKEN não configurado" };

  const resposta = await fetch(
    `https://graph.facebook.com/${VERSAO_GRAPH}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...corpo }),
    },
  );

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = dados?.error?.message ?? `HTTP ${resposta.status}`;
    console.error("[whatsapp] falha ao enviar", resposta.status, JSON.stringify(dados));
    return { ok: false, waMessageId: null, erro: String(erro) };
  }
  return { ok: true, waMessageId: dados?.messages?.[0]?.id ?? null, erro: null };
}

/**
 * Mensagem livre. Só vale dentro da janela de 24h desde a última mensagem da
 * pessoa — fora dela a Meta recusa, e a saída é `enviarTemplate`.
 */
export function enviarTexto(phoneNumberId: string, para: string, texto: string): Promise<RespostaEnvio> {
  return chamarGraph(phoneNumberId, {
    to: apenasDigitos(para),
    type: "text",
    // Sem prévia de link: a prévia atrasa a entrega e às vezes puxa imagem errada.
    text: { preview_url: false, body: texto.slice(0, 4096) },
  });
}

/**
 * Um valor que entra no lugar de `{{1}}` (ou de `{{nome}}`) no template.
 *
 * A Meta aceita as duas formas de marcador, e elas não se misturam na mesma
 * mensagem: template criado com marcador numerado recebe parâmetros na ordem;
 * template com marcador nomeado exige `parameter_name` em cada um. Mandar a
 * forma errada devolve erro em vez de mensagem.
 */
export interface ParametroTemplate {
  valor: string;
  /** Preenchido só quando o template usa marcador nomeado. */
  nome?: string;
}

export interface ParametrosTemplate {
  /** Valores do corpo, na ordem em que aparecem. */
  corpo?: ParametroTemplate[];
  /** Valores do cabeçalho, quando ele é de texto e tem marcador. */
  cabecalho?: ParametroTemplate[];
}

function parametrosGraph(lista: ParametroTemplate[]): Array<Record<string, string>> {
  return lista.map((p) => (
    p.nome
      ? { type: "text", parameter_name: p.nome, text: p.valor }
      : { type: "text", text: p.valor }
  ));
}

/** Fora da janela de 24h, só template aprovado pela Meta. */
export function enviarTemplate(
  phoneNumberId: string,
  para: string,
  nomeTemplate: string,
  idioma: string,
  parametros: ParametrosTemplate,
): Promise<RespostaEnvio> {
  const componentes: Array<Record<string, unknown>> = [];
  if (parametros.cabecalho?.length) {
    componentes.push({ type: "header", parameters: parametrosGraph(parametros.cabecalho) });
  }
  if (parametros.corpo?.length) {
    componentes.push({ type: "body", parameters: parametrosGraph(parametros.corpo) });
  }
  return chamarGraph(phoneNumberId, {
    to: apenasDigitos(para),
    type: "template",
    template: { name: nomeTemplate, language: { code: idioma }, components: componentes },
  });
}

export interface ComponenteTemplate {
  tipo: string;
  formato?: string;
  texto?: string;
}

export interface TemplateAprovado {
  nome: string;
  idioma: string;
  categoria: string | null;
  componentes: ComponenteTemplate[];
}

/**
 * Os templates que a Meta já aprovou para esta conta.
 *
 * Vem da Meta a cada consulta, e não de uma cópia no banco, porque template é
 * aprovado, pausado e reprovado lá — uma cópia daqui envelheceria sem avisar, e
 * o primeiro sintoma seria a mensagem recusada na hora de enviar.
 *
 * Só os APPROVED voltam: oferecer na tela um template em análise é oferecer um
 * envio que vai falhar.
 */
export async function listarTemplatesAprovados(wabaId: string): Promise<TemplateAprovado[]> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  if (!token) throw new Error("WHATSAPP_TOKEN não configurado");

  const resposta = await fetch(
    `https://graph.facebook.com/${VERSAO_GRAPH}/${wabaId}/message_templates?limit=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = obj(dados).error;
    throw new Error(comoTexto(obj(erro).message) || `HTTP ${resposta.status}`);
  }

  return lista(obj(dados).data)
    .map((item) => obj(item))
    .filter((t) => comoTexto(t.status).toUpperCase() === "APPROVED")
    .map((t) => ({
      nome: comoTexto(t.name),
      idioma: comoTexto(t.language),
      categoria: comoTexto(t.category) || null,
      componentes: lista(t.components).map((c) => {
        const comp = obj(c);
        return {
          tipo: comoTexto(comp.type).toUpperCase(),
          formato: comoTexto(comp.format).toUpperCase() || undefined,
          texto: comoTexto(comp.text) || undefined,
        };
      }),
    }))
    .filter((t) => t.nome);
}

/** Marca como lida — o tique azul enquanto a IA pensa evita a segunda mensagem impaciente. */
export async function marcarComoLida(phoneNumberId: string, waMessageId: string): Promise<void> {
  try {
    await chamarGraph(phoneNumberId, { status: "read", message_id: waMessageId });
  } catch (e) {
    console.error("[whatsapp] falha ao marcar como lida", e);
  }
}

/** Quantas horas desde a última mensagem de entrada. A janela da Meta é 24h. */
export function dentroDaJanela24h(ultimaEntradaEm: string | null | undefined, agora = new Date()): boolean {
  if (!ultimaEntradaEm) return false;
  const quando = new Date(ultimaEntradaEm).getTime();
  if (!Number.isFinite(quando)) return false;
  return agora.getTime() - quando < 24 * 60 * 60 * 1000;
}

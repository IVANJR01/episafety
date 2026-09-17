import { describe, it, expect } from "vitest";
import {
  assinaturaConfere,
  dentroDaJanela24h,
  extrairMensagens,
  extrairStatus,
  variantesBrasil,
} from "../../supabase/functions/_shared/whatsapp";

/**
 * A leitura do payload da Meta vive numa Edge Function (Deno) e é importada
 * aqui como TypeScript comum — mesmo arranjo do teste do provedor de IA. Nada
 * neste arquivo faz chamada de rede: só as funções puras entram.
 *
 * O que se protege, e por que cada caso está aqui:
 *
 * - O webhook recebe POST de assunto que não é mensagem (status de entrega,
 *   atualização de template). Se `extrairMensagens` devolver algo nesses
 *   casos, o sistema responde sozinho para um cliente que não escreveu nada.
 * - A assinatura é o ÚNICO controle de acesso do webhook, que é público.
 * - Número brasileiro chega da Meta sem o nono dígito. Errar isso é não achar
 *   o cliente que está na carteira.
 */

const payloadTexto = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "123",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "5585999999999", phone_number_id: "LINHA1" },
            contacts: [{ profile: { name: "Ivan" }, wa_id: "558588887777" }],
            messages: [
              {
                from: "558588887777",
                id: "wamid.AAA",
                timestamp: "1700000000",
                type: "text",
                text: { body: "  Quero um orçamento de PGR  " },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe("extrairMensagens", () => {
  it("lê a mensagem de texto com nome, linha e horário", () => {
    const [msg] = extrairMensagens(payloadTexto);
    expect(msg.waMessageId).toBe("wamid.AAA");
    expect(msg.phoneNumberId).toBe("LINHA1");
    expect(msg.waId).toBe("558588887777");
    expect(msg.nome).toBe("Ivan");
    expect(msg.texto).toBe("Quero um orçamento de PGR");
    expect(msg.recebidaEm).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it("não devolve nada quando o POST é só confirmação de entrega", () => {
    // Este é o caso que faria o sistema responder a uma mensagem que ele mesmo
    // enviou — e continuar respondendo a si próprio.
    const payload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "LINHA1" },
                statuses: [{ id: "wamid.BBB", status: "delivered", recipient_id: "558588887777" }],
              },
            },
          ],
        },
      ],
    };
    expect(extrairMensagens(payload)).toHaveLength(0);
    expect(extrairStatus(payload)).toEqual([
      { waMessageId: "wamid.BBB", phoneNumberId: "LINHA1", status: "delivered", erro: null },
    ]);
  });

  it("ignora mudança que não é de mensagem", () => {
    const payload = { entry: [{ changes: [{ field: "message_template_status_update", value: { event: "APPROVED" } }] }] };
    expect(extrairMensagens(payload)).toHaveLength(0);
  });

  it("aguenta payload torto sem explodir", () => {
    expect(extrairMensagens(null)).toEqual([]);
    expect(extrairMensagens({})).toEqual([]);
    expect(extrairMensagens({ entry: "nada disso" })).toEqual([]);
  });

  it("descreve mídia e aproveita a legenda", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "LINHA1" },
                messages: [
                  { from: "5585999", id: "wamid.C", type: "image", image: { id: "img1", caption: "é este CA?" } },
                  { from: "5585999", id: "wamid.D", type: "audio", audio: { id: "a1" } },
                  {
                    from: "5585999",
                    id: "wamid.E",
                    type: "interactive",
                    interactive: { type: "button_reply", button_reply: { id: "b1", title: "Quero falar com vocês" } },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const textos = extrairMensagens(payload).map((m) => m.texto);
    expect(textos).toEqual(["[imagem] é este CA?", "[áudio]", "Quero falar com vocês"]);
  });

  it("descarta mensagem sem id, que não teria como ser desduplicada", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: { metadata: { phone_number_id: "L" }, messages: [{ from: "5585", type: "text", text: { body: "oi" } }] },
            },
          ],
        },
      ],
    };
    expect(extrairMensagens(payload)).toHaveLength(0);
  });
});

describe("assinaturaConfere", () => {
  const segredo = "segredo-do-app";
  const corpo = JSON.stringify({ object: "whatsapp_business_account" });

  // Calculada com o mesmo HMAC-SHA256 que a Meta usa, sobre o corpo acima.
  async function assinar(texto: string, chaveSecreta: string): Promise<string> {
    const chave = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(chaveSecreta),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto)));
    return "sha256=" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  it("aceita a assinatura correta", async () => {
    expect(await assinaturaConfere(corpo, await assinar(corpo, segredo), segredo)).toBe(true);
  });

  it("recusa quando o corpo foi alterado no caminho", async () => {
    const assinatura = await assinar(corpo, segredo);
    expect(await assinaturaConfere(corpo + " ", assinatura, segredo)).toBe(false);
  });

  it("recusa assinatura feita com outro segredo", async () => {
    expect(await assinaturaConfere(corpo, await assinar(corpo, "outro"), segredo)).toBe(false);
  });

  it("recusa quando falta o cabeçalho ou o segredo", async () => {
    expect(await assinaturaConfere(corpo, null, segredo)).toBe(false);
    expect(await assinaturaConfere(corpo, await assinar(corpo, segredo), "")).toBe(false);
  });

  it("recusa cabeçalho que não é hexadecimal", async () => {
    expect(await assinaturaConfere(corpo, "sha256=não-é-hex", segredo)).toBe(false);
  });
});

describe("variantesBrasil", () => {
  it("acrescenta o nono dígito ao número que a Meta manda sem ele", () => {
    expect(variantesBrasil("558588887777")).toEqual(["558588887777", "5585988887777"]);
  });

  it("também tira o nono dígito, para achar cadastro antigo", () => {
    expect(variantesBrasil("5585988887777")).toEqual(["5585988887777", "558588887777"]);
  });

  it("limpa máscara e não mexe em número de fora do Brasil", () => {
    expect(variantesBrasil("+55 (85) 98888-7777")).toEqual(["5585988887777", "558588887777"]);
    expect(variantesBrasil("13235551234")).toEqual(["13235551234"]);
  });

  it("não inventa nono dígito em fixo", () => {
    // Fixo começa em 2..5; o nono dígito é só de celular.
    expect(variantesBrasil("558532221111")).toEqual(["558532221111"]);
  });
});

describe("dentroDaJanela24h", () => {
  const agora = new Date("2026-09-17T12:00:00Z");

  it("está aberta pouco antes das 24h", () => {
    expect(dentroDaJanela24h("2026-09-16T12:30:00Z", agora)).toBe(true);
  });

  it("fecha depois das 24h — daí em diante só template", () => {
    expect(dentroDaJanela24h("2026-09-16T11:00:00Z", agora)).toBe(false);
  });

  it("contato que nunca escreveu está fora da janela", () => {
    expect(dentroDaJanela24h(null, agora)).toBe(false);
    expect(dentroDaJanela24h("data torta", agora)).toBe(false);
  });
});

import { supabase } from "@/integrations/supabase/client";

/**
 * Acesso às tabelas do atendimento por WhatsApp.
 *
 * Existe por um motivo específico: `integrations/supabase/types.ts` é gerado
 * pelo `supabase gen types`, e as três tabelas do WhatsApp entraram depois da
 * última geração. Sem elas no tipo, o cliente recusa o nome da tabela em tempo
 * de compilação.
 *
 * O escape de tipagem fica aqui, num lugar só e comentado, em vez de um `as any`
 * em cada consulta espalhado pela tela. A tela trabalha com os tipos abaixo,
 * que são de verdade. Quando o types.ts for gerado de novo, é este arquivo que
 * encolhe — e nada mais precisa mudar.
 */

export interface ConfigLinha {
  id: string;
  empresa_id: string;
  phone_number_id: string;
  numero_exibicao: string | null;
  automacao_ativa: boolean;
  prompt_extra: string | null;
  saudacao: string | null;
}

export interface Contato {
  id: string;
  wa_id: string;
  nome: string | null;
  cliente_comercial_id: string | null;
  automacao_ativa: boolean;
  /** Última mensagem DO CLIENTE — é ela que abre a janela de 24h. */
  ultima_entrada_em: string | null;
  ultima_mensagem_em: string | null;
}

export interface Mensagem {
  id: string;
  direcao: "entrada" | "saida";
  texto: string | null;
  origem: "ia" | "humano" | "sistema" | null;
  status: string | null;
  erro: string | null;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConsultaSemTipo = any;

const tabela = supabase.from as unknown as (nome: string) => ConsultaSemTipo;

const COLUNAS_CONTATO =
  "id, wa_id, nome, cliente_comercial_id, automacao_ativa, ultima_entrada_em, ultima_mensagem_em";
const COLUNAS_MENSAGEM = "id, direcao, texto, origem, status, erro, created_at";

/** A linha da empresa do usuário. O RLS já limita ao tenant dele. */
export async function lerConfigWhatsapp(): Promise<ConfigLinha | null> {
  const { data, error } = await tabela("whatsapp_config").select("*").limit(1).maybeSingle();
  if (error) throw error;
  return (data as ConfigLinha) ?? null;
}

export async function listarContatos(limite = 200): Promise<Contato[]> {
  const { data, error } = await tabela("whatsapp_contatos")
    .select(COLUNAS_CONTATO)
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
    .limit(limite);
  if (error) throw error;
  return (data || []) as Contato[];
}

export async function listarMensagens(contatoId: string, limite = 300): Promise<Mensagem[]> {
  const { data, error } = await tabela("whatsapp_mensagens")
    .select(COLUNAS_MENSAGEM)
    .eq("contato_id", contatoId)
    .order("created_at", { ascending: true })
    .limit(limite);
  if (error) throw error;
  return (data || []) as Mensagem[];
}

/** Ligar/desligar a IA numa conversa. Desligada, quem responde é gente. */
export async function definirAutomacaoDoContato(contatoId: string, ativa: boolean): Promise<void> {
  const { error } = await tabela("whatsapp_contatos").update({ automacao_ativa: ativa }).eq("id", contatoId);
  if (error) throw error;
}

export async function salvarConfigWhatsapp(id: string, mudancas: Partial<ConfigLinha>): Promise<void> {
  const { error } = await tabela("whatsapp_config").update(mudancas).eq("id", id);
  if (error) throw error;
}

/**
 * O corpo do erro de uma Edge Function vem em `context`, não em `message`.
 *
 * Sem abrir isso, o 409 da janela de 24h — que traz a explicação inteira e o
 * que fazer — chega na tela como "Edge Function returned a non-2xx status
 * code", que não ajuda ninguém.
 */
async function motivoDoErro(erro: unknown): Promise<string> {
  const contexto = (erro as { context?: Response })?.context;
  if (contexto && typeof contexto.json === "function") {
    try {
      const corpo = await contexto.json();
      if (corpo?.detalhe) return String(corpo.detalhe);
      if (corpo?.error) return String(corpo.error);
    } catch {
      /* corpo não era JSON — cai na mensagem genérica */
    }
  }
  return (erro as Error)?.message || "Falha ao enviar";
}

/**
 * Manda a mensagem pela Edge Function, nunca direto para a Meta: o token do
 * WhatsApp não pode existir no navegador.
 */
export async function enviarMensagem(contatoId: string, texto: string): Promise<void> {
  const { error } = await supabase.functions.invoke("whatsapp-enviar", {
    body: { contato_id: contatoId, texto },
  });
  if (error) throw new Error(await motivoDoErro(error));
}

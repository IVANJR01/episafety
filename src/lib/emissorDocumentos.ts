/*
 * Quem elabora os documentos técnicos.
 *
 * A capa do PGR leva a marca da empresa coberta no alto e, no rodapé, o
 * crédito de quem elaborou — é o padrão de documento de consultoria de SST.
 * Esse segundo bloco não existia: `empresa_config` guarda as empresas
 * atendidas, não quem atende.
 *
 * Linha única no banco, por isso não há id para escolher aqui.
 */
import { supabase } from "@/integrations/supabase/client";

export interface Emissor {
  nome: string;
  slogan: string | null;
  cnpj: string | null;
  endereco: string | null;
  contato: string | null;
  logo_url: string | null;
  logo_path: string | null;
}

export const EMISSOR_VAZIO: Emissor = {
  nome: "", slogan: null, cnpj: null, endereco: null,
  contato: null, logo_url: null, logo_path: null,
};

/**
 * Lê o emissor. Devolve `null` quando não há nada cadastrado ou quando a
 * tabela ainda não existe no banco — em ambos os casos o documento sai sem o
 * rodapé de crédito, e sai. Documento que não sai não serve para nada.
 */
export async function carregarEmissor(): Promise<Emissor | null> {
  try {
    const { data, error } = await (supabase.from as any)("emissor_documentos")
      .select("nome, slogan, cnpj, endereco, contato, logo_url, logo_path")
      .limit(1).maybeSingle();
    if (error || !data) return null;
    return data as Emissor;
  } catch {
    return null;
  }
}

/**
 * As linhas do rodapé, na ordem em que saem impressas.
 *
 * Só o que existe entra: cadastro pela metade é comum enquanto ninguém
 * preencheu tudo, e um rodapé com " | " solto no meio é pior do que um
 * rodapé curto. O CNPJ entra junto do contato porque os dois são
 * identificação, e o endereço fica sozinho por ser mais longo.
 */
export function linhasDoEmissor(e: Emissor | null): string[] {
  if (!e) return [];
  const linhas: string[] = [];
  if (e.slogan?.trim()) linhas.push(e.slogan.trim());
  if (e.endereco?.trim()) linhas.push(e.endereco.trim());
  const identificacao = [
    e.cnpj?.trim() ? `CNPJ ${e.cnpj.trim()}` : "",
    e.contato?.trim() || "",
  ].filter(Boolean).join("  |  ");
  if (identificacao) linhas.push(identificacao);
  return linhas;
}

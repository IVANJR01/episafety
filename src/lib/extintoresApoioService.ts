import { supabase } from "@/integrations/supabase/client";

export type TipoApoio = "SETOR" | "LOCAL" | "FABRICANTE";

export interface ItemApoio {
  id?: string;
  empresa_id: string;
  tipo: TipoApoio;
  nome: string;
  setor_pai?: string | null;
}

const FABRICANTES_PADRAO = [
  "Kidde",
  "Mocelin",
  "Resil",
  "Bucka",
  "Extang",
  "Extincol",
  "Yanes",
  "Itaubá",
  "Iperfire",
  "Flamac",
  "Metalcasty",
  "Previnorte",
  "Embrase",
  "Mundial",
];

const SETORES_PADRAO = [
  "Administração",
  "Almoxarifado",
  "Corte",
  "Costura",
  "Expedição / Estoque",
  "Cozinha / Refeitório",
  "Manutenção",
  "Recepção",
  "Produção / Galpão",
  "Sala Elétrica / QGBT",
  "Área Externa",
];

const LOCAIS_PADRAO = [
  "Ao lado da porta de saída",
  "Coluna central",
  "Ao lado do quadro elétrico",
  "Corredor principal",
  "Próximo ao bebedouro",
  "Entrada da expedição",
  "Parede lateral",
];

function getLocalKey(empresaId: string, tipo: TipoApoio): string {
  return `episafety_ext_apoio_${empresaId}_${tipo}`;
}

function getLocalItems(empresaId: string, tipo: TipoApoio): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getLocalKey(empresaId, tipo));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalItems(empresaId: string, tipo: TipoApoio, items: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getLocalKey(empresaId, tipo), JSON.stringify(items));
  } catch {
    // ignora falha de quota
  }
}

/**
 * Carrega a lista consolidada de setores da empresa
 */
export async function carregarSetores(empresaId: string): Promise<string[]> {
  const set = new Set<string>(SETORES_PADRAO);

  // 1. LocalStorage
  getLocalItems(empresaId, "SETOR").forEach((s) => s && set.add(s.trim()));

  // 2. Tabela de apoio no Supabase (se existir)
  try {
    const { data } = await (supabase.from as any)("extintores_cadastros_apoio")
      .select("nome")
      .eq("empresa_id", empresaId)
      .eq("tipo", "SETOR");
    if (data && Array.isArray(data)) {
      data.forEach((r) => r.nome && set.add(r.nome.trim()));
    }
  } catch {
    // fallback se a tabela ainda não existir
  }

  // 3. Setores já usados nos extintores da empresa
  try {
    const { data: extData } = await (supabase.from as any)("extintores")
      .select("local_setor")
      .eq("empresa_id", empresaId);
    if (extData && Array.isArray(extData)) {
      extData.forEach((e) => e.local_setor && set.add(e.local_setor.trim()));
    }
  } catch {
    // ignora
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Carrega a lista consolidada de localizações específicas
 */
export async function carregarLocais(empresaId: string): Promise<string[]> {
  const set = new Set<string>(LOCAIS_PADRAO);

  getLocalItems(empresaId, "LOCAL").forEach((l) => l && set.add(l.trim()));

  try {
    const { data } = await (supabase.from as any)("extintores_cadastros_apoio")
      .select("nome")
      .eq("empresa_id", empresaId)
      .eq("tipo", "LOCAL");
    if (data && Array.isArray(data)) {
      data.forEach((r) => r.nome && set.add(r.nome.trim()));
    }
  } catch {
    // fallback
  }

  try {
    const { data: extData } = await (supabase.from as any)("extintores")
      .select("local_descricao")
      .eq("empresa_id", empresaId);
    if (extData && Array.isArray(extData)) {
      extData.forEach((e) => e.local_descricao && set.add(e.local_descricao.trim()));
    }
  } catch {
    // ignora
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Carrega a lista consolidada de fabricantes / marcas
 */
export async function carregarFabricantes(empresaId: string): Promise<string[]> {
  const set = new Set<string>(FABRICANTES_PADRAO);

  getLocalItems(empresaId, "FABRICANTE").forEach((f) => f && set.add(f.trim()));

  try {
    const { data } = await (supabase.from as any)("extintores_cadastros_apoio")
      .select("nome")
      .eq("empresa_id", empresaId)
      .eq("tipo", "FABRICANTE");
    if (data && Array.isArray(data)) {
      data.forEach((r) => r.nome && set.add(r.nome.trim()));
    }
  } catch {
    // fallback
  }

  try {
    const { data: extData } = await (supabase.from as any)("extintores")
      .select("fabricante")
      .eq("empresa_id", empresaId);
    if (extData && Array.isArray(extData)) {
      extData.forEach((e) => e.fabricante && set.add(e.fabricante.trim()));
    }
  } catch {
    // ignora
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Adiciona um novo setor, local ou fabricante
 */
export async function cadastrarItemApoio(
  empresaId: string,
  tipo: TipoApoio,
  nome: string,
  setorPai?: string | null
): Promise<boolean> {
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) return false;

  // 1. Atualiza localStorage imediatamente
  const localList = getLocalItems(empresaId, tipo);
  if (!localList.includes(nomeLimpo)) {
    localList.push(nomeLimpo);
    saveLocalItems(empresaId, tipo, localList);
  }

  // 2. Tenta persistir no Supabase
  try {
    await (supabase.from as any)("extintores_cadastros_apoio").insert({
      empresa_id: empresaId,
      tipo,
      nome: nomeLimpo,
      setor_pai: setorPai || null,
    });
    return true;
  } catch (err) {
    console.warn("[extintoresApoioService] Aviso ao persistir no banco (usando fallback local):", err);
    return true;
  }
}

/**
 * Remove um item cadastrado
 */
export async function excluirItemApoio(
  empresaId: string,
  tipo: TipoApoio,
  nome: string
): Promise<boolean> {
  // 1. Remove do localStorage
  const localList = getLocalItems(empresaId, tipo).filter((n) => n !== nome);
  saveLocalItems(empresaId, tipo, localList);

  // 2. Remove do Supabase
  try {
    await (supabase.from as any)("extintores_cadastros_apoio")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo)
      .eq("nome", nome);
  } catch {
    // ignora
  }

  return true;
}

import { supabase } from "@/integrations/supabase/client";

export const TIPO_EXAME_COL: Record<string, string> = {
  admissional: "admissional",
  periodico: "periodico",
  retorno: "retorno_trabalho",
  mudanca_risco: "mudanca_risco",
  mudanca_funcao: "mudanca_funcao",
  demissional: "demissional",
};

export const GRUPOS_RISCO = [
  { k: "fisico", l: "Físicos" },
  { k: "quimico", l: "Químicos" },
  { k: "biologico", l: "Biológicos" },
  { k: "ergonomico", l: "Ergonômicos" },
  { k: "acidente", l: "Acidentes / Mecânicos" },
  { k: "outro", l: "Outros" },
];

export interface RiscoSnapshot { grupo: string; descricao: string; }
export interface ExameSnapshot { nome_exame: string; codigo?: string | null; tipo?: string | null; }

export async function loadGheRiscosExames(
  gheId: string,
  tipoExame: string
): Promise<{ riscos: RiscoSnapshot[]; exames: ExameSnapshot[] }> {
  const col = TIPO_EXAME_COL[tipoExame] || "periodico";
  const [riscosRes, examesRes] = await Promise.all([
    supabase.from("ghe_riscos").select("grupo, tipo_agente, texto_aso").eq("ghe_id", gheId).eq("aparece_aso", true),
    supabase.from("ghe_exames").select("nome_exame, codigo_exame, tipo_exame, " + col).eq("ghe_id", gheId).eq("aparece_aso", true),
  ]);
  const riscos: RiscoSnapshot[] = (riscosRes.data || []).map((r: any) => ({
    grupo: r.grupo,
    descricao: (r.texto_aso || r.tipo_agente || "").trim(),
  })).filter((r) => r.descricao);
  const exames: ExameSnapshot[] = (examesRes.data || [])
    .filter((e: any) => e[col] === true)
    .map((e: any) => ({ nome_exame: e.nome_exame, codigo: e.codigo_exame, tipo: e.tipo_exame }));
  return { riscos, exames };
}

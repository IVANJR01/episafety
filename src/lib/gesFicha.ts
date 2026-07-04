// Loader unificado do GES/GHE: retorna o cadastro + riscos + exames + funções.
// Base central usada por Ordem de Serviço, tela "Gerar Documentos" e imports para PGR/PCMSO/LTCAT.
import { supabase } from "@/integrations/supabase/client";

export interface GheFichaCabecalho {
  id: string;
  empresa_id: string;
  codigo: string;
  nome: string;
  setor: string | null;
  descricao: string | null;
  descricao_atividades: string | null;
  trabalhadores_expostos: number | null;
  frequencia_exposicao: string | null;
  tempo_exposicao: string | null;
  severidade: number | null;
  probabilidade: number | null;
  nivel_risco: string | null;
  medidas_controle_existentes: string | null;
  medidas_controle_recomendadas: string | null;
  epcs: string | null;
  capacitacoes_obrigatorias: string | null;
  observacoes_tecnicas: string | null;
  status: string;
}

export interface GheFichaRisco {
  id: string;
  grupo: string;
  tipo_agente: string | null;
  perigo_fonte: string | null;
  exposicao: string | null;
  possiveis_lesoes: string | null;
  limite_exposicao: string | null;
  texto_aso: string | null;
}

export interface GheFichaExame {
  id: string;
  nome_exame: string;
  codigo_exame: string | null;
  tipo_exame: string | null;
  periodicidade_meses: number | null;
  obrigatorio: boolean;
}

export interface GheFichaFuncao {
  id: string;
  nome_funcao: string;
  cbo: string | null;
  descricao_atividade: string | null;
}

export interface GheFichaCompleta {
  cabecalho: GheFichaCabecalho;
  riscos: GheFichaRisco[];
  exames: GheFichaExame[];
  funcoes: GheFichaFuncao[];
}

export async function loadGheFicha(gheId: string): Promise<GheFichaCompleta> {
  const [gheRes, riscosRes, examesRes, funcoesRes] = await Promise.all([
    (supabase as any).from("ghe_ges").select("*").eq("id", gheId).maybeSingle(),
    (supabase as any).from("ghe_riscos").select("id, grupo, tipo_agente, perigo_fonte, exposicao, possiveis_lesoes, limite_exposicao, texto_aso").eq("ghe_id", gheId),
    (supabase as any).from("ghe_exames").select("id, nome_exame, codigo_exame, tipo_exame, periodicidade_meses, obrigatorio").eq("ghe_id", gheId),
    (supabase as any).from("ghe_funcoes").select("id, nome_funcao, cbo, descricao_atividade").eq("ghe_id", gheId).order("nome_funcao"),
  ]);
  if (gheRes.error) throw gheRes.error;
  if (!gheRes.data) throw new Error("GHE não encontrado");
  return {
    cabecalho: gheRes.data as GheFichaCabecalho,
    riscos: (riscosRes.data || []) as GheFichaRisco[],
    exames: (examesRes.data || []) as GheFichaExame[],
    funcoes: (funcoesRes.data || []) as GheFichaFuncao[],
  };
}

export function riscosToSnapshot(riscos: GheFichaRisco[]) {
  return riscos.map((r) => ({
    grupo: r.grupo,
    descricao: (r.texto_aso || r.perigo_fonte || r.tipo_agente || "").trim(),
    fonte: r.perigo_fonte,
    exposicao: r.exposicao,
    lesoes: r.possiveis_lesoes,
    limite: r.limite_exposicao,
  }));
}

export const GRUPO_RISCO_LABEL: Record<string, string> = {
  fisico: "Físicos",
  quimico: "Químicos",
  biologico: "Biológicos",
  ergonomico: "Ergonômicos",
  acidente: "Acidentes / Mecânicos",
  outro: "Outros",
};

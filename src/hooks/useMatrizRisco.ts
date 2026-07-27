import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CLASSE_DECISAO, CLASSE_HEX, CLASSE_LABEL, CLASSES_ORDENADAS,
  PROBABILIDADE_LABEL, SEVERIDADE_LABEL,
} from "@/lib/pgrMatriz";

export interface MatrizNivel {
  id: string;
  versao_id: string;
  codigo: string;
  rotulo: string;
  valor_min: number;
  valor_max: number;
  cor_hex: string | null;
  decisao: string | null;
  exige_acao: boolean;
  ordem: number;
}

export interface MatrizEscala {
  id: string;
  versao_id: string;
  tipo: "severidade" | "probabilidade";
  valor: number;
  rotulo: string;
  definicao: string | null;
}

export interface MatrizMetodo {
  id: string;
  empresa_id: string | null;
  nome: string;
  descricao: string | null;
  dimensao_severidade: number;
  dimensao_probabilidade: number;
  formula: string;
  ativo: boolean;
}

export interface MatrizVersao {
  id: string;
  metodo_id: string;
  versao: number;
  status: "rascunho" | "vigente" | "arquivada";
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  motivo_alteracao: string | null;
  publicada_em: string | null;
  metodo?: MatrizMetodo;
}

/**
 * Fallback derivado das constantes estáticas de pgrMatriz.ts.
 *
 * Existe para que a UI continue funcionando antes de a versão carregar e para
 * PGRs anteriores à matriz versionada — exatamente o mesmo comportamento da
 * função SQL pgr_classificar_risco_versao quando recebe versao_id nulo.
 */
export const NIVEIS_PADRAO: MatrizNivel[] = [
  { codigo: "trivial", min: 1, max: 3 },
  { codigo: "toleravel", min: 4, max: 8 },
  { codigo: "moderado", min: 9, max: 12 },
  { codigo: "substancial", min: 13, max: 15 },
  { codigo: "intoleravel", min: 16, max: 25 },
].map((n, i) => {
  const c = n.codigo as (typeof CLASSES_ORDENADAS)[number];
  const [r, g, b] = CLASSE_HEX[c];
  return {
    id: `padrao-${n.codigo}`,
    versao_id: "",
    codigo: n.codigo,
    rotulo: CLASSE_LABEL[c],
    valor_min: n.min,
    valor_max: n.max,
    cor_hex: `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
    decisao: CLASSE_DECISAO[c],
    exige_acao: i >= 2,
    ordem: i + 1,
  };
});

export const ESCALAS_PADRAO: MatrizEscala[] = [
  ...Object.entries(SEVERIDADE_LABEL).map(([v, rotulo]) => ({
    id: `padrao-sev-${v}`, versao_id: "", tipo: "severidade" as const,
    valor: Number(v), rotulo, definicao: null,
  })),
  ...Object.entries(PROBABILIDADE_LABEL).map(([v, rotulo]) => ({
    id: `padrao-prob-${v}`, versao_id: "", tipo: "probabilidade" as const,
    valor: Number(v), rotulo, definicao: null,
  })),
];

/**
 * Carrega uma versão de matriz e devolve funções de classificação que espelham
 * pgr_classificar_risco_versao. Sem versaoId, opera com a matriz padrão.
 */
export function useMatrizRisco(versaoId?: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ["matriz-versao", versaoId],
    enabled: !!versaoId,
    queryFn: async () => {
      const [niveisRes, escalasRes, versaoRes] = await Promise.all([
        (supabase.from as any)("sst_matriz_niveis")
          .select("*").eq("versao_id", versaoId).order("ordem"),
        (supabase.from as any)("sst_matriz_escalas")
          .select("*").eq("versao_id", versaoId).order("valor"),
        (supabase.from as any)("sst_matriz_versoes")
          .select("*, metodo:metodo_id(*)").eq("id", versaoId).maybeSingle(),
      ]);
      return {
        niveis: (niveisRes.data || []) as MatrizNivel[],
        escalas: (escalasRes.data || []) as MatrizEscala[],
        versao: (versaoRes.data || null) as MatrizVersao | null,
      };
    },
  });

  // Uma versão sem níveis cadastrados não pode classificar nada; cair no padrão
  // é melhor do que devolver "sem classe" para todos os riscos.
  const niveis = data?.niveis?.length ? data.niveis : NIVEIS_PADRAO;
  const escalas = data?.escalas?.length ? data.escalas : ESCALAS_PADRAO;
  const usandoPadrao = !data?.niveis?.length;

  const dimensaoSev = data?.versao?.metodo?.dimensao_severidade ?? 5;
  const dimensaoProb = data?.versao?.metodo?.dimensao_probabilidade ?? 5;

  const api = useMemo(() => {
    const porCodigo = new Map(niveis.map((n) => [n.codigo, n]));

    const classificar = (sev?: number | null, prob?: number | null): MatrizNivel | null => {
      if (sev == null || prob == null) return null;
      if (sev < 1 || prob < 1) return null;
      const n = sev * prob;
      return niveis.find((x) => n >= x.valor_min && n <= x.valor_max) ?? null;
    };

    const rotulo = (codigo?: string | null) =>
      codigo ? porCodigo.get(codigo)?.rotulo ?? codigo : "Não avaliado";

    const corDe = (codigo?: string | null) =>
      (codigo && porCodigo.get(codigo)?.cor_hex) || "#94a3b8";

    const escalaDe = (tipo: "severidade" | "probabilidade", valor: number) =>
      escalas.find((e) => e.tipo === tipo && e.valor === valor) ?? null;

    return { classificar, rotulo, corDe, escalaDe, porCodigo };
  }, [niveis, escalas]);

  return {
    isLoading,
    niveis,
    escalas,
    versao: data?.versao ?? null,
    /** true quando a UI está operando com a matriz padrão, não com dados carregados. */
    usandoPadrao,
    dimensaoSev,
    dimensaoProb,
    ...api,
  };
}

/** Lista os métodos visíveis (globais + do tenant) com suas versões. */
export function useMatrizMetodos(empresaId?: string | null) {
  return useQuery({
    queryKey: ["matriz-metodos", empresaId],
    queryFn: async () => {
      const { data: metodos } = await (supabase.from as any)("sst_matriz_metodos")
        .select("*").order("empresa_id", { nullsFirst: true }).order("nome");
      const { data: versoes } = await (supabase.from as any)("sst_matriz_versoes")
        .select("*").order("versao", { ascending: false });
      const porMetodo = new Map<string, MatrizVersao[]>();
      ((versoes || []) as MatrizVersao[]).forEach((v) => {
        if (!porMetodo.has(v.metodo_id)) porMetodo.set(v.metodo_id, []);
        porMetodo.get(v.metodo_id)!.push(v);
      });
      return ((metodos || []) as MatrizMetodo[]).map((m) => ({
        ...m,
        versoes: porMetodo.get(m.id) || [],
      }));
    },
  });
}

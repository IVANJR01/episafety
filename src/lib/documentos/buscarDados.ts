/*
 * Lê do banco tudo o que um documento SST precisa e entrega no formato do
 * pacote.
 *
 * A parte difícil — traduzir — está em montarDados.ts, que é função pura e
 * testada. Aqui só há leitura: a consulta, a resolução do código do GES e a
 * ligação entre a ação e o item de inventário de onde vêm o setor e o GES.
 */
import { supabase } from "@/integrations/supabase/client";
import { montarDadosDocumento, type FontesDoDocumento } from "./montarDados";
import type { DadosDocumento } from "./gerarDocx";

/*
 * O código do GES pode estar em duas tabelas: sst_ges (Núcleo Mestre, a fonte
 * preferencial) e ghe_ges (a hierarquia legada, mantida porque o módulo
 * ASO/RH ainda depende dela). O item aponta para uma, para a outra, ou para
 * as duas com o mesmo id. Lemos as duas e o Núcleo Mestre ganha.
 */
async function codigosDeGes(empresaId: string): Promise<Record<string, string>> {
  const [novo, legado] = await Promise.all([
    (supabase.from as any)("sst_ges").select("id,codigo").eq("empresa_id", empresaId),
    (supabase.from as any)("ghe_ges").select("id,codigo").eq("empresa_id", empresaId),
  ]);
  const mapa: Record<string, string> = {};
  for (const g of legado.data || []) if (g?.id) mapa[g.id] = g.codigo || "";
  for (const g of novo.data || []) if (g?.id) mapa[g.id] = g.codigo || "";
  return mapa;
}

export async function buscarFontesDoPgr(
  pgrId: string,
  empresaId: string,
): Promise<FontesDoDocumento> {
  const [empresa, pgr, responsaveis, inventario, acoes, revisoes, ges] = await Promise.all([
    (supabase.from as any)("empresa_config")
      .select(
        "nome,nome_fantasia,cnpj,cnae_principal,cnae_secundario,grau_risco,endereco,logradouro,numero,complemento,bairro,cidade,uf,cep,telefone",
      )
      .eq("id", empresaId)
      .maybeSingle(),
    (supabase.from as any)("pgr_documentos")
      .select("versao,data_emissao,data_vigencia_inicio,data_vigencia_fim,resp_tec_nome,resp_tec_registro")
      .eq("id", pgrId)
      .maybeSingle(),
    (supabase.from as any)("pgr_responsaveis")
      .select("papel,nome,profissao,registro_profissional,uf_registro,numero_art,ordem")
      .eq("pgr_id", pgrId)
      .order("ordem"),
    (supabase.from as any)("pgr_inventario_itens").select("*").eq("pgr_id", pgrId),
    (supabase.from as any)("pgr_acoes").select("*").eq("pgr_id", pgrId),
    (supabase.from as any)("pgr_revisoes")
      .select("descricao,created_at")
      .eq("pgr_id", pgrId)
      .order("created_at", { ascending: false }),
    codigosDeGes(empresaId),
  ]);

  const itens = (inventario.data || []) as any[];
  const comCodigo = itens.map((i) => ({
    ...i,
    ges_codigo: ges[i.ges_id] ?? ges[i.ghe_id] ?? "",
  }));

  /* Setor e GES da ação vêm do item de inventário ao qual ela está ligada —
     é o item que sabe onde o risco está, não a ação. */
  const porItem: Record<string, { setor: string; ges_codigo: string }> = {};
  for (const i of comCodigo) porItem[i.id] = { setor: i.setor || "", ges_codigo: i.ges_codigo };

  return {
    empresa: empresa.data || {},
    pgr: pgr.data || {},
    responsaveis: responsaveis.data || [],
    inventario: comCodigo,
    acoes: ((acoes.data || []) as any[]).map((a) => ({
      ...a,
      setor: porItem[a.inventario_item_id]?.setor ?? "",
      ges_codigo: porItem[a.inventario_item_id]?.ges_codigo ?? "",
    })),
    descricaoRevisao: (revisoes.data || [])[0]?.descricao ?? null,
  };
}

/** Atalho: lê e já devolve o dados.json pronto para o gerador. */
export async function dadosDoPgr(pgrId: string, empresaId: string): Promise<DadosDocumento> {
  return montarDadosDocumento(await buscarFontesDoPgr(pgrId, empresaId));
}

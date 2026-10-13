import { supabase } from "@/integrations/supabase/client";
import { carregarLogoDataUrl } from "@/lib/logoParaPdf";
import { carregarEmissor, linhasDoEmissor } from "@/lib/emissorDocumentos";
import { criterioDoGrupo, setoresDoGrupo, nomeDoGrupo } from "@/lib/sstEstrutura";
import type { PgrPdfContext } from "@/lib/pgrPdf";
import type { PgrDocumento } from "@/lib/pgrTypes";

/**
 * Carrega todos os dados relacionais necessários para desenhar o PGR oficial em PDF.
 * Esta função é agnóstica de componentes React e pode ser invocada a partir de qualquer
 * ponto da aplicação (wizard, dashboard de emissão, abas de elaboração ou testes).
 */
export async function carregarPgrPdfContexto(pgr: PgrDocumento | any): Promise<PgrPdfContext> {
  if (!pgr || !pgr.id) {
    throw new Error("PGR inválido ou não informado para geração de PDF.");
  }

  const [emp, uni, inv, acoes, evid, rev, ghes, textos] = await Promise.all([
    (supabase.from as any)("empresa_config")
      .select("nome, cnpj, logo_url, telefone, email, endereco, logradouro, numero, bairro, cidade, uf, cep")
      .eq("id", pgr.empresa_id).maybeSingle(),
    pgr.unidade_id
      ? (supabase.from as any)("empresa_config").select("nome").eq("id", pgr.unidade_id).maybeSingle()
      : Promise.resolve({ data: null }),
    (supabase.from as any)("pgr_inventario_itens").select("*").eq("pgr_id", pgr.id).order("classificacao"),
    (supabase.from as any)("pgr_acoes").select("*").eq("pgr_id", pgr.id).neq("status", "cancelada").order("prazo"),
    (supabase.from as any)("pgr_acao_evidencias").select("*").eq("pgr_id", pgr.id),
    (supabase.from as any)("pgr_revisoes").select("*").eq("pgr_id", pgr.id).order("created_at", { ascending: false }),
    (supabase.from as any)("ghe_ges").select("id,nome,codigo").eq("empresa_id", pgr.empresa_id),
    (supabase.from as any)("pgr_textos").select("secao,conteudo").eq("pgr_id", pgr.id),
  ]);

  const ghesMap: Record<string, string> = {};
  const ghesInfo: Record<string, { codigo: string; nome: string }> = {};
  const ghesCodigos: Record<string, string> = {};
  (ghes.data || []).forEach((g: any) => {
    ghesMap[g.id] = g.nome;
    ghesInfo[g.id] = { codigo: g.codigo || "", nome: g.nome || "" };
    if (g.codigo) ghesCodigos[g.id] = g.codigo;
  });

  const textosMap: Record<string, string> = {};
  (textos.data || []).forEach((t: any) => {
    textosMap[t.secao] = t.conteudo || "";
  });

  // Identificação completa (matriz + filiais) e responsáveis técnicos
  const [unidadesRes, respRes, assinaturasRes] = await Promise.all([
    (supabase.from as any)("empresa_config")
      .select("id,nome,nome_fantasia,cnpj,cnae_principal,cnae_secundario,grau_risco,telefone,email,logradouro,numero,complemento,bairro,cidade,uf,cep,endereco,empresa_pai_id")
      .or(`id.eq.${pgr.empresa_id},empresa_pai_id.eq.${pgr.empresa_id}`),
    (supabase.from as any)("pgr_responsaveis")
      .select("papel,nome,cpf,profissao,registro_profissional,uf_registro,numero_art,ordem")
      .eq("pgr_id", pgr.id).order("ordem"),
    (supabase.from as any)("pgr_assinaturas")
      .select("*").eq("pgr_id", pgr.id).order("assinado_em", { ascending: false }),
  ]);

  const unidades = ((unidadesRes.data || []) as any[]).sort(
    (a, b) => (a.empresa_pai_id ? 1 : 0) - (b.empresa_pai_id ? 1 : 0),
  );

  const daEmpresa = async (tabela: string, ordem = "nome") => {
    const { data, error } = await (supabase.from as any)(tabela)
      .select("*").eq("empresa_id", pgr.empresa_id).order(ordem);
    return error ? [] : (data || []);
  };

  const [ambientes, processos, setores, gesCru, funcoes, atividades] = await Promise.all([
    daEmpresa("sst_ambientes"),
    daEmpresa("sst_processos"),
    daEmpresa("sst_setores"),
    daEmpresa("sst_ges", "codigo"),
    daEmpresa("sst_funcoes"),
    daEmpresa("sst_atividades"),
  ]);

  const [vincSetor, vincFuncao] = await Promise.all([
    (supabase.from as any)("ghe_setores").select("ghe_id, setor_id, nome").eq("empresa_id", pgr.empresa_id),
    (supabase.from as any)("ghe_funcoes").select("ghe_id, nome_funcao, funcao_id").eq("empresa_id", pgr.empresa_id),
  ]);

  const setorDaFuncaoId = new Map<string, string>();
  (funcoes as any[]).forEach((f: any) => {
    const nome = (setores as any[]).find((s: any) => s.id === f.setor_id)?.nome;
    if (nome) setorDaFuncaoId.set(f.id, nome);
  });

  const reservaPorGes = new Map<string, string>();
  ((vincSetor as any).data || []).forEach((v: any) => {
    const nome = v.nome || (setores as any[]).find((s: any) => s.id === v.setor_id)?.nome;
    if (nome && !reservaPorGes.has(v.ghe_id)) reservaPorGes.set(v.ghe_id, nome);
  });

  const setoresDaFuncaoPorGes = new Map<string, { setorNome: string | null }[]>();
  ((vincFuncao as any).data || []).forEach((v: any) => {
    if (!setoresDaFuncaoPorGes.has(v.ghe_id)) setoresDaFuncaoPorGes.set(v.ghe_id, []);
    setoresDaFuncaoPorGes.get(v.ghe_id)!.push({
      setorNome: v.funcao_id ? setorDaFuncaoId.get(v.funcao_id) ?? null : null,
    });
  });

  const funcoesPorGes = new Map<string, { nome: string }[]>();
  ((vincFuncao as any).data || []).forEach((v: any) => {
    if (!v.nome_funcao) return;
    if (!funcoesPorGes.has(v.ghe_id)) funcoesPorGes.set(v.ghe_id, []);
    funcoesPorGes.get(v.ghe_id)!.push({ nome: v.nome_funcao });
  });

  const gesDetalhes = (gesCru as any[]).map((g: any) => ({
    ...g,
    qtd_trabalhadores: g.quantidade_trabalhadores ?? g.qtd_trabalhadores ?? null,
    nome: nomeDoGrupo({
      armazenado: g.nome,
      codigo: g.codigo,
      setores: setoresDoGrupo(setoresDaFuncaoPorGes.get(g.id), reservaPorGes.get(g.id)),
    }),
    criterio_agrupamento: criterioDoGrupo({
      armazenado: g.criterio_agrupamento,
      setorNome: setoresDoGrupo(setoresDaFuncaoPorGes.get(g.id), reservaPorGes.get(g.id)),
      funcoes: funcoesPorGes.get(g.id),
    }),
  }));

  const classePorItem = new Map<string, string | null>();
  (inv.data || []).forEach((i: any) => classePorItem.set(i.id, i.classificacao ?? null));

  const acoesEnriquecidas = (acoes.data || []).map((a: any) => ({
    ...a,
    who: a.responsavel_nome ?? null,
    how_much: a.custo_estimado ?? null,
    classe_risco: a.inventario_item_id ? classePorItem.get(a.inventario_item_id) ?? null : null,
  }));

  const logoDataUrl = await carregarLogoDataUrl(emp.data?.logo_url ?? null);
  const emissor = await carregarEmissor();
  const emissorLogoDataUrl = await carregarLogoDataUrl(emissor?.logo_url ?? null);

  (gesCru || []).forEach((g: any) => {
    if (g?.id && g?.codigo && !ghesCodigos[g.id]) ghesCodigos[g.id] = g.codigo;
  });

  return {
    doc: pgr,
    empresaNome: emp.data?.nome ?? null,
    empresaCnpj: emp.data?.cnpj ?? null,
    logoDataUrl,
    emissorNome: emissor?.nome?.trim() || null,
    emissorLinhas: linhasDoEmissor(emissor),
    emissorLogoDataUrl,
    unidadeNome: uni?.data?.nome ?? null,
    inventario: inv.data || [],
    acoes: acoesEnriquecidas,
    evidencias: (evid.data || []).map((e: any) => ({
      id: e.id,
      acao_id: e.acao_id,
      nome_arquivo: e.nome_arquivo,
      uploaded_at: e.created_at,
      uploaded_by_email: e.uploaded_by_email,
      drive_view_link: e.drive_view_link,
    })),
    revisoes: rev.data || [],
    assinaturas: (assinaturasRes.data || []) as any[],
    ghes: ghesMap,
    ghesCodigos,
    textos: textosMap,
    unidades,
    responsaveis: respRes.data || [],
    ambientes,
    processos,
    setores,
    gesDetalhes,
    funcoes,
    atividades,
    codigoDocumento: `PGR-${(pgr.data_vigencia_inicio || pgr.data_emissao || "").slice(0, 4) || new Date().getFullYear()}-${String(pgr.id).slice(0, 8).toUpperCase()}`,
  };
}

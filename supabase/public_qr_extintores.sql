-- ---------------------------------------------------------------------
-- Políticas RLS para visualização pública e auditoria via QR Code
-- ---------------------------------------------------------------------

-- 1. Permite leitura pública (anon) das inspeções e manutenções do extintor
DROP POLICY IF EXISTS ext_inspecoes_anon_read ON public.extintor_inspecoes;
CREATE POLICY ext_inspecoes_anon_read ON public.extintor_inspecoes
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS ext_manutencoes_anon_read ON public.extintor_manutencoes;
CREATE POLICY ext_manutencoes_anon_read ON public.extintor_manutencoes
  FOR SELECT TO anon
  USING (true);

-- 2. Função pública de alta performance para consulta do Selo Digital QR
CREATE OR REPLACE FUNCTION public.extintor_consultar_qr(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ext record;
  v_empresa_nome text;
  v_inspecoes jsonb;
  v_manutencoes jsonb;
  v_resultado jsonb;
BEGIN
  -- Tenta localizar por qr_token (UUID) ou id (UUID)
  SELECT e.* INTO v_ext
  FROM public.extintores e
  WHERE (e.qr_token::text = p_token OR e.id::text = p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

  -- Busca o nome da empresa de forma segura
  SELECT nome INTO v_empresa_nome
  FROM public.empresa_config
  WHERE id = v_ext.empresa_id;

  -- Busca histórico completo de inspeções com todos os itens do checklist
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'data_inspecao', i.data_inspecao,
      'inspetor_nome', i.inspetor_nome,
      'resultado', i.resultado,
      'observacoes', i.observacoes,
      'foto_url', i.foto_url,
      'created_at', i.created_at,
      'acesso_desobstruido', i.acesso_desobstruido,
      'sinalizacao_conforme', i.sinalizacao_conforme,
      'altura_instalacao_conforme', i.altura_instalacao_conforme,
      'lacre_intacto', i.lacre_intacto,
      'pino_seguranca_presente', i.pino_seguranca_presente,
      'manometro_pressao_adequada', i.manometro_pressao_adequada,
      'manga_bico_sem_obstrucao', i.manga_bico_sem_obstrucao,
      'cilindro_sem_corrosao_ou_dano', i.cilindro_sem_corrosao_ou_dano,
      'rotulo_instrucoes_legivel', i.rotulo_instrucoes_legivel,
      'selo_inmetro_presente', i.selo_inmetro_presente,
      'quadro_demarcacao_piso_ok', i.quadro_demarcacao_piso_ok
    ) ORDER BY i.data_inspecao DESC, i.created_at DESC
  ), '[]'::jsonb) INTO v_inspecoes
  FROM public.extintor_inspecoes i
  WHERE i.extintor_id = v_ext.id;

  -- Busca histórico de manutenções / recargas / testes hidrostáticos
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'tipo', m.tipo,
      'tipo_servico', m.tipo_servico,
      'data_manutencao', m.data_manutencao,
      'data_validade_etiqueta', m.data_validade_etiqueta,
      'data_proxima_prevista', m.data_proxima_prevista,
      'empresa_prestadora', m.empresa_prestadora,
      'numero_os', m.numero_os,
      'selo_inmetro', coalesce(m.numero_novo_selo_inmetro, m.selo_inmetro),
      'laudo_url', m.laudo_url,
      'observacoes', m.observacoes
    ) ORDER BY m.data_manutencao DESC, m.created_at DESC
  ), '[]'::jsonb) INTO v_manutencoes
  FROM public.extintor_manutencoes m
  WHERE m.extintor_id = v_ext.id;

  -- Monta objeto final
  v_resultado := jsonb_build_object(
    'encontrado', true,
    'extintor', to_jsonb(v_ext),
    'empresa_nome', coalesce(v_empresa_nome, 'Empresa Cadastrada'),
    'inspecoes', v_inspecoes,
    'manutencoes', v_manutencoes
  );

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.extintor_consultar_qr(text) TO anon, authenticated;

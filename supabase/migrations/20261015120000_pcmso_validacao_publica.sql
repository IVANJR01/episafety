-- Conferência pública do PCMSO pelo QR Code impresso no rodapé.
--
-- O QR já era impresso em todo PCMSO e apontava para /pcmso/validar/<id> —
-- um endereço que NÃO EXISTIA no sistema. Quem lia o QR caía na tela de
-- "página não encontrada", e o código no rodapé não provava coisa nenhuma.
--
-- Esta função é a parte pública: devolve SÓ o que identifica o documento —
-- empresa, revisão, vigência, médico coordenador e o hash do arquivo, que é o
-- que se confere com o rodapé impresso.
--
-- O que ela NÃO devolve, de propósito: nada do conteúdo do PCMSO. Fichas de
-- exame, riscos por setor e dados de colaboradores são informação de saúde e
-- continuam restritos a quem tem acesso à empresa.
--
-- Documento inexistente devolve {"encontrado": false} em vez de erro: quem
-- digitou o código errado precisa de uma resposta, não de uma tela quebrada.

CREATE OR REPLACE FUNCTION public.pcmso_validar_publico(_pcmso_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $body$
DECLARE _doc public.pcmso_documentos%ROWTYPE; _emp TEXT; _uni TEXT;
BEGIN
  SELECT * INTO _doc FROM public.pcmso_documentos WHERE id = _pcmso_id;
  IF _doc.id IS NULL THEN RETURN jsonb_build_object('encontrado', false); END IF;

  SELECT nome INTO _emp FROM public.empresa_config WHERE id = _doc.empresa_id;
  IF _doc.unidade_id IS NOT NULL THEN
    SELECT nome INTO _uni FROM public.empresa_config WHERE id = _doc.unidade_id;
  END IF;

  RETURN jsonb_build_object(
    'encontrado', true,
    'empresa_nome', _emp,
    'unidade_nome', _uni,
    'versao', _doc.versao,
    'status', _doc.status,
    'data_emissao', _doc.data_emissao,
    'data_vigencia_inicio', _doc.data_vigencia_inicio,
    'data_vigencia_fim', _doc.data_vigencia_fim,
    'medico_nome', _doc.medico_nome,
    'medico_crm', _doc.medico_crm,
    'medico_uf', _doc.medico_uf,
    'pdf_hash', _doc.pdf_hash,
    'pdf_gerado_em', _doc.pdf_gerado_em
  );
END $body$;

-- É esta linha que faz o QR funcionar para quem não tem conta.
GRANT EXECUTE ON FUNCTION public.pcmso_validar_publico(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.pcmso_validar_publico(UUID) IS
  'Conferência pública do PCMSO pelo QR Code do rodapé. Devolve apenas a identificação do documento; o conteúdo (fichas de exame, riscos, colaboradores) continua restrito.';

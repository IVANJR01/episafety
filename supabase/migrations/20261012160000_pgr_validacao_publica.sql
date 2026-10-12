-- Conferência pública do PGR pelo QR Code impresso no rodapé.
--
-- O QR existia e a página existia, mas a rota estava dentro do bloco logado:
-- quem lia o QR com o papel na mão caía na tela de senha. Um QR que pede senha
-- não prova nada — e provar autenticidade é a única razão de ele estar no
-- documento.
--
-- `pgr_validar_interno` continua como está, exigindo login e acesso à empresa.
-- Esta função é a versão pública e devolve SÓ o que identifica o documento:
-- empresa, revisão, datas, responsável técnico e os dados do arquivo (versão,
-- quando foi gerado e o hash, que é o que se confere com o rodapé impresso).
--
-- O que ela NÃO devolve, de propósito:
--   - nada do conteúdo do PGR (inventário, perigos, plano de ação);
--   - o link do arquivo no Drive, que é endereço interno.
--
-- Documento inexistente devolve {"encontrado": false} em vez de erro: quem
-- digitou o código errado precisa de uma resposta, não de uma tela quebrada.

CREATE OR REPLACE FUNCTION public.pgr_validar_publico(_pgr_id UUID, _pdf_versao INT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $body$
DECLARE _doc public.pgr_documentos%ROWTYPE; _v public.pgr_pdf_versoes%ROWTYPE;
        _ultima public.pgr_pdf_versoes%ROWTYPE; _emp TEXT; _uni TEXT;
BEGIN
  SELECT * INTO _doc FROM public.pgr_documentos WHERE id = _pgr_id;
  IF _doc.id IS NULL THEN RETURN jsonb_build_object('encontrado', false); END IF;

  SELECT nome INTO _emp FROM public.empresa_config WHERE id = _doc.empresa_id;
  IF _doc.unidade_id IS NOT NULL THEN
    SELECT nome INTO _uni FROM public.empresa_config WHERE id = _doc.unidade_id;
  END IF;

  SELECT * INTO _ultima FROM public.pgr_pdf_versoes
    WHERE pgr_id = _pgr_id ORDER BY pdf_versao DESC LIMIT 1;
  IF _pdf_versao IS NOT NULL THEN
    SELECT * INTO _v FROM public.pgr_pdf_versoes
      WHERE pgr_id = _pgr_id AND pdf_versao = _pdf_versao;
  ELSE
    _v := _ultima;
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
    'resp_tec_nome', _doc.resp_tec_nome,
    'resp_tec_registro', _doc.resp_tec_registro,
    'pdf', CASE WHEN _v.id IS NULL THEN NULL ELSE jsonb_build_object(
      'pdf_versao', _v.pdf_versao,
      'pdf_hash', _v.pdf_hash,
      'gerado_em', _v.gerado_em,
      'com_marca_dagua', _v.com_marca_dagua,
      'status_no_momento', _v.status_no_momento
    ) END,
    'versao_pedida', _pdf_versao,
    'ultima_pdf_versao', _ultima.pdf_versao,
    'eh_ultima_pdf', COALESCE(_v.id = _ultima.id, false)
  );
END $body$;

-- É esta linha que faz o QR funcionar para quem não tem conta.
GRANT EXECUTE ON FUNCTION public.pgr_validar_publico(UUID, INT) TO anon, authenticated;

COMMENT ON FUNCTION public.pgr_validar_publico(UUID, INT) IS
  'Conferência pública do PGR pelo QR Code do rodapé. Devolve apenas a identificação do documento; o conteúdo do PGR continua restrito a pgr_validar_interno.';

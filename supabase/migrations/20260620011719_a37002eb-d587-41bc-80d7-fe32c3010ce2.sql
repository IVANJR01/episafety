
-- Add PDF columns
ALTER TABLE public.cat_comunicacoes
  ADD COLUMN IF NOT EXISTS pdf_versao integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pdf_drive_view_link text;

-- Allow 'pdf_cat' category on anexos
ALTER TABLE public.cat_anexos DROP CONSTRAINT IF EXISTS cat_anexos_categoria_check;
ALTER TABLE public.cat_anexos ADD CONSTRAINT cat_anexos_categoria_check
  CHECK (categoria IN ('boletim_ocorrencia','atestado_medico','aso_relacionado','foto_local','laudo','outros','pdf_cat'));

-- Function to register a generated PDF atomically with tenant guard
CREATE OR REPLACE FUNCTION public.cat_registrar_pdf(
  _cat_id uuid,
  _drive_file_id text,
  _drive_view_link text,
  _drive_path text,
  _nome_arquivo text,
  _tamanho_bytes bigint,
  _pdf_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cat RECORD;
  _nova_versao int;
  _anexo_id uuid;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, empresa_id, numero_cat, status, pdf_versao
    INTO _cat
  FROM public.cat_comunicacoes
  WHERE id = _cat_id;

  IF _cat.id IS NULL THEN
    RAISE EXCEPTION 'CAT não encontrada';
  END IF;

  IF NOT (public.is_super_admin(auth.uid())
          OR public.is_principal(auth.uid())
          OR public.is_in_user_company_tree(auth.uid(), _cat.empresa_id)) THEN
    RAISE EXCEPTION 'Sem permissão para gerar PDF desta empresa';
  END IF;

  IF _cat.status = 'cancelada' THEN
    RAISE EXCEPTION 'CAT cancelada — não é possível gerar PDF';
  END IF;

  _nova_versao := COALESCE(_cat.pdf_versao, 0) + 1;

  UPDATE public.cat_comunicacoes
     SET pdf_drive_file_id = _drive_file_id,
         pdf_drive_view_link = _drive_view_link,
         pdf_hash = _pdf_hash,
         pdf_gerado_em = now(),
         pdf_versao = _nova_versao,
         updated_at = now()
   WHERE id = _cat_id;

  INSERT INTO public.cat_anexos (
    cat_id, empresa_id, categoria, nome_arquivo, mime_type, tamanho_bytes,
    drive_file_id, drive_path, uploaded_by
  ) VALUES (
    _cat_id, _cat.empresa_id, 'pdf_cat', _nome_arquivo, 'application/pdf', _tamanho_bytes,
    _drive_file_id, _drive_path, auth.uid()
  ) RETURNING id INTO _anexo_id;

  INSERT INTO public.cat_historico (
    cat_id, empresa_id, status_anterior, status_novo, acao, motivo, user_id, user_email
  ) VALUES (
    _cat_id, _cat.empresa_id, _cat.status, _cat.status,
    'pdf_gerado',
    'PDF v' || _nova_versao || ' (hash ' || left(_pdf_hash, 12) || '…)',
    auth.uid(), NULLIF(_email,'')
  );

  RETURN jsonb_build_object(
    'success', true,
    'versao', _nova_versao,
    'anexo_id', _anexo_id,
    'numero_cat', _cat.numero_cat
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cat_registrar_pdf(uuid, text, text, text, text, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cat_registrar_pdf(uuid, text, text, text, text, bigint, text) TO authenticated;

-- Function to log download/view of PDF
CREATE OR REPLACE FUNCTION public.cat_registrar_pdf_download(_cat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cat RECORD;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  SELECT id, empresa_id, status, pdf_versao INTO _cat
    FROM public.cat_comunicacoes WHERE id = _cat_id;
  IF _cat.id IS NULL THEN
    RAISE EXCEPTION 'CAT não encontrada';
  END IF;
  IF NOT (public.is_super_admin(auth.uid())
          OR public.is_principal(auth.uid())
          OR public.is_in_user_company_tree(auth.uid(), _cat.empresa_id)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.cat_historico (
    cat_id, empresa_id, status_anterior, status_novo, acao, motivo, user_id, user_email
  ) VALUES (
    _cat_id, _cat.empresa_id, _cat.status, _cat.status,
    'pdf_download',
    'Download PDF v' || COALESCE(_cat.pdf_versao,0),
    auth.uid(), NULLIF(_email,'')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.cat_registrar_pdf_download(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cat_registrar_pdf_download(uuid) TO authenticated;

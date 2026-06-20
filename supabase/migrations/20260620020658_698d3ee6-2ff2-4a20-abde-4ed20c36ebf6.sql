
-- 1) Anexar audit_trigger a esocial_eventos_s2210 (a função já redacta XML)
DROP TRIGGER IF EXISTS trg_audit_esocial_eventos_s2210 ON public.esocial_eventos_s2210;
CREATE TRIGGER trg_audit_esocial_eventos_s2210
AFTER INSERT OR UPDATE OR DELETE ON public.esocial_eventos_s2210
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- 2) Trigger BEFORE UPDATE: bloqueia mutação direta de evento aceito/excluído
CREATE OR REPLACE FUNCTION public.esocial_evt_immutable_after_aceito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Permite somente transição de status controlada para 'retificar' (vinda da RPC esocial_iniciar_retificacao)
  IF OLD.status = 'aceito'::public.esocial_evento_status THEN
    IF NEW.status = OLD.status THEN
      RAISE EXCEPTION 'Evento eSocial % aceito não pode ser alterado diretamente. Use esocial_iniciar_retificacao.', OLD.id;
    END IF;
    IF NEW.status NOT IN ('retificar'::public.esocial_evento_status) THEN
      RAISE EXCEPTION 'Transição inválida a partir de aceito → %', NEW.status;
    END IF;
    -- Mesmo na transição para 'retificar', proibir alterar XML/hash/conteúdo
    IF NEW.xml_gerado IS DISTINCT FROM OLD.xml_gerado
       OR NEW.xml_hash_sha256 IS DISTINCT FROM OLD.xml_hash_sha256
       OR NEW.cat_id IS DISTINCT FROM OLD.cat_id
       OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
      RAISE EXCEPTION 'Conteúdo de evento aceito é imutável';
    END IF;
  END IF;

  IF OLD.status = 'excluido'::public.esocial_evento_status THEN
    RAISE EXCEPTION 'Evento eSocial marcado como excluído é imutável';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_esocial_evt_immutable ON public.esocial_eventos_s2210;
CREATE TRIGGER trg_esocial_evt_immutable
BEFORE UPDATE ON public.esocial_eventos_s2210
FOR EACH ROW EXECUTE FUNCTION public.esocial_evt_immutable_after_aceito();

-- 3) esocial_config: tipo e número de inscrição
ALTER TABLE public.esocial_config
  ADD COLUMN IF NOT EXISTS tp_insc smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nr_insc text;
COMMENT ON COLUMN public.esocial_config.tp_insc IS '1=CNPJ, 2=CPF, 3=CAEPF, 4=CNO (eSocial)';

-- 4) Catálogos: preencher codigo_esocial inicial (Tabelas oficiais S-1.3)
-- Tabela 13 — Partes Atingidas (MOS reduzido + comuns)
UPDATE public.cat_partes_atingidas SET codigo_esocial = CASE codigo
  WHEN '010' THEN '100'  -- Cabeça
  WHEN '020' THEN '120'  -- Olho
  WHEN '030' THEN '110'  -- Face
  WHEN '040' THEN '210'  -- Pescoço
  WHEN '050' THEN '310'  -- Tórax
  WHEN '060' THEN '320'  -- Abdômen
  WHEN '070' THEN '220'  -- Coluna vertebral
  WHEN '080' THEN '400'  -- Membro superior
  WHEN '090' THEN '430'  -- Mão
  WHEN '100' THEN '440'  -- Dedo da mão
  WHEN '110' THEN '500'  -- Membro inferior
  WHEN '120' THEN '530'  -- Pé
  WHEN '130' THEN '540'  -- Dedo do pé
  WHEN '140' THEN '900'  -- Múltiplas partes
  WHEN '999' THEN '950'  -- Outros / não classificável
END WHERE codigo_esocial IS NULL;

-- Tabela 14 — Agentes Causadores (códigos oficiais resumidos)
UPDATE public.cat_agentes_causadores SET codigo_esocial = CASE codigo
  WHEN '010' THEN '01010'  -- Máquinas e equipamentos
  WHEN '020' THEN '02010'  -- Ferramentas manuais
  WHEN '030' THEN '03010'  -- Veículos de transporte
  WHEN '040' THEN '04010'  -- Substâncias químicas
  WHEN '050' THEN '05010'  -- Eletricidade
  WHEN '060' THEN '06010'  -- Estruturas e superfícies
  WHEN '070' THEN '07010'  -- Animais
  WHEN '080' THEN '08010'  -- Agentes biológicos
  WHEN '090' THEN '09010'  -- Radiações
  WHEN '100' THEN '09020'  -- Ruído
  WHEN '110' THEN '09030'  -- Temperaturas extremas
  WHEN '999' THEN '99999'  -- Outros
END WHERE codigo_esocial IS NULL;

-- Tabela 15 — Natureza da Lesão
UPDATE public.cat_naturezas_lesao SET codigo_esocial = CASE codigo
  WHEN '010' THEN '110'  -- Escoriação/abrasão
  WHEN '020' THEN '120'  -- Corte/laceração
  WHEN '030' THEN '210'  -- Contusão/esmagamento
  WHEN '040' THEN '410'  -- Fratura
  WHEN '050' THEN '420'  -- Luxação
  WHEN '060' THEN '430'  -- Entorse
  WHEN '070' THEN '510'  -- Queimadura
  WHEN '080' THEN '710'  -- Amputação
  WHEN '090' THEN '610'  -- Intoxicação
  WHEN '100' THEN '520'  -- Choque elétrico
  WHEN '110' THEN '620'  -- Asfixia
  WHEN '120' THEN '450'  -- LER/DORT
  WHEN '130' THEN '810'  -- Trauma psicológico
  WHEN '999' THEN '990'  -- Outros
END WHERE codigo_esocial IS NULL;

-- Tabela 16 — Situação Geradora (códigos oficiais)
UPDATE public.cat_situacoes_geradoras SET codigo_esocial = CASE codigo
  WHEN '010' THEN '110'
  WHEN '020' THEN '120'
  WHEN '030' THEN '210'
  WHEN '040' THEN '310'
  WHEN '050' THEN '320'
  WHEN '060' THEN '410'
  WHEN '070' THEN '510'
  WHEN '080' THEN '520'
  WHEN '090' THEN '530'
  WHEN '100' THEN '220'
  WHEN '110' THEN '610'
  WHEN '120' THEN '710'
  WHEN '130' THEN '720'
  WHEN '999' THEN '990'
END WHERE codigo_esocial IS NULL;

-- 5) RPC: upsert seguro de esocial_config
CREATE OR REPLACE FUNCTION public.esocial_config_upsert(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _empresa_id uuid := (_payload->>'empresa_id')::uuid;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _empresa_id IS NULL THEN RAISE EXCEPTION 'empresa_id obrigatório'; END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['cat:esocial'] OR modulos_permitidos @> ARRAY['cat'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão cat:esocial requerida'; END IF;
  END IF;

  INSERT INTO public.esocial_config(
    empresa_id, tp_amb, ver_proc, cnpj_raiz, tp_insc, nr_insc,
    certificado_alias, certificado_validade, ativo, observacoes,
    created_by, updated_by
  ) VALUES (
    _empresa_id,
    COALESCE((_payload->>'tp_amb')::public.esocial_tp_amb, 'homologacao'::public.esocial_tp_amb),
    COALESCE(_payload->>'ver_proc', 'EpiSafety-1.0'),
    NULLIF(_payload->>'cnpj_raiz',''),
    COALESCE((_payload->>'tp_insc')::smallint, 1),
    NULLIF(_payload->>'nr_insc',''),
    NULLIF(_payload->>'certificado_alias',''),
    NULLIF(_payload->>'certificado_validade','')::date,
    COALESCE((_payload->>'ativo')::boolean, true),
    NULLIF(_payload->>'observacoes',''),
    auth.uid(), auth.uid()
  )
  ON CONFLICT (empresa_id) DO UPDATE SET
    tp_amb = EXCLUDED.tp_amb,
    ver_proc = EXCLUDED.ver_proc,
    cnpj_raiz = EXCLUDED.cnpj_raiz,
    tp_insc = EXCLUDED.tp_insc,
    nr_insc = EXCLUDED.nr_insc,
    certificado_alias = EXCLUDED.certificado_alias,
    certificado_validade = EXCLUDED.certificado_validade,
    ativo = EXCLUDED.ativo,
    observacoes = EXCLUDED.observacoes,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO _id;

  -- Audit em historico (sem XML)
  INSERT INTO public.esocial_eventos_historico(
    evento_id, empresa_id, acao, status_anterior, status_novo,
    metadados, user_id, user_email
  ) VALUES (
    NULL, _empresa_id, 'config_alterada'::public.esocial_acao_hist, NULL, NULL,
    jsonb_build_object(
      'tp_amb', _payload->>'tp_amb',
      'tp_insc', _payload->>'tp_insc',
      'ativo', _payload->>'ativo',
      'certificado_alias', _payload->>'certificado_alias'
    ),
    auth.uid(), NULLIF(_email,'')
  );

  RETURN jsonb_build_object('success', true, 'id', _id);
END;
$$;

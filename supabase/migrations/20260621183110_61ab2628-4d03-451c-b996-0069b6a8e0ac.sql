CREATE OR REPLACE FUNCTION public.s2240_evt_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'empresa_id de evento S-2240 é imutável';
  END IF;
  IF OLD.status IN ('validado_stub','homologacao_stub','simulado')
     AND NEW.status = OLD.status
     AND (NEW.data_inicio_condicao IS DISTINCT FROM OLD.data_inicio_condicao
       OR NEW.data_fim_condicao IS DISTINCT FROM OLD.data_fim_condicao
       OR NEW.cpf_trabalhador IS DISTINCT FROM OLD.cpf_trabalhador
       OR NEW.matricula IS DISTINCT FROM OLD.matricula
       OR NEW.cbo IS DISTINCT FROM OLD.cbo
       OR NEW.xml_sha256 IS DISTINCT FROM OLD.xml_sha256) THEN
    RAISE EXCEPTION 'evento S-2240 em status % é imutável; use fluxo de retificação', OLD.status;
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.s2240_hist_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'esocial_s2240_historico é append-only'; END;$$;

CREATE OR REPLACE FUNCTION public.s2240_ocor_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'esocial_s2240_ocorrencias é append-only'; END;$$;

CREATE OR REPLACE FUNCTION public.s2240_log_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.esocial_s2240_historico(evento_id, empresa_id, status_anterior, status_novo, acao, user_id)
    VALUES (NEW.id, NEW.empresa_id, NULL, NEW.status, 'criado', auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.esocial_s2240_historico(evento_id, empresa_id, status_anterior, status_novo, acao, user_id)
    VALUES (NEW.id, NEW.empresa_id, OLD.status, NEW.status, 'mudanca_status', auth.uid());
  END IF;
  RETURN NEW;
END;$$;
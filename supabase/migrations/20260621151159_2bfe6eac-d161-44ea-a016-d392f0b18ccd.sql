
-- LTCAT Parte 4 — Conclusões previdenciárias: complementos
ALTER TABLE public.ltcat_funcoes
  ADD COLUMN IF NOT EXISTS numero_trabalhadores integer,
  ADD COLUMN IF NOT EXISTS observacoes text;

ALTER TABLE public.ltcat_conclusoes
  ADD COLUMN IF NOT EXISTS tipo_exposicao text,
  ADD COLUMN IF NOT EXISTS enquadramento public.ltcat_enquadramento,
  ADD COLUMN IF NOT EXISTS epi_considerados text,
  ADD COLUMN IF NOT EXISTS epc_considerados text,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- Trigger de validação previdenciária
CREATE OR REPLACE FUNCTION public.ltcat_conclusao_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _ags jsonb := COALESCE(NEW.agentes_considerados, '[]'::jsonb);
  _aal text;
BEGIN
  IF jsonb_array_length(_ags) < 1 THEN
    RAISE EXCEPTION 'Conclusão deve listar ao menos um agente considerado';
  END IF;

  IF NEW.conclusao IN ('especial_15','especial_20','especial_25') THEN
    IF NEW.fundamento_legal IS NULL OR length(btrim(NEW.fundamento_legal)) < 10 THEN
      RAISE EXCEPTION 'Conclusão de aposentadoria especial exige fundamento legal (mín. 10 caracteres)';
    END IF;
    -- MFA obrigatório
    _aal := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'aal','aal1');
    IF _aal <> 'aal2' THEN
      RAISE EXCEPTION 'MFA (AAL2) obrigatório para registrar conclusão de aposentadoria especial';
    END IF;
  END IF;

  IF NEW.conclusao = 'inconclusivo' THEN
    IF NEW.justificativa IS NULL OR length(btrim(NEW.justificativa)) < 10 THEN
      RAISE EXCEPTION 'Conclusão inconclusiva exige justificativa técnica (mín. 10 caracteres)';
    END IF;
  END IF;

  -- Se não-especial e há agente considerado acima do limite, exigir justificativa robusta
  IF NEW.conclusao = 'nao_especial' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(_ags) a
      WHERE COALESCE((a->>'acima_limite')::boolean,false) = true
    ) THEN
      IF NEW.justificativa IS NULL OR length(btrim(NEW.justificativa)) < 30 THEN
        RAISE EXCEPTION 'Conclusão "não especial" com agente acima do limite exige justificativa técnica robusta (mín. 30 caracteres)';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ltcat_conclusao_validate ON public.ltcat_conclusoes;
CREATE TRIGGER trg_ltcat_conclusao_validate
BEFORE INSERT OR UPDATE ON public.ltcat_conclusoes
FOR EACH ROW EXECUTE FUNCTION public.ltcat_conclusao_validate();

REVOKE EXECUTE ON FUNCTION public.ltcat_conclusao_validate() FROM PUBLIC, anon;

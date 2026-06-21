
CREATE OR REPLACE FUNCTION public.ppp_child_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _st public.ppp_status;
BEGIN
  _st := public.ppp_doc_status( COALESCE(NEW.ppp_id, OLD.ppp_id) );
  IF _st IN ('vigente','substituido','arquivado') THEN
    RAISE EXCEPTION 'PPP em status % é imutável (tabela %).', _st, TG_TABLE_NAME;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;

CREATE OR REPLACE FUNCTION public.ppp_rev_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'ppp_revisoes é append-only'; END;$$;

CREATE OR REPLACE FUNCTION public.ppp_pdfv_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'ppp_pdf_versoes é append-only'; END;$$;

CREATE OR REPLACE FUNCTION public.ppp_assin_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'ppp_assinaturas é append-only'; END;$$;

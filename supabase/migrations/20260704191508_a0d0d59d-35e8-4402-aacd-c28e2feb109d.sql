
-- 1) Fix search_path on append-only trigger functions
CREATE OR REPLACE FUNCTION public.ltcat_assin_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN RAISE EXCEPTION 'ltcat_assinaturas é append-only'; END; $$;

CREATE OR REPLACE FUNCTION public.ltcat_pdfv_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN RAISE EXCEPTION 'ltcat_pdf_versoes é append-only'; END; $$;

CREATE OR REPLACE FUNCTION public.ltcat_revisoes_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN RAISE EXCEPTION 'ltcat_revisoes é append-only'; END; $$;

CREATE OR REPLACE FUNCTION public.pgr_pdfv_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN RAISE EXCEPTION 'pgr_pdf_versoes é append-only'; END; $$;

-- 2) Explicit deny policy on edge_rate_limit (service_role bypasses RLS anyway)
DROP POLICY IF EXISTS "edge_rate_limit_no_client_access" ON public.edge_rate_limit;
CREATE POLICY "edge_rate_limit_no_client_access"
ON public.edge_rate_limit
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

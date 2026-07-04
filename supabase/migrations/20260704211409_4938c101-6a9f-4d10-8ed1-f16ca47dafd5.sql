CREATE TABLE IF NOT EXISTS public.termos_aceites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NULL,
  versao_termos text NOT NULL,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  user_agent text NULL,
  ip text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS termos_aceites_user_versao_uidx
  ON public.termos_aceites(user_id, versao_termos);

CREATE INDEX IF NOT EXISTS termos_aceites_user_idx
  ON public.termos_aceites(user_id);

GRANT SELECT, INSERT ON public.termos_aceites TO authenticated;
GRANT ALL ON public.termos_aceites TO service_role;

ALTER TABLE public.termos_aceites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem seus proprios aceites"
  ON public.termos_aceites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios registram seus proprios aceites"
  ON public.termos_aceites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
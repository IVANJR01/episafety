
CREATE TABLE public.usuarios_liberados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nome text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.usuarios_liberados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read usuarios_liberados" ON public.usuarios_liberados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth insert usuarios_liberados" ON public.usuarios_liberados
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth delete usuarios_liberados" ON public.usuarios_liberados
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Anon can check email" ON public.usuarios_liberados
  FOR SELECT TO anon USING (true);

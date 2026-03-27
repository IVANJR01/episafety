
CREATE TABLE public.requisitos_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresa_config(id),
  nome_cliente text NOT NULL DEFAULT 'Neoenergia',
  curso_nome text NOT NULL,
  sinonimos text[] DEFAULT '{}',
  carga_horaria_minima integer NOT NULL DEFAULT 0,
  validade_meses integer NOT NULL DEFAULT 12,
  funcoes_exigidas text[] DEFAULT '{}',
  descricao text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.requisitos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view requisitos of their company"
  ON public.requisitos_cliente FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id(auth.uid())
    OR empresa_id IN (SELECT id FROM empresa_config WHERE empresa_pai_id = public.get_user_empresa_id(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert requisitos"
  ON public.requisitos_cliente FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id(auth.uid())
    OR empresa_id IN (SELECT id FROM empresa_config WHERE empresa_pai_id = public.get_user_empresa_id(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update requisitos"
  ON public.requisitos_cliente FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id(auth.uid())
    OR empresa_id IN (SELECT id FROM empresa_config WHERE empresa_pai_id = public.get_user_empresa_id(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete requisitos"
  ON public.requisitos_cliente FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id(auth.uid())
    OR empresa_id IN (SELECT id FROM empresa_config WHERE empresa_pai_id = public.get_user_empresa_id(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );

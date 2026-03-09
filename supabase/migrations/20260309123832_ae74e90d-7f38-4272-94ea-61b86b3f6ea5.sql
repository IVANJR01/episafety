
-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'tecnico', 'usuario');
CREATE TYPE public.tipo_entrega AS ENUM ('entrega', 'troca', 'devolucao');
CREATE TYPE public.status_entrega AS ENUM ('ativo', 'devolvido', 'trocado');
CREATE TYPE public.status_inspecao AS ENUM ('pendente', 'em_andamento', 'concluida');
CREATE TYPE public.status_treinamento AS ENUM ('agendado', 'realizado', 'cancelado');
CREATE TYPE public.status_ordem AS ENUM ('emitida', 'assinada', 'cancelada');
CREATE TYPE public.tipo_exame AS ENUM ('admissional', 'periodico', 'demissional', 'retorno', 'mudanca_funcao');
CREATE TYPE public.resultado_exame AS ENUM ('apto', 'inapto', 'apto_com_restricao', 'pendente');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Funcionarios
CREATE TABLE public.funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  matricula TEXT,
  setor TEXT,
  cargo TEXT,
  data_admissao DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

-- EPIs
CREATE TABLE public.epis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ca TEXT,
  validade DATE,
  estoque INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 5,
  categoria TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.epis ENABLE ROW LEVEL SECURITY;

-- Entregas
CREATE TABLE public.entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  epi_id UUID NOT NULL REFERENCES public.epis(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 1,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo tipo_entrega NOT NULL DEFAULT 'entrega',
  observacao TEXT,
  status status_entrega NOT NULL DEFAULT 'ativo',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

-- Inspecoes
CREATE TABLE public.inspecoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  local TEXT,
  responsavel TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status status_inspecao NOT NULL DEFAULT 'pendente',
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inspecoes ENABLE ROW LEVEL SECURITY;

-- Inspecao itens
CREATE TABLE public.inspecao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspecao_id UUID NOT NULL REFERENCES public.inspecoes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  conforme BOOLEAN,
  observacao TEXT
);
ALTER TABLE public.inspecao_itens ENABLE ROW LEVEL SECURITY;

-- Treinamentos
CREATE TABLE public.treinamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  instrutor TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  carga_horaria INTEGER NOT NULL DEFAULT 0,
  validade DATE,
  status status_treinamento NOT NULL DEFAULT 'agendado',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.treinamentos ENABLE ROW LEVEL SECURITY;

-- Treinamento participantes
CREATE TABLE public.treinamento_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treinamento_id UUID NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  UNIQUE(treinamento_id, funcionario_id)
);
ALTER TABLE public.treinamento_participantes ENABLE ROW LEVEL SECURITY;

-- Ordens de servico
CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  funcionario_id UUID REFERENCES public.funcionarios(id),
  setor TEXT,
  riscos TEXT,
  epis TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status status_ordem NOT NULL DEFAULT 'emitida',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

-- Exames
CREATE TABLE public.exames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo tipo_exame NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  resultado resultado_exame NOT NULL DEFAULT 'pendente',
  medico TEXT,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exames ENABLE ROW LEVEL SECURITY;

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_funcionarios_updated_at BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_epis_updated_at BEFORE UPDATE ON public.epis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inspecoes_updated_at BEFORE UPDATE ON public.inspecoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_treinamentos_updated_at BEFORE UPDATE ON public.treinamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ordens_servico_updated_at BEFORE UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'usuario');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Stock adjustment trigger
CREATE OR REPLACE FUNCTION public.adjust_epi_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo IN ('entrega', 'troca') THEN
    UPDATE public.epis SET estoque = estoque - NEW.quantidade WHERE id = NEW.epi_id;
  ELSIF NEW.tipo = 'devolucao' THEN
    UPDATE public.epis SET estoque = estoque + NEW.quantidade WHERE id = NEW.epi_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_entrega_created
  AFTER INSERT ON public.entregas
  FOR EACH ROW EXECUTE FUNCTION public.adjust_epi_stock();

-- RLS Policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Data tables policies
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['funcionarios','epis','entregas','inspecoes','inspecao_itens','treinamentos','treinamento_participantes','ordens_servico','exames'])
  LOOP
    EXECUTE format('CREATE POLICY "Auth read %s" ON public.%I FOR SELECT TO authenticated USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Auth insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Auth update %s" ON public.%I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Auth delete %s" ON public.%I FOR DELETE TO authenticated USING (true)', tbl, tbl);
  END LOOP;
END $$;

-- MIGRATION: NÚCLEO MESTRE DE DOCUMENTAÇÃO SST (FASE 1)
-- DATA: 2026-07-26
-- DESCRICAO: Criação da estrutura organizacional, GES/GHE transversal, catálogo de perigos e matriz mestre de exposições com RLS.

-- 1. ESTABELECIMENTOS / UNIDADES
CREATE TABLE IF NOT EXISTS public.sst_estabelecimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'proprio' CHECK (tipo IN ('proprio', 'terceiro', 'obra', 'administrativo')),
    cnpj VARCHAR(18),
    cno VARCHAR(20),
    cnae_principal VARCHAR(10),
    grau_risco INTEGER CHECK (grau_risco BETWEEN 1 AND 4),
    endereco JSONB DEFAULT '{}'::jsonb,
    responsavel_legal JSONB DEFAULT '{}'::jsonb,
    qtd_trabalhadores INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. AMBIENTES DE TRABALHO
CREATE TABLE IF NOT EXISTS public.sst_ambientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
    estabelecimento_id UUID REFERENCES public.sst_estabelecimentos(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    tipo_ambiente VARCHAR(50) DEFAULT 'interno' CHECK (tipo_ambiente IN ('interno', 'externo', 'misto', 'confinado')),
    pe_direito VARCHAR(50),
    piso TEXT,
    paredes TEXT,
    cobertura TEXT,
    ventilacao TEXT,
    iluminacao TEXT,
    climatizacao TEXT,
    maquinas_instalacoes TEXT,
    fotos_urls JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. SETORES
CREATE TABLE IF NOT EXISTS public.sst_setores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
    ambiente_id UUID REFERENCES public.sst_ambientes(id) ON DELETE SET NULL,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    responsavel_setor VARCHAR(255),
    jornada_turnos TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PROCESSOS E ATIVIDADES
CREATE TABLE IF NOT EXISTS public.sst_processos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
    setor_id UUID NOT NULL REFERENCES public.sst_setores(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    descricao_etapas TEXT,
    maquinas_equipamentos TEXT,
    produtos_quimicos TEXT,
    frequencia VARCHAR(50),
    caracteristica_atividade VARCHAR(50) DEFAULT 'rotineira' CHECK (caracteristica_atividade IN ('rotineira', 'nao_rotineira', 'emergencia')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. FUNÇÕES / CARGOS
CREATE TABLE IF NOT EXISTS public.sst_funcoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
    setor_id UUID REFERENCES public.sst_setores(id) ON DELETE SET NULL,
    processo_id UUID REFERENCES public.sst_processos(id) ON DELETE SET NULL,
    nome VARCHAR(255) NOT NULL,
    cbo VARCHAR(10),
    descricao_atividades TEXT,
    atividades_criticas TEXT,
    requisitos_capacitacao TEXT,
    exige_nr10 BOOLEAN DEFAULT false,
    exige_nr33 BOOLEAN DEFAULT false,
    exige_nr35 BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. HISTÓRICO TEMPORAL DE TRABALHADORES
CREATE TABLE IF NOT EXISTS public.sst_trabalhadores_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
    funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
    estabelecimento_id UUID REFERENCES public.sst_estabelecimentos(id) ON DELETE SET NULL,
    ambiente_id UUID REFERENCES public.sst_ambientes(id) ON DELETE SET NULL,
    setor_id UUID REFERENCES public.sst_setores(id) ON DELETE SET NULL,
    processo_id UUID REFERENCES public.sst_processos(id) ON DELETE SET NULL,
    funcao_id UUID REFERENCES public.sst_funcoes(id) ON DELETE SET NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE,
    motivo_alteracao TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. MATRIZ MESTRE GES / GHE
CREATE TABLE IF NOT EXISTS public.sst_ges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    criterio_agrupamento TEXT,
    validade_inicio DATE DEFAULT CURRENT_DATE,
    validade_fim DATE,
    responsavel_inspecao VARCHAR(255),
    data_inspecao DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. VÍNCULOS N:N DO GES (Transversal)
CREATE TABLE IF NOT EXISTS public.sst_ges_vinculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
    ges_id UUID NOT NULL REFERENCES public.sst_ges(id) ON DELETE CASCADE,
    ambiente_id UUID REFERENCES public.sst_ambientes(id) ON DELETE CASCADE,
    setor_id UUID REFERENCES public.sst_setores(id) ON DELETE CASCADE,
    processo_id UUID REFERENCES public.sst_processos(id) ON DELETE CASCADE,
    funcao_id UUID REFERENCES public.sst_funcoes(id) ON DELETE CASCADE,
    funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. CATÁLOGO VERSIONADO DE PERIGOS E AGENTES
CREATE TABLE IF NOT EXISTS public.sst_perigos_catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('fisico', 'quimico', 'biologico', 'ergonomico', 'acidente', 'psicossocial', 'periculosidade', 'insalubridade')),
    nome_agente VARCHAR(255) NOT NULL,
    cas_number VARCHAR(50),
    codigo_esocial_tabela24 VARCHAR(20),
    possiveis_lesoes TEXT,
    meio_propagacao TEXT,
    aplica_pgr BOOLEAN DEFAULT true,
    aplica_pcmso BOOLEAN DEFAULT true,
    aplica_ltcat BOOLEAN DEFAULT false,
    aplica_nr15 BOOLEAN DEFAULT false,
    aplica_nr16 BOOLEAN DEFAULT false,
    aplica_ppp BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. MATRIZ MESTRE DE EXPOSIÇÕES (COM HERANÇA EM 6 NÍVEIS)
CREATE TABLE IF NOT EXISTS public.sst_exposicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
    nivel_origem VARCHAR(50) NOT NULL CHECK (nivel_origem IN ('ges', 'ambiente', 'setor', 'processo', 'funcao', 'individual')),
    ges_id UUID REFERENCES public.sst_ges(id) ON DELETE CASCADE,
    ambiente_id UUID REFERENCES public.sst_ambientes(id) ON DELETE CASCADE,
    setor_id UUID REFERENCES public.sst_setores(id) ON DELETE CASCADE,
    processo_id UUID REFERENCES public.sst_processos(id) ON DELETE CASCADE,
    funcao_id UUID REFERENCES public.sst_funcoes(id) ON DELETE CASCADE,
    funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE CASCADE,
    perigo_id UUID REFERENCES public.sst_perigos_catalogo(id),
    fonte_geradora TEXT NOT NULL,
    tipo_exposicao VARCHAR(50) CHECK (tipo_exposicao IN ('habitual_permanente', 'intermitente', 'eventual')),
    jornada_exposicao_minutos INTEGER,
    -- Avaliação do Risco GRO/PGR
    severidade INTEGER CHECK (severidade BETWEEN 1 AND 5),
    probabilidade INTEGER CHECK (probabilidade BETWEEN 1 AND 5),
    classificacao_risco VARCHAR(50),
    -- Medidas de Controle
    medidas_existentes TEXT,
    epc_existente TEXT,
    epc_eficaz BOOLEAN,
    epi_ca_list JSONB DEFAULT '[]'::jsonb,
    epi_eficacia_conclusao VARCHAR(50) DEFAULT 'nao_avaliada' CHECK (epi_eficacia_conclusao IN ('nao_avaliada', 'insuficiente', 'parcialmente_eficaz', 'eficaz', 'nao_aplicavel')),
    justificativa_eficacia TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS POLICIES MULTIEMPRESA
ALTER TABLE public.sst_estabelecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_ambientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_funcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_trabalhadores_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_ges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_ges_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_perigos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_exposicoes ENABLE ROW LEVEL SECURITY;

-- POLICIES DE ACESSO COM IS_ACTIVE_EMPRESA
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_estabelecimentos') THEN
        CREATE POLICY "Empresa tenant isolation sst_estabelecimentos" ON public.sst_estabelecimentos FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_ambientes') THEN
        CREATE POLICY "Empresa tenant isolation sst_ambientes" ON public.sst_ambientes FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_setores') THEN
        CREATE POLICY "Empresa tenant isolation sst_setores" ON public.sst_setores FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_processos') THEN
        CREATE POLICY "Empresa tenant isolation sst_processos" ON public.sst_processos FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_funcoes') THEN
        CREATE POLICY "Empresa tenant isolation sst_funcoes" ON public.sst_funcoes FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_trabalhadores_historico') THEN
        CREATE POLICY "Empresa tenant isolation sst_trabalhadores_historico" ON public.sst_trabalhadores_historico FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_ges') THEN
        CREATE POLICY "Empresa tenant isolation sst_ges" ON public.sst_ges FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_ges_vinculos') THEN
        CREATE POLICY "Empresa tenant isolation sst_ges_vinculos" ON public.sst_ges_vinculos FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir leitura sst_perigos_catalogo') THEN
        CREATE POLICY "Permitir leitura sst_perigos_catalogo" ON public.sst_perigos_catalogo FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_exposicoes') THEN
        CREATE POLICY "Empresa tenant isolation sst_exposicoes" ON public.sst_exposicoes FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
    END IF;
END $$;

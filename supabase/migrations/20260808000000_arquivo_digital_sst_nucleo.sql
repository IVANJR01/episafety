-- =====================================================================
-- Arquivo Digital SST — núcleo do documento
--
-- APLICADO no projeto estmuducawmftvpbeutm em três partes, com estes nomes
-- no histórico do Supabase:
--   arquivo_digital_sst_nucleo_1_tabelas
--   arquivo_digital_sst_nucleo_2_view_rls
--   arquivo_digital_sst_nucleo_3_storage_semeadura
-- Este arquivo é a união das três, na mesma ordem e com o mesmo conteúdo.
-- Tudo é idempotente: rodar de novo não duplica nada.
--
-- MOTIVO
--
-- O controle de capacitações guardava datas e nada mais: a tabela
-- `controle_treinamentos` não tem NENHUMA coluna de arquivo, e por isso a
-- coluna "Documento / Evidência" da tela era um cabeçalho sem conteúdo. O
-- bucket `documentos-treinamento` existia desde julho, privado, com zero
-- arquivos — o terreno preparado e nunca ligado.
--
-- DUAS DECISÕES ESTRUTURAIS, ambas para o documento valer como prova
--
-- 1. Renovar NUNCA substitui arquivo. Cada renovação é uma linha nova em
--    `internal_document_versions`, com arquivo e hash próprios. Isso não
--    fica na intenção: o bucket não recebe política de UPDATE nem DELETE, e
--    a tabela de versões só concede SELECT e INSERT. Sobrescrever destruiria
--    a prova da situação anterior — justamente o que se apresenta numa
--    fiscalização sobre período já decorrido.
--
-- 2. A situação (vigente/vencido/...) NÃO é coluna gravada, é calculada na
--    leitura pela view. Status gravado envelhece sozinho: o documento vence
--    no dia seguinte e a linha continua dizendo "vigente" até alguém rodar
--    uma rotina. Calculando, tela, matriz e relatório não têm como divergir.
-- =====================================================================

-- ================= PARTE 1: TABELAS =================

CREATE TABLE IF NOT EXISTS public.internal_document_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'capacitacao'
    CHECK (categoria IN ('capacitacao','saude','pessoal','veiculo','equipamento','empresa')),
  -- NULL = permanente. `cursos_documentos` usa 0 para isso; a conversão é
  -- explícita na semeadura, porque 0 mês significaria vencido no ato.
  validade_meses INTEGER CHECK (validade_meses IS NULL OR validade_meses > 0),
  exige_arquivo BOOLEAN NOT NULL DEFAULT true,
  dias_aviso INTEGER[] NOT NULL DEFAULT '{60,30,15,7,1}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  -- O catálogo de tipos JÁ EXISTE: é `cursos_documentos`, a aba "Cursos e
  -- Evidências". Este vínculo evita criar um terceiro catálogo, que é a
  -- doença que o módulo veio curar.
  origem_curso_id UUID REFERENCES public.cursos_documentos(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_idt_origem_curso
  ON public.internal_document_types(origem_curso_id) WHERE origem_curso_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_idt_empresa_nome
  ON public.internal_document_types(empresa_id, lower(nome));

CREATE TABLE IF NOT EXISTS public.internal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  unidade_id UUID,
  colaborador_id UUID REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_documento_id UUID NOT NULL REFERENCES public.internal_document_types(id) ON DELETE RESTRICT,
  -- Ponte com o registro que já existe, para a migração não duplicar
  -- histórico nem perder o vínculo com a tela atual.
  origem_tabela TEXT,
  origem_id UUID,
  -- Arquivar tira de circulação sem destruir: excluir some com a prova.
  arquivado_em TIMESTAMPTZ,
  arquivado_por UUID,
  arquivado_motivo TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Um documento por tipo por colaborador: renovações são versões dele, não
-- documentos novos. Sem isto, "NR-10" apareceria três vezes na matriz.
CREATE UNIQUE INDEX IF NOT EXISTS idx_idoc_colaborador_tipo
  ON public.internal_documents(colaborador_id, tipo_documento_id)
  WHERE colaborador_id IS NOT NULL AND arquivado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_idoc_empresa ON public.internal_documents(empresa_id);
CREATE INDEX IF NOT EXISTS idx_idoc_origem ON public.internal_documents(origem_tabela, origem_id);

CREATE TABLE IF NOT EXISTS public.internal_document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  documento_id UUID NOT NULL REFERENCES public.internal_documents(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL,
  -- Caminho no bucket privado. NUNCA URL pública.
  caminho_arquivo TEXT NOT NULL,
  nome_original TEXT,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  hash_sha256 TEXT,
  data_emissao DATE,
  -- Gravada aqui: mudar a validade do tipo amanhã não pode alterar
  -- retroativamente a validade de documento já emitido.
  data_validade DATE,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_idv_documento_versao
  ON public.internal_document_versions(documento_id, versao);
CREATE INDEX IF NOT EXISTS idx_idv_empresa ON public.internal_document_versions(empresa_id);

-- Numeração no banco: deixar o cliente escolher é corrida — dois envios
-- simultâneos gerariam duas "versão 3".
CREATE OR REPLACE FUNCTION public.proxima_versao_documento()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.versao IS NULL OR NEW.versao = 0 THEN
    SELECT COALESCE(max(versao), 0) + 1 INTO NEW.versao
    FROM public.internal_document_versions WHERE documento_id = NEW.documento_id;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_idv_versao ON public.internal_document_versions;
CREATE TRIGGER trg_idv_versao BEFORE INSERT ON public.internal_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.proxima_versao_documento();

DROP TRIGGER IF EXISTS trg_idt_updated_at ON public.internal_document_types;
CREATE TRIGGER trg_idt_updated_at BEFORE UPDATE ON public.internal_document_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_idoc_updated_at ON public.internal_documents;
CREATE TRIGGER trg_idoc_updated_at BEFORE UPDATE ON public.internal_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= PARTE 2: VIEW + RLS =================

CREATE OR REPLACE VIEW public.internal_documents_situacao AS
SELECT
  d.id, d.empresa_id, d.unidade_id, d.colaborador_id, d.tipo_documento_id,
  t.nome AS tipo_nome, t.categoria, t.dias_aviso, d.arquivado_em,
  v.id AS versao_id, v.versao AS versao_numero, v.caminho_arquivo,
  v.nome_original, v.hash_sha256, v.data_emissao, v.data_validade,
  v.created_at AS enviado_em, v.created_by AS enviado_por,
  (SELECT count(*) FROM public.internal_document_versions x WHERE x.documento_id = d.id) AS total_versoes,
  CASE
    WHEN d.arquivado_em IS NOT NULL     THEN 'arquivado'
    WHEN v.id IS NULL                   THEN 'nao_enviado'
    WHEN v.data_validade IS NULL        THEN 'vigente'
    WHEN v.data_validade < CURRENT_DATE THEN 'vencido'
    WHEN v.data_validade <= CURRENT_DATE
         + ((COALESCE((SELECT max(x) FROM unnest(t.dias_aviso) x), 30))::text || ' days')::interval
                                        THEN 'vence_em_breve'
    ELSE 'vigente'
  END AS situacao,
  CASE WHEN v.data_validade IS NULL THEN NULL ELSE (v.data_validade - CURRENT_DATE) END AS dias_para_vencer
FROM public.internal_documents d
JOIN public.internal_document_types t ON t.id = d.tipo_documento_id
-- Só a versão mais recente descreve a situação atual; as anteriores são
-- histórico e continuam consultáveis pela tabela.
LEFT JOIN LATERAL (
  SELECT * FROM public.internal_document_versions v2
  WHERE v2.documento_id = d.id ORDER BY v2.versao DESC LIMIT 1
) v ON true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_document_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_documents TO authenticated;
-- Sem UPDATE nem DELETE: versão publicada é registro histórico. Corrigir
-- envio errado é publicar a versão seguinte, não reescrever a anterior.
GRANT SELECT, INSERT ON public.internal_document_versions TO authenticated;
GRANT SELECT ON public.internal_documents_situacao TO authenticated;

ALTER TABLE public.internal_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_document_versions ENABLE ROW LEVEL SECURITY;

-- Usa `get_user_empresa_ids`, o padrão do resto do sistema: cobre
-- usuario_empresas E usuarios_liberados, comparando e-mail sem diferenciar
-- maiúsculas. Política que olha só uma das tabelas é a causa de
-- "row-level security policy" em telas isoladas.
DROP POLICY IF EXISTS idt_select ON public.internal_document_types;
CREATE POLICY idt_select ON public.internal_document_types FOR SELECT TO authenticated
  USING (empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
         OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS idt_insert ON public.internal_document_types;
CREATE POLICY idt_insert ON public.internal_document_types FOR INSERT TO authenticated
  WITH CHECK (empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
         OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS idt_update ON public.internal_document_types;
CREATE POLICY idt_update ON public.internal_document_types FOR UPDATE TO authenticated
  USING (empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
         OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS idt_delete ON public.internal_document_types;
CREATE POLICY idt_delete ON public.internal_document_types FOR DELETE TO authenticated
  USING (empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS idoc_select ON public.internal_documents;
CREATE POLICY idoc_select ON public.internal_documents FOR SELECT TO authenticated
  USING (empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
         OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS idoc_insert ON public.internal_documents;
CREATE POLICY idoc_insert ON public.internal_documents FOR INSERT TO authenticated
  WITH CHECK (empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
         OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS idoc_update ON public.internal_documents;
CREATE POLICY idoc_update ON public.internal_documents FOR UPDATE TO authenticated
  USING (empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS idv_select ON public.internal_document_versions;
CREATE POLICY idv_select ON public.internal_document_versions FOR SELECT TO authenticated
  USING (empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
         OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS idv_insert ON public.internal_document_versions;
CREATE POLICY idv_insert ON public.internal_document_versions FOR INSERT TO authenticated
  WITH CHECK (empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- ================= PARTE 3: STORAGE + SEMEADURA =================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-internos', 'documentos-internos', false)
ON CONFLICT (id) DO NOTHING;

-- O caminho começa pelo empresa_id, e é esse primeiro nível que a política
-- confere: nenhuma empresa alcança documento de outra.
DROP POLICY IF EXISTS docint_read ON storage.objects;
CREATE POLICY docint_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-internos'
    AND ((storage.foldername(name))[1] = ANY (
          SELECT x::text FROM unnest(public.get_user_empresa_ids(auth.jwt() ->> 'email')) x)
         OR public.has_role(auth.uid(), 'admin'::public.app_role)));

DROP POLICY IF EXISTS docint_write ON storage.objects;
CREATE POLICY docint_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-internos'
    AND ((storage.foldername(name))[1] = ANY (
          SELECT x::text FROM unnest(public.get_user_empresa_ids(auth.jwt() ->> 'email')) x)
         OR public.has_role(auth.uid(), 'admin'::public.app_role)));

-- Sem UPDATE e sem DELETE de propósito: arquivo de versão publicada não se
-- troca nem se apaga. Retirar de circulação é arquivar o documento.

-- Semeadura: cada curso já cadastrado vira um tipo. Idempotente, e com
-- guarda de nome porque o índice único por (empresa, nome) barraria um
-- segundo curso homônimo.
INSERT INTO public.internal_document_types
  (empresa_id, nome, categoria, validade_meses, origem_curso_id, created_by)
SELECT c.empresa_id, c.nome, 'capacitacao', NULLIF(c.validade_meses, 0), c.id, c.created_by
FROM public.cursos_documentos c
WHERE c.empresa_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.internal_document_types t WHERE t.origem_curso_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.internal_document_types t
                  WHERE t.empresa_id = c.empresa_id AND lower(t.nome) = lower(c.nome));

-- Curso criado depois também vira tipo, sem ninguém lembrar de cadastrar em
-- dois lugares.
CREATE OR REPLACE FUNCTION public.sincronizar_tipo_documento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.empresa_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.internal_document_types
    (empresa_id, nome, categoria, validade_meses, origem_curso_id, created_by)
  VALUES (NEW.empresa_id, NEW.nome, 'capacitacao',
          NULLIF(NEW.validade_meses, 0), NEW.id, NEW.created_by)
  ON CONFLICT (origem_curso_id) DO UPDATE
    SET nome = EXCLUDED.nome,
        validade_meses = EXCLUDED.validade_meses,
        updated_at = now();
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  -- Já existe tipo com esse nome nesta empresa (semeado antes de haver
  -- vínculo). Amarra o curso a ele em vez de derrubar o cadastro do curso —
  -- falhar aqui impediria a pessoa de salvar um curso por causa de uma
  -- tabela que ela nem sabe que existe.
  UPDATE public.internal_document_types
     SET origem_curso_id = NEW.id, validade_meses = NULLIF(NEW.validade_meses, 0), updated_at = now()
   WHERE empresa_id = NEW.empresa_id AND lower(nome) = lower(NEW.nome) AND origem_curso_id IS NULL;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_curso_vira_tipo ON public.cursos_documentos;
CREATE TRIGGER trg_curso_vira_tipo AFTER INSERT OR UPDATE ON public.cursos_documentos
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_tipo_documento();

COMMENT ON TABLE public.internal_documents IS
  'Arquivo Digital SST: documento de um colaborador. Renovações vivem em internal_document_versions — renovar nunca sobrescreve.';
COMMENT ON VIEW public.internal_documents_situacao IS
  'Situação calculada na leitura. Não gravar status: coluna gravada envelhece sozinha e faz tela e matriz divergirem.';

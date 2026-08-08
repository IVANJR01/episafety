-- =====================================================================
-- Arquivo Digital SST — núcleo do documento
--
-- Hoje o controle de capacitações guarda datas e nada mais:
-- `controle_treinamentos` não tem NENHUMA coluna de arquivo, e por isso a
-- coluna "Documento / Evidência" da tela é um cabeçalho sem conteúdo. O
-- bucket `documentos-treinamento` existe desde julho, privado, com zero
-- arquivos — o terreno foi preparado e nunca ligado.
--
-- Este núcleo troca "controle de datas" por "arquivo oficial":
--
--   internal_document_types      o que a empresa exige (ASO, NR-10, ...)
--   internal_documents           o documento de um colaborador
--   internal_document_versions   cada renovação, sem sobrescrever nada
--
-- Duas decisões estruturais, ambas para o documento valer como prova:
--
-- 1. Renovar NUNCA substitui arquivo. Cada renovação é uma linha nova em
--    `internal_document_versions`, com o arquivo próprio e o hash próprio.
--    Sobrescrever destruiria a prova da situação anterior — que é
--    exatamente o que se precisa mostrar numa fiscalização sobre o
--    período passado.
--
-- 2. A situação (vigente/vencido/...) NÃO é coluna gravada, é calculada.
--    Status gravado envelhece sozinho: o documento vence no dia seguinte
--    e a linha continua dizendo "vigente" até alguém rodar alguma rotina.
--    A view `internal_documents_situacao` calcula na leitura, então tela,
--    matriz e relatório não têm como divergir.
-- =====================================================================

-- ---------- TIPOS DE DOCUMENTO ----------
CREATE TABLE IF NOT EXISTS public.internal_document_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  -- Agrupa na tela e decide quem enxerga: 'saude' é dado sensível.
  categoria TEXT NOT NULL DEFAULT 'capacitacao'
    CHECK (categoria IN ('capacitacao','saude','pessoal','veiculo','equipamento','empresa')),
  -- NULL = permanente (ficha de EPI, escolaridade). Número = meses de validade.
  validade_meses INTEGER CHECK (validade_meses IS NULL OR validade_meses > 0),
  -- Alguns registros são só declaratórios; a exigência é por tipo, não global.
  exige_arquivo BOOLEAN NOT NULL DEFAULT true,
  -- Dias antes do vencimento em que o aviso deve disparar.
  dias_aviso INTEGER[] NOT NULL DEFAULT '{60,30,15,7,1}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mesmo nome duas vezes na mesma empresa vira dois "ASO" distintos na
-- matriz, e ninguém sabe qual é o certo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_idt_empresa_nome
  ON public.internal_document_types(empresa_id, lower(nome));

-- ---------- DOCUMENTO ----------
CREATE TABLE IF NOT EXISTS public.internal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  unidade_id UUID,
  -- Documento de pessoa (o caso de hoje). Fica nulo em documento da
  -- empresa, de veículo ou de equipamento, que entram depois.
  colaborador_id UUID REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_documento_id UUID NOT NULL REFERENCES public.internal_document_types(id) ON DELETE RESTRICT,

  -- Ponte com o registro que já existe, para a migração não duplicar
  -- histórico nem perder o vínculo com a tela atual.
  origem_tabela TEXT,
  origem_id UUID,

  -- Arquivar tira de circulação sem destruir. Excluir de verdade some com
  -- a prova de entrega/treinamento, e isso não se desfaz.
  arquivado_em TIMESTAMPTZ,
  arquivado_por UUID,
  arquivado_motivo TEXT,

  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Um documento por tipo por colaborador: as renovações são versões dele,
-- não documentos novos. Sem isto, "NR-10" apareceria três vezes na matriz.
CREATE UNIQUE INDEX IF NOT EXISTS idx_idoc_colaborador_tipo
  ON public.internal_documents(colaborador_id, tipo_documento_id)
  WHERE colaborador_id IS NOT NULL AND arquivado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_idoc_empresa ON public.internal_documents(empresa_id);
CREATE INDEX IF NOT EXISTS idx_idoc_origem ON public.internal_documents(origem_tabela, origem_id);

-- ---------- VERSÕES ----------
CREATE TABLE IF NOT EXISTS public.internal_document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  documento_id UUID NOT NULL REFERENCES public.internal_documents(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL,

  -- Caminho no bucket privado. NUNCA URL pública: link público de ASO é
  -- vazamento de dado de saúde para quem tiver o endereço.
  caminho_arquivo TEXT NOT NULL,
  nome_original TEXT,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  -- Prova de que o arquivo servido é o mesmo que foi enviado.
  hash_sha256 TEXT,

  data_emissao DATE,
  -- NULL = permanente. Preenchida a partir de validade_meses do tipo,
  -- mas gravada aqui: se a empresa mudar a validade do tipo amanhã, o
  -- documento já emitido não pode mudar de validade retroativamente.
  data_validade DATE,

  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_idv_documento_versao
  ON public.internal_document_versions(documento_id, versao);
CREATE INDEX IF NOT EXISTS idx_idv_empresa ON public.internal_document_versions(empresa_id);

-- Numera a versão sozinho. Deixar o cliente escolher o número é corrida:
-- dois envios ao mesmo tempo gerariam duas "versão 3".
CREATE OR REPLACE FUNCTION public.proxima_versao_documento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.versao IS NULL OR NEW.versao = 0 THEN
    SELECT COALESCE(max(versao), 0) + 1 INTO NEW.versao
    FROM public.internal_document_versions
    WHERE documento_id = NEW.documento_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_idv_versao ON public.internal_document_versions;
CREATE TRIGGER trg_idv_versao
  BEFORE INSERT ON public.internal_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.proxima_versao_documento();

-- ---------- SITUAÇÃO CALCULADA ----------
--
-- Uma verdade só, calculada na leitura. As cores da tela saem daqui.
CREATE OR REPLACE VIEW public.internal_documents_situacao AS
SELECT
  d.id,
  d.empresa_id,
  d.unidade_id,
  d.colaborador_id,
  d.tipo_documento_id,
  t.nome            AS tipo_nome,
  t.categoria,
  t.dias_aviso,
  d.arquivado_em,
  v.id              AS versao_id,
  v.versao          AS versao_numero,
  v.caminho_arquivo,
  v.nome_original,
  v.hash_sha256,
  v.data_emissao,
  v.data_validade,
  v.created_at      AS enviado_em,
  v.created_by      AS enviado_por,
  (SELECT count(*) FROM public.internal_document_versions x WHERE x.documento_id = d.id) AS total_versoes,
  CASE
    WHEN d.arquivado_em IS NOT NULL                       THEN 'arquivado'
    WHEN v.id IS NULL                                     THEN 'nao_enviado'
    WHEN v.data_validade IS NULL                          THEN 'vigente'
    WHEN v.data_validade < CURRENT_DATE                   THEN 'vencido'
    WHEN v.data_validade <= CURRENT_DATE
         + (COALESCE((SELECT max(x) FROM unnest(t.dias_aviso) x), 30) || ' days')::interval
                                                          THEN 'vence_em_breve'
    ELSE 'vigente'
  END AS situacao,
  CASE WHEN v.data_validade IS NULL THEN NULL
       ELSE (v.data_validade - CURRENT_DATE) END AS dias_para_vencer
FROM public.internal_documents d
JOIN public.internal_document_types t ON t.id = d.tipo_documento_id
-- Só a versão mais recente descreve a situação atual; as anteriores são
-- histórico e continuam consultáveis pela tabela.
LEFT JOIN LATERAL (
  SELECT * FROM public.internal_document_versions v2
  WHERE v2.documento_id = d.id
  ORDER BY v2.versao DESC
  LIMIT 1
) v ON true;

-- ---------- PERMISSÕES ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_document_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_documents TO authenticated;
-- Sem UPDATE nem DELETE: versão publicada é registro histórico. Corrigir
-- um envio errado é enviar a versão seguinte, não reescrever a anterior.
GRANT SELECT, INSERT ON public.internal_document_versions TO authenticated;
GRANT SELECT ON public.internal_documents_situacao TO authenticated;
GRANT ALL ON public.internal_document_types, public.internal_documents,
             public.internal_document_versions TO service_role;

ALTER TABLE public.internal_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_document_versions ENABLE ROW LEVEL SECURITY;

-- Usa `get_user_empresa_ids`, que é o padrão do resto do sistema: cobre
-- usuario_empresas E usuarios_liberados, e compara e-mail sem diferenciar
-- maiúsculas. Políticas antigas que olhavam só uma das tabelas são a causa
-- de "row-level security policy" em telas isoladas.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['internal_document_types','internal_documents','internal_document_versions']
  LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS "%1$s_select" ON public.%1$I;
      CREATE POLICY "%1$s_select" ON public.%1$I FOR SELECT TO authenticated
        USING (empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
               OR public.has_role(auth.uid(), 'admin'));

      DROP POLICY IF EXISTS "%1$s_insert" ON public.%1$I;
      CREATE POLICY "%1$s_insert" ON public.%1$I FOR INSERT TO authenticated
        WITH CHECK (empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
               OR public.has_role(auth.uid(), 'admin'));
    $f$, t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['internal_document_types','internal_documents']
  LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS "%1$s_update" ON public.%1$I;
      CREATE POLICY "%1$s_update" ON public.%1$I FOR UPDATE TO authenticated
        USING (empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
               OR public.has_role(auth.uid(), 'admin'));
    $f$, t);
  END LOOP;

  -- Excluir tipo só faz sentido enquanto ninguém o usou; a FK em
  -- internal_documents é RESTRICT e barra o resto.
  EXECUTE $f$
    DROP POLICY IF EXISTS "internal_document_types_delete" ON public.internal_document_types;
    CREATE POLICY "internal_document_types_delete" ON public.internal_document_types
      FOR DELETE TO authenticated
      USING (empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
             OR public.has_role(auth.uid(), 'admin'));
  $f$;
END $$;

CREATE TRIGGER trg_idt_updated_at BEFORE UPDATE ON public.internal_document_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_idoc_updated_at BEFORE UPDATE ON public.internal_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- ARMAZENAMENTO ----------
-- Privado. Documento de saúde e documento pessoal não podem ser servidos
-- por URL pública: quem tiver o endereço lê, sem login e sem registro.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-internos', 'documentos-internos', false)
ON CONFLICT (id) DO NOTHING;

-- O caminho começa pelo empresa_id, e é ele que a política confere:
--   <empresa_id>/colaboradores/<colaborador_id>/<documento_id>/<versao>.<ext>
DROP POLICY IF EXISTS "docint_read" ON storage.objects;
CREATE POLICY "docint_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-internos'
    AND (
      (storage.foldername(name))[1] = ANY (
        SELECT x::text FROM unnest(public.get_user_empresa_ids((auth.jwt() ->> 'email'))) x
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "docint_write" ON storage.objects;
CREATE POLICY "docint_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-internos'
    AND (
      (storage.foldername(name))[1] = ANY (
        SELECT x::text FROM unnest(public.get_user_empresa_ids((auth.jwt() ->> 'email'))) x
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- Sem UPDATE e sem DELETE de propósito: o arquivo de uma versão publicada
-- não se troca nem se apaga. Retirar de circulação é arquivar o documento.

COMMENT ON TABLE public.internal_documents IS
  'Arquivo Digital SST: o documento de um colaborador. As renovações vivem em internal_document_versions — renovar nunca sobrescreve.';
COMMENT ON VIEW public.internal_documents_situacao IS
  'Situação calculada na leitura (nao_enviado/vigente/vence_em_breve/vencido/arquivado). Não gravar status: coluna gravada envelhece sozinha e faz tela e matriz divergirem.';

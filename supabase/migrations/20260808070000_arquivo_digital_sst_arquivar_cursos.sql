-- =====================================================================
-- Trocar exclusão por arquivamento — Cursos e Documentação
--
-- CadastroCursos.tsx excluía cursos_documentos direto. Investigado nesta
-- rodada: isso nunca destruía documento real anexado de verdade —
-- internal_document_types.origem_curso_id tem ON DELETE CASCADE pra
-- cursos_documentos, mas internal_documents.tipo_documento_id tem ON
-- DELETE RESTRICT pra internal_document_types, então a cascata sempre
-- parava aí. O bug de verdade era outro: o erro do DELETE nunca era
-- checado, então pra quem tentava excluir um curso com histórico, a
-- linha simplesmente "não sumia" da lista, sem explicação nenhuma.
--
-- cursos_documentos não tinha nenhuma coluna de status — não existia
-- alternativa de arquivar, só excluir (que às vezes nem funcionava).
-- =====================================================================

ALTER TABLE public.cursos_documentos ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.cursos_documentos.ativo IS
  'false = curso/documento arquivado (retirado de uso para novos lançamentos, mas mantém histórico e documentos já anexados). Substitui a exclusão, que na prática já falhava silenciosamente quando havia documento real vinculado.';

-- Propaga "ativo" no mesmo sync que já espelha cursos_documentos em
-- internal_document_types — arquivar um curso já marca o tipo
-- correspondente como inativo automaticamente, sem lógica nova: o
-- Arquivo Digital (DocumentoEvidencia.tsx/Dossiê) já filtra por
-- internal_document_types.ativo = true desde a migration do núcleo.
CREATE OR REPLACE FUNCTION public.sincronizar_tipo_documento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  INSERT INTO public.internal_document_types
    (empresa_id, nome, categoria, validade_meses, origem_curso_id, created_by, ativo)
  VALUES (NEW.empresa_id, NEW.nome, 'capacitacao',
          NULLIF(NEW.validade_meses, 0), NEW.id, NEW.created_by, NEW.ativo)
  ON CONFLICT (origem_curso_id) DO UPDATE
    SET nome = EXCLUDED.nome,
        validade_meses = EXCLUDED.validade_meses,
        ativo = EXCLUDED.ativo,
        updated_at = now();
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  UPDATE public.internal_document_types
     SET origem_curso_id = NEW.id, validade_meses = NULLIF(NEW.validade_meses, 0), ativo = NEW.ativo, updated_at = now()
   WHERE empresa_id IS NOT DISTINCT FROM NEW.empresa_id
     AND lower(nome) = lower(NEW.nome)
     AND origem_curso_id IS NULL;
  RETURN NEW;
END;
$fn$;

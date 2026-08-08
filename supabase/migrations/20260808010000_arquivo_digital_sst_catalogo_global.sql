-- =====================================================================
-- Arquivo Digital SST — inclui o catálogo GLOBAL de cursos
--
-- BUG encontrado por vídeo do usuário: registros antigos de capacitação
-- (inclusive vencidos, de anos atrás) apareciam como "Curso não
-- cadastrado" na coluna Documento/Evidência, sem nenhum jeito de anexar
-- o arquivo — nem o ASO que ele já tinha assinado em mãos.
--
-- Causa: `cursos_documentos` não é só uma tabela por empresa. Ela tem um
-- catálogo GLOBAL — linhas com `empresa_id IS NULL`, compartilhadas por
-- todas as empresas, com política de RLS dedicada só para isso
-- ("Read global cursos_documentos" USING (empresa_id IS NULL), migration
-- 20260313023223). É de lá que vem grande parte dos cursos-base: NRs,
-- ASO, etc. — o que a maioria das empresas realmente usa.
--
-- A migration anterior (20260808000000) semeou `internal_document_types`
-- só a partir de cursos com `empresa_id IS NOT NULL`, ignorando o
-- catálogo global inteiro. O efeito prático: qualquer empresa que usa um
-- curso do catálogo global (a maioria) via `nome_curso` em
-- `controle_treinamentos` nunca tinha um tipo correspondente — a coluna
-- de evidência não achava onde pendurar o arquivo, para NENHUMA empresa,
-- não só para quem gravou o vídeo.
--
-- CORREÇÃO: `internal_document_types.empresa_id` passa a aceitar NULL,
-- pelo mesmo motivo que `cursos_documentos.empresa_id` aceita — um tipo
-- de documento pode ser catálogo compartilhado. A política de leitura
-- passa a liberar `empresa_id IS NULL`, e a semeadura roda de novo,
-- desta vez cobrindo o catálogo inteiro.
--
-- Nada disso afeta isolamento de dados: `internal_documents` e
-- `internal_document_versions" — o documento de cada colaborador e o
-- arquivo em si — continuam com `empresa_id` sempre preenchido com o
-- valor real do colaborador. O tipo compartilhado é só metadado (nome e
-- prazo de validade), do mesmo jeito que "NR-10" já é hoje.
-- =====================================================================

ALTER TABLE public.internal_document_types ALTER COLUMN empresa_id DROP NOT NULL;

-- Unicidade por nome dentro do catálogo global também, para o mesmo curso
-- global não virar dois tipos se a semeadura rodar mais de uma vez.
-- Índice separado porque um índice único comum trata cada NULL como
-- distinto dos outros — não bastaria por si só para evitar duplicata aqui.
CREATE UNIQUE INDEX IF NOT EXISTS idx_idt_nome_global
  ON public.internal_document_types(lower(nome))
  WHERE empresa_id IS NULL;

-- Leitura do tipo global libera para todo mundo autenticado, espelhando
-- exatamente a política que cursos_documentos já usa para o mesmo caso.
DROP POLICY IF EXISTS idt_select_global ON public.internal_document_types;
CREATE POLICY idt_select_global ON public.internal_document_types FOR SELECT TO authenticated
  USING (empresa_id IS NULL);

-- Trigger corrigida: `NEW.empresa_id = EXCLUDED.empresa_id` falha quando
-- ambos são NULL (NULL = NULL não é verdadeiro em SQL); o fallback de
-- unique_violation usava a mesma comparação quebrada. IS NOT DISTINCT
-- FROM trata NULL como igual a NULL, que é o comportamento certo aqui.
CREATE OR REPLACE FUNCTION public.sincronizar_tipo_documento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
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
  UPDATE public.internal_document_types
     SET origem_curso_id = NEW.id, validade_meses = NULLIF(NEW.validade_meses, 0), updated_at = now()
   WHERE empresa_id IS NOT DISTINCT FROM NEW.empresa_id
     AND lower(nome) = lower(NEW.nome)
     AND origem_curso_id IS NULL;
  RETURN NEW;
END;
$fn$;

-- Semeadura de novo, agora sem excluir o catálogo global. Idempotente:
-- quem já foi semeado pela migration anterior não duplica (guarda por
-- origem_curso_id); só o que ficou de fora — os cursos globais — entra
-- agora.
INSERT INTO public.internal_document_types
  (empresa_id, nome, categoria, validade_meses, origem_curso_id, created_by)
SELECT c.empresa_id, c.nome, 'capacitacao', NULLIF(c.validade_meses, 0), c.id, c.created_by
FROM public.cursos_documentos c
WHERE NOT EXISTS (SELECT 1 FROM public.internal_document_types t WHERE t.origem_curso_id = c.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.internal_document_types t
    WHERE t.empresa_id IS NOT DISTINCT FROM c.empresa_id AND lower(t.nome) = lower(c.nome)
  );

COMMENT ON COLUMN public.internal_document_types.empresa_id IS
  'NULL = tipo do catálogo global (mesmo padrão de cursos_documentos.empresa_id): visível e usável por qualquer empresa, sem duplicar por tenant.';

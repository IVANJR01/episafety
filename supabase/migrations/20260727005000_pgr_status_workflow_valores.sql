-- ============================================================================
-- FASE 5.1 — Estados intermediários do workflow de aprovação
-- ============================================================================
-- Workflow da NR-01: rascunho → em revisão técnica → aguardando aprovação →
-- aguardando assinatura → vigente → em revisão → arquivado.
-- Faltavam os três estados intermediários.
--
-- Aqui o enum é ESTENDIDO, e não convertido para text como foi feito com
-- pgr_acao_status: seis funções referenciam public.pgr_status (pgr_abrir_revisao,
-- pgr_publicar, pgr_assinar_visual, pgr_importar_ghe ×2, pgr_acao_set_status) e
-- converter exigiria reescrever todas — risco desproporcional ao ganho.
--
-- ALTER TYPE ADD VALUE não permite USAR o valor novo na mesma transação, por
-- isso esta migration apenas adiciona; o uso vem na migration seguinte.
-- ============================================================================

ALTER TYPE public.pgr_status ADD VALUE IF NOT EXISTS 'em_revisao_tecnica' AFTER 'rascunho';
ALTER TYPE public.pgr_status ADD VALUE IF NOT EXISTS 'aguardando_aprovacao' AFTER 'em_revisao_tecnica';
ALTER TYPE public.pgr_status ADD VALUE IF NOT EXISTS 'aguardando_assinatura' AFTER 'aguardando_aprovacao';

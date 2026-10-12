-- Guarda o cadastro de estrutura que sai numa união de repetidos.
--
-- O caso que originou isto, num PGR real: CORTE, COSTURA e LOJA cadastrados
-- duas vezes; ESCRITORIO e ESCRITÓRIO; SEPARAÇÃO e "SEPARAÇÃO (Cópia)";
-- ALMOXARIDADO ao lado de ALMOXARIFADDO. O documento saía descrevendo o mesmo
-- setor duas vezes, com textos diferentes.
--
-- A união em si é feita pelo sistema, em src/lib/unirCadastroEstrutura.ts, na
-- ordem que não perde nada: copiar para cá, completar os campos que faltam no
-- que fica, mover TODOS os vínculos e só então apagar. A ordem importa porque
-- várias tabelas apontam para estes cadastros com ON DELETE CASCADE — apagar
-- antes de mover levaria junto itens de inventário, ações do plano, coletas de
-- campo e o histórico dos trabalhadores.
--
-- Esta tabela é o que torna a união reversível: unir o cadastro errado é um
-- erro que acontece, e sem a cópia não haveria volta.

CREATE TABLE IF NOT EXISTS public.sst_cadastros_unificados_backup (
  id UUID PRIMARY KEY,
  tabela TEXT NOT NULL,
  empresa_id UUID NOT NULL,
  unificado_em UUID NOT NULL,
  dados JSONB NOT NULL,
  quem UUID,
  quando TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sst_cadastros_unificados_backup ENABLE ROW LEVEL SECURITY;

-- Quem enxerga a empresa enxerga o que foi unido nela: é o registro de uma
-- alteração de cadastro, e quem opera o cadastro precisa poder conferir.
DROP POLICY IF EXISTS "backup uniao cadastros leitura da empresa"
  ON public.sst_cadastros_unificados_backup;
CREATE POLICY "backup uniao cadastros leitura da empresa"
  ON public.sst_cadastros_unificados_backup FOR SELECT
  USING (public.is_active_empresa(auth.uid(), empresa_id));

-- Só escreve quem está unindo cadastro da própria empresa. Não há política de
-- UPDATE nem de DELETE de propósito: a cópia não se altera nem se apaga pela
-- tela, senão deixaria de ser o caminho de volta.
DROP POLICY IF EXISTS "backup uniao cadastros gravacao da empresa"
  ON public.sst_cadastros_unificados_backup;
CREATE POLICY "backup uniao cadastros gravacao da empresa"
  ON public.sst_cadastros_unificados_backup FOR INSERT
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

CREATE INDEX IF NOT EXISTS sst_cadastros_unificados_backup_empresa
  ON public.sst_cadastros_unificados_backup (empresa_id, quando DESC);

-- ---------------------------------------------------------------------------
-- Limpeza de uma tentativa anterior.
--
-- A união chegou a ser escrita como função do banco (sst_unir_cadastro). O
-- canal usado para aplicar migrations daqui recusa qualquer SQL que contenha
-- DELETE, e a função não pôde ser criada inteira — ficaram no banco três
-- pedaços que nunca foram usados por ninguém. Estes DROPs precisam ser
-- aplicados à mão, no editor SQL do Supabase, pelo mesmo motivo (o canal
-- também recusa DROP):
--
--   DROP FUNCTION IF EXISTS public.sst_unir_validar(TEXT, UUID, UUID[]);
--   DROP FUNCTION IF EXISTS public.sst_unir_completar_campos(TEXT, UUID, UUID[]);
--   DROP FUNCTION IF EXISTS public.sst_unir_mover_vinculos(TEXT, UUID, UUID[]);
--   DROP FUNCTION IF EXISTS public.sst_teste_tmp();
--
-- Enquanto não forem apagadas elas não fazem nada: ninguém as chama, e todas
-- verificam acesso à empresa antes de qualquer coisa.

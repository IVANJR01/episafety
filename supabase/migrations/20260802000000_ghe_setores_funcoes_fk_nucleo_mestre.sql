-- GES tinha sua própria lista de Setores/Funções (ghe_setores/ghe_funcoes),
-- em texto livre, sem nenhuma ligação com sst_setores/sst_funcoes do Núcleo
-- Mestre — cadastrando a mesma coisa duas vezes. Estas colunas são a ponte:
-- nullable, aditiva, reversível. Registros antigos continuam funcionando
-- pelo texto legado (nome/setor); só os vínculos novos passam a ter FK real.
ALTER TABLE public.ghe_setores
  ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.sst_setores(id) ON DELETE SET NULL;

ALTER TABLE public.ghe_funcoes
  ADD COLUMN IF NOT EXISTS funcao_id uuid REFERENCES public.sst_funcoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ghe_setores_setor_id ON public.ghe_setores(setor_id);
CREATE INDEX IF NOT EXISTS idx_ghe_funcoes_funcao_id ON public.ghe_funcoes(funcao_id);

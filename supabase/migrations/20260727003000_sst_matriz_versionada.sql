-- ============================================================================
-- FASE 2 — Motor de matriz de risco versionado
-- ============================================================================
-- A NR-01 1.5.4.4.2 exige que os critérios de gradação de severidade e
-- probabilidade, os níveis de risco e a tomada de decisão fiquem DOCUMENTADOS.
-- Não existe uma matriz obrigatória: a organização escolhe método tecnicamente
-- adequado — e por isso o método precisa ser dado, não código.
--
-- Hoje a escala de 5 níveis está cravada em três lugares (função SQL, pgrMatriz.ts
-- e o texto da UI). Mudar a metodologia significa alterar código e, pior, reescrever
-- retroativamente a classificação de PGRs já emitidos.
--
-- Estrutura:
--   sst_matriz_metodos  — o método (ex.: "Matriz 5x5 padrão")
--   sst_matriz_versoes  — cada versão publicada dele, imutável depois de vigente
--   sst_matriz_escalas  — definição de cada grau de severidade e probabilidade
--   sst_matriz_niveis   — as faixas de classificação, com cor e decisão associada
--
-- Escopo: empresa_id NULL = método global do sistema, visível a todos os tenants.
-- Um tenant pode criar os seus próprios sem afetar os demais.
--
-- REGRA CENTRAL: o PGR trava uma versão em pgr_documentos.matriz_versao_id, e os
-- itens do inventário HERDAM essa versão via trigger. É isso que impede misturar
-- matrizes dentro da mesma versão do PGR.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Método
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sst_matriz_metodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = método global do sistema, disponível para todos os tenants
  empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  dimensao_severidade smallint NOT NULL DEFAULT 5,
  dimensao_probabilidade smallint NOT NULL DEFAULT 5,
  formula text NOT NULL DEFAULT 'severidade * probabilidade',
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sst_matriz_metodos DROP CONSTRAINT IF EXISTS sst_matriz_dim_chk;
ALTER TABLE public.sst_matriz_metodos ADD CONSTRAINT sst_matriz_dim_chk
  CHECK (dimensao_severidade BETWEEN 2 AND 10 AND dimensao_probabilidade BETWEEN 2 AND 10);

COMMENT ON COLUMN public.sst_matriz_metodos.empresa_id IS
  'NULL = método global do sistema. Preenchido = método próprio do tenant.';

-- ---------------------------------------------------------------------------
-- Versão do método
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sst_matriz_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metodo_id uuid NOT NULL REFERENCES public.sst_matriz_metodos(id) ON DELETE CASCADE,
  versao integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'rascunho',
  vigencia_inicio date,
  vigencia_fim date,
  motivo_alteracao text,
  publicada_em timestamptz,
  publicada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metodo_id, versao)
);

ALTER TABLE public.sst_matriz_versoes DROP CONSTRAINT IF EXISTS sst_matriz_versao_status_chk;
ALTER TABLE public.sst_matriz_versoes ADD CONSTRAINT sst_matriz_versao_status_chk
  CHECK (status IN ('rascunho','vigente','arquivada'));

COMMENT ON TABLE public.sst_matriz_versoes IS
  'Versões publicadas de um método de matriz. Uma versão vigente nunca é editada: mudar a metodologia cria nova versão, preservando a classificação dos PGRs que usaram a anterior.';

-- ---------------------------------------------------------------------------
-- Escalas de severidade e probabilidade
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sst_matriz_escalas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id uuid NOT NULL REFERENCES public.sst_matriz_versoes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  valor smallint NOT NULL,
  rotulo text NOT NULL,
  definicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (versao_id, tipo, valor)
);

ALTER TABLE public.sst_matriz_escalas DROP CONSTRAINT IF EXISTS sst_matriz_escala_tipo_chk;
ALTER TABLE public.sst_matriz_escalas ADD CONSTRAINT sst_matriz_escala_tipo_chk
  CHECK (tipo IN ('severidade','probabilidade'));

COMMENT ON COLUMN public.sst_matriz_escalas.definicao IS
  'Critério objetivo do grau — é o que a NR-01 exige documentar, não apenas o rótulo.';

-- ---------------------------------------------------------------------------
-- Faixas de classificação
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sst_matriz_niveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id uuid NOT NULL REFERENCES public.sst_matriz_versoes(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  rotulo text NOT NULL,
  valor_min integer NOT NULL,
  valor_max integer NOT NULL,
  cor_hex text,
  decisao text,
  exige_acao boolean NOT NULL DEFAULT false,
  ordem smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (versao_id, codigo)
);

ALTER TABLE public.sst_matriz_niveis DROP CONSTRAINT IF EXISTS sst_matriz_nivel_faixa_chk;
ALTER TABLE public.sst_matriz_niveis ADD CONSTRAINT sst_matriz_nivel_faixa_chk
  CHECK (valor_max >= valor_min AND valor_min >= 0);

COMMENT ON COLUMN public.sst_matriz_niveis.decisao IS
  'Decisão associada à faixa (NR-01 1.5.4.4.3): o que a organização faz ao classificar um risco aqui.';
COMMENT ON COLUMN public.sst_matriz_niveis.exige_acao IS
  'Se true, riscos nesta faixa entram obrigatoriamente no plano de ação.';

-- ---------------------------------------------------------------------------
-- Índices, triggers e RLS
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS sst_matriz_metodo_empresa_idx ON public.sst_matriz_metodos (empresa_id);
CREATE INDEX IF NOT EXISTS sst_matriz_versao_metodo_idx ON public.sst_matriz_versoes (metodo_id, status);
CREATE INDEX IF NOT EXISTS sst_matriz_escala_versao_idx ON public.sst_matriz_escalas (versao_id, tipo, valor);
CREATE INDEX IF NOT EXISTS sst_matriz_nivel_versao_idx ON public.sst_matriz_niveis (versao_id, ordem);

DROP TRIGGER IF EXISTS trg_sst_matriz_metodo_upd ON public.sst_matriz_metodos;
CREATE TRIGGER trg_sst_matriz_metodo_upd BEFORE UPDATE ON public.sst_matriz_metodos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_sst_matriz_versao_upd ON public.sst_matriz_versoes;
CREATE TRIGGER trg_sst_matriz_versao_upd BEFORE UPDATE ON public.sst_matriz_versoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_matriz_metodos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_matriz_versoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_matriz_escalas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_matriz_niveis  TO authenticated;
GRANT ALL ON public.sst_matriz_metodos TO service_role;
GRANT ALL ON public.sst_matriz_versoes TO service_role;
GRANT ALL ON public.sst_matriz_escalas TO service_role;
GRANT ALL ON public.sst_matriz_niveis  TO service_role;

ALTER TABLE public.sst_matriz_metodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_matriz_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_matriz_escalas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_matriz_niveis  ENABLE ROW LEVEL SECURITY;

-- Leitura: métodos globais (empresa_id NULL) são visíveis a todos; os do tenant,
-- só à sua árvore de empresas.
DROP POLICY IF EXISTS sst_matriz_metodo_select ON public.sst_matriz_metodos;
CREATE POLICY sst_matriz_metodo_select ON public.sst_matriz_metodos FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR public.is_super_admin(auth.uid())
         OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));

-- Escrita: só métodos do próprio tenant. Os globais são do sistema e não podem
-- ser alterados por um cliente — alterá-los mudaria a classificação de todos.
DROP POLICY IF EXISTS sst_matriz_metodo_write ON public.sst_matriz_metodos;
CREATE POLICY sst_matriz_metodo_write ON public.sst_matriz_metodos FOR ALL TO authenticated
  USING (empresa_id IS NOT NULL AND (public.is_super_admin(auth.uid())
         OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id)))
  WITH CHECK (empresa_id IS NOT NULL AND (public.is_super_admin(auth.uid())
         OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id)));

-- Tabelas-filhas herdam a visibilidade do método pai.
DROP POLICY IF EXISTS sst_matriz_versao_all ON public.sst_matriz_versoes;
CREATE POLICY sst_matriz_versao_all ON public.sst_matriz_versoes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sst_matriz_metodos m WHERE m.id = metodo_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sst_matriz_metodos m
                       WHERE m.id = metodo_id AND m.empresa_id IS NOT NULL));

DROP POLICY IF EXISTS sst_matriz_escala_all ON public.sst_matriz_escalas;
CREATE POLICY sst_matriz_escala_all ON public.sst_matriz_escalas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sst_matriz_versoes v WHERE v.id = versao_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sst_matriz_versoes v
                       JOIN public.sst_matriz_metodos m ON m.id = v.metodo_id
                      WHERE v.id = versao_id AND m.empresa_id IS NOT NULL));

DROP POLICY IF EXISTS sst_matriz_nivel_all ON public.sst_matriz_niveis;
CREATE POLICY sst_matriz_nivel_all ON public.sst_matriz_niveis FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sst_matriz_versoes v WHERE v.id = versao_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sst_matriz_versoes v
                       JOIN public.sst_matriz_metodos m ON m.id = v.metodo_id
                      WHERE v.id = versao_id AND m.empresa_id IS NOT NULL));

-- ---------------------------------------------------------------------------
-- Seed: a matriz 5x5 hoje cravada em código vira dado
-- ---------------------------------------------------------------------------
DO $seed$
DECLARE _m uuid; _v uuid;
BEGIN
  SELECT id INTO _m FROM public.sst_matriz_metodos
   WHERE empresa_id IS NULL AND nome = 'Matriz 5x5 padrão';
  IF _m IS NULL THEN
    INSERT INTO public.sst_matriz_metodos (empresa_id, nome, descricao)
    VALUES (NULL, 'Matriz 5x5 padrão',
      'Método padrão do sistema: nível de risco = severidade x probabilidade, com cinco faixas de classificação.')
    RETURNING id INTO _m;
  END IF;

  SELECT id INTO _v FROM public.sst_matriz_versoes WHERE metodo_id = _m AND versao = 1;
  IF _v IS NULL THEN
    INSERT INTO public.sst_matriz_versoes
      (metodo_id, versao, status, vigencia_inicio, motivo_alteracao, publicada_em)
    VALUES (_m, 1, 'vigente', current_date,
      'Versão inicial — formalização da matriz que estava cravada em código.', now())
    RETURNING id INTO _v;

    INSERT INTO public.sst_matriz_escalas (versao_id, tipo, valor, rotulo, definicao) VALUES
      (_v,'severidade',1,'Insignificante','Sem lesão ou lesão sem afastamento; sem dano à saúde.'),
      (_v,'severidade',2,'Pequena','Lesão leve com afastamento inferior a 15 dias; efeito reversível.'),
      (_v,'severidade',3,'Moderada','Lesão com afastamento superior a 15 dias; doença ocupacional reversível.'),
      (_v,'severidade',4,'Grande','Incapacidade parcial permanente; doença ocupacional irreversível.'),
      (_v,'severidade',5,'Catastrófica','Óbito ou incapacidade total permanente; múltiplas vítimas.'),
      (_v,'probabilidade',1,'Raro','Não há histórico; ocorrência improvável nas condições atuais.'),
      (_v,'probabilidade',2,'Improvável','Pode ocorrer em circunstâncias excepcionais.'),
      (_v,'probabilidade',3,'Possível','Já ocorreu no setor ou em atividade semelhante.'),
      (_v,'probabilidade',4,'Provável','Ocorre com alguma frequência; controles insuficientes.'),
      (_v,'probabilidade',5,'Quase certo','Ocorrência esperada na rotina; ausência de controles eficazes.');

    INSERT INTO public.sst_matriz_niveis
      (versao_id, codigo, rotulo, valor_min, valor_max, cor_hex, exige_acao, ordem, decisao) VALUES
      (_v,'trivial','Trivial',1,3,'#10b981',false,1,
        'Não requer ação adicional; manter os controles existentes.'),
      (_v,'toleravel','Tolerável',4,8,'#84cc16',false,2,
        'Manter monitoramento e os controles existentes; avaliar melhorias de baixo custo.'),
      (_v,'moderado','Moderado',9,12,'#eab308',true,3,
        'Requer plano de ação com prazo definido para reduzir o risco.'),
      (_v,'substancial','Substancial',13,15,'#f97316',true,4,
        'Requer ação prioritária; não iniciar ou não manter a atividade sem controles adicionais.'),
      (_v,'intoleravel','Intolerável',16,25,'#dc2626',true,5,
        'Interromper a atividade até que o risco seja reduzido; ação imediata.');
  END IF;
END $seed$;

-- ---------------------------------------------------------------------------
-- Classificação orientada a dados
-- ---------------------------------------------------------------------------
-- Consulta as faixas da versão informada. Quando não há versão (PGR anterior a
-- esta fase), cai na função padrão — nenhuma classificação existente muda.
CREATE OR REPLACE FUNCTION public.pgr_classificar_risco_versao(
  _versao_id uuid, _sev int, _prob int)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $$
DECLARE _n int; _cod text;
BEGIN
  IF _sev IS NULL OR _prob IS NULL THEN RETURN NULL; END IF;
  IF _versao_id IS NULL THEN
    RETURN public.pgr_classificar_risco(_sev, _prob);
  END IF;
  _n := _sev * _prob;
  SELECT codigo INTO _cod FROM public.sst_matriz_niveis
   WHERE versao_id = _versao_id AND _n BETWEEN valor_min AND valor_max
   ORDER BY ordem LIMIT 1;
  RETURN _cod;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pgr_classificar_risco_versao(uuid,int,int) FROM anon;

COMMENT ON FUNCTION public.pgr_classificar_risco_versao(uuid,int,int) IS
  'Classifica consultando as faixas da versão de matriz informada. Sem versão, delega para pgr_classificar_risco (matriz padrão) — garante que PGRs anteriores mantenham sua classificação.';

-- ---------------------------------------------------------------------------
-- Trava da matriz no PGR
-- ---------------------------------------------------------------------------
ALTER TABLE public.pgr_documentos
  ADD COLUMN IF NOT EXISTS matriz_versao_id uuid
    REFERENCES public.sst_matriz_versoes(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.pgr_documentos.matriz_versao_id IS
  'Versão da matriz travada para este PGR. Os itens do inventário herdam este valor: é o que impede misturar matrizes na mesma versão do documento.';

-- matriz_versao_id do item passa a ter FK e a ser HERDADO do documento.
ALTER TABLE public.pgr_inventario_itens
  DROP CONSTRAINT IF EXISTS pgr_inv_matriz_versao_fk;
ALTER TABLE public.pgr_inventario_itens
  ADD CONSTRAINT pgr_inv_matriz_versao_fk
  FOREIGN KEY (matriz_versao_id) REFERENCES public.sst_matriz_versoes(id) ON DELETE RESTRICT;

-- O guard passa a herdar a matriz do documento e classificar por ela.
CREATE OR REPLACE FUNCTION public.pgr_child_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _emp uuid; _matriz uuid; _exige boolean;
BEGIN
  SELECT empresa_id, matriz_versao_id INTO _emp, _matriz
    FROM public.pgr_documentos WHERE id = NEW.pgr_id;
  IF _emp IS NULL THEN RAISE EXCEPTION 'PGR inexistente'; END IF;
  NEW.empresa_id := _emp;

  IF TG_TABLE_NAME = 'pgr_inventario_itens' THEN
    -- Herda sempre do documento: o item nunca escolhe a própria matriz.
    NEW.matriz_versao_id := _matriz;
    NEW.classificacao := public.pgr_classificar_risco_versao(
      _matriz, NEW.severidade, NEW.probabilidade);
    NEW.classificacao_inicial := public.pgr_classificar_risco_versao(
      _matriz, NEW.severidade_inicial, NEW.probabilidade_inicial);
    NEW.classificacao_residual := public.pgr_classificar_risco_versao(
      _matriz, NEW.severidade_residual, NEW.probabilidade_residual);

    -- exige_acao vem da faixa da matriz; sem matriz, mantém a regra padrão.
    IF _matriz IS NOT NULL AND NEW.classificacao IS NOT NULL THEN
      SELECT n.exige_acao INTO _exige FROM public.sst_matriz_niveis n
       WHERE n.versao_id = _matriz AND n.codigo = NEW.classificacao;
      NEW.necessita_acao := COALESCE(_exige, false);
    ELSE
      NEW.necessita_acao := COALESCE(
        NEW.classificacao IN ('moderado','substancial','intoleravel'), false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pgr_child_guard() FROM anon, authenticated, PUBLIC;

-- O CHECK de classificação deixa de listar códigos fixos: os nomes das classes
-- agora vêm da matriz, que é configurável. A integridade passa a ser garantida
-- pela FK da versão + pelo fato de o trigger só gravar códigos existentes nela.
ALTER TABLE public.pgr_inventario_itens
  DROP CONSTRAINT IF EXISTS pgr_inv_classificacao_chk;

-- Todo PGR sem matriz explícita passa a usar a versão padrão vigente.
UPDATE public.pgr_documentos d
   SET matriz_versao_id = (
        SELECT v.id FROM public.sst_matriz_versoes v
          JOIN public.sst_matriz_metodos m ON m.id = v.metodo_id
         WHERE m.empresa_id IS NULL AND m.nome = 'Matriz 5x5 padrão'
           AND v.status = 'vigente' ORDER BY v.versao DESC LIMIT 1)
 WHERE d.matriz_versao_id IS NULL;

CREATE INDEX IF NOT EXISTS pgr_doc_matriz_idx
  ON public.pgr_documentos (matriz_versao_id) WHERE matriz_versao_id IS NOT NULL;

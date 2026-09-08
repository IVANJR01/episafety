-- Unifica funcionários repetidos e impede que apareçam de novo.
--
-- O caso que originou isto: LUANDSON ALVES BEZERRA aparecia três vezes na
-- lista, com o mesmo CPF e na mesma empresa. Dois registros nasceram com 1,16 s
-- de diferença (clique duplo no botão de cadastrar, já corrigido na tela) e o
-- terceiro estava lá desde março.
--
-- Ao todo eram 3 CPFs repetidos, 4 registros a mais. Conferido antes de mexer:
-- nos três casos é a MESMA pessoa (mesmo nome, mesmo CPF, mesma empresa), não
-- CPF digitado errado em gente diferente — o que exigiria o contrário, separar.
--
-- Por que a ordem importa: 23 tabelas apontam para `funcionarios`, e a maioria
-- com ON DELETE CASCADE. Apagar um registro antes de mover os vínculos levaria
-- junto entregas, ASOs, exames, treinamentos e documentos dele.

-- ---------------------------------------------------------------------------
-- 1. Guarda o que vai sair. Unificação é irreversível; com esta cópia, não é.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funcionarios_unificados_backup (
  id UUID PRIMARY KEY,
  unificado_em UUID NOT NULL,
  dados JSONB NOT NULL,
  quando TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcionarios_unificados_backup ENABLE ROW LEVEL SECURITY;
-- Só quem administra o sistema lê o backup: são dados pessoais de colaborador.
DROP POLICY IF EXISTS "backup unificacao apenas service role" ON public.funcionarios_unificados_backup;
CREATE POLICY "backup unificacao apenas service role"
  ON public.funcionarios_unificados_backup FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 2. Quem fica: o cadastro mais completo; empatando, o mais antigo.
--    O mais completo é o que tem cargo, admissão, GHE, matrícula preenchidos —
--    no caso do LUANDSON, o de março, que trazia "AUX DE BORDADO" e a data de
--    admissão que os de hoje não têm.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unificar_funcionarios_duplicados()
RETURNS TABLE(cpf TEXT, mantido UUID, removidos INT, vinculos_movidos INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g RECORD; alvo UUID; outros UUID[]; r RECORD; movidos INT; n INT;
BEGIN
  FOR g IN
    SELECT empresa_id, regexp_replace(coalesce(f.cpf,''),'\D','','g') AS cpf_num
    FROM funcionarios f
    WHERE coalesce(f.cpf,'') <> ''
    GROUP BY empresa_id, regexp_replace(coalesce(f.cpf,''),'\D','','g')
    HAVING count(*) > 1
  LOOP
    SELECT f.id INTO alvo FROM funcionarios f
    WHERE f.empresa_id = g.empresa_id
      AND regexp_replace(coalesce(f.cpf,''),'\D','','g') = g.cpf_num
    ORDER BY
      (CASE WHEN f.cargo IS NOT NULL AND btrim(f.cargo) <> '' THEN 1 ELSE 0 END
       + CASE WHEN f.data_admissao IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN f.ghe_id IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN f.matricula IS NOT NULL AND btrim(f.matricula) <> '' THEN 1 ELSE 0 END
       + CASE WHEN f.unidade_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
      f.created_at ASC
    LIMIT 1;

    SELECT array_agg(f.id) INTO outros FROM funcionarios f
    WHERE f.empresa_id = g.empresa_id
      AND regexp_replace(coalesce(f.cpf,''),'\D','','g') = g.cpf_num
      AND f.id <> alvo;

    INSERT INTO funcionarios_unificados_backup (id, unificado_em, dados)
    SELECT f.id, alvo, to_jsonb(f) FROM funcionarios f WHERE f.id = ANY(outros)
    ON CONFLICT (id) DO NOTHING;

    -- Move TODO vínculo, em todas as tabelas que apontam para funcionários.
    -- Percorrer o catálogo em vez de listar à mão: tabela nova criada depois
    -- desta migração entra sozinha, em vez de ficar esquecida.
    movidos := 0;
    FOR r IN
      SELECT tc.table_name AS t, kcu.column_name AS c
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' AND ccu.table_name='funcionarios'
    LOOP
      EXECUTE format('UPDATE public.%I SET %I = %L WHERE %I = ANY(%L)', r.t, r.c, alvo, r.c, outros);
      GET DIAGNOSTICS n = ROW_COUNT;
      movidos := movidos + n;
    END LOOP;

    -- Campo que só o registro perdido tinha não pode sumir junto com ele.
    UPDATE funcionarios alvo_f SET
      cargo = coalesce(nullif(btrim(alvo_f.cargo),''), (SELECT nullif(btrim(o.cargo),'') FROM funcionarios o WHERE o.id = ANY(outros) AND nullif(btrim(o.cargo),'') IS NOT NULL LIMIT 1)),
      data_admissao = coalesce(alvo_f.data_admissao, (SELECT o.data_admissao FROM funcionarios o WHERE o.id = ANY(outros) AND o.data_admissao IS NOT NULL LIMIT 1)),
      ghe_id = coalesce(alvo_f.ghe_id, (SELECT o.ghe_id FROM funcionarios o WHERE o.id = ANY(outros) AND o.ghe_id IS NOT NULL LIMIT 1)),
      matricula = coalesce(nullif(btrim(alvo_f.matricula),''), (SELECT nullif(btrim(o.matricula),'') FROM funcionarios o WHERE o.id = ANY(outros) AND nullif(btrim(o.matricula),'') IS NOT NULL LIMIT 1)),
      unidade_id = coalesce(alvo_f.unidade_id, (SELECT o.unidade_id FROM funcionarios o WHERE o.id = ANY(outros) AND o.unidade_id IS NOT NULL LIMIT 1)),
      setor = coalesce(nullif(btrim(alvo_f.setor),''), (SELECT nullif(btrim(o.setor),'') FROM funcionarios o WHERE o.id = ANY(outros) AND nullif(btrim(o.setor),'') IS NOT NULL LIMIT 1))
    WHERE alvo_f.id = alvo;

    DELETE FROM funcionarios f WHERE f.id = ANY(outros);

    cpf := g.cpf_num; mantido := alvo; removidos := array_length(outros,1); vinculos_movidos := movidos;
    RETURN NEXT;
  END LOOP;
END $$;

SELECT * FROM public.unificar_funcionarios_duplicados();

-- ---------------------------------------------------------------------------
-- 3. Trava para não voltar a acontecer, nem por importação nem por clique
--    duplo: o mesmo CPF não pode existir duas vezes na mesma empresa.
--    Só vale para CPF preenchido — cadastro sem CPF continua permitido.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS funcionarios_cpf_unico_por_empresa
  ON public.funcionarios (empresa_id, (regexp_replace(coalesce(cpf,''), '\D', '', 'g')))
  WHERE coalesce(cpf,'') <> '';

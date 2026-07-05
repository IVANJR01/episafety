
# PGR — Modelo padrão SafetySoluções

Objetivo: fazer o PGR gerado pelo sistema seguir a estrutura do seu documento "PGR G91 2025.2027", mas de forma dinâmica (dados da empresa + GES/GHE + inventário + EPIs + plano de ação) e com PDF mais profissional. Escopo restrito a **Programas / PGR / Inventário / Plano de Ação / GES**. Nada de EPI/Entregas/Inspeções/Exames/RH será tocado.

## Escopo desta entrega (fase 1)

Como o pedido é muito amplo, proponho entregar em fase única e enxuta o que dá base para tudo o resto funcionar. Sem essa base, o resto vira retrabalho.

### 1. Estrutura de textos padrão editáveis
Nova tabela `pgr_textos` (por `pgr_id`) com as seções fixas do seu modelo:
introdução, apresentação, registro e divulgação, objetivo geral, objetivos específicos, política de segurança, responsabilidades do empregador, responsabilidades dos empregados, segurança do trabalho, CIPA, considerações preliminares, área de abrangência, recomendações, considerações finais, encerramento.

- Ao criar um PGR, essas seções são semeadas com textos-padrão do SafetySoluções.
- Nova aba **"Textos"** no PGR permite editar cada seção (rich textarea) antes de gerar o PDF.
- Botão "Restaurar padrão" por seção.

### 2. Controle de revisões visível no PDF
Já existe `pgr_revisoes`. Vou:
- Exibir a tabela "Controle de Revisões" (Revisão / Data / Descrição) na aba Resumo.
- Incluir a mesma tabela no PDF, logo após a capa.

### 3. Matriz de risco — alinhar ao seu modelo (5×5, Trivial→Intolerável)
Hoje a matriz do sistema classifica em baixo/moderado/alto/crítico. Vou **adicionar** o padrão do seu documento como opção default:
- 1–3 Trivial · 4–8 Tolerável · 9–12 Moderado · 13–15 Substancial · 16–25 Intolerável
- Mantém retrocompat: itens antigos continuam lendo o campo `classificacao` atual.
- Novo helper `classificarRiscoPGR()` em `pgrMatriz.ts` e labels/cores novas.
- Inventário e PDF passam a mostrar essa classificação.

### 4. Quadro sinóptico de EPIs (novo)
Nova aba **"EPIs (Quadro Sinóptico)"** no PGR que consolida, a partir do inventário + GES:
- GHE/GES · Função · Medida de controle existente · EPIs indicados (CA)
- Fonte: `pgr_inventario_itens.ghe_id` → `ghe_ges` → `ghe_funcoes` + EPIs do GES.
- Renderiza no PDF como tabela dedicada.

### 5. PDF profissional (reformulação de `pgrPdf.ts`)
Manter a estrutura do seu DOCX, mas com visual SafetySoluções:
- Capa com logo da empresa, nome do documento, período de vigência, versão.
- Sumário automático.
- Cabeçalho fixo (empresa + versão) e rodapé com paginação "Página X de Y".
- Seções na ordem do seu modelo (item 1 do prompt).
- Tabelas com zebra, bordas discretas, cores neutras.
- Assinatura do responsável técnico ao final.

### 6. Segurança / integridade
- `pgr_textos` com RLS por `empresa_id` + GRANTs (authenticated/service_role).
- Nenhuma policy afrouxada em outros módulos.
- Nada muda em EPIs/Entregas/Inspeções/Exames/RH/Termos/MFA/Storage.

## O que **não** entra nesta entrega (proponho fases seguintes)

Para não estourar o escopo em uma única mudança e não quebrar o que já funciona, deixo para próximas iterações — cada uma isolada e reversível:

- **Sugestão automática de ações** para riscos Moderado/Substancial/Intolerável (item 10). Precisa de UX de aprovação em lote — merece PR próprio.
- **Geração de PGR consolidado "todas as unidades"** (item 3, terceira opção). Hoje o PGR é por empresa/unidade; consolidar exige nova modelagem de escopo.
- **Editor rich-text (WYSIWYG)** dos textos. Fase 1 usa `<Textarea>` grande — funcional e sem dependências novas.
- **Assinatura digital com imagem** no PDF (item 4 "assinatura, se existir"). Já temos `pgr_assinaturas`; incorporar imagem no PDF pode ir na fase 2.

## Detalhes técnicos

### Migração SQL
```sql
CREATE TABLE public.pgr_textos (
  id uuid PK default gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  secao text NOT NULL,          -- 'introducao','apresentacao',...
  conteudo text NOT NULL,
  updated_at timestamptz default now(),
  UNIQUE (pgr_id, secao)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.pgr_textos TO authenticated;
GRANT ALL ON public.pgr_textos TO service_role;
ALTER TABLE public.pgr_textos ENABLE ROW LEVEL SECURITY;
-- policies usando is_in_user_company_tree(empresa_id)

-- Função pgr_seed_textos(_pgr_id uuid) SECURITY DEFINER: cria linhas padrão.
-- Trigger AFTER INSERT em pgr_documentos que chama pgr_seed_textos.
```

### Arquivos previstos
- `supabase/migrations/…_pgr_textos.sql`
- `src/lib/pgrTextosPadrao.ts` (conteúdo default de cada seção)
- `src/lib/pgrMatriz.ts` (adicionar `classificarRiscoPGR`, labels Trivial/Tolerável/…)
- `src/components/pgr/TextosTab.tsx` (nova aba)
- `src/components/pgr/QuadroEpisTab.tsx` (nova aba)
- `src/lib/pgrPdf.ts` (reescrita do layout — mantém API pública)
- `src/pages/pgr/PgrDetalhe.tsx` (adicionar as duas abas)

### O que **não** será alterado
`src/components/pgr/InventarioTab.tsx` (mantém como está — já importa GES corretamente). Regras de importação de GES, dedup e RLS permanecem intactas.

## Confirmações antes de começar

1. Ok classificar risco pelo seu padrão (Trivial→Intolerável) como **default do PGR**, mantendo o antigo apenas como legado nos itens já salvos?
2. Ok usar `<Textarea>` grande para editar os textos nesta fase (sem WYSIWYG)?
3. Confirma que **não** quero neste PR: sugestão automática de plano de ação, PGR consolidado multi-unidade e assinatura por imagem no PDF (ficam para próxima iteração)?

Assim que você confirmar, executo a migração, escrevo os arquivos acima e reescrevo o PDF.

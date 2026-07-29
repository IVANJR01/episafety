# Migrations pendentes

Esta pasta guarda cópias prontas para colar no **SQL Editor do Supabase**
quando uma migration precisa ser aplicada à mão — o ambiente de
desenvolvimento não alcança o banco de produção (o proxy bloqueia o host e só
há a chave pública, que lê e grava linhas mas não altera estrutura).

**Neste momento não há nada pendente.**

As migrations aplicadas ficam apenas em `supabase/migrations/`, que é o
histórico oficial. Manter cópia aqui depois de aplicada só confunde: dá a
entender que ainda falta rodar alguma coisa.

## Já aplicadas (não precisam ser rodadas de novo)

| Quando | Migration | O que fez |
|---|---|---|
| 28/07/2026 | `20260728000000_sst_atividades_e_contexto.sql` | Criou `sst_atividades` e o contexto hierárquico do inventário |
| 28/07/2026 | `20260728000100_sst_coletas_campo.sql` | Criou as tabelas do levantamento em campo |
| 29/07/2026 | `20260729120000_solicitacoes_materiais_rls_empresa_ativa.sql` | RLS da solicitação de materiais alinhada ao modelo de empresa ativa |

## Quando surgir uma nova

1. A migration entra em `supabase/migrations/` (histórico).
2. Uma cópia é colocada aqui e esta lista passa a apontá-la como pendente.
3. Depois de aplicada, a cópia sai e a linha vem para a tabela acima.

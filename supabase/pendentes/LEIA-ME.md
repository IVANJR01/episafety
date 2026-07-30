# Migrations pendentes

Esta pasta guarda cópias prontas para colar no **SQL Editor do Supabase**
quando uma migration precisa ser aplicada à mão — o ambiente de
desenvolvimento não alcança o banco de produção (o proxy bloqueia o host e só
há a chave pública, que lê e grava linhas mas não altera estrutura).

## Pendente agora

| Arquivo | O que faz |
|---|---|
| `APLICAR_BUCKET_LOGO.sql` | Cria o bucket `company-logos` e alinha as permissões dele ao modelo de empresa ativa. Sem ele, enviar a logo em Empresas / Unidades devolve **"Bucket not found"**. |
| `DIAGNOSTICO_INSPECOES_CG3.sql` | **Só consulta, não altera nada.** Mostra o que existe de verdade: inspeções por empresa e por local, quais têm foto, fotos no Storage e obras cadastradas. Rode primeiro. |
| `RESTAURAR_INSPECOES_BARROCAS.sql` | Grava as **22 inspeções** da CG3 (Barrocas 6, Alojamento Alto Rodrigues 9, Mossoró 5, Estreito 2) na CG3 ENGENHARIA. O texto veio do relatório original em PDF de 07/07/2026, não da cópia do código — que tinha só 15 e não trazia a nº 22, de Barrocas. As 22 fotos "ANTES" também foram recuperadas do PDF e entregues em arquivo à parte; precisam ser anexadas pela tela. |

> O bucket `solicitacoes-materiais-imagens` já foi criado (confirmado no banco
> em 29/07), então `APLICAR_BUCKET_IMAGENS.sql` saiu daqui.
>
> Os dois casos foram o mesmo defeito: uma migration antiga criou as *policies*
> do bucket e esqueceu de criar o bucket. Ao mexer em storage, criar sempre os
> dois na mesma migration.

As migrations aplicadas ficam apenas em `supabase/migrations/`, que é o
histórico oficial. Manter cópia aqui depois de aplicada só confunde: dá a
entender que ainda falta rodar alguma coisa.

## Já aplicadas (não precisam ser rodadas de novo)

| Quando | Migration | O que fez |
|---|---|---|
| 28/07/2026 | `20260728000000_sst_atividades_e_contexto.sql` | Criou `sst_atividades` e o contexto hierárquico do inventário |
| 28/07/2026 | `20260728000100_sst_coletas_campo.sql` | Criou as tabelas do levantamento em campo |
| 29/07/2026 | `20260729120000_solicitacoes_materiais_rls_empresa_ativa.sql` | RLS da solicitação de materiais alinhada ao modelo de empresa ativa |
| 29/07/2026 | `20260729180000_bucket_solicitacoes_materiais_imagens.sql` | Criou o bucket das imagens da solicitação de materiais |

## Quando surgir uma nova

1. A migration entra em `supabase/migrations/` (histórico).
2. Uma cópia é colocada aqui e esta lista passa a apontá-la como pendente.
3. Depois de aplicada, a cópia sai e a linha vem para a tabela acima.

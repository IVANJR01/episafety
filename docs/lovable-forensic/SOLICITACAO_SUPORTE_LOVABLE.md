# SOLICITAÇÃO DE PORTABILIDADE E RECUPERAÇÃO — LOVABLE CLOUD

**Para:** Lovable Support / Trust & Safety
**De:** IVANJR01 (proprietário do projeto)
**Email autenticado:** ivanjr.tstconsultoria@gmail.com
**Data:** 2026-07-25

---

## Identificação do Projeto

- **Nome do projeto:** SafetySoluções / EPISAFETY
- **Lovable Project ID:** `311e7f73-7e41-4c23-9d0d-f395fff59a3d`
- **Workspace ID:** `v4ACaX3BuuzlVZfllZ06`
- **URL publicada:** https://episafety.lovable.app
- **Editor:** https://lovable.dev/projects/311e7f73-7e41-4c23-9d0d-f395fff59a3d
- **Repositório GitHub oficial:** https://github.com/IVANJR01/episafety
- **Backend Supabase-gerenciado (Cloud):** `bccqjqimbjzskyexpjca`

## Prova de propriedade

- Proprietário autenticado da conta Lovable via email acima
- Proprietário do repositório GitHub `IVANJR01/episafety` (mesmo email)
- Histórico Git preservado desde 2026-03-09 mostrando commits dos bots oficiais da Lovable (`gpt-engineer-app[bot]`)
- Referência ao backend `bccqjqimbjzskyexpjca` presente em código, `.env` e `supabase/config.toml` gerados pela plataforma
- Página administrativa nativa (`src/pages/admin/AdminCloud.tsx`) descreve explicitamente operação em Lovable Cloud

## Situação atual

O projeto foi objeto de **Website Takedown Notice / suspensão** pela equipe Trust & Safety, resultando em HTTP 403 no editor e no acesso ao Cloud. A produção foi migrada para hospedagem própria em Vercel apontando para novo projeto Supabase (`estmuducawmftvpbeutm`), mas com perdas significativas de dados de Storage.

## Solicitações formais (todas em conformidade com direitos de portabilidade)

Requer-se, com máxima urgência e antes de qualquer ação destrutiva sobre a instância:

1. **Confirmação por escrito** da existência da Lovable Cloud associada ao projeto e do seu Cloud Project ID.
2. **Preservação imediata** dos dados da instância — congelar snapshots atuais até conclusão da portabilidade.
3. **Dump completo do banco PostgreSQL** (`pg_dump` ou equivalente), incluindo schema `public`, `auth`, `storage`, com todos os dados.
4. **Exportação de `auth.users`** com metadados: `user_id`, `email`, `email_confirmed_at`, `created_at`, `last_sign_in_at`, `providers`, `raw_user_meta_data`. (Não requerido hashes de senha.)
5. **Download completo do Storage** — todos os 8 buckets:
   - `logos`, `inspecoes`, `conformidades`, `fotos-reconhecimento`, `backups`, `videos-treinamento`, `documentos-treinamento`, `empresa-assets`
   Preferencialmente como tar.gz mantendo estrutura de pastas e content-type.
6. **Código-fonte das Edge Functions** deployadas na instância (verificação de que corresponde ao GitHub).
7. **Nomes (não os valores) dos Secrets configurados** para conferência com o inventário do repositório.
8. **Configuração dos Jobs/Cron** ativos, especialmente o `scheduled-backup` (semanal, domingos 03:00).
9. **Logs sanitizados** dos últimos 90 dias — Authentication, PostgreSQL, Storage, Edge Functions, Cron — sem tokens/cookies/senhas.
10. **Lista de snapshots de backup** disponíveis no Cloud com timestamp UTC e período de retenção.
11. **Configurações de projeto**: região, instance size, custom domains, redirect URLs de Auth, provedores OAuth habilitados.
12. **Restauração temporária** (janela de 72h, se possível) de acesso somente-leitura ao Cloud para exportação supervisionada.
13. **Confirmação escrita de que nenhuma ação destrutiva** será executada sobre o Cloud enquanto esta solicitação estiver pendente.

## Compromissos do proprietário

- Não haverá contestação de decisão de Trust & Safety — apenas exercício do direito de portabilidade dos próprios dados.
- Os dados exportados serão migrados exclusivamente para infraestrutura de propriedade do requerente (Supabase próprio + Vercel).
- Nenhum uso será feito para reativar o preview `episafety.lovable.app` sem autorização prévia.

## Contato

- Email primário: ivanjr.tstconsultoria@gmail.com
- Repositório GitHub para eventual entrega segura de arquivos: https://github.com/IVANJR01/episafety
- Alternativamente, upload direto para link privado do Google Drive do requerente

---

Aguardo confirmação de recebimento e prazo estimado para atendimento.

Atenciosamente,
Ivan Junior — IVANJR01

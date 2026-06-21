# Módulo LTCAT — Relatório Técnico Final (Partes 1 a 6)

Laudo Técnico das Condições Ambientais do Trabalho — Lei 8.213/91 art. 58 e Decreto 3.048/99.

## Tabelas criadas (`public.ltcat_*`)
- `ltcat_documentos` — versionamento, status, vigência, vínculo com PGR e unidade.
- `ltcat_revisoes` — histórico append-only (sem update/delete) de aberturas e publicações.
- `ltcat_responsaveis_tecnicos` — RTs por LTCAT (nome, CREA/CRM, formação, vínculo).
- `ltcat_setores_avaliados` — snapshot de setores avaliados.
- `ltcat_grupos_homogeneos` — GHE/GES por LTCAT (snapshot, descrição da atividade, nº de trabalhadores).
- `ltcat_funcoes` — funções vinculadas ao GHE (com link opcional para `aso_funcoes`).
- `ltcat_catalogo_agentes` — catálogo global (somente leitura) + customizados por empresa.
- `ltcat_agentes` — agentes nocivos por GHE/LTCAT, exposição, EPI/EPC e eficácia (`sim|nao|parcial`).
- `ltcat_avaliacoes` — quantitativas/qualitativas, técnica, instrumento, calibração, certificado no Drive.
- `ltcat_conclusoes` — conclusão por GHE × função, com snapshot JSONB de agentes considerados.
- `ltcat_anexos` — anexos genéricos (metadados; binário no Google Drive).
- `ltcat_pdf_versoes` — metadados de PDF + SHA-256 + Drive ID (tipos `rascunho` / `final`).
- `ltcat_assinaturas` — assinatura visual interna, com `auth_aal` (AAL2) e timestamp.

Auxiliares já existentes reutilizados: `audit_log`, `mfa_enforcement`, `usuario_empresas`, `empresa_config`, `aso_funcoes`, `pgr_*`.

## Permissões (`ltcat:*`)
`ltcat:view`, `ltcat:create`, `ltcat:edit`, `ltcat:delete`, `ltcat:publicar`, `ltcat:assinar`, `ltcat:gerar_pdf_final`, `ltcat:gerenciar_catalogo`.

## RLS
- Todas as tabelas `ltcat_*` com RLS habilitada.
- `anon`: sem `GRANT EXECUTE` em nenhuma RPC; `SELECT` apenas em recursos públicos não-LTCAT.
- `authenticated`: leitura restrita a `empresa_id` no escopo (`usuario_empresas` + `empresa_pai_id`).
- `service_role`: acesso total para edge functions/admin.

## Triggers
- `ltcat_block_when_imutavel` (BEFORE INSERT/UPDATE/DELETE em todas as tabelas filhas) — bloqueia mutação quando o LTCAT pai está em `vigente`, `substituido` ou `arquivado`.
- `ltcat_documento_audit` — audit_log de criação, edição e mudança de status.
- `ltcat_revisao_append_only` — impede `UPDATE`/`DELETE` em `ltcat_revisoes`.
- `ltcat_conclusao_validate` — exige MFA AAL2 + fundamento legal nas conclusões especiais e justificativa robusta para não-especial com exposição acima do LT.
- `ltcat_touch_conteudo` — atualiza `ltcat_documentos.conteudo_atualizado_em` em qualquer alteração de conteúdo, usado para detectar PDFs desatualizados.
- `set_updated_at` em todas as tabelas.

## RPCs (`SECURITY DEFINER`, `EXECUTE` revogado de `anon`/`PUBLIC`)
- `ltcat_abrir_revisao(_ltcat_id, _motivo)`
- `ltcat_publicar(_ltcat_id)` — exige MFA AAL2, ≥1 RT, ≥1 GHE, ≥1 agente, ≥1 avaliação, ≥1 conclusão válida, PDF final atualizado e assinatura visual registrada.
- `ltcat_importar_avaliacoes_pgr(_ltcat_id, _pgr_id)` — dedupe por `(ltcat_id, pgr_id, agente_id, técnica, data)`.
- `ltcat_pdf_registrar(_ltcat_id, _tipo, _sha256, _drive_id, _drive_link)`
- `ltcat_assinar_visual(_ltcat_id, _nome, _papel, _drive_id, _imagem_link)` — exige AAL2.
- `ltcat_validar_interno(_id)` — usada pela rota `/ltcat/validar/:id`.

## Telas
- `/ltcat` — lista com filtros (status, unidade, PGR, vigência) e export CSV via Dashboard.
- `/ltcat/dashboard` — Dashboard consolidado por empresa/matriz, com filtros, indicadores e exportações.
- `/ltcat/novo` e `/ltcat/:id/editar` — cadastro/edição (apenas em `rascunho`/`em_revisao`).
- `/ltcat/:id` — detalhe com abas:
  - **Resumo**
  - **Responsáveis Técnicos**
  - **Setores / GHE**
  - **Funções**
  - **Agentes e Avaliações** (com importação assistida do PGR, certificados de calibração no Drive)
  - **Conclusões Previdenciárias** (GHE × função, snapshot de agentes considerados)
  - **Revisões** (append-only)
  - **PDF** (rascunho e final, hash SHA-256, Drive)
  - **Checklist** (pré-publicação)
- `/ltcat/validar/:id` — validação interna via QR Code.

## Fluxos implementados
1. **Criação** → `rascunho` editável.
2. **Edição** das abas (RTs, GHEs, funções, agentes, avaliações, conclusões).
3. **Geração de PDF** rascunho (sem MFA) e **final** (com MFA AAL2).
4. **Assinatura visual** (com MFA AAL2; arte armazenada no Drive).
5. **Publicação** via `ltcat_publicar` (todas as validações + AAL2) → `vigente`; versão anterior vai para `substituido`.
6. **Abertura de revisão** clona snapshot e gera nova versão em `rascunho`.

## Geração de PDF
- Renderização client-side (`jsPDF` + `qrcode`) com layout técnico interno: capa, identificação, RTs, GHE/GES, agentes, avaliações, conclusões, EPI/EPC, fundamentos legais, QR Code.
- SHA-256 calculado via Web Crypto antes do upload.
- Tipos: `rascunho` (marca d'água) e `final` (limpa, requer MFA).
- Banco armazena apenas metadados e hash; binário fica no Drive BYOK.

## Google Drive BYOK
- Hierarquia: `LTCAT/v{versao}/Documento/`, `LTCAT/v{versao}/Avaliacoes/{aval_id}/`, `LTCAT/v{versao}/Assinaturas/`.
- `supabase.auth.refreshSession()` chamado antes de cada operação no Drive.
- Imagens (assinatura, certificados) servidas via `gdrive-proxy` para evitar CORS.

## Assinatura visual
- Coleta MFA AAL2 antes da gravação via `MfaActionButton`.
- Armazena `auth_aal`, `assinado_em`, nome/papel, imagem no Drive.
- Aviso permanente: **não substitui ICP-Brasil**.

## QR Code
- Aponta para rota interna autenticada `/ltcat/validar/:id`.
- A página exibe versão, status, RTs, hash do PDF e badge "PDF desatualizado" quando aplicável.

## Dashboard — indicadores
Total / vigentes / em revisão / vencidos / substituídos+arquivados / sem PDF / PDF desatualizado / sem assinatura / prontos para publicar / avaliações acima do LT / conclusões 15-20-25/não-especial/inconclusivo / agentes mais frequentes / GHE com mais agentes / funções com enquadramento especial / próximos vencimentos (90 dias).

Filtros: empresa/unidade, status, vigência, RT, agente nocivo, enquadramento, GHE/GES, função.

## Checklist de pré-publicação
Aba **Checklist** no detalhe, com 18 itens cobrindo RT, GHE, funções, agentes, avaliações, conclusões, fundamentos, justificativas, agentes acima do LT, PDF gerado e atualizado, assinatura visual, QR Code, RLS, MFA, audit log, histórico append-only e aviso de ausência de ICP-Brasil.

## Validações finais de publicação
Aplicadas em **dobro** (UI no checklist + RPC `ltcat_publicar`):
- ≥1 RT, ≥1 GHE, ≥1 agente, ≥1 avaliação, ≥1 conclusão;
- fundamento legal nas conclusões especiais;
- justificativa nas inconclusivas;
- justificativa técnica em não-especial com agente acima do LT;
- PDF final gerado e atualizado (`gerado_em ≥ conteudo_atualizado_em`);
- ≥1 assinatura visual;
- MFA AAL2 ativo na sessão.

## Exportações
- CSV (UTF-8 com BOM, separador `;` para abertura direta no Excel pt-BR):
  - Lista de LTCATs
  - Agentes e avaliações
  - Conclusões previdenciárias
- `.xlsx` nativo: **pendência** (evolução futura).

## Testes de isolamento Empresa A × Empresa B
1. Login Empresa A: lista, dashboard e detalhe expõem apenas LTCATs com `empresa_id` no escopo de A.
2. Login Empresa B: idem para B; consulta direta por `id` de LTCAT de A em `/ltcat/:id` retorna "não encontrado ou fora do seu escopo".
3. Tentativa de mutação cross-tenant via Supabase client falha por RLS (`new row violates row-level security policy`).
4. `/ltcat/validar/:id` exige autenticação e respeita `empresa_id`.
5. RPCs `ltcat_publicar` / `ltcat_abrir_revisao` validam `empresa_id` do `auth.uid()` antes de operar.
6. `anon` não consegue executar nenhuma RPC `ltcat_*`.

## Riscos residuais
- Cálculo de PDF acontece no cliente — usuário pode adulterar antes do upload; o hash SHA-256 é registrado, mas a integridade depende do que o cliente envia. Mitigação futura: gerar PDF em edge function.
- Catálogo de agentes inicial coberto, mas `fundamento_legal` por agente do Anexo IV ainda não é padrão automático na conclusão.
- Assinatura visual interna não tem valor jurídico equivalente a ICP-Brasil.
- Exportação `.xlsx` ainda não suportada.
- Importação do PGR não migra anexos do Drive (apenas dados quantitativos).

## Itens fora do escopo desta fase
- PPP real (módulo separado, integra dados do LTCAT mas não foi implementado aqui).
- eSocial S-2240 real (envio, lote, retorno).
- Assinatura ICP-Brasil / certificado A1/A3.
- Integração externa com órgãos públicos (INSS, eSocial Web Service, Receita).
- Geração server-side de PDF.
- Workflow de aprovação multi-RT.

## Pendências antes de iniciar PPP ou eSocial S-2240
1. Mapear catálogo de agentes do LTCAT para códigos do eSocial (tabela 24).
2. Definir agente responsável por gerar o XML S-2240 (edge function vs job interno).
3. Modelar tabela de fundamentos legais por agente (Anexo IV) para auto-preenchimento.
4. Padronizar campos de função (CBO) e período de exposição para PPP.
5. Definir política de retenção/arquivamento das versões PDF no Drive (atualmente sem expiração).

# Fase 2B — Checklist de Homologação Interna

> **Escopo:** validar U1–U5 reais, MFA, Drive BYOK e reexecução completa dos fluxos da Fase 2 sobre os dados `[HOMOLOG]` já existentes.
> **Proibido nesta fase:** certificado digital, ICP-Brasil, XMLDSig, SOAP, S-3000, envio real ao eSocial, qualquer transmissão oficial.
> **Não avançar para Fase 3** sem todos os itens deste checklist marcados.

---

## 0. Dados de referência ([HOMOLOG] já criados)

| Entidade | ID |
|---|---|
| Matriz A | `f141f880-b820-4e0d-8958-a410734201fa` |
| Matriz B | `8d579cbc-74cf-49d4-a1bf-57026406eb0b` |
| Unidade A1 | `64eaa0ce-d25c-4178-b380-f1e995426368` |
| Unidade B1 | `b657b74a-a28d-4547-8bec-b9ce5f749a40` |
| Contrato A1.1 | `d12e327d-a2cd-4015-8b7f-303ae099afd4` |
| Contrato B1.1 | `d1c2d18f-0ab1-4898-9160-b53526f35587` |
| Funcionário A1 | `5e95ee33-4554-4da4-9755-1bc6123d901c` |
| Funcionário B1 | `43dd681f-1bd8-4bc4-b2d2-6747bfa84e52` |
| CAT A | `aaaaaaaa-0001-0000-0000-0000000000a1` (`[HOMOLOG]-CAT-A-001`) |
| CAT B | `bbbbbbbb-0001-0000-0000-0000000000b1` (`[HOMOLOG]-CAT-B-001`) |
| PGR A / B | `aaaaaaaa-0002-…-a1` / `bbbbbbbb-0002-…-b1` |
| LTCAT A / B | `aaaaaaaa-0003-…-a1` / `bbbbbbbb-0003-…-b1` |
| PPP A / B | `aaaaaaaa-0004-…-a1` / `bbbbbbbb-0004-…-b1` |

---

## 1. Signups reais U1–U5 em `/auth`

> Cada titular cadastra a própria conta. Não usar `@homolog.test`.

| ID | Perfil | E-mail real (preencher) | Senha definida por |
|---|---|---|---|
| U1 | Super Admin | ________________________ | titular |
| U2 | Principal (Empresa A) | ________________________ | titular |
| U3 | Admin/Técnico SST (Empresa A) | ________________________ | titular |
| U4 | Operacional (Empresa B) | ________________________ | titular |
| U5 | Sem permissão | ________________________ | titular |

- [ ] U1 signup concluído
- [ ] U2 signup concluído
- [ ] U3 signup concluído
- [ ] U4 signup concluído
- [ ] U5 signup concluído
- [ ] E-mails confirmados (link de verificação clicado, se exigido)

---

## 2. Vinculação `usuarios_liberados` / `usuario_empresas` / `user_roles`

- [ ] Abrir `docs/fase-2b-sql-vinculo-u1-u5.sql`
- [ ] Substituir os 5 placeholders `<EMAIL_REAL_UX>` pelos e-mails reais
- [ ] Confirmar que U1–U4 já existem em `auth.users` (signup feito)
- [ ] Executar o script (transação `BEGIN/COMMIT`)
- [ ] Conferir queries de verificação no final do SQL
- [ ] U5 permanece **sem** `user_roles` e **sem** `usuario_empresas` (esperado)

---

## 3. Ativação de MFA (perfis sensíveis)

> MFA via TOTP (Google Authenticator, Authy, 1Password). Cada titular ativa a sua.

| Usuário | MFA obrigatório | Ativado? |
|---|---|---|
| U1 Super Admin | sim | [ ] |
| U2 Principal A | sim | [ ] |
| U3 Técnico SST A | sim | [ ] |
| U4 Operacional B | opcional | [ ] |
| U5 Sem permissão | n/a | n/a |

- [ ] Validar `mfa_enforcement` ativo para super_admin/admin
- [ ] Login pós-MFA solicita código TOTP
- [ ] Banner `MfaBanner` desaparece após ativação

---

## 4. Conexão Google Drive BYOK

> Cada titular que vai gerar PDF/XML conecta a **própria** conta Google.

| Usuário | Drive BYOK conectado | Pasta raiz visível |
|---|---|---|
| U1 | [ ] | [ ] |
| U2 | [ ] | [ ] |
| U3 | [ ] | [ ] |

- [ ] Escopo `drive.file` autorizado
- [ ] `supabase.auth.refreshSession()` funciona sem 401 ao chamar `gdrive-token`
- [ ] Subpastas `eSocial/S2210`, `eSocial/S2240`, `PGR`, `LTCAT`, `PPP`, `CAT` aceitam upload

---

## 5. Testes por perfil (matriz de permissões)

Executar o mesmo conjunto de ações logado como cada usuário e marcar resultado esperado.

| Ação | U1 | U2 | U3 | U4 | U5 |
|---|---|---|---|---|---|
| Ver dashboard global | ✅ | ❌ | ❌ | ❌ | ❌ |
| Trocar Matriz no header | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver CAT da Empresa A | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver CAT da Empresa B | ✅ | ❌ | ❌ | ✅ | ❌ |
| Criar/editar PGR A | ✅ | ✅ | ✅ | ❌ | ❌ |
| Publicar LTCAT A | ✅ | ✅ | ❌* | ❌ | ❌ |
| Acessar Admin Cloud | ✅ | ❌ | ❌ | ❌ | ❌ |
| Acessar Backups | ✅ | ❌ | ❌ | ❌ | ❌ |

\* Confirmar regra de "Principal-only" para publicação.

- [ ] Todas as células acima conferidas

---

## 6. Fluxos técnicos pela UI

### 6.1 CAT (S-2210 stub)
Logado como **U3** (Empresa A) abrir `[HOMOLOG]-CAT-A-001`:
- [ ] Editar campo livre e salvar (revisão atualizada)
- [ ] Validar S-2210 → checklist sem erros bloqueantes
- [ ] **Gerar PDF** → arquivo no Drive BYOK
- [ ] PDF possui **QR Code** legível
- [ ] `cat_comunicacoes.pdf_hash` preenchido (SHA-256)
- [ ] `pdf_drive_file_id` e `pdf_drive_view_link` preenchidos
- [ ] **Gerar XML S-2210 stub** → `esocial_eventos_s2210.xml_drive_id` + `xml_hash_sha256` preenchidos
- [ ] Aviso "XML não assinado digitalmente" visível
- [ ] Repetir como **U4** para `[HOMOLOG]-CAT-B-001`

### 6.2 PGR
Logado como **U3** abrir PGR A:
- [ ] Importar GHE A (via diálogo)
- [ ] Inventário de riscos gerado
- [ ] Plano de ação criado (≥1 ação)
- [ ] Checklist verde
- [ ] **Gerar PDF** → Drive BYOK + hash + QR
- [ ] Dashboard PGR atualiza contadores
- [ ] Repetir como **U4** para PGR B

### 6.3 LTCAT
Logado como **U3** abrir LTCAT A:
- [ ] Importar avaliações do PGR A
- [ ] Cadastrar ≥1 agente e ≥1 avaliação
- [ ] Criar conclusão previdenciária
- [ ] Checklist verde
- [ ] **Gerar PDF** → Drive + hash + QR
- [ ] Repetir como **U4** para LTCAT B

### 6.4 PPP
Logado como **U3** abrir PPP funcionário A1:
- [ ] Criar período/histórico laboral
- [ ] Importar exposições do LTCAT A
- [ ] Cadastrar responsáveis ambientais e médicos
- [ ] Referenciar ≥1 exame
- [ ] **Gerar PDF** → Drive + hash + QR
- [ ] Repetir como **U4** para PPP funcionário B1

### 6.5 S-2240 stub
A partir do PPP A:
- [ ] Mapear agentes na Tabela 24
- [ ] Validar XML localmente
- [ ] **Gerar XML S-2240 stub** → `esocial_eventos_s2240.xml_drive_id` + `xml_sha256` preenchidos
- [ ] Dashboard S-2240 mostra evento `validado_stub`
- [ ] Repetir para PPP B

---

## 7. Testes transversais

### 7.1 Hash SHA-256
- [ ] `cat_comunicacoes.pdf_hash` ≠ NULL para CAT A e B
- [ ] `pgr_pdf_versoes.pdf_hash` ≠ NULL
- [ ] `ltcat_pdf_versoes.pdf_hash` ≠ NULL
- [ ] `ppp_pdf_versoes.pdf_hash` ≠ NULL
- [ ] `esocial_eventos_s2210.xml_hash_sha256` ≠ NULL
- [ ] `esocial_eventos_s2240.xml_sha256` ≠ NULL

### 7.2 QR Code
- [ ] QR de cada PDF abre rota de verificação válida
- [ ] Verificador confirma hash batendo com o do banco

### 7.3 Audit log
- [ ] `audit_log` registra eventos com `user_id` real (não NULL)
- [ ] Ações sensíveis (publicar, cancelar, gerar XML) aparecem no log
- [ ] U5 não consegue listar `audit_log`

### 7.4 Exportação CSV
- [ ] Lista CAT → "Exportar CSV" abre arquivo com apenas registros da empresa ativa
- [ ] Lista PGR/LTCAT/PPP idem
- [ ] Dashboard S-2240 exporta CSV apenas da empresa ativa

### 7.5 Dashboards
- [ ] Dashboard CAT mostra 1 CAT por empresa
- [ ] Dashboard PGR/LTCAT/PPP carrega sem erro
- [ ] Dashboard S-2240 mostra status `validado_stub`/`homologacao_stub`

### 7.6 Isolamento Empresa A × Empresa B
- [ ] U2 (A) não enxerga documentos B em nenhuma listagem
- [ ] U4 (B) não enxerga documentos A
- [ ] Tentativa de abrir URL direta de doc B com sessão U2 → 403/empty
- [ ] Filtros de funcionário em A não retornam funcionários B

### 7.7 Cache ao trocar empresa (U1)
- [ ] Header → trocar de Matriz A para Matriz B → lista de docs atualiza
- [ ] TanStack Query purga cache (sem dados antigos da A piscando)
- [ ] `localStorage.active_empresa_id` muda
- [ ] Voltar para Matriz A → dados de A retornam consistentes

---

## 8. Evidências a coletar (por fluxo)

Para cada documento testado, salvar:
- [ ] Print da tela de geração de PDF concluído
- [ ] Link `webViewLink` do Drive
- [ ] Linha do banco mostrando `pdf_hash` / `xml_hash_sha256`
- [ ] Print do QR Code aberto na rota de verificação
- [ ] Print do `audit_log` filtrado pelo evento

Salvar tudo em `docs/fase-2b-evidencias/` (criar quando começar a coleta).

---

## 9. Bugs encontrados

> Preencher conforme aparecerem. Formato sugerido:

| # | Fluxo | Perfil | Severidade | Descrição | Status |
|---|---|---|---|---|---|
|   |   |   |   |   |   |

---

## 10. Pendências finais antes da Fase 3

- [ ] Todos os checkboxes acima marcados
- [ ] Bugs críticos resolvidos
- [ ] Relatório consolidado da Fase 2B entregue
- [ ] Aprovação explícita do solicitante para iniciar Fase 3

---

## Lembretes de segurança (não fazer nesta fase)

- ❌ Certificado digital / ICP-Brasil
- ❌ XMLDSig (assinatura XML)
- ❌ SOAP / WS-Security
- ❌ S-3000 (exclusão de eventos)
- ❌ Envio real ao Ambiente Nacional do eSocial
- ❌ Qualquer transmissão oficial
- ❌ Burlar MFA
- ❌ Compartilhar tokens Drive entre usuários

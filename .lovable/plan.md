
# Plano de Revisão Geral de QA — Sistema SST

Objetivo: validar, de ponta a ponta, todos os módulos já entregues (Segurança/Hardening, CAT, S-2210 stub, PGR, LTCAT, PPP, S-2240 stub) sem introduzir transmissão real ao eSocial. Resultado final: **Relatório de Prontidão** com pendências priorizadas.

---

## Fase 0 — Preparação do ambiente de QA

- Definir 2 empresas de teste: **Empresa A** e **Empresa B**, cada uma com Matriz + Unidade + Contrato + funcionários distintos.
- Definir 5 usuários de teste:
  - U1: Super Admin
  - U2: Principal Empresa A
  - U3: Operacional Empresa A (sem MFA)
  - U4: Operacional Empresa A (com MFA)
  - U5: Principal Empresa B
- Cada usuário com Google Drive BYOK próprio conectado.
- Matriz de evidências: planilha única registrando resultado (OK / FALHA / N/A) + screenshot/log por caso.

---

## Fase 1 — Isolamento Multi-Tenant (Empresa A × Empresa B)

1. **RLS por tabela sensível** — listar e testar SELECT/INSERT/UPDATE/DELETE cruzados em:
   - CAT: `cat_comunicacoes`, `cat_anexos`, `cat_testemunhas`, `cat_historico`
   - S-2210: `esocial_eventos_s2210`, `esocial_eventos_historico`, `esocial_retorno_ocorrencias`
   - PGR: `pgr_documentos`, `pgr_inventario_itens`, `pgr_acoes`, `pgr_revisoes`
   - LTCAT: `ltcat_documentos`, `ltcat_agentes`, `ltcat_avaliacoes`, `ltcat_pdf_versoes`
   - PPP: `ppp_documentos`, `ppp_periodos`, `ppp_exposicoes`, `ppp_pdf_versoes`
   - S-2240: `esocial_eventos_s2240`, `esocial_s2240_agentes`, `esocial_s2240_mapeamentos`, `esocial_s2240_ocorrencias`, `esocial_s2240_historico`
   - Suporte: `audit_log`, `usuario_empresas`, `empresa_config`
2. Tentar acessar IDs da Empresa B autenticado como U2/U3 — esperado: 0 linhas / erro.
3. Testar RPCs (`s2240_assert_tenant`, `s2240_registrar_*`, `s2240_marcar_validacao_xml`) com IDs de outra empresa — esperado: exceção.
4. Verificar `active_empresa_id` em localStorage: trocar para empresa não autorizada deve ser bloqueado server-side.

## Fase 2 — Permissões por Perfil

- Matriz Perfil × Ação para cada módulo (visualizar, criar, editar, validar, retificar, excluir, exportar).
- Casos críticos:
  - U3 sem `esocial:s2240:validar` não vê botão e RPC nega.
  - U3 sem `esocial:s2240:preparar` não gera XML.
  - Apenas Super Admin acessa Infra/Cloud/Backups.
  - `Principal` edita registros globais (empresa_id null); demais não.

## Fase 3 — MFA

- Confirmar `mfa_enforcement` aplicado em: gerar XML S-2240, validar XML S-2240, regenerar XML, ações sensíveis CAT/S-2210, dispensa de funcionário, alterações em Tabela 24, exclusões.
- Testar: usuário sem MFA é bloqueado; com MFA expirado revalida; cancelamento aborta a ação.

## Fase 4 — Audit Log

- Para cada ação sensível verificar: registro criado com `acao`, `status`, `metadata` mínimo, **sem XML completo**, sem PII desnecessária.
- Confirmar inexistência de inserts diretos do cliente (somente via RPC/trigger).
- Cruzar volume esperado × volume real (ex.: 1 geração XML = 1 linha audit + 1 linha histórico + 1 linha xml_meta).

## Fase 5 — Cache, Logout e Troca de Empresa

- Login U2 (A) → cache TanStack populado → trocar para outra empresa autorizada → confirmar `queryClient.clear()` ou invalidação.
- Logout limpa: localStorage relevante, idb-keyval, sessão Supabase, tokens Drive.
- Hard-refresh offline (PWA) mantém dados da empresa ativa apenas.

## Fase 6 — Google Drive BYOK

- Reautenticação Drive antes de cada upload (`refreshSession`).
- Upload XML S-2240 vai para pasta privada correta (hierarquia Matriz/Unidade/Contrato/PPP).
- Falha de upload bloqueia gravação (ex.: inspeções, XML stub).
- `gdrive-proxy` serve imagens sem CORS; tokens não vazam em logs.
- Empresa B não consegue baixar fileId da Empresa A (RPC + Drive scope).

## Fase 7 — PDFs e QR Codes

- Geração: ASO, PPP, LTCAT, PGR, Ficha de Entrega (paisagem), CAT.
- Validar: header com empresa correta, dados do funcionário, datas, assinaturas, QR Code apontando para URL de verificação válida.
- Hash/versionamento (`*_pdf_versoes`) coerente.

## Fase 8 — XML Stub S-2210 e S-2240

- Gerar XML para 3 cenários (mínimo, completo, com agentes múltiplos).
- Validar localmente (sem XSD oficial): estrutura, IDs eSocial, CPF/CNPJ, CBO, Tabela 24, hash SHA-256 confere.
- Hash divergente é detectado e marca `rejeitado_local`.
- XML completo **não** aparece em audit_log nem em colunas do banco.

## Fase 9 — Dashboards

- S-2240 Dashboard (`/esocial/s2240/dashboard`): KPIs por empresa, checklist 21 pontos, filtros, drawer por evento.
- Dashboards EPI/Estoque/Inspeções/Documentos: filtros, gráficos (Pareto, fluxo, consumo), badges.
- Verificar contagens cruzando com queries diretas.

## Fase 10 — Exportações CSV

- S-2240: eventos, ocorrências, agentes, pendentes/divergentes.
- Demais módulos com export existente.
- Validar encoding (UTF-8 BOM), separador, escape de vírgulas/quebras, nomes de coluna em PT.
- Confirmar que CSV respeita filtro/empresa ativa.

## Fase 11 — Linter / Warnings

- `supabase--linter`: revisar findings (RLS, GRANTs, search_path, security definer).
- `security--run_security_scan`: revisar findings e marcar fixed/ignored com justificativa.
- TS/ESLint warnings: zerar em arquivos novos do S-2240 e do PPP.

## Fase 12 — Rotas

- Varrer `src/App.tsx` × páginas existentes: nenhuma rota órfã, nenhuma rota sem guard, todas rotas sensíveis com `PermissionGuard` + `MfaGate` quando aplicável.
- Testar deep-link direto a `/esocial/s2240/dashboard` deslogado → redireciona para login.

## Fase 13 — Performance

- Medir TTI das telas pesadas: S-2240 Dashboard, S2240Mapeamentos, PPP Detalhe, PGR Inventário.
- Verificar N+1: batch operations com `Promise.all` onde aplicável.
- Confirmar prefetch deferido e `staleTime: Infinity` onde definido.

## Fase 14 — Mobile / Responsivo

- Testar < 640px em: login, dashboard principal, S-2240 Dashboard, PPP, entregas EPI, inspeções, assinatura digital (44px hit area, 100dvh).
- Botão voltar Android (Capacitor) minimiza app conforme regra.
- Vídeos de treinamento: tap-to-play, 30s timeout.

## Fase 15 — Checklists Finais

### 15.1 Pendências Críticas (bloqueiam produção)
A preencher após execução. Exemplos potenciais:
- Qualquer falha de RLS cruzada.
- XML completo persistido indevidamente.
- MFA contornável em ação sensível.

### 15.2 Pendências Médias (corrigir antes do envio real)
- Ausência de XSD oficial S-2210/S-2240.
- Falta de paginação server-side em dashboards muito grandes.
- Warnings de linter não classificados.

### 15.3 Itens Fora de Escopo (documentar, não corrigir agora)
- Certificado digital ICP-Brasil (A1/A3).
- Assinatura XMLDSig + C14N.
- Cliente SOAP eSocial + fila + retry + recibo.
- S-3000 (exclusão oficial).
- Consulta de retorno real.

## Fase 16 — Plano de Correção por Prioridade

- **P0** (crítico): bloqueia uso → corrigir imediatamente, retestar empresa A×B.
- **P1** (alto): impacto funcional/UX → corrigir antes do Relatório Final.
- **P2** (médio): melhoria/refino → backlog endereçado antes da Parte 6.
- **P3** (baixo): cosmético/documentação → backlog aberto.

Cada item registrado com: módulo, descrição, severidade, evidência, owner sugerido, esforço estimado.

## Fase 17 — Relatório Final de Prontidão

Entregável único contendo:
- Sumário executivo (status por módulo: Verde/Amarelo/Vermelho).
- Matriz de evidências consolidada.
- Lista priorizada P0–P3.
- Riscos residuais.
- Itens fora de escopo (explícitos).
- Recomendação Go / No-Go para iniciar planejamento da Parte 6 (transmissão real).

---

## Escopo explicitamente excluído desta revisão

- Implementação de certificado digital, KMS, XMLDSig, C14N, SOAP, fila de envio, retry, consulta de recibo, S-3000.
- Qualquer chamada a ambiente eSocial (produção ou homologação).
- Mudanças de arquitetura de transmissão.

## Entregáveis ao final

1. Planilha/Markdown da matriz de evidências.
2. Lista P0–P3 priorizada.
3. Relatório Final de Prontidão (markdown em `/mnt/documents`).
4. Atualização da memória do projeto somente para regras novas descobertas durante o QA.

Após sua aprovação deste plano, executo as fases 1–14 em ondas paralelas (subagents read-only para inspeção de código + execução manual de cenários no preview) e depois consolido as fases 15–17.

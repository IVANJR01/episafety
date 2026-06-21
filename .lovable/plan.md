# Roteiro de Homologação Interna Controlada — Sistema SST

Objetivo: executar, em ambiente real do projeto, um ciclo completo de uso ponta-a-ponta com **2 empresas teste isoladas**, validando os 20 pontos solicitados sem qualquer envio oficial ao eSocial.

Escopo explicitamente excluído: certificado digital, ICP-Brasil, XMLDSig, SOAP, S-3000, transmissão real, consulta de recibo real.

---

## Fase 0 — Preparação do Ambiente

- **Empresas teste**: Empresa A (Matriz A + Unidade A1 + Contrato A1.1) e Empresa B (Matriz B + Unidade B1 + Contrato B1.1).
- **Usuários teste**:
  - U1 Super Admin (global)
  - U2 Principal Empresa A
  - U3 Operacional A (sem MFA)
  - U4 Operacional A (com MFA)
  - U5 Principal Empresa B
- **Drive BYOK**: conta Google distinta por empresa.
- **Matriz de evidências**: planilha única (OK / FALHA / N/A + screenshot/log) — uma linha por caso de teste.

---

## Fase 1 — Cadastros Básicos (pontos 1–4)

1. **Empresa**: criar Matriz A, Unidade A1, Contrato A1.1 — repetir para B. Confirmar `empresa_pai_id`, logo no Drive, config inicial.
2. **Usuários e permissões**: provisionar U2–U5 via `usuarios_liberados`, vincular `usuario_empresas`, atribuir perfis e ações especiais (`esocial:s2240:*`, `epis:gestao_estoque`, etc.).
3. **Funcionários**: cadastrar 3 funcionários por contrato (com CPF, CBO, função, unidade responsável obrigatória).
4. **Setores / Funções / GHE-GES**: cadastrar setor, função, GHE e GES; vincular riscos via catálogo.

## Fase 2 — Documentos Técnicos (pontos 5–8)

5. **CAT**: emitir 1 CAT por empresa (típico + trajeto), gerar PDF, conferir numeração isolada por empresa, anexar testemunhas, histórico.
6. **PGR**: criar documento, importar GHE, montar inventário de riscos, matriz, plano de ação, gerar PDF e revisão.
7. **LTCAT**: criar, importar do PGR, agentes/avaliações, responsáveis técnicos, conclusões, PDF.
8. **PPP**: emitir PPP do funcionário, períodos, exposições, responsáveis ambientais/médicos, PDF IN 128/2022, aba S-2240.

## Fase 3 — eSocial Stub (pontos 9–10)

9. **S-2210 stub**: gerar XML a partir da CAT, validar localmente, conferir hash SHA-256, baixar do Drive BYOK, confirmar que `xml_gerado` **não** existe mais no banco.
10. **S-2240 stub**: mapear agentes PPP/LTCAT → Tabela 24, gerar XML técnico, validar local, hash, salvar no Drive `eSocial/S2240/`, abrir `/esocial/s2240/dashboard` (KPIs + checklist 21 pontos + filtros + drawer).

## Fase 4 — Artefatos e Integrações (pontos 11–14)

11. **PDFs**: validar header, dados, assinaturas e versionamento em ASO, PPP, LTCAT, PGR, Ficha de Entrega EPI (paisagem) e CAT.
12. **QR Codes**: escanear QR de ASO/PPP/Ficha e confirmar URL de verificação válida e tenant correto.
13. **Drive BYOK**: confirmar `refreshSession` antes de cada upload, hierarquia Matriz>Unidade>Contrato, falha de upload bloqueia gravação, `gdrive-proxy` serve imagens sem CORS, **Empresa B não baixa fileId da Empresa A**.
14. **MFA**: U3 bloqueado em ações sensíveis (gerar/validar XML, dispensa, alterações Tabela 24); U4 passa; sessão MFA expirada exige revalidação.

## Fase 5 — Segurança Multi-Tenant (pontos 15–16)

15. **Permissões por perfil**: matriz Perfil × Ação (visualizar / criar / editar / validar / retificar / excluir / exportar) por módulo; conferir tokens `esocial:s2240:*` (3 níveis); apenas Super Admin vê Infra/Cloud/Backups.
16. **Isolamento A × B**:
    - Logar U2, abrir CAT/PGR/LTCAT/PPP/S-2210/S-2240; trocar para outra empresa autorizada → confirmar `purgeQueryCache` + `clearAllCachedData` (sem dados residuais da A).
    - Forçar URLs com IDs da B autenticado como U2 → 0 linhas / erro RLS.
    - RPCs (`s2240_assert_tenant`, `s2240_registrar_*`, `esocial_registrar_xml_meta`) com IDs cruzados → exceção.
    - `aso_medicos` com `empresa_id IS NULL` invisível para U2/U5.

## Fase 6 — Saídas e Observabilidade (pontos 17–19)

17. **Exportações CSV**: S-2240 (eventos, ocorrências, agentes, pendentes/divergentes) + demais módulos; UTF-8 BOM, separador, escape de vírgulas/quebras, filtro respeita empresa ativa.
18. **Dashboards**: S-2240, EPI/Estoque, Inspeções, Documentos, Pareto, fluxo, consumo — comparar KPIs com queries diretas.
19. **Audit log**: para cada ação sensível, 1 linha com `acao`/`status`/`metadata` mínimo, **sem XML completo**, sem PII desnecessária; inserts somente via RPC (`s2240_registrar_mapeamento_audit`, `esocial_registrar_xml_meta`, `esocial_registrar_download`).

## Fase 7 — Consolidação (ponto 20)

20. **Lista final de bugs**: triagem dos achados em P0/P1/P2/P3 com módulo, descrição, evidência, esforço.
- Relatório final salvo em `/mnt/documents/Homologacao_Interna_SST.md`.
- Recomendação final: liberar uso interno controlado **sim/não**; transmissão real permanece **NO-GO**.

---

## Critérios de Aceite

- 100% dos 20 pontos executados em A e B, com evidências.
- Zero vazamento entre A × B.
- Zero XML completo em banco ou audit log.
- MFA não contornável em ação sensível.
- Drive BYOK isolado por empresa.
- Nenhuma chamada a endpoint real do eSocial.

## Entregáveis

1. Matriz de evidências (planilha/markdown).
2. Lista P0–P3 com priorização.
3. Relatório `/mnt/documents/Homologacao_Interna_SST.md` com status final por módulo (Verde/Amarelo/Vermelho).
4. Recomendação Go/No-Go para uso interno controlado.

## Itens Fora de Escopo (não executar)

- Certificado digital A1/A3, KMS, XMLDSig, C14N.
- Cliente SOAP, fila de envio, retry, consulta de recibo.
- S-3000 (exclusão oficial).
- Qualquer chamada a ambiente eSocial (produção ou homologação oficial).

Aguardando aprovação para iniciar a Fase 0.

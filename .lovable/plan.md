
# Módulo Gestão e Emissão de ASO

Escopo grande. Vou entregar em **4 fases** para garantir qualidade e permitir você validar cada etapa antes da próxima. Tudo respeitando `empresa_id` (URL + contexto) e a arquitetura multi-tenant atual.

## Reaproveitamento do que já existe
- **Funcionários, empresas, setores, funções, riscos**: o EPISafety já tem `funcionarios`, `empresa_config`, `contratos`, e o módulo `Exames` (`/exames`). Vou **reaproveitar** essas tabelas em vez de duplicar — criar `setores`, `funcoes`, `medicos`, `exames`, `funcionarios` paralelos quebraria o sistema.
- Tabelas **novas** apenas para o que não existe: `aso_medicos`, `aso_exames_catalogo`, `asos`, `aso_riscos`, `aso_exames`, `aso_assinaturas`, `aso_verificacao` (hash público).
- Setor/função/riscos serão lidos do cadastro existente do funcionário; campos faltantes (NR-35, NR-10, NR-33, PCD etc.) entram como colunas adicionais em `funcionarios` se ainda não existirem.

## Fase 1 — Fundação (banco + rotas + dashboard)
1. **Migração SQL** com as tabelas novas, RLS por `empresa_id` (políticas usando `is_super_admin`, `is_in_user_company_tree` e scope multi-empresa já existentes), GRANTs, índices e trigger de `updated_at`.
2. Numeração automática `ASO-YYYY-NNNN` por empresa (sequence + função SQL `gerar_numero_aso(empresa_id)`).
3. Status calculado (`válido`/`vencendo`/`vencido`) via coluna gerada ou view.
4. Rota `/aso` no `App.tsx` + entrada no menu (`AppLayout`), respeitando `EmpresaQuerySync`.
5. **Dashboard ASO** (`/aso`): KPIs (total, aptos, inaptos, vencidos, vencendo 30d, por tipo de exame), gráficos (Recharts — barras por mês, pizza por status), filtros (período, setor, função, tipo, status). Tudo filtrado por `empresaScopeIds`.

## Fase 2 — Cadastros auxiliares e Lista
1. **Médicos** (`/aso/medicos`): CRUD com CRM/UF, assinatura e carimbo via Google Drive (mesmo padrão BYOK do projeto).
2. **Catálogo de exames** (`/aso/exames-catalogo`): nomes, periodicidade, risco relacionado. Pré-popula 13 exames padrão na primeira abertura por empresa.
3. **Lista de ASOs** (`/aso/lista`): TanStack Table com todas as colunas pedidas, badges coloridos, filtros, ações (ver, editar, duplicar, PDF, imprimir, cancelar). Exporta CSV/Excel.

## Fase 3 — Emissão (individual + lote) e PDF
1. **Wizard de emissão** (`/aso/novo`) em 9 etapas (Empresa → Funcionário → Tipo → Riscos → Exames → Aptidão → Validade → Médico → Preview), com auto-preenchimento de riscos pela função e sugestões inteligentes (NR-35, audiometria se ruído, demissional se desligando).
2. **Emissão em lote** (`/aso/lote`): seleção múltipla com filtros, geração em paralelo, download ZIP.
3. **PDF profissional A4** (jsPDF + jspdf-autotable, já no projeto): cabeçalho com logo, blocos com bordas, checkboxes marcados, tabela de exames, assinaturas, **QR Code** (qrcode npm) com link `/verificar-aso/:hash`, texto de rodapé NR sobre reavaliação.
4. Salvar PDF no Google Drive da empresa, link em `asos.pdf_url`.

## Fase 4 — Recursos avançados
1. **Importação Excel** (`xlsx`): upload, validação, prévia, criação/atualização, relatório final.
2. **Aba "Histórico de ASO"** no cadastro de funcionário (linha do tempo).
3. **Alertas** no Dashboard principal (vencidos, vencendo 30d, ativos sem ASO).
4. **Página pública** `/verificar-aso/:hash` (sem auth, mostra status e dados mascarados) via edge function `verify-aso` para não expor RLS.
5. **Relatórios** completos com export PDF/Excel/CSV.

## Detalhes técnicos
- Stack: React + TS + Tailwind + shadcn/ui + React Hook Form + Zod + TanStack Query/Table + jsPDF + qrcode + xlsx — todos já presentes ou compatíveis.
- Componentização: `AsoDashboard`, `AsoList`, `AsoWizard` (subpassos), `AsoPreview`, `AsoPdfRenderer`, `EmployeeSelector`, `MedicoForm`, `BulkAsoGenerator`, `ExcelImporter`, `AsoStatusBadge`, `AsoFilters`.
- Tokens semânticos do design system (sem cores cruas) — verde/amarelo/vermelho/laranja já mapeados via badges existentes.
- RLS: toda tabela nova com policies idênticas ao padrão multi-tenant (super_admin total, principal por empresa, usuário por `empresa_id` no scope).
- Permissões: nova chave `aso` em `MODULOS` (ações view/create/edit/delete) e perfis (Técnico, Médico, RH, Cliente) via `modulos_permitidos`.

## Confirmações antes de começar
1. **Reaproveitamento**: confirma que posso usar `funcionarios`, `empresa_config` e o módulo `Exames` atuais como base (em vez de criar tabelas paralelas `funcionarios`, `empresas`, `setores`, `funcoes`)? Isso evita duplicação de dados e mantém integridade.
2. **Setores/Funções**: hoje funcionário tem `funcao` (texto) e contrato. Posso criar tabelas `aso_setores` e `aso_funcoes` **só** se você quiser estrutura normalizada para ASO, ou usar o texto livre atual?
3. **Posso começar pela Fase 1** (migração + dashboard + rota) e seguir incremental?

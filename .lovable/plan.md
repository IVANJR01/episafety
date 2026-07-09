
# Módulo Comercial — Orçamentos e Cotações (Fase 1)

Novo módulo isolado. Não toca EPIs, Entregas, Inspeções, ASO, PGR/LTCAT/PPP, Portal RH, MFA, Termos nem storage existente.

## 1. Banco (migration única)

4 tabelas novas em `public`, todas com `empresa_id`, `created_at`, `updated_at`, RLS ativa e GRANTs corretos:

- **`clientes_comerciais`** — cadastro de clientes (nome, razão social, CNPJ/CPF, contato, endereço, segmento, ativo).
- **`catalogo_servicos`** — serviços padrão (nome, categoria, descrição, unidade, valor padrão, custo, margem, ativo).
- **`orcamentos`** — proposta (número, título, cliente denormalizado, datas, status, condições, subtotal/desconto/taxa/impostos/total, aprovação/recusa, created_by).
- **`orcamentos_itens`** — itens da proposta (tipo, código, descrição, detalhe, unidade, qtd, valor unit., desconto, total, ordem).

RLS: `empresa_id = get_active_empresa_id()` (mesmo padrão dos outros módulos), SELECT/INSERT/UPDATE/DELETE para `authenticated` respeitando empresa ativa; Super Admin também segue empresa ativa. Trigger `updated_at`. Sequência de numeração por empresa (função helper que gera `ORC-YYYY-NNNN`).

## 2. Permissões

Nova chave de permissão `comercial` com ações `view`, `create`, `edit`, `delete`, `approve`. Liberada por padrão para Super Admin e Principal; Admin/Consultor/Comercial ganham via tela de permissões existente.

## 3. Menu

Novo grupo **Comercial** no sidebar (`AppLayout.tsx` / config de menu), 3 itens:

- Dashboard Comercial → `/comercial`
- Orçamentos e Cotações → `/comercial/orcamentos`
- Clientes → `/comercial/clientes`
- Catálogo de Serviços → `/comercial/catalogo`

Guardas via `canAccessModule("comercial")` e fallback no `DashboardGuard`.

## 4. Rotas e páginas

```text
src/pages/comercial/
  ComercialDashboard.tsx     # KPIs + gráficos
  Orcamentos.tsx             # lista + filtros + ações
  OrcamentoNovo.tsx          # wizard (Cliente → Dados → Itens → Totais → Revisão)
  OrcamentoDetalhe.tsx       # visualização + PDF/Excel/status
  Clientes.tsx               # CRUD
  Catalogo.tsx               # CRUD de serviços
```

Registro em `src/App.tsx` dentro de `ProtectedRoute`.

## 5. Componentes

```text
src/components/comercial/
  ClienteFormDialog.tsx
  ServicoCatalogoDialog.tsx
  OrcamentoItemRow.tsx        # linha editável com autocomplete no catálogo
  OrcamentoTotais.tsx         # subtotal/desconto/taxa/total ao vivo
  StatusBadgeOrcamento.tsx
  RecusarDialog.tsx           # motivo obrigatório
```

## 6. Lógica financeira (`src/lib/orcamentoCalc.ts`)

- `total_item = qtd * valor_unit - desconto_item`
- `subtotal = Σ total_item`
- desconto geral percentual OU valor
- `total = subtotal - desconto + impostos + taxa_extra`
- Tudo em `Intl.NumberFormat pt-BR`, moeda BRL.

## 7. Status

Fluxo: rascunho → enviado → visualizado → aprovado/recusado, com vencido automático (data_validade < hoje) e cancelado manual. Ações: marcar enviado, marcar visualizado, aprovar, recusar (motivo), cancelar, duplicar.

## 8. PDF profissional (`src/lib/orcamentoPdf.ts`)

`jspdf` + `jspdf-autotable` (já usados no projeto). Cabeçalho com logo/empresa, dados do cliente, escopo, tabela de itens, resumo financeiro, condições, assinaturas, rodapé "SafetySoluções — Página X de Y". Marca d'água diagonal "RASCUNHO" quando status = rascunho.

## 9. Excel (`src/lib/orcamentoExcel.ts`)

`xlsx` (padrão do projeto): 3 abas — Proposta, Itens, Resumo.

## 10. Envio

- **WhatsApp:** botão abre `https://wa.me/?text=...` com mensagem pronta.
- **E-mail:** `mailto:` com assunto/corpo pré-preenchidos.
- (Rastreio, aceite online e conversão em OS ficam para Fase 2.)

## 11. Dashboard Comercial

Cards: total de propostas, valor em aberto, aprovadas, recusadas, vencidas, taxa de conversão, valor aprovado no mês, ticket médio. Gráficos (recharts, já usado): por status, previsão por mês, por cliente, serviços mais cotados.

## 12. UX

- Desktop: tabela + filtros no topo.
- Mobile: cards, wizard em etapas, botões grandes, sem scroll horizontal.
- Usa `PageHeader`, `EmptyState`, `StatusBadge`, skeletons e cor primária (laranja) para ação principal — padrão do sistema.

## Ordem de execução

1. Migration (4 tabelas + RLS + GRANTs + numeração).
2. Tipos regenerados → helpers (`orcamentoCalc`, `orcamentoPdf`, `orcamentoExcel`).
3. Páginas Clientes e Catálogo (dependências do wizard).
4. Página Orçamentos (lista + wizard + detalhe).
5. Dashboard Comercial.
6. Menu + permissão + rotas.
7. Smoke test build/tsgo.

## Fora de escopo (Fase 2)

Rastreio de visualização, portal público de aceite, assinatura digital, conversão em OS, integração financeiro, templates avançados de proposta.

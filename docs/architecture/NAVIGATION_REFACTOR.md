# Refatoração da Arquitetura de Navegação — SafetySoluções

## 1. Visão Geral e Filosofia Arquitetural

O **SafetySoluções** é um SaaS integrado de Gestão de Segurança e Saúde do Trabalho (SST), Engenharia Ocupacional e Gestão de EPIs.

A nova arquitetura de navegação reorganiza a experiência do usuário em torno do princípio central:
> **O Cadastro Mestre alimenta os módulos operacionais e os documentos de SST.**

Hierarquia conceitual:
```text
EMPRESA / UNIDADE
   ↓
ESTABELECIMENTO
   ↓
SETOR
   ↓
AMBIENTE
   ↓
PROCESSO
   ↓
FUNÇÃO / CARGO
   ↓
GES (GRUPO DE EXPOSIÇÃO SIMILAR)
   ↓
EXPOSIÇÕES E RISCOS
   ↓
AVALIAÇÕES E MEDIDAS DE CONTROLE
   ↓
DOCUMENTOS SST (PGR, PCMSO, LTCAT, LAUDOS, PPP, eSocial)
```

---

## 2. Estrutura Anterior vs. Estrutura Proposta

### 2.1 Estrutura Anterior (Menu Legado)
- **Cadastro**: Dashboard, Empresas / Unidades, Funcionários, Usuários Liberados
- **Gestão Documental**: Documentação SST, Dossiê do Colaborador
- **Portal RH**: Portal RH — ASO
- **Gestão de ASO**: Exames Ocupacionais
- **Gestão de EPIs**: Dashboard, Cadastro de EPIs, Estoque por Unidade, Entregas, Solicitação de Materiais, Relatórios
- **Treinamentos**: Listas de Presença, Vídeos / Conteúdos
- **Inspeções**: Dashboard, Listagem, Cadastro de Local, Extintores (NR-23)
- **Comercial**: Dashboard Comercial, Orçamentos e Cotações, Clientes, Catálogo de Serviços

### 2.2 Estrutura Proposta (Nova Navegação)

```text
🏠 Dashboard (/)

🏢 CADASTRO MESTRE
   ├── Empresas / Unidades (/cadastro/empresas)
   ├── Cargos e Funções (/cadastro/funcionarios)
   ├── Estrutura Ocupacional & GES (/documentacao-sst?aba=ges)
   └── Limpeza de Cadastros (/cadastro/limpeza)

📋 GESTÃO SST
   ├── Documentação SST (/documentacao-sst)
   ├── PGR — Gerenciamento de Riscos (/pgr)
   ├── PCMSO — Saúde Ocupacional (/pcmso/dashboard)
   ├── LTCAT — Laudo Técnico (/ltcat)
   ├── Laudos e Programas (/programas)
   └── PPP — Perfil Previdenciário (/central-ppp)

👥 COLABORADORES
   ├── Colaboradores (/cadastro/funcionarios)
   ├── Dossiê do Colaborador (/arquivo-digital)
   └── Painel de Vencimentos (/arquivo-digital/vencimentos)

🩺 SAÚDE OCUPACIONAL
   ├── Exames e ASO (/aso)
   └── Portal RH — ASO (/rh/asos)

🦺 GESTÃO DE EPIs
   ├── Visão Geral EPIs (/)
   ├── Cadastro de EPIs (/epis)
   ├── Estoque por Unidade (/epis/controle-contrato)
   ├── Solicitações de Materiais (/epis/solicitacoes-materiais)
   ├── Entregas e Fichas (/entregas)
   └── Relatórios de EPIs (/relatorios)

🎓 TREINAMENTOS
   ├── Listas de Presença / DDS (/dds)
   └── Vídeos / Conteúdos (/video-treinamentos)

🔎 INSPEÇÕES
   ├── Dashboard (/inspecoes-se/dashboard)
   ├── Inspeções e Apontamentos (/inspecoes-se)
   ├── Locais e Obras (/inspecoes-se/obras)
   └── Extintores (NR-23) (/extintores)

📊 RELATÓRIOS
   └── Central de Relatórios (/relatorios)

💼 COMERCIAL
   ├── Dashboard Comercial (/comercial)
   ├── Orçamentos e Cotações (/comercial/orcamentos)
   ├── Clientes (/comercial/clientes)
   └── Catálogo de Serviços (/comercial/catalogo)

⚙️ ADMINISTRAÇÃO
   ├── Usuários Liberados (/cadastro/usuarios)
   └── Painel Super Admin (/admin - condicional)
```

---

## 3. Matriz de Migração (Mapeamento Rota a Rota)

| Menu Anterior | Rota Existente | Novo Grupo Proposto | Novo Label Visual | Permissão Mantida (`moduleKey`) |
| :--- | :--- | :--- | :--- | :--- |
| Cadastro → Empresas / Unidades | `/cadastro/empresas` | Cadastro Mestre | Empresas / Unidades | `cadastro_empresas` |
| Cadastro → Funcionários | `/cadastro/funcionarios` | Cadastro Mestre & Colaboradores | Cargos e Colaboradores | `cadastro_funcionarios` |
| *(Aba GES interna)* | `/documentacao-sst?aba=ges` | Cadastro Mestre | Estrutura Ocupacional & GES | `pgr` |
| Gestão Documental → Documentação SST | `/documentacao-sst` | Gestão SST | Documentação SST | `pgr` |
| *(Atalho PGR)* | `/pgr` | Gestão SST | PGR — Gerenciamento de Riscos | `pgr` |
| *(Atalho PCMSO)* | `/pcmso/dashboard` | Gestão SST | PCMSO — Saúde Ocupacional | `pcmso` / `pgr` |
| *(Atalho LTCAT)* | `/ltcat` | Gestão SST | LTCAT — Laudo Técnico | `ltcat` |
| *(Atalho Laudos)* | `/programas` | Gestão SST | Laudos e Programas | `pgr` |
| *(Atalho PPP)* | `/central-ppp` | Gestão SST | PPP — Perfil Previdenciário | `ppp` |
| Gestão Documental → Dossiê do Colaborador | `/arquivo-digital` | Colaboradores | Dossiê do Colaborador | `arquivo_digital` |
| *(Sub-rota Arquivo Digital)* | `/arquivo-digital/vencimentos` | Colaboradores | Painel de Vencimentos | `arquivo_digital` |
| Gestão de ASO → Exames Ocupacionais | `/aso` | Saúde Ocupacional | Exames e ASO | `aso` |
| Portal RH → Portal RH — ASO | `/rh/asos` | Saúde Ocupacional | Portal RH — ASO | `portal_rh` |
| Gestão de EPIs → Dashboard | `/` | Gestão de EPIs | Visão Geral | `dashboard` |
| Gestão de EPIs → Cadastro de EPIs | `/epis` | Gestão de EPIs | Cadastro de EPIs | `epis` |
| Gestão de EPIs → Estoque por Unidade | `/epis/controle-contrato` | Gestão de EPIs | Estoque por Unidade | `estoque_contrato` |
| Gestão de EPIs → Solicitação de Materiais | `/epis/solicitacoes-materiais` | Gestão de EPIs | Solicitações de Materiais | `solicitacoes_materiais` |
| Gestão de EPIs → Entregas | `/entregas` | Gestão de EPIs | Entregas e Fichas | `entregas` |
| Gestão de EPIs → Relatórios | `/relatorios` | Gestão de EPIs & Relatórios | Relatórios de EPIs | `relatorios` |
| Treinamentos → Listas de Presença | `/dds` | Treinamentos | Listas de Presença / DDS | `dds` |
| Treinamentos → Vídeos / Conteúdos | `/video-treinamentos` | Treinamentos | Vídeos / Conteúdos | `video_treinamentos` |
| Inspeções → Dashboard | `/inspecoes-se/dashboard` | Inspeções | Dashboard | `inspecoes_se` |
| Inspeções → Listagem | `/inspecoes-se` | Inspeções | Inspeções e Apontamentos | `inspecoes_se` |
| Inspeções → Cadastro de Local | `/inspecoes-se/obras` | Inspeções | Locais e Obras | `inspecoes_se` |
| Inspeções → Extintores (NR-23) | `/extintores` | Inspeções | Extintores (NR-23) | `extintores` |
| Cadastro → Usuários Liberados | `/cadastro/usuarios` | Administração | Usuários Liberados | `cadastro_usuarios` |
| Admin → Painel Admin | `/admin` | Administração | Painel Super Admin | `isSuperAdmin` |

---

## 4. Dependências Críticas

1. **Permissões Granulares (`canAccessModule`):**
   - Nenhuma permissão é contornada. Todos os itens usam os tokens originais (`pgr`, `ltcat`, `ppp`, `aso`, `portal_rh`, `epis`, `estoque_contrato`, `solicitacoes_materiais`, `entregas`, `relatorios`, `cadastro_empresas`, `cadastro_funcionarios`, `cadastro_usuarios`, `dds`, `video_treinamentos`, `inspecoes_se`, `extintores`, `comercial`).
2. **Contexto Multiempresa (`empresaId` / `setActiveEmpresaId`):**
   - O seletor de empresa ativa permanece intacto no topo da barra lateral e no cabeçalho mobile.
3. **Comportamento Mobile:**
   - A barra inferior mobile (`mobileBottomItems`) continua com os 4 atalhos principais mais botão "Mais", garantindo ergonomia para operadores de campo.

---

## 5. Riscos e Mitigações

| Risco Identificado | Severidade | Mitigação Aplicada |
| :--- | :--- | :--- |
| Quebra de links diretos/salvos | Alta | Nenhuma rota do `App.tsx` foi renomeada ou removida. Os links existentes e redirects continuam 100% preservados. |
| Perda de acesso por perfil restrito | Alta | Cada item do menu novo mantém a checagem com `canAccess(item.moduleKey)`. |
| Rolagem excessiva no menu | Média | Apenas o grupo ativo é expandido automaticamente; os demais iniciam fechados com acordeom inteligente. |

---

## 6. Arquivos Envolvidos

### Arquivo Modificado:
- `src/components/AppLayout.tsx` (Estruturação dos grupos, estados de expansão e renderização dos itens)

### Arquivos Preservados (NÃO Modificados):
- `src/App.tsx` (Rotas e proteção)
- `src/lib/permissions.ts` (Regras de permissão)
- `src/contexts/AuthContext.tsx` (Contexto de autenticação)
- Banco de dados Supabase, tabelas, RLS, Edge Functions e migrations.

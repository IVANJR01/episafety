# CHECKPOINT — NAVEGAÇÃO

## Alterado
- **Sidebar principal (`src/components/AppLayout.tsx`)**:
  - Reorganização profissional da hierarquia de navegação com foco no conceito central *"O Cadastro Mestre alimenta os módulos operacionais e os documentos de SST"*.
  - Criação dos grupos estruturados:
    - 🏠 **Dashboard** (acesso direto ao topo)
    - 🏢 **Cadastro Mestre** (Empresas/Unidades, Cargos/Funções, Estrutura Ocupacional & GES, Limpeza de Cadastros)
    - 📋 **Gestão SST** (Documentação SST, PGR, PCMSO, LTCAT, Laudos e Programas, Central PPP)
    - 👥 **Colaboradores** (Quadro de Colaboradores, Dossiê do Colaborador, Painel de Vencimentos)
    - 🩺 **Saúde Ocupacional** (Exames e ASO, Portal RH — ASO)
    - 🦺 **Gestão de EPIs** (Cadastro de EPIs, Estoque por Unidade, Solicitações de Materiais, Entregas e Fichas, Relatórios de EPIs)
    - 🎓 **Treinamentos** (Listas de Presença / DDS, Treinamentos em Vídeo)
    - 🔎 **Inspeções** (Dashboard, Inspeções e Apontamentos, Locais e Obras, Extintores NR-23)
    - 📊 **Relatórios** (Central Consolidada de Relatórios)
    - 💼 **Comercial** (Dashboard, Orçamentos, Clientes, Catálogo de Serviços)
    - ⚙️ **Administração** (Usuários Liberados e Painel Super Admin condicional)
- **Estados inteligentes de navegação**:
  - Detecção precisa de item ativo via função `isItemActive`, suportando parâmetros de URL (ex: `?aba=ges`), subpastas e rotas equivalentes.
  - Expansão automática do grupo pai correspondente à rota atual com preservação da abertura/fechamento manual pelo usuário.
- **Documentação Arquitetural**:
  - Criação do documento `docs/architecture/NAVIGATION_REFACTOR.md` contendo matriz de migração, análise de riscos e preservações.

## Preservado
- **Rotas e Roteamento (`src/App.tsx`)**: 100% das mais de 60 rotas existentes preservadas intactas, sem renomear rotas nem quebrar deep links salvos.
- **Banco de Dados e Persistência**: Nenhuma tabela, coluna, migration ou trigger modificada.
- **Row Level Security (RLS)**: Políticas e isolamento mantidos 100% inalterados.
- **Autenticação e Sessão**: Regras do `AuthContext`, switcher multiempresa e controle de perfis mantidos.
- **Regras de Negócio e Cálculos**: Cálculos de SST, geração de PDFs, fluxo de aprovação por item e entregas mantidos intactos.
- **Compatibilidade de Testes**: Preservação de todos os exports legados de arrays de menu para retrocompatibilidade com testes e módulos.

## Testado
- **Testes Automatizados (`vitest`)**:
  - `src/components/AppLayout.menu.test.ts` executado e aprovado com 5/5 testes passando.
- **Compilação de Produção (`npm run build`)**:
  - Executado com sucesso gerando o bundle de produção e service worker offline sem nenhum erro de TypeScript.
- **Responsividade e Mobile**:
  - Barra inferior mobile (`mobileBottomItems`) preservada com atalhos de alta prioridade.
  - Drawer mobile expansível com fechamento automático em toque/navegação.
- **Permissões Granulares**:
  - Mapeamento estrito de `canAccess(moduleKey)` em todos os grupos e subitens.

## Pendências
- Nenhuma pendência técnica. A arquitetura de navegação está implementada e estável.

## Próximo passo
- Commit e push das alterações para o repositório remoto.

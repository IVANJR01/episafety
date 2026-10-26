# CHECKPOINT — NAVEGAÇÃO

## Alterado
- **Sidebar principal (`src/components/AppLayout.tsx`)**:
  - Reorganização profissional da hierarquia de navegação com foco no conceito central *"O Cadastro Mestre alimenta os módulos operacionais e os documentos de SST"*.
  - Criação dos grupos estruturados:
    - 🏠 **Dashboard** (acesso direto ao topo)
    - 🏢 **Cadastro Mestre** (Empresas/Unidades, Estrutura Ocupacional & GES, Quadro de Colaboradores, Dossiê do Colaborador, Limpeza de Cadastros)
    - 📋 **Gestão SST** (Documentação SST, PGR, LTCAT, Laudos e Programas, Central PPP)
    - 🩺 **Saúde Ocupacional** (PCMSO — Saúde Ocupacional, Exames e ASO, Portal RH — ASO, Painel de Vencimentos)
    - 🦺 **Gestão de EPIs** (Cadastro de EPIs, Estoque por Unidade, Solicitações de Materiais, Entregas e Fichas, Relatórios de EPIs)
    - 🎓 **Treinamentos** (Listas de Presença / DDS, Treinamentos em Vídeo)
    - 🔎 **Inspeções** (Dashboard, Inspeções e Apontamentos, Locais e Obras, Extintores NR-23)
    - 📊 **Relatórios** (Central Consolidada de Relatórios)
    - 💼 **Comercial** (Dashboard, Orçamentos, Clientes, Catálogo de Serviços)
    - ⚙️ **Administração** (Usuários Liberados e Painel Super Admin condicional)
- **Estados inteligentes de navegação**:
  - Detecção precisa de item ativo via função `isItemActive`, suportando parâmetros de URL (ex: `?aba=ges`), subpastas e rotas equivalentes.
  - Expansão automática do grupo pai correspondente à rota atual com preservação da abertura/fechamento manual pelo usuário.
- **Aprimoramento de Responsividade e Legibilidade da Sidebar (Tarefa 1)**:
  - Resolução da causa estrutural do truncamento excessivo (`...`):
    - Dimensionamento do `<aside>`: Desktop com `lg:w-[280px] xl:w-[290px] shrink-0` (substituindo o antigo `w-64` rígido de 256px), impedindo esmagamento flexbox pelo conteúdo.
    - Mobile: Drawer fluido com `w-[280px] max-w-[85vw]`.
    - Scrollbar: Implementação da classe `.sidebar-scroll` fina (5px) com track transparente no `src/index.css`, eliminando o consumo de 16px da barra nativa do Windows.
    - Hierarquia de Subitens: Otimização do recuo de `ml-4 pl-3` (29px) para `ml-3 pl-2.5` (23px) e padding `px-2.5 py-1.5`, com tipografia de alta densidade SaaS `text-[13px] leading-snug`.
    - Acessibilidade e Tooltip: Inclusão do atributo nativo `title={item.label}` em todos os botões e links de navegação.
    - Isolamento de Layout: Tag `<main>` com `flex-1 min-w-0 overflow-auto`.

## Preservado
- **Rotas e Roteamento (`src/App.tsx`)**: 100% das mais de 60 rotas existentes preservadas intactas, sem renomear rotas nem quebrar deep links salvos.
- **Nomenclatura dos Módulos**: Mantida íntegra para revisão dedicada em etapa subsequente (Tarefa 2), sem misturar escopos.
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
  - Drawer mobile fluido (`max-w-[85vw]`) com backdrop escuro e fechamento automático ao clicar no link ou fora.
- **Permissões Granulares**:
  - Mapeamento estrito de `canAccess(moduleKey)` em todos os grupos e subitens.

## Pendências
- Nenhuma pendência na infraestrutura visual da Sidebar.

## Próximo passo
- Pronto para avançar para a Tarefa 2 (Revisão da arquitetura de nomenclatura do menu) quando o usuário desejar.

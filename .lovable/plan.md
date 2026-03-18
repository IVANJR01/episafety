

## Revisao Completa - Erros Encontrados

Apos revisar o codigo, console logs e estrutura do projeto, identifiquei os seguintes problemas:

### 1. Erro de chave duplicada no menu lateral (CRITICO - aparece no console)

O console mostra: `Encountered two children with the same key: /cadastro/empresas`

**Causa**: No `AppLayout.tsx` linhas 39-40, existem **dois itens duplicados** no array `cadastroItems` com o mesmo `path`:
```typescript
{ path: "/cadastro/empresas", label: "Empresas", ... },
{ path: "/cadastro/empresas", label: "Empresas / Unidades", ... },
```
Ambos usam `item.path` como `key` no `.map()`, gerando o erro. Alem disso, um deles e redundante.

**Correcao**: Remover a linha 39 (o item duplicado "Empresas"), mantendo apenas "Empresas / Unidades".

### 2. Paginas importadas mas sem rota

Os seguintes imports em `App.tsx` nao sao utilizados em nenhuma rota:
- `OrdensServico` (importado na linha do arquivo mas nao ha `<Route>` correspondente)
- Verificar se `Filiais` e `PCMSO` tambem sao importados sem uso

Nao ha impacto funcional, mas gera codigo morto.

### Resumo das Correcoes

| # | Arquivo | Problema | Severidade |
|---|---------|----------|------------|
| 1 | `AppLayout.tsx` L39-40 | Item duplicado no `cadastroItems` gera erro React de key duplicada | Alta |
| 2 | `App.tsx` | Imports nao utilizados (codigo morto) | Baixa |

### Alteracoes Planejadas

**`src/components/AppLayout.tsx`**: Remover a linha 39 duplicada, mantendo apenas:
```typescript
const cadastroItems: NavItem[] = [
  { path: "/cadastro", label: "Dashboard", icon: LayoutDashboard, moduleKey: "cadastro_funcionarios" },
  { path: "/cadastro/empresas", label: "Empresas / Unidades", icon: Building2, moduleKey: "cadastro_empresas" },
  { path: "/cadastro/funcionarios", label: "Funcionários", icon: Users, moduleKey: "cadastro_funcionarios" },
  { path: "/cadastro/usuarios", label: "Usuários Liberados", icon: Shield, moduleKey: "cadastro_usuarios" },
];
```

**`src/App.tsx`**: Remover imports nao utilizados (se confirmados).


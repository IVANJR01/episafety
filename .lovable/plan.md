

## Plano: Corrigir rolagem horizontal na Matriz de Exames

### Problema
Na aba "Matriz" do módulo de Exames, ao rolar horizontalmente, as colunas fixas (Nº e COLABORADOR) ficam com fundo transparente, permitindo que o conteúdo das colunas que passam por baixo fique visível — criando sobreposição visual confusa.

### Causa Raiz
As células do `tbody` usam `bg-inherit` para as colunas sticky, mas como as linhas alternam entre `bg-background` e `bg-muted/30`, o `bg-inherit` nem sempre garante um fundo opaco sólido, especialmente em certos navegadores mobile.

### Correção (1 arquivo)

**`src/pages/ExamesModule.tsx`** — Seção da tabela Matriz (linhas ~843-877):

1. Substituir `bg-inherit` nas colunas sticky do `tbody` por cores de fundo explícitas e opacas baseadas na paridade da linha (`idx % 2`)
2. Garantir que as células sticky do `thead` tenham `z-index` suficiente para sobrepor corretamente
3. Adicionar sombra lateral sutil (`shadow`) na última coluna sticky (COLABORADOR) para dar feedback visual de que há conteúdo por baixo

### Detalhes Técnicos
- Linhas pares: usar `bg-background` explícito (não `bg-inherit`)
- Linhas ímpares: usar `bg-muted` explícito (não `bg-muted/30` que é semi-transparente)
- Adicionar `after:` pseudo-element com sombra na coluna COLABORADOR sticky para separação visual


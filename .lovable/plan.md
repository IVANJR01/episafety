

## Plano: Botão de Atualização no Rodapé do Sidebar

O usuário quer que a versão no rodapé do sidebar seja clicável para verificar e aplicar atualizações, e que a versão seja sempre incrementada ao publicar.

### Mudanças

1. **`src/components/AppLayout.tsx`** — Transformar o texto da versão (`v1.0.0`) em um botão clicável que:
   - Mostra um ícone de refresh ao lado da versão
   - Ao clicar, verifica se há atualização do Service Worker disponível
   - Se houver, aplica a atualização (reload)
   - Se não houver, mostra um toast "Você já está na versão mais recente"
   - Estilizar com hover effect para indicar que é interativo

2. **`src/lib/version.ts`** — Incrementar a versão para `1.1.0` para refletir as mudanças recentes.

### Detalhes Técnicos

- O botão no sidebar vai chamar `navigator.serviceWorker.getRegistration()` e fazer `.update()` para forçar uma verificação
- Se uma atualização for encontrada, o evento `sw-update-available` já existente no `main.tsx` dispara o `UpdateBanner`
- Adicionar um toast via `sonner` para feedback imediato ao usuário
- O botão terá um ícone `RefreshCw` com animação de spin durante a verificação


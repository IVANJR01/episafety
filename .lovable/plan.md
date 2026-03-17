

## Problema

O usuário vincula um usuário a um contrato (via dialog "Vincular Usuário"), o `contrato_id` é salvo na tabela `usuarios_liberados`, mas a tela de Unidades não exibe o nome do usuário dentro do contrato.

## Causa

O componente `Filiais.tsx` exibe cada contrato apenas com nome e descrição. Não existe código que consulte `usuarios_liberados` filtrando por `contrato_id` nem que renderize esses nomes.

## Solução

1. **Carregar `usuarios_liberados` com `contrato_id`** no `loadData()` — nova query buscando registros onde `contrato_id` não é nulo
2. **Criar helper `getUsersForContrato(contratoId)`** que filtra os registros carregados
3. **Renderizar nomes** dentro de cada contrato na listagem expandida — exibir badges com o nome de cada usuário logo abaixo do nome/descrição do contrato

### Arquivo alterado

`src/pages/Filiais.tsx`:
- Novo estado `usuariosContratos` (array com id, nome, contrato_id)
- No `loadData`, adicionar: `supabase.from("usuarios_liberados").select("id, nome, contrato_id").not("contrato_id", "is", null)`
- Função `getUsersForContrato(id)` retorna usuários filtrados por `contrato_id === id`
- No bloco de renderização de cada contrato (seção expandida), após nome/descrição, mostrar badges com o nome de cada usuário vinculado


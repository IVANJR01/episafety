

## Diagnóstico

Consultei o banco de dados e o saldo atual está correto (CAPACETE: 36, LUVA: 49 -- ambos com diferença = 0 entre movimentações registradas e estoque). O problema original foi corrigido pela sincronização retroativa executada anteriormente.

Porém, o problema estrutural persiste: a sincronização do estoque do contrato depende de código no browser (`syncContractStockFromEntrega` em `Entregas.tsx`), que roda em `try/catch` não-bloqueante. Se falhar por qualquer motivo (rede, RLS, timing), o saldo fica errado permanentemente até intervenção manual.

## Plano de Correção Definitiva

### 1. Criar trigger no banco (migration SQL)

Criar uma função `sync_contrato_stock_on_entrega()` e um trigger `AFTER INSERT ON entregas` que automaticamente:
- Busca o `contrato_id` do funcionário vinculado à entrega
- Localiza o `contrato_epis` correspondente (contrato + epi)
- Para tipos `entrega`, `troca`, `substituicao`, `perda`, `dano`: deduz estoque
- Para `devolucao`: adiciona estoque
- Registra movimentação em `contrato_epis_movimentacoes`

Isso garante atomicidade -- se a entrega foi gravada, o estoque do contrato é atualizado na mesma transação.

### 2. Remover sincronização client-side

Em `src/pages/Entregas.tsx`, remover as chamadas a `syncContractStockFromEntrega` (linhas ~385 e ~468), pois o trigger fará isso automaticamente.

O arquivo `src/lib/contractStock.ts` pode ser mantido como referência ou removido.

### 3. Sem reconciliação de dados

Os dados atuais estão corretos, não é necessário reconciliar.

---

**Resultado**: Toda entrega registrada (online ou offline sincronizada) terá seu estoque de contrato atualizado atomicamente pelo banco, eliminando definitivamente o problema de saldos divergentes para a CG3 e todos os contratos (RN, CE, BA, etc).


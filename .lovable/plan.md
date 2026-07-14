# Plano — Condições de pagamento profissionais no módulo Orçamentos

Escopo restrito a **Comercial → Orçamentos e Cotações**. Nada em EPIs, Solicitação de Materiais, Inspeções, PGR, LTCAT, PPP, Portal RH, MFA, Termos.

## 1. Modelo de dados

Adicionar 1 coluna JSONB em `orcamentos`:

- `pagamento_config jsonb` — guarda toda a nova configuração.

Manter `formas_pagamento`, `condicoes_pagamento`, `cartao_credito_config` existentes para retrocompatibilidade (leitura), mas gravação nova passa por `pagamento_config`.

Formato:

```json
{
  "formas": ["PIX", "Cartão de crédito"],
  "avista": {
    "desconto_tipo": "percentual",
    "desconto_valor": 5,
    "valor_final": 3025.75,
    "aplica_pix": true
  },
  "pix": { "desconto_tipo": "percentual", "desconto_valor": 5, "valor_final": 3025.75 },
  "cartao": {
    "max_parcelas": 12,
    "parcelas_sem_juros": 2,
    "juros_mensal": 2.99,
    "tabela": [ { "n": 1, "valor_parcela": 3185, "total": 3185, "tem_juros": false }, ... ]
  }
}
```

## 2. Helper central

Novo arquivo `src/lib/orcamentoPagamento.ts` (estender o existente):

- `calcularDescontoAvista(total, tipo, valor)` → `{ desconto, valor_final }`
- `calcularParcelasCartao(total, maxParcelas, parcelasSemJuros, jurosMensal)` → array `{ n, valor_parcela, total, tem_juros }`
  - Sem juros: `total / n`
  - Com juros: Price `PMT = total * i / (1 - (1+i)^-n)`; `total_com_juros = PMT * n`
- `montarPagamentoConfig(...)` centraliza a saída para gravar no banco.

## 3. UI — `OrcamentoEditor.tsx`

Substituir a seção atual "Formas de pagamento" por:

- Checkboxes das formas (mantém as atuais).
- Se **À vista** ou **PIX** marcado → bloco "Desconto à vista/PIX":
  - Tipo (percentual/valor), valor, valor final calculado, toggle "Usar mesmo desconto no PIX".
- Se **Cartão de crédito** marcado → bloco "Parcelamento no cartão":
  - Máximo de parcelas (1–12), Sem juros até (1–max), Juros ao mês (%).
  - Preview: tabela de parcelas (desktop) / cards empilhados (mobile <640px), sem scroll horizontal.

Validações: total > 0, desconto ≤ total, se cartão marcado exigir os 3 campos.

## 4. PDF — `orcamentoPdf.ts`

Nova seção "Condições de pagamento":

```
PIX / À vista com 5% de desconto: R$ 3.025,75
Cartão de crédito:
  até 2x sem juros
  de 3x a 12x com juros de 2,99% a.m.

Tabela de parcelamento:
  1x de R$ 3.185,00 sem juros
  ...
  12x de R$ X — Total R$ Y (com juros)
```

## 5. Excel — `orcamentoExcel.ts`

Na aba Proposta, incluir: valor original, desconto à vista/PIX, valor final, max parcelas, sem juros até, juros mensal. Nova aba **Parcelamento** com colunas: Nº, Valor parcela, Total, Com juros.

## 6. Retrocompatibilidade

Ao abrir orçamento antigo:
- Se `pagamento_config` nulo mas houver `cartao_credito_config` / `condicoes_pagamento`, mapear para a nova estrutura em memória (não regravar automaticamente).

## 7. Passos de execução

1. Migração SQL: adicionar `pagamento_config jsonb` em `orcamentos`.
2. Estender `src/lib/orcamentoPagamento.ts` com helpers de desconto e Price.
3. Refatorar bloco Formas de pagamento em `src/pages/comercial/OrcamentoEditor.tsx` (UI + preview + validação).
4. Atualizar `orcamentoPdf.ts` (nova seção + tabela) e `orcamentoExcel.ts` (nova aba).
5. Verificar tipos e rodar tsgo.

## Fora de escopo

Não altero fluxos de aprovação, envio por e-mail, catálogo, clientes, ou qualquer módulo fora de Orçamentos.

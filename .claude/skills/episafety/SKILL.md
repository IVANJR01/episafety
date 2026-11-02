---
name: episafety
description: Regras de trabalho no código do EPISafety (SST - EPI, ASO, PGR, PCMSO, inspeções). Use sempre que for mexer neste repositório: convenções de idioma, geração de documentos no navegador, armadilhas do banco Supabase, estilo de teste e o que nunca pode ser comitado.
---

# EPISafety

Sistema de SST (Segurança e Saúde no Trabalho) usado por técnico de
segurança: Gestão de EPIs, ASO, PGR, PCMSO, Ordem de Serviço, inspeções
e Central de Documentação.

Pilha: React + TypeScript + Vite + Tailwind + shadcn/ui (Radix) +
Supabase (Postgres + Auth + Storage) + TanStack Query. App também roda
como PWA e via Capacitor.

## Quando usar

Em qualquer alteração neste repositório, antes de escrever código.

## Idioma

1. Todo comentário de código em **português**.
2. Toda mensagem de commit em **português**.
3. Explicação para o usuário em português simples: ele é técnico de
   segurança, não programador. Diga o que mudou na tela, não o nome da
   função.

## Não existe servidor

Todo documento é gerado **no navegador**. Não crie endpoint, job ou
script de backend para gerar PDF/Word/Excel.

- PDF: `jspdf` + `jspdf-autotable`
- Word: `docx`
- Excel: `exceljs`, `xlsx`, `xlsx-js-style`
- ZIP: `jszip`
- Assinatura: `signature_pad`

## Regra de ouro das regras de negócio

Cálculo de norma (validade de ASO, grau de risco, periodicidade) vai em
`src/lib/<assunto>.ts` com teste ao lado, **nunca** dentro do componente
de tela. Exemplos que já seguem isso: `src/lib/validadeAso.ts`,
`src/lib/matrizSaudeDoGes.ts`, `src/lib/ordemServicoDoGes.ts`.

Uma só fonte de verdade: ASO e PCMSO leem a mesma matriz de saúde do GES
(`matrizSaudeDoGes.ts`). Se precisar do mesmo dado em duas telas,
extraia a função, não copie.

## Armadilhas do banco (já custaram bug em produção)

- `pgr_inventario_itens.nivel_risco` é **GENERATED ALWAYS**
  (`severidade * probabilidade`). Nunca envie essa coluna no insert.
- `grupo` é enum `pgr_perigo_grupo`; `tipo_exposicao` é enum
  `pgr_exposicao_tipo` com valores `continua | intermitente | eventual |
  nao_aplicavel` — tudo minúsculo, sem acento. Mande o valor do enum,
  não o texto da planilha.
- `ghe_id` aponta para a tabela `ghe_ges`; `ges_id` aponta para
  `sst_ges`. São tabelas diferentes — trocar uma pela outra estoura FK.
- Antes de alterar schema, leia as tabelas existentes.

## Teste

`npm test` (vitest) e `npm run build` antes de entregar.

Um teste que passa sem proteger nada é pior que nenhum teste. Depois de
escrever o teste, **sabote** o código de propósito e confirme que ele
quebra. Sabotagens que não quebraram significam teste mal escrito, não
código seguro.

Detalhes de jsdom já descobertos:
- Aba do Radix responde a `fireEvent.mouseDown`, não a `click`.
- Dois `render()` no mesmo teste exigem `cleanup()` entre eles.
- Dado que vem de query assíncrona só existe dentro de `waitFor`.

## Nunca comite

- Chave privada, `.pfx`, `.p12`, `.key`, `.base64` (certificado
  ICP-Brasil A1 vai só para os secrets do Supabase / Vault).
- Chave de API de terceiro.
- CPF, e-mail ou dado pessoal real — em teste e em página pública use
  dado fictício e diga na tela que é fictício.

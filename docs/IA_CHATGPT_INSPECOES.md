# Trocar a IA das Inspeções para o ChatGPT (OpenAI)

## Antes de tudo: a assinatura do ChatGPT não serve

Isto é o ponto mais importante desta página, e é o que costuma custar tempo:

> **ChatGPT Plus e ChatGPT Pro não dão acesso à API.** São produtos e
> cobranças separados. Pagar a assinatura não libera nenhum crédito de API,
> e a chave usada pelo sistema não sai de dentro do chat.

O que o sistema precisa é de uma **chave de API**, criada em
`platform.openai.com`, com **crédito próprio** — cobrado por uso (por token),
à parte da assinatura. Continuar pagando o Pro é opcional e não muda nada aqui.

## Passo a passo

1. Entre em <https://platform.openai.com> com a mesma conta do ChatGPT.
2. **Billing → Add payment method** e coloque um crédito inicial. Sem crédito,
   a chave existe mas toda chamada volta com erro de cota.
3. **API keys → Create new secret key**. Copie o valor (começa com `sk-`); ele
   só aparece uma vez.
4. No painel do Supabase do projeto: **Edge Functions → Secrets** (ou
   *Project Settings → Edge Functions*), crie:

   | Nome | Valor |
   |---|---|
   | `OPENAI_API_KEY` | a chave copiada |
   | `OPENAI_MODEL` | opcional — o modelo, se quiser outro |

5. Publique a função de novo, para ela subir com a variável nova:

   ```bash
   supabase functions deploy sugerir-nr
   ```

6. Teste no módulo de Inspeções, no botão **"Sugerir NR, Gravidade e Ação (IA)"**.

## Como o sistema escolhe a IA

`supabase/functions/_shared/provedorIa.ts` decide em tempo de execução:

1. Existe `OPENAI_API_KEY`? → **OpenAI**. É a preferida, e ganha do Gemini
   mesmo que a chave antiga continue configurada.
2. Só existe `GEMINI_API_KEY`? → Gemini, como reserva.
3. Nenhuma das duas? → a função responde pela **base interna de
   palavras-chave** do próprio arquivo `sugerir-nr/index.ts`, que cobre os
   casos mais comuns (quadro elétrico, trabalho em altura, espaço confinado,
   falta de EPI, máquina sem proteção). O botão não quebra; só deixa de ter a
   parte generativa.

A troca de provedor foi barata porque o Gemini já era chamado pelo **endpoint
compatível com a OpenAI**. O corpo da requisição — `messages`, `tools`,
`tool_choice` — e o formato da resposta são os mesmos nos dois; mudam apenas
URL, chave e nome do modelo.

## Trocar de modelo depois

Basta mudar a variável `OPENAI_MODEL` e publicar a função de novo. Não é
preciso mexer em código. O padrão é um modelo de custo baixo, adequado para
classificar uma situação de inspeção em poucas linhas — a tarefa é curta e
não justifica o modelo mais caro.

## O que ainda usa Gemini

Só a função das Inspeções foi trocada, que é o que foi pedido. Continuam em
Gemini, e podem ser migradas do mesmo jeito:

| Função | Onde aparece |
|---|---|
| `nr-chatbot` | assistente de normas |
| `analyze-certificate` | leitura de certificado de treinamento |
| `parse-pcmso` | leitura de PCMSO em PDF |

As duas últimas mandam **arquivo** para a IA (`generateContent` com dados
embutidos), não só texto. Migrar essas exige converter para o formato de
imagem/arquivo da OpenAI — é mais do que trocar a URL, e por isso não foi
feito junto.

## Se der errado

| Sintoma | Causa provável |
|---|---|
| "Chave de IA inválida ou sem permissão" | chave errada, colada com espaço, ou projeto sem crédito |
| "Créditos insuficientes para IA" | falta saldo em Billing |
| "Limite de requisições excedido" | muitas chamadas seguidas; esperar alguns segundos |
| Sugestão aparece mas sempre igual | nenhuma chave configurada: está vindo da base interna de palavras-chave |

O último caso é o mais traiçoeiro, porque **parece** que a IA está
funcionando. Se a sugestão nunca varia e sempre bate com um dos cinco casos da
base interna, é sinal de que a chave não chegou na função.

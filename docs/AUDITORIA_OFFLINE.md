# Auditoria: o sistema sem internet

Levantamento feito em 17/08/2026, medindo o comportamento real no navegador
(rede desligada de propósito), não só lendo o código.

---

## Resumo em uma linha

O sistema **não abria** sem internet. Isso foi corrigido: agora abre, entra e
navega. **Gravar** sem internet continua funcionando só em parte do sistema —
o mapa está na seção 4.

---

## 1. O que foi medido ANTES da correção

Com a rede desligada e o aplicativo recarregado:

```
status HTTP do reload: SEM RESPOSTA
texto na tela: "No internet — ERR_INTERNET_DISCONNECTED"
service workers registrados: 0
```

Ou seja: a tela do navegador, não a do sistema.

**Por quê.** Não havia nenhum service worker guardando os arquivos do
aplicativo. Os dois arquivos que existiam — `public/sw.js` e
`public/service-worker.js` — não guardavam nada: eram *interruptores*, escritos
para apagar e desregistrar um service worker anterior. O anterior foi desligado
por um motivo legítimo: ele guardava o `index.html` e o entregava velho depois
de uma publicação. O `index.html` velho aponta para `/assets/algo-HASH.js` que a
publicação seguinte já apagou — 404, nada monta, tela branca.

**A consequência que passava despercebida.** Todo o trabalho offline que o
sistema já tinha — fila de sincronização, cache de tabelas por empresa, faixa
"Modo Offline", fotos de inspeção guardadas no aparelho — era inalcançável sem
internet, porque a pessoa não conseguia sequer chegar na tela para usar.

---

## 2. O que foi corrigido nesta rodada

Um service worker de verdade (`src/sw/servicoOffline.js`), gerado no build com
a lista dos arquivos daquela publicação.

A regra central existe para o defeito antigo não voltar:

| Tipo de pedido | Estratégia | Por quê |
|---|---|---|
| Abrir/recarregar uma tela | **rede primeiro**, cache só se falhar | com sinal o `index.html` vem sempre do servidor; não tem como ficar velho |
| `/assets/*` (nome com hash) | cache primeiro | o conteúdo daquele nome nunca muda |
| `/version.json` | **nunca do cache** | é o arquivo que diz se o cache está velho |
| Supabase e outros domínios | **não guarda nada** | resposta filtrada por empresa não pode ficar num cache que não conhece empresa |
| POST/PATCH/DELETE | não passa por cache | quem cuida é a fila de sincronização |

### Medido depois da correção

| Cenário | Resultado |
|---|---|
| Recarregar sem internet | abre em **281 ms** |
| Rota interna (`/entregas`) digitada sem internet | HTTP 200, tela monta |
| Quem já tinha entrado, sem internet | entra direto, menu completo, **não cai no login** |
| 8 telas navegadas sem internet | todas abrem, nenhum erro de JavaScript |
| **Publicar versão nova com alguém na antiga** | pega a nova em **266 ms**, sem tela branca |
| Perder o sinal antes de pegar a versão nova | abre na versão antiga (281 ms); ao voltar o sinal, passa para a nova (260 ms) |

O cenário em negrito é o que matou o service worker anterior. Foi reproduzido
de propósito: duas publicações reais, com os arquivos da primeira apagados do
servidor.

### Conflito encontrado e corrigido no caminho

O botão **"Atualizar"** do rodapé do menu chamava `forceAppUpdate()`, que
desregistrava todo service worker em `/sw.js`. Como `/sw.js` passou a ser
justamente o service worker da cópia offline, esse botão apagaria o modo
offline — a pessoa clicaria em "Atualizar" e perderia o funcionamento sem
internet, sem aviso e sem relação aparente com o que fez. Agora ele pede a
troca de versão em vez de desregistrar.

### De quebra

O rodapé mostrava `v2.4.6` — constante escrita à mão, parada há 290 commits.
Quem clicava em "Atualizar" via sempre o mesmo número e não tinha como saber se
o aplicativo trocou de versão. Agora mostra o commit publicado de verdade.

---

## 3. O que já funcionava e continua funcionando

- **Entrar sem internet**: a sessão e as permissões ficam guardadas no
  aparelho (`authSessionCache` + `offline_auth_cache:<email>`). Quem já entrou
  antes, com sinal, continua entrando sem sinal. Quem **nunca** entrou naquele
  aparelho não consegue — a primeira autenticação precisa do servidor.
- **Ver dados já vistos**: as consultas ficam guardadas por até 24 h
  (React Query no `localStorage`) e as tabelas críticas por até 7 dias
  (`offlineStorage`), separadas por usuário **e por empresa**.
- **Fila de sincronização**: o que é gravado offline entra numa fila e sobe
  sozinho quando a conexão volta — inclusive ao trazer o aplicativo de volta do
  segundo plano, não só no evento de reconexão.
- **Fotos de inspeção offline**: ficam no IndexedDB e sobem depois.

---

## 4. O que AINDA NÃO funciona sem internet — mapa honesto

Contagem feita no código: **91 arquivos** gravam direto no Supabase
(`.insert` / `.update` / `.delete`). Desses, **9** têm caminho offline.

### Grava offline hoje

Pelo `useSupabaseData` (fila automática):
`Dashboard`, `EPIs`, `Entregas`, `Funcionarios`, `DDS`, `Relatorios`,
`OrdensServico`, `PCMSO`, `CadastroDashboard`.

Com fila explícita:
`Entregas`, `DDS`, `InspecoesSE`, `Treinamentos`, `Empresas`,
`UsuariosLiberados`, `AsoExames`, `CadastroCursos`, `CadastroFuncaoRequisitos`.

### NÃO grava offline

Todo o resto — cerca de 80 telas. As maiores: **PGR** (assistente completo),
**PCMSO** (elaboração), **LTCAT**, **PPP**, **CAT/eSocial**, **ASO** (exceto
exames), **Arquivo Digital**, **Comercial/Orçamentos**, **Obras**,
**Vistoria**, **Levantamento de campo**.

Nessas telas, sem internet, a gravação simplesmente falha. A tela abre e mostra
o que estava guardado, mas o que a pessoa preencher não é salvo em lugar nenhum.

### Nunca vai funcionar sem internet (e não deveria fingir que funciona)

- **Login pela primeira vez** naquele aparelho.
- **Recuperar senha**, **MFA**.
- **Gerar PDF com foto que ainda não foi baixada** (a foto está no servidor).
- **Qualquer coisa com IA** (análise de certificado, chatbot NR, leitura de
  PCMSO): são chamadas a serviço externo.
- **Envio de e-mail**, **integrações eSocial**, **Google Drive**.
- **Relatórios que somam dados no banco** (funções RPC), quando o resultado
  ainda não foi guardado.

---

## 5. Recomendação de prioridade para a próxima rodada

O caminho de gravação offline já existe e é testado — falta **ligá-lo** nas
telas certas. Vale ligar por ordem de "quem usa isso no campo, sem sinal":

1. **Inspeções / Levantamento de campo** — é o uso que mais acontece longe de
   sinal. Inspeções já tem parte; falta o levantamento.
2. **ASO e Arquivo Digital** — recebimento de documento em obra.
3. **PGR (assistente)** — é longo, e perder o preenchido é caro.

**O que NÃO recomendo:** ligar a fila de uma vez em todas as 80 telas, por um
atalho no cliente do Supabase. Muitas gravações leem de volta a linha criada
(`.select().single()`) e seguem usando o id gerado pelo banco. Uma fila que
devolve "deu certo" sem ter gravado quebraria essas telas de um jeito silencioso
— e trocar "não salvou, e avisou" por "disse que salvou, e sumiu" seria pior do
que está hoje. Cada tela precisa ser lida antes de ser ligada.

---

## 6. Onde está cada coisa

| Arquivo | Papel |
|---|---|
| `src/sw/servicoOffline.js` | service worker: guarda o aplicativo, decide cache × rede |
| `src/sw/servicoOffline.test.ts` | testes das regras acima |
| `vite.config.ts` | gera `dist/sw.js` com a lista de arquivos da publicação |
| `src/main.tsx` | registra o service worker (não no aplicativo nativo) |
| `src/lib/offlineStorage.ts` | cache de tabelas + fila de sincronização |
| `src/hooks/useOfflineSync.ts` | sobe a fila quando a conexão volta |
| `src/lib/authSessionCache.ts` | sessão guardada para entrar sem internet |
| `src/lib/inspecoesOfflinePhotos.ts` | fotos de inspeção no IndexedDB |
| `src/components/OfflineBanner.tsx` | faixa "Modo Offline" e contagem de pendências |
| `src/lib/appUpdate.ts` | limpeza de versões antigas — **não toca na cópia offline** |

# Render 3D — Módulo 01

Cena 3D real, construída em código com Three.js e renderizada frame a frame
para um arquivo de vídeo. **Não é geração por IA** — é geometria, materiais,
luz e câmera definidos aqui dentro, o que torna o resultado 100 % repetível:
rodar de novo produz exatamente o mesmo vídeo.

## Dois arquivos de cena

| Arquivo | O que é |
|---|---|
| `modulo01.html` | **Módulo completo** — as 11 cenas, 14 minutos, com legendas queimadas |
| `cena3d.html` | Piloto de 82 s, primeira prova do método |

Renderize o completo com `node render-full.mjs` (grava cena a cena em
`raw/`, então é **retomável**: se parar no meio, rodar de novo continua de
onde ficou). O piloto usa `render.mjs`.

## As 11 cenas (14:00)

| Cena | Início | Duração | Conteúdo |
|-----:|-------:|--------:|----------|
| 01 | 00:00 | 0:30 | Abertura, cartela de título |
| 02 | 00:30 | 1:18 | Seis situações de trabalho em altura · placa ATENÇÃO |
| 03 | 01:48 | 1:36 | Conceito · cota de 2 m · situação A e B |
| 04 | 03:24 | 1:18 | Cinco exemplos de atividade · cartela |
| 05 | 04:42 | 1:36 | Identificando o perigo · quadro congelado · 4 marcadores |
| 06 | 06:18 | 1:12 | "É rapidinho" · escada mal apoiada · três frases |
| 07 | 07:30 | 1:24 | Planejamento · checklist de 7 itens |
| 08 | 08:54 | 1:36 | Hierarquia da prevenção · três níveis |
| 09 | 10:30 | 1:24 | Quiz com contagem de 5 s · resposta C |
| 10 | 11:54 | 1:00 | Organograma de responsabilidades |
| 11 | 12:54 | 1:06 | Resumo em cinco pontos · cartela final |

### Zonas 3D construídas

Pátio com estrutura metálica, plataforma com guarda-corpo, viga sem proteção,
cobertura metálica com linha de vida, escada fixa com gaiola, área de
manutenção com mezanino sem proteção e escada de mão, área de reunião de
equipe e uma sala de treinamento fechada. As zonas ficam distantes umas das
outras no mesmo mundo, então a câmera visita cada uma sem que as outras
apareçam — e nenhum objeto precisa ser ligado ou desligado.

## O que o piloto mostra (82 s)

| Tempo | Plano |
|------:|-------|
| 00:00 | Aéreo descendo sobre o pátio industrial · cartela de título |
| 00:13 | Plataforma com guarda-corpo e rodapé, trabalhador conectado |
| 00:27 | **Cota de 2 metros**, medida do piso da plataforma até o nível inferior, com os dois critérios da definição |
| 00:45 | **Situação incorreta**: viga sem guarda-corpo, sem cinturão conectado, ferramenta na borda — moldura vermelha, selo e dessaturação |
| 00:58 | **Conduta correta**: mesma tarefa com guarda-corpo, rodapé e cinturão ancorado — moldura verde e selo |
| 01:11 | Plano final subindo · cartela de encerramento |

A cota da terceira parte é desenhada por projeção: os dois pontos são medidos
na cena 3D e projetados na tela pela câmera. A linha de cota acompanha o
movimento de câmera porque está ancorada na geometria, não colada por cima.

## Como rodar

```sh
cd docs/cursos/nr35/render3d
npm i three@0.128.0
cp node_modules/three/build/three.min.js .
node render.mjs          # gera nr35-modulo01-piloto.webm
```

Requisitos: Node 20+, Playwright com Chromium, e um ffmpeg com `libvpx`.
O `render.mjs` aponta para o ffmpeg que acompanha o Playwright — ajuste a
constante `FFMPEG` se o seu estiver em outro lugar.

Saída: **1280×720, 24 fps, VP8/WebM, sem áudio.**

## Limites honestos deste piloto

- **Estilo:** volumetria técnica, não fotorrealismo. Os personagens são
  blocados. Funciona para ensinar geometria, distância, proteção coletiva e
  ponto de ancoragem — não substitui atuação humana em close.
- **Sem áudio:** o ambiente de render não tem motor de voz. Por isso as falas
  entram como **legenda queimada**, com o nome de quem fala — o vídeo ensina
  mesmo mudo. A locução final entra na edição, a partir de
  `../modulo-01-locucao.md`.
- **14 minutos, não 36:** o roteiro somava 36 minutos de cena para menos de
  7 minutos de fala. O módulo foi montado no tempo que o conteúdo sustenta,
  sem cortar nenhuma fala, gráfico ou exemplo. Para esticar de volta, basta
  aumentar `dur` de cada cena em `SC`.

## Como estender

- `SC` — as 11 cenas: duração, planos (`sh`), falas (`nar`) e gráficos (`ov`)
- `C` — biblioteca de posições de câmera reaproveitáveis
- `SHOTS` (piloto) — lista de planos, com posição inicial/final da câmera e ponto de
  interesse. Acrescente uma entrada para cada plano novo.
- `worker(vest, helmet, harness)` — devolve um trabalhador; `harness: true`
  acrescenta cinturão, talabarte e D-ring.
- `plataforma(cx, cz, w, d, top)` — plataforma com guarda-corpo, travessão
  intermediário e rodapé laranja, na altura `top`.
- `window.seek(t)` — posiciona tudo no instante `t` e desenha o frame. É a
  única função que o renderizador chama; toda a animação é função do tempo,
  sem estado acumulado.

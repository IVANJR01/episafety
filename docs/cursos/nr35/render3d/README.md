# Render 3D — Módulo 01 (piloto)

Cena 3D real, construída em código com Three.js e renderizada frame a frame
para um arquivo de vídeo. **Não é geração por IA** — é geometria, materiais,
luz e câmera definidos aqui dentro, o que torna o resultado 100 % repetível:
rodar de novo produz exatamente o mesmo vídeo.

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
- **Sem áudio:** o ambiente de render não tem motor de voz. A locução entra na
  edição, a partir de `../modulo-01-locucao.md`.
- **Sem os 36 minutos:** este é o piloto de 82 s. As demais cenas se montam
  reaproveitando os mesmos objetos (`plataforma()`, `worker()`, `SHOTS`).

## Como estender

- `SHOTS` — lista de planos, com posição inicial/final da câmera e ponto de
  interesse. Acrescente uma entrada para cada plano novo.
- `worker(vest, helmet, harness)` — devolve um trabalhador; `harness: true`
  acrescenta cinturão, talabarte e D-ring.
- `plataforma(cx, cz, w, d, top)` — plataforma com guarda-corpo, travessão
  intermediário e rodapé laranja, na altura `top`.
- `window.seek(t)` — posiciona tudo no instante `t` e desenha o frame. É a
  única função que o renderizador chama; toda a animação é função do tempo,
  sem estado acumulado.

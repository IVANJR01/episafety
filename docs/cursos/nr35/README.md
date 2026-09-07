# Curso NR-35 — Trabalho em Altura

Pacote de produção dos módulos em vídeo do curso de NR-35, para publicação no
Portal de Treinamentos do EPISafety (`/video-treinamentos` e
`/portal-treinamentos`).

## Módulo 01 — Introdução ao Trabalho em Altura

| Arquivo | O que é |
|---------|---------|
| [`modulo-01-roteiro.md`](modulo-01-roteiro.md) | Roteiro audiovisual completo, cena a cena, com objetivo, descrição para a plataforma e mapa de tempo |
| [`modulo-01-prompts-video-ia.md`](modulo-01-prompts-video-ia.md) | Bíblia de estilo, fichas de personagem, cenários e o prompt de cada plano para geração em ferramentas de vídeo por IA |
| [`modulo-01-locucao.md`](modulo-01-locucao.md) | **Versão de gravação.** Mesmo conteúdo técnico, dito como gente fala — personagens com nome, falas reescritas |
| [`modulo-01-direcao-de-arte.md`](modulo-01-direcao-de-arte.md) | Auditoria do que fazia o material parecer gerado por IA, e como corrigir: sujeira por cenário, desgaste de uniforme, luz, câmera, texto sem emoji |
| [`modulo-01-narracao-tts.md`](modulo-01-narracao-tts.md) | Espelho literal do roteiro, para conferência de conteúdo |
| [`modulo-01-animatic.html`](modulo-01-animatic.html) | Pré-visualização de montagem: roda as 11 cenas no tempo real, com textos, narração e quiz |
| [`modulo-01-quiz.md`](modulo-01-quiz.md) | Questão oficial do roteiro + banco complementar opcional |
| [`modulo-01-seed.sql`](modulo-01-seed.sql) | Cadastro do curso, do módulo e da avaliação no Supabase |

- **Duração do vídeo:** 36 minutos • **Carga horária do módulo:** 40 minutos
- **Entrega:** MP4 H.264, 1920x1080, 30 fps, com legenda `.srt`

## Como produzir o vídeo

0. **Leia a direção de arte.** `modulo-01-direcao-de-arte.md` explica o que
   entrega uma peça como "feita por IA" e como evitar — vale mais do que
   qualquer prompt isolado.
1. **Locução primeiro.** Grave `modulo-01-locucao.md`. É ela que define a
   duração real de cada cena — todo o resto é montado por cima.
2. **Gere os planos.** Em cada prompt de `modulo-01-prompts-video-ia.md`, cole
   antes o **BLOCO FIXO** (estilo + ficha do personagem que aparece no plano).
   Sem isso o personagem muda de rosto e de uniforme entre os clipes.
3. **Escolha as tomadas.** Gere 3 variações por plano e fique com a que
   mantiver a continuidade.
4. **Monte e insira os textos.** Todos os textos, gráficos, checklists,
   marcadores vermelhos e selos entram **na edição** — nunca peça texto à IA de
   vídeo, ela escreve errado.
5. **Áudio.** Trilha corporativa discreta com *ducking* sob a narração; a voz do
   instrutor sempre em primeiro plano.
6. **Exporte, gere o `.srt`** e publique.

## Como publicar na plataforma

1. Suba o MP4 (upload direto no Portal de Treinamentos ou publique no Google
   Drive e copie o link — o player já aceita URL do Drive).
2. Abra `modulo-01-seed.sql`, troque `:video_url` pela URL do vídeo e rode no
   SQL Editor do Supabase. O script é idempotente.
3. Alternativa sem SQL: em **Treinamentos › Vídeos**, crie o curso
   "NR-35 — Trabalho em Altura", adicione o módulo 01 e cadastre a questão da
   Cena 09 pela própria tela de quiz.
4. Atribua o curso aos funcionários e acompanhe a conclusão pelo painel.

## Regras de conteúdo aplicadas

- Nenhum conceito técnico do roteiro foi alterado, resumido ou suprimido. A
  versão de locução mudou o **jeito de falar**, não o conteúdo; as cinco frases
  de reforço acrescentadas estão listadas no fim daquele arquivo, para você
  aprovar ou cortar.
- Nenhuma informação legal foi acrescentada além do que está no roteiro.
- Nenhum equipamento ou procedimento foi inventado.
- Toda situação de risco é marcada visualmente como **exemplo educativo
  incorreto** (moldura vermelha + selo), e nenhuma queda ou ferimento é
  mostrado — a ação é sempre interrompida antes da consequência.
- Toda conduta correta mostra o trabalhador com as medidas de proteção
  adequadas, marcada com selo verde.
- Estilo de animação 3D corporativa realista; sem estética infantil, cartoon ou
  exagero de personagem.
- Ambiente em uso, não de showroom: ferrugem, poeira, tinta desbotada, uniforme
  com marca de trabalho. É isso que separa "treinamento de verdade" de "imagem
  gerada".
- Sem emoji nos textos de tela — a marcação é tipográfica.

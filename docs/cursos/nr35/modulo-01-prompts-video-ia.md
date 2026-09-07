# Módulo 01 — Prompts de geração de vídeo (IA)

Pacote de produção para gerar o vídeo em ferramentas de vídeo por IA
(Sora, Veo, Kling, Runway, Hailuo, Pika ou equivalente).

> **Leia antes:** [`modulo-01-direcao-de-arte.md`](modulo-01-direcao-de-arte.md)
> — auditoria do que fazia este material parecer gerado por IA, e as correções
> que já estão aplicadas abaixo.

> **Regra de ouro da continuidade:** todo prompt de plano deve começar com o
> **BLOCO FIXO** (Bíblia de Estilo + a ficha do personagem que aparece no
> plano). Nunca gere um plano só com a descrição da ação — o personagem muda
> de rosto e de uniforme entre os clipes.

---

## 1. BLOCO FIXO — Bíblia de Estilo

Cole este texto **no início de todos os prompts**:

```
ESTILO: animação 3D de treinamento corporativo, realismo documental
brasileiro. Renderização PBR com materiais gastos: aço com oxidação pontual,
concreto manchado, tinta industrial desbotada e riscada. Nada é novo, nada é
impecável — o ambiente está em uso e em manutenção.

Iluminação motivada pela fonte real da cena (porta do galpão, luminária de
galpão, sol direto na cobertura), não uniforme entre os planos.

Imperfeição humana: postura assimétrica, peso apoiado numa perna, alguém
olhando para fora do quadro, mão ajustando o capacete.

Paleta: cinza-concreto, aço oxidado, azul industrial desbotado, laranja de
segurança #F26522. 1920x1080, 30 fps.

NÃO: estética infantil, cartoon, anime, proporções exageradas, olhos grandes.
NÃO: piso impecável, parede recém-pintada, uniforme recém-comprado,
equipamento zero-quilômetro, ambiente de showroom.
NÃO: pele plástica, sorriso de banco de imagens, pose simétrica, todo mundo
enquadrado no centro.
NÃO: hora dourada em todos os planos, lens flare, névoa cinematográfica
decorativa, câmera sempre em movimento suave.
NÃO: texto gerado dentro da imagem, logotipo, marca, crachá legível.
NÃO: equipamento fantasioso, procedimento inventado.
```

> ⚠️ **Todo texto de tela é inserido na edição (After Effects, DaVinci,
> CapCut), nunca gerado pela IA.** Modelos de vídeo escrevem palavras erradas.
> Nos prompts, sempre peça **espaço negativo** (área limpa) onde o texto vai
> entrar.

---

## 2. BLOCO FIXO — Fichas de personagem

### 👤 MARCELO TAVARES — instrutor · código `MARCELO`

```
MARCELO: homem brasileiro, 35 anos, pele parda clara, cabelo preto curto,
barba feita, rosto oval, 1,78 m. Camisa polo azul-marinho de manga longa, com
o refletivo do braço direito já opaco de lavagem. Calça de brim cinza-grafite
com o joelho levemente desbotado. Botina preta com o bico marcado de uso.
Capacete branco com um adesivo pequeno na lateral esquerda, jugular ajustada.
Óculos de proteção incolor com um risco fino na lente. Crachá no bolso do
peito, virado. Postura de instrutor: peso numa perna, gesto contido, olhar
direto. Sério, nunca autoritário.
```

### 👷 ROGÉRIO — mecânico de manutenção · código `ROGÉRIO`

```
ROGÉRIO: homem brasileiro, 30 anos, pele morena, cabelo preto curto, barba
curta, rosto quadrado, 1,75 m. Camisa de brim laranja de manga longa, com a
manga direita dobrada até o cotovelo e mancha de graxa perto do bolso. Calça
de brim azul-marinho com desgaste no bolso da ferramenta. Botina marrom
empoeirada. Capacete amarelo com risco de uso na aba, jugular. Óculos de
proteção incolor. Luva de vaqueta com o polegar puído. Pano vermelho no bolso
traseiro.
Nas cenas de conduta correta usa também cinturão de segurança tipo
paraquedista, com a fita já assentada pelo uso, e talabarte duplo em Y com
absorvedor de energia, conectado a ponto de ancoragem.
```

### 👩‍💼 CLÁUDIA — supervisora de segurança · código `CLÁUDIA`

```
CLÁUDIA: mulher brasileira, 35 anos, pele parda, cabelo castanho escuro preso
em rabo de cavalo baixo, rosto oval, 1,68 m. Camisa polo branca de manga longa
levemente amarelada de lavagem. Colete laranja com o refletivo do ombro
descolando numa ponta. Calça de brim cinza. Botina preta. Capacete branco com
etiqueta de inspeção, jugular. Óculos de proteção incolor. Prancheta de
acrílico com formulário preso e caneta na espiral. Postura de liderança: de
frente para a equipe, peso distribuído, gesto de apontar a estrutura.
```

---

## 3. BLOCO FIXO — Cenários

| Código | Descrição |
|--------|-----------|
| `AMB-IND` | Pátio industrial em operação: galpões metálicos, tubulações, plataformas com guarda-corpo, escorrimento de ferrugem sob os parafusos, marca de pneu de empilhadeira no piso, paletes empilhados torto, fita zebrada isolando uma área |
| `OBRA` | Obra industrial: estrutura de concreto e aço em execução, andaimes, tapume de compensado com emenda, poeira de concreto no piso, cone laranja arranhado, placas de sinalização em português |
| `ESTR-MET` | Estrutura metálica aparente, vigas e treliças de aço pintadas de cinza, linha de vida horizontal instalada |
| `PLATAF` | Plataforma de trabalho elevada com guarda-corpo, rodapé e escada de acesso com corrimão |
| `ESCADA` | Escada fixa vertical em estrutura metálica, com gaiola de proteção e ponto de ancoragem |
| `COBERT` | Cobertura industrial metálica inclinada, telhas trapezoidais, linha de vida na cumeeira |
| `MANUT` | Área de manutenção industrial, painéis, motores, bancada de ferramentas, iluminação de galpão |
| `SALA` | Sala de treinamento comum de empresa brasileira: split na parede, cadeira de plástico empilhável, mesa de fórmica, quadro branco com marca de canetão que não saiu, projetor no teto, garrafa térmica no fundo |

---

## 4. Marcação obrigatória de situação incorreta

Sempre que o plano mostrar **conduta incorreta**, o prompt deve incluir:

```
A cena é uma demonstração educativa de uma situação INCORRETA: enquadre o
trabalhador de forma que a falta de proteção fique evidente, com iluminação
levemente fria e dessaturada, atmosfera de tensão contida. Nenhuma queda,
nenhum acidente, nenhum ferimento é mostrado. A ação é interrompida antes de
qualquer consequência.
```

E na **edição** aplicar:
- moldura vermelha 8 px em volta do quadro;
- selo no canto superior direito: `SITUAÇÃO INCORRETA · EXEMPLO EDUCATIVO`;
- leve dessaturação (-15 %).

Na **conduta correta**, aplicar moldura verde e selo `CONDUTA CORRETA`. Sem emoji em nenhum dos dois.

---

## 5. Lista de planos por cena

Formato de uso: `BLOCO FIXO + ficha do personagem + prompt do plano`.
Os modelos atuais geram de 5 a 10 s por clipe — cada plano abaixo é um clipe.
A duração total da cena é fechada na edição, com o áudio da narração como
base e planos de apoio (B-roll) repetidos quando necessário.

---

### CENA 01 — ABERTURA (1 min)

| Plano | Prompt |
|------:|--------|
| 1.1 | `AMB-IND`. Plano geral aéreo lento descendo sobre o pátio industrial: galpões metálicos, plataformas elevadas com guarda-corpo, trabalhadores ao longe executando atividades com equipamentos de proteção. Luz natural de manhã, leve neblina atmosférica. Metade superior do quadro limpa para entrada de texto. |
| 1.2 | `MARCELO` em pé no pátio industrial `AMB-IND`, plano médio, olhando diretamente para a câmera, fala com naturalidade e gesticula com a mão direita aberta. Ao fundo, desfocadas, estruturas metálicas e plataformas. Câmera estática. |
| 1.3 | Mesmo enquadramento do plano 1.2 com **aproximação lenta da câmera (dolly in)** do plano médio ao primeiro plano do `MARCELO`, que mantém o olhar na câmera. |

**Texto na tela (edição):**
- 00:03 — `NR-35 — TRABALHO EM ALTURA` (título, entrada por fade + leve escala)
- 00:06 — `Prevenção • Planejamento • Proteção` (subtítulo)

---

### CENA 02 — POR QUE FALAR SOBRE TRABALHO EM ALTURA? (2 min)

| Plano | Prompt |
|------:|--------|
| 2.1 | `OBRA`. `ROGÉRIO` caminha em passo firme por um corredor de obra industrial, passando ao lado de uma estrutura elevada. Câmera acompanha lateralmente em travelling. |
| 2.2 | `ESTR-MET`. Plano aberto de um trabalhador de uniforme executando atividade sobre estrutura metálica, com cinturão paraquedista conectado à linha de vida. Câmera em contra-plongée suave. |
| 2.3 | `MANUT`. Plano médio de trabalhador realizando manutenção em painel industrial elevado sobre plataforma com guarda-corpo. |
| 2.4 | `ESCADA`. Plano de conjunto de trabalhador subindo escada fixa vertical com gaiola de proteção, três pontos de apoio, movimento lento e controlado. |
| 2.5 | `PLATAF`. Plano médio de trabalhador em plataforma elevada com guarda-corpo e rodapé, manuseando ferramenta. |
| 2.6 | `COBERT`. Plano aberto de trabalhador sobre cobertura industrial metálica inclinada, conectado a linha de vida na cumeeira. Céu aberto ao fundo. |
| 2.7 | `ESTR-MET`. Plano detalhe (close) do mosquetão do talabarte conectado ao ponto de ancoragem em viga de aço. Foco raso. |
| 2.8 | `AMB-IND`. Plano aberto do pátio, câmera estática, quadro com grande área central limpa e escura para entrada de placa de texto. |

**Texto na tela (edição):**
- Ao final da segunda narração — tarja vermelha cheia com `ATENÇÃO` em condensada, e abaixo `QUEDA = RISCO GRAVE`, com **QUEDA** em laranja de segurança. Sem emoji.

---

### CENA 03 — CONCEITO DE TRABALHO EM ALTURA (4 min)

| Plano | Prompt |
|------:|--------|
| 3.1 | `SALA`. `MARCELO` em plano médio, de pé, ligeiramente virado 3/4, ao lado de um quadro branco vazio com marca de canetão antigo. Ele fala para a câmera e indica o quadro com a mão aberta. **Quadro deixado vazio para inserção do gráfico na edição.** |
| 3.2 | `AMB-IND`. Plano lateral de trabalhador sobre plataforma metálica a aproximadamente dois metros do piso inferior, com o piso de concreto visível abaixo. Câmera perpendicular, mostrando claramente a diferença de nível. Lateral direita do quadro limpa para o gráfico de cota. |
| 3.3 | **Situação A (incorreta).** `ESTR-MET`. `ROGÉRIO` sobre viga metálica elevada, próximo à borda desprotegida, **sem cinturão conectado**, executando pequeno ajuste. Aplicar a marcação obrigatória de situação incorreta (seção 4). |
| 3.4 | **Situação B.** `PLATAF`. `ROGÉRIO` em plataforma elevada totalmente fechada por guarda-corpo com travessão intermediário e rodapé, executando a mesma atividade com postura tranquila, sem exposição à borda. Iluminação neutra e clara. |
| 3.5 | `SALA`. `MARCELO` em primeiro plano, expressão séria, concluindo a explicação com um leve gesto afirmativo. |

**Animação a montar na edição (sobre o painel de LED do plano 3.1):**
```
        TRABALHO EM ALTURA
                ⬆
            2 METROS      (cota com setas verticais)
                ⬆
          NÍVEL INFERIOR
```
Entrada de baixo para cima, uma linha por vez, sincronizada com a narração.
Ao final, destaque piscante em `RISCO DE QUEDA` ao lado da cota.

---

### CENA 04 — EXEMPLOS DE ATIVIDADES (4 min)

Cinco exemplos, cada um com um plano aberto e um de apoio. Todos com o
`ROGÉRIO` devidamente protegido (conduta correta).

| Plano | Prompt |
|------:|--------|
| 4.1 | **Exemplo 1.** `ESTR-MET`. `ROGÉRIO` realizando manutenção em estrutura elevada, cinturão paraquedista conectado à linha de vida, ferramenta amarrada por cabo de retenção ao cinturão. Plano aberto, câmera lenta em órbita. |
| 4.2 | **Exemplo 2.** `COBERT`. `ROGÉRIO` realizando manutenção sobre cobertura metálica, caminhando sobre passarela apoiada, conectado à linha de vida. Plano de conjunto. |
| 4.3 | **Exemplo 3.** `ESCADA`. `ROGÉRIO` acessando estrutura por escada fixa com gaiola, mantendo três pontos de apoio. Plano médio de baixo para cima. |
| 4.4 | **Exemplo 4.** `PLATAF`. `ROGÉRIO` executando atividade em plataforma de trabalho com guarda-corpo e rodapé. Plano médio lateral. |
| 4.5 | **Exemplo 5.** `ESTR-MET`. `ROGÉRIO` realizando manutenção em estrutura metálica, apertando conexão com chave, conectado por talabarte duplo em Y (sempre um conector engatado). Plano detalhe das mãos e, em seguida, plano médio. |
| 4.6 | `AMB-IND`. Plano aberto e estático do pátio com grande área limpa no centro, para a cartela final da cena. |

**Texto na tela (edição):**
- Sobre cada exemplo, tarja inferior discreta: `EXEMPLO 1 — MANUTENÇÃO EM ESTRUTURA ELEVADA` (e assim por diante)
- Cartela final sobre o plano 4.6:
```
A atividade muda.
O princípio de prevenção permanece.
```
(`PREVENÇÃO` em destaque laranja)

---

### CENA 05 — IDENTIFICANDO O PERIGO (4 min)

| Plano | Prompt |
|------:|--------|
| 5.1 | `MANUT`. `ROGÉRIO` chega a pé com uma caixa de ferramentas e para diante de um piso elevado, olhando para cima, avaliando o local. Plano médio de trás, sobre o ombro. |
| 5.2 | **Ponto de vista do trabalhador.** Plano subjetivo olhando para o piso elevado: borda sem guarda-corpo, escada de mão apoiada de forma inadequada, ferramentas soltas próximas à borda. Sem pessoas no quadro. |
| 5.3 | Plano detalhe: ferramentas metálicas apoiadas a poucos centímetros da borda de um piso elevado, com o vazio abaixo desfocado. Foco raso, tensão contida. |
| 5.4 | `MANUT`. Primeiro plano do `ROGÉRIO` falando, expressão de quem subestima a tarefa, dando um passo à frente em direção à escada. Aplicar a marcação obrigatória de situação incorreta (seção 4). |
| 5.5 | `MANUT`. `MARCELO` entra em quadro pela lateral esquerda, em plano médio, com a mão direita erguida em gesto claro de **pare**, olhando para o trabalhador. |
| 5.6 | Plano aberto e estático do conjunto (trabalhador parado diante do piso elevado, ferramentas na borda, escada apoiada), **câmera imóvel e personagens em pose estática**, pronto para o congelamento na edição. |

**Efeito na edição (sobre o plano 5.6):**
1. Congelar o quadro e dessaturar 40 %.
2. Entrar quatro marcadores circulares vermelhos pulsantes, um a um, com linha
   de chamada e legenda:
   - `RISCO DE QUEDA` → borda desprotegida
   - `QUEDA DE OBJETOS` → ferramentas na borda
   - `ACESSO INADEQUADO` → escada apoiada
   - `CONDIÇÕES DO AMBIENTE` → piso e entorno

---

### CENA 06 — O ERRO DE "É SÓ UM SERVIÇO RÁPIDO" (3 min)

| Plano | Prompt |
|------:|--------|
| 6.1 | `MANUT`. Primeiro plano do `ROGÉRIO` falando para o instrutor, gesto de "é rápido" com a mão, expressão despreocupada. |
| 6.2 | `MANUT`. Primeiro plano do `MARCELO` respondendo com serenidade e firmeza, um leve gesto negativo com a cabeça. |
| 6.3 | `MANUT`. Plano médio: trabalhador sobe dois degraus de uma escada de mão mal apoiada e a base **desliza levemente** no piso; ele se apoia na estrutura e a ação é interrompida. **Nenhuma queda, nenhum ferimento.** Aplicar a marcação obrigatória de situação incorreta (seção 4). |
| 6.4 | Plano detalhe da base da escada de mão sobre piso liso, sem sapata antiderrapante e sem amarração, com leve deslocamento. |
| 6.5 | `AMB-IND`. Plano de fundo neutro e escuro, levemente desfocado, estático — base para as cartelas de texto. |

**Texto na tela (edição, sobre o plano 6.5):**
```
"É rapidinho."
"Sempre fiz assim."
"Nunca aconteceu nada."
```
Cada frase com barra vermelha vertical de 4 px à esquerda. Entram uma a uma e
saem juntas. Em seguida, tela verde-escura, com barra verde à esquerda:
```
Toda atividade deve ser avaliada antes de sua execução.
```

---

### CENA 07 — PLANEJAMENTO (4 min)

| Plano | Prompt |
|------:|--------|
| 7.1 | `OBRA`. Plano aberto de uma equipe de cinco trabalhadores uniformizados reunida em semicírculo diante da `CLÁUDIA`, antes do início do trabalho, ao lado de uma mesa com pranchas e documentos. Luz natural de manhã. |
| 7.2 | Plano médio da `CLÁUDIA` falando para a equipe, prancheta com checklist na mão, gesto de apontar para a estrutura ao fundo. |
| 7.3 | Plano de reação: rostos atentos de três trabalhadores ouvindo, assentindo discretamente. |
| 7.4 | Plano detalhe da prancheta com um formulário impresso genérico sendo preenchido a caneta (sem texto legível), mão com luva. |
| 7.5 | `OBRA`. Plano aberto e estático da estrutura de trabalho ao fundo, com o lado direito do quadro limpo, para entrada do checklist. |
| 7.6 | `OBRA`. A equipe se dispersa de forma organizada e caminha em direção à área de trabalho, cada um com seu equipamento. Travelling de acompanhamento. |

**Checklist a montar na edição (sobre o plano 7.5, um item por vez):**
```
Local de trabalho
Acesso
Risco de queda
Equipamentos
Condições ambientais
Medidas de proteção
Emergência e resgate
```
Cada item entra com um tique `✓` verde à esquerda, fora do texto, sincronizado
à narração.

---

### CENA 08 — HIERARQUIA DA PREVENÇÃO (4 min)

| Plano | Prompt |
|------:|--------|
| 8.1 | `SALA`. `MARCELO` em plano médio ao lado do quadro branco vazio, apresentando com a mão aberta em direção a ele. **Quadro vazio para o gráfico.** |
| 8.2 | **Nível 1 — Evitar a exposição.** `MANUT`. Trabalhador executando a atividade a partir do piso, com equipamento operado do nível do solo, sem subir na estrutura. Postura tranquila, luz clara. |
| 8.3 | **Nível 2 — Prevenir a queda.** `PLATAF`. Plano médio de plataforma elevada totalmente protegida por guarda-corpo, travessão intermediário e rodapé, com o trabalhador atrás da proteção. Plano detalhe do rodapé. |
| 8.4 | **Nível 3 — Minimizar as consequências.** `ESTR-MET`. `ROGÉRIO` com cinturão paraquedista e talabarte com absorvedor de energia conectado a ponto de ancoragem em viga. Plano detalhe do absorvedor e do mosquetão, depois plano médio do trabalhador. |
| 8.5 | `SALA`. Primeiro plano do `MARCELO` concluindo, olhar direto na câmera, expressão firme. |

**Animação a montar na edição (sobre o plano 8.1) — pirâmide de três degraus, de cima para baixo:**
```
01 · EVITAR A EXPOSIÇÃO
   Realizar a atividade sem expor o trabalhador ao risco de queda.

02 · PREVENIR A QUEDA
   Medidas que impeçam que a queda aconteça.

03 · MINIMIZAR AS CONSEQUÊNCIAS
   Sistemas adequados para reduzir as consequências da queda.
```

---

### CENA 09 — SITUAÇÃO PRÁTICA (4 min)

| Plano | Prompt |
|------:|--------|
| 9.1 | `ESTR-MET`. `ROGÉRIO` de costas para a câmera, parado diante de uma estrutura elevada, caixa de ferramentas na mão, avaliando o que fazer. Plano aberto, quadro com bastante espaço à direita para o painel do desafio. |
| 9.2 | Plano médio do `ROGÉRIO` de perfil, olhando para cima em direção à estrutura, expressão de dúvida contida. Câmera estática — **este plano é congelado na edição durante os 5 segundos de pausa.** |
| 9.3 | `SALA`. `MARCELO` em plano médio, dando a resposta para a câmera, gesto explicativo calmo. |
| 9.4 | `PLATAF`. `ROGÉRIO` agora executando a atividade corretamente, com plataforma protegida, cinturão conectado e ferramenta com cabo de retenção. Plano médio. Selo `CONDUTA CORRETA` na edição. |

**Painel do desafio (edição, sobre os planos 9.1 e 9.2):**
```
DESAFIO
O trabalhador deve iniciar a atividade?

A) Sim, porque o serviço é rápido.
B) Sim, desde que tenha capacete.
C) Não. Primeiro deve avaliar a atividade e as medidas
   de prevenção necessárias.
D) Sim, se estiver acompanhado.
```
Contagem regressiva visível de **5 segundos**; em seguida, a alternativa **C**
se destaca em verde e as demais esmaecem.

---

### CENA 10 — RESPONSABILIDADE DE TODOS (3 min)

| Plano | Prompt |
|------:|--------|
| 10.1 | `SALA`. `MARCELO` em plano médio explicando para a câmera, ao lado do quadro branco vazio. |
| 10.2 | `AMB-IND`. Plano aberto e estático de um pátio industrial organizado, com sinalização de segurança, sem pessoas em primeiro plano — base limpa para o organograma. |
| 10.3 | `OBRA`. `CLÁUDIA` conferindo o checklist com um trabalhador ao lado de uma estrutura elevada, ambos de EPI completo. Plano médio. |
| 10.4 | `ESTR-MET`. Plano aberto de uma equipe de quatro pessoas trabalhando de forma coordenada: um executando em altura devidamente conectado, um na base observando e comunicando, a supervisora acompanhando. Câmera em travelling lento. |
| 10.5 | Plano de detalhe: duas mãos com luva conferindo o mosquetão do talabarte antes do início da atividade (dupla checagem). |

**Organograma a montar na edição (sobre o plano 10.2):**
```
EMPREGADOR
     ⬇
 SUPERVISÃO
     ⬇
TRABALHADOR
```
Cada bloco entra de cima para baixo, ligado por seta animada.

---

### CENA 11 — RESUMO DO MÓDULO (3 min)

| Plano | Prompt |
|------:|--------|
| 11.1 | `SALA`. `MARCELO` em plano médio, postura aberta, iniciando a revisão para a câmera. |
| 11.2 | `SALA`. Mesmo enquadramento, `MARCELO` deslocado para a esquerda do quadro, **metade direita limpa** para a entrada dos cinco tópicos do resumo. |
| 11.3 | Reprise curta (2 s cada) dos planos 3.2, 5.6, 7.1, 8.3 e 10.4, em corte seco, como colagem de encerramento. |
| 11.4 | `AMB-IND`. Plano aberto final, câmera subindo lentamente sobre o pátio industrial, luz de fim de tarde, quadro limpo para a cartela de encerramento. |

**Resumo a montar na edição (sobre o plano 11.2, um item por vez):**
```
01 · TRABALHO EM ALTURA
  Atividade acima de 2 metros do nível inferior, quando houver risco de queda.

02 · RISCO
  Deve ser identificado antes da execução.

03 · PLANEJAMENTO
  A atividade deve ser organizada previamente.

04 · PREVENÇÃO
  Devem ser adotadas medidas adequadas para controlar os riscos.

05 · SEGURANÇA
  Todos os envolvidos possuem responsabilidades dentro de suas atribuições.
```

**Cartela final (plano 11.4):**
```
MÓDULO 01 CONCLUÍDO
NR-35 — TRABALHO EM ALTURA
```

---

## 6. Padrão de texto na tela

| Elemento | Fonte | Tamanho (1080p) | Cor |
|----------|-------|----------------:|-----|
| Título de cena | Sans-serif bold (Inter / Montserrat) | 96 px | Branco |
| Subtítulo | Sans-serif medium | 48 px | Cinza claro |
| Palavra-chave em destaque | Sans-serif black | 110 px | Laranja `#F26522` |
| Item de lista | Sans-serif medium | 54 px | Branco |
| Tarja de alerta | Sans-serif bold | 64 px | Branco sobre vermelho `#C62828` |
| Tarja de conduta correta | Sans-serif bold | 64 px | Branco sobre verde `#2E7D32` |

Palavras que **sempre** entram em destaque: `RISCO`, `QUEDA`, `PREVENÇÃO`,
`PLANEJAMENTO`, `PROTEÇÃO`, `SEGURANÇA`.

Legendas ocultas (closed captions) em todo o vídeo, arquivo `.srt` separado —
requisito de acessibilidade e de evidência de treinamento.

---

## 7. Áudio

- **Narração:** voz masculina brasileira, 35–45 anos, timbre grave-médio,
  dicção clara, ritmo pausado e didático, sem entonação publicitária. Padrão de
  instrutor de segurança do trabalho. Nível: −3 dBFS de pico, −16 LUFS.
- **Vozes de cena:** o `ROGÉRIO` tem voz masculina mais jovem e informal; a
  `CLÁUDIA`, voz feminina firme e objetiva. As falas de cena são
  distinguíveis da narração.
- **Trilha:** instrumental corporativa discreta, andamento lento, sem
  percussão marcada. Nível −28 LUFS, com *ducking* automático de −6 dB sob a
  narração. A voz do instrutor fica **sempre em primeiro plano**.
- **Efeitos:** ambiente industrial suave e contínuo (−32 LUFS); um sinal
  discreto de alerta na entrada dos marcadores vermelhos da Cena 05; um "tique"
  curto a cada item do checklist da Cena 07.

---

## 8. Ordem de produção sugerida

1. Gravar a **narração** (arquivo `modulo-01-narracao-tts.md`) — é ela que
   define a duração real de cada cena.
2. Gerar os **planos** cena a cena, sempre com o BLOCO FIXO.
3. Selecionar as melhores tomadas (gerar 3 variações por plano e escolher a que
   mantiver a continuidade do personagem).
4. Montar na linha do tempo sobre a narração.
5. Inserir **todos os textos, gráficos, marcadores e selos** na edição.
6. Aplicar a trilha, o *ducking* e os efeitos.
7. Gerar as legendas `.srt`.
8. Exportar MP4 H.264 1920x1080, 30 fps, ~10 Mbps.
9. Publicar na plataforma (ver `modulo-01-seed.sql`).

# Direção de arte — como não parecer feito por IA

Auditoria do próprio pacote de prompts deste módulo, com as correções aplicadas.
Vale para todos os módulos do curso.

---

## 1. O que estava entregando "IA" no material anterior

### 1.1 Ambiente limpo demais

O texto pedia *"piso de concreto limpo"*, *"galpões metálicos"*, *"pátio
industrial moderno"*. Planta industrial brasileira em operação **não é assim**.
Ambiente impecável é o traço número um de imagem gerada — o olho reconhece na
hora, mesmo sem saber explicar.

### 1.2 Uniforme de vitrine

Todo mundo com uniforme novo, camisa dentro da calça, capacete alinhado. Numa
equipe real, cada um usa o mesmo uniforme de um jeito. Isso não é desleixo de
direção — é o que faz parecer gente.

### 1.3 A mesma luz em todo plano

*"Iluminação natural volumétrica"* em 100 % dos planos, sempre no fim da manhã.
Vídeo real tem plano contra a luz da porta do galpão, tem meio-dia duro na
cobertura, tem lâmpada amarelada de galpão. Luz uniforme = renderização.

### 1.4 Câmera sempre suave

Todos os planos com travelling lento, órbita perfeita, dolly macio. Ninguém
filma tudo assim. Falta o plano no ombro, o tripé parado, o reenquadre.

### 1.5 Nada é brasileiro

Os cenários descritos poderiam ser de qualquer país. Falta placa em português,
fita zebrada, cone, extintor com plaqueta, telha de fibrocimento, poste de
concreto, mato no fundo do pátio.

### 1.6 A "sala de treinamento com painel de LED"

Cliché de banco de imagens. Treinamento de SST no Brasil acontece no refeitório,
na sala com split e cadeira de plástico, com projetor e quadro branco.

### 1.7 Emoji como elemento gráfico

`⚠️ ✅ ❌ ☑ ✔` num vídeo de treinamento corporativo puxam a peça para baixo e
denunciam origem automática. Substituídos por marcação tipográfica.

---

## 2. BLOCO FIXO revisado — estilo

Substitui o bloco anterior. Cole no início de **todos** os prompts.

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

---

## 3. Sujeira específica por cenário

Genérico ("um pouco de sujeira") não funciona — o modelo ignora. Peça o defeito
com nome e lugar.

| Cenário | O que pedir explicitamente |
|---------|---------------------------|
| `AMB-IND` | Escorrimento de ferrugem abaixo dos parafusos da estrutura; marca de pneu de empilhadeira no piso; paletes empilhados torto num canto; fita zebrada preta e amarela numa área isolada; extintor na parede com plaqueta |
| `OBRA` | Poeira de concreto no piso; respingo de argamassa na base do pilar; tapume de compensado com emenda; cone laranja arranhado; garrafa de água em cima de um caixote |
| `ESTR-MET` | Solda aparente com respingo; parafuso com rebarba de tinta; oxidação nas emendas; poeira acumulada na aba da viga |
| `PLATAF` | Chapa xadrez com o desenho gasto no meio, onde todo mundo pisa; tinta do rodapé descascada nos cantos; corrimão polido pelo uso |
| `ESCADA` | Degrau com a tinta antiderrapante gasta; gaiola com um trecho de pintura mais nova, remendado; parafuso trocado por outro de cor diferente |
| `COBERT` | Telha com marca de goteira; parafuso com a arruela ressecada; folha seca acumulada na calha; brilho irregular do sol na telha |
| `MANUT` | Bancada com marca de ferramenta; caixa de ferramenta com adesivo desbotado; pano no bolso; ventilador de coluna num canto |
| `SALA` | Trocar por: **sala de treinamento comum de empresa brasileira** — split na parede, cadeira de plástico empilhável, mesa de fórmica, quadro branco com marca de canetão que não saiu, projetor no teto, garrafa térmica de café no fundo |

---

## 4. Continuidade dos personagens — fichas revisadas

Mantida a aparência anterior, acrescentado o **uso** de cada uniforme. É o
desgaste que dá continuidade crível entre um clipe e outro.

### MARCELO TAVARES — instrutor
```
Homem brasileiro, 35 anos, pele parda clara, cabelo preto curto, barba feita,
1,78 m. Camisa polo azul-marinho de manga longa, com o refletivo do braço
direito já opaco de lavagem. Calça de brim cinza-grafite com o joelho
levemente desbotado. Botina preta com o bico marcado de uso. Capacete branco
com um adesivo pequeno na lateral esquerda e a jugular ajustada. Óculos de
proteção incolor com risco fino na lente. Crachá no bolso do peito, virado.
Postura de instrutor: peso numa perna, gesto contido, olhar direto.
```

### ROGÉRIO — mecânico de manutenção
```
Homem brasileiro, 30 anos, pele morena, cabelo preto curto, barba curta,
1,75 m. Camisa de brim laranja com a manga direita dobrada até o cotovelo e
mancha de graxa perto do bolso. Calça de brim azul-marinho com desgaste no
bolso da ferramenta. Botina marrom empoeirada. Capacete amarelo com risco de
uso na aba. Luva de vaqueta com o polegar puído. Pano vermelho no bolso
traseiro.
Nos planos de conduta correta: cinturão paraquedista com fita já assentada
pelo uso e talabarte duplo em Y com absorvedor, conectado à ancoragem.
```

### CLÁUDIA — supervisora de segurança
```
Mulher brasileira, 35 anos, pele parda, cabelo castanho escuro preso em rabo
de cavalo baixo, 1,68 m. Camisa polo branca de manga longa levemente
amarelada de lavagem. Colete laranja com o refletivo do ombro descolando numa
ponta. Calça de brim cinza. Botina preta. Capacete branco com etiqueta de
inspeção. Prancheta de acrílico com formulário preso, caneta na espiral.
Postura de liderança: de frente para a equipe, peso distribuído, gesto de
apontar a estrutura.
```

---

## 5. Câmera — variar de propósito

Distribuição-alvo para os 57 planos do módulo:

| Tratamento | Onde usar | Fatia |
|-----------|-----------|------:|
| Tripé, quadro fixo | Falas de Marcelo, cartelas, gráficos | ~40 % |
| Ombro, oscilação sutil | B-roll de atividade, equipe, canteiro | ~35 % |
| Travelling / grua | Abertura, encerramento, apresentação de ambiente | ~15 % |
| Detalhe em foco raso | Mosquetão, ferramenta na borda, base da escada | ~10 % |

Nunca dois planos seguidos com o mesmo movimento. Se a cena anterior terminou
em travelling, a próxima começa parada.

---

## 6. Texto na tela — sem emoji

| Antes | Agora |
|-------|-------|
| `⚠️ QUEDA = RISCO GRAVE` | Tarja vermelha cheia, palavra **ATENÇÃO** em caixa alta condensada, e abaixo `QUEDA = RISCO GRAVE` |
| `❌ "É rapidinho."` | Barra vermelha vertical de 4 px à esquerda da frase |
| `✅ Toda atividade deve ser avaliada...` | Barra verde vertical de 4 px à esquerda |
| `☑ Local de trabalho` | Tique tipográfico `✓` na cor verde, fora do texto, alinhado |
| `✔ TRABALHO EM ALTURA` | Numeração `01`–`05` em mono, na cor de destaque |
| Selo `❌ SITUAÇÃO INCORRETA` | Selo vermelho com o texto `SITUAÇÃO INCORRETA · EXEMPLO EDUCATIVO`, sem símbolo |

---

## 7. Checklist de aprovação de plano

Reprove o clipe e gere de novo se qualquer item for verdadeiro:

- [ ] O piso, a parede ou o uniforme parecem novos
- [ ] A pessoa está perfeitamente simétrica ou centralizada sem motivo
- [ ] A pele tem brilho de plástico ou a expressão é vazia
- [ ] A luz é a mesma do plano anterior sem justificativa
- [ ] O rosto ou o uniforme mudou em relação ao clipe anterior
- [ ] Apareceu texto, logotipo ou crachá legível gerado pelo modelo
- [ ] O EPI está errado, incompleto ou é um equipamento que não existe
- [ ] A cena de conduta incorreta ficou atraente em vez de desconfortável
- [ ] Nada no quadro indica que é o Brasil

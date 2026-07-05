# Refatorar GES/GHE (multi-função + multi-setor) e melhorar importação no PGR

## Objetivo
Permitir que **um mesmo GES** agrupe várias funções/setores com **atividades distintas**, compartilhando riscos comuns, e opcionalmente **risco específico por função**. O PGR passa a importar isso de forma inteligente (sem duplicar o GES).

---

## 1. Banco de dados (migration)

### 1.1 `ghe_ges` — novos campos
- `ambiente` (text) — ex.: "Ambiente de trabalho interno"
- `setores` (text[]) — múltiplos setores. `setor` (singular) fica como legado/compat.
- `descricao_ambiente` (text)

### 1.2 `ghe_funcoes` — enriquecer
Já tem `nome_funcao`, `cbo`, `descricao_atividade`. Adicionar:
- `setor` (text) — setor específico da função (dentro dos setores do GES)
- `processo` (text)
- `quantidade_trabalhadores` (int)
- `observacoes` (text)

### 1.3 `ghe_riscos` — escopo função-específico
- `funcao_id` (uuid, nullable, FK → `ghe_funcoes.id` ON DELETE CASCADE)
  - `NULL` = risco comum do GES (aplica a todas as funções)
  - preenchido = **risco específico daquela função**
- `especifico_funcao` (bool, default false) — flag redundante para clareza de UI

RLS/GRANT já existentes cobrem os novos campos (mesma tabela).

---

## 2. UI — Cadastro GES (`src/pages/cadastro/CadastroGhe.tsx`)

### 2.1 Formulário do GES
Reorganizar em blocos:
- **Identificação**: Código, Nome, Ambiente, Setores (multi-tag input), Descrição do ambiente
- **Dados técnicos** (colapsável, já existe): manter medidas, EPCs, capacitações, obs. técnicas
- Remover obrigatoriedade de `setor` único (aceitar setores[])

### 2.2 Diálogo de Funções (`FuncoesDialog`)
Substituir input simples por **linha expansível** com campos:
- Função, Setor, Descrição da atividade, Processo, Qtd. trabalhadores, Observações

Manter "Adicionar lista" (bulk) só para nome.

### 2.3 Novo diálogo: Riscos do GES
Botão "Riscos" na linha da tabela abre modal listando `ghe_riscos` do GES:
- Grupo (Físico/Químico/Biológico/Ergonômico/Acidente), perigo/fonte, exposição, lesões
- Toggle "Aplica a todas as funções" (default) vs "Específico da função" → seleciona `funcao_id`

---

## 3. Importação no PGR (`src/components/pgr/ImportarGheDialog.tsx`)

Ao importar um GES para o Inventário:
- Para cada **função** do GES, gerar N itens em `pgr_inventario_itens`:
  - Riscos comuns (`funcao_id IS NULL`) × função
  - + Riscos específicos daquela função (`funcao_id = f.id`)
- Deduplicar por (`empresa_id`, `pgr_id`, `ghe_id`, `funcao_id`, `perigo_descricao`)
- Ambiente/setor do GES é referenciado, não duplicado

O PDF do inventário (`pgrPdf.ts`) agrupa por **Ambiente → GES → Função → Riscos**, exibindo riscos comuns uma vez por função e específicos destacados.

---

## 4. Retrocompatibilidade
- GES antigos com `setor` singular continuam funcionando (fallback: `setores = [setor]` quando vazio)
- `ghe_riscos.funcao_id NULL` para todos os riscos existentes → viram "risco comum" automaticamente
- Sem breaking change nas queries existentes

---

## 5. Arquivos afetados
- **Nova migration** — colunas em `ghe_ges`, `ghe_funcoes`, `ghe_riscos`
- **Editar** `src/pages/cadastro/CadastroGhe.tsx` — formulário + diálogo de funções + diálogo de riscos
- **Editar** `src/components/pgr/ImportarGheDialog.tsx` — lógica de expansão função×risco
- **Editar** `src/lib/pgrPdf.ts` — agrupamento Ambiente → GES → Função no inventário

---

## Fora desta fase
- Editor visual da matriz de risco por função (será do Fase 2 do PGR)
- Migração automática de GES antigos duplicados (feito manualmente pelo usuário)
- Vínculo função ↔ funcionário automático baseado em atividade

Aprovando, executo tudo em uma única rodada (migration + código).

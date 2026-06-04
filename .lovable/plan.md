## Objetivo

Refazer a emissão de ASO para que o RH **não precise digitar riscos**. Todos os riscos e exames são cadastrados uma vez na base do PCMSO por GHE/GES. Quando o colaborador é vinculado a um GHE/GES, o ASO é gerado automaticamente com os riscos e exames daquele grupo.

Fluxo final:
```
Empresa → PCMSO → GHE/GES → Funções + Riscos + Exames
                            ↑
                       Colaborador vinculado
                            ↓
                  RH escolhe colaborador + tipo de exame
                            ↓
                     ASO gerado automaticamente (PDF)
```

---

## 1. Banco de dados (migration)

Criar/ajustar tabelas no Lovable Cloud:

- **`pcmso`** — cabeçalho do PCMSO da empresa (título, datas, médico responsável, status).
- **`ghe_ges`** — código, nome, setor, descrição, vinculado a `empresa_id` + `pcmso_id`.
- **`ghe_funcoes`** — funções dentro do GHE (nome, CBO, descrição).
- **`ghe_riscos`** — grupo (físico/químico/biológico/ergonômico/acidente/outro), tipo de agente, perigo/fonte, exposição, lesões, texto resumido para ASO, `aparece_aso`.
- **`ghe_exames`** — código, nome, tipo (clínico/complementar), flags por tipo ocupacional (admissional, periódico, retorno, mudança risco, mudança função, demissional), `aparece_aso`.
- **`funcionarios`** — adicionar coluna `ghe_id` (FK para `ghe_ges`).
- **`asos`** — adicionar `ghe_id`, `pcmso_id`, `riscos_snapshot jsonb`, `exames_snapshot jsonb` para preservar histórico imutável.

Todas com RLS por `empresa_id`, GRANTs para `authenticated` + `service_role`, e função `has_role` para distinguir Admin/TST × RH.

---

## 2. Nova área: "Configuração PCMSO / GHE"

Adicionar aba **"PCMSO / GHE"** no `AsoModule.tsx` (apenas para perfil Admin/TST, não para RH).

### 2.1 Lista de GHE/GES (cards)
Cada card mostra: código, setor, nº de funções, nº de riscos, nº de exames, nº de colaboradores, status (Completo / Pendente / Sem riscos).

### 2.2 Form de GHE/GES
Empresa, PCMSO vinculado, código, nome, setor, descrição, status.

### 2.3 Drawer/Dialog com 4 abas internas
1. **Funções** — CRUD + colagem em massa (uma função por linha).
2. **Riscos do PCMSO** — CRUD agrupado por grupo de risco; quando vazio, exibe "N.A.".
3. **Exames do PCMSO** — CRUD com flags por tipo ocupacional.
4. **Colaboradores vinculados** — lista + ação para vincular colaboradores ao GHE.

### 2.4 Importação rápida
Botão "Colar do PCMSO" que aceita texto e cria GHE + funções + riscos.

### 2.5 Seed inicial
Migration insere os GHEs do PCMSO Calçados (PCP, RH/SESMT, Costura, Costura 4.1, Fusionadoria, Corte de Viés, Bordado, Eletricista, etc.) como exemplo para a empresa do usuário (opcional via botão "Carregar exemplos").

---

## 3. Cadastro de colaborador

Em `Funcionarios.tsx`, adicionar campo obrigatório **GHE/GES** (Select carregado dos `ghe_ges` da empresa). A função deve pertencer ao GHE escolhido (validação no front).

---

## 4. Refatorar "Novo ASO" (AsoNovo.tsx)

Simplificar para o RH:

1. Buscar colaborador (autocomplete).
2. Mostrar cartão com nome, CPF, função, setor, **GHE/GES vinculado**.
3. Selecionar tipo de exame ocupacional.
4. Sistema **carrega automaticamente** (e exibe em readonly para RH):
   - Riscos do GHE (agrupados, com N.A. nos grupos vazios).
   - Exames previstos para aquele tipo de exame.
   - Médico padrão e local.
5. Campos editáveis: data, validade, conclusão (apto / inapto / com restrições / NR-35).
6. Validações antes de gerar:
   - Colaborador tem GHE/GES.
   - GHE tem ao menos uma função.
   - GHE tem riscos cadastrados ou N.A. definido.
   - GHE tem exames.
7. Ao salvar: grava `riscos_snapshot` e `exames_snapshot` no ASO (histórico imutável).

Para perfil Admin/TST manter possibilidade de editar manualmente riscos/exames do ASO antes de gerar.

---

## 5. PDF do ASO (asoPdf.ts)

Atualizar layout para incluir o campo **GHE/GES**, listar riscos por grupo do snapshot, listar exames do snapshot, manter QR code de verificação e assinaturas. Layout conforme seção 12 do prompt.

---

## 6. Permissões

Atualizar `src/lib/permissions.ts`:
- `aso:configurar_pcmso` — apenas Admin/TST (Super Admin já tem tudo).
- RH continua só com `rh` (visualizar/baixar) + agora também `aso:emitir` se o usuário quiser que RH emita (a definir; por padrão segue só consulta).

Esconder a aba "PCMSO / GHE" quando o usuário não tiver `aso:configurar_pcmso`.

---

## 7. Histórico do ASO no colaborador

O componente `AsoHistorico.tsx` já existe — ajustar para mostrar GHE/GES do snapshot quando disponível.

---

## Arquivos novos / alterados

**Novos**
- `supabase/migrations/<ts>_pcmso_ghe.sql`
- `src/pages/aso/PcmsoGhe.tsx` (lista de GHEs)
- `src/pages/aso/PcmsoGheForm.tsx` (dialog com 4 abas)
- `src/components/aso/GheFuncoesTab.tsx`
- `src/components/aso/GheRiscosTab.tsx`
- `src/components/aso/GheExamesTab.tsx`
- `src/components/aso/GheColaboradoresTab.tsx`
- `src/lib/asoFromGhe.ts` (helpers para montar riscos/exames a partir do GHE + tipo de exame)

**Alterados**
- `src/pages/aso/AsoModule.tsx` — nova aba "PCMSO / GHE"
- `src/pages/aso/AsoNovo.tsx` — fluxo automático via GHE
- `src/pages/Funcionarios.tsx` — campo `ghe_id` no form
- `src/lib/asoPdf.ts` — incluir GHE/GES e usar snapshots
- `src/lib/permissions.ts` — permissão `aso:configurar_pcmso`
- `src/components/aso/AsoHistorico.tsx` — exibir GHE do snapshot

---

## Confirmações antes de implementar

1. **Seed de exemplo:** crio um botão "Carregar GHEs de exemplo (PCMSO Calçados)" que insere os 8 GHEs do prompt, ou começo a base vazia?
2. **RH pode emitir ASO ou apenas consultar?** Pelo prompt antigo, RH só consulta. Neste prompt aparece "RH escolhe colaborador e gera ASO". Mantenho **RH = somente consulta** e crio nova permissão `aso:emitir` para TST/Admin? Ou habilito RH para emitir também?
3. **Compatibilidade:** mantenho as tabelas atuais `aso_setores`, `aso_funcoes`, `aso_riscos_funcao` (criadas antes) ou removo já que agora tudo passa por GHE?

Sem essas respostas, vou assumir: (1) botão de seed disponível, (2) RH continua só consulta + criar permissão `aso:emitir` para Admin/TST, (3) **manter** tabelas antigas para não quebrar nada já cadastrado, mas o novo fluxo usa exclusivamente as tabelas GHE.
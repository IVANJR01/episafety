# Plano: GES/GHE como Base Central dos Programas

## Objetivo

Transformar o GES/GHE em **fonte única de verdade** para todos os documentos técnicos do módulo Programas. O usuário cadastra riscos, funções, EPIs, exames e medidas **uma vez** — o sistema reaproveita nos PDFs, sempre permitindo revisão técnica antes de emitir.

## Escopo desta entrega

Sua recomendação prática:
1. **Fase A (agora):** PGR + Ordem de Serviço
2. **Fase B (depois):** PCMSO
3. **Fase C (última):** LTCAT, Insalubridade, Periculosidade

Nesta iteração entrego a **Fase A completa** + a **infraestrutura comum** que serve as fases seguintes. Sem tocar em EPIs, Entregas, Inspeções, Exames operacionais, Storage, RH.

---

## Fase A — O que vou construir

### 1. Ficha unificada do GES/GHE (usar o que já existe)

O projeto já tem `ghe_ges`, `ghe_funcoes`, `ghe_riscos`, `ghe_exames`. Vou:

- **Não recriar tabelas.** Apenas complementar `ghe_ges` com colunas faltantes:
  - `descricao_atividades`, `trabalhadores_expostos`, `frequencia_exposicao`, `tempo_exposicao`, `severidade`, `probabilidade`, `nivel_risco`, `medidas_controle_existentes`, `medidas_controle_recomendadas`, `epcs`, `capacitacoes_obrigatorias`, `observacoes_tecnicas`
- Reaproveitar `ghe_riscos` (perigos/agentes por grupo) e `ghe_exames` (exames+periodicidade) sem alteração de schema.
- Adicionar view/aggregate helper `ghe_ficha_completa` (leitura) que devolve o GES + riscos + exames + funções em um único payload — a base que todos os geradores consomem.

### 2. Tela "Gerar Documentos" (novo)

Rota: `/programas/gerar`

Fluxo:
1. Selecionar empresa (respeita `empresaScopeIds`)
2. Selecionar tipo de documento (PGR ou Ordem de Serviço — os outros aparecem como "Em breve" nas fases seguintes)
3. Selecionar GES/GHE (multi para PGR, único ou por função/funcionário para OS)
4. Preview dos dados carregados (riscos, funções, exames, EPIs, medidas)
5. Formulário de **campos complementares** obrigatórios do documento
6. Botão "Gerar PDF" → salva versão

### 3. PGR a partir do GES/GHE

Já existe `pgr_documentos`, `pgr_inventario_itens`, `pgr_acoes`, `pgr_pdf_versoes`. Vou:

- Adicionar botão **"Importar do GES/GHE"** no PGR existente (`PgrDetalhe`) que popula `pgr_inventario_itens` a partir dos riscos do(s) GES selecionado(s), sem duplicar itens já presentes (dedup por `perigo + risco + ges_id`).
- A geração de PDF continua no fluxo atual do PGR — apenas facilita o preenchimento inicial.

### 4. Ordem de Serviço (novo, real)

Hoje é stub. Vou implementar:

- Tabela `ordens_servico_sst` (nome diferente da `ordens_servico` existente, que é outro domínio):
  - `empresa_id`, `funcionario_id` (nullable), `funcao_id` (nullable), `ghe_id`, `escopo` (`funcionario|funcao|ghe`), `atividades`, `riscos_snapshot` (jsonb), `epis_snapshot` (jsonb), `medidas_preventivas`, `proibicoes`, `procedimentos_acidente`, `responsabilidades`, `responsavel_tecnico`, `status` (`rascunho|emitida|arquivada`), `versao`, `pdf_hash`, `pdf_drive_view_link`, `data_emissao`, `assinatura_url` (nullable)
- Tabela `ordens_servico_sst_assinaturas` (aceite do trabalhador)
- Página `src/pages/programas/OrdemServico.tsx` real: lista + criar + detalhe
- Geração de PDF profissional (segue padrão dos PDFs atuais em `src/lib/`): capa, dados da empresa, dados do trabalhador/função, atividades, riscos, EPIs, medidas, proibições, procedimentos, responsabilidades, campo de assinatura
- 3 modos: **por funcionário**, **por função**, **por GES**

### 5. Versionamento comum

Todo documento gerado grava:
- Tipo, empresa, GES usados, data emissão, versão, usuário, responsável técnico, PDF, status.

Reutilizo o padrão já existente de `pgr_pdf_versoes` / `ltcat_pdf_versoes` para OS (`ordens_servico_sst_pdf_versoes`).

### 6. Regra de revisão técnica

Fase A não gera conclusão técnica automática. LTCAT/Insalubridade/Periculosidade ficarão nas fases seguintes exatamente por causa dessa responsabilidade — o botão do documento na tela "Gerar" mostra "Requer revisão técnica" e permanece desabilitado até Fase C.

---

## O que NÃO vou fazer nesta entrega

- Não mexer em EPIs, Entregas, Inspeções, Exames operacionais, Storage, RH, Termos, MFA.
- Não recriar PGR/PCMSO/LTCAT — apenas plugar o GES/GHE neles.
- Não implementar PCMSO/LTCAT/Insalubridade/Periculosidade novos — Fase B e C.
- Não gerar conclusão técnica automática em nenhum laudo.

---

## Detalhes técnicos

**Migrations (1 sozinha, com todos os GRANT + RLS):**
1. `ALTER TABLE ghe_ges ADD COLUMN ...` para os campos complementares.
2. `CREATE TABLE public.ordens_servico_sst` + GRANT authenticated/service_role + RLS por `empresa_id` (mesmo padrão de `pgr_documentos`).
3. `CREATE TABLE public.ordens_servico_sst_assinaturas` + GRANT + RLS.
4. `CREATE TABLE public.ordens_servico_sst_pdf_versoes` + GRANT + RLS.
5. Trigger `updated_at`.

**Novos arquivos:**
- `src/lib/gesFicha.ts` — loader unificado do GES completo (riscos + exames + funções).
- `src/lib/osTypes.ts`, `src/lib/osPdf.ts` — tipos e gerador de PDF da OS.
- `src/pages/programas/GerarDocumentos.tsx` — nova tela.
- `src/pages/programas/OrdemServico.tsx` — substitui o stub, implementação real.
- `src/pages/programas/OrdemServicoNovo.tsx`, `OrdemServicoDetalhe.tsx`.
- `src/components/pgr/ImportarGheDialog.tsx` — já existe; vou estender para popular inventário automaticamente a partir do GES.

**Roteamento (`src/App.tsx`):**
- `/programas/gerar` → GerarDocumentos.
- `/programas/ordem-servico/novo`, `/programas/ordem-servico/:id`.

**Sidebar (`src/components/AppLayout.tsx`):**
- Sob "Programas", adicionar "Gerar Documentos" no topo.

**Segurança:** RLS multi-tenant por `empresa_id` idêntica ao PGR. Nada exposto a `anon`.

---

## Resultado esperado

Ao fim desta entrega:
- Você abre um GES/GHE, completa os campos técnicos uma vez.
- Vai em **Programas → Gerar Documentos**, escolhe PGR ou Ordem de Serviço, escolhe o GES, revisa, e gera o PDF.
- No PGR existente, um botão "Importar do GES/GHE" popula o inventário sem redigitação.
- Fases B (PCMSO) e C (LTCAT + Laudos) já têm a base pronta — só faltará plugar os geradores.

Confirma que sigo com a **Fase A** exatamente assim?

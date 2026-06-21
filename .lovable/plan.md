
# Plano — Módulo **LTCAT** (Laudo Técnico das Condições Ambientais do Trabalho)

> Este plano é do **LTCAT** (laudo previdenciário de exposição a agentes nocivos — Lei 8.213/91 art. 58, Decreto 3.048/99 Anexo IV, IN INSS 128/2022).
> **NÃO** é o módulo CAT (Comunicação de Acidente de Trabalho — Lei 8.213/91 art. 22), que já existe no projeto em `src/pages/cat/*` e não será tocado.

Padrão arquitetural: idêntico ao PGR — documento técnico interno, versionado, PDF com hash SHA-256 + assinatura visual + QR Code de validação interna, binários em Google Drive BYOK, RLS estrito por empresa, audit log append-only. **Sem ICP-Brasil, sem envio S-2240, sem PPP real** — apenas estrutura preparada.

---

## 1. Estrutura do laudo LTCAT

Documento por **empresa + unidade** (Matriz pode emitir consolidado; Unidade pode ter o seu). Periodicidade: anual ou em mudança ambiental relevante (art. 58 §3º).

Tabelas:

- `ltcat_documentos` — cabeçalho: empresa_id, unidade_id, versão, status, vigência início/fim, data emissão, motivo emissão, CNAE, grau de risco, `conteudo_atualizado_em`.
- `ltcat_setores_avaliados` — setores cobertos (lê `aso_setores`).
- `ltcat_grupos_homogeneos` — **snapshot** de GHE/GES no momento da emissão.
- `ltcat_funcoes` — funções enquadradas em cada GHE do laudo.
- `ltcat_agentes` — agentes nocivos por GHE (ocorrência, vindo do catálogo).
- `ltcat_avaliacoes` — 1 linha por (GHE × agente): técnica, metodologia, instrumento, intensidade, limite, enquadramento, EPI.
- `ltcat_conclusoes` — conclusão previdenciária por GHE/função.
- `ltcat_responsaveis_tecnicos` — RT(s) do laudo (Eng. Seg. / Méd. Trab.) + registro + ART.
- `ltcat_revisoes` — histórico de revisões.
- `ltcat_assinaturas` — assinatura visual + hash + MFA (append-only).
- `ltcat_pdf_versoes` — PDFs gerados (append-only).
- `ltcat_anexos` — laudos de campo, certificados de calibração, fotos (Drive BYOK).
- `ltcat_catalogo_agentes` — catálogo global de agentes nocivos (Anexo IV / códigos S-2240).

Enums:
- `ltcat_status`: `rascunho | em_revisao | vigente | substituido | arquivado`
- `ltcat_motivo_emissao`: `inicial | revisao_periodica | mudanca_ambiental | correcao`
- `ltcat_tecnica_avaliacao`: `quantitativa | qualitativa`
- `ltcat_enquadramento`: `nao_aplicavel | habitual_permanente | intermitente | eventual | neutralizado_epi`
- `ltcat_conclusao_aposentadoria`: `nao_especial | especial_15 | especial_20 | especial_25 | inconclusivo`
- `ltcat_agente_grupo`: `fisico | quimico | biologico | ergonomico | acidente`

## 2. Relação com PGR, GHE/GES, setores, funções e funcionários

- LTCAT **lê** `ghe_ges`, `ghe_funcoes`, `ghe_riscos`, `ghe_exames` e `aso_setores` da mesma empresa (RLS já isola).
- Na emissão, copia esses dados como **snapshot** em `ltcat_grupos_homogeneos` / `ltcat_funcoes` / `ltcat_agentes` — mudanças futuras em GHE não alteram laudo já assinado.
- **Funcionários não são listados nominalmente** no LTCAT (laudo é por ambiente/GHE). O elo com o trabalhador é feito depois pelo PPP, via função/GHE.
- PGR e LTCAT coexistem e compartilham catálogos.

## 3. Reaproveitamento das avaliações quantitativas do PGR

Botão **"Importar avaliações do PGR"** dentro do LTCAT:
- Lê `pgr_inventario_itens` da mesma empresa/unidade com `tecnica_avaliacao = 'quantitativa'` e medições preenchidas.
- Deduplica por (GHE + agente + função).
- Marca origem (`origem_pgr_item_id`) para rastreabilidade.
- Técnico pode editar/sobrepor antes de fechar o laudo.

## 4. Cadastro de agentes nocivos previdenciários

Tabela `ltcat_catalogo_agentes` seedada com Anexo IV do Decreto 3.048/99 + códigos eSocial S-2240 (ex.: `01.01.001 Ruído`, `02.01.014 Benzeno`, `03.01.001 Vírus`).

Campos: código eSocial, nome, grupo, unidade de medida padrão (dB(A), ppm, mg/m³, lux, °C, m/s², ufc/m³), limite NR-15 quando aplicável, base normativa, sinônimos.

Catálogo **global** (leitura para `authenticated`); agentes customizados por empresa permitidos (`empresa_id IS NOT NULL`) com RLS por empresa.

## 5. Intensidade/concentração

Numérico + unidade (herda do catálogo, pode ser sobrescrito). Campo `intensidade` + `unidade_medida` em `ltcat_avaliacoes`.

## 6. Técnica e metodologia de avaliação

- **Técnica**: `quantitativa | qualitativa`.
- **Metodologia**: texto livre + presets (NHO-01 Ruído, NHO-06 Calor, NIOSH 1501, NR-15 Anexos, ACGIH TLV).

## 7. Equipamentos/instrumentos de medição

Por avaliação: marca, modelo, número de série, data de calibração, anexo do **certificado de calibração** (Drive BYOK, em `ltcat_anexos` com `tipo = 'calibracao'`).

## 8. Limites de tolerância

Numérico + base normativa (NR-15 Anexo nº X, ACGIH, Fundacentro). Default vindo do catálogo, editável.

## 9. Enquadramento previdenciário

`habitual_permanente | intermitente | eventual | neutralizado_epi | nao_aplicavel` + tempo de exposição (h/dia, %jornada) + EPI/EPC (descrição, eficácia sim/não/parcial, CA).

## 10. Conclusão sobre aposentadoria especial

`ltcat_conclusoes` por GHE/função:
- Conclusão: `especial_15 | especial_20 | especial_25 | nao_especial | inconclusivo`.
- Justificativa técnica obrigatória quando `especial_*` ou `inconclusivo`.
- **Bloqueio de publicação**: GHE com agente acima do limite + conclusão `nao_especial` sem justificativa de neutralização por EPI eficaz → não fecha.

## 11. Vínculo futuro com PPP

- LTCAT vigente vira fonte de agentes por GHE/função → consumido pelo PPP do funcionário.
- Campo `ltcat_id` será adicionado em `ppp_riscos_cargo` em migration **futura** (não nesta fase).
- Nesta fase: apenas RPC de leitura `ltcat_agentes_por_funcao(_funcao_id)` reservada.

## 12. Vínculo futuro com eSocial S-2240

- Catálogo já no padrão MR-400 (`codAgNoc`).
- Campos preparados: `tpAval`, `intConc`, `limTol`, `tecMedicao`, `epcEpi`.
- **Sem XML, sem envio, sem ICP-Brasil nesta fase.**

## 13. Responsável técnico

`ltcat_responsaveis_tecnicos` (N por laudo): nome, CPF, profissão (Eng. Seg. / Méd. Trab.), registro (CREA / CRMed), nº ART quando aplicável, e-mail. Mínimo 1 RT para publicar.

## 14. Geração de PDF técnico interno

Lib `src/lib/ltcatPdf.ts` (espelho de `pgrPdf.ts`):

Capa → identificação (empresa, CNPJ, unidade, CNAE, grau de risco) → escopo → setores → GHE/GES → agentes por GHE → tabela de avaliações → conclusões por GHE → RTs → anexos (lista) → assinatura visual (imagem + nome + registro + data + hash).

Watermark "RASCUNHO / EM REVISÃO" quando não final.

Salvo em Drive: `LTCAT/v{versao}/Documento/`. Anexos: `LTCAT/v{versao}/anexos/{tipo}/`.

## 15. Assinatura visual + hash SHA-256

- Hash SHA-256 do binário gravado em `ltcat_pdf_versoes`.
- RPC `ltcat_assinar_visual` exige permissão `ltcat:assinar` + MFA AAL2.
- Tabela `ltcat_assinaturas` **append-only** (UPDATE/DELETE `USING (false)`).

## 16. QR Code de validação interna

Rota `/ltcat/validar/:id?v={versao}` — restrita à árvore da empresa emissora via RLS, mesmo padrão do PGR (`PgrValidar.tsx` → `LtcatValidar.tsx`). Mostra hash, status, versão, RT, alerta de PDF desatualizado.

## 17. Versionamento

- Cada publicação cria nova `versao` (snapshot completo).
- Versão anterior → `substituido`. Histórico imutável.
- RPC `ltcat_publicar(_id)`: valida PDF atualizado, sem watermark, com RT, com assinatura visual, com MFA AAL2.

## 18. Permissões

`ACOES_ESPECIAIS.ltcat`:
- `ltcat:visualizar`
- `ltcat:editar` (rascunho, importar do PGR, lançar avaliações)
- `ltcat:revisar` (abrir revisão, publicar)
- `ltcat:assinar` (assinatura visual + MFA)
- `ltcat:exportar` (gerar PDF)

Super Admin e Principal: acesso total.

## 19. RLS e isolamento por empresa

- Toda `ltcat_*` com `empresa_id NOT NULL`.
- Policies: `is_in_user_company_tree(auth.uid(), empresa_id) OR is_super_admin OR is_principal`.
- Tabelas-filhas (`ltcat_avaliacoes`, `ltcat_conclusoes`, `ltcat_anexos`, `ltcat_agentes`, etc.): trigger `inherit_empresa_id` herda do `ltcat_id` pai (padrão `pgr_evid_guard`).
- GRANTs: `authenticated` (CRUD), `service_role` (ALL). Sem `anon`.
- Catálogo global: `SELECT` para `authenticated`; mutações só Super Admin ou registros com `empresa_id = caller_empresa`.
- Drive: pastas isoladas por empresa (já garantido pelo BYOK).

## 20. Audit log

- Triggers `AFTER INSERT/UPDATE/DELETE` em `ltcat_documentos`, `ltcat_avaliacoes`, `ltcat_conclusoes`, `ltcat_assinaturas`, `ltcat_pdf_versoes` → `audit_log`.
- Histórico próprio em `ltcat_revisoes`.
- `ltcat_assinaturas` e `ltcat_pdf_versoes` **append-only**.

## 21. Plano de entrega em partes

1. **Parte 1** — Migrations + RLS + permissões + seed do catálogo de agentes (Anexo IV / S-2240). Sem telas.
2. **Parte 2** — CRUD do LTCAT: listagem, novo laudo, detalhe, revisão/publicação básica.
3. **Parte 3** — Agentes nocivos + avaliações (quantitativas/qualitativas) + importação do PGR + GHE snapshot + anexos de calibração.
4. **Parte 4** — Conclusões previdenciárias (15/20/25/não especial) + validações de fechamento + RT/ART.
5. **Parte 5** — PDF técnico interno + assinatura visual + hash SHA-256 + QR Code + Drive BYOK + `/ltcat/validar/:id`.
6. **Parte 6** — Dashboard LTCAT + checklist final + exportação CSV + relatório de produção.

## Checklist de testes (Empresa A × Empresa B)

- [ ] Empresa A não lista LTCATs da Empresa B em `/ltcat`.
- [ ] `/ltcat/:id` cruzado → 404.
- [ ] QR de validação só abre dentro da árvore da empresa emissora.
- [ ] PDF Drive da Empresa A não acessível com token da Empresa B.
- [ ] Importar avaliações do PGR só enxerga itens da própria empresa.
- [ ] Agentes customizados da Empresa A não aparecem para Empresa B.
- [ ] Publicar sem RT → bloqueado.
- [ ] Publicar com agente acima do limite + `nao_especial` sem justificativa → bloqueado.
- [ ] PDF desatualizado bloqueia publicação.
- [ ] Assinatura sem MFA AAL2 → bloqueada.
- [ ] LTCAT vigente bloqueia edição direta (exige revisão).
- [ ] Audit log registra todas as operações.
- [ ] Hash do rodapé do PDF bate com SHA-256 do binário.

## Restrições reforçadas

- Sem ICP-Brasil.
- Sem envio real S-2240 (apenas campos preparados).
- Sem geração de PPP real (apenas RPC reservada).
- Todo binário em Google Drive BYOK.
- Mesmo padrão de segurança/MFA do PGR.
- **Não toca em nada do módulo CAT existente.**

---

**Aguardando sua aprovação explícita do plano LTCAT para iniciar a Parte 1.** Nenhuma migration será criada antes disso.

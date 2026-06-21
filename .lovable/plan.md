
# Plano — Módulo LTCAT (Laudo Técnico das Condições Ambientais do Trabalho)

LTCAT segue exatamente o padrão arquitetural do PGR: documento técnico interno, versionado, com PDF + hash SHA-256 + assinatura visual + QR Code de validação interna, evidências/arquivos em Google Drive BYOK, RLS estrito por empresa, audit log append-only. Sem ICP-Brasil, sem envio eSocial S-2240, sem geração de PPP real — apenas estrutura preparada para integração futura.

Base legal de referência: Lei 8.213/91 art. 58, Decreto 3.048/99 Anexo IV, IN INSS 128/2022, NR-15, NR-09, NHO-01/NHO-06 da Fundacentro, MR-400 do eSocial (S-2240).

---

## 1. Estrutura do LTCAT

Documento por **empresa + unidade** (Matriz pode emitir consolidado; cada Unidade pode ter o seu). Periodicidade: anual ou sempre que houver mudança ambiental relevante (art. 58 §3º Lei 8.213/91).

Tabelas previstas:

- `ltcat_documentos` — cabeçalho do laudo: empresa, unidade, versão, status, vigência, responsável técnico (registro CREA/CRMed/MTE), data emissão, motivo emissão (inicial / mudança ambiental / revisão periódica), `conteudo_atualizado_em`.
- `ltcat_setores_avaliados` — setores/locais cobertos pelo laudo (importados de `aso_setores` / GHE).
- `ltcat_grupos_homogeneos` — GHE/GES copiados do PGR no momento da emissão (snapshot, não vínculo vivo).
- `ltcat_funcoes` — funções enquadradas em cada GHE do laudo.
- `ltcat_agentes` — agentes nocivos avaliados (catálogo + ocorrência).
- `ltcat_avaliacoes` — uma linha por (GHE × agente): técnica, metodologia, instrumento, intensidade/concentração, limite de tolerância, enquadramento.
- `ltcat_conclusoes` — conclusão por GHE/função sobre aposentadoria especial (15/20/25 anos / não especial / EPI eficaz neutralizante).
- `ltcat_responsaveis_tecnicos` — RT(s) do laudo + registro profissional + ART quando aplicável.
- `ltcat_revisoes` — histórico de revisões (igual `pgr_revisoes`).
- `ltcat_assinaturas` — assinatura visual + hash + MFA (igual `pgr_assinaturas`).
- `ltcat_pdf_versoes` — PDFs gerados (append-only, igual `pgr_pdf_versoes`).
- `ltcat_anexos` — evidências/laudos de campo/certificados de calibração no Drive BYOK.

Enums:
- `ltcat_status`: `rascunho | em_revisao | vigente | substituido | arquivado`.
- `ltcat_motivo_emissao`: `inicial | revisao_periodica | mudanca_ambiental | correcao`.
- `ltcat_tecnica_avaliacao`: `quantitativa | qualitativa`.
- `ltcat_enquadramento`: `nao_aplicavel | habitual_permanente | intermitente | eventual | neutralizado_epi`.
- `ltcat_conclusao_aposentadoria`: `nao_especial | especial_15 | especial_20 | especial_25 | inconclusivo`.
- `ltcat_catalogo_grupo`: `fisico | quimico | biologico | ergonomico | acidente`.

---

## 2. Relação com PGR / GHE/GES / Setores / Funções / Funcionários

- LTCAT **lê** `ghe_ges`, `ghe_funcoes`, `ghe_riscos`, `ghe_exames` e `aso_setores` da mesma empresa (RLS já garante o isolamento).
- Ao **emitir** um LTCAT, copia esses dados como snapshot em `ltcat_grupos_homogeneos` / `ltcat_funcoes` / `ltcat_agentes` para que mudanças futuras em GHE não alterem o laudo já assinado.
- Funcionários **não são listados nominalmente** no LTCAT (LTCAT é por ambiente/GHE, não por trabalhador). O elo com o funcionário é feito posteriormente pelo PPP, via função/GHE.
- PGR e LTCAT podem coexistir e referenciam o mesmo catálogo de agentes (vamos reusar `pgr_perigos_catalogo` filtrando os de natureza ocupacional do Anexo IV).

## 3. Reaproveitamento das avaliações quantitativas do PGR

Botão **"Importar avaliações do PGR"** dentro do LTCAT, espelhando o padrão "Importar GHE/GES":

- Lê `pgr_inventario_itens` da mesma empresa/unidade com `tecnica_avaliacao = 'quantitativa'` e medições preenchidas (intensidade, instrumento, metodologia).
- Deduplica por (GHE + agente + função).
- Marca origem (`origem_pgr_item_id`) para rastreabilidade.
- O técnico pode editar/sobrepor antes de fechar o laudo.

## 4. Cadastro de agentes nocivos

- Tabela `ltcat_catalogo_agentes` (seedada com o Anexo IV do Dec. 3.048/99 + códigos eSocial S-2240, ex.: `01.01.001 Ruído`, `02.01.014 Benzeno`, `03.01.001 Vírus`, etc.).
- Campos: código eSocial, nome, grupo (físico/químico/biológico/ergonômico/acidente), unidade de medida padrão (dB(A), ppm, mg/m³, lux, °C, m/s², ufc/m³), limite de tolerância NR-15 quando aplicável, base normativa, sinônimos.
- Catálogo é **global** (somente leitura para usuários comuns) mas pode receber agentes customizados por empresa (`empresa_id IS NOT NULL`) com RLS por empresa para os customizados.

## 5–9. Avaliação por agente (uma linha de `ltcat_avaliacoes` por GHE × agente)

Campos:
- **Intensidade/concentração**: numérico + unidade (herda do catálogo, pode ser sobrescrito).
- **Técnica**: `quantitativa | qualitativa`.
- **Metodologia**: texto + select com presets (NHO-01 Ruído, NHO-06 Calor, NIOSH 1501 etc.).
- **Instrumento/equipamento**: marca, modelo, número de série, data de calibração, anexo do certificado de calibração (Drive BYOK).
- **Limite de tolerância**: numérico + base (NR-15 Anexo, ACGIH TLV).
- **Tempo de exposição**: horas/dia, %jornada.
- **EPI/EPC**: descrição, eficácia (sim/não/parcial), CA quando aplicável.
- **Enquadramento**: `habitual_permanente | intermitente | eventual | neutralizado_epi | nao_aplicavel`.

## 10–11. Conclusão sobre aposentadoria especial

Tabela `ltcat_conclusoes` por GHE/função:
- Agentes considerados.
- Conclusão: `especial_15 | especial_20 | especial_25 | nao_especial | inconclusivo`.
- Justificativa técnica obrigatória quando `especial_*` ou `inconclusivo`.
- Bloqueio: não permite fechar laudo se houver GHE com agente acima do limite e conclusão `nao_especial` sem justificativa de neutralização por EPI eficaz.

## 12. Relação futura com PPP

- LTCAT vigente fornece os agentes nocivos por GHE/função → PPP do funcionário consulta esses dados via função.
- Campo `ltcat_id` reservado em `ppp_riscos_cargo` (adicionado em migration futura, não nesta fase).
- Nesta fase: apenas **estrutura pronta** (views/RPCs `ltcat_agentes_por_funcao(_funcao_id)`).

## 13. Relação futura com eSocial S-2240

- Códigos do catálogo já no padrão MR-400 (`codAgNoc`).
- Campos previstos para futura geração: `tpAval`, `intConc`, `limTol`, `tecMedicao`, `epcEpi`.
- **Sem XML, sem envio, sem assinatura ICP nesta fase.**

## 14. Responsável técnico

- Tabela `ltcat_responsaveis_tecnicos` (N RTs por laudo).
- Campos: nome, CPF, profissão (Engenheiro de Segurança / Médico do Trabalho), registro (CREA/CRMed), nº ART quando aplicável, e-mail.
- Pelo menos 1 RT obrigatório para publicar.

## 15–17. PDF técnico interno + Assinatura visual + QR Code

Idêntico ao padrão PGR (`pgrPdf.ts` → `ltcatPdf.ts`):

- Capa, identificação (empresa, CNPJ, unidade, CNAE, grau de risco), escopo, setores, GHE/GES, agentes por GHE, tabela de avaliações, conclusões por GHE, responsáveis técnicos, anexos (lista), assinatura visual (imagem + nome + registro + data + hash SHA-256).
- Watermark "RASCUNHO / EM REVISÃO" quando não final.
- Hash SHA-256 do binário gravado em `ltcat_pdf_versoes`.
- QR Code → `/ltcat/validar/:id?v={versao}` (interno, RLS por empresa — mesma regra do PGR).
- Drive: `LTCAT/v{versao}/Documento/`.
- Anexos: `LTCAT/v{versao}/anexos/{tipo}/`.

## 18. Versionamento

- Cada publicação cria nova `versao` em `ltcat_documentos` (snapshot completo dos GHE/agentes/avaliações).
- Versão anterior vai para `substituido`. Histórico imutável.
- RPC `ltcat_publicar(_id)` (igual `pgr_publicar`): valida PDF atualizado, sem watermark, com RT assinado e MFA AAL2.

## 19. Permissões por perfil

Em `ACOES_ESPECIAIS.ltcat`:
- `ltcat:visualizar`
- `ltcat:editar` (criar/editar rascunho, importar do PGR, lançar avaliações)
- `ltcat:revisar` (abrir revisão, publicar)
- `ltcat:assinar` (assinatura visual + MFA)
- `ltcat:exportar` (gerar PDF)

Super Admin e Principal: acesso total. Demais: conforme grant.

## 20. RLS e isolamento por empresa

Padrão idêntico ao PGR:
- Toda tabela `ltcat_*` com `empresa_id NOT NULL`.
- Policies `is_in_user_company_tree(auth.uid(), empresa_id) OR is_super_admin OR is_principal`.
- Tabelas-filhas (`ltcat_avaliacoes`, `ltcat_conclusoes`, `ltcat_anexos`, etc.) ganham trigger `inherit_empresa_id` a partir do `ltcat_id` (mesmo padrão `pgr_evid_guard`).
- GRANTs explícitos: `authenticated` (CRUD), `service_role` (ALL). Sem `anon`.
- Catálogo global: `SELECT` para `authenticated`; `INSERT/UPDATE/DELETE` só para Super Admin ou registros com `empresa_id = caller_empresa`.

## 21. Audit log

- Triggers `AFTER INSERT/UPDATE/DELETE` em `ltcat_documentos`, `ltcat_avaliacoes`, `ltcat_conclusoes`, `ltcat_assinaturas`, `ltcat_pdf_versoes` gravando em `audit_log`.
- Histórico próprio em `ltcat_revisoes` (motivo, autor, data, snapshot resumido).
- `ltcat_assinaturas` e `ltcat_pdf_versoes` **append-only** (policy UPDATE/DELETE `USING (false)`).

## 22. Checklist de testes (Empresa A × Empresa B)

- [ ] Usuário da Empresa A não lista LTCATs da Empresa B (`/ltcat`).
- [ ] Acesso direto a `/ltcat/:id` de outra empresa retorna 404.
- [ ] QR Code de validação só abre dentro da árvore da empresa emissora.
- [ ] PDF no Drive sob pasta da Empresa A não é acessível com token da Empresa B.
- [ ] Importação de avaliações do PGR só vê itens da própria empresa.
- [ ] Catálogo global de agentes é visível para ambas; agentes customizados da Empresa A não aparecem para Empresa B.
- [ ] Publicar sem RT → bloqueado.
- [ ] Publicar com GHE acima do limite e conclusão `nao_especial` sem justificativa de neutralização → bloqueado.
- [ ] Publicar com PDF desatualizado (`conteudo_atualizado_em > pdf.gerado_em`) → bloqueado.
- [ ] Assinatura sem MFA AAL2 → bloqueado.
- [ ] LTCAT vigente bloqueia edição direta (precisa abrir revisão).
- [ ] Audit log registra criação/edição/publicação/assinatura.
- [ ] Hash impresso no rodapé do PDF bate com o calculado no momento do download.

---

## Ordem de entrega (aprovação por parte)

1. **Parte 1** — Migrations + RLS + permissões + seed do catálogo de agentes (Anexo IV / códigos S-2240). Sem telas.
2. **Parte 2** — CRUD LTCAT: listagem, novo laudo, detalhe, revisão/publicação básica, telas mínimas.
3. **Parte 3** — Agentes nocivos + avaliações (quantitativas/qualitativas) + importação do PGR + GHE snapshot.
4. **Parte 4** — Conclusões previdenciárias (15/20/25/não especial) + validações de fechamento + ART/RT.
5. **Parte 5** — PDF técnico interno + assinatura visual + hash SHA-256 + QR Code + Drive BYOK + página `/ltcat/validar/:id`.
6. **Parte 6** — Dashboard LTCAT + checklist final + exportação CSV + relatório de produção.

## Restrições reforçadas

- Sem ICP-Brasil.
- Sem envio real S-2240 (apenas campos preparados).
- Sem geração de PPP real (apenas RPC de leitura reservada).
- BYOK Google Drive para todo binário (PDFs, certificados de calibração, fotos de medição).
- Mesmo padrão de segurança/MFA do PGR.

---

**Aguardando aprovação do plano para iniciar a Parte 1 — Migrations + RLS + permissões + seed do catálogo de agentes.**

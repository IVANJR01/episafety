# Plano — eSocial S-2240 (Condições Ambientais do Trabalho / Agentes Nocivos)

Documento técnico **interno preparatório**. Reaproveita PPP, LTCAT e PGR. Não envia ao Ambiente Nacional, não usa ICP-Brasil, não assina XMLDSig, não fala SOAP real, não emite recibo real. Tudo gerado nesta fase é **stub técnico** marcado como tal na UI e no banco.

---

## 1. Estrutura do evento S-2240

Evento periódico, por trabalhador, que informa início, alteração ou fim de exposição a agentes nocivos. Layout simplificado:

```text
evtExpRisco
├── ideEvento (indRetif, nrRecibo?, tpAmb, procEmi, verProc)
├── ideEmpregador (tpInsc, nrInsc)
├── ideVinculo (cpfTrab, matricula, codCateg)
├── infoExpRisco
│   ├── dtIniCondicao
│   ├── infoAmb[] (localAmb, dscSetor)
│   ├── infoAtiv (dscAtivDes)
│   ├── agNoc[]
│   │   ├── codAgNoc (Tabela 24)
│   │   ├── dscAgNoc
│   │   ├── tpAval (1 quant / 2 qual)
│   │   ├── intConc, limTol, unMed, tecMedicao
│   │   ├── insalubridade, periculosidade, aposentEsp
│   │   ├── epcEpi (utilizaEPC, eficEpc, utilizaEPI, eficEpi, epi[].docAval/dtValid/...)
│   ├── respReg[] (cpfResp, ideOC, dscOC, nrOC, ufOC)
│   └── obsCompl
└── infoExpRiscoFim (dtFimCondicao) — apenas no encerramento
```

Tipos: `inicial`, `alteracao`, `fim`, `retificacao`, `exclusao`.

---

## 2-5. Reaproveitamento

- **PPP** → fonte primária. Cada `ppp_periodo` vigente vira um candidato a S-2240 (`evento_origem = ppp_periodo_id`). Encerramento de período → evento de fim.
- **LTCAT** → fonte de agentes, intensidade, técnica, RT ambiental (via `ppp_exposicoes.origem_ltcat_aval_id`).
- **PGR** → fonte do `dscAtivDes`, controles e justificativas (apenas referência, snapshot).
- **Funcionário/vínculo** → CPF, matrícula (`funcionarios.matricula`), categoria eSocial, CBO da função, lotação tributária via `empresa_config`. Histórico laboral do PPP define `dtIniCondicao` / `dtFimCondicao`.

---

## 6. Mapeamento Tabela 24

Tabela `esocial_tabela24_agentes` (seed oficial da T24) + `esocial_s2240_mapeamento_agentes` ligando `agente_nome` livre (ou `ltcat_catalogo_agentes.id`) ao `codAgNoc`. UI de revisão por empresa com:
- código T24, descrição, tipo de avaliação esperada (quant/qual),
- unidade padrão sugerida,
- flag `aposentEsp` padrão,
- status do mapeamento (`pendente|revisado|aprovado`).

Geração do XML bloqueia se houver agente sem mapeamento aprovado.

---

## 7-10. Períodos, intensidade, técnica, EPI/EPC

- Período: `dtIniCondicao` = início do `ppp_periodo`; alteração quando muda agente, intensidade, EPI ou função; fim quando `periodo.data_fim` é preenchido.
- Intensidade/concentração: `intConc`, `limTol`, `unMed` herdados de `ppp_exposicoes`. Quando qualitativo → `tpAval=2` e campos numéricos omitidos.
- Técnica: `tecMedicao` mapeada de `ppp_exposicoes.tecnica`.
- EPI/EPC: `utilizaEPC`, `eficEpc`, `utilizaEPI`, `eficEpi`, `epi[]` com CA (`docAval`) e validade. Bloqueia geração se `eficEpi=S` com exposição acima do LT sem justificativa.

---

## 11. Responsável técnico

`respReg[]` populado a partir de `ppp_responsaveis_ambientais` do período: CPF, conselho (`ideOC`), nº registro, UF. Bloqueia geração sem ao menos um RT com conselho válido (CREA/CRM/CRQ).

---

## 12. Validações antes do XML

RPC `s2240_validar(_evento_id)`:
- PPP vigente com período válido;
- todos agentes mapeados na T24;
- `tpAval` coerente com presença de `intConc`;
- CBO presente, matrícula presente, CPF válido (mod 11);
- RT ambiental com conselho válido;
- empresa com `empresa_config.cnpj/cpf` e `nrInsc` ok;
- EPI eficaz × acima do LT → exige justificativa;
- período sem sobreposição com outro S-2240 vigente do mesmo trabalhador.

Retorna lista estruturada de erros/avisos; UI mostra em checklist.

---

## 13-14. Geração de XML stub + hash

- Geração **client-side** via builder TS dedicado (`src/lib/esocialS2240Xml.ts`), espelhando o padrão do S-2210 já existente.
- Marca d'água no XML: comentário `<!-- STUB TÉCNICO - NÃO ENVIADO AO AMBIENTE NACIONAL -->`.
- SHA-256 via Web Crypto; grava em `esocial_eventos_s2240.xml_sha256`. Binário do XML salvo no **Drive BYOK** em `eSocial/S-2240/{cpf}/{evento_id}.xml`. Banco guarda apenas `drive_id`, `drive_link`, `sha256`, tamanho.

---

## 15-17. Histórico, erros, status

`esocial_s2240_tentativas` (append-only):
- tipo (`validacao_local|geracao_xml|simulacao_envio`),
- resultado (`ok|erro|aviso`),
- mensagens (JSONB), hash XML, user, timestamp.

Status do evento (`esocial_s2240_status` enum): `pendente`, `pronto_envio`, `validado_stub`, `homologacao_stub`, `simulado`, `rejeitado_local`. **Nunca** `enviado`/`processado` nesta fase.

UI exibe banner permanente: *"XML gerado apenas para validação técnica. Não enviado ao Ambiente Nacional."*

---

## 18. Retificação e exclusão (preparação)

Campos `indRetif`, `evento_origem_id`, `nr_recibo_origem` reservados. RPC `s2240_abrir_retificacao` clona evento, mantém origem, gera nova versão em `pendente`. Exclusão lógica via evento tipo `exclusao` — sem deletar histórico.

---

## 19-20. Preparação ICP-Brasil e SOAP

- Coluna `xml_assinado_drive_id` (null nesta fase).
- Coluna `cert_alias` em `esocial_config` (já existe — reusar).
- Tabela `esocial_s2240_transmissoes` criada vazia, com placeholders `endpoint`, `protocolo`, `recibo`, `lote_id`. Nenhum código de transmissão real. Apenas estrutura para a fase futura.

---

## 21-22. Permissões e MFA

Em `ACOES_ESPECIAIS.cat` (ou novo grupo `esocial`):
- `s2240:visualizar`, `s2240:gerar_xml`, `s2240:validar`, `s2240:configurar`, `s2240:simular_envio` (futuro).

MFA AAL2 obrigatório (`MfaActionButton`) para: gerar XML stub, marcar `validado_stub`, abrir retificação, qualquer simulação de envio.

---

## 23-24. RLS e audit

- Todas as tabelas `esocial_s2240_*` com `empresa_id` obrigatório, RLS habilitada, `usuario_pertence_empresa(auth.uid(), empresa_id)`.
- GRANT apenas `authenticated` + `service_role`. Sem `anon`.
- `audit_log` registra criação, validação, geração de XML, mudança de status — **somente metadados + hash**. Nunca o XML inteiro (replicar o redator usado no S-2210).

---

## 25. Plano de entrega por partes

### Parte 1 — Migrations + RLS + permissões
Tabelas `esocial_eventos_s2240`, `esocial_s2240_agentes`, `esocial_s2240_epi`, `esocial_s2240_tentativas`, `esocial_s2240_transmissoes`, `esocial_tabela24_agentes`, `esocial_s2240_mapeamento_agentes`. Enums de status/tipo. GRANTs, RLS, triggers (`set_updated_at`, append-only nas tentativas, audit, bloqueio por imutabilidade após `validado_stub`). Permissões `s2240:*`.

### Parte 2 — Mapeamento Tabela 24 + configurações
Seed da Tabela 24 oficial. UI `/cat/esocial/s2240/mapeamento` para revisar agentes por empresa. Vínculo com `ltcat_catalogo_agentes`. Configurações específicas do S-2240 em `esocial_config` (versão do layout, ambiente padrão).

### Parte 3 — Geração XML técnico/stub
RPC `s2240_montar_payload(_ppp_id, _periodo_id)`. Builder `src/lib/esocialS2240Xml.ts`. Hash + upload ao Drive. UI no detalhe do PPP: aba "S-2240 (stub)" com pré-visualização do payload, botão *Gerar XML stub* (MFA), histórico de tentativas.

### Parte 4 — Validação local do XML
RPC `s2240_validar`. XSD-light client-side (validador estrutural sem XSD oficial). Checklist na UI com erros/avisos clicáveis. Status `validado_stub` somente após passar.

### Parte 5 — Dashboard/checklist de prontidão
`/cat/esocial/s2240/dashboard`: eventos por status, agentes sem mapeamento, RTs incompletos, períodos sem matrícula, EPI sem CA, próximos vencimentos. Checklist global de prontidão por empresa (espelho do `EsocialChecklistTab`).

### Parte 6 — Decisão futura (fora deste plano)
Certificado ICP-Brasil, assinatura XMLDSig, cliente SOAP, envio real, recibo, S-3000. Apenas **após** aprovação explícita; cada item entra como plano novo.

---

## Fora do escopo (explícito)

- Envio ao Ambiente Nacional (qualquer ambiente).
- Certificado A1/A3 real.
- Assinatura XMLDSig real.
- Cliente SOAP real.
- Recibo, protocolo, S-3000.
- Marcação de evento como `enviado`/`processado`.
- XML completo dentro do `audit_log`.

---

**Aguardando aprovação explícita deste plano antes de iniciar a Parte 1 do S-2240.**

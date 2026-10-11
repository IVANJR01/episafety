# Como o sistema gera a planilha e o PGR juntos

Os dados ficam em um único arquivo, o `dados.json`. Dele saem os dois documentos, sempre iguais.

```
planilha antiga (.xlsm)  --extrair_planilha.py-->  dados.json
dados.json  --gerar_planilha.py-->  Inventário + Plano de Ação 5W2H + Matriz 5x5 (.xlsx)
dados.json  --gerar.js-->           PGR em Word (inventário e plano de ação dentro do documento)
```

## Comandos
```
python3 extrair_planilha.py "Inventário 2026.xlsm" dados.json
python3 gerar_planilha.py dados.json Inventario.xlsx
node gerar.js pasta_saida dados.json PGR
```
Sem dados (modelo em branco): `python3 gerar_planilha.py - Modelo.xlsx` e `node gerar.js pasta_saida -`.

## Estrutura do dados.json
- `empresa`: campos da capa e identificação (RAZAO_SOCIAL, CNPJ, ENDERECO, CIDADE, UF, RESPONSAVEL_NOME, RESPONSAVEL_REGISTRO, VIGENCIA_INICIO, VIGENCIA_FIM, REVISAO, DATA_EMISSAO...). Campo vazio aparece como {{CAMPO}} no Word.
- `inventario`: uma linha por risco, com as colunas da planilha: ambiente, setor, ghe, funcao, processo, agente, perigo, fonte, lesoes, limite, intensidade, exposicao, tecnica, medidas, epi, atenuacao, probabilidade (1-5), severidade (1-5). Nível e classificação são calculados.
- `plano`: setor, ghe, oque, porque, como, onde, quanto, prioridade, meses (ex.: ["MAR"]), responsavel, status, afericao.

## Classificação (igual à sua planilha)
1–3 TRIVIAL · 4–8 TOLERÁVEL · 9–12 MODERADO · 13–15 SUBSTANCIAL · 16–25 INTOLERÁVEL

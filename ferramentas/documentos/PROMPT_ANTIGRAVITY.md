Você vai integrar ao meu sistema **SafetySoluções** a geração automática de documentos de Segurança e Saúde no Trabalho (SST). Leia tudo antes de começar.

## Contexto
Sou técnico em segurança do trabalho e vendo documentos SST pelo SafetySoluções. Já tenho um pacote pronto e testado na pasta `safetysolucoes-documentos/` (anexada ao projeto). Ele gera:
- 6 documentos Word (.docx) com a mesma capa (capa "Simples" com moldura): **PGR, PCMSO, AET, AEP, Laudo de Insalubridade e Laudo de Periculosidade**;
- a **planilha de Inventário de Riscos + Plano de Ação 5W2H + Matriz 5x5** (.xlsx).

O PGR e a planilha saem do **mesmo arquivo de dados** (`dados.json`), por isso o inventário dentro do PGR é sempre idêntico à planilha.

## Arquivos do pacote
- `gerador/gerar.js`: gera os .docx (Node + biblioteca `docx` ^9). Uso: `node gerar.js <pasta_saida> <dados.json | -> [SIGLA...]`. Com `-`, gera os modelos em branco com campos `{{CAMPO}}`.
- `gerador/docs.js`: estrutura e textos de cada documento (seções, itens da norma).
- `gerador/niveis.js`: capa (a função `simples` é a capa oficial).
- `gerador/gerar_planilha.py`: gera a planilha .xlsx a partir do dados.json (Python + openpyxl). Uso: `python3 gerar_planilha.py <dados.json | -> saida.xlsx`.
- `gerador/extrair_planilha.py`: importa uma planilha antiga (.xlsm/.xlsx) e gera o dados.json.
- `exemplo/dados_exemplo.json`, `exemplo/01_PGR_Exemplo.docx`, `exemplo/Inventario_Exemplo.xlsx`: exemplo completo com dados fictícios.
- `COMO_FUNCIONA.md`: fluxo e formato do dados.json.

## Formato do dados.json (não mude os nomes das chaves)
- `empresa`: RAZAO_SOCIAL, NOME_FANTASIA, CNPJ, CNAE_PRINCIPAL, CNAE_SECUNDARIO, GRAU_RISCO, ENDERECO, BAIRRO, CIDADE, UF, CIDADE_UF, CEP, TELEFONE, RESPONSAVEL_NOME, RESPONSAVEL_FORMACAO, RESPONSAVEL_REGISTRO, VIGENCIA_INICIO, VIGENCIA_FIM, REVISAO, DATA_EMISSAO, DESCRICAO_REVISAO, ANO, REPRESENTANTE_EMPRESA, ARQUIVO (sufixo do nome do arquivo gerado).
- `inventario`: lista, uma linha por risco: ambiente, setor, ghe (é o número do **GES**), funcao, processo, agente (Físico, Químico, Biológico, Ergonômico, Acidente), perigo, fonte, lesoes, limite, intensidade, exposicao (Permanente, Intermitente, Eventual), tecnica, medidas, epi, atenuacao, probabilidade (1 a 5), severidade (1 a 5).
- `plano`: lista de ações: setor, ghe, oque, porque, como, onde, quanto, prioridade (ALTA, MÉDIA, BAIXA), meses (ex.: ["MAR","ABR"]), responsavel, status (ATRASADO, EM ANDAMENTO, PROGRAMADO, REALIZADO, REPROGRAMADO), afericao.

## Regras que não podem mudar
1. Usar a sigla **GES** (Grupo de Exposição Similar), nunca GHE, em tudo que o usuário vê.
2. Nível de risco = Probabilidade × Severidade. Classificação: 1–3 TRIVIAL (azul 00B0F0), 4–8 TOLERÁVEL (verde 92D050), 9–12 MODERADO (amarelo FFFF00), 13–15 SUBSTANCIAL (laranja FFC000), 16–25 INTOLERÁVEL (vermelho C00000). O nível e a classificação são sempre **calculados**, nunca digitados.
3. O PGR deve conter **somente o que a NR-01 exige**: inventário de riscos (item 1.5.7.3.2, letras a até i), plano de ação com cronograma, responsável, acompanhamento e aferição (item 1.5.5.2), revisão (item 1.5.4.4.6), e ser datado e assinado (item 1.5.7.2). Não acrescente introdução, objetivos ou textos genéricos.
4. Manter a capa Simples com moldura em todos os documentos, mudando só o nome do documento.
5. Campo sem valor aparece como `{{CAMPO}}` em azul. Não invente dados.

## O que eu quero que você faça
1. **Analise primeiro o meu projeto** (linguagem, framework, banco de dados, onde ficam empresas e usuários) e me mostre um plano curto antes de alterar código.
2. Crie no banco as tabelas (ou coleções) para **inventário de riscos** e **plano de ação**, ligadas à empresa, com os mesmos campos do dados.json.
3. Crie as telas:
   - cadastro e edição das linhas do inventário, agrupadas por GES, com listas de escolha para agente, exposição, probabilidade e severidade, mostrando nível e classificação coloridos em tempo real;
   - cadastro do plano de ação 5W2H com cronograma por mês e status colorido;
   - botão **Importar planilha** (usa `extrair_planilha.py`) para trazer inventários antigos em .xlsm/.xlsx.
4. Crie os botões **Gerar PGR (Word)**, **Gerar Planilha (Excel)** e **Gerar PCMSO / AET / AEP / Laudos**. Cada botão monta o dados.json da empresa, chama o gerador e devolve o arquivo para download. Pode chamar os scripts como estão (processo filho) ou portar a lógica para a linguagem do sistema, desde que o resultado fique **idêntico**.
5. Opcional: gerar também o PDF (por exemplo com LibreOffice em modo headless: `soffice --headless --convert-to pdf`).
6. Guarde o histórico das versões geradas por empresa (a NR-01 pede o histórico do inventário por 20 anos).

## Como validar
- Gere o PGR e a planilha com `exemplo/dados_exemplo.json` e compare com `exemplo/01_PGR_Exemplo.docx` e `exemplo/Inventario_Exemplo.xlsx`. Devem ficar iguais.
- Confira que um risco com P=4 e S=3 aparece como 12 MODERADO (amarelo) no Word e no Excel.
- Confira que nenhum documento mostra "GHE".
- Confira que um campo da empresa deixado vazio aparece como `{{CAMPO}}` e não quebra a geração.

Responda em português e explique cada passo de forma simples, porque estou começando em programação.

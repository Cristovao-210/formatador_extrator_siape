# SIAPE | Formatador + Conferência POLARE 

Projeto estático para uso local ou GitHub Pages. 

**A conferência SIAPE/POLARE é específica para o contexto da Universidade de Brasília (UnB).**


### Tratamento dos campos de data

- O Formatador SIAPE realiza a leitura e a organização dos dados conforme as posições e definições dos campos presentes no arquivo de layout (REF.gz).
**Os campos que representam datas são preservados como texto**, mantendo sua representação original, sem conversão automática para formatos de data do Excel ou de outros programas.
- Por exemplo, uma data no formato `AAAAMMDD`, como `20261119`, será exportada com esse mesmo conteúdo, sem conversão automática para `19/11/2026`.
- Essa abordagem evita interpretações incorretas e preserva a integridade dos dados originais.
- Caso necessário, o usuário poderá converter esses campos posteriormente, conforme a documentação do layout e as necessidades de sua análise.

## Estrutura

- `index.html`: formatador REF/TXT
- `pages/conferencia.html`: conferência POLARE
- `js/app.js`: parser original, prévia e exportações
- `js/transferencia.js`: transferência para a conferência via `sessionStorage`
- `js/conferencia-core.js`: regras de negócio preservadas da V3 validada
- `js/conferencia.js`: interface, métricas e exportação da conferência
- `style/styles.css`: aparência
- `dados_auxiliares/bases.js`: bases auxiliares embarcadas para o navegador
- `dados_auxiliares/atualizar_bases.py`: gera `bases.js` a partir dos CSVs

## Como usar

1. Abra `index.html` no Chrome ou Edge.
2. Carregue os arquivos `.REF.gz` e `.TXT.gz` e processe. O primeiro card será recolhido automaticamente.
3. Exporte CSV/Excel (a página recarrega) **ou** entre em Conferência SIAPE/POLARE na mesma aba.
4. Cole os nomes POLARE (um por linha), execute a conferência e exporte Excel. Ao iniciar o download, o navegador volta ao formatador.

A transferência utiliza `sessionStorage`, apagando os dados transferidos assim que a página de conferência os lê. O arquivo gerado é solicitado ao navegador antes da navegação. Alguns navegadores podem bloquear o armazenamento em páginas `file://` ou limitar o tamanho da sessão; nesse caso, execute em um servidor local ou GitHub Pages.

## Bases auxiliares

O `.gitignore` exclui todos os `.csv` e `.py`. O arquivo `bases.js` permanece versionado e contém uma cópia dos dados auxiliares, portanto **revise seu conteúdo antes de publicar**. Para atualizar, execute `python dados_auxiliares/atualizar_bases.py` após substituir os CSVs. Os CSVs não precisam ser publicados.


## Bibliotecas utilizadas

- Bibliotecas Bootstrap, Pako e SheetJS foram inclusas na pasta `libs` para funcionar localmente.
- A pasta `libs/` contém orientações para migrar as bibliotecas para arquivos locais; **os CDNs permanecem ativos nesta V5** até que as versões exatas sejam obtidas.

## Controles de recolhimento

- Na página inicial, o botão Recolher/Expandir aparece somente depois de os resultados ficarem visíveis.
- Na conferência, o botão aparece somente depois da execução do batimento e recolhe automaticamente o formulário de nomes.

# SIAPE | Formatador + Conferência POLARE (V4)

Projeto estático para uso local ou GitHub Pages. A conferência é específica da Universidade de Brasília.

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

O `.gitignore` exclui todos os `.csv` e `.py`, conforme solicitado. `bases.js` permanece versionado e contém uma cópia dos dados auxiliares, portanto **revise seu conteúdo antes de publicar**. Para atualizar, execute `python dados_auxiliares/atualizar_bases.py` após substituir os CSVs. Os CSVs não precisam ser publicados.

Bibliotecas Bootstrap, Pako e SheetJS usam CDN. O processamento ocorre no navegador.


## V5 — Controles de recolhimento

- Na página inicial, o botão Recolher/Expandir aparece somente depois de os resultados ficarem visíveis.
- Na conferência, o botão aparece somente depois da execução do batimento e recolhe automaticamente o formulário de nomes.
- As regras de processamento e exportação da V4 foram mantidas.
- A pasta `libs/` contém orientações para migrar as bibliotecas para arquivos locais; **os CDNs permanecem ativos nesta V5** até que as versões exatas sejam obtidas.

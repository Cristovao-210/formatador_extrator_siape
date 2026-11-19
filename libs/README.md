# Dependências locais (preparação)

Para operar sem CDN, copie para esta pasta as versões exatas abaixo:

- `bootstrap.min.css` — Bootstrap 5.3.3 (`dist/css/bootstrap.min.css`)
- `pako.min.js` — Pako 2.1.0 (`dist/pako.min.js`)
- `xlsx.full.min.js` — SheetJS 0.18.5 (`dist/xlsx.full.min.js`)

Depois substitua nos HTML as URLs CDN pelos caminhos relativos:

- index.html: `libs/bootstrap.min.css`, `libs/pako.min.js`, `libs/xlsx.full.min.js`
- pages/conferencia.html: `../libs/bootstrap.min.css`, `../libs/xlsx.full.min.js`

As bibliotecas não foram incluídas neste pacote, pois não foi possível obter e verificar as versões exatas nesta sessão. Os links CDN originais foram mantidos para não comprometer as exportações validadas.

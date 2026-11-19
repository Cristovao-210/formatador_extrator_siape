"use strict";
const COLUNAS = [
  "matricula_siape",
  "nome_servidor",
  "grupo_cargo",
  "nome_unidade",
  "sigla_unidade",
  "unidade_macro",
  "nome_siorg",
  "participacao_pgd",
  "codigo_modalidade_pgd",
  "nome_modalidade_pgd",
  "cadastrado_no_polare",
];
const REQUERIDOS = [
  "GR-MATRICULA",
  "IT-NO-SERVIDOR",
  "IT-CO-GRUPO-CARGO-EMPREGO",
  "IT-CO-UORG-LOTACAO-SERVIDOR",
  "IT-CO-TIPO-PGD",
  "IT-IN-PGD",
];
const MODALIDADES = [
  "NAO PARTICIPA DO PGD",
  "PRESENCIAL",
  "TELETRABALHO PARCIAL",
  "TELETRABALHO INTEGRAL",
  "TELE. EXTERIOR (DEC. 11.072/22, ART. 12, VIII - SUBSTITUICAO)",
  "TELE. EXTERIOR (DEC. 11.072/22, ART. 12, §7° - DISCRICIONARIA)",
];
const limpar = (v) => String(v ?? "").trim();
function codigo(v) {
  const s = limpar(v);
  if (!/^\d+$/.test(s)) throw Error("Código numérico inválido: " + s);
  return s.replace(/^0+(?=\d)/, "");
}
function retirarCodigoOrgao(v) {
  const s = limpar(v);
  if (!/^26271\d+$/.test(s))
    throw Error("Identificação fora do padrão UnB (26271): " + s);
  return codigo(s.slice(5));
}
function validarPGD(cols) {
  const faltam = REQUERIDOS.filter((c) => !cols.includes(c));
  if (faltam.length)
    throw Error(
      "Layout incompatível com o extrator PGD. Campos ausentes: " +
        faltam.join(", "),
    );
}
function montarUnidades(bases) {
  const siorg = new Map(bases["UORGS-SIORG"].map((r) => [codigo(r.codigo), r]));
  const cor = new Map(
    bases.correcao_unidades_macro.map((r) => [
      limpar(r.sigla_unidade),
      limpar(r.unidade_macro),
    ]),
  );
  const unidades = new Map();
  for (const r of bases["UORGS-SIAPE"]) {
    const s = siorg.get(codigo(r["IT-CO-UORG-SIORG"]));
    const sigla =
      limpar(s?.sigla_unidade) || limpar(r["IT-SG-UNIDADE-ORGANIZACIONAL"]);
    unidades.set(retirarCodigoOrgao(r["GR-IDENTIFICACAO-UORG"]), {
      nome_unidade:
        limpar(s?.nome_unidade) || limpar(r["IT-NO-UNIDADE-ORGANIZACIONAL"]),
      sigla_unidade: sigla,
      unidade_macro:
        cor.get(sigla) ||
        limpar(s?.unidade_macro) ||
        limpar(r["IT-SG-UNIDADE-ORGANIZACIONAL"]),
      nome_siorg: limpar(s?.sigla_unidade) ? "SIM" : "NAO",
    });
  }
  return unidades;
}
function nomesUnicos(nomes) {
  const linhas = nomes
    .split(/\r\n|\n|\r/)
    .map(limpar)
    .filter(Boolean);
  const unicos = [...new Set(linhas)];
  return {
    unicos,
    repetidos: linhas.length - unicos.length,
    total: linhas.length,
  };
}
function bater(rows, nomes, bases) {
  const unidades = montarUnidades(bases),
    conhecidos = new Set(nomesUnicos(nomes).unicos);
  if (!conhecidos.size) throw Error("Informe pelo menos um nome do POLARE.");
  return rows
    .map((r) => {
      const matricula = retirarCodigoOrgao(r["GR-MATRICULA"]),
        u = codigo(r["IT-CO-UORG-LOTACAO-SERVIDOR"]),
        nome = limpar(r["IT-NO-SERVIDOR"]),
        p = limpar(r["IT-IN-PGD"]),
        m = limpar(r["IT-CO-TIPO-PGD"]).replace(/^0+(?=\d)/, "");
      if (!nome) throw Error("Nome vazio na matrícula " + matricula);
      return {
        matricula_siape: matricula,
        nome_servidor: nome,
        grupo_cargo: limpar(r["IT-CO-GRUPO-CARGO-EMPREGO"]),
        ...(unidades.get(u) || {
          nome_unidade: "",
          sigla_unidade: "",
          unidade_macro: "",
          nome_siorg: "",
        }),
        participacao_pgd: p === "S" ? "SIM" : p === "N" ? "NAO" : p,
        codigo_modalidade_pgd: m,
        nome_modalidade_pgd: MODALIDADES[m] ?? "",
        cadastrado_no_polare: conhecidos.has(nome) ? "SIM" : "NAO",
      };
    })
    .sort((a, b) => a.nome_servidor.localeCompare(b.nome_servidor, "pt-BR"));
}
function calcularMetricas(rows) {
  const count = (p, c) =>
    new Set(
      rows
        .filter(
          (r) =>
            r.participacao_pgd === p && (!c || r.cadastrado_no_polare === c),
        )
        .map((r) => r.matricula_siape),
    ).size;
  return [
    ["Servidores que participam do PGD - SIAPE", count("SIM")],
    ["Servidores que NAO participam do PGD - SIAPE", count("NAO")],
    [
      "Servidores que participam do PGD e estão cadastrados no Polare",
      count("SIM", "SIM"),
    ],
    [
      "Servidores que NAO participam do PGD e NAO estão no Polare",
      count("NAO", "NAO"),
    ],
    [
      "Servidores que NÃO participam do PGD, mas que ESTÃO no Polare",
      count("NAO", "SIM"),
    ],
    [
      "Servidores que participam do PGD, mas que NÃO estão cadastrados no Polare",
      count("SIM", "NAO"),
    ],
  ];
}

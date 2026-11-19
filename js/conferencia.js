"use strict";
let processedRows = [],
  columnNames = [];
function escapeHTML(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
let resultadoConferencia = [];
const confEl = (id) => document.getElementById(id);
function confMessage(text, type = "info") {
  const el = confEl("confMessage");
  el.className = `alert alert-${type} mt-3`;
  el.textContent = text;
  if (!text) el.classList.add("d-none");
}
function mostrarNomes(mostrar) {
  const body = confEl("nomesBody"),
    botao = confEl("toggleNomes");
  body.classList.toggle("d-none", !mostrar);
  botao.textContent = mostrar ? "Recolher" : "Expandir";
  botao.setAttribute("aria-expanded", String(mostrar));
}
confEl("toggleNomes").addEventListener("click", () =>
  mostrarNomes(confEl("nomesBody").classList.contains("d-none")),
);
function resetConferencia() {
  resultadoConferencia = [];
  confEl("confResults").classList.add("d-none");
  confEl("toggleNomes").classList.add("d-none");
  mostrarNomes(true);
  confMessage("");
}
function renderConferencia() {
  const query = confEl("confFilter").value.trim().toLocaleLowerCase("pt-BR");
  const rows = resultadoConferencia.filter((r) =>
    COLUNAS.some((c) =>
      limpar(r[c]).toLocaleLowerCase("pt-BR").includes(query),
    ),
  );
  confEl("confTable").innerHTML =
    "<thead><tr>" +
    COLUNAS.map((c) => `<th>${escapeHTML(c)}</th>`).join("") +
    "</tr></thead><tbody>" +
    rows
      .slice(0, 100)
      .map(
        (r) =>
          "<tr>" +
          COLUNAS.map((c) => `<td>${escapeHTML(r[c] ?? "")}</td>`).join("") +
          "</tr>",
      )
      .join("") +
    "</tbody>";
}
confEl("nomes").addEventListener("input", () => {
  resetConferencia();
  atualizarNomes();
});
function atualizarNomes() {
  const n = nomesUnicos(confEl("nomes").value);
  confEl("nomesCount").textContent =
    `${n.total} linhas preenchidas · ${n.unicos.length} nomes únicos · ${n.repetidos} repetições eliminadas`;
  return n;
}
confEl("dedupBtn").addEventListener("click", () => {
  const n = atualizarNomes();
  confEl("nomes").value = n.unicos.join("\n");
  resetConferencia();
  confEl("nomesCount").textContent =
    `${n.unicos.length} nomes únicos · ${n.repetidos} repetições eliminadas`;
});
confEl("confFilter").addEventListener("input", renderConferencia);
confEl("conferirBtn").addEventListener("click", () => {
  resetConferencia();
  try {
    validarPGD(columnNames);
    const n = atualizarNomes();
    resultadoConferencia = bater(
      processedRows,
      n.unicos.join("\n"),
      window.BASES_UNB,
    );
    confEl("metricas").innerHTML = calcularMetricas(resultadoConferencia)
      .map(
        ([label, n]) =>
          `<div class="col-md-4"><div class="stat-card"><div class="stat-value">${n.toLocaleString("pt-BR")}</div><div class="stat-label">${escapeHTML(label)}</div></div></div>`,
      )
      .join("");
    confEl("confFilter").value = "";
    renderConferencia();
    confEl("confResults").classList.remove("d-none");
    confEl("toggleNomes").classList.remove("d-none");
    mostrarNomes(false);
    const missing = resultadoConferencia.filter((r) => !r.nome_unidade).length,
      invalid = resultadoConferencia.filter(
        (r) =>
          !["SIM", "NAO"].includes(r.participacao_pgd) ||
          !r.nome_modalidade_pgd,
      ).length;
    confMessage(
      `Conferência concluída: ${resultadoConferencia.length} registros. ${missing} sem unidade correspondente; ${invalid} com indicador ou modalidade PGD não reconhecido.`,
      missing || invalid ? "warning" : "success",
    );
  } catch (e) {
    confMessage(e.message, "danger");
  }
});
confEl("exportConf").addEventListener("click", () => {
  if (!resultadoConferencia.length) return;
  if (!window.XLSX) {
    confMessage("Biblioteca Excel não carregada.", "danger");
    return;
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(resultadoConferencia, {
    header: COLUNAS,
  });
  ws["!cols"] = COLUNAS.map((c) => ({
    wch: Math.min(
      65,
      Math.max(
        c.length,
        ...resultadoConferencia.slice(0, 100).map((r) => limpar(r[c]).length),
      ) + 2,
    ),
  }));
  XLSX.utils.book_append_sheet(wb, ws, "dados_brutos");
  const met = XLSX.utils.aoa_to_sheet([
    ["Indicador", "Quantidade"],
    ...calcularMetricas(resultadoConferencia),
  ]);
  met["!cols"] = [{ wch: 85 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, met, "Informações_descritivas");
  const d = new Date();
  const data = [d.getDate(), d.getMonth() + 1, d.getFullYear()]
    .map((n) => String(n).padStart(2, "0"))
    .join("_");
  XLSX.writeFile(wb, data + "_batimento_pgd_siape_polare.xlsx");
  // A solicitação do download foi iniciada. Retorna à página inicial.
  setTimeout(() => window.location.replace("../index.html"), 600);
});

confEl("conferirBtn").disabled = true;
try {
  const bruto = sessionStorage.getItem("siape-polare-transferencia-v4");
  sessionStorage.removeItem("siape-polare-transferencia-v4"); // Exclui imediatamente após leitura.
  if (!bruto)
    throw Error(
      "Dados da sessão não encontrados. Volte ao formatador e processe os arquivos.",
    );
  const dados = JSON.parse(bruto);
  validarPGD(dados.colunas);
  if (!Array.isArray(dados.linhas) || !dados.linhas.length)
    throw Error("Nenhum registro SIAPE recebido.");
  columnNames = dados.colunas;
  processedRows = dados.linhas;
  confEl("origemDados").textContent =
    `${processedRows.length.toLocaleString("pt-BR")} registros SIAPE recebidos.`;
  confEl("conferirBtn").disabled = false;
} catch (err) {
  confMessage(err.message, "warning");
}

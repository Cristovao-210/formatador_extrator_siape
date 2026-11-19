// SIAPE | Formatador de arquivos
// Processamento local de REF.gz e TXT.gz.

const PREVIEW_LIMIT = 100;

let processedRows = [];
let layoutColumns = [];
let columnNames = [];

const refInput = document.getElementById("refFile");
const txtInput = document.getElementById("txtFile");
const processBtn = document.getElementById("processBtn");
const messageBox = document.getElementById("message");
const resultsSection = document.getElementById("resultsSection");

refInput.addEventListener("change", () => handleFileSelection(refInput, "REF", "refInfo"));
txtInput.addEventListener("change", () => handleFileSelection(txtInput, "TXT", "txtInfo"));
processBtn.addEventListener("click", processFiles);
document.getElementById("csvBtn").addEventListener("click", exportCSV);
document.getElementById("xlsxBtn").addEventListener("click", exportXLSX);
document.getElementById("filterInput").addEventListener("input", renderPreview);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasExpectedFileName(file, kind) {
  if (!file) return false;
  // Aceita, por exemplo, EAUNBPO.REF.gz ou simplesmente REF.gz.
  const pattern = new RegExp(`(?:^|[._-])${kind}\\.gz$`, "i");
  return pattern.test(file.name.trim());
}

function handleFileSelection(input, expectedKind, infoId) {
  const file = input.files[0];
  const info = document.getElementById(infoId);
  input.classList.remove("is-valid", "is-invalid");

  if (!file) {
    info.textContent = "Nenhum arquivo selecionado";
    return;
  }

  info.textContent = `${file.name} · ${formatBytes(file.size)}`;

  if (hasExpectedFileName(file, expectedKind)) {
    input.classList.add("is-valid");
  } else {
    input.classList.add("is-invalid");
    setMessage(
      `Arquivo incorreto no campo ${expectedKind}: "${file.name}". Selecione um arquivo ${expectedKind}.gz.`,
      "warning"
    );
  }
}

function setMessage(text, type = "info") {
  messageBox.className = `alert alert-${type} mt-3 mb-0`;
  messageBox.textContent = text;
}

function setLoading(isLoading) {
  processBtn.disabled = isLoading;
  document.querySelector(".btn-label").textContent = isLoading
    ? "Processando..."
    : "Processar arquivos";
  document.getElementById("processSpinner").classList.toggle("d-none", !isLoading);
  document.getElementById("progressWrap").classList.toggle("d-none", !isLoading);
}

function updateProgress(percent) {
  document.getElementById("progressBar").style.width = `${percent}%`;
}

async function decompressGzip(file) {
  const compressed = await file.arrayBuffer();

  // Confere a assinatura GZIP (1F 8B), além da extensão do arquivo.
  const signature = new Uint8Array(compressed, 0, Math.min(2, compressed.byteLength));
  if (signature.length !== 2 || signature[0] !== 0x1f || signature[1] !== 0x8b) {
    throw new Error(`O arquivo "${file.name}" não possui conteúdo GZIP válido.`);
  }

  if ("DecompressionStream" in window) {
    try {
      const stream = new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
      return await new Response(stream).text();
    } catch (error) {
      // Tenta Pako como alternativa caso a API nativa falhe.
    }
  }

  if (window.pako) {
    const bytes = window.pako.ungzip(new Uint8Array(compressed));
    return new TextDecoder("utf-8").decode(bytes);
  }

  throw new Error("Não foi possível descompactar o arquivo. Verifique a conexão e tente novamente.");
}

/*
 * Interpreta linhas do REF.
 *
 * Exemplos:
 *   CAMPO-ALFA X 010  -> 10 posições
 *   CAMPO-VALOR N 13,2 -> 13 dígitos inteiros + 2 decimais = 15 posições
 *
 * O nome do campo mantém a convenção do script Python original:
 * espaços no nome são removidos.
 */
function parseLayout(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const columns = [];

  for (const originalLine of lines) {
    if (!originalLine.trim()) continue;

    const match = originalLine.trim().match(/^(.+?)\s+([A-Z])\s*(\d+)(?:,(\d+))?\s*$/i);

    if (!match) {
      throw new Error(`Não foi possível interpretar esta linha do REF: "${originalLine}"`);
    }

    const name = match[1].replace(/\s+/g, "").trim();
    const type = match[2].toUpperCase();
    const integerDigits = Number.parseInt(match[3], 10);
    const decimals = match[4] ? Number.parseInt(match[4], 10) : 0;

    if (!name || !Number.isInteger(integerDigits) || integerDigits <= 0 ||
        !Number.isInteger(decimals) || decimals < 0) {
      throw new Error(`Definição inválida no REF: "${originalLine}"`);
    }

    // Para N 13,2: 13 posições da parte inteira + 2 casas decimais.
    const width = integerDigits + decimals;

    columns.push({
      name,
      type,
      integerDigits,
      decimals,
      width
    });
  }

  if (columns.length === 0) {
    throw new Error("O arquivo REF está vazio ou não contém campos válidos.");
  }

  const duplicateNames = columns
    .map(column => column.name)
    .filter((name, index, names) => names.indexOf(name) !== index);

  if (duplicateNames.length) {
    throw new Error(`O REF contém nomes de campos repetidos: ${[...new Set(duplicateNames)].join(", ")}`);
  }

  return columns;
}

/*
 * Aplica casas decimais sem usar ponto flutuante.
 * Ex.: "000000000012345", com 2 casas -> "123,45".
 * O valor permanece como texto para preservar todos os dígitos.
 */
function applyDecimalScale(rawValue, column) {
  const value = String(rawValue ?? "").trim();

  if (!value || column.decimals === 0 || column.type !== "N") {
    return value;
  }

  let digits = value;
  let sign = "";

  if (digits.startsWith("-") || digits.startsWith("+")) {
    sign = digits[0] === "-" ? "-" : "";
    digits = digits.slice(1);
  }

  // Não altera conteúdos alfanuméricos ou formatos inesperados.
  if (!/^\d+$/.test(digits)) return value;

  // Campos numéricos podem vir preenchidos à esquerda com zeros ou espaços.
  digits = digits.padStart(column.width, "0");

  const integerPartRaw = digits.slice(0, column.integerDigits);
  const decimalPart = digits.slice(column.integerDigits, column.width);
  const integerPart = integerPartRaw.replace(/^0+(?=\d)/, "") || "0";

  return `${sign}${integerPart},${decimalPart.padEnd(column.decimals, "0")}`;
}

// Divide cada registro pelas posições físicas calculadas no REF.
function parseData(text, columns) {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const lines = normalizedText.split(/\r?\n/);

  if (lines.length && lines[lines.length - 1] === "") lines.pop();

  const rows = [];
  let shortRows = 0;
  let longRows = 0;
  const expectedWidth = columns.reduce((sum, column) => sum + column.width, 0);

  for (const line of lines) {
    if (line === "") continue;

    const row = {};
    let cursor = 0;

    for (const column of columns) {
      const rawValue = line.slice(cursor, cursor + column.width);
      row[column.name] = applyDecimalScale(rawValue, column);
      cursor += column.width;
    }

    if (line.length < expectedWidth) shortRows++;
    if (line.length > expectedWidth) longRows++;

    rows.push(row);
  }

  return { rows, shortRows, longRows, expectedWidth };
}

function looksLikeLayoutContent(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return false;

  const matches = lines.filter(line =>
    /^.+?\s+[A-Z]\s*\d+(?:,\d+)?\s*$/i.test(line.trim())
  );

  return matches.length >= Math.max(1, Math.ceil(lines.length * 0.8));
}

async function processFiles() {
  const refFile = refInput.files[0];
  const txtFile = txtInput.files[0];

  if (!refFile || !txtFile) {
    setMessage("Selecione os dois arquivos: REF.gz e TXT.gz.", "warning");
    return;
  }

  if (!hasExpectedFileName(refFile, "REF")) {
    setMessage(`O primeiro arquivo precisa ser o REF.gz. Arquivo selecionado: "${refFile.name}".`, "danger");
    refInput.classList.add("is-invalid");
    return;
  }

  if (!hasExpectedFileName(txtFile, "TXT")) {
    setMessage(`O segundo arquivo precisa ser o TXT.gz. Arquivo selecionado: "${txtFile.name}".`, "danger");
    txtInput.classList.add("is-invalid");
    return;
  }

  setLoading(true);
  resultsSection.classList.add("d-none");
  messageBox.classList.add("d-none");
  document.getElementById("processHint").textContent = "Lendo e descompactando os arquivos...";
  updateProgress(10);

  try {
    const [layoutText, dataText] = await Promise.all([
      decompressGzip(refFile),
      decompressGzip(txtFile)
    ]);

    updateProgress(40);

    if (looksLikeLayoutContent(dataText)) {
      throw new Error("O arquivo selecionado como TXT parece ser um arquivo de layout REF. Confira os arquivos selecionados.");
    }

    layoutColumns = parseLayout(layoutText);
    columnNames = layoutColumns.map(column => column.name);

    document.getElementById("processHint").textContent = "Separando os campos e aplicando as casas decimais...";
    await new Promise(resolve => setTimeout(resolve, 20));

    const result = parseData(dataText, layoutColumns);

    if (result.rows.length === 0) {
      throw new Error("O TXT foi lido, mas não contém registros para processar.");
    }

    // Se todas as linhas forem menores que o layout, é provável que o arquivo
    // selecionado não corresponda ao REF informado.
    if (result.shortRows === result.rows.length) {
      throw new Error(
        `Os registros do TXT têm menos de ${result.expectedWidth} caracteres, que é o tamanho total calculado pelo REF. Confira se os arquivos pertencem ao mesmo extrator.`
      );
    }

    processedRows = result.rows;
    updateProgress(100);

    renderResults(result);
    resultsSection.classList.remove("d-none");

    const warnings = [];
    if (result.shortRows) warnings.push(`${result.shortRows} registro(s) menores que o tamanho esperado`);
    if (result.longRows) warnings.push(`${result.longRows} registro(s) maiores que o tamanho esperado`);

    const warningText = warnings.length ? ` Atenção: ${warnings.join("; ")}.` : "";
    setMessage(
      `Processamento concluído: ${processedRows.length.toLocaleString("pt-BR")} registro(s) e ${columnNames.length} campo(s).${warningText}`,
      warnings.length ? "warning" : "success"
    );
    document.getElementById("processHint").textContent = "Arquivos processados com sucesso.";
  } catch (error) {
    processedRows = [];
    layoutColumns = [];
    columnNames = [];
    setMessage(error.message || "Ocorreu um erro durante o processamento.", "danger");
    document.getElementById("processHint").textContent = "Não foi possível concluir o processamento.";
  } finally {
    setLoading(false);
  }
}

function renderResults(result) {
  document.getElementById("resultSummary").textContent =
    `${processedRows.length.toLocaleString("pt-BR")} registros · ${columnNames.length} campos`;

  document.getElementById("stats").innerHTML = `
    <div class="col-6 col-md-3"><div class="stat-card"><div class="stat-value">${processedRows.length.toLocaleString("pt-BR")}</div><div class="stat-label">Registros processados</div></div></div>
    <div class="col-6 col-md-3"><div class="stat-card"><div class="stat-value">${columnNames.length}</div><div class="stat-label">Campos identificados</div></div></div>
    <div class="col-6 col-md-3"><div class="stat-card"><div class="stat-value">${result.shortRows.toLocaleString("pt-BR")}</div><div class="stat-label">Registros menores que ${result.expectedWidth} caracteres</div></div></div>
    <div class="col-6 col-md-3"><div class="stat-card"><div class="stat-value">${result.longRows.toLocaleString("pt-BR")}</div><div class="stat-label">Registros maiores que ${result.expectedWidth} caracteres</div></div></div>
  `;
  renderPreview();
}

function renderPreview() {
  const query = document.getElementById("filterInput").value.trim().toLocaleLowerCase("pt-BR");
  const filtered = processedRows.filter(row =>
    columnNames.some(name => String(row[name] ?? "").toLocaleLowerCase("pt-BR").includes(query))
  );
  const preview = filtered.slice(0, PREVIEW_LIMIT);
  const table = document.getElementById("resultTable");

  table.querySelector("thead").innerHTML =
    `<tr>${columnNames.map(name => `<th scope="col">${escapeHTML(name)}</th>`).join("")}</tr>`;

  table.querySelector("tbody").innerHTML = preview.map(row =>
    `<tr>${columnNames.map(name => `<td title="${escapeHTML(row[name] ?? "")}">${escapeHTML(row[name] ?? "")}</td>`).join("")}</tr>`
  ).join("");

  document.getElementById("previewCount").textContent =
    `Exibindo ${preview.length} de ${filtered.length.toLocaleString("pt-BR")} resultado(s)${filtered.length > PREVIEW_LIMIT ? ` · limite de ${PREVIEW_LIMIT} linhas` : ""}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  if (!processedRows.length) return;

  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [
    columnNames.map(quote).join(";"),
    ...processedRows.map(row => columnNames.map(name => quote(row[name])).join(";"))
  ];

  downloadBlob(
    new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }),
    "dados_siape.csv"
  );
  setTimeout(() => window.location.reload(), 600);
}

function exportXLSX() {
  if (!processedRows.length) return;
  if (!window.XLSX) {
    setMessage("A biblioteca de Excel não foi carregada. Verifique sua conexão e tente novamente.", "danger");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(processedRows, { header: columnNames });
  worksheet["!cols"] = columnNames.map(name => ({
    wch: Math.min(
      Math.max(name.length, ...processedRows.slice(0, 100).map(row => String(row[name] ?? "").length)) + 2,
      45
    )
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Dados SIAPE");
  XLSX.writeFile(workbook, "dados_siape.xlsx");
  setTimeout(() => window.location.reload(), 600);
}

// Recolhe o formulário de upload para dar destaque à prévia após o processamento.
const uploadBody = document.getElementById('uploadBody');
const toggleUpload = document.getElementById('toggleUpload');
function mostrarUpload(mostrar) {
 uploadBody.classList.toggle('d-none', !mostrar);
 toggleUpload.textContent = mostrar ? 'Recolher' : 'Expandir';
 toggleUpload.setAttribute('aria-expanded', String(mostrar));
}
toggleUpload.addEventListener('click', () => mostrarUpload(uploadBody.classList.contains('d-none')));
const observadorResultado = new MutationObserver(() => {
 const visivel = !resultsSection.classList.contains('d-none');
 toggleUpload.classList.toggle('d-none', !visivel);
 if (visivel) mostrarUpload(false);
 else mostrarUpload(true);
});
observadorResultado.observe(resultsSection, {attributes:true, attributeFilter:['class']});

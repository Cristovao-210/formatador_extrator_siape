"use strict";
const CHAVE_TRANSFERENCIA = "siape-polare-transferencia-v4";
document.getElementById("conferenciaBtn").addEventListener("click", () => {
  const campos = [
    "GR-MATRICULA",
    "IT-NO-SERVIDOR",
    "IT-CO-GRUPO-CARGO-EMPREGO",
    "IT-CO-UORG-LOTACAO-SERVIDOR",
    "IT-CO-TIPO-PGD",
    "IT-IN-PGD",
  ];
  const faltam = campos.filter((c) => !columnNames.includes(c));
  if (faltam.length || !processedRows.length) {
    setMessage(
      faltam.length
        ? "Layout PGD incompatível. Campos ausentes: " + faltam.join(", ")
        : "Processe os arquivos primeiro.",
      "warning",
    );
    return;
  }
  try {
    const dados = {
      colunas: campos,
      linhas: processedRows.map((r) =>
        Object.fromEntries(campos.map((c) => [c, r[c]])),
      ),
    };
    sessionStorage.setItem(CHAVE_TRANSFERENCIA, JSON.stringify(dados));
    window.location.assign("pages/conferencia.html");
  } catch (err) {
    try {
      sessionStorage.removeItem(CHAVE_TRANSFERENCIA);
    } catch (_) {}
    setMessage(
      "Não foi possível transferir os dados pelo armazenamento de sessão. Verifique se há espaço disponível ou abra o projeto por um servidor local. Detalhes: " +
        err.message,
      "danger",
    );
  }
});

// Utilidades CSV (puras + descarga en navegador).

function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value)
  // Si tiene coma, comillas o salto de línea, se envuelve en comillas y se
  // duplican las comillas internas.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

// Convierte una matriz de filas (la primera suele ser el encabezado) en CSV.
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")
}

// Construye varias secciones con título en un solo CSV.
export function buildCsvSections(
  sections: { title: string; rows: (string | number)[][] }[],
): string {
  return sections
    .map((s) => [escapeCell(s.title), toCsv(s.rows)].join("\r\n"))
    .join("\r\n\r\n")
}

// Dispara la descarga de un archivo CSV en el navegador.
export function downloadCsv(filename: string, content: string) {
  if (typeof document === "undefined") return
  // BOM para que Excel reconozca UTF-8 (acentos).
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

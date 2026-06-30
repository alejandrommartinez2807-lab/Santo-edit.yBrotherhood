#!/usr/bin/env node
// ============================================================
// RE-MARCA DE COLORES — Santo Edit (plantilla llave en mano)
// ------------------------------------------------------------
// Reemplaza la paleta de colores en todo src/ por la del cliente.
// Uso:
//   1) Edita brand-colors.json (los valores "nuevo").
//   2) node scripts/rebrand-colors.mjs
//   3) Revisa con: npm run dev
//
// Reemplaza: colores hex, sus sombras rgba(r,g,b,..) y las clases de
// Tailwind del acento (yellow-300/200/100). Es seguro: solo cambia
// literales de color, no la lógica. Hazlo sobre una copia limpia del
// cliente (no re-ejecutes a medias).
//
// Flags:
//   --dry   muestra qué cambiaría sin escribir.
// ============================================================

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { join, dirname, extname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(root, "src")
const DRY = process.argv.includes("--dry")

const palette = JSON.parse(readFileSync(join(root, "brand-colors.json"), "utf8"))

function hexToRgb(hex) {
  const m = String(hex).trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Construir la lista de reemplazos (old -> new), de más específico a menos.
const replacements = []
for (const key of Object.keys(palette)) {
  if (key.startsWith("_")) continue
  const { actual, nuevo } = palette[key]
  if (!actual || !nuevo || actual === nuevo) continue

  // 1) sombras rgba con el triplete del color (solo para hex)
  const oldRgb = hexToRgb(actual)
  const newRgb = hexToRgb(nuevo)
  if (oldRgb && newRgb) {
    // admite espacios opcionales: rgba(160, 0, 0
    const re = new RegExp(
      `(rgba?\\(\\s*)${oldRgb[0]}\\s*,\\s*${oldRgb[1]}\\s*,\\s*${oldRgb[2]}(\\s*[,)])`,
      "gi",
    )
    replacements.push({ re, to: `$1${newRgb[0]},${newRgb[1]},${newRgb[2]}$2`, label: `${key} rgba` })
  }

  // 2) el literal en sí (hex o clase de Tailwind como yellow-300)
  const esc = actual.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  replacements.push({ re: new RegExp(esc, "g"), to: nuevo, label: key })
}

if (replacements.length === 0) {
  console.log("No hay cambios: edita los valores 'nuevo' en brand-colors.json primero.")
  process.exit(0)
}

const EXTS = new Set([".ts", ".tsx", ".css", ".js", ".jsx"])
const files = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (EXTS.has(extname(p))) files.push(p)
  }
})(SRC)

let totalFiles = 0
let totalHits = 0
for (const file of files) {
  let s = readFileSync(file, "utf8")
  const before = s
  let hits = 0
  for (const { re, to } of replacements) {
    s = s.replace(re, (...m) => {
      hits++
      // soportar grupos de captura en el reemplazo
      return to.replace(/\$(\d)/g, (_, d) => m[Number(d)] ?? "")
    })
  }
  if (s !== before) {
    totalFiles++
    totalHits += hits
    if (!DRY) writeFileSync(file, s)
    console.log(`${DRY ? "[dry] " : ""}${file.replace(root + "\\", "").replace(root + "/", "")} → ${hits}`)
  }
}

console.log(
  `\n${DRY ? "[dry] " : ""}Listo: ${totalHits} reemplazos en ${totalFiles} archivos.` +
    (DRY ? " (sin escribir)" : " Revisa con: npm run dev"),
)

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { stripBillRequestMarker } from "../openAccountBillRequest"

// Fitness function (QA ronda 2026-07-27, hallazgo B1): el marcador
// [CUENTA_PEDIDA:<ISO>] viaja DENTRO de la nota de la cuenta abierta porque
// "pedir la cuenta" se hizo sin migración. La API sirve la nota en crudo, así
// que cada sitio que la enseña a un humano tiene que limpiarla con
// stripBillRequestMarker. El panel lo hacía; el ticket 80mm no, y salía
// impreso "Nota de cuenta: ... [CUENTA_PEDIDA:2026-07-27T04:53:31.853Z]".
//
// Esta prueba recorre el código de pantalla y falla si alguien vuelve a
// renderizar la nota de una cuenta sin limpiarla.

const SRC = join(process.cwd(), "src")

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue
      collectFiles(full, out)
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      out.push(full)
    }
  }
  return out
}

// Renderizar la nota de una cuenta: {account.note}, {openAccount.note}, etc.
const RENDER_PATTERN = /\{\s*(\w*[Aa]ccount)\.note\s*\}/g

describe("marcador de 'pedir la cuenta' · nunca se escapa a una pantalla", () => {
  const files = collectFiles(SRC)

  it("el helper limpia el marcador y respeta el resto de la nota", () => {
    const nota = "Sin cebolla [pedido con corchetes] [CUENTA_PEDIDA:2026-07-27T04:53:31.853Z]"
    expect(stripBillRequestMarker(nota)).toBe("Sin cebolla [pedido con corchetes]")
    expect(stripBillRequestMarker(null)).toBe("")
  })

  it("ningún archivo renderiza la nota de una cuenta sin pasarla por stripBillRequestMarker", () => {
    const offenders: string[] = []

    for (const file of files) {
      const source = readFileSync(file, "utf8")
      const matches = [...source.matchAll(RENDER_PATTERN)]
      if (!matches.length) continue
      if (source.includes("stripBillRequestMarker")) continue

      const relative = file.slice(process.cwd().length + 1)
      offenders.push(`${relative} → ${matches.map((m) => m[0]).join(", ")}`)
    }

    expect(
      offenders,
      `Estos archivos pintan la nota de una cuenta abierta en crudo, así que el marcador ` +
        `[CUENTA_PEDIDA:...] se le imprime al cliente. Envuélvela en stripBillRequestMarker(...):\n` +
        offenders.join("\n"),
    ).toEqual([])
  })
})

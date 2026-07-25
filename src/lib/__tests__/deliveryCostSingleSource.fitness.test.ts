import { readFileSync, readdirSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { describe, expect, it } from "vitest"

// Fitness function (auditoría 2026-07-24, H8): el costo de delivery tiene UNA
// sola fuente (lib/localOrderHelpers.getOrderDeliveryCost — la cotización
// guardada del pedido, que el servidor calcula por sede). La vieja tabla fija
// de zonas de Valencia se eliminó DOS veces (P3 en 2026-07-23 y H8 en
// 2026-07-24) porque vivía copiada en varias pantallas: si los nombres de las
// zonas hardcodeadas reaparecen en el código, este test lo caza.

const SRC = resolve(__dirname, "..", "..")
// El antipatrón exacto de las copias: cobrar según el NOMBRE de la zona
// (normalizedZone.includes("trigalena") → return 2). Las semillas del editor
// de zonas (DEFAULT_DELIVERY_ZONES) son legítimas y no disparan esto.
const FORBIDDEN =
  /includes\(\s*["'](trigalena|prebo|naguanagua|samanes|san diego)["']\s*\)/i

function collectSourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue
      found.push(...collectSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
      found.push(full)
    }
  }
  return found
}

describe("Delivery · una sola fuente del costo de envío", () => {
  it("ninguna pantalla vuelve a hardcodear la tabla de zonas de Valencia", () => {
    const offenders: string[] = []

    for (const file of collectSourceFiles(SRC)) {
      const source = readFileSync(file, "utf8")
      if (FORBIDDEN.test(source)) {
        offenders.push(relative(SRC, file))
      }
    }

    expect(
      offenders,
      "La tabla fija de zonas de delivery reapareció en: " +
        offenders.join(", ") +
        ". El costo de envío SOLO puede salir de la cotización guardada del pedido " +
        "(lib/localOrderHelpers.getOrderDeliveryCost / lib/localOrderMoney.getOrderTotals).",
    ).toEqual([])
  })
})

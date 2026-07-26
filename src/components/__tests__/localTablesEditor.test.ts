import { describe, expect, it } from "vitest"
import { getBusyTablesLost, normalizeTableKey } from "@/components/local/LocalTablesEditor"

// El editor de mesas vive en el módulo "Mesas y QR" y guarda por sede. Como
// pedidos, cuentas abiertas y QR se relacionan por el NOMBRE de la mesa,
// renombrar o quitar una mesa ocupada deja su cuenta colgando de un nombre que
// ya no existe: caja deja de verla en esa mesa y el mapa no la encuentra.

describe("normalizeTableKey", () => {
  it("compara igual que el servidor: sin acentos, sin mayúsculas y sin espacios de sobra", () => {
    expect(normalizeTableKey("  Terraza Nº2 ")).toBe("terraza nº2")
    expect(normalizeTableKey("Mesá 1")).toBe(normalizeTableKey("mesa 1"))
  })
})

describe("getBusyTablesLost", () => {
  const loaded = ["Mesa 1", "Mesa 2", "Terraza"]

  it("deja pasar cuando ninguna mesa ocupada desaparece", () => {
    expect(getBusyTablesLost(loaded, ["Mesa 1", "Mesa 2", "Terraza", "Barra"], ["Mesa 2"])).toEqual(
      [],
    )
  })

  it("detecta la mesa ocupada que se RENOMBRA", () => {
    expect(getBusyTablesLost(loaded, ["Mesa 1", "Mesa dos", "Terraza"], ["Mesa 2"])).toEqual([
      "Mesa 2",
    ])
  })

  it("detecta la mesa ocupada que se QUITA", () => {
    expect(getBusyTablesLost(loaded, ["Mesa 1", "Mesa 2"], ["Terraza"])).toEqual(["Terraza"])
  })

  it("no bloquea por renombrar una mesa LIBRE", () => {
    expect(getBusyTablesLost(loaded, ["Mesa 1", "Mesa 2", "Patio"], ["Mesa 1"])).toEqual([])
  })

  it("los acentos y las mayúsculas no cuentan como cambio de nombre", () => {
    expect(getBusyTablesLost(["Terráza"], ["TERRAZA"], ["Terraza"])).toEqual([])
  })

  it("sin mesas ocupadas nunca bloquea", () => {
    expect(getBusyTablesLost(loaded, [], [])).toEqual([])
  })
})

import { describe, it, expect } from "vitest"
import { buildBrandThemeCss } from "@/lib/theme"

describe("buildBrandThemeCss", () => {
  it("devuelve vacío si no hay colores válidos", () => {
    expect(buildBrandThemeCss({})).toBe("")
    expect(buildBrandThemeCss({ primary: "no-hex" })).toBe("")
  })

  it("genera variables y triplete rgb para el color principal", () => {
    const css = buildBrandThemeCss({ primary: "#1d4ed8" })
    expect(css).toContain("--brand-primary:#1d4ed8")
    expect(css).toContain("--brand-primary-rgb:29, 78, 216")
    expect(css).toContain("--brand-primary-dark:")
    // Tema oscuro: los --brand-ink* (texto claro) ya NO se derivan del primary;
    // viven fijos en globals.css para no oscurecer el texto sobre el fondo negro.
    expect(css).not.toContain("--brand-ink:")
  })

  it("incluye acento y fondo cuando se proveen", () => {
    const css = buildBrandThemeCss({ accent: "#22c55e", cream: "#f8fafc" })
    expect(css).toContain("--brand-accent:#22c55e")
    expect(css).toContain("--brand-accent-rgb:")
    expect(css).toContain("--brand-cream:#f8fafc")
  })

  it("solo sobrescribe lo provisto", () => {
    const css = buildBrandThemeCss({ cream: "#ffffff" })
    expect(css).toContain("--brand-cream:#ffffff")
    expect(css).not.toContain("--brand-primary:")
  })
})

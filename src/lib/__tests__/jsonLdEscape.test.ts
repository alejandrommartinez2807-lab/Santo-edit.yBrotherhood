import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Auditoría 2026-08-02 · XSS almacenado en el JSON-LD del layout raíz.
//
// El bloque schema.org se inyecta con dangerouslySetInnerHTML en el <head> de
// TODAS las páginas. JSON.stringify escapa comillas, pero NO "</script>": si el
// dueño escribía eso en la descripción del negocio o en la etiqueta de
// ubicación —campos normales de Configuración— la etiqueta se cerraba y lo que
// viniera detrás se ejecutaba en todo el sitio, incluido el panel.

const LAYOUT = join(__dirname, "..", "..", "app", "layout.tsx")

describe("el JSON-LD no puede cerrar su propia etiqueta", () => {
  it("el layout escapa < > & al serializar", () => {
    const source = readFileSync(LAYOUT, "utf8")

    expect(source).toMatch(/\\\\u003c/)
    expect(source).toMatch(/\\\\u003e/)
    expect(source).toMatch(/\\\\u0026/)
  })

  it("el escape aplicado deja inofensivo un intento real", () => {
    // Misma transformación que hace el layout.
    const escapar = (value: string) =>
      JSON.stringify({ description: value })
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")

    const ataque = '</script><script>alert(1)</script>'
    const salida = escapar(ataque)

    expect(salida).not.toContain("</script>")
    expect(salida).not.toContain("<script>")
    // Y sigue siendo JSON válido que devuelve el texto original.
    expect(JSON.parse(salida).description).toBe(ataque)
  })

  it("el contenido normal no se rompe", () => {
    const escapar = (value: string) =>
      JSON.stringify({ description: value })
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")

    const texto = "Smash burgers, papas & bebidas frías"
    expect(JSON.parse(escapar(texto)).description).toBe(texto)
  })
})

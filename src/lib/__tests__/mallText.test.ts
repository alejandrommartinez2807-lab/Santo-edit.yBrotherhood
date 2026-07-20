import { describe, it, expect } from "vitest"
import { slugify, normalizeSearch } from "@/lib/mallText"

describe("slugify", () => {
  it("pasa nombres con acentos a slug limpio", () => {
    expect(slugify("Capitán Grill")).toBe("capitan-grill")
    expect(slugify("Fígaro Barbiere")).toBe("figaro-barbiere")
    expect(slugify("María Paleta")).toBe("maria-paleta")
  })

  it("colapsa separadores y recorta guiones extremos", () => {
    expect(slugify("  Óptica   Visión!!  ")).toBe("optica-vision")
    expect(slugify("--Beco--")).toBe("beco")
    expect(slugify("A & B / C")).toBe("a-b-c")
  })

  it("maneja vacío, null y sólo símbolos", () => {
    expect(slugify("")).toBe("")
    // @ts-expect-error probamos entrada no-string en runtime
    expect(slugify(null)).toBe("")
    // @ts-expect-error probamos entrada no-string en runtime
    expect(slugify(undefined)).toBe("")
    expect(slugify("!!!")).toBe("")
    expect(slugify("###@@@")).toBe("")
  })

  it("recorta a 60 caracteres", () => {
    const s = slugify("x".repeat(200))
    expect(s.length).toBe(60)
  })

  it("es idempotente (slug de un slug = el mismo)", () => {
    const a = slugify("Joyería El Diamante 24k")
    expect(slugify(a)).toBe(a)
  })

  it("no deja mayúsculas ni espacios", () => {
    const s = slugify("TecnoStore MÓVIL 2026")
    expect(s).toBe(s.toLowerCase())
    expect(s.includes(" ")).toBe(false)
  })
})

describe("normalizeSearch", () => {
  it("ignora acentos y mayúsculas", () => {
    expect(normalizeSearch("Farmácia")).toBe("farmacia")
    expect(normalizeSearch("  ÓPTICA ")).toBe("optica")
  })

  it("permite match por inclusión sin acentos", () => {
    const hay = normalizeSearch("Farmacia SaludYa Planta baja")
    expect(hay.includes(normalizeSearch("saludya"))).toBe(true)
    expect(hay.includes(normalizeSearch("SALUD"))).toBe(true)
  })

  it("maneja entradas vacías o no-string", () => {
    expect(normalizeSearch("")).toBe("")
    // @ts-expect-error runtime
    expect(normalizeSearch(null)).toBe("")
  })
})

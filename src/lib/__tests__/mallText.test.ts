import { describe, it, expect } from "vitest"
import { slugify, normalizeSearch, externalUrl, instagramUrl, digitsOnly } from "@/lib/mallText"

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

describe("externalUrl", () => {
  it("respeta http(s) existentes", () => {
    expect(externalUrl("https://tienda.com")).toBe("https://tienda.com")
    expect(externalUrl("http://tienda.com")).toBe("http://tienda.com")
  })
  it("antepone https si falta protocolo", () => {
    expect(externalUrl("tienda.com")).toBe("https://tienda.com")
    expect(externalUrl("www.tienda.com/x")).toBe("https://www.tienda.com/x")
  })
  it("neutraliza esquemas peligrosos (no deja javascript: en el href)", () => {
    expect(externalUrl("javascript:alert(1)").startsWith("https://")).toBe(true)
    expect(externalUrl("javascript:alert(1)")).not.toMatch(/^javascript:/i)
    expect(externalUrl("data:text/html,x").startsWith("https://")).toBe(true)
  })
  it("vacío → vacío", () => {
    expect(externalUrl("")).toBe("")
    expect(externalUrl("   ")).toBe("")
  })
})

describe("instagramUrl", () => {
  it("arma la URL desde @usuario o usuario", () => {
    expect(instagramUrl("@capitangrill")).toBe("https://instagram.com/capitangrill")
    expect(instagramUrl("capitangrill")).toBe("https://instagram.com/capitangrill")
  })
  it("respeta una URL completa", () => {
    expect(instagramUrl("https://instagram.com/x")).toBe("https://instagram.com/x")
  })
  it("neutraliza javascript:", () => {
    expect(instagramUrl("javascript:alert(1)")).not.toMatch(/^javascript:/i)
  })
  it("vacío → vacío", () => {
    expect(instagramUrl("")).toBe("")
  })
})

describe("digitsOnly", () => {
  it("deja sólo dígitos", () => {
    expect(digitsOnly("+58 412-111.22.33")).toBe("584121112233")
    expect(digitsOnly("abc")).toBe("")
    // @ts-expect-error runtime
    expect(digitsOnly(null)).toBe("")
  })
})

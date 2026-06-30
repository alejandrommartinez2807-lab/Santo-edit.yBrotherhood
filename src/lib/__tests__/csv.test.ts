import { describe, it, expect } from "vitest"
import { toCsv, buildCsvSections } from "@/lib/csv"

describe("toCsv", () => {
  it("une celdas y filas", () => {
    expect(toCsv([["a", "b"], [1, 2]])).toBe("a,b\r\n1,2")
  })

  it("escapa comas, comillas y saltos de línea", () => {
    expect(toCsv([["hola, mundo"]])).toBe('"hola, mundo"')
    expect(toCsv([['dice "hola"']])).toBe('"dice ""hola"""')
    expect(toCsv([["línea1\nlínea2"]])).toBe('"línea1\nlínea2"')
  })
})

describe("buildCsvSections", () => {
  it("concatena secciones con título", () => {
    const out = buildCsvSections([
      { title: "Resumen", rows: [["total", 10]] },
      { title: "Productos", rows: [["nombre", "cant"], ["Hot Dog", 3]] },
    ])
    expect(out).toContain("Resumen")
    expect(out).toContain("total,10")
    expect(out).toContain("Productos")
    expect(out).toContain("Hot Dog,3")
  })
})

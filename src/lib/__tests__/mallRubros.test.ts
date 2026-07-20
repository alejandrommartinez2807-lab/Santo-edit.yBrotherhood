import { describe, it, expect } from "vitest"
import { rubroOf, filterStores, rubroCounts, RUBRO } from "@/lib/mallRubros"

const S = (commercial_name: string, activity: string, floor = "PB") => ({ commercial_name, activity, floor })

const stores = [
  S("Capitán Grill Burger", "comida", "Feria"),
  S("María Paleta", "comida", "Feria"),
  S("Beco", "moda", "PB"),
  S("Farmacia SaludYa", "salud", "PB"),
  S("Óptica Visión", "salud", "PB"),
  S("Kiosco Sin Rubro", "", "PB"),
]

describe("rubroOf", () => {
  it("devuelve el rubro conocido", () => {
    expect(rubroOf("comida").label).toBe("Gastronomía")
    expect(rubroOf("salud")).toBe(RUBRO.salud)
  })
  it("cae a 'otro' para rubro desconocido o vacío", () => {
    expect(rubroOf("")).toBe(RUBRO.otro)
    expect(rubroOf("xyz")).toBe(RUBRO.otro)
  })
})

describe("filterStores", () => {
  it("sin filtro ('todos', sin query) devuelve todos", () => {
    expect(filterStores(stores, "", "todos")).toHaveLength(stores.length)
  })
  it("filtra por rubro", () => {
    const r = filterStores(stores, "", "comida")
    expect(r).toHaveLength(2)
    expect(r.every((s) => s.activity === "comida")).toBe(true)
  })
  it("busca por nombre ignorando acentos y mayúsculas", () => {
    expect(filterStores(stores, "optica", "todos")).toHaveLength(1)
    expect(filterStores(stores, "CAPITAN", "todos")[0].commercial_name).toBe("Capitán Grill Burger")
  })
  it("busca por etiqueta de rubro", () => {
    // "gastronomia" es la etiqueta de 'comida'
    expect(filterStores(stores, "gastronomia", "todos")).toHaveLength(2)
  })
  it("combina rubro + texto", () => {
    expect(filterStores(stores, "maria", "comida")).toHaveLength(1)
    expect(filterStores(stores, "beco", "comida")).toHaveLength(0)
  })
  it("un local sin rubro cae en 'otro'", () => {
    expect(filterStores(stores, "", "otro")).toHaveLength(1)
  })
  it("query sin coincidencias devuelve vacío", () => {
    expect(filterStores(stores, "zzzz", "todos")).toHaveLength(0)
  })
})

describe("rubroCounts", () => {
  it("cuenta por rubro y ordena descendente", () => {
    const c = rubroCounts(stores)
    // comida(2) y salud(2) primero, luego moda(1) y otro(1)
    expect(c[0].count).toBe(2)
    const map = Object.fromEntries(c.map((x) => [x.key, x.count]))
    expect(map.comida).toBe(2)
    expect(map.salud).toBe(2)
    expect(map.moda).toBe(1)
    expect(map.otro).toBe(1)
  })
  it("lista vacía → sin rubros", () => {
    expect(rubroCounts([])).toHaveLength(0)
  })
})

import { describe, it, expect } from "vitest"
import {
  addBillRequestMarker,
  getBillRequestedAt,
  stripBillRequestMarker,
} from "@/lib/openAccountBillRequest"

const STAMP = "2026-07-27T20:15:00.000Z"

describe("marcador de 'pedir la cuenta' en la nota", () => {
  it("pone y lee la hora de la petición", () => {
    const note = addBillRequestMarker("Cliente frecuente", STAMP)
    expect(getBillRequestedAt(note)).toBe(STAMP)
  })

  it("es idempotente: la segunda petición conserva la hora original", () => {
    const first = addBillRequestMarker("", STAMP)
    const second = addBillRequestMarker(first, "2026-07-27T21:00:00.000Z")
    expect(getBillRequestedAt(second)).toBe(STAMP)
  })

  it("la nota se muestra limpia, sin el marcador", () => {
    const note = addBillRequestMarker("Sin cebolla en todo", STAMP)
    expect(stripBillRequestMarker(note)).toBe("Sin cebolla en todo")
  })

  it("sin marcador: no hay petición y la nota queda igual", () => {
    expect(getBillRequestedAt("nota normal")).toBe("")
    expect(stripBillRequestMarker("nota normal")).toBe("nota normal")
  })

  it("una nota vacía con petición no inventa texto alrededor", () => {
    const note = addBillRequestMarker("", STAMP)
    expect(stripBillRequestMarker(note)).toBe("")
  })

  it("un marcador con basura adentro no cuenta como petición", () => {
    expect(getBillRequestedAt("[CUENTA_PEDIDA:no-es-fecha]")).toBe("")
  })
})

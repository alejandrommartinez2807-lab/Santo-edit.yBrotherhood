import { describe, expect, it } from "vitest"
import {
  getActivePublicBranches,
  resolvePreferredPublicBranchId,
} from "@/lib/publicBranchSelection"

const sedeCentro = { id: "sede-centro", isActive: true }
const sedeNorte = { id: "sede-norte", isActive: true }
const sedeCerrada = { id: "sede-cerrada", isActive: false }

describe("resolvePreferredPublicBranchId (Fase 3 flujo cliente)", () => {
  it("con varias sedes y sin preferencia previa, el cliente debe elegir", () => {
    expect(resolvePreferredPublicBranchId([sedeCentro, sedeNorte], [])).toBe("")
    expect(
      resolvePreferredPublicBranchId([sedeCentro, sedeNorte], ["", null, undefined]),
    ).toBe("")
  })

  it("con una sola sede activa se auto-selecciona", () => {
    expect(resolvePreferredPublicBranchId([sedeCentro], [])).toBe("sede-centro")
    expect(resolvePreferredPublicBranchId([sedeCentro, sedeCerrada], [])).toBe(
      "sede-centro",
    )
  })

  it("respeta la preferencia (URL o guardada) si corresponde a una sede activa", () => {
    expect(
      resolvePreferredPublicBranchId([sedeCentro, sedeNorte], ["sede-norte"]),
    ).toBe("sede-norte")
    // La URL manda sobre lo guardado en el dispositivo.
    expect(
      resolvePreferredPublicBranchId(
        [sedeCentro, sedeNorte],
        ["sede-norte", "sede-centro"],
      ),
    ).toBe("sede-norte")
  })

  it("ignora preferencias inválidas o de sedes inactivas", () => {
    expect(
      resolvePreferredPublicBranchId([sedeCentro, sedeNorte], ["sede-fantasma"]),
    ).toBe("")
    expect(
      resolvePreferredPublicBranchId(
        [sedeCentro, sedeNorte, sedeCerrada],
        ["sede-cerrada"],
      ),
    ).toBe("")
  })
})

describe("getActivePublicBranches", () => {
  it("filtra inactivas, entradas sin id y valores que no son lista", () => {
    expect(
      getActivePublicBranches([sedeCentro, sedeCerrada, { id: "" }, null]),
    ).toEqual([sedeCentro])
    expect(getActivePublicBranches(undefined)).toEqual([])
  })
})

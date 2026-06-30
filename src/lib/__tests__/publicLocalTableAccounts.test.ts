import { describe, expect, it } from "vitest"
import {
  cleanPublicTableText,
  findOpenAccountForPublicTable,
  getActivePublicLocalTables,
  hasOpenAccountForPublicTable,
  normalizePublicTableLookup,
  resolvePublicLocalTable,
} from "@/lib/publicLocalTableAccounts"
import type { LocalTable, OpenAccount } from "@/lib/orders"

function makeTable(overrides: Partial<LocalTable> = {}): LocalTable {
  return {
    id: "mesa-1",
    name: "Mesa 1",
    area: "Principal",
    sortOrder: 1,
    isActive: true,
    ...overrides,
  }
}

function makeOpenAccount(overrides: Partial<OpenAccount> = {}): OpenAccount {
  return {
    id: "account-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    tableNumber: "Mesa 1",
    customerName: "Mesa 1",
    status: "Abierta",
    orderIds: [],
    totalEstimatedUSD: 0,
    totalCollectedUSD: 0,
    pendingUSD: 0,
    ...overrides,
  }
}

describe("publicLocalTableAccounts", () => {
  it("limpia textos públicos de mesa igual que las rutas", () => {
    expect(cleanPublicTableText(" Mesa 1 ")).toBe("Mesa 1")
    expect(cleanPublicTableText(null)).toBe("")
  })

  it("normaliza búsquedas ignorando acentos, símbolos, mayúsculas y espacios", () => {
    expect(normalizePublicTableLookup("  Mésa # 01  ")).toBe("mesa 01")
    expect(normalizePublicTableLookup("Barra--VIP")).toBe("barra vip")
    expect(normalizePublicTableLookup(undefined)).toBe("")
  })

  it("filtra mesas inactivas sin reordenar ni cambiar las activas", () => {
    const activeA = makeTable({ id: "a", name: "Mesa A", isActive: true })
    const inactive = makeTable({ id: "b", name: "Mesa B", isActive: false })
    const activeWithoutFlag = makeTable({
      id: "c",
      name: "Mesa C",
      isActive: undefined as unknown as boolean,
    })

    expect(getActivePublicLocalTables([activeA, inactive, activeWithoutFlag])).toEqual([
      activeA,
      activeWithoutFlag,
    ])
  })

  it("resuelve una mesa pública por nombre o por id", () => {
    const tables = [
      makeTable({ id: "mesa-terraza", name: "Mesa Terraza" }),
      makeTable({ id: "barra", name: "Barra" }),
    ]

    expect(resolvePublicLocalTable("mesa terraza", tables)?.id).toBe("mesa-terraza")
    expect(resolvePublicLocalTable("BARRA", tables)?.name).toBe("Barra")
    expect(resolvePublicLocalTable("mesa inexistente", tables)).toBeNull()
    expect(resolvePublicLocalTable(" ", tables)).toBeNull()
  })

  it("encuentra cuenta abierta por mesa usando la misma normalización", () => {
    const accounts = [
      makeOpenAccount({ id: "account-1", tableNumber: "Mesa Á" }),
      makeOpenAccount({ id: "account-2", tableNumber: "Barra" }),
    ]

    expect(findOpenAccountForPublicTable(accounts, "mesa a")?.id).toBe("account-1")
    expect(hasOpenAccountForPublicTable(accounts, "BARRA")).toBe(true)
    expect(findOpenAccountForPublicTable(accounts, "Mesa C")).toBeNull()
    expect(hasOpenAccountForPublicTable(accounts, " ")).toBe(false)
  })
})

import { describe, it, expect } from "vitest"
import {
  HOUSEKEEPING_TASK_STATUSES,
  HOUSEKEEPING_TASK_TYPES,
  normalizeTaskStatus,
  normalizeTaskType,
} from "../ordersHousekeeping"

describe("housekeeping tasks", () => {
  it("normaliza el tipo de tarea (fallback a salida)", () => {
    expect(normalizeTaskType("salida")).toBe("salida")
    expect(normalizeTaskType("ESTANCIA")).toBe("estancia")
    expect(normalizeTaskType(" Inspeccion ")).toBe("inspeccion")
    expect(normalizeTaskType("mantenimiento")).toBe("mantenimiento")
    expect(normalizeTaskType("")).toBe("salida")
    expect(normalizeTaskType("cualquier-cosa")).toBe("salida")
    expect(normalizeTaskType(undefined)).toBe("salida")
  })

  it("normaliza el estado de tarea (fallback a pendiente)", () => {
    expect(normalizeTaskStatus("pendiente")).toBe("pendiente")
    expect(normalizeTaskStatus("EN_PROCESO")).toBe("en_proceso")
    expect(normalizeTaskStatus("hecha")).toBe("hecha")
    expect(normalizeTaskStatus("")).toBe("pendiente")
    expect(normalizeTaskStatus("desconocido")).toBe("pendiente")
  })

  it("expone los catálogos de tipos y estados", () => {
    expect(HOUSEKEEPING_TASK_TYPES).toContain("salida")
    expect(HOUSEKEEPING_TASK_STATUSES).toEqual(["pendiente", "en_proceso", "hecha"])
  })
})

// BH-SIM-004 (semana real, Día 6): el rastro del faltante estaba a medias.
// Cuando el stock alcanza para PARTE del pedido, el movimiento queda con
// "(faltaron N unidades)". Pero cuando el stock ya está EXACTAMENTE en 0, el
// bucle hacía `break` antes de insertar nada: la venta desaparecía del
// historial de inventario (repro: 5 unidades vendidas con stock 0 → 0
// movimientos; evidencia en SIM-SEMANA/bugs.md).
//
// Este test fija la decisión de qué movimiento corresponde a cada caso.
import { describe, expect, it } from "vitest"
import { buildConsumptionMovement } from "@/lib/inventoryShortage"

describe("buildConsumptionMovement (BH-SIM-004)", () => {
  it("consumo normal: mueve lo pedido y no habla de faltantes", () => {
    const m = buildConsumptionMovement({ previousQuantity: 10, requested: 3, unit: "unidades", reason: "Consumo automático por pedido" })
    expect(m.moved).toBe(3)
    expect(m.finalQuantity).toBe(7)
    expect(m.shortage).toBe(0)
    expect(m.reason).toBe("Consumo automático por pedido")
    expect(m.shouldRecord).toBe(true)
  })

  it("faltante PARCIAL: mueve lo que hay y deja el faltante en el motivo", () => {
    const m = buildConsumptionMovement({ previousQuantity: 1, requested: 3, unit: "unidades", reason: "Consumo automático por pedido" })
    expect(m.moved).toBe(1)
    expect(m.finalQuantity).toBe(0)
    expect(m.shortage).toBe(2)
    expect(m.reason).toBe("Consumo automático por pedido (faltaron 2 unidades)")
    expect(m.shouldRecord).toBe(true)
  })

  it("faltante TOTAL (stock ya en 0): se REGISTRA igual, con movimiento 0 y el faltante completo", () => {
    const m = buildConsumptionMovement({ previousQuantity: 0, requested: 5, unit: "unidades", reason: "Consumo automático por pedido" })
    expect(m.moved).toBe(0)
    expect(m.finalQuantity).toBe(0)
    expect(m.shortage).toBe(5)
    expect(m.reason).toBe("Consumo automático por pedido (faltaron 5 unidades)")
    // Lo importante: la venta NO puede desaparecer del historial.
    expect(m.shouldRecord).toBe(true)
    // Y no requiere tocar la fila del insumo (ya está en 0).
    expect(m.needsStockUpdate).toBe(false)
  })

  it("cantidades fraccionadas conservan precisión", () => {
    const m = buildConsumptionMovement({ previousQuantity: 0.05, requested: 0.2, unit: "kg", reason: "Consumo automático por pedido" })
    expect(m.moved).toBe(0.05)
    expect(m.finalQuantity).toBe(0)
    expect(m.shortage).toBe(0.15)
    expect(m.reason).toContain("faltaron 0.15 kg")
  })

  it("pedir 0 no genera movimiento (no hay nada que contar)", () => {
    const m = buildConsumptionMovement({ previousQuantity: 5, requested: 0, unit: "unidades", reason: "x" })
    expect(m.shouldRecord).toBe(false)
  })
})

// BH-SIM-004: qué movimiento de inventario corresponde a cada consumo,
// incluido el caso en que el stock ya está en cero.
//
// El sistema NO deja el stock en negativo (decisión de negocio: una nevera no
// tiene −15 refrescos). Para que eso no borre información, un faltante debe
// quedar SIEMPRE registrado. Hasta ahora solo se registraba el faltante
// PARCIAL (había 1, se pidieron 3 → movimiento de −1 con "faltaron 2"); con el
// stock exactamente en 0 el consumo no dejaba ninguna fila y la venta
// desaparecía del historial de inventario.

const round4 = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000

export type ConsumptionMovementPlan = {
  /** Unidades que realmente salen del stock (0 si no había nada). */
  moved: number
  /** Stock que queda tras el movimiento (nunca negativo). */
  finalQuantity: number
  /** Unidades que el pedido necesitaba y no había. */
  shortage: number
  /** Motivo final del movimiento, con el faltante si lo hubo. */
  reason: string
  /** ¿Hay que insertar la fila de movimiento? (la venta nunca es invisible) */
  shouldRecord: boolean
  /** ¿Hay que tocar la fila del insumo? (con stock 0 no hace falta) */
  needsStockUpdate: boolean
}

export function buildConsumptionMovement(input: {
  previousQuantity: number
  requested: number
  unit: string
  reason: string
}): ConsumptionMovementPlan {
  const previousQuantity = Math.max(0, Number(input.previousQuantity) || 0)
  const requested = Math.max(0, Number(input.requested) || 0)
  const moved = round4(Math.min(previousQuantity, requested))
  const finalQuantity = round4(previousQuantity - moved)
  const shortage = round4(Math.max(0, requested - moved))
  const unit = String(input.unit || "").trim()

  return {
    moved,
    finalQuantity,
    shortage,
    reason: shortage > 0 ? `${input.reason} (faltaron ${shortage} ${unit})`.trim() : input.reason,
    shouldRecord: requested > 0,
    needsStockUpdate: moved > 0,
  }
}

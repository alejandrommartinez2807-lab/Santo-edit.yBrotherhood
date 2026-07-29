// Lectura del candado optimista que manda caja en el cobro directo.
// BH-SIM-003: `updateOrderPaymentInStore` implementa el candado
// (`expectedPrevious`) y lo usan /api/open-accounts y la revisión de
// comprobantes, pero PATCH /api/orders/:id/payment nunca lo propagaba: dos
// cajeros con tarjetas desactualizadas se pisaban el cobro y el pago ya
// registrado desaparecía del pedido.

export type ExpectedPreviousPayment = {
  amountReceivedUSD: number
  amountReceivedVES: number
}

function roundMoney(value: unknown) {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.round((parsed + Number.EPSILON) * 100) / 100
}

export function readExpectedPrevious(body: Record<string, unknown>): ExpectedPreviousPayment | undefined {
  const source =
    body?.payment && typeof body.payment === "object"
      ? (body.payment as Record<string, unknown>)
      : body

  const raw = source?.expectedPrevious

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined

  const lock = raw as Record<string, unknown>

  return {
    amountReceivedUSD: roundMoney(lock.amountReceivedUSD),
    amountReceivedVES: roundMoney(lock.amountReceivedVES),
  }
}

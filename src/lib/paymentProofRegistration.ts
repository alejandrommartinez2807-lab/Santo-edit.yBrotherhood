// Verificación de pagos reportados (pago móvil, Zelle, etc.): al marcar un
// comprobante "Confirmado por caja" se intenta registrar el cobro real en el
// pedido con los datos reportados. Reglas de seguridad:
//   - Nunca pisa un cobro existente (updateOrderPayment REEMPLAZA montos):
//     si el pedido ya tiene algo recibido, se salta y Caja ajusta a mano.
//   - Sin montos reportados no hay nada que registrar.
// La decisión es pura para poder testearla sin Supabase.

export type ProofPaymentData = {
  reportedMethod: string
  amountReportedUSD: number
  amountReportedVES: number
  paymentReference: string
}

export type OrderPaymentSnapshot = {
  amountReceivedUSD: number
  amountReceivedVES: number
}

export type ProofPaymentDecision =
  | {
      ok: true
      payment: {
        amountReceivedUSD: number
        amountReceivedVES: number
        paymentMethodUSD: string
        paymentMethodVES: string
        deliveryPaymentIn: "Divisas" | "Bolívares" | "Mixto"
        paymentNote: string
      }
    }
  | { ok: false; reason: string }

function toMoney(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

export function buildPaymentFromProof(
  proof: ProofPaymentData,
  currentPayment: OrderPaymentSnapshot | null,
): ProofPaymentDecision {
  if (!currentPayment) {
    return {
      ok: false,
      reason: "No se encontró el pedido del comprobante; registra el cobro desde Caja.",
    }
  }

  if (toMoney(currentPayment.amountReceivedUSD) > 0 || toMoney(currentPayment.amountReceivedVES) > 0) {
    return {
      ok: false,
      reason: "El pedido ya tiene un cobro registrado; ajústalo desde Caja si hace falta.",
    }
  }

  const amountUSD = toMoney(proof.amountReportedUSD)
  const amountVES = toMoney(proof.amountReportedVES)

  if (amountUSD <= 0 && amountVES <= 0) {
    return {
      ok: false,
      reason: "El comprobante no indica monto; registra el cobro desde Caja.",
    }
  }

  const reportedMethod = String(proof.reportedMethod || "").trim()
  const reference = String(proof.paymentReference || "").trim()

  return {
    ok: true,
    payment: {
      amountReceivedUSD: amountUSD,
      amountReceivedVES: amountVES,
      // El método reportado es texto libre del carrito ("Pago móvil Banesco
      // 0412...", "Zelle correo@..."); la normalización a las opciones de
      // Caja la hace updateOrderPayment. Solo se asigna al lado con monto.
      paymentMethodUSD: amountUSD > 0 ? reportedMethod || "Otro" : "",
      paymentMethodVES: amountVES > 0 ? reportedMethod || "Otro" : "",
      deliveryPaymentIn: amountUSD > 0 && amountVES > 0 ? "Mixto" : amountVES > 0 ? "Bolívares" : "Divisas",
      paymentNote: reference
        ? `Cobro verificado por comprobante · Ref ${reference}`
        : "Cobro verificado por comprobante",
    },
  }
}

// Verificación de pagos reportados (pago móvil, Zelle, etc.): al marcar un
// comprobante "Confirmado por caja" se intenta registrar el cobro real en el
// pedido con los datos reportados. Reglas de seguridad:
//   - Nunca pisa un cobro existente (updateOrderPayment REEMPLAZA montos):
//     si el pedido ya tiene algo recibido, se salta y Caja ajusta a mano.
//   - Sin montos reportados no hay nada que registrar.
//   - La foto de los billetes (efectivo) NUNCA registra cobro: el efectivo se
//     recibe en persona y lo registra caja.
// La decisión es pura para poder testearla sin Supabase.

import { isCashReportedMethod } from "@/lib/orderPaymentLegs"

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

  // Foto de los billetes (pata en efectivo): confirmarla solo valida que el
  // efectivo existe — el dinero se entrega EN PERSONA y ese cobro lo registra
  // caja al recibirlo. Registrarlo aquí marcaba "Pagado" un efectivo que aún
  // no llegó (fix lote v9).
  if (isCashReportedMethod(proof.reportedMethod)) {
    return {
      ok: false,
      reason:
        "La foto del efectivo no registra cobro: ese dinero se recibe en persona y lo registra Caja al cobrarlo.",
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

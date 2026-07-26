// Verificación de pagos reportados (pago móvil, Zelle, etc.): al marcar un
// comprobante "Confirmado por caja" se intenta registrar el cobro real en el
// pedido con los datos reportados. Reglas de seguridad:
//   - NUNCA pisa dinero ya cobrado (updateOrderPayment REEMPLAZA los montos,
//     no los suma): un comprobante solo puede rellenar una moneda que esté
//     en cero. Si choca con una que ya tiene dinero, se salta y Caja ajusta.
//   - Sin montos reportados no hay nada que registrar.
//   - La foto de los billetes (efectivo) NUNCA registra cobro: el efectivo se
//     recibe en persona y lo registra caja.
// La decisión es pura para poder testearla sin Supabase.
//
// Pago mixto de dos patas electrónicas (decisión del dueño, 2026-07-26):
// llegan DOS comprobantes, uno por pata. Antes el segundo se rechazaba entero
// ("el pedido ya tiene un cobro registrado") y había que cuadrarlo a mano en
// cada pedido mixto. Ahora se SUMA, pero solo cuando su moneda está libre
// (pago móvil en Bs + Zelle en $). Dos patas de la MISMA moneda (pago móvil +
// transferencia, las dos en Bs) siguen sin tocarse: ahí no hay forma de
// distinguir un abono legítimo de una doble confirmación.
//
// Efecto secundario buscado: como cada moneda solo se puede rellenar cuando
// está en cero, confirmar dos veces el MISMO comprobante nunca duplica el
// cobro — la segunda vez choca consigo mismo y se rechaza.

import { isCashReportedMethod } from "@/lib/orderPaymentLegs"
import { formatUSD, formatVES } from "@/utils/formatCurrency"

export type ProofPaymentData = {
  reportedMethod: string
  amountReportedUSD: number
  amountReportedVES: number
  paymentReference: string
}

export type OrderPaymentSnapshot = {
  amountReceivedUSD: number
  amountReceivedVES: number
  // Lo ya registrado en cada moneda: al sumar la segunda pata hay que
  // conservarlo, porque updateOrderPayment reescribe el registro completo.
  paymentMethodUSD?: string
  paymentMethodVES?: string
  paymentNote?: string
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

  const amountUSD = toMoney(proof.amountReportedUSD)
  const amountVES = toMoney(proof.amountReportedVES)

  if (amountUSD <= 0 && amountVES <= 0) {
    return {
      ok: false,
      reason: "El comprobante no indica monto; registra el cobro desde Caja.",
    }
  }

  const currentUSD = toMoney(currentPayment.amountReceivedUSD)
  const currentVES = toMoney(currentPayment.amountReceivedVES)
  const hasPreviousPayment = currentUSD > 0 || currentVES > 0

  // Choque: el comprobante trae dinero en una moneda que YA tiene cobro. No se
  // puede saber si es la otra pata de un mixto o una confirmación repetida, así
  // que no se toca el dinero y se le dice a Caja exactamente qué sumar.
  if (hasPreviousPayment) {
    const collidingParts = [
      amountUSD > 0 && currentUSD > 0
        ? `${formatUSD(currentUSD)} en divisas (este comprobante trae ${formatUSD(amountUSD)})`
        : "",
      amountVES > 0 && currentVES > 0
        ? `Bs ${formatVES(currentVES)} en bolívares (este comprobante trae Bs ${formatVES(amountVES)})`
        : "",
    ].filter(Boolean)

    if (collidingParts.length > 0) {
      return {
        ok: false,
        reason: `El pedido ya tiene cobrado ${collidingParts.join(" y ")}. No se toca para no pisarlo: si es un pago aparte, súmalo a mano desde Caja.`,
      }
    }
  }

  const reportedMethod = String(proof.reportedMethod || "").trim()
  const reference = String(proof.paymentReference || "").trim()
  const isMergingSecondLeg = hasPreviousPayment

  // Suma solo sobre la moneda que estaba libre; la otra se conserva tal cual
  // (updateOrderPayment reescribe el registro entero, así que hay que
  // devolverlo completo o el cobro anterior se perdería).
  const nextUSD = toMoney(currentUSD + amountUSD)
  const nextVES = toMoney(currentVES + amountVES)
  const previousNote = String(currentPayment.paymentNote || "").trim()
  const proofNote = isMergingSecondLeg
    ? `Segunda parte del pago mixto verificada por comprobante${reference ? ` · Ref ${reference}` : ""}`
    : `Cobro verificado por comprobante${reference ? ` · Ref ${reference}` : ""}`

  return {
    ok: true,
    payment: {
      amountReceivedUSD: nextUSD,
      amountReceivedVES: nextVES,
      // El método reportado es texto libre del carrito ("Pago móvil Banesco
      // 0412...", "Zelle correo@..."); la normalización a las opciones de
      // Caja la hace updateOrderPayment. Solo se asigna al lado con monto, y
      // el lado que ya venía cobrado conserva SU método.
      paymentMethodUSD:
        amountUSD > 0
          ? reportedMethod || "Otro"
          : currentUSD > 0
            ? String(currentPayment.paymentMethodUSD || "").trim()
            : "",
      paymentMethodVES:
        amountVES > 0
          ? reportedMethod || "Otro"
          : currentVES > 0
            ? String(currentPayment.paymentMethodVES || "").trim()
            : "",
      deliveryPaymentIn: nextUSD > 0 && nextVES > 0 ? "Mixto" : nextVES > 0 ? "Bolívares" : "Divisas",
      paymentNote:
        isMergingSecondLeg && previousNote ? `${previousNote} · ${proofNote}` : proofNote,
    },
  }
}

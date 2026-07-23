// Patas de pago de un pedido, derivadas de order.payment_method + totales.
// Fuente única para: precargar el REPORTE de pago del cliente (montos por
// método), precargar el COBRO en caja, y validar que lo reportado cubra el
// total. Entiende el método único ("Pago móvil", "Zelle"…) y el compuesto
// "Mixto: <método> Bs 1.234,56 + <método> $10.00" que arma el carrito
// (formatVES es-VE y formatUSD en-US; el símbolo público puede ser $ o €).

import { isVesPaymentMethod } from "@/lib/paymentOptions"

export type OrderPaymentLeg = {
  method: string
  currency: "USD" | "VES"
  // Monto en la moneda de la pata (Bs para VES, $ para USD).
  amount: number
  // Efectivo se entrega en mano: no se reporta con captura/referencia.
  isCash: boolean
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function isCashMethod(method: string) {
  return method
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .includes("efectivo")
}

// "1.234,56" (es-VE) → 1234.56. Tolera también "1234.56" sin miles.
function parseVesAmount(raw: string): number {
  const text = raw.trim()
  if (!text) return 0
  const normalized = /,\d{1,2}$/.test(text)
    ? text.replace(/\./g, "").replace(",", ".")
    : text.replace(/,/g, "")
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? round2(value) : 0
}

// "1,234.56" (en-US) → 1234.56.
function parseUsdAmount(raw: string): number {
  const text = raw.trim().replace(/,/g, "")
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? round2(value) : 0
}

export function getOrderPaymentLegs(input: {
  paymentMethod: unknown
  totalUSD: number
  exchangeRate: number
}): OrderPaymentLeg[] {
  const raw = String(input.paymentMethod || "").trim()
  const totalUSD = round2(Number(input.totalUSD) || 0)
  const rate = Number(input.exchangeRate) || 0

  if (!raw || /por confirmar/i.test(raw)) return []

  if (/^mixto\b/i.test(raw)) {
    const body = raw.replace(/^mixto:?\s*/i, "")
    const legs: OrderPaymentLeg[] = []

    for (const part of body.split(" + ")) {
      // Pata Bs: "<método> Bs 1.234,56" · pata divisas: "<método> $10.00"
      // (o "€10.00" si el dueño eligió el símbolo €; el valor sigue en USD).
      const vesMatch = part.match(/^(.*?)\s+Bs\s*([\d.,]+)/i)
      const usdMatch = part.match(/^(.*?)\s*[$€]\s*([\d.,]+)/)

      if (vesMatch) {
        const method = vesMatch[1].trim()
        const amount = parseVesAmount(vesMatch[2])
        if (method && amount > 0) {
          legs.push({ method, currency: "VES", amount, isCash: isCashMethod(method) })
        }
      } else if (usdMatch) {
        const method = usdMatch[1].trim()
        const amount = parseUsdAmount(usdMatch[2])
        if (method && amount > 0) {
          legs.push({ method, currency: "USD", amount, isCash: isCashMethod(method) })
        }
      }
    }

    return legs
  }

  // Método único: el monto es el total del pedido en la moneda del método.
  if (totalUSD <= 0) return []

  if (isVesPaymentMethod(raw)) {
    if (rate <= 0) return []
    return [
      { method: raw, currency: "VES", amount: round2(totalUSD * rate), isCash: isCashMethod(raw) },
    ]
  }

  return [{ method: raw, currency: "USD", amount: totalUSD, isCash: isCashMethod(raw) }]
}

// Equivalente en USD de una lista de patas.
export function sumLegsUSD(legs: OrderPaymentLeg[], exchangeRate: number): number {
  const rate = Number(exchangeRate) || 0
  return round2(
    legs.reduce((total, leg) => {
      if (leg.currency === "USD") return total + leg.amount
      return rate > 0 ? total + leg.amount / rate : total
    }, 0),
  )
}

// Lo que el cliente DEBE reportar con captura/referencia: las patas
// electrónicas (el efectivo se entrega en mano). Sin patas identificables se
// exige el total del pedido; si TODO es efectivo, no hay nada que reportar.
export function getRequiredReportUSD(input: {
  paymentMethod: unknown
  totalUSD: number
  exchangeRate: number
}): number {
  const legs = getOrderPaymentLegs(input)
  if (legs.length === 0) return round2(Number(input.totalUSD) || 0)

  const electronicLegs = legs.filter((leg) => !leg.isCash)
  if (electronicLegs.length === 0) return 0

  return sumLegsUSD(electronicLegs, input.exchangeRate)
}

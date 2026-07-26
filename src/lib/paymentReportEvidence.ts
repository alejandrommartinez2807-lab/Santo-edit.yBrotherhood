// Qué hace falta para que un reporte de pago del cliente pueda enviarse.
//
// Existe porque la regla cambió el 2026-07-26 (pedido del dueño): antes había
// UNA captura y UNA referencia para todo el reporte, así que en un pago mixto
// "Pago móvil + Zelle" una sola captura daba por reportadas LAS DOS patas y
// caja se quedaba sin cómo verificar la otra mitad. Ahora cada pago necesita
// SU captura o SU referencia.
//
// Vive fuera del componente para poder probarlo: la pantalla de reporte no
// tenía ni un test, y la falla anterior (una rama que no se ejecutaba nunca)
// se coló justamente por eso.

import { isCashReportedMethod } from "@/lib/orderPaymentLegs"

// Con 3-4 dígitos caja no puede ubicar la operación en el banco (dueño
// 2026-07-21).
export const MIN_REFERENCE_DIGITS = 6

export type ReportLeg = {
  method: string
  // Montos ya normalizados, en la moneda de la pata.
  usd: number
  ves: number
  dataUrl: string
  reference: string
}

export type ReportProblem = {
  kind: "sin-monto" | "solo-efectivo" | "falta-evidencia" | "referencia-corta"
  // Método de la pata con el problema (vacío cuando no aplica a una en
  // concreto): sirve para que el error diga CUÁL falta.
  method: string
}

export type PaymentReportPlan<T extends ReportLeg = ReportLeg> = {
  // Patas que de verdad se transfieren y viajan como comprobante. El efectivo
  // se entrega en persona: ni se reporta ni cuenta como cobertura.
  electronicLegs: T[]
  problem: ReportProblem | null
}

function hasEvidence(leg: ReportLeg): boolean {
  return Boolean(leg.dataUrl) || leg.reference.trim().length > 0
}

function referenceDigits(leg: ReportLeg): number {
  return leg.reference.replace(/[^0-9]/g, "").length
}

// Genérica para que quien la llame conserve sus propios campos (el formulario
// arrastra el índice y el nombre del archivo en cada pata).
export function planPaymentReport<T extends ReportLeg>(legs: T[]): PaymentReportPlan<T> {
  const electronicLegs = legs.filter(
    (leg) => !isCashReportedMethod(leg.method) && (leg.usd > 0 || leg.ves > 0),
  )

  if (electronicLegs.length === 0) {
    const onlyCash =
      legs.length > 0 && legs.every((leg) => isCashReportedMethod(leg.method))

    return {
      electronicLegs,
      problem: { kind: onlyCash ? "solo-efectivo" : "sin-monto", method: "" },
    }
  }

  const withoutEvidence = electronicLegs.find((leg) => !hasEvidence(leg))
  if (withoutEvidence) {
    return {
      electronicLegs,
      problem: { kind: "falta-evidencia", method: withoutEvidence.method },
    }
  }

  const withShortReference = electronicLegs.find(
    (leg) => leg.reference.trim() && referenceDigits(leg) < MIN_REFERENCE_DIGITS,
  )
  if (withShortReference) {
    return {
      electronicLegs,
      problem: { kind: "referencia-corta", method: withShortReference.method },
    }
  }

  return { electronicLegs, problem: null }
}

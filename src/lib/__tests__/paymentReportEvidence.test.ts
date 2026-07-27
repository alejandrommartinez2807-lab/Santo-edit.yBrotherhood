// Evidencia POR PATA del reporte de pago (pedido del dueño 2026-07-26).
// Hasta ayer el reporte tenía UNA captura y UNA referencia para todo: en un
// mixto "Pago móvil + Zelle" con una sola captura el pago se daba por
// reportado completo y caja no tenía cómo verificar la otra mitad.
import { describe, expect, it } from "vitest"
import {
  isLegEvidenceComplete,
  planPaymentReport,
  type ReportLeg,
} from "@/lib/paymentReportEvidence"

const leg = (patch: Partial<ReportLeg> = {}): ReportLeg => ({
  method: "Pago móvil",
  usd: 0,
  ves: 1660.2,
  dataUrl: "",
  reference: "",
  ...patch,
})

const pagoMovil = (patch: Partial<ReportLeg> = {}) => leg(patch)
const zelle = (patch: Partial<ReportLeg> = {}) =>
  leg({ method: "Zelle", usd: 14.5, ves: 0, ...patch })

describe("mixto de dos patas electrónicas", () => {
  it("con la captura de UNA sola: no envía y nombra la que falta", () => {
    const plan = planPaymentReport([
      pagoMovil({ dataUrl: "data:image/jpeg;base64,AAA" }),
      zelle(),
    ])
    expect(plan.problem).toEqual({ kind: "falta-evidencia", method: "Zelle" })
  })

  it("con la captura de la OTRA sola: nombra la primera", () => {
    const plan = planPaymentReport([
      pagoMovil(),
      zelle({ dataUrl: "data:image/jpeg;base64,AAA" }),
    ])
    expect(plan.problem).toEqual({
      kind: "falta-evidencia",
      method: "Pago móvil",
    })
  })

  it("con una sola referencia escrita: tampoco envía", () => {
    const plan = planPaymentReport([pagoMovil({ reference: "123456" }), zelle()])
    expect(plan.problem?.kind).toBe("falta-evidencia")
  })

  it("captura de la pata 1 + referencia de la pata 2: envía OK", () => {
    const plan = planPaymentReport([
      pagoMovil({ dataUrl: "data:image/jpeg;base64,AAA" }),
      zelle({ reference: "123456789" }),
    ])
    expect(plan.problem).toBeNull()
    expect(plan.electronicLegs).toHaveLength(2)
  })

  it("y al revés (referencia en la 1, captura en la 2): también envía", () => {
    const plan = planPaymentReport([
      pagoMovil({ reference: "987654321" }),
      zelle({ dataUrl: "data:image/jpeg;base64,AAA" }),
    ])
    expect(plan.problem).toBeNull()
  })

  it("la referencia se valida POR CADA pata (6 dígitos)", () => {
    const plan = planPaymentReport([
      pagoMovil({ reference: "123456" }),
      zelle({ reference: "4821" }),
    ])
    expect(plan.problem).toEqual({ kind: "referencia-corta", method: "Zelle" })
  })
})

describe("mixto efectivo + electrónico", () => {
  it("exige UNA evidencia: la del pago que sí se transfiere", () => {
    const legs = [
      leg({ method: "Efectivo en divisas", usd: 20, ves: 0 }),
      pagoMovil({ dataUrl: "data:image/jpeg;base64,AAA" }),
    ]
    const plan = planPaymentReport(legs)
    expect(plan.problem).toBeNull()
    expect(plan.electronicLegs).toHaveLength(1)
    expect(plan.electronicLegs[0].method).toBe("Pago móvil")
  })

  it("la pata en efectivo NO cuenta como evidencia de la electrónica", () => {
    const plan = planPaymentReport([
      leg({
        method: "Efectivo en divisas",
        usd: 20,
        ves: 0,
        dataUrl: "data:image/jpeg;base64,BILLETES",
      }),
      pagoMovil(),
    ])
    expect(plan.problem).toEqual({
      kind: "falta-evidencia",
      method: "Pago móvil",
    })
  })

  it("solo efectivo: no hay nada que reportar aquí", () => {
    const plan = planPaymentReport([
      leg({ method: "Efectivo en divisas", usd: 20, ves: 0 }),
    ])
    expect(plan.problem?.kind).toBe("solo-efectivo")
    expect(plan.electronicLegs).toHaveLength(0)
  })
})

describe("método único: no se endurece", () => {
  it("basta la captura", () => {
    expect(
      planPaymentReport([pagoMovil({ dataUrl: "data:image/jpeg;base64,AAA" })])
        .problem,
    ).toBeNull()
  })

  it("o basta la referencia completa", () => {
    expect(planPaymentReport([pagoMovil({ reference: "123456" })]).problem).toBeNull()
  })

  it("sin ninguna de las dos, no envía", () => {
    expect(planPaymentReport([pagoMovil()]).problem?.kind).toBe("falta-evidencia")
  })

  it("referencia de 4 dígitos sigue sin valer", () => {
    expect(planPaymentReport([pagoMovil({ reference: "4821" })]).problem?.kind).toBe(
      "referencia-corta",
    )
  })
})

// El sello "Listo" de cada tarjeta usa esto. Tiene que decir EXACTAMENTE lo
// mismo que la validación: con "4821" el sello se ponía verde y después el
// envío lo rechazaba por referencia incompleta — el error rojo que el sello
// prometía evitar (2026-07-26).
describe("el sello Listo dice lo mismo que la validación", () => {
  it("una referencia de 4 dígitos NO está lista", () => {
    expect(isLegEvidenceComplete(pagoMovil({ reference: "4821" }))).toBe(false)
    expect(planPaymentReport([pagoMovil({ reference: "4821" })]).problem?.kind).toBe(
      "referencia-corta",
    )
  })

  it("una referencia completa sí", () => {
    expect(isLegEvidenceComplete(pagoMovil({ reference: "123456" }))).toBe(true)
    expect(planPaymentReport([pagoMovil({ reference: "123456" })]).problem).toBeNull()
  })

  it("la captura sola siempre está lista", () => {
    expect(
      isLegEvidenceComplete(pagoMovil({ dataUrl: "data:image/jpeg;base64,AAA" })),
    ).toBe(true)
  })

  it("sin nada, no está lista", () => {
    expect(isLegEvidenceComplete(pagoMovil())).toBe(false)
  })
})

describe("sin montos", () => {
  it("una pata con método pero sin dinero no se puede reportar", () => {
    const plan = planPaymentReport([pagoMovil({ usd: 0, ves: 0 })])
    expect(plan.problem?.kind).toBe("sin-monto")
  })

  it("lista vacía tampoco", () => {
    expect(planPaymentReport([]).problem?.kind).toBe("sin-monto")
  })
})

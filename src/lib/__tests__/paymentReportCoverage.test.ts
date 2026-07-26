// Matriz de flujos de pago (lote v9, pedido del dueño 2026-07-23):
// cada combinación de método × orden de reporte debe decidir bien qué falta,
// qué cuenta como reportado y qué cuenta como pagado. La foto de los billetes
// (efectivo) NUNCA cubre lo electrónico ni registra cobro.
import { describe, expect, it } from "vitest"
import {
  buildExpectedPayments,
  computePendingElectronicUSD,
  getEnforceableReportUSD,
  getOrderPaymentLegs,
  getRequiredReportUSD,
  isCashReportedMethod,
  planPaymentHero,
} from "@/lib/orderPaymentLegs"
import { buildPaymentFromProof } from "@/lib/paymentProofRegistration"

const RATE = 166.02 // Bs por USD (tasa realista)

// Pedido tipo: $24.50 repartidos Bs 3.320,47 (≈$20... no: 3320.47/166.02=20)
// Usamos el caso real del dueño: Mixto Pago móvil Bs 3.320,47 + Efectivo €20.
const MIXTO_CASH = "Mixto: Pago móvil Bs 3.320,47 + Efectivo en divisas €20.00"
const MIXTO_ELECTRONICO = "Mixto: Pago móvil Bs 1.660,20 + Zelle $14.50"

const cashPhotoProof = {
  method: "Efectivo en divisas (€20.00) · pata en efectivo del pago mixto",
  amountUSD: 20,
  amountVES: 0,
}
const pagoMovilProof = (amountVES: number) => ({
  method: "Pago móvil",
  amountUSD: 0,
  amountVES,
})
const zelleProof = (amountUSD: number) => ({
  method: "Zelle",
  amountUSD,
  amountVES: 0,
})

describe("patas por método (todas las variantes del checkout)", () => {
  it("mixto efectivo + pago móvil se parte en sus dos patas", () => {
    const legs = getOrderPaymentLegs({
      paymentMethod: MIXTO_CASH,
      totalUSD: 40,
      exchangeRate: RATE,
    })
    expect(legs).toHaveLength(2)
    expect(legs.find((l) => l.currency === "VES")).toMatchObject({
      method: "Pago móvil",
      amount: 3320.47,
      isCash: false,
    })
    expect(legs.find((l) => l.currency === "USD")).toMatchObject({
      method: "Efectivo en divisas",
      amount: 20,
      isCash: true,
    })
  })

  it("mixto pago móvil + Zelle: DOS patas electrónicas", () => {
    const legs = getOrderPaymentLegs({
      paymentMethod: MIXTO_ELECTRONICO,
      totalUSD: 24.5,
      exchangeRate: RATE,
    })
    expect(legs).toHaveLength(2)
    expect(legs.every((l) => !l.isCash)).toBe(true)
  })

  it.each([
    ["Pago móvil", false],
    ["Zelle", false],
    ["Efectivo en divisas", true],
    ["Efectivo en bolívares", true],
  ])("método único %s (isCash=%s)", (method, cash) => {
    const legs = getOrderPaymentLegs({
      paymentMethod: method,
      totalUSD: 24.5,
      exchangeRate: RATE,
    })
    expect(legs).toHaveLength(1)
    expect(legs[0].isCash).toBe(cash)
  })
})

describe("cuánto se DEBE reportar (solo lo electrónico)", () => {
  it("mixto efectivo+pago móvil exige solo la pata electrónica", () => {
    const required = getRequiredReportUSD({
      paymentMethod: MIXTO_CASH,
      totalUSD: 40,
      exchangeRate: RATE,
    })
    expect(required).toBeCloseTo(3320.47 / RATE, 2)
  })

  it("mixto doble electrónico exige ambas patas (el total)", () => {
    const required = getRequiredReportUSD({
      paymentMethod: MIXTO_ELECTRONICO,
      totalUSD: 24.5,
      exchangeRate: RATE,
    })
    expect(required).toBeCloseTo(24.5, 1)
  })

  it("efectivo puro no exige reporte electrónico", () => {
    expect(
      getRequiredReportUSD({
        paymentMethod: "Efectivo en divisas",
        totalUSD: 24.5,
        exchangeRate: RATE,
      }),
    ).toBe(0)
  })
})

// Regresión del 2026-07-26: la pantalla del cliente decía "TIENES QUE PAGAR
// $40.00" en un mixto donde solo Bs 3.320,47 se transfieren y €20 se entregan
// en mano. La rama que lo evitaba miraba las patas en efectivo... que el
// servidor ya había filtrado antes de mandarlas, así que no se ejecutaba nunca.
// Estos tests ejercitan las DOS mitades: que las patas en efectivo VIAJEN y
// que el monto grande salga de ellas.
describe("qué cifra se le grita al cliente (Problema 0)", () => {
  it("las patas que viajan al cliente INCLUYEN el efectivo", () => {
    const legs = buildExpectedPayments({
      paymentMethod: MIXTO_CASH,
      totalUSD: 40,
      exchangeRate: RATE,
    })
    expect(legs).toHaveLength(2)
    expect(legs.some((leg) => leg.isCash)).toBe(true)
  })

  it("mixto efectivo + pago móvil: el monto grande es SOLO la pata electrónica", () => {
    const plan = planPaymentHero(
      buildExpectedPayments({
        paymentMethod: MIXTO_CASH,
        totalUSD: 40,
        exchangeRate: RATE,
      }),
    )
    expect(plan.kind).toBe("mixto-con-efectivo")
    expect(plan.electronicLegs).toHaveLength(1)
    expect(plan.electronicLegs[0]).toMatchObject({ method: "Pago móvil", amount: 3320.47 })
    expect(plan.cashLegs).toHaveLength(1)
    expect(plan.cashLegs[0]).toMatchObject({ method: "Efectivo en divisas", amount: 20 })
  })

  it("efectivo puro: no hay nada que transferir", () => {
    const plan = planPaymentHero(
      buildExpectedPayments({
        paymentMethod: "Efectivo en divisas",
        totalUSD: 24.5,
        exchangeRate: RATE,
      }),
    )
    expect(plan.kind).toBe("solo-efectivo")
    expect(plan.electronicLegs).toHaveLength(0)
  })

  it("mixto de dos patas electrónicas: manda el total, no hay efectivo", () => {
    const plan = planPaymentHero(
      buildExpectedPayments({
        paymentMethod: MIXTO_ELECTRONICO,
        totalUSD: 24.5,
        exchangeRate: RATE,
      }),
    )
    expect(plan.kind).toBe("total")
    expect(plan.cashLegs).toHaveLength(0)
    expect(plan.electronicLegs).toHaveLength(2)
  })

  it("método único electrónico: manda el total", () => {
    const plan = planPaymentHero(
      buildExpectedPayments({
        paymentMethod: "Pago móvil",
        totalUSD: 24.5,
        exchangeRate: RATE,
      }),
    )
    expect(plan.kind).toBe("total")
  })

  it("sin método identificable no se inventa efectivo", () => {
    expect(planPaymentHero(buildExpectedPayments({
      paymentMethod: "",
      totalUSD: 24.5,
      exchangeRate: RATE,
    })).kind).toBe("total")
  })
})

describe("cobertura según el ORDEN en que llegan los comprobantes", () => {
  const requiredUSD = getRequiredReportUSD({
    paymentMethod: MIXTO_CASH,
    totalUSD: 40,
    exchangeRate: RATE,
  })

  it("sin comprobantes: falta toda la pata electrónica", () => {
    const pending = computePendingElectronicUSD({
      requiredUSD,
      exchangeRate: RATE,
      proofs: [],
    })
    expect(pending).toBeCloseTo(requiredUSD, 2)
  })

  it("PRIMERO la foto del efectivo: sigue faltando lo electrónico (caso que preocupaba al dueño)", () => {
    const pending = computePendingElectronicUSD({
      requiredUSD,
      exchangeRate: RATE,
      proofs: [cashPhotoProof],
    })
    expect(pending).toBeCloseTo(requiredUSD, 2)
  })

  it("DESPUÉS llega el pago móvil: queda cubierto", () => {
    const pending = computePendingElectronicUSD({
      requiredUSD,
      exchangeRate: RATE,
      proofs: [cashPhotoProof, pagoMovilProof(3320.47)],
    })
    expect(pending).toBe(0)
  })

  it("el pago móvil ANTES que la foto también cubre (orden inverso)", () => {
    const pending = computePendingElectronicUSD({
      requiredUSD,
      exchangeRate: RATE,
      proofs: [pagoMovilProof(3320.47), cashPhotoProof],
    })
    expect(pending).toBe(0)
  })

  it("mixto Zelle+pago móvil: reportar solo el Zelle deja pendiente el pago móvil", () => {
    const requiredBoth = getRequiredReportUSD({
      paymentMethod: MIXTO_ELECTRONICO,
      totalUSD: 24.5,
      exchangeRate: RATE,
    })
    const pending = computePendingElectronicUSD({
      requiredUSD: requiredBoth,
      exchangeRate: RATE,
      proofs: [zelleProof(14.5)],
    })
    expect(pending).toBeCloseTo(1660.2 / RATE, 1)

    const pendingBoth = computePendingElectronicUSD({
      requiredUSD: requiredBoth,
      exchangeRate: RATE,
      proofs: [zelleProof(14.5), pagoMovilProof(1660.2)],
    })
    expect(pendingBoth).toBe(0)
  })

  it("un reporte parcial (menos plata de la debida) NO cubre", () => {
    const pending = computePendingElectronicUSD({
      requiredUSD,
      exchangeRate: RATE,
      proofs: [pagoMovilProof(1000)],
    })
    expect(pending).toBeGreaterThan(0)
  })
})

// Problema 1 (dueño, 2026-07-26): paga "Efectivo en divisas", sube la foto de
// los billetes, la ve EN REVISIÓN... y justo debajo la pantalla le vuelve a
// pedir el método, una captura y "Enviar comprobante". Pasa cuando el pedido
// no dice con qué se pagó: ahí se exige el TOTAL como si fuera electrónico y
// la foto del efectivo NUNCA cuenta, así que la exigencia no se puede cumplir
// jamás.
describe("guarda del método desconocido (Problema 1)", () => {
  const unknownOrder = { paymentMethod: "", totalUSD: 24.5, exchangeRate: RATE }

  it("sin método y con la foto del efectivo: no se puede exigir nada", () => {
    expect(
      getEnforceableReportUSD({ ...unknownOrder, activeProofs: [cashPhotoProof] }),
    ).toBe(0)
  })

  it('"Por confirmar" se comporta igual que sin método', () => {
    expect(
      getEnforceableReportUSD({
        ...unknownOrder,
        paymentMethod: "Por confirmar",
        activeProofs: [cashPhotoProof],
      }),
    ).toBe(0)
  })

  it("sin método y SIN comprobantes: se sigue exigiendo el total", () => {
    expect(getEnforceableReportUSD({ ...unknownOrder, activeProofs: [] })).toBe(24.5)
  })

  it("sin método pero con un reporte ELECTRÓNICO a medias: se sigue exigiendo", () => {
    // La guarda solo suelta cuando todo lo activo es efectivo; un abono
    // electrónico incompleto se sigue persiguiendo.
    expect(
      getEnforceableReportUSD({ ...unknownOrder, activeProofs: [zelleProof(5)] }),
    ).toBe(24.5)
  })

  it("mixto identificable: la foto del efectivo NO suelta la pata electrónica", () => {
    const required = getEnforceableReportUSD({
      paymentMethod: MIXTO_CASH,
      totalUSD: 40,
      exchangeRate: RATE,
      activeProofs: [cashPhotoProof],
    })
    expect(required).toBeCloseTo(3320.47 / RATE, 2)
    expect(
      computePendingElectronicUSD({
        requiredUSD: required,
        exchangeRate: RATE,
        proofs: [cashPhotoProof],
      }),
    ).toBeGreaterThan(0)
  })

  it("efectivo puro identificable: 0 con comprobante y 0 sin él", () => {
    const order = {
      paymentMethod: "Efectivo en divisas",
      totalUSD: 24.5,
      exchangeRate: RATE,
    }
    expect(getEnforceableReportUSD({ ...order, activeProofs: [] })).toBe(0)
    expect(getEnforceableReportUSD({ ...order, activeProofs: [cashPhotoProof] })).toBe(0)
  })

  it("método electrónico normal: la guarda no lo toca", () => {
    expect(
      getEnforceableReportUSD({
        paymentMethod: "Pago móvil",
        totalUSD: 24.5,
        exchangeRate: RATE,
        activeProofs: [],
      }),
    ).toBeCloseTo(24.5, 2)
  })
})

describe("qué método reportado cuenta como efectivo", () => {
  it.each([
    ["Efectivo en divisas (€20.00) · pata en efectivo del pago mixto", true],
    ["EFECTIVO en bolívares", true],
    ["Pago móvil (Bs 18.078,10)", false],
    ["Zelle correo@ejemplo.com", false],
    ["", false],
  ])("%s → %s", (method, expected) => {
    expect(isCashReportedMethod(method)).toBe(expected)
  })
})

describe("confirmar comprobantes registra (o no) el cobro", () => {
  const emptySnapshot = { amountReceivedUSD: 0, amountReceivedVES: 0 }

  it("la foto del efectivo NO registra cobro (el efectivo se recibe en persona)", () => {
    const decision = buildPaymentFromProof(
      {
        reportedMethod: cashPhotoProof.method,
        amountReportedUSD: 20,
        amountReportedVES: 0,
        paymentReference: "",
      },
      emptySnapshot,
    )
    expect(decision.ok).toBe(false)
  })

  it("un pago móvil confirmado SÍ registra el cobro de su pata", () => {
    const decision = buildPaymentFromProof(
      {
        reportedMethod: "Pago móvil",
        amountReportedUSD: 0,
        amountReportedVES: 3320.47,
        paymentReference: "123456",
      },
      emptySnapshot,
    )
    expect(decision.ok).toBe(true)
    if (decision.ok) {
      expect(decision.payment.amountReceivedVES).toBe(3320.47)
      expect(decision.payment.deliveryPaymentIn).toBe("Bolívares")
    }
  })

  it("con cobro previo EN LA MISMA MONEDA no se pisa nada", () => {
    const decision = buildPaymentFromProof(
      {
        reportedMethod: "Pago móvil",
        amountReportedUSD: 0,
        amountReportedVES: 100,
        paymentReference: "",
      },
      { amountReceivedUSD: 0, amountReceivedVES: 3320.47 },
    )
    expect(decision.ok).toBe(false)
    if (!decision.ok) expect(decision.reason).toContain("3.320,47")
  })
})

// Mixto de dos patas electrónicas: llegan DOS comprobantes. Confirmar el
// segundo se rechazaba entero ("ya tiene un cobro registrado") y había que
// cuadrarlo a mano en cada pedido. Decisión del dueño (2026-07-26): sumar,
// pero solo cuando la moneda de la pata que llega está libre.
describe("segunda pata del mixto: sumar solo si no colisiona", () => {
  const pagoMovilCobrado = {
    amountReceivedUSD: 0,
    amountReceivedVES: 1660.2,
    paymentMethodUSD: "",
    paymentMethodVES: "Pago móvil",
    paymentNote: "Cobro verificado por comprobante · Ref 111111",
  }

  it("Zelle en $ sobre un pago móvil en Bs: SE SUMA y conserva la primera pata", () => {
    const decision = buildPaymentFromProof(
      {
        reportedMethod: "Zelle",
        amountReportedUSD: 14.5,
        amountReportedVES: 0,
        paymentReference: "222222",
      },
      pagoMovilCobrado,
    )
    expect(decision.ok).toBe(true)
    if (decision.ok) {
      expect(decision.payment.amountReceivedVES).toBe(1660.2)
      expect(decision.payment.amountReceivedUSD).toBe(14.5)
      expect(decision.payment.paymentMethodVES).toBe("Pago móvil")
      expect(decision.payment.paymentMethodUSD).toBe("Zelle")
      expect(decision.payment.deliveryPaymentIn).toBe("Mixto")
      // La nota conserva la referencia de la primera pata y suma la segunda.
      expect(decision.payment.paymentNote).toContain("111111")
      expect(decision.payment.paymentNote).toContain("222222")
    }
  })

  it("dos patas en la MISMA moneda (pago móvil + transferencia): no se toca el dinero", () => {
    const decision = buildPaymentFromProof(
      {
        reportedMethod: "Transferencia",
        amountReportedUSD: 0,
        amountReportedVES: 1660.2,
        paymentReference: "222222",
      },
      pagoMovilCobrado,
    )
    expect(decision.ok).toBe(false)
    if (!decision.ok) expect(decision.reason).toContain("Caja")
  })

  it("confirmar DOS VECES el mismo comprobante no duplica el cobro", () => {
    const zelle = {
      reportedMethod: "Zelle",
      amountReportedUSD: 14.5,
      amountReportedVES: 0,
      paymentReference: "222222",
    }
    const first = buildPaymentFromProof(zelle, pagoMovilCobrado)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    // El estado del pedido después de la primera confirmación.
    const second = buildPaymentFromProof(zelle, {
      amountReceivedUSD: first.payment.amountReceivedUSD,
      amountReceivedVES: first.payment.amountReceivedVES,
      paymentMethodUSD: first.payment.paymentMethodUSD,
      paymentMethodVES: first.payment.paymentMethodVES,
      paymentNote: first.payment.paymentNote,
    })
    expect(second.ok).toBe(false)
  })

  it("la foto del efectivo sigue sin registrar cobro aunque haya una pata cobrada", () => {
    const decision = buildPaymentFromProof(
      {
        reportedMethod: cashPhotoProof.method,
        amountReportedUSD: 20,
        amountReportedVES: 0,
        paymentReference: "",
      },
      pagoMovilCobrado,
    )
    expect(decision.ok).toBe(false)
  })
})

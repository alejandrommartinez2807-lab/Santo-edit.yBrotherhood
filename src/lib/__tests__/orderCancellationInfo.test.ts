import { describe, expect, it } from "vitest"

import {
  CANCEL_REFUND_DEFAULT,
  formatCancellationLine,
  getCancellationHeadline,
  getCancellationReasonText,
  inferCancelOriginFromNote,
  parseCancelNote,
  resolveCancelRefund,
} from "@/lib/orderCancellationInfo"

// Política de anulaciones del dueño (2026-07-29): el pedido anulado se
// explica solo — origen, motivo, quién, insumos y dinero — en caja, cierre e
// historial. Estos tests fijan los textos del recorrido.

describe("resolveCancelRefund", () => {
  it("NO devolvió el dinero → se quedó en caja", () => {
    expect(resolveCancelRefund(false)).toBe("se_quedo")
  })

  it("SÍ devolvió el dinero → devuelto", () => {
    expect(resolveCancelRefund(true)).toBe("devuelto")
  })

  it("sin respuesta (API vieja, script) → aplica el default del supuesto", () => {
    expect(resolveCancelRefund(null)).toBe(CANCEL_REFUND_DEFAULT)
    expect(resolveCancelRefund(undefined)).toBe(CANCEL_REFUND_DEFAULT)
  })

  it("el default de hoy es 'devuelto' (supuesto 2026-07-29, sin confirmar)", () => {
    // Si el dueño confirma lo contrario, se invierte la constante y este
    // test se actualiza CON esa decisión — no antes.
    expect(CANCEL_REFUND_DEFAULT).toBe("devuelto")
  })
})

describe("getCancellationHeadline — los tres orígenes de un vistazo", () => {
  it("automático", () => {
    expect(getCancellationHeadline({ origin: "automatico" })).toBe(
      "Anulado automáticamente",
    )
  })

  it("cliente", () => {
    expect(getCancellationHeadline({ origin: "cliente" })).toBe(
      "Cancelado por el cliente",
    )
  })

  it("personal con nombre y rol", () => {
    expect(
      getCancellationHeadline({
        origin: "personal",
        cancelledByName: "Génesis",
        cancelledByRole: "manager",
      }),
    ).toBe("Anulado por Génesis (Encargado)")
  })

  it("personal sin nombre cae al rol", () => {
    expect(
      getCancellationHeadline({ origin: "personal", cancelledByRole: "cashier" }),
    ).toBe("Anulado por Cajero")
  })

  it("anulación vieja sin origen: 'Anulado' a secas", () => {
    expect(getCancellationHeadline({})).toBe("Anulado")
  })
})

describe("getCancellationReasonText — nunca un espacio en blanco", () => {
  it("con motivo, el motivo", () => {
    expect(
      getCancellationReasonText({ origin: "personal", reason: "se quemó la burger" }),
    ).toBe("se quemó la burger")
  })

  it("cliente sin motivo: 'no dejó motivo' ES la información", () => {
    expect(getCancellationReasonText({ origin: "cliente", reason: "" })).toBe(
      "no dejó motivo",
    )
  })

  it("otros orígenes sin motivo: 'sin motivo registrado'", () => {
    expect(getCancellationReasonText({ origin: "personal" })).toBe(
      "sin motivo registrado",
    )
  })
})

describe("formatCancellationLine — el recorrido del dueño", () => {
  it("automático con dinero cero", () => {
    expect(
      formatCancellationLine({
        origin: "automatico",
        reason: "Sin pago reportado en 30 min (automático)",
        inventoryUsed: false,
        refund: null,
        receivedLabel: "sin cobrar",
      }),
    ).toBe(
      "Anulado automáticamente — Sin pago reportado en 30 min (automático) · sin cobrar · insumos devueltos al stock",
    )
  })

  it("personal con dinero devuelto e insumos consumidos", () => {
    expect(
      formatCancellationLine({
        origin: "personal",
        reason: "el cliente se arrepintió, ya estaba en la plancha",
        cancelledByName: "Génesis",
        cancelledByRole: "manager",
        inventoryUsed: true,
        refund: "devuelto",
        receivedLabel: "$9.50 cobrados",
      }),
    ).toBe(
      "Anulado por Génesis (Encargado) — el cliente se arrepintió, ya estaba en la plancha · $9.50 cobrados · insumos consumidos · dinero devuelto al cliente",
    )
  })

  it("dinero que se quedó: en caja pero NUNCA como venta", () => {
    const line = formatCancellationLine({
      origin: "personal",
      reason: "cliente se fue sin esperar",
      cancelledByName: "Kelvin",
      cancelledByRole: "cashier",
      inventoryUsed: true,
      refund: "se_quedo",
      receivedLabel: "$12.50 cobrados",
    })
    expect(line).toContain("el dinero se quedó en caja (no es venta)")
  })

  it("cliente sin motivo", () => {
    expect(
      formatCancellationLine({
        origin: "cliente",
        reason: "",
        inventoryUsed: false,
        refund: null,
        receivedLabel: "sin cobrar",
      }),
    ).toBe(
      "Cancelado por el cliente — no dejó motivo · sin cobrar · insumos devueltos al stock",
    )
  })
})

describe("fallback para anulaciones anteriores a 0036 (nota concatenada)", () => {
  const nota =
    "Sin cebolla | ANULADO: cliente no retiró | Por: María Fernanda · Cajero | Ingredientes USADOS: el inventario queda descontado"

  it("parseCancelNote extrae motivo y quién", () => {
    expect(parseCancelNote(nota)).toEqual({
      reason: "cliente no retiró",
      cancelledBy: "María Fernanda · Cajero",
    })
  })

  it("nota sin ANULADO: vacío (no inventa)", () => {
    expect(parseCancelNote("Sin cebolla")).toEqual({ reason: "", cancelledBy: "" })
  })

  it("infiere el origen por el texto histórico", () => {
    expect(
      inferCancelOriginFromNote(
        "ANULADO: Sin pago reportado en 30 min (anulación automática). …",
      ),
    ).toBe("automatico")
    expect(
      inferCancelOriginFromNote("ANULADO: Cancelado por el cliente — Motivo: me equivoqué"),
    ).toBe("cliente")
    expect(inferCancelOriginFromNote(nota)).toBe("personal")
    expect(inferCancelOriginFromNote("Sin cebolla")).toBe("")
  })
})

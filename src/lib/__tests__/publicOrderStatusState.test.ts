import { describe, it, expect } from "vitest"
import {
  selectPolledOrderState,
  EMPTY_POLLED_ORDER,
  type PolledOrderState,
} from "@/lib/publicOrderStatusState"

const pedidoCancelado: PolledOrderState = {
  forOrderId: "pedido-viejo",
  status: "Cancelado",
  displayNumber: "#40-s",
  items: [{ name: "Smash burger", quantity: 1, selectionSummary: "", subtotalUSD: 11 }],
  cancelReason: "Sin pago a los 5 minutos",
  payment: {
    expected: true,
    reportable: true,
    reported: false,
    confirmed: false,
    pendingReportUSD: 11,
  },
  notFound: false,
}

describe("selectPolledOrderState", () => {
  it("devuelve lo sondeado cuando pertenece al pedido que se mira", () => {
    expect(selectPolledOrderState(pedidoCancelado, "pedido-viejo")).toBe(pedidoCancelado)
  })

  // El caso reportado: un pedido se anula solo por falta de pago, el cliente
  // hace otro y veía el VIEJO (su número y su alerta de cancelado) hasta que
  // respondiera la primera consulta del nuevo.
  it("NO deja pasar el estado de un pedido a la pantalla de otro", () => {
    const visto = selectPolledOrderState(pedidoCancelado, "pedido-nuevo")

    expect(visto.forOrderId).toBe("pedido-nuevo")
    expect(visto.status).toBe("")
    expect(visto.displayNumber).toBe("")
    expect(visto.cancelReason).toBe("")
    expect(visto.payment).toBeNull()
    expect(visto.items).toEqual([])
    // Y sobre todo: el pedido nuevo NO puede leerse como cancelado.
    expect(visto.status === "Cancelado").toBe(false)
  })

  it("tampoco arrastra un notFound de otro pedido", () => {
    const noExiste: PolledOrderState = {
      forOrderId: "borrado-en-el-cierre",
      ...EMPTY_POLLED_ORDER,
      notFound: true,
    }

    expect(selectPolledOrderState(noExiste, "pedido-nuevo").notFound).toBe(false)
  })

  it("con el pedido vacío (sin seguimiento) no inventa datos", () => {
    const visto = selectPolledOrderState(pedidoCancelado, "")
    expect(visto.status).toBe("")
    expect(visto.displayNumber).toBe("")
  })

  // `items` tiene que conservar la misma referencia entre llamadas: si cambiara,
  // un consumidor que lo use como dependencia de efecto entraría en bucle.
  it("reusa la misma referencia de items vacío", () => {
    const a = selectPolledOrderState(pedidoCancelado, "otro-1")
    const b = selectPolledOrderState(pedidoCancelado, "otro-2")
    expect(a.items).toBe(b.items)
  })
})

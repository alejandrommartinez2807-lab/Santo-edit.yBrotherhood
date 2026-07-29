import { describe, expect, it } from "vitest"

import { getDateKeyInCaracas as dateKeyPedidos } from "@/app/pedidos/domain"
import {
  getDateKeyInCaracas as dateKeyCierres,
  isCloseInsideDateRange,
  type SavedDayClose,
} from "@/app/local-santo/cierres/domain"

// §9 del guion — reloj de negocio. El día comercial se resuelve SIEMPRE en
// hora Caracas (UTC-4, sin horario de verano) sin importar la zona del
// servidor, de la base o del navegador. Estos tests fijan los bordes de
// medianoche que la semana simulada no pudo ejercitar (los timestamps reales
// no se falsean, regla §9).

describe("getDateKeyInCaracas — bordes de medianoche", () => {
  // Medianoche de Caracas = 04:00 UTC.
  it("un instante ANTES de medianoche sigue siendo el día anterior", () => {
    expect(dateKeyPedidos("2026-08-04T03:59:59.999Z")).toBe("2026-08-03")
  })

  it("EXACTAMENTE a medianoche ya es el día siguiente", () => {
    expect(dateKeyPedidos("2026-08-04T04:00:00.000Z")).toBe("2026-08-04")
  })

  it("un instante DESPUÉS de medianoche es el día siguiente", () => {
    expect(dateKeyPedidos("2026-08-04T04:00:00.001Z")).toBe("2026-08-04")
  })

  it("cruce de mes y de año también en hora Caracas", () => {
    expect(dateKeyPedidos("2026-09-01T03:30:00Z")).toBe("2026-08-31")
    expect(dateKeyPedidos("2027-01-01T03:59:00Z")).toBe("2026-12-31")
    expect(dateKeyPedidos("2027-01-01T04:00:00Z")).toBe("2027-01-01")
  })
})

describe("getDateKeyInCaracas — independiente de la zona del emisor", () => {
  it("el mismo instante escrito con distintos offsets da el MISMO día comercial", () => {
    // 2026-08-03 23:30 en Caracas, escrito de tres maneras:
    const instantes = [
      "2026-08-03T23:30:00-04:00",
      "2026-08-04T03:30:00Z",
      "2026-08-04T05:30:00+02:00",
    ]
    for (const iso of instantes) {
      expect(dateKeyPedidos(iso)).toBe("2026-08-03")
    }
  })

  it("entiende el formato de timestamp de Postgres (espacio y +00)", () => {
    expect(dateKeyPedidos("2026-08-04 03:59:59+00")).toBe("2026-08-03")
    expect(dateKeyPedidos("2026-08-04 04:00:00+00")).toBe("2026-08-04")
  })

  it("con basura devuelve vacío, no un día inventado", () => {
    expect(dateKeyPedidos("no es una fecha")).toBe("")
    expect(dateKeyPedidos("")).toBe("")
  })
})

describe("las DOS copias del reloj (pedidos y cierres) no divergen", () => {
  // pedidos/domain y cierres/domain tienen cada uno su getDateKeyInCaracas:
  // si algún día divergen, el panel y el historial parten el día comercial
  // en puntos distintos y la contabilidad "salta" entre pantallas.
  it("mismo resultado en los bordes críticos", () => {
    const casos = [
      "2026-08-04T03:59:59.999Z",
      "2026-08-04T04:00:00.000Z",
      "2026-08-04T04:00:00.001Z",
      "2026-12-31T20:00:00Z",
      "2027-01-01T03:59:59Z",
    ]
    for (const iso of casos) {
      expect(dateKeyCierres(iso)).toBe(dateKeyPedidos(iso))
    }
  })
})

describe("cierre iniciado antes de medianoche y guardado después (§9)", () => {
  const baseClose = {
    id: "CIE-test",
    dateLabel: "lunes, 03 de agosto de 2026",
  } as unknown as SavedDayClose

  it("un cierre guardado a las 00:05 cae en el día SIGUIENTE para el filtro por fechas", () => {
    // Comportamiento ACTUAL documentado: el filtro de rango usa createdAt
    // (el momento en que se guardó), no el día que el cierre resume. Un
    // cierre del sábado guardado el domingo 00:05 aparece filtrando el
    // DOMINGO. El dateLabel sí conserva el día que resume — el dueño lo ve
    // en la tarjeta — pero quien filtre "solo sábado" no lo encontrará.
    // Queda anotado como observación §9 en el barrido; cambiarlo es decisión
    // de producto, no un fix silencioso.
    const close = { ...baseClose, createdAt: "2026-08-04T04:05:00Z" }
    expect(isCloseInsideDateRange(close, "2026-08-04", "2026-08-04")).toBe(true)
    expect(isCloseInsideDateRange(close, "2026-08-03", "2026-08-03")).toBe(false)
    // En el rango completo del fin de semana siempre aparece.
    expect(isCloseInsideDateRange(close, "2026-08-03", "2026-08-04")).toBe(true)
  })

  it("un cierre guardado 23:59 Caracas queda en su mismo día", () => {
    const close = { ...baseClose, createdAt: "2026-08-04T03:59:00Z" }
    expect(isCloseInsideDateRange(close, "2026-08-03", "2026-08-03")).toBe(true)
  })
})

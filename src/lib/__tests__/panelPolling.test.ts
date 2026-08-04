import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Optimización de consumo 2026-08-03. Tres piezas del lado del panel:
// 1. fetchWithPollEtag: manda If-None-Match a mano (todo /api/* es no-store,
//    el navegador jamás revalida solo) y traduce el 304 a "no cambió nada".
// 2. createHiddenPollGate: pestaña oculta = 1 tick por minuto, no cero (el
//    latido de encuestas/auto-anulaciones y los sonidos de cocina siguen).
// 3. getLiveOrdersWindowStartIso: inicio de la jornada (5:00 Caracas) — se
//    cruza contra los helpers canónicos de /pedidos para que no diverjan.

import {
  __resetPollEtagsForTests,
  buildLiveOrdersUrl,
  createHiddenPollGate,
  fetchWithPollEtag,
  getLiveOrdersWindowStartIso,
  HIDDEN_POLL_INTERVAL_MS,
} from "@/lib/panelPolling"
import {
  getBusinessDayKeyInCaracas,
  getBusinessDayStartIso,
} from "@/app/pedidos/domain"

function fakeResponse(status: number, etag?: string) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "etag" && etag ? etag : null,
    },
  } as unknown as Response
}

describe("fetchWithPollEtag", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    __resetPollEtagsForTests()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("la primera petición va sin If-None-Match y guarda el ETag", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"v1"'))

    const result = await fetchWithPollEtag("/api/orders", {
      headers: { "x-admin-password": "clave" },
    })

    expect(result.notModified).toBe(false)
    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get("if-none-match")).toBeNull()
    expect(headers.get("x-admin-password")).toBe("clave")
  })

  it("la segunda petición manda el ETag y un 304 se traduce a notModified", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"v1"'))
    await fetchWithPollEtag("/api/orders")

    fetchMock.mockResolvedValueOnce(fakeResponse(304))
    const result = await fetchWithPollEtag("/api/orders")

    expect(result.notModified).toBe(true)
    expect(result.response).toBeNull()
    const headers = fetchMock.mock.calls[1][1].headers as Headers
    expect(headers.get("if-none-match")).toBe('"v1"')
  })

  it("cada URL guarda su propio validador (orders vs cuentas vs comprobantes)", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"orders"'))
    await fetchWithPollEtag("/api/orders")

    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"cuentas"'))
    await fetchWithPollEtag("/api/open-accounts?status=Abierta")

    fetchMock.mockResolvedValueOnce(fakeResponse(304))
    await fetchWithPollEtag("/api/orders")

    const headers = fetchMock.mock.calls[2][1].headers as Headers
    expect(headers.get("if-none-match")).toBe('"orders"')
  })

  it("un error olvida el validador: el siguiente sondeo pide el cuerpo completo", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"v1"'))
    await fetchWithPollEtag("/api/orders")

    // 500 (o 401/403/429): la respuesta de error se entrega al caller como
    // siempre, pero el ETag guardado se descarta.
    fetchMock.mockResolvedValueOnce(fakeResponse(500))
    const conError = await fetchWithPollEtag("/api/orders")
    expect(conError.notModified).toBe(false)

    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"v2"'))
    await fetchWithPollEtag("/api/orders")
    const headers = fetchMock.mock.calls[2][1].headers as Headers
    expect(headers.get("if-none-match")).toBeNull()
  })

  it("un 200 sin ETag no envenena el estado", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200))
    const result = await fetchWithPollEtag("/api/orders")

    expect(result.notModified).toBe(false)

    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"v1"'))
    await fetchWithPollEtag("/api/orders")
    const headers = fetchMock.mock.calls[1][1].headers as Headers
    expect(headers.get("if-none-match")).toBeNull()
  })
})

describe("createHiddenPollGate", () => {
  it("con la pestaña visible cada tick trabaja", () => {
    const gate = createHiddenPollGate(() => false)

    expect(gate.shouldPoll(0)).toBe(true)
    expect(gate.shouldPoll(2_500)).toBe(true)
    expect(gate.shouldPoll(5_000)).toBe(true)
  })

  it("oculta: los ticks se espacian a 1 por minuto, sin pararse del todo", () => {
    let hidden = false
    const gate = createHiddenPollGate(() => hidden)

    expect(gate.shouldPoll(0)).toBe(true)

    hidden = true
    expect(gate.shouldPoll(2_500)).toBe(false)
    expect(gate.shouldPoll(30_000)).toBe(false)
    // Pasado el minuto desde el último tick que trabajó, vuelve a trabajar:
    // el latido del negocio (auto-anulaciones, encuestas) no se muere.
    expect(gate.shouldPoll(HIDDEN_POLL_INTERVAL_MS + 1)).toBe(true)
    expect(gate.shouldPoll(HIDDEN_POLL_INTERVAL_MS + 2_500)).toBe(false)
  })

  it("al volver a visible se sondea de inmediato aunque no pasara el minuto", () => {
    let hidden = false
    const gate = createHiddenPollGate(() => hidden)

    expect(gate.shouldPoll(0)).toBe(true)
    hidden = true
    expect(gate.shouldPoll(2_500)).toBe(false)
    hidden = false
    expect(gate.shouldPoll(5_000)).toBe(true)
  })
})

describe("getLiveOrdersWindowStartIso — jornada 5:00 Caracas", () => {
  // La regla canónica vive en src/app/pedidos/domain.tsx (cierre del día).
  // Este cruce impide que las dos implementaciones diverjan en silencio.
  const instantes = [
    "2026-08-03T18:00:00.000Z", // tarde de servicio
    "2026-08-04T03:50:00.000Z", // 23:50 de Caracas, antes de medianoche
    "2026-08-04T04:10:00.000Z", // 00:10 de Caracas, pasada la medianoche
    "2026-08-04T08:59:59.000Z", // 04:59 de Caracas, aún jornada anterior
    "2026-08-04T09:00:00.000Z", // 05:00 de Caracas exactas, jornada nueva
    "2027-01-01T06:00:00.000Z", // cruce de año
  ]

  it.each(instantes)("coincide con el cierre de /pedidos en %s", (iso) => {
    const now = new Date(iso)
    const esperado = getBusinessDayStartIso(getBusinessDayKeyInCaracas(now))

    expect(getLiveOrdersWindowStartIso(now)).toBe(esperado)
  })

  it("una fecha inválida no revienta: devuelve cadena vacía", () => {
    expect(getLiveOrdersWindowStartIso(new Date("no-es-fecha"))).toBe("")
  })
})

describe("buildLiveOrdersUrl", () => {
  it("acota /api/orders al inicio de la jornada en curso", () => {
    const now = new Date("2026-08-03T23:00:00.000Z")
    const url = buildLiveOrdersUrl(now)

    expect(url).toBe(
      `/api/orders?createdFrom=${encodeURIComponent("2026-08-03T09:00:00.000Z")}`,
    )
  })

  it("si la ventana no se puede calcular, cae a la URL completa", () => {
    expect(buildLiveOrdersUrl(new Date("no-es-fecha"))).toBe("/api/orders")
  })
})

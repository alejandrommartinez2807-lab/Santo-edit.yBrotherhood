import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Optimización de consumo 2026-08-03. Tres piezas del lado del panel:
// 1. fetchWithPollEtag: manda If-None-Match a mano (todo /api/* es no-store,
//    el navegador jamás revalida solo) y ante un 304 entrega la COPIA LOCAL
//    como un 200 normal: el panel se comporta igual que siempre, solo los
//    bytes dejan de viajar. La copia es obligatoria (revisión adversarial
//    2026-08-03): sin ella, un panel que remontaba con estado vacío recibía
//    304 y se quedaba en blanco sin error.
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

function fakeResponse(status: number, etag?: string, body = "{}") {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "etag" && etag ? etag : null,
    },
    text: () => Promise.resolve(body),
  } as unknown as Response
}

function truncatedResponse(etag: string) {
  return {
    status: 200,
    ok: true,
    headers: {
      get: (name: string) => (name.toLowerCase() === "etag" ? etag : null),
    },
    // El stream se corta a mitad de descarga (wifi inestable).
    text: () => Promise.reject(new Error("network stream interrupted")),
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

  it("la primera petición va sin If-None-Match y el caller lee el cuerpo normal", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, '"v1"', '{"orders":[{"id":"p-1"}]}'),
    )

    const result = await fetchWithPollEtag("/api/orders", {
      headers: { "x-admin-password": "clave" },
    })

    expect(result.notModified).toBe(false)
    expect(await result.response!.json()).toEqual({ orders: [{ id: "p-1" }] })
    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get("if-none-match")).toBeNull()
    expect(headers.get("x-admin-password")).toBe("clave")
  })

  it("la segunda petición manda el ETag y un 304 entrega la copia local como un 200", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, '"v1"', '{"orders":[{"id":"p-1"}]}'),
    )
    await fetchWithPollEtag("/api/orders")

    fetchMock.mockResolvedValueOnce(fakeResponse(304))
    const result = await fetchWithPollEtag("/api/orders")

    // El caller no distingue este camino de un 200 real: mismo status, mismo
    // cuerpo. Solo los bytes no viajaron.
    expect(result.notModified).toBe(false)
    expect(result.response!.status).toBe(200)
    expect(await result.response!.json()).toEqual({ orders: [{ id: "p-1" }] })
    const headers = fetchMock.mock.calls[1][1].headers as Headers
    expect(headers.get("if-none-match")).toBe('"v1"')
  })

  it("REGRESIÓN remontaje: un panel que vuelve con estado vacío recibe la copia, no un vacío", async () => {
    // Hallazgo de la revisión adversarial 2026-08-03: mesonero → Link "Menú"
    // → Atrás. El componente remonta con orders=[], pero el módulo JS (y el
    // validador) sobreviven. El primer sondeo del remontaje recibía 304 y el
    // panel quedaba EN BLANCO sin error. Con la copia local, ese primer
    // sondeo pinta los datos aunque el servidor responda 304.
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, '"v1"', '{"openAccounts":[{"id":"cuenta-1"}]}'),
    )
    await fetchWithPollEtag("/api/open-accounts?status=Abierta")

    // (remontaje: el estado del componente se pierde, el módulo no)

    fetchMock.mockResolvedValueOnce(fakeResponse(304))
    const primerSondeoTrasRemontar = await fetchWithPollEtag(
      "/api/open-accounts?status=Abierta",
    )

    expect(primerSondeoTrasRemontar.notModified).toBe(false)
    expect(await primerSondeoTrasRemontar.response!.json()).toEqual({
      openAccounts: [{ id: "cuenta-1" }],
    })
  })

  it("REGRESIÓN cuerpo truncado: si el stream se corta, NO queda validador registrado", async () => {
    // Hallazgo de la revisión adversarial 2026-08-03: registrar el ETag al
    // llegar las cabeceras, antes de leer el cuerpo, dejaba un 304 fijado
    // sobre datos que el panel nunca pintó (y silenciaba el aviso sonoro del
    // pedido que venía en ese cuerpo perdido).
    fetchMock.mockResolvedValueOnce(truncatedResponse('"v1"'))
    await expect(fetchWithPollEtag("/api/orders")).rejects.toThrow(
      /interrupted/,
    )

    // El siguiente sondeo pide el cuerpo completo, sin If-None-Match.
    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"v1"', '{"orders":[]}'))
    await fetchWithPollEtag("/api/orders")
    const headers = fetchMock.mock.calls[1][1].headers as Headers
    expect(headers.get("if-none-match")).toBeNull()
  })

  it("cada URL guarda su propio validador y su propia copia", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"orders"', '{"orders":[]}'))
    await fetchWithPollEtag("/api/orders")

    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, '"cuentas"', '{"openAccounts":[]}'),
    )
    await fetchWithPollEtag("/api/open-accounts?status=Abierta")

    fetchMock.mockResolvedValueOnce(fakeResponse(304))
    const result = await fetchWithPollEtag("/api/orders")

    const headers = fetchMock.mock.calls[2][1].headers as Headers
    expect(headers.get("if-none-match")).toBe('"orders"')
    expect(await result.response!.json()).toEqual({ orders: [] })
  })

  it("un error olvida la copia: el siguiente sondeo pide el cuerpo completo", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"v1"'))
    await fetchWithPollEtag("/api/orders")

    // 500 (o 401/403/429): la respuesta de error se entrega al caller tal
    // cual (sus mensajes se leen como siempre), pero la copia se descarta.
    const errorResponse = fakeResponse(500)
    fetchMock.mockResolvedValueOnce(errorResponse)
    const conError = await fetchWithPollEtag("/api/orders")
    expect(conError.notModified).toBe(false)
    expect(conError.response).toBe(errorResponse)

    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"v2"'))
    await fetchWithPollEtag("/api/orders")
    const headers = fetchMock.mock.calls[2][1].headers as Headers
    expect(headers.get("if-none-match")).toBeNull()
  })

  it("un 200 sin ETag pasa intacto y no envenena el estado", async () => {
    const plain = fakeResponse(200)
    fetchMock.mockResolvedValueOnce(plain)
    const result = await fetchWithPollEtag("/api/orders")

    expect(result.notModified).toBe(false)
    expect(result.response).toBe(plain)

    fetchMock.mockResolvedValueOnce(fakeResponse(200, '"v1"'))
    await fetchWithPollEtag("/api/orders")
    const headers = fetchMock.mock.calls[1][1].headers as Headers
    expect(headers.get("if-none-match")).toBeNull()
  })

  it("un 304 huérfano (sin copia local) se salta el tick en vez de inventar datos", async () => {
    // Solo puede pasar si el servidor responde 304 sin que mandáramos
    // If-None-Match (mal proxy): no hay nada que entregar, el caller salta.
    fetchMock.mockResolvedValueOnce(fakeResponse(304))
    const result = await fetchWithPollEtag("/api/orders")

    expect(result.notModified).toBe(true)
    expect(result.response).toBeNull()
  })
})

describe("createHiddenPollGate", () => {
  // Reloj de "último cambio" que los tests mueven a mano. Arrancarlo muy alto
  // equivale a "acaba de pasar algo", que es lo normal durante el servicio.
  let ultimoCambioSimulado = Number.MAX_SAFE_INTEGER
  const activo = () => ultimoCambioSimulado

  it("con la pestaña visible y actividad reciente, cada tick trabaja", () => {
    const gate = createHiddenPollGate(() => false, activo)

    expect(gate.shouldPoll(0)).toBe(true)
    expect(gate.shouldPoll(2_500)).toBe(true)
    expect(gate.shouldPoll(5_000)).toBe(true)
  })

  it("durante el servicio NO se espacia: cualquier cambio reinicia el reloj", () => {
    // Simula una noche de trabajo: algo cambia cada 30 s (entra un pedido,
    // cocina marca listo, caja cobra). El sondeo nunca debe frenarse.
    let ultimoCambio = 0
    const gate = createHiddenPollGate(() => false, () => ultimoCambio)

    for (let t = 0; t <= 10 * 60_000; t += 2_500) {
      if (t % 30_000 === 0) ultimoCambio = t
      expect(gate.shouldPoll(t)).toBe(true)
    }
  })

  it("con el local quieto 3 min baja a 1 sondeo cada 10 s", () => {
    const gate = createHiddenPollGate(() => false, () => 0)

    expect(gate.shouldPoll(3 * 60_000)).toBe(true)
    // Los ticks de 2,5 s siguientes no trabajan hasta cumplir los 10 s.
    expect(gate.shouldPoll(3 * 60_000 + 2_500)).toBe(false)
    expect(gate.shouldPoll(3 * 60_000 + 7_500)).toBe(false)
    expect(gate.shouldPoll(3 * 60_000 + 10_001)).toBe(true)
  })

  it("con el local quieto 15 min baja a 1 sondeo cada 30 s", () => {
    const gate = createHiddenPollGate(() => false, () => 0)

    expect(gate.shouldPoll(15 * 60_000)).toBe(true)
    expect(gate.shouldPoll(15 * 60_000 + 10_001)).toBe(false)
    expect(gate.shouldPoll(15 * 60_000 + 30_001)).toBe(true)
  })

  it("en cuanto algo cambia, vuelve al ritmo rápido de inmediato", () => {
    let ultimoCambio = 0
    const gate = createHiddenPollGate(() => false, () => ultimoCambio)

    const dormido = 20 * 60_000
    expect(gate.shouldPoll(dormido)).toBe(true)
    expect(gate.shouldPoll(dormido + 2_500)).toBe(false)

    // Entra un pedido (o alguien toca la pantalla).
    ultimoCambio = dormido + 3_000
    expect(gate.shouldPoll(dormido + 5_000)).toBe(true)
    expect(gate.shouldPoll(dormido + 7_500)).toBe(true)
  })

  it("la pestaña oculta manda sobre los escalones de calma", () => {
    // Con actividad recientísima (que si no habría escalón de calma) pero la
    // pestaña oculta, gana el minuto de la regla de visibilidad.
    const t0 = 1_800_000_000_000
    ultimoCambioSimulado = t0
    const gate = createHiddenPollGate(() => true, activo)

    expect(gate.shouldPoll(t0)).toBe(true)
    expect(gate.shouldPoll(t0 + 30_000)).toBe(false)
    expect(gate.shouldPoll(t0 + 60_001)).toBe(true)
  })

  it("oculta: los ticks se espacian a 1 por minuto, sin pararse del todo", () => {
    let hidden = false
    const gate = createHiddenPollGate(() => hidden, activo)

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
    const gate = createHiddenPollGate(() => hidden, activo)

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

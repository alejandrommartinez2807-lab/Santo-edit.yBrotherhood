// Herramientas compartidas de los sondeos de los paneles de staff (caja,
// cocina, delivery, mesonero, pantalla, cocina-productos y /pedidos).
//
// Contexto (medido 2026-08-03): /api/orders pesaba 264 KB y cada pantalla lo
// pedía entera cada 2,5 s aunque nada cambiara ≈ 380 MB/hora por pestaña.
// Tres remedios viven aquí:
//
// 1. fetchWithPollEtag — manda If-None-Match con el ETag de la última
//    respuesta; si el servidor contesta 304 (nada cambió), no hay cuerpo que
//    descargar ni estado que re-renderizar. El ETag se guarda en memoria JS
//    porque todo /api/* viaja con `Cache-Control: no-store` (a propósito: la
//    caché HTTP del navegador mezclaría sedes/roles) y por eso el navegador
//    jamás revalida solo.
//
// 2. createHiddenPollGate — con la pestaña oculta el sondeo baja a 1 tick por
//    minuto en vez de pararse en seco: una tablet olvidada deja de costar como
//    una en uso, pero el "latido" que despachan los GET de /api/orders
//    (encuestas, alertas de reposición, auto-anulaciones) y los avisos sonoros
//    de cocina no se mueren, solo se espacian.
//
// 3. getLiveOrdersWindowStartIso — el inicio de la jornada de negocio en curso
//    (corte 5:00 de Caracas, igual que el cierre de /pedidos), para que los
//    paneles operativos pidan /api/orders?createdFrom=... y el servidor no
//    cargue el histórico completo. El servidor devuelve además cualquier
//    pedido aún vivo de jornadas anteriores, así que nada operativo se pierde.

export type ConditionalFetchResult =
  | { notModified: true; response: null }
  | { notModified: false; response: Response }

// El validador viaja SIEMPRE con su cuerpo: ante un 304 se le entrega al
// caller una respuesta 200 sintetizada desde esta copia, así el panel se
// comporta EXACTAMENTE igual que antes de la optimización (mismo parse, mismo
// estado en cada tick) y solo los bytes dejan de viajar. Guardar el ETag solo,
// sin cuerpo, tenía dos fallos reales (revisión adversarial 2026-08-03): un
// panel que REMONTA con estado vacío (Link + Atrás del App Router) recibía
// 304 y se quedaba en blanco sin error; y un cuerpo que fallaba al parsear
// dejaba un validador registrado sobre datos que nunca se pintaron.
const cacheByUrl = new Map<string, { etag: string; bodyText: string }>()

// Momento del último cambio REAL visto por cualquier sondeo de esta pestaña.
// Lo usa la compuerta de abajo para espaciar los sondeos cuando no pasa nada:
// el 304 ahorra los bytes que van al navegador, pero la función igual lee la
// base entera en cada tick (626 KB medidos el 2026-08-04), y eso es lo que
// agotó la cuota de egress de Supabase. Un panel abierto de madrugada, con el
// local cerrado, sondeaba 1.440 veces por hora para no traer nada.
let lastChangeAt = Date.now()

export function noteRemoteChange(now = Date.now()) {
  lastChangeAt = now
}

export function getLastRemoteChangeAt() {
  return lastChangeAt
}

// La URL con createdFrom cambia una vez al día (rota la jornada): se poda el
// mapa para que las copias viejas no se acumulen para siempre.
const MAX_TRACKED_URLS = 8

function syntheticJsonResponse(entry: { etag: string; bodyText: string }) {
  return new Response(entry.bodyText, {
    status: 200,
    headers: { "content-type": "application/json", etag: entry.etag },
  })
}

export async function fetchWithPollEtag(
  url: string,
  init: RequestInit = {},
): Promise<ConditionalFetchResult> {
  const headers = new Headers(init.headers)
  const cached = cacheByUrl.get(url)

  // El validador viaja POR DUPLICADO (confirmado en producción 2026-08-04):
  // el If-None-Match no llega a la función — la capa de Vercel lo intercepta
  // y fabrica su propio 304 comparando cadenas en el borde, que sigue siendo
  // útil (0 bytes al navegador cuando las cadenas coinciden). x-poll-etag es
  // la copia que SÍ llega al origen, y es la que le permite responder sin
  // leer las filas de la base (la huella barata de /api/orders).
  if (cached) {
    headers.set("if-none-match", cached.etag)
    headers.set("x-poll-etag", cached.etag)
  }

  const response = await fetch(url, { ...init, headers })

  if (response.status === 304) {
    // Nada cambió: el caller recibe la copia local como si fuera el 200 real.
    if (cached) {
      // El validador puede rotar aunque el contenido no: la huella de
      // /api/orders lleva dentro una cubeta de tiempo (su techo de seguridad)
      // y tras rotar, el 304 trae el ETag NUEVO con el mismo contenido. Se
      // adopta conservando la copia — sin adoptarlo, todos los sondeos
      // siguientes caerían al camino caro del servidor (leer las filas) — y
      // SIN tocar el reloj de calma: no pasó nada real, los escalones de
      // espaciado no deben reiniciarse por esto.
      const rotatedEtag = response.headers.get("etag")
      const entry =
        rotatedEtag && rotatedEtag !== cached.etag
          ? { etag: rotatedEtag, bodyText: cached.bodyText }
          : cached

      if (entry !== cached) cacheByUrl.set(url, entry)

      return { notModified: false, response: syntheticJsonResponse(entry) }
    }

    // 304 sin copia local (no debería pasar: solo mandamos If-None-Match
    // cuando la hay): no hay nada que entregar, el caller salta este tick.
    return { notModified: true, response: null }
  }

  const etag = response.headers.get("etag")

  if (response.ok && etag) {
    // Se lee el cuerpo ENTERO antes de registrar el validador: si el stream
    // se corta a mitad, esto lanza y no queda ningún ETag apuntando a un
    // cuerpo que el panel nunca recibió.
    const bodyText = await response.text()

    // Contenido distinto al que ya teníamos = pasó algo de verdad. Vuelve el
    // sondeo rápido (ver createHiddenPollGate).
    if (!cached || cached.etag !== etag) noteRemoteChange()

    if (!cacheByUrl.has(url) && cacheByUrl.size >= MAX_TRACKED_URLS) {
      const oldest = cacheByUrl.keys().next().value
      if (oldest !== undefined) cacheByUrl.delete(oldest)
    }
    const entry = { etag, bodyText }
    cacheByUrl.set(url, entry)

    // El cuerpo ya se consumió aquí: se le entrega al caller uno equivalente.
    return { notModified: false, response: syntheticJsonResponse(entry) }
  }

  // Sin ETag o con error: se olvida la copia para no quedar pegados pidiendo
  // un 304 sobre un estado que ya no sabemos reproducir. La respuesta de
  // error pasa intacta (el caller lee sus mensajes como siempre).
  cacheByUrl.delete(url)

  return { notModified: false, response }
}

// Solo para pruebas: deja el estado como recién cargado.
export function __resetPollEtagsForTests() {
  cacheByUrl.clear()
}

// Con la pestaña oculta el sondeo no se corta: se espacia a este ritmo.
export const HIDDEN_POLL_INTERVAL_MS = 60_000

// Escalones de calma. Durante el servicio SIEMPRE está pasando algo (un pedido
// entra, cocina marca listo, caja cobra), así que el reloj de calma se reinicia
// constantemente y el sondeo se queda en su ritmo normal de 2,5 s: el cajero no
// nota ninguna diferencia. Los escalones solo entran cuando de verdad no pasa
// nada hace rato — que es justo cuando el sondeo no sirve para nada y sí
// consume. El umbral de 3 minutos es deliberadamente generoso: entre pedido y
// pedido de una noche floja no puede activarse, o cocina vería tarde la comanda.
export const QUIET_STEPS = [
  { afterQuietMs: 3 * 60_000, everyMs: 10_000 },
  { afterQuietMs: 15 * 60_000, everyMs: 30_000 },
]

function defaultIsHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden"
}

function quietIntervalFor(quietMs: number) {
  let chosen = 0
  for (const step of QUIET_STEPS) {
    if (quietMs >= step.afterQuietMs) chosen = step.everyMs
  }
  return chosen
}

// Si hay alguien usando el panel, el sondeo tiene que estar rápido aunque el
// local lleve horas quieto: tocar la pantalla o volver a la pestaña reinicia el
// reloj de calma. Se instala una sola vez por pestaña y no se quita.
let interactionListenerInstalled = false

function installInteractionReset() {
  if (interactionListenerInstalled) return
  if (typeof window === "undefined" || typeof document === "undefined") return

  interactionListenerInstalled = true
  const wake = () => noteRemoteChange()

  window.addEventListener("pointerdown", wake, { passive: true })
  window.addEventListener("keydown", wake, { passive: true })
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wake()
  })
}

export function createHiddenPollGate(
  isHidden: () => boolean = defaultIsHidden,
  lastChange: () => number = getLastRemoteChangeAt,
) {
  installInteractionReset()
  let lastRunAt = 0

  return {
    // Llamar en cada tick del setInterval: decide si este tick trabaja.
    shouldPoll(now = Date.now()) {
      if (isHidden() && now - lastRunAt < HIDDEN_POLL_INTERVAL_MS) {
        return false
      }

      // Pestaña a la vista pero sin novedades hace rato: se espacia.
      if (!isHidden()) {
        const minGap = quietIntervalFor(now - lastChange())
        if (minGap && now - lastRunAt < minGap) return false
      }

      lastRunAt = now
      return true
    },
  }
}

// ---------------------------------------------------------------------------
// Jornada de negocio (corte 5:00 de Caracas)
//
// Misma regla que getBusinessDayKeyInCaracas/getBusinessDayStartIso de
// src/app/pedidos/domain.tsx (decisión de Alejandro, auditoría 2026-08-02);
// se recalcula aquí, compacta, para no arrastrar ese módulo entero a los
// bundles de los paneles. El test de panelPolling la cruza contra las
// originales para que no puedan divergir en silencio.
// ---------------------------------------------------------------------------

export const LIVE_WINDOW_START_HOUR = 5

function getCaracasParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value || 0)

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
  }
}

export function getLiveOrdersWindowStartIso(now: Date = new Date()): string {
  if (Number.isNaN(now.getTime())) return ""

  const caracas = getCaracasParts(now)

  if (!caracas.year || !caracas.month || !caracas.day) return ""

  // Antes de las 5:00 de la mañana todavía corre la jornada del día anterior.
  const dayStart = new Date(
    Date.UTC(caracas.year, caracas.month - 1, caracas.day, 0, 0, 0, 0),
  )
  if (caracas.hour < LIVE_WINDOW_START_HOUR) {
    dayStart.setUTCDate(dayStart.getUTCDate() - 1)
  }

  // Las 5:00 de Caracas expresadas en UTC. Venezuela vive en UTC-4 fijo desde
  // 2016 y sin horario de verano; aun así el huso se deriva del propio Intl
  // (diferencia entre la fecha local y la UTC del mismo instante) por si
  // algún día cambia.
  const caracasMidnightUtcGuess = dayStart.getTime()
  let offsetMs = 4 * 60 * 60 * 1000
  try {
    const probe = new Date(caracasMidnightUtcGuess)
    const local = getCaracasParts(probe)
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour)
    const probeHourUtc = Date.UTC(
      probe.getUTCFullYear(),
      probe.getUTCMonth(),
      probe.getUTCDate(),
      probe.getUTCHours(),
    )
    offsetMs = probeHourUtc - localAsUtc
  } catch {
    // se queda el UTC-4 fijo
  }

  return new Date(
    caracasMidnightUtcGuess + offsetMs + LIVE_WINDOW_START_HOUR * 60 * 60 * 1000,
  ).toISOString()
}

// URL de /api/orders acotada a la jornada en curso, para los paneles que no
// necesitan histórico (cocina, cocina-productos, delivery, mesonero,
// pantalla). Caja y /pedidos NO la usan: caja muestra deudas viejas y
// /pedidos calcula el cierre y avisa de jornadas sin cerrar.
export function buildLiveOrdersUrl(now: Date = new Date()): string {
  const startIso = getLiveOrdersWindowStartIso(now)

  return startIso
    ? `/api/orders?createdFrom=${encodeURIComponent(startIso)}`
    : "/api/orders"
}

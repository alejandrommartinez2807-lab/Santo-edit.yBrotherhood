// Envío por distancia: el cliente pega su link de Google Maps (o comparte su
// GPS) y el costo del delivery se calcula por kilómetros desde la sede, con
// tarifas por rango ("hasta 10 km → $6"). Todo lo de este archivo es puro
// (sin red ni Supabase) para poder testearlo; la expansión de links cortos
// (maps.app.goo.gl) vive en la API route porque requiere fetch.

export type DeliveryDistanceTier = {
  /** Kilómetros máximos (inclusive) que cubre esta tarifa. */
  upToKm: number
  costUSD: number
}

export type DeliveryDistanceSettings = {
  enabled: boolean
  /** Link de Google Maps del local (lo pega el dueño en Configuración). */
  originMapsUrl: string
  originLat: number | null
  originLng: number | null
  /**
   * La distancia se mide en línea recta (Haversine); las rutas reales son más
   * largas. Este factor la multiplica para compensar (1.3 ≈ ciudad típica).
   */
  roadFactor: number
  tiers: DeliveryDistanceTier[]
}

export const DEFAULT_DELIVERY_DISTANCE_SETTINGS: DeliveryDistanceSettings = {
  enabled: false,
  originMapsUrl: "",
  originLat: null,
  originLng: null,
  roadFactor: 1.3,
  tiers: [
    { upToKm: 3, costUSD: 2 },
    { upToKm: 6, costUSD: 4 },
    { upToKm: 10, costUSD: 6 },
  ],
}

export type LatLng = { lat: number; lng: number }

const MAX_TIERS = 12

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function toFiniteNumber(value: unknown): number | null {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function isValidLatLng(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  // (0,0) es el "null island" de links rotos, no una dirección real.
  if (lat === 0 && lng === 0) return false
  return true
}

// ============================================================
// PARSEO DE LINKS DE GOOGLE MAPS
// ============================================================

const SHORT_LINK_HOSTS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "g.co",
  "share.google",
])

const GOOGLE_MAPS_HOSTS = /(^|\.)google\.[a-z.]{2,6}$|^maps\.google\./i

/**
 * ¿Es un link corto de Google Maps que hay que expandir con un fetch
 * (siguiendo el redirect) antes de poder leer las coordenadas?
 */
export function isShortMapsLink(value: string): boolean {
  try {
    const url = new URL(cleanText(value))
    return SHORT_LINK_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

/** ¿El texto parece un link de Google Maps (corto o completo)? */
export function looksLikeMapsLink(value: string): boolean {
  const text = cleanText(value)
  if (!text) return false
  if (isShortMapsLink(text)) return true
  try {
    const url = new URL(text)
    return GOOGLE_MAPS_HOSTS.test(url.hostname)
  } catch {
    return false
  }
}

function parsePlainCoordsText(text: string): LatLng | null {
  // "10.2345, -68.0123" pegado directo (o desde el portapapeles de Maps).
  const match = text.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/)
  if (!match) return null

  const lat = Number(match[1])
  const lng = Number(match[2])
  return isValidLatLng(lat, lng) ? { lat, lng } : null
}

function parseCoordsFromMapsUrl(rawUrl: string): LatLng | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  const decodedHref = (() => {
    try {
      return decodeURIComponent(url.href)
    } catch {
      return url.href
    }
  })()

  // 1) Pin exacto del lugar: "!3d10.23!4d-68.01" (es el marcador, no el
  //    centro del mapa, así que tiene prioridad).
  const pinMatch = decodedHref.match(/!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/)
  if (pinMatch) {
    const lat = Number(pinMatch[1])
    const lng = Number(pinMatch[2])
    if (isValidLatLng(lat, lng)) return { lat, lng }
  }

  // 2) Parámetros con coordenadas: q, query, ll, destination, daddr, center.
  const paramKeys = ["q", "query", "ll", "destination", "daddr", "center", "viewpoint"]
  for (const key of paramKeys) {
    const value = url.searchParams.get(key)
    if (!value) continue
    const coords = parsePlainCoordsText(value.replace(/\+/g, " "))
    if (coords) return coords
  }

  // 3) "@10.23,-68.01,17z" en la ruta (centro del visor: menos preciso pero
  //    suficiente cuando el cliente comparte "mi ubicación").
  const atMatch = decodedHref.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:[,/]|$)/)
  if (atMatch) {
    const lat = Number(atMatch[1])
    const lng = Number(atMatch[2])
    if (isValidLatLng(lat, lng)) return { lat, lng }
  }

  // 4) Búsquedas tipo /maps/search/10.23,+-68.01
  const searchMatch = decodedHref.match(
    /\/(?:search|place|dir)\/(-?\d{1,3}(?:\.\d+)?),\s*\+?(-?\d{1,3}(?:\.\d+)?)(?:[/?]|$)/,
  )
  if (searchMatch) {
    const lat = Number(searchMatch[1])
    const lng = Number(searchMatch[2])
    if (isValidLatLng(lat, lng)) return { lat, lng }
  }

  return null
}

/**
 * Extrae coordenadas de lo que el cliente pegue: un link completo de Google
 * Maps o unas coordenadas "lat, lng" a mano. Los links cortos devuelven null
 * (hay que expandirlos primero en el servidor con isShortMapsLink + fetch).
 */
export function parseCoordsFromText(value: string): LatLng | null {
  const text = cleanText(value)
  if (!text) return null

  const plain = parsePlainCoordsText(text)
  if (plain) return plain

  if (/^https?:\/\//i.test(text)) return parseCoordsFromMapsUrl(text)

  return null
}

// ============================================================
// DISTANCIA Y TARIFAS
// ============================================================

const EARTH_RADIUS_KM = 6371

export function haversineKm(from: LatLng, to: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function normalizeDeliveryDistanceTiers(value: unknown): DeliveryDistanceTier[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<number>()
  const tiers: DeliveryDistanceTier[] = []

  for (const rawTier of value) {
    const source = (rawTier || {}) as Record<string, unknown>
    const upToKm = toFiniteNumber(source.upToKm)
    const costUSD = toFiniteNumber(source.costUSD)

    if (upToKm === null || costUSD === null) continue
    if (upToKm <= 0 || upToKm > 200 || costUSD < 0) continue

    const roundedKm = Math.round(upToKm * 10) / 10
    if (seen.has(roundedKm)) continue
    seen.add(roundedKm)

    tiers.push({
      upToKm: roundedKm,
      costUSD: Math.round((costUSD + Number.EPSILON) * 100) / 100,
    })

    if (tiers.length >= MAX_TIERS) break
  }

  return tiers.sort((a, b) => a.upToKm - b.upToKm)
}

export function normalizeDeliveryDistanceSettings(value: unknown): DeliveryDistanceSettings {
  const source = (value || {}) as Record<string, unknown>
  const defaults = DEFAULT_DELIVERY_DISTANCE_SETTINGS

  const lat = toFiniteNumber(source.originLat)
  const lng = toFiniteNumber(source.originLng)
  const hasOrigin = lat !== null && lng !== null && isValidLatLng(lat, lng)

  const roadFactorRaw = toFiniteNumber(source.roadFactor)
  const roadFactor =
    roadFactorRaw === null ? defaults.roadFactor : Math.min(2, Math.max(1, roadFactorRaw))

  return {
    enabled: source.enabled === true,
    originMapsUrl: cleanText(source.originMapsUrl),
    originLat: hasOrigin ? lat : null,
    originLng: hasOrigin ? lng : null,
    roadFactor: Math.round(roadFactor * 100) / 100,
    tiers: normalizeDeliveryDistanceTiers(source.tiers),
  }
}

/** ¿La config está completa como para cotizar? (activa + origen + tarifas) */
export function isDeliveryDistanceReady(settings: DeliveryDistanceSettings): boolean {
  return (
    settings.enabled &&
    settings.originLat !== null &&
    settings.originLng !== null &&
    settings.tiers.length > 0
  )
}

export function getDeliveryDistanceMaxKm(settings: DeliveryDistanceSettings): number {
  return settings.tiers.length ? settings.tiers[settings.tiers.length - 1].upToKm : 0
}

export type DeliveryDistanceQuote =
  | {
      ok: true
      distanceKm: number
      costUSD: number
      tier: DeliveryDistanceTier
    }
  | {
      ok: false
      reason: "not_configured" | "out_of_range"
      distanceKm: number
      maxKm: number
    }

export function quoteDeliveryByDistance(
  settings: DeliveryDistanceSettings,
  destination: LatLng,
): DeliveryDistanceQuote {
  if (!isDeliveryDistanceReady(settings)) {
    return { ok: false, reason: "not_configured", distanceKm: 0, maxKm: 0 }
  }

  const origin: LatLng = {
    lat: settings.originLat as number,
    lng: settings.originLng as number,
  }
  const rawKm = haversineKm(origin, destination) * settings.roadFactor
  // Redondeo a 0.1 km hacia arriba: nunca cotiza por debajo de lo recorrido.
  const distanceKm = Math.ceil(rawKm * 10) / 10
  const maxKm = getDeliveryDistanceMaxKm(settings)

  const tier = settings.tiers.find((item) => distanceKm <= item.upToKm)

  if (!tier) {
    return { ok: false, reason: "out_of_range", distanceKm, maxKm }
  }

  return { ok: true, distanceKm, costUSD: tier.costUSD, tier }
}

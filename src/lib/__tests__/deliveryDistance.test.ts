import { describe, expect, it } from "vitest"

import {
  DEFAULT_DELIVERY_DISTANCE_SETTINGS,
  getDeliveryDistanceMaxKm,
  haversineKm,
  isDeliveryDistanceReady,
  isShortMapsLink,
  looksLikeMapsLink,
  normalizeDeliveryDistanceSettings,
  normalizeDeliveryDistanceTiers,
  parseCoordsFromText,
  quoteDeliveryByDistance,
} from "@/lib/deliveryDistance"

// Coordenadas reales de Valencia (Venezuela) para que los casos se lean.
const SEDE = { lat: 10.2318, lng: -68.0072 }

describe("parseCoordsFromText", () => {
  it("lee coordenadas pegadas a mano ('lat, lng')", () => {
    expect(parseCoordsFromText("10.2318, -68.0072")).toEqual({
      lat: 10.2318,
      lng: -68.0072,
    })
    expect(parseCoordsFromText("  10.2318,-68.0072  ")).toEqual({
      lat: 10.2318,
      lng: -68.0072,
    })
  })

  it("lee el pin exacto (!3d...!4d...) de un link de place", () => {
    const url =
      "https://www.google.com/maps/place/Santo+Perrito/@10.23,-68.01,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d10.2318!4d-68.0072!16s"
    expect(parseCoordsFromText(url)).toEqual({ lat: 10.2318, lng: -68.0072 })
  })

  it("prefiere el pin (!3d/!4d) sobre el centro del visor (@)", () => {
    const url =
      "https://www.google.com/maps/place/X/@9.9999,-67.9999,15z/data=!8m2!3d10.2318!4d-68.0072"
    expect(parseCoordsFromText(url)).toEqual({ lat: 10.2318, lng: -68.0072 })
  })

  it("lee links con ?q=lat,lng y ll=lat,lng", () => {
    expect(parseCoordsFromText("https://maps.google.com/?q=10.2318,-68.0072")).toEqual({
      lat: 10.2318,
      lng: -68.0072,
    })
    expect(
      parseCoordsFromText("https://www.google.com/maps?ll=10.2318,-68.0072&z=17"),
    ).toEqual({ lat: 10.2318, lng: -68.0072 })
    expect(
      parseCoordsFromText(
        "https://www.google.com/maps/search/?api=1&query=10.2318%2C-68.0072",
      ),
    ).toEqual({ lat: 10.2318, lng: -68.0072 })
  })

  it("lee el @lat,lng del visor cuando no hay pin", () => {
    const url = "https://www.google.com/maps/@10.2318,-68.0072,16.5z"
    expect(parseCoordsFromText(url)).toEqual({ lat: 10.2318, lng: -68.0072 })
  })

  it("lee /maps/search/lat,+lng", () => {
    const url = "https://www.google.com/maps/search/10.2318,+-68.0072"
    expect(parseCoordsFromText(url)).toEqual({ lat: 10.2318, lng: -68.0072 })
  })

  it("rechaza texto sin coordenadas, (0,0) y rangos inválidos", () => {
    expect(parseCoordsFromText("")).toBeNull()
    expect(parseCoordsFromText("mi casa queda por el centro")).toBeNull()
    expect(parseCoordsFromText("https://www.google.com/maps/place/Valencia")).toBeNull()
    expect(parseCoordsFromText("0,0")).toBeNull()
    expect(parseCoordsFromText("120.5, -68.0")).toBeNull()
    expect(parseCoordsFromText("10.2, -190.0")).toBeNull()
  })

  it("no intenta leer links cortos (van por expansión en el servidor)", () => {
    expect(parseCoordsFromText("https://maps.app.goo.gl/AbCdEf123")).toBeNull()
    expect(isShortMapsLink("https://maps.app.goo.gl/AbCdEf123")).toBe(true)
    expect(isShortMapsLink("https://www.google.com/maps/@10,--68,15z")).toBe(false)
    expect(isShortMapsLink("no es un link")).toBe(false)
  })

  it("looksLikeMapsLink reconoce links de maps y descarta otros", () => {
    expect(looksLikeMapsLink("https://maps.app.goo.gl/AbC")).toBe(true)
    expect(looksLikeMapsLink("https://www.google.com/maps/@10.2,-68.0,15z")).toBe(true)
    expect(looksLikeMapsLink("https://misitio.com/maps")).toBe(false)
  })
})

describe("haversineKm", () => {
  it("distancia cero al mismo punto", () => {
    expect(haversineKm(SEDE, SEDE)).toBe(0)
  })

  it("aproxima 1 grado de latitud ≈ 111 km", () => {
    const km = haversineKm({ lat: 10, lng: -68 }, { lat: 11, lng: -68 })
    expect(km).toBeGreaterThan(110)
    expect(km).toBeLessThan(112)
  })
})

describe("normalizeDeliveryDistanceSettings", () => {
  it("aplica defaults sanos a entradas vacías", () => {
    const settings = normalizeDeliveryDistanceSettings(null)
    expect(settings.enabled).toBe(false)
    expect(settings.originLat).toBeNull()
    expect(settings.tiers).toEqual([])
    expect(settings.roadFactor).toBe(DEFAULT_DELIVERY_DISTANCE_SETTINGS.roadFactor)
  })

  it("ordena tarifas por km, quita duplicados y acota valores", () => {
    const tiers = normalizeDeliveryDistanceTiers([
      { upToKm: 10, costUSD: 6 },
      { upToKm: 3, costUSD: 2 },
      { upToKm: 3, costUSD: 99 },
      { upToKm: -5, costUSD: 1 },
      { upToKm: 6, costUSD: "4" },
      { upToKm: 500, costUSD: 1 },
    ])
    expect(tiers).toEqual([
      { upToKm: 3, costUSD: 2 },
      { upToKm: 6, costUSD: 4 },
      { upToKm: 10, costUSD: 6 },
    ])
  })

  it("descarta orígenes inválidos y acota roadFactor a [1, 2]", () => {
    const settings = normalizeDeliveryDistanceSettings({
      enabled: true,
      originLat: 950,
      originLng: -68,
      roadFactor: 9,
    })
    expect(settings.originLat).toBeNull()
    expect(settings.originLng).toBeNull()
    expect(settings.roadFactor).toBe(2)
  })
})

describe("quoteDeliveryByDistance", () => {
  const settings = normalizeDeliveryDistanceSettings({
    enabled: true,
    originLat: SEDE.lat,
    originLng: SEDE.lng,
    roadFactor: 1,
    tiers: [
      { upToKm: 3, costUSD: 2 },
      { upToKm: 6, costUSD: 4 },
      { upToKm: 10, costUSD: 6 },
    ],
  })

  it("cobra la tarifa del rango que cubre la distancia", () => {
    // ~2.2 km al norte (0.02 grados de latitud)
    const quote = quoteDeliveryByDistance(settings, {
      lat: SEDE.lat + 0.02,
      lng: SEDE.lng,
    })
    expect(quote.ok).toBe(true)
    if (quote.ok) {
      expect(quote.costUSD).toBe(2)
      expect(quote.distanceKm).toBeGreaterThan(2)
      expect(quote.distanceKm).toBeLessThanOrEqual(3)
    }
  })

  it("a 10 km a la redonda cobra $6 (el ejemplo del negocio)", () => {
    // ~8.9 km (0.08 grados de latitud)
    const quote = quoteDeliveryByDistance(settings, {
      lat: SEDE.lat + 0.08,
      lng: SEDE.lng,
    })
    expect(quote.ok).toBe(true)
    if (quote.ok) expect(quote.costUSD).toBe(6)
  })

  it("fuera del último rango no cotiza (out_of_range)", () => {
    const quote = quoteDeliveryByDistance(settings, {
      lat: SEDE.lat + 0.2,
      lng: SEDE.lng,
    })
    expect(quote.ok).toBe(false)
    if (!quote.ok) {
      expect(quote.reason).toBe("out_of_range")
      expect(quote.maxKm).toBe(10)
      expect(quote.distanceKm).toBeGreaterThan(10)
    }
  })

  it("el roadFactor alarga la distancia cotizada", () => {
    const withFactor = normalizeDeliveryDistanceSettings({
      ...settings,
      roadFactor: 1.5,
    })
    const destination = { lat: SEDE.lat + 0.02, lng: SEDE.lng }
    const straight = quoteDeliveryByDistance(settings, destination)
    const adjusted = quoteDeliveryByDistance(withFactor, destination)
    expect(straight.ok && adjusted.ok).toBe(true)
    if (straight.ok && adjusted.ok) {
      expect(adjusted.distanceKm).toBeGreaterThan(straight.distanceKm)
    }
  })

  it("sin configurar no cotiza (not_configured)", () => {
    const empty = normalizeDeliveryDistanceSettings({ enabled: true })
    expect(isDeliveryDistanceReady(empty)).toBe(false)
    const quote = quoteDeliveryByDistance(empty, SEDE)
    expect(quote.ok).toBe(false)
    if (!quote.ok) expect(quote.reason).toBe("not_configured")
  })

  it("getDeliveryDistanceMaxKm devuelve el último rango", () => {
    expect(getDeliveryDistanceMaxKm(settings)).toBe(10)
  })
})

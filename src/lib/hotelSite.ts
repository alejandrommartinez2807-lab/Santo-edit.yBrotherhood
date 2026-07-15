// Contenido editable del sitio público del hotel que NO vive en hotel_profile
// (tabla) sino en business_config (JSON, sin migración): portada, sellos,
// redes y el detalle comercial por tipo de habitación. Igual que
// hotelBookingFields/hotelTermsText, el normalizador canónico de
// ordersBusinessConfig contempla estas claves para que sobrevivan al guardado.

export type HotelSiteExtras = {
  /** URL de la foto de portada (hero). Vacío ⇒ usa la foto demo del template. */
  heroUrl: string
  /** Frase corta bajo las estrellas ("Hotel 5 estrellas · Valencia"). */
  tagline: string
  /** Estrellas del hotel (0 = ocultar la fila de estrellas). */
  stars: number
  /** Sellos de la franja bajo el hero, separados por coma o salto de línea. */
  hallmarks: string
  /** Cita editorial de la banda con foto ("Una experiencia inolvidable…"). */
  quote: string
  /** Búsqueda del mapa de Google (vacío ⇒ usa la dirección del perfil). */
  mapsQuery: string
  /** WhatsApp con código de país (solo dígitos; habilita el botón flotante). */
  whatsapp: string
  instagram: string
  facebook: string
  tiktok: string
  /**
   * Reseñas de Google Maps: el dueño publica el total real de su ficha para
   * que la landing muestre "4.8 · 1.240 opiniones" aunque el sistema interno
   * tenga menos reseñas. 0 ⇒ usar el conteo interno.
   */
  googleReviewsCount: number
  /** Calificación de la ficha de Google (0 ⇒ usar el promedio interno). */
  googleReviewsRating: number
  /** Enlace a la ficha/reseñas de Google (botón "Ver en Google"). */
  googleReviewsUrl: string
}

export const DEFAULT_HOTEL_SITE_EXTRAS: HotelSiteExtras = {
  heroUrl: "",
  tagline: "",
  stars: 5,
  hallmarks: "",
  quote: "",
  mapsQuery: "",
  whatsapp: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  googleReviewsCount: 0,
  googleReviewsRating: 0,
  googleReviewsUrl: "",
}

function cleanText(value: unknown, max = 300): string {
  return String(value ?? "").trim().slice(0, max)
}

export function normalizeHotelSiteExtras(value: unknown): HotelSiteExtras {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const stars = Number(source.stars)
  const googleCount = Number(source.googleReviewsCount)
  const googleRating = Number(source.googleReviewsRating)
  return {
    heroUrl: cleanText(source.heroUrl, 500),
    tagline: cleanText(source.tagline, 120),
    stars: Number.isFinite(stars) ? Math.min(5, Math.max(0, Math.round(stars))) : DEFAULT_HOTEL_SITE_EXTRAS.stars,
    hallmarks: cleanText(source.hallmarks, 400),
    quote: cleanText(source.quote, 240),
    mapsQuery: cleanText(source.mapsQuery, 300),
    whatsapp: cleanText(source.whatsapp, 20).replace(/\D+/g, ""),
    instagram: cleanText(source.instagram, 120),
    facebook: cleanText(source.facebook, 200),
    tiktok: cleanText(source.tiktok, 120),
    googleReviewsCount: Number.isFinite(googleCount)
      ? Math.min(1_000_000, Math.max(0, Math.round(googleCount)))
      : 0,
    googleReviewsRating: Number.isFinite(googleRating)
      ? Math.min(5, Math.max(0, Math.round(googleRating * 10) / 10))
      : 0,
    googleReviewsUrl: cleanText(source.googleReviewsUrl, 300),
  }
}

/** Sellos como lista limpia (para renderizar). */
export function hotelHallmarksList(extras: HotelSiteExtras): string[] {
  return extras.hallmarks
    .split(/[,\n]/)
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, 6)
}

// ---------------------------------------------------------------------------
// Detalle comercial por tipo de habitación (camas, tamaño, vista, amenidades).
// Se guarda como mapa roomTypeId → detalle; el motor público lo adjunta a cada
// tipo para que la tarjeta venda de verdad (como Marriott/Hilton/Cloudbeds).
// ---------------------------------------------------------------------------

export type HotelRoomTypeDetails = {
  /** Camas, p. ej. "1 cama king" o "2 dobles + sofá cama". */
  beds: string
  /** Tamaño en m² (texto corto, p. ej. "32"). */
  sizeM2: string
  /** Vista, p. ej. "Vista a la ciudad". */
  view: string
  /** Amenidades del tipo separadas por coma (wifi, A/C, TV, minibar…). */
  amenities: string
  /**
   * Servicios INCLUIDOS con la tarifa, separados por coma (desayuno buffet,
   * estacionamiento, acceso al spa…). Salen al reservar como "Incluye: …".
   */
  includes: string
}

export type HotelRoomTypeDetailsMap = Record<string, HotelRoomTypeDetails>

const MAX_ROOM_TYPE_DETAILS = 60

export function normalizeHotelRoomTypeDetails(value: unknown): HotelRoomTypeDetailsMap {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const result: HotelRoomTypeDetailsMap = {}
  let count = 0
  for (const [key, raw] of Object.entries(source)) {
    if (count >= MAX_ROOM_TYPE_DETAILS) break
    const id = cleanText(key, 60)
    if (!id || !raw || typeof raw !== "object") continue
    const d = raw as Record<string, unknown>
    const details: HotelRoomTypeDetails = {
      beds: cleanText(d.beds, 80),
      sizeM2: cleanText(d.sizeM2, 10).replace(/[^\d.]/g, ""),
      view: cleanText(d.view, 80),
      amenities: cleanText(d.amenities, 400),
      includes: cleanText(d.includes, 400),
    }
    // Solo guardamos tipos con algún dato real (no basura vacía).
    if (details.beds || details.sizeM2 || details.view || details.amenities || details.includes) {
      result[id] = details
      count++
    }
  }
  return result
}

/** Amenidades de un tipo como lista limpia. */
export function roomTypeAmenitiesList(details: HotelRoomTypeDetails | null | undefined): string[] {
  return (details?.amenities || "")
    .split(/[,\n]/)
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 10)
}

/** Servicios incluidos con la tarifa de un tipo, como lista limpia. */
export function roomTypeIncludesList(details: HotelRoomTypeDetails | null | undefined): string[] {
  return (details?.includes || "")
    .split(/[,\n]/)
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 10)
}

// ---------------------------------------------------------------------------
// Upsell del motor de reservas: qué servicios/paquetes se ofrecen al reservar
// y cómo se muestran (con fotos editables por el dueño o solo texto). Las
// imágenes viven como URLs en business_config (sin migración): un mapa
// serviceId/packageId → enlace de la foto (Storage o externa).
// ---------------------------------------------------------------------------

export type HotelUpsellConfig = {
  /** Ofrecer los servicios del resort (spa, tours…) dentro del flujo de reserva. */
  showServices: boolean
  /** Ofrecer los paquetes del hotel dentro del flujo de reserva. */
  showPackages: boolean
  /** "fotos" = tarjetas con imagen; "texto" = solo menciones (a gusto del dueño). */
  style: "fotos" | "texto"
  /** serviceId → URL de la foto. */
  serviceImages: Record<string, string>
  /** packageId → URL de la foto. */
  packageImages: Record<string, string>
}

export const DEFAULT_HOTEL_UPSELL: HotelUpsellConfig = {
  showServices: true,
  showPackages: true,
  style: "fotos",
  serviceImages: {},
  packageImages: {},
}

const MAX_UPSELL_IMAGES = 80

function normalizeImageMap(value: unknown): Record<string, string> {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const result: Record<string, string> = {}
  let count = 0
  for (const [key, raw] of Object.entries(source)) {
    if (count >= MAX_UPSELL_IMAGES) break
    const id = cleanText(key, 60)
    const url = cleanText(raw, 500)
    if (!id || !url) continue
    result[id] = url
    count++
  }
  return result
}

export function normalizeHotelUpsell(value: unknown): HotelUpsellConfig {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const style = cleanText(source.style, 10).toLowerCase()
  return {
    showServices: source.showServices !== false,
    showPackages: source.showPackages !== false,
    style: style === "texto" ? "texto" : "fotos",
    serviceImages: normalizeImageMap(source.serviceImages),
    packageImages: normalizeImageMap(source.packageImages),
  }
}

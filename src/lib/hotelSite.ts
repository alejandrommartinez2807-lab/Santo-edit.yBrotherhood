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
}

function cleanText(value: unknown, max = 300): string {
  return String(value ?? "").trim().slice(0, max)
}

export function normalizeHotelSiteExtras(value: unknown): HotelSiteExtras {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const stars = Number(source.stars)
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
    }
    // Solo guardamos tipos con algún dato real (no basura vacía).
    if (details.beds || details.sizeM2 || details.view || details.amenities) {
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

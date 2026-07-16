// ============================================================
// MODO DEMO ESTÁTICO del sitio público del hotel (sin Supabase).
// ------------------------------------------------------------
// Las páginas demo por prospecto (patrón demo-express) se publican con env
// dummy: todas las llamadas a la base lanzan y las APIs públicas devolvían
// 500 → landing vacía. Con `BRAND.demoMode: true`, el catch de cada ruta
// pública de /api/public/hotel responde con ESTE contenido de respaldo para
// que la landing y el motor de reservas se vean completos y el flujo de
// reservar termine en una confirmación simulada (nada se persiste).
//
// En la plantilla base `demoMode` queda en false: con Supabase real este
// archivo está dormido y ningún error de producción se enmascara.
//
// PARA CADA INSTANCIA/PROSPECTO: editar solo el bloque de CONTENIDO
// (perfil, extras, tipos de habitación, servicios, paquetes y reseñas)
// con los datos reales del negocio. Los builders de abajo no se tocan.
// ============================================================

import { BRAND } from "@/lib/brand"
import {
  DEFAULT_HOTEL_BOOKING_FIELDS,
  DEFAULT_HOTEL_TERMS,
} from "@/lib/hotelBooking"
import {
  isValidStayRange,
  nightsBetween,
  normalizeStayDate,
} from "@/lib/hotelReservationConflicts"

/** true solo en instancias demo publicadas con env dummy. */
export const HOTEL_DEMO_MODE =
  (BRAND as { demoMode?: boolean }).demoMode === true

// ---------------------------------------------------------------------------
// CONTENIDO (esto es lo que se personaliza por prospecto)
// ---------------------------------------------------------------------------

export const DEMO_HOTEL_PROFILE = {
  headline: `Bienvenido a ${BRAND.name}`,
  about:
    "Confort, gastronomía y atención de primera. Habitaciones y suites impecables, restaurante propio y un equipo dedicado a que cada estadía sea perfecta.",
  amenities:
    "Wifi de alta velocidad, Desayuno buffet, Piscina, Gimnasio, Restaurante, Estacionamiento, Aire acondicionado, Salones de eventos",
  address: BRAND.location,
  phone: BRAND.whatsapp ? `+${BRAND.whatsapp}` : "",
  email: "",
  checkinTime: "15:00",
  checkoutTime: "12:00",
}

export const DEMO_HOTEL_EXTRAS = {
  heroUrl: "",
  tagline: BRAND.tagline,
  stars: 5,
  hallmarks: "Habitaciones & Suites, Restaurante Gourmet, Piscina, Salones de eventos",
  quote: "Una experiencia pensada para que solo te ocupes de disfrutar.",
  mapsQuery: BRAND.location,
  whatsapp: BRAND.whatsapp,
  instagram: BRAND.instagram,
  facebook: "",
  tiktok: "",
  googleReviewsCount: 0,
  googleReviewsRating: 0,
  googleReviewsUrl: "",
}

export type DemoRoomType = {
  roomTypeId: string
  name: string
  description: string
  capacity: number
  freeCount: number
  baseRate: number
  photos: { url: string; caption: string }[]
  details: {
    beds: string
    sizeM2: string
    view: string
    amenities: string
    includes: string
  } | null
}

export const DEMO_ROOM_TYPES: DemoRoomType[] = [
  {
    roomTypeId: "demo-superior",
    name: "Habitación Superior",
    description: "Amplia y luminosa, ideal para parejas o viajes de trabajo.",
    capacity: 2,
    freeCount: 6,
    baseRate: 90,
    photos: [],
    details: {
      beds: "1 cama king",
      sizeM2: "28",
      view: "Vista a la ciudad",
      amenities: "Wifi, A/C, TV, Minibar, Caja fuerte",
      includes: "Desayuno buffet, Estacionamiento",
    },
  },
  {
    roomTypeId: "demo-ejecutiva",
    name: "Habitación Ejecutiva",
    description: "Espacio extra y escritorio de trabajo, en pisos altos.",
    capacity: 3,
    freeCount: 4,
    baseRate: 120,
    photos: [],
    details: {
      beds: "1 king o 2 dobles",
      sizeM2: "34",
      view: "Vista panorámica",
      amenities: "Wifi, A/C, TV, Minibar, Escritorio, Caja fuerte",
      includes: "Desayuno buffet, Estacionamiento, Late check-out sujeto a disponibilidad",
    },
  },
  {
    roomTypeId: "demo-suite",
    name: "Suite Junior",
    description: "Sala independiente y todos los detalles para una ocasión especial.",
    capacity: 4,
    freeCount: 2,
    baseRate: 180,
    photos: [],
    details: {
      beds: "1 king + sofá cama",
      sizeM2: "46",
      view: "Vista panorámica",
      amenities: "Wifi, A/C, TV, Minibar, Sala, Cafetera, Caja fuerte",
      includes: "Desayuno buffet, Estacionamiento, Amenidad de bienvenida",
    },
  },
]

export const DEMO_SERVICES = [
  {
    id: "demo-spa",
    name: "Circuito de spa",
    kind: "spa",
    description: "Masaje relajante y acceso al área húmeda (60 min).",
    price: 35,
    durationMin: 60,
    imageUrl: "",
  },
  {
    id: "demo-tour",
    name: "Tour por la ciudad",
    kind: "tour",
    description: "Recorrido guiado de medio día por los imperdibles.",
    price: 25,
    durationMin: 240,
    imageUrl: "",
  },
]

export const DEMO_PACKAGES = [
  {
    id: "demo-romance",
    name: "Noche Romántica",
    description: "Decoración especial, botella espumante y desayuno a la habitación.",
    includes: "Decoración, Espumante, Desayuno en la habitación",
    price: 45,
    imageUrl: "",
  },
]

export const DEMO_REVIEWS = [
  { guestName: "María G.", rating: 5, comment: "Atención impecable y desayuno delicioso. Volvemos seguro." },
  { guestName: "Carlos R.", rating: 5, comment: "Las habitaciones están como nuevas y el personal es de primera." },
  { guestName: "Ana P.", rating: 4, comment: "Muy buena ubicación y la piscina espectacular." },
]

// ---------------------------------------------------------------------------
// BUILDERS (forma exacta de cada respuesta pública; no editar por prospecto)
// ---------------------------------------------------------------------------

function demoUpsell() {
  return { style: "fotos" as const, services: DEMO_SERVICES, packages: DEMO_PACKAGES }
}

/** GET /api/public/hotel/profile */
export function demoProfilePayload() {
  return { ok: true, enabled: true, profile: DEMO_HOTEL_PROFILE, extras: DEMO_HOTEL_EXTRAS }
}

/** GET /api/public/hotel/review */
export function demoReviewsPayload() {
  const count = DEMO_REVIEWS.length
  const average = count
    ? Math.round((DEMO_REVIEWS.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
    : 0
  return { ok: true, enabled: true, summary: { count, average }, reviews: DEMO_REVIEWS }
}

/** GET /api/public/hotel/services */
export function demoServicesPayload() {
  return { ok: true, enabled: true, style: "fotos" as const, services: DEMO_SERVICES }
}

/** GET /api/public/hotel?checkIn=&checkOut= */
export function demoAvailabilityPayload(checkInRaw: unknown, checkOutRaw: unknown) {
  const checkIn = normalizeStayDate(checkInRaw)
  const checkOut = normalizeStayDate(checkOutRaw)
  if (!isValidStayRange({ checkIn, checkOut })) {
    return {
      ok: true,
      enabled: true,
      nights: 0,
      types: [],
      bookingFields: DEFAULT_HOTEL_BOOKING_FIELDS,
      termsText: DEFAULT_HOTEL_TERMS,
      upsell: demoUpsell(),
    }
  }
  const nights = nightsBetween(checkIn, checkOut)
  return {
    ok: true,
    enabled: true,
    nights,
    types: DEMO_ROOM_TYPES.map((t) => ({
      roomTypeId: t.roomTypeId,
      name: t.name,
      description: t.description,
      capacity: t.capacity,
      freeCount: t.freeCount,
      photos: t.photos,
      details: t.details,
      quote: {
        nights,
        total: t.baseRate * nights,
        averageRate: t.baseRate,
        seasonApplied: false,
        seasonNames: [] as string[],
      },
    })),
    bookingFields: DEFAULT_HOTEL_BOOKING_FIELDS,
    termsText: DEFAULT_HOTEL_TERMS,
    upsell: demoUpsell(),
  }
}

// Código de confirmación simulado, con pinta de código real (sin 0/O/1/I).
function demoReservationCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

type DemoBookingResult =
  | { status: number; payload: { ok: false; error: string } }
  | { status: 201; payload: { ok: true; reservation: Record<string, unknown> } }

/**
 * POST /api/public/hotel — confirma la reserva EN MEMORIA (no persiste nada):
 * el prospecto ve el flujo completo hasta el código de confirmación.
 * Replica las validaciones visibles del endpoint real para que el formulario
 * se comporte igual.
 */
export function demoReservationPayload(body: Record<string, unknown>): DemoBookingResult {
  const guestName = String(body.guestName || "").trim().slice(0, 80)
  const guestPhone = String(body.guestPhone || "").trim().slice(0, 25)
  const checkIn = normalizeStayDate(body.checkIn)
  const checkOut = normalizeStayDate(body.checkOut)
  const roomType = DEMO_ROOM_TYPES.find((t) => t.roomTypeId === String(body.roomTypeId || ""))

  if (body.termsAccepted !== true) {
    return { status: 400, payload: { ok: false, error: "Debes aceptar los términos y condiciones para reservar" } }
  }
  if (guestName.length < 3) {
    return { status: 400, payload: { ok: false, error: "Escribe tu nombre completo" } }
  }
  if (guestPhone.replace(/\D+/g, "").length < 7) {
    return { status: 400, payload: { ok: false, error: "Escribe un teléfono válido para confirmarte la reserva" } }
  }
  if (!roomType) {
    return { status: 404, payload: { ok: false, error: "Ese tipo de habitación no existe" } }
  }
  if (!isValidStayRange({ checkIn, checkOut })) {
    return {
      status: 400,
      payload: { ok: false, error: "Revisa las fechas: la salida debe ser al menos una noche después de la entrada." },
    }
  }

  const nights = nightsBetween(checkIn, checkOut)

  // Extras elegidos: se validan contra el catálogo demo y se suman igual que
  // en el endpoint real (se "pagan en el hotel", solo informativo).
  const requestedServices = Array.isArray(body.services) ? body.services.slice(0, 10) : []
  const services: { name: string; price: number; people: number; date: string }[] = []
  for (const raw of requestedServices) {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const service = DEMO_SERVICES.find((s) => s.id === String(item.id || ""))
    if (!service || services.some((s) => s.name === service.name)) continue
    const people = Math.min(Math.max(1, Number(item.people) || 1), 20)
    services.push({ name: service.name, price: service.price, people, date: checkIn })
  }
  const selectedPackage = DEMO_PACKAGES.find((p) => p.id === String(body.packageId || "")) || null
  const extrasTotal =
    services.reduce((sum, s) => sum + s.price * s.people, 0) + (selectedPackage ? selectedPackage.price : 0)

  return {
    status: 201,
    payload: {
      ok: true,
      reservation: {
        code: demoReservationCode(),
        guestName,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights,
        ratePerNight: roomType.baseRate,
        totalAmount: roomType.baseRate * nights,
        roomTypeName: roomType.name,
        services,
        packageName: selectedPackage?.name || "",
        packagePrice: selectedPackage?.price || 0,
        extrasTotal,
        membership: null,
      },
    },
  }
}

type DemoServiceBookingResult =
  | { status: number; payload: { ok: false; error: string } }
  | { status: 201; payload: { ok: true; booking: Record<string, unknown> } }

/** POST /api/public/hotel/services — reserva de servicio simulada. */
export function demoServiceBookingPayload(body: Record<string, unknown>): DemoServiceBookingResult {
  const service = DEMO_SERVICES.find((s) => s.id === String(body.serviceId || ""))
  if (!service) {
    return { status: 404, payload: { ok: false, error: "Ese servicio no está disponible" } }
  }
  const date = String(body.date || "").trim()
  if (!date) {
    return { status: 400, payload: { ok: false, error: "Indica la fecha del servicio" } }
  }
  return {
    status: 201,
    payload: {
      ok: true,
      booking: {
        serviceName: service.name,
        date,
        linkedToReservation: false,
        reservationCode: "",
      },
    },
  }
}

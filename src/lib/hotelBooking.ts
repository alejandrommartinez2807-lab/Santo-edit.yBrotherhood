// ============================================================
// FORMULARIO DE RESERVA PÚBLICO CONFIGURABLE (Hotel · demo Lidotel)
//
// El dueño decide qué datos se piden al reservar en línea y cuáles son
// obligatorios. La configuración vive en business_config (JSON, sin migración)
// bajo la clave `hotelBookingFields`; el texto de términos y condiciones bajo
// `hotelTermsText`. Este archivo es isomórfico: lo usan el formulario público,
// el editor del dueño y la validación del servidor.
// ============================================================

export type HotelBookingFieldMode = "off" | "optional" | "required"

export type HotelBookingFieldId =
  | "document"
  | "email"
  | "address"
  | "arrivalTime"
  | "requests"

export type HotelBookingFieldsConfig = Record<HotelBookingFieldId, HotelBookingFieldMode>

export const HOTEL_BOOKING_FIELD_DEFINITIONS: Array<{
  id: HotelBookingFieldId
  label: string
  placeholder: string
  maxLength: number
}> = [
  {
    id: "document",
    label: "Cédula / documento de identidad",
    placeholder: "Cédula o pasaporte",
    maxLength: 30,
  },
  { id: "email", label: "Email", placeholder: "Email", maxLength: 120 },
  { id: "address", label: "Dirección", placeholder: "Dirección", maxLength: 160 },
  {
    id: "arrivalTime",
    label: "Hora estimada de llegada",
    placeholder: "Ej: 16:30",
    maxLength: 20,
  },
  {
    id: "requests",
    label: "Solicitudes especiales",
    placeholder: "Solicitudes especiales: llegada tarde, cuna…",
    maxLength: 200,
  },
]

// Defaults = el formulario que ya existía: email y nota opcionales, resto apagado.
export const DEFAULT_HOTEL_BOOKING_FIELDS: HotelBookingFieldsConfig = {
  document: "off",
  email: "optional",
  address: "off",
  arrivalTime: "off",
  requests: "optional",
}

export function normalizeHotelBookingFields(value: unknown): HotelBookingFieldsConfig {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const result: HotelBookingFieldsConfig = { ...DEFAULT_HOTEL_BOOKING_FIELDS }
  for (const field of HOTEL_BOOKING_FIELD_DEFINITIONS) {
    const raw = source[field.id]
    if (raw === "off" || raw === "optional" || raw === "required") result[field.id] = raw
  }
  return result
}

// Términos por defecto, basados en las políticas estándar de las grandes
// cadenas (Marriott/Hilton/IHG). El dueño puede reemplazarlos por completo;
// si deja el campo vacío, vuelve este texto.
export const DEFAULT_HOTEL_TERMS = `1. Check-in a partir de las 15:00 y check-out hasta las 12:00 del mediodía.
2. Cancelación gratuita hasta 48 horas antes de la llegada; después se cobra el equivalente a 1 noche.
3. En caso de no presentarse (no-show) se cobra el equivalente a 1 noche.
4. Edad mínima para registrarse: 18 años.
5. Es obligatorio presentar un documento de identidad vigente en el check-in.
6. El huésped responde por los daños causados a la habitación o a las instalaciones durante su estadía.
7. Está prohibido fumar dentro de las habitaciones; hacerlo genera un cargo adicional de limpieza.
8. Se aceptan mascotas solo con autorización previa del hotel.
9. Los datos personales suministrados se usan únicamente para gestionar la reserva.`

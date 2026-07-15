// ============================================================
// POS DEL HOTEL · helpers puros
//
// El POS del template usa "mesas" como ubicación del pedido. En el hotel
// conviven dos operaciones: el RESTAURANTE (mesas, barra, para llevar) y las
// HABITACIONES (room service pedido desde el QR de la habitación). Estos
// helpers deciden a cuál pertenece un pedido a partir de su ubicación, para
// que Caja y Cocina puedan separarse en submódulos sin tocar el modelo.
// ============================================================

/**
 * ¿La ubicación es una habitación? Detecta "Habitación 101", "Hab 5",
 * "Suite 3", "Room 12"… (como nombra el dueño sus QR por habitación).
 */
export function isRoomServiceLocation(location: string | null | undefined): boolean {
  const clean = String(location || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
  if (!clean) return false
  return /(^|\s)(habitacion|hab\.?|suite|room)\s*#?\d*/i.test(clean)
}

/** Submódulo del POS hotelero al que pertenece una ubicación. */
export type HotelPosArea = "habitaciones" | "restaurante"

export function hotelPosAreaForLocation(location: string | null | undefined): HotelPosArea {
  return isRoomServiceLocation(location) ? "habitaciones" : "restaurante"
}

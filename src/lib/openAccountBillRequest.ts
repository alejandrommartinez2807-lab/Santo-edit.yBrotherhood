// "Pedir la cuenta" sin migración: la petición viaja como un marcador dentro
// de la nota de la cuenta abierta ([CUENTA_PEDIDA:<ISO>]). Estos helpers son
// la ÚNICA forma válida de leerlo/ponerlo/quitarlo — el marcador nunca se
// muestra crudo (el panel lo pinta como badge y la nota se enseña limpia).

const BILL_REQUEST_REGEX = /\s*\[CUENTA_PEDIDA:([^\]]*)\]\s*/

// Cuándo pidieron la cuenta (ISO) o "" si no está pedida.
export function getBillRequestedAt(note: string | null | undefined): string {
  const match = String(note || "").match(BILL_REQUEST_REGEX)
  if (!match) return ""
  const stamp = String(match[1] || "").trim()
  return Number.isFinite(Date.parse(stamp)) ? stamp : ""
}

// Nota con la petición puesta (idempotente: si ya estaba, se conserva la
// primera — la hora original es la que le importa al mesonero).
export function addBillRequestMarker(
  note: string | null | undefined,
  requestedAtISO: string,
): string {
  const clean = String(note || "").trim()
  if (BILL_REQUEST_REGEX.test(clean)) return clean
  return [clean, `[CUENTA_PEDIDA:${requestedAtISO}]`].filter(Boolean).join(" ")
}

// Nota sin el marcador (para mostrarla, y al cobrar/cerrar/atender).
export function stripBillRequestMarker(note: string | null | undefined): string {
  return String(note || "").replace(BILL_REQUEST_REGEX, " ").trim()
}

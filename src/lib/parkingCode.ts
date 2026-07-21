// Normaliza lo que el cliente escriba/escanee para consultar su ticket de
// estacionamiento. Acepta el código pelado ("p-ab12c"), el link completo del
// QR ("https://…/estacionamiento?code=P-AB12C") o texto que lo contenga.
export function extractTicketCode(input: string): string {
  const raw = String(input ?? "").trim()
  if (!raw) return ""
  // Link del QR: el código viaja en ?code=
  try {
    const url = new URL(raw)
    const fromParam = String(url.searchParams.get("code") ?? "").trim().toUpperCase()
    if (fromParam) return fromParam
  } catch {
    // no era una URL; seguimos
  }
  // Código con el formato P-XXXXX en cualquier parte del texto.
  const match = raw.toUpperCase().match(/P-[A-Z0-9]{4,8}/)
  if (match) return match[0]
  return raw.toUpperCase()
}

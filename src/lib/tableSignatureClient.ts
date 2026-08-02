// Firma de mesa del lado del navegador (auditoría 2026-08-02).
//
// Llega en el QR (`?t=`) y viaja hasta la consulta pública de la cuenta. Es lo
// que distingue al comensal sentado en la mesa de quien escribe "Mesa 1" desde
// fuera del local: sin ella el endpoint responde sin montos ni detalle de
// consumo.
//
// Se guarda en la sesión del navegador porque la carta pública navega por
// anclas y estados internos, y el parámetro puede perderse de la URL a mitad
// del flujo. Es sessionStorage y no localStorage a propósito: la firma vale
// para esta visita a la mesa, no para siempre en ese teléfono.

const STORAGE_KEY = "santo_table_signature"

function readFromUrl(): string {
  if (typeof window === "undefined") return ""

  try {
    return (new URLSearchParams(window.location.search).get("t") || "").trim()
  } catch {
    return ""
  }
}

export function getTableSignature(): string {
  if (typeof window === "undefined") return ""

  const fromUrl = readFromUrl()

  if (fromUrl) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, fromUrl)
    } catch {
      /* sin acceso a storage: se usa igual la de la URL */
    }
    return fromUrl
  }

  try {
    return (window.sessionStorage.getItem(STORAGE_KEY) || "").trim()
  } catch {
    return ""
  }
}

// Añade `&t=` a una URL de consulta de mesa, si hay firma disponible.
export function withTableSignature(url: string): string {
  const signature = getTableSignature()

  if (!signature) return url

  return `${url}${url.includes("?") ? "&" : "?"}t=${encodeURIComponent(signature)}`
}

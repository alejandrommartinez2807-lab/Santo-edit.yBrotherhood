export const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

export type Branch = {
  id: string
  name: string
  is_active: boolean
  sort_order: number
  // Marca de "modo evento": sede temporal (feria/evento) con QR propio.
  isEvent?: boolean
  // Último día del evento (YYYY-MM-DD): al terminar ese día se finaliza solo.
  eventEndDate?: string
}

export function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.localStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

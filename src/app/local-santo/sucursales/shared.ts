export const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

export type Branch = {
  id: string
  name: string
  is_active: boolean
  sort_order: number
  // Marca de "modo evento": sede temporal (feria/evento) con QR propio.
  isEvent?: boolean
}

export function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

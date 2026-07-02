// Sucursal seleccionada en el navegador (lado cliente). El staff elige su local
// y se guarda aquí; el AuthBridge la adjunta como header x-branch-id a cada
// llamada /api, de modo que toda la operación queda scopeada a esa sucursal.

export const BRANCH_STORAGE_KEY = "santo_branch_id"
export const BRANCH_CHANGE_EVENT = "santo:branch-change"

export function getSelectedBranchId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(BRANCH_STORAGE_KEY) || null
  } catch {
    return null
  }
}

export type StaffBranch = { id: string; name: string; is_active?: boolean }

// Cabecera con la clave privada guardada (modo .env). El AuthBridge solo
// adjunta el token de Supabase; cuando el ingreso fue por contraseña hay que
// mandarla explícitamente o /api/branches responde 401.
export function getStoredPasswordHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const password = window.sessionStorage.getItem("santo_perrito_owner_session")
    if (password) return { "x-admin-password": password }
  } catch {
    /* sin acceso a storage */
  }
  return {}
}

// Sucursales activas permitidas para el usuario actual (el backend ya filtra
// por permisos). Devuelve [] si no hay sesión o el negocio no usa sedes.
export async function fetchActiveBranches(): Promise<StaffBranch[]> {
  try {
    const res = await fetch("/api/branches", {
      cache: "no-store",
      headers: getStoredPasswordHeaders(),
    })
    if (!res.ok) return []
    const json = await res.json()
    return ((json.branches || []) as StaffBranch[]).filter(
      (branch) => branch.is_active !== false,
    )
  } catch {
    return []
  }
}

export function setSelectedBranchId(branchId: string | null) {
  if (typeof window === "undefined") return
  try {
    if (branchId) window.localStorage.setItem(BRANCH_STORAGE_KEY, branchId)
    else window.localStorage.removeItem(BRANCH_STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(BRANCH_CHANGE_EVENT, { detail: branchId }))
  } catch {
    /* sin acceso a storage */
  }
}

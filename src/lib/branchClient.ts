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

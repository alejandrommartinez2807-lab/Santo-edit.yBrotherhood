import { getDefaultBranchId } from "@/lib/branch"
import { getMenuProducts, type MenuProduct } from "@/lib/orders"

// Menú público efectivo de una sede. Una sede activa puede no tener menú
// propio todavía (recién creada, o el navegador guardó un id de sede que ya
// no existe): en ese caso hereda el menú de la sede por defecto en vez de
// dejar la página pública sin productos, porque el menú base (fallback
// estático) puede estar vacío en las marcas white-label.

type Deps = {
  getMenuProducts: typeof getMenuProducts
  getDefaultBranchId: typeof getDefaultBranchId
}

export async function getPublicMenuProductsForBranch(
  branchId: string | null,
  deps: Deps = { getMenuProducts, getDefaultBranchId },
): Promise<MenuProduct[]> {
  if (!branchId) return deps.getMenuProducts({}, branchId)

  // Un id de sede dañado (uuid inválido guardado en el navegador) no debe
  // tumbar el menú: se trata como sede sin productos y hereda el principal.
  const ownProducts = await deps.getMenuProducts({}, branchId).catch(() => [] as MenuProduct[])
  if (ownProducts.length > 0) return ownProducts

  const defaultBranchId = await deps.getDefaultBranchId()
  if (!defaultBranchId || defaultBranchId === branchId) return ownProducts

  return deps.getMenuProducts({}, defaultBranchId)
}

import { getBranchConfig } from "@/lib/branch"
import { getRawBusinessConfig } from "@/lib/orders"

// Mesas EFECTIVAS de una sede (H13, auditoría 2026-07-24): el override por
// sede (branchConfigs[id].localTables, editable en "Mesas y QR") pisa las mesas
// globales — la misma regla que ya aplicaba /api/public/business-config. Las
// rutas públicas de mesa y las reservas validaban contra las mesas GLOBALES:
// con 2 sedes, el QR de "Mesa 5" de San Diego respondía "Mesa no encontrada"
// o abría cuenta para una mesa que en esa sede no existe.
export async function getLocalTablesForBranch(
  branchId: string | null | undefined,
  globalTables: unknown,
): Promise<unknown> {
  if (!branchId) return globalTables

  try {
    const branchConfig = getBranchConfig(await getRawBusinessConfig(), branchId)
    if ("localTables" in branchConfig) return branchConfig.localTables
  } catch {
    // La config por sede es opcional: sin ella valen las mesas globales.
  }

  return globalTables
}

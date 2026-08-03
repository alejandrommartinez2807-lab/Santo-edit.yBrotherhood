import { NextResponse, type NextRequest } from "next/server"
import { getRawBusinessConfig } from "@/lib/orders"
import {
  buildSafePublicBranches,
  getBranchById,
  getExplicitBranchIdFromRequest,
  getActiveBranches,
  buildSafePublicBranch,
} from "@/lib/branch"
import { autoFinalizeExpiredEvents } from "@/lib/branchProvisioning"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"
import { NO_STORE_HEADERS, publicReadHeaders } from "@/lib/publicCacheHeaders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Ojo: esta ruta además finaliza sola los eventos vencidos, y hasta ahora eso
// se intentaba en CADA visita del público. Con un minuto de caché el barrido
// pasa a correr como mucho una vez por minuto (el refresco por detrás lo
// sigue disparando), que es de sobra para que un evento vencido salga del
// listado.
const CACHE_SECONDS = 60
const STALE_SECONDS = 3600

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-branches-get",
    limit: 240,
    windowMs: 60_000,
    message: "Demasiadas consultas de sedes. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const [loadedBranches, rawBusinessConfig] = await Promise.all([
      getActiveBranches(),
      getRawBusinessConfig(),
    ])

    // Eventos con fecha de fin vencida: se finalizan solos y salen del público
    // (el QR de la feria deja de aplicar sin que el dueño tenga que acordarse).
    const expiredEventIds = await autoFinalizeExpiredEvents(loadedBranches, rawBusinessConfig)
    const activeBranches = expiredEventIds.length
      ? loadedBranches.filter((branch) => !expiredEventIds.includes(String(branch.id)))
      : loadedBranches

    const explicitBranchId = getExplicitBranchIdFromRequest(request)
    const selectedBranch = getBranchById(activeBranches, explicitBranchId) || activeBranches[0] || null
    const publicBranches = buildSafePublicBranches(activeBranches, rawBusinessConfig)

    return NextResponse.json(
      {
        ok: true,
        branches: publicBranches,
        selectedBranchId: selectedBranch?.id ?? null,
        selectedBranch: buildSafePublicBranch(selectedBranch, rawBusinessConfig),
        branchCount: publicBranches.length,
        requiresBranchSelection: publicBranches.length > 1 && !explicitBranchId,
      },
      { headers: publicReadHeaders(request, CACHE_SECONDS, STALE_SECONDS) },
    )
  } catch (error) {
    captureError(error, { route: "/api/public/branches", action: "GET" })

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudieron cargar las sedes públicas",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }
}

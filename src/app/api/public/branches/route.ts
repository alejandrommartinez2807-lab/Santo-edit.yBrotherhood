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

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
}

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
      { headers: NO_STORE_HEADERS },
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

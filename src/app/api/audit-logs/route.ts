import { NextRequest, NextResponse } from "next/server"
import { getRequestAccess } from "@/lib/localAccess"
import { enforceApiReadGuards } from "@/lib/apiReadGuards"
import { getAuditLogs } from "@/lib/audit"
import { resolveBranchId } from "@/lib/branch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

export async function GET(request: NextRequest) {
  const guardResponse = enforceApiReadGuards(request, {
    id: "api-audit-logs-get",
    limit: 120,
    windowMs: 60_000,
    rateLimitMessage: "Demasiadas consultas a la bitácora. Espera unos segundos.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = getRequestAccess(request, getRequestPassword(request))
    if (!access.ok) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    if (access.role !== "owner" && access.role !== "support") {
      return NextResponse.json(
        { error: "Solo el dueño o soporte pueden ver la bitácora" },
        { status: 403 },
      )
    }

    const params = request.nextUrl.searchParams
    // Sede (auditoría 2026-07-24): antes el branchId venía SOLO del query y la
    // UI nunca lo mandaba — la bitácora mezclaba las 2 sedes sin distinguir.
    // Por defecto se usa la sede activa del panel; ?scope=all consolida.
    const consolidated = params.get("scope") === "all"
    const logs = await getAuditLogs({
      branchId: consolidated
        ? null
        : params.get("branchId") || (await resolveBranchId(request)),
      action: params.get("action"),
      entityType: params.get("entityType"),
      fromDate: params.get("fromDate"),
      toDate: params.get("toDate"),
      limit: Number(params.get("limit")) || 100,
      offset: Number(params.get("offset")) || 0,
    })

    return NextResponse.json({ ok: true, logs })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo cargar la bitácora",
      },
      { status: 500 },
    )
  }
}

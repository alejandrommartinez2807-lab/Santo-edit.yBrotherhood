import { NextRequest, NextResponse } from "next/server"
import { getRequestAccess } from "@/lib/localAccess"
import { enforceApiReadGuards } from "@/lib/apiReadGuards"
import { getAuditLogs } from "@/lib/audit"

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
    const logs = await getAuditLogs({
      branchId: params.get("branchId"),
      action: params.get("action"),
      entityType: params.get("entityType"),
      fromDate: params.get("fromDate"),
      toDate: params.get("toDate"),
      limit: Number(params.get("limit")) || 100,
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

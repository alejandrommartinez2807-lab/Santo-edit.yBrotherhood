import { NextRequest, NextResponse } from "next/server"
import { getActiveBranchIds, getDefaultBranchId } from "@/lib/branch"
import { runAutoPromos } from "@/lib/promoDispatch"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Cron de promociones automáticas (cumpleaños, post-estadía, inactivos).
// Vercel Cron lo llama a diario con Authorization: Bearer <CRON_SECRET>.
// Sin CRON_SECRET configurado responde 401 (queda dormido).

function authorized(request: NextRequest): boolean {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) return false
  return (request.headers.get("authorization") || "") === `Bearer ${secret}`
}

async function run(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  try {
    let branchIds = await getActiveBranchIds()
    if (branchIds.length === 0) {
      const fallback = await getDefaultBranchId()
      branchIds = [fallback || ""]
    }
    const results = []
    let totalSent = 0
    let totalFailed = 0
    for (const branchId of branchIds) {
      const r = await runAutoPromos(branchId || null)
      totalSent += r.dispatch.sent
      totalFailed += r.dispatch.failed
      results.push({ branchId: branchId || null, ...r })
    }
    return NextResponse.json({ ok: true, branches: results.length, totalSent, totalFailed, results })
  } catch (error) {
    captureError(error, { route: "api/cron/promos" })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falló el cron de promos" },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return run(request)
}

export async function POST(request: NextRequest) {
  return run(request)
}

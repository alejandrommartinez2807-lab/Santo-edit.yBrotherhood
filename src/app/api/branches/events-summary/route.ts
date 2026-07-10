import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getRequestAccess } from "@/lib/localAccess"
import { getRawBusinessConfig } from "@/lib/orders"
import { getBranchConfigsFromRawBusinessConfig } from "@/lib/branch"
import { summarizeEventOrders, type EventOrderRow } from "@/lib/branchProvisioning"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Comparativo de eventos (modo evento): ventas, pedidos y promedios de cada
// feria — incluidas las finalizadas — para decidir a cuáles volver. Solo dueño.

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

export async function GET(request: NextRequest) {
  const access = getRequestAccess(request, getRequestPassword(request))
  if (!access.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (access.role !== "owner" && access.role !== "support") {
    return NextResponse.json(
      { error: "Solo el dueño puede ver el comparativo de eventos" },
      { status: 403 },
    )
  }

  try {
    const supabase = getSupabaseAdmin()
    const [{ data: branches, error }, rawBusinessConfig] = await Promise.all([
      supabase.from("branches").select("id, name, is_active, sort_order"),
      getRawBusinessConfig(),
    ])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const branchConfigs = getBranchConfigsFromRawBusinessConfig(rawBusinessConfig)
    const eventBranches = (branches ?? []).filter(
      (branch) => branchConfigs[String(branch.id)]?.isEvent === true,
    )

    const events = await Promise.all(
      eventBranches.map(async (branch) => {
        const branchId = String(branch.id)
        const { data: orderRows } = await supabase
          .from("orders")
          .select("total_usd, payment_received_equiv_usd, created_at")
          .eq("branch_id", branchId)
          .neq("status", "Cancelado")

        return {
          branchId,
          name: String(branch.name || branchId),
          isActive: branch.is_active !== false,
          eventEndDate: String(branchConfigs[branchId]?.eventEndDate || ""),
          ...summarizeEventOrders((orderRows ?? []) as EventOrderRow[]),
        }
      }),
    )

    events.sort((a, b) => b.salesUSD - a.salesUSD)

    return NextResponse.json({ ok: true, events })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo cargar el comparativo de eventos",
      },
      { status: 500 },
    )
  }
}

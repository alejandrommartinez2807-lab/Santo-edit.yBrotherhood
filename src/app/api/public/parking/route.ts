import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { computeParkingFee } from "@/lib/parkingFee"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET ?code=P-XXXXX : el cliente escanea el QR del ticket y ve cuánto debe.
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const code = String(url.searchParams.get("code") ?? "").trim().toUpperCase()
    if (!code) return NextResponse.json({ ok: false, error: "Falta el código" }, { status: 400 })
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: false, error: "No disponible" }, { status: 404 })
    const supabase = getSupabaseAdmin()
    const { data: t } = await supabase
      .from("parking_tickets")
      .select("code, plate, entered_at, exited_at, minutes, amount, currency, status")
      .eq("branch_id", branchId)
      .eq("code", code)
      .maybeSingle()
    if (!t) return NextResponse.json({ ok: false, error: "Ticket no encontrado" }, { status: 404 })

    const { data: cfg } = await supabase.from("parking_config").select("free_minutes, rate_per_hour, daily_cap, rate_currency").eq("branch_id", branchId).maybeSingle()
    const config = cfg || { free_minutes: 15, rate_per_hour: 1, daily_cap: 0, rate_currency: "USD" }

    let minutes = t.minutes
    let amount = t.amount
    if (t.status === "abierto") {
      const live = computeParkingFee(t.entered_at, Date.now(), config)
      minutes = live.minutes
      amount = live.amount
    }
    return NextResponse.json({
      ok: true,
      code: t.code, plate: t.plate, status: t.status,
      enteredAt: t.entered_at, exitedAt: t.exited_at,
      minutes, amount, currency: t.currency || config.rate_currency || "USD",
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

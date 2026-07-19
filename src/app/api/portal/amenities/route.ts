import { NextRequest, NextResponse } from "next/server"
import { getPortalResident } from "../_resident"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET (Bearer): amenidades activas del condominio (para reservar).
export async function GET(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  const { data, error } = await ctx.supabase
    .from("amenities")
    .select("id, name, description, booking_mode, open_time, close_time, fee, requires_approval")
    .eq("branch_id", ctx.branchId)
    .eq("active", true)
    .order("sort_order")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, amenities: data ?? [] })
}

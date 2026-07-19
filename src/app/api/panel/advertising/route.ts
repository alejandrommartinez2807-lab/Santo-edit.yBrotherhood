import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }
function num(v: unknown, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f }
function dateOrNull(v: unknown) { const s = text(v); return s || null }

// GET: espacios publicitarios + contrataciones.
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, spaces: [], bookings: [] })
    const supabase = getSupabaseAdmin()
    const [spacesRes, bookingsRes] = await Promise.all([
      supabase.from("ad_spaces").select("*").eq("branch_id", branchId).order("sort_order").order("name"),
      supabase.from("ad_bookings").select("*, ad_spaces(name, kind)").eq("branch_id", branchId).order("starts_on", { ascending: false }),
    ])
    if (spacesRes.error) throw new Error(spacesRes.error.message)
    return NextResponse.json({ ok: true, spaces: spacesRes.data ?? [], bookings: bookingsRes.data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "Sin centro comercial" }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const action = text(body.action)

    if (action === "space") {
      const name = text(body.name)
      if (!name) return NextResponse.json({ error: "Escribe el nombre del espacio" }, { status: 400 })
      const row = {
        branch_id: branchId, name, kind: text(body.kind) || "pantalla", location: text(body.location),
        base_price: num(body.basePrice), currency: text(body.currency) || "USD", active: body.active === undefined ? true : !!body.active,
        notes: text(body.notes),
      }
      if (body.id) {
        const { error } = await supabase.from("ad_spaces").update(row).eq("id", body.id).eq("branch_id", branchId)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }
      const { error } = await supabase.from("ad_spaces").insert(row)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    if (action === "booking") {
      const spaceId = text(body.spaceId)
      if (!spaceId) return NextResponse.json({ error: "Elige el espacio" }, { status: 400 })
      const row = {
        branch_id: branchId, space_id: spaceId,
        client_name: text(body.clientName), client_phone: text(body.clientPhone),
        resident_id: text(body.residentId) || null,
        starts_on: dateOrNull(body.startsOn), ends_on: dateOrNull(body.endsOn),
        price: num(body.price), currency: text(body.currency) || "USD",
        status: text(body.status) || "reservado",
        design_url: text(body.designUrl), proof_url: text(body.proofUrl), notes: text(body.notes),
      }
      if (body.id) {
        const { error } = await supabase.from("ad_bookings").update(row).eq("id", body.id).eq("branch_id", branchId)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }
      const { error } = await supabase.from("ad_bookings").insert(row)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    if (action === "deleteSpace") {
      const { error } = await supabase.from("ad_spaces").delete().eq("id", text(body.id)).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

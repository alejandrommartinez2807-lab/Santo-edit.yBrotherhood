import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }

export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, visitors: [], deliveries: [] })
    const supabase = getSupabaseAdmin()
    const [v, d] = await Promise.all([
      supabase.from("visitors").select("id, kind, full_name, document_number, vehicle_plate, access_code, status, valid_until, created_at, units(code)").eq("branch_id", branchId).order("created_at", { ascending: false }).limit(100),
      supabase.from("deliveries").select("id, courier, description, status, received_at, delivered_to, units(code)").eq("branch_id", branchId).order("received_at", { ascending: false }).limit(80),
    ])
    return NextResponse.json({ ok: true, visitors: v.data ?? [], deliveries: d.data ?? [] })
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
    if (!branchId) return NextResponse.json({ error: "Sin condominio" }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const kind = text(body.kind)

    if (kind === "visitorStatus") {
      const id = text(body.visitorId)
      const status = text(body.status)
      const { data: visitor } = await supabase.from("visitors").select("unit_id, full_name").eq("id", id).eq("branch_id", branchId).maybeSingle()
      const { error } = await supabase.from("visitors").update({ status }).eq("id", id).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      if (status === "dentro" || status === "salio") {
        await supabase.from("access_events").insert({ branch_id: branchId, visitor_id: id, unit_id: visitor?.unit_id || null, subject_type: "visitante", subject_label: visitor?.full_name || "", direction: status === "dentro" ? "entrada" : "salida", recorded_by: "garita" })
      }
      return NextResponse.json({ ok: true })
    }

    if (kind === "delivery") {
      const { error } = await supabase.from("deliveries").insert({ branch_id: branchId, unit_id: text(body.unitId) || null, courier: text(body.courier), description: text(body.description), status: "recibida", received_by: "conserjería" })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    if (kind === "deliveryDone") {
      const { error } = await supabase.from("deliveries").update({ status: "entregada", delivered_to: text(body.deliveredTo), delivered_at: new Date().toISOString() }).eq("id", text(body.deliveryId)).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

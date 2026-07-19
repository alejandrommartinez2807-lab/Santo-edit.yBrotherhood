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
    if (!branchId) return NextResponse.json({ ok: true, cases: [] })
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from("crm_cases").select("*").eq("branch_id", branchId).order("created_at", { ascending: false }).limit(300)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, cases: data ?? [] })
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

    if (action === "create") {
      const row = {
        branch_id: branchId, kind: text(body.kind) || "consulta", subject: text(body.subject), message: text(body.message),
        customer_name: text(body.customerName), customer_phone: text(body.customerPhone), customer_email: text(body.customerEmail),
        channel: text(body.channel) || "presencial", status: "nuevo", priority: text(body.priority) || "media",
      }
      const { error } = await supabase.from("crm_cases").insert(row)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    if (action === "update") {
      const id = text(body.id)
      if (!id) return NextResponse.json({ error: "Falta el caso" }, { status: 400 })
      const patch: Record<string, unknown> = {}
      if (body.status !== undefined) patch.status = text(body.status)
      if (body.priority !== undefined) patch.priority = text(body.priority)
      if (body.assignedTo !== undefined) patch.assigned_to = text(body.assignedTo)
      if (body.resolution !== undefined) patch.resolution = text(body.resolution)
      const { error } = await supabase.from("crm_cases").update(patch).eq("id", id).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

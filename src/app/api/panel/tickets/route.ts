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
    if (!branchId) return NextResponse.json({ ok: true, tickets: [] })
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from("tickets").select("id, code, category, priority, status, title, description, reporter_name, assigned_to, created_at, units(code)").eq("branch_id", branchId).order("created_at", { ascending: false }).limit(200)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, tickets: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

// POST: kind "update" (cambiar estado / asignar / comentar) o alta manual.
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "Sin condominio" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    if (text(body.kind) === "update") {
      const id = text(body.ticketId)
      const patch: Record<string, unknown> = {}
      if (body.status) patch.status = text(body.status)
      if (body.assignedTo !== undefined) patch.assigned_to = text(body.assignedTo)
      if (text(body.status) === "resuelto") patch.resolved_at = new Date().toISOString()
      if (Object.keys(patch).length) {
        const { error } = await supabase.from("tickets").update(patch).eq("id", id).eq("branch_id", branchId)
        if (error) throw new Error(error.message)
      }
      if (text(body.message)) {
        await supabase.from("ticket_updates").insert({ branch_id: branchId, ticket_id: id, author_label: "Administración", author_role: "admin", visibility: "publico", message: text(body.message), status_to: text(body.status) })
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

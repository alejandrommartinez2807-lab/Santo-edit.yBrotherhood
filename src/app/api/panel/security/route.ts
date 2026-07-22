import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }

const KINDS = ["ronda", "incidente", "acceso", "objeto_perdido", "emergencia", "nota"]
const SEVERITIES = ["baja", "media", "alta"]

// GET: bitácora reciente (últimos 200) + contador de abiertos.
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, entries: [], openCount: 0 })
    const supabase = getSupabaseAdmin()
    const [listRes, openRes] = await Promise.all([
      supabase
        .from("security_log")
        .select("*")
        .eq("branch_id", branchId)
        .order("happened_at", { ascending: false })
        .limit(200),
      supabase
        .from("security_log")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId)
        .eq("resolved", false),
    ])
    if (listRes.error) throw new Error(listRes.error.message)
    return NextResponse.json({ ok: true, entries: listRes.data ?? [], openCount: openRes.count ?? 0 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar" }, { status: 500 })
  }
}

// POST:
//   { action: "create", kind, area, description, severity, guardName, happenedAt? }
//   { action: "resolve", id, resolvedNote }
//   { action: "reopen", id }
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = text(body.action) || "create"
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "Sin centro comercial" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    if (action === "create") {
      const description = text(body.description)
      if (!description) return NextResponse.json({ error: "Describe el evento" }, { status: 400 })
      const happenedAt = text(body.happenedAt)
      const row = {
        branch_id: branchId,
        kind: KINDS.includes(text(body.kind)) ? text(body.kind) : "nota",
        area: text(body.area).slice(0, 120),
        description: description.slice(0, 1000),
        severity: SEVERITIES.includes(text(body.severity)) ? text(body.severity) : "baja",
        guard_name: text(body.guardName).slice(0, 80),
        ...(happenedAt ? { happened_at: happenedAt } : {}),
      }
      const { data, error } = await supabase.from("security_log").insert(row).select().maybeSingle()
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, entry: data }, { status: 201 })
    }

    if (action === "resolve" || action === "reopen") {
      const id = text(body.id)
      if (!id) return NextResponse.json({ error: "Falta el evento" }, { status: 400 })
      const patch = action === "resolve"
        ? { resolved: true, resolved_note: text(body.resolvedNote).slice(0, 500), resolved_at: new Date().toISOString() }
        : { resolved: false, resolved_note: "", resolved_at: null }
      const { error } = await supabase.from("security_log").update(patch).eq("id", id).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar" }, { status: 500 })
  }
}

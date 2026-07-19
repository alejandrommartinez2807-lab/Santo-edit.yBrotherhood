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
    if (!branchId) return NextResponse.json({ ok: true, announcements: [] })
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from("announcements").select("*").eq("branch_id", branchId).order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(100)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, announcements: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

// POST: crear/publicar un comunicado, o kind "delete".
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "Sin condominio" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    if (text(body.kind) === "delete") {
      const { error } = await supabase.from("announcements").delete().eq("id", text(body.id)).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    const title = text(body.title)
    if (!title) return NextResponse.json({ error: "Escribe el título" }, { status: 400 })
    const { data, error } = await supabase.from("announcements").insert({
      branch_id: branchId, title, body: text(body.body), category: text(body.category) || "general",
      audience: text(body.audience) || "todos", is_pinned: body.isPinned === true, requires_ack: body.requiresAck === true,
      status: "publicado", published_at: new Date().toISOString(), created_by: "admin",
    }).select().maybeSingle()
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, announcement: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

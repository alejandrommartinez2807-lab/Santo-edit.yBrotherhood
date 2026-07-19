import { NextRequest, NextResponse } from "next/server"
import { getPortalResident } from "../_resident"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }

// GET (Bearer): mis incidencias.
export async function GET(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  const { data } = await ctx.supabase.from("tickets").select("id, code, category, status, priority, title, description, created_at").eq("resident_id", ctx.residentId).order("created_at", { ascending: false }).limit(50)
  return NextResponse.json({ ok: true, tickets: data ?? [] })
}

// POST (Bearer): crear incidencia.
export async function POST(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const title = text(body.title)
    if (!title) return NextResponse.json({ error: "Escribe un título" }, { status: 400 })
    const unitId = text(body.unitId) || ctx.unitIds[0] || null
    const code = "INC-" + Date.now().toString().slice(-6)
    const { error } = await ctx.supabase.from("tickets").insert({
      branch_id: ctx.branchId, code, unit_id: unitId, resident_id: ctx.residentId, reporter_name: ctx.resident.full_name,
      area: "unidad", category: text(body.category) || "mantenimiento", priority: text(body.priority) || "media",
      status: "abierto", title, description: text(body.description),
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, code }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear" }, { status: 500 })
  }
}

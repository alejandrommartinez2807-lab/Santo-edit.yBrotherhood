import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { getPortalResident } from "../_resident"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }

// GET (Bearer): mis visitas registradas.
export async function GET(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  const { data } = await ctx.supabase.from("visitors").select("id, kind, full_name, access_code, status, valid_until, created_at").eq("authorized_by", ctx.residentId).order("created_at", { ascending: false }).limit(40)
  return NextResponse.json({ ok: true, visitors: data ?? [] })
}

// POST (Bearer): pre-autorizar una visita. Devuelve un código para la garita.
export async function POST(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const fullName = text(body.fullName)
    if (!fullName) return NextResponse.json({ error: "Escribe el nombre de la visita" }, { status: 400 })
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")
    const { error } = await ctx.supabase.from("visitors").insert({
      branch_id: ctx.branchId, unit_id: ctx.unitIds[0] || null, authorized_by: ctx.residentId,
      kind: text(body.kind) || "visita", full_name: fullName, document_number: text(body.documentNumber),
      vehicle_plate: text(body.vehiclePlate), access_code: code, valid_until: text(body.validUntil) || null,
      status: "preautorizada", created_by: ctx.resident.full_name,
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, code }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo autorizar" }, { status: 500 })
  }
}

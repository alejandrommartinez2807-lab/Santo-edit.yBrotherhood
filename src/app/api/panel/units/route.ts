import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) {
  return String(v ?? "").trim()
}
function num(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
function int(v: unknown, fallback = 0) {
  return Math.trunc(num(v, fallback))
}

// GET: unidades + tipos de unidad del condominio actual.
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, units: [], unitTypes: [] })
    const supabase = getSupabaseAdmin()
    const [unitsRes, typesRes] = await Promise.all([
      supabase
        .from("units")
        .select("*")
        .eq("branch_id", branchId)
        .order("sort_order", { ascending: true })
        .order("code", { ascending: true }),
      supabase
        .from("unit_types")
        .select("*")
        .eq("branch_id", branchId)
        .order("sort_order", { ascending: true }),
    ])
    if (unitsRes.error) throw new Error(unitsRes.error.message)
    if (typesRes.error) throw new Error(typesRes.error.message)
    return NextResponse.json({ ok: true, units: unitsRes.data ?? [], unitTypes: typesRes.data ?? [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las unidades" },
      { status: 500 },
    )
  }
}

// POST: alta/edición de unidad (o de tipo de unidad con kind="unitType").
// La alícuota se recibe y guarda como FRACCIÓN (0.0125 = 1.25 %).
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "No hay condominio configurado" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    if (text(body.kind) === "unitType") {
      const name = text(body.name)
      if (!name) return NextResponse.json({ error: "Escribe el nombre del tipo" }, { status: 400 })
      const row = { branch_id: branchId, name, description: text(body.description), sort_order: int(body.sortOrder) }
      if (body.id) {
        const { data, error } = await supabase.from("unit_types").update(row).eq("id", body.id).eq("branch_id", branchId).select().maybeSingle()
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true, unitType: data })
      }
      const { data, error } = await supabase.from("unit_types").insert(row).select().maybeSingle()
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, unitType: data }, { status: 201 })
    }

    const code = text(body.code)
    if (!code) return NextResponse.json({ error: "Escribe el código de la unidad (ej. A-12B)" }, { status: 400 })
    const row = {
      branch_id: branchId,
      unit_type_id: text(body.unitTypeId) || null,
      code,
      commercial_name: text(body.commercialName),
      activity: text(body.activity),
      logo_url: text(body.logoUrl),
      tower: text(body.tower),
      floor: text(body.floor),
      area_m2: num(body.areaM2),
      alicuota: num(body.alicuota),
      parking_slots: int(body.parkingSlots),
      storage_slots: int(body.storageSlots),
      status: text(body.status) || "disponible",
      notes: text(body.notes),
      sort_order: int(body.sortOrder),
    }
    if (body.id) {
      const { data, error } = await supabase.from("units").update(row).eq("id", body.id).eq("branch_id", branchId).select().maybeSingle()
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, unit: data })
    }
    const { data, error } = await supabase.from("units").insert(row).select().maybeSingle()
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, unit: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la unidad" },
      { status: 500 },
    )
  }
}

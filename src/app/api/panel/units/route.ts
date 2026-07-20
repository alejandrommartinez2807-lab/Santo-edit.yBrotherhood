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
function bool(v: unknown) {
  return v === true || v === "true" || v === 1 || v === "1"
}
// URL amigable para el micrositio: "Capitán Grill" -> "capitan-grill"
function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
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
    const commercialName = text(body.commercialName)
    const micrositeEnabled = bool(body.micrositeEnabled)
    const micrositeSlug = slugify(text(body.micrositeSlug) || commercialName)
    const row: Record<string, unknown> = {
      branch_id: branchId,
      unit_type_id: text(body.unitTypeId) || null,
      code,
      commercial_name: commercialName,
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
      // Micrositio ("la web" del local) — la crea/edita la administración.
      microsite_enabled: micrositeEnabled,
      microsite_slug: micrositeEnabled ? micrositeSlug : "",
      tagline: text(body.tagline),
      description: text(body.description),
      phone: text(body.phone),
      microsite_whatsapp: text(body.micrositeWhatsapp),
      instagram: text(body.instagram),
      website_url: text(body.websiteUrl),
      hours: text(body.hours),
      promo: text(body.promo),
      cover_url: text(body.coverUrl),
    }
    // La galería solo se toca si el formulario la envía (evita borrarla en guardados parciales).
    if (Array.isArray(body.gallery)) {
      row.gallery = (body.gallery as unknown[])
        .map((g) => {
          const o = (g || {}) as Record<string, unknown>
          return { url: text(o.url), caption: text(o.caption) }
        })
        .filter((g) => g.url)
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

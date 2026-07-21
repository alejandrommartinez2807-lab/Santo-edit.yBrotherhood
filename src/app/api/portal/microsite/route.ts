import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { verifyToken, bearerToken } from "../_session"
import { slugify, sanitizeProducts } from "@/lib/mallText"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }
function bool(v: unknown) { return v === true || v === "true" || v === 1 || v === "1" }

const MICROSITE_FIELDS =
  "id, code, commercial_name, activity, floor, tower, logo_url, microsite_enabled, microsite_slug, tagline, description, phone, microsite_whatsapp, instagram, website_url, hours, promo, cover_url, gallery, featured_products, accent_color"

// Locales del comerciante autenticado (solo los suyos, vía unit_residents).
async function ownedUnitIds(supabase: ReturnType<typeof getSupabaseAdmin>, residentId: string) {
  const { data } = await supabase.from("unit_residents").select("unit_id").eq("resident_id", residentId)
  return (data ?? []).map((l) => l.unit_id).filter(Boolean) as string[]
}

// GET: los locales del comerciante con los datos de su micrositio.
export async function GET(request: NextRequest) {
  try {
    const residentId = verifyToken(bearerToken(request))
    if (!residentId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    const supabase = getSupabaseAdmin()
    const unitIds = await ownedUnitIds(supabase, residentId)
    if (!unitIds.length) return NextResponse.json({ ok: true, units: [] })
    const { data, error } = await supabase.from("units").select(MICROSITE_FIELDS).in("id", unitIds).order("code")
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, units: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar" }, { status: 500 })
  }
}

// POST: el comerciante guarda el micrositio de UNO de sus locales.
export async function POST(request: NextRequest) {
  try {
    const residentId = verifyToken(bearerToken(request))
    if (!residentId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const unitId = text(body.unitId)
    if (!unitId) return NextResponse.json({ error: "Falta el local" }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const unitIds = await ownedUnitIds(supabase, residentId)
    if (!unitIds.includes(unitId)) {
      return NextResponse.json({ error: "Ese local no es tuyo" }, { status: 403 })
    }

    // El comerciante NO cambia código/rubro/piso (eso lo controla la administración);
    // solo el contenido de su web.
    const commercialName = text(body.commercialName)
    const micrositeEnabled = bool(body.micrositeEnabled)
    const micrositeSlug = slugify(text(body.micrositeSlug) || commercialName)
    const update: Record<string, unknown> = {
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
    // Nombre comercial y logo: se permiten editar (son la vitrina del local).
    if (commercialName) update.commercial_name = commercialName
    if (body.logoUrl !== undefined) update.logo_url = text(body.logoUrl)
    // Color de acento y productos destacados del micrositio.
    if (body.accentColor !== undefined) {
      const accent = text(body.accentColor)
      update.accent_color = /^#[0-9a-fA-F]{3,8}$/.test(accent) ? accent : ""
    }
    if (Array.isArray(body.featuredProducts)) {
      update.featured_products = sanitizeProducts(body.featuredProducts)
    }
    if (Array.isArray(body.gallery)) {
      update.gallery = (body.gallery as unknown[])
        .map((g) => {
          const o = (g || {}) as Record<string, unknown>
          return { url: text(o.url), caption: text(o.caption) }
        })
        .filter((g) => g.url)
        .slice(0, 12)
    }

    const { data, error } = await supabase.from("units").update(update).eq("id", unitId).select(MICROSITE_FIELDS).maybeSingle()
    if (error) {
      // Choque de slug (índice único por centro comercial).
      if (/duplicate|unique/i.test(error.message)) {
        return NextResponse.json({ error: "Esa URL amigable ya está en uso. Prueba con otra." }, { status: 409 })
      }
      throw new Error(error.message)
    }
    return NextResponse.json({ ok: true, unit: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar" }, { status: 500 })
  }
}

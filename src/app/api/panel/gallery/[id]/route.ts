import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { checkPanelAccess } from "../../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type GalleryItem = { id: string; url: string; caption: string }

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const { id } = await ctx.params
    const supabase = getSupabaseAdmin()
    const { data } = await supabase.from("business_config").select("config").eq("id", 1).maybeSingle()
    const config = ((data?.config as Record<string, unknown>) || {}) as Record<string, unknown>
    const gallery = Array.isArray(config.gallery) ? (config.gallery as GalleryItem[]) : []
    const next = gallery.filter((g) => g.id !== id)
    const { error } = await supabase.from("business_config").update({ config: { ...config, gallery: next } }).eq("id", 1)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, gallery: next })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar" }, { status: 500 })
  }
}

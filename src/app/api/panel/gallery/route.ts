import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GALLERY_BUCKET = "gallery"

type GalleryItem = { id: string; url: string; caption: string }

async function readGallery(): Promise<{ config: Record<string, unknown>; gallery: GalleryItem[] }> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from("business_config").select("config").eq("id", 1).maybeSingle()
  const config = ((data?.config as Record<string, unknown>) || {}) as Record<string, unknown>
  const gallery = Array.isArray(config.gallery) ? (config.gallery as GalleryItem[]) : []
  return { config, gallery }
}

async function writeGallery(config: Record<string, unknown>, gallery: GalleryItem[]) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from("business_config").update({ config: { ...config, gallery } }).eq("id", 1)
  if (error) throw new Error(error.message)
}

export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const { gallery } = await readGallery()
    return NextResponse.json({ ok: true, gallery })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

// POST: agrega una imagen por URL { url, caption } o por archivo { dataUrl, filename, caption }.
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const caption = String(body.caption ?? "").trim()
    let url = String(body.url ?? "").trim()
    const dataUrl = String(body.dataUrl ?? "")

    if (!url && dataUrl.startsWith("data:")) {
      const m = dataUrl.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/i)
      if (!m) return NextResponse.json({ error: "Formato de imagen no soportado (usa JPG, PNG o WEBP)" }, { status: 400 })
      const ext = m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase()
      const buffer = Buffer.from(m[3], "base64")
      if (buffer.length > 6_000_000) return NextResponse.json({ error: "La imagen supera 6 MB" }, { status: 400 })
      const supabase = getSupabaseAdmin()
      await supabase.storage.createBucket(GALLERY_BUCKET, { public: true }).catch(() => undefined)
      const path = `${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from(GALLERY_BUCKET).upload(path, buffer, { contentType: m[1], upsert: true })
      if (up.error) throw new Error(up.error.message)
      url = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path).data.publicUrl
    }

    if (!url) return NextResponse.json({ error: "Falta la imagen (URL o archivo)" }, { status: 400 })

    const { config, gallery } = await readGallery()
    const item: GalleryItem = { id: crypto.randomUUID(), url, caption }
    const next = [...gallery, item]
    await writeGallery(config, next)
    return NextResponse.json({ ok: true, item, gallery: next }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo agregar" }, { status: 500 })
  }
}

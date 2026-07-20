import { NextRequest, NextResponse } from "next/server"
import { checkPanelAccess } from "../_auth"
import { uploadMallImage } from "@/lib/mallImages"
import { DataUrlImageError } from "@/lib/dataUrlImages"
import { enforceRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST: la administración sube una imagen (portada, logo, galería del local).
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response

  const limited = enforceRateLimit(request, {
    id: "api-panel-upload-image",
    limit: 40,
    windowMs: 10 * 60_000,
    message: "Demasiadas imágenes seguidas. Espera un momento e intenta de nuevo.",
  })
  if (limited) return limited

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const dataUrl = String(body.dataUrl || "").trim()
    if (!dataUrl) return NextResponse.json({ error: "Falta la imagen" }, { status: 400 })
    const folder = String(body.folder || "locales").trim()
    const name = String(body.name || "imagen").trim()
    const url = await uploadMallImage(dataUrl, folder, name)
    return NextResponse.json({ ok: true, url })
  } catch (error) {
    if (error instanceof DataUrlImageError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo subir" }, { status: 500 })
  }
}

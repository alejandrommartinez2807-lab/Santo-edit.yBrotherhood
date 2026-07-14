import { NextRequest, NextResponse } from "next/server"
import { uploadRoomTypePhoto } from "@/lib/orders"
import { captureError } from "@/lib/monitoring"
import { DataUrlImageError, assertDataUrlImage } from "@/lib/dataUrlImages"
import { enforceRateLimit } from "@/lib/rateLimit"
import {
  enforceRequestSizeLimit,
  enforceSameOriginRequest,
  getEnvByteLimit,
} from "@/lib/requestGuards"

import { checkRoomsAccess } from "../guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST: sube una foto de habitación (dataURL) al Storage y devuelve su URL
// pública, lista para agregarla a la galería del tipo. Mismo esquema de
// guardas que la subida de imágenes del menú.
export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-rooms-upload-photo-post",
    limit: 20,
    windowMs: 10 * 60_000,
    message: "Demasiados intentos de subir fotos. Espera un momento e intenta nuevamente.",
  })
  if (rateLimitResponse) return rateLimitResponse

  const originGuardResponse = enforceSameOriginRequest(request, undefined, "api-rooms-upload-photo-post")
  if (originGuardResponse) return originGuardResponse

  const sizeLimitResponse = enforceRequestSizeLimit(request, {
    maxBytes: getEnvByteLimit("ROOM_PHOTO_UPLOAD_MAX_BYTES", 5_500_000, {
      minBytes: 512_000,
      maxBytes: 7_000_000,
    }),
    message: "La foto es demasiado pesada. Reduce o recorta la imagen y vuelve a subirla.",
    route: "api-rooms-upload-photo-post",
  })
  if (sizeLimitResponse) return sizeLimitResponse

  try {
    const access = await checkRoomsAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const dataUrl = String(body.dataUrl || "").trim()
    const fileName = String(body.fileName || "habitacion.jpg").trim()
    const typeName = String(body.typeName || "habitacion").trim()

    const image = assertDataUrlImage(dataUrl, {
      label: "La foto de la habitación",
      maxBytes: getEnvByteLimit("ROOM_PHOTO_UPLOAD_BYTES", 4_800_000, {
        minBytes: 512_000,
        maxBytes: 6_000_000,
      }),
      fallbackMimeType: String(body.mimeType || "image/jpeg"),
    })

    const uploaded = await uploadRoomTypePhoto({
      dataUrl,
      fileName,
      typeName,
      mimeType: image.mimeType,
    })

    return NextResponse.json({ ok: true, url: uploaded.url })
  } catch (error) {
    if (error instanceof DataUrlImageError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    captureError(error, { route: "/api/rooms/upload-photo", action: "POST" })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir la foto" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { uploadMenuProductImage } from "@/lib/orders"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { captureError } from "@/lib/monitoring"
import { DataUrlImageError, assertDataUrlImage, sanitizeUploadedImageFileName } from "@/lib/dataUrlImages"
import { enforceRateLimit } from "@/lib/rateLimit"
import {
  enforceRequestSizeLimit,
  enforceSameOriginRequest,
  getEnvByteLimit,
} from "@/lib/requestGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 })
}

function forbiddenResponse(message = "Esta clave no tiene permiso para subir imágenes del menú") {
  return NextResponse.json({ error: message }, { status: 403 })
}

function checkRole(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return {
      ok: false as const,
      response: unauthorizedResponse(),
    }
  }

  if (!allowedRoles.includes(access.role)) {
    return {
      ok: false as const,
      response: forbiddenResponse(),
    }
  }

  return {
    ok: true as const,
    response: null,
  }
}

function normalizePayload(value: unknown) {
  const source = (value || {}) as {
    dataUrl?: unknown
    fileName?: unknown
    mimeType?: unknown
    productName?: unknown
  }

  return {
    dataUrl: String(source.dataUrl || "").trim(),
    fileName: String(source.fileName || "producto-menu.jpg").trim(),
    mimeType: String(source.mimeType || "image/jpeg").trim(),
    productName: String(source.productName || "producto-menu").trim(),
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-menu-products-upload-image-post",
    limit: 20,
    windowMs: 10 * 60_000,
    message: "Demasiados intentos de subir imágenes. Espera un momento e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  const originGuardResponse = enforceSameOriginRequest(request, undefined, "api-menu-products-upload-image-post")

  if (originGuardResponse) return originGuardResponse

  const sizeLimitResponse = enforceRequestSizeLimit(request, {
    maxBytes: getEnvByteLimit("MENU_IMAGE_UPLOAD_MAX_BYTES", 5_500_000, {
      minBytes: 512_000,
      maxBytes: 7_000_000,
    }),
    message: "La imagen es demasiado pesada. Recorta o reduce la foto y vuelve a subirla.",
    route: "api-menu-products-upload-image-post",
  })

  if (sizeLimitResponse) return sizeLimitResponse

  try {
    const roleCheck = checkRole(request, ["owner", "manager"])

    if (!roleCheck.ok) {
      return roleCheck.response
    }

    const body = await request.json()
    const input = normalizePayload(body)

    const uploadedImage = assertDataUrlImage(input.dataUrl, {
      label: "La imagen del producto",
      maxBytes: getEnvByteLimit("MENU_IMAGE_UPLOAD_BYTES", 4_800_000, {
        minBytes: 512_000,
        maxBytes: 6_000_000,
      }),
      fallbackMimeType: input.mimeType || "image/jpeg",
    })

    const image = await uploadMenuProductImage({
      ...input,
      fileName: sanitizeUploadedImageFileName(input.fileName, input.productName || "producto-menu", uploadedImage.mimeType),
      mimeType: uploadedImage.mimeType,
    })

    return NextResponse.json({
      ok: true,
      image,
    })
  } catch (error) {
    if (error instanceof DataUrlImageError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    captureError(error, { route: "/api/menu-products/upload-image", action: "POST" })

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo subir la imagen del producto",
      },
      { status: 500 }
    )
  }
}

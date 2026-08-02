import { NextRequest, NextResponse } from "next/server"
import { uploadMenuProductModel } from "@/lib/orders"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { captureError } from "@/lib/monitoring"
import {
  DataUrlModelError,
  assertDataUrlModel,
  sanitizeUploadedModelFileName,
} from "@/lib/dataUrlModels"
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

function forbiddenResponse(message = "Esta clave no tiene permiso para subir modelos 3D del menú") {
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
    fileName: String(source.fileName || "modelo-producto.glb").trim(),
    mimeType: String(source.mimeType || "model/gltf-binary").trim(),
    productName: String(source.productName || "modelo-producto").trim(),
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-menu-products-upload-model-post",
    limit: 20,
    windowMs: 10 * 60_000,
    message: "Demasiados intentos de subir modelos 3D. Espera un momento e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  const originGuardResponse = enforceSameOriginRequest(request, undefined, "api-menu-products-upload-model-post")

  if (originGuardResponse) return originGuardResponse

  // Los .glb pesan más que las fotos: el sobre (JSON + base64) es ~1,37x el
  // archivo, por eso el límite de la petición es mayor que el del modelo.
  //
  // El tope está por debajo de los ~4,5 MB de body que aceptan las funciones de
  // Vercel (auditoría 2026-08-02). Antes se permitían 17 MB: la plataforma
  // cortaba la petición en el borde y el dueño recibía un 413 opaco en vez del
  // mensaje que le dice que comprima el modelo. Los .glb de la casa pesan
  // 250-460 KB (están hechos a mano); los de escaneo real, 5-20 MB, y esos hay
  // que comprimirlos sí o sí antes de subirlos.
  const sizeLimitResponse = enforceRequestSizeLimit(request, {
    maxBytes: getEnvByteLimit("MENU_MODEL_UPLOAD_MAX_BYTES", 4_400_000, {
      minBytes: 1_000_000,
      maxBytes: 26_000_000,
    }),
    message:
      "El modelo 3D es demasiado pesado (el máximo son ~3 MB de archivo). Comprímelo —por ejemplo con gltf-transform— y vuelve a subirlo.",
    route: "api-menu-products-upload-model-post",
  })

  if (sizeLimitResponse) return sizeLimitResponse

  try {
    const roleCheck = checkRole(request, ["owner", "manager"])

    if (!roleCheck.ok) {
      return roleCheck.response
    }

    const body = await request.json()
    const input = normalizePayload(body)

    const uploadedModel = assertDataUrlModel(input.dataUrl, {
      label: "El modelo 3D del producto",
      // ~3,2 MB de archivo real: es lo que cabe en el sobre base64 sin pasarse
      // del límite de body de Vercel (ver el comentario de arriba).
      maxBytes: getEnvByteLimit("MENU_MODEL_UPLOAD_BYTES", 3_200_000, {
        minBytes: 1_000_000,
        maxBytes: 20_000_000,
      }),
      fallbackMimeType: input.mimeType || "model/gltf-binary",
      fileName: input.fileName,
    })

    const model = await uploadMenuProductModel({
      ...input,
      fileName: sanitizeUploadedModelFileName(
        input.fileName,
        input.productName || "modelo-producto",
        uploadedModel.mimeType,
      ),
      mimeType: uploadedModel.mimeType,
    })

    return NextResponse.json({
      ok: true,
      model,
    })
  } catch (error) {
    if (error instanceof DataUrlModelError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    captureError(error, { route: "/api/menu-products/upload-model", action: "POST" })

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo subir el modelo 3D del producto",
      },
      { status: 500 }
    )
  }
}

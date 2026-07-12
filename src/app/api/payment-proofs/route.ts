import { NextRequest, NextResponse } from "next/server"
import {
  createPaymentProof,
  getBusinessConfig,
  getOrders,
  getPaymentProofs,
  type CreatePaymentProofInput,
} from "@/lib/orders"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { writeAuditLog } from "@/lib/audit"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"
import { DataUrlImageError, assertDataUrlImage, sanitizeUploadedImageFileName } from "@/lib/dataUrlImages"
import {
  enforceRequestSizeLimit,
  enforceSameOriginRequest,
  getEnvByteLimit,
} from "@/lib/requestGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PublicProofBody = {
  orderId?: unknown
  customerName?: unknown
  customerPhone?: unknown
  reportedMethod?: unknown
  amountReportedUSD?: unknown
  amountReportedVES?: unknown
  paymentReference?: unknown
  customerNote?: unknown
  dataUrl?: unknown
  fileName?: unknown
  mimeType?: unknown
  // El cliente confirma a propósito que quiere enviar OTRO comprobante para
  // un pedido que ya tiene uno activo (por ejemplo, un segundo abono).
  confirmDuplicate?: unknown
}

// Estados de comprobante que cuentan como "ya hay un pago reportado": si el
// cliente vuelve días después y reintenta, se le avisa antes de duplicar.
const ACTIVE_PROOF_STATUSES = new Set([
  "Comprobante enviado",
  "En revisión",
  "Confirmado por caja",
])

function getRequestPassword(request: NextRequest) {
  return request.headers.get("x-local-password") || request.headers.get("x-admin-password") || ""
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 })
}

function forbiddenResponse(message = "Esta clave no tiene permiso para esta acción") {
  return NextResponse.json({ error: message }, { status: 403 })
}

function checkRole(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return { ok: false as const, response: unauthorizedResponse(), role: null, roleLabel: "" }
  }

  if (!allowedRoles.includes(access.role)) {
    return {
      ok: false as const,
      response: forbiddenResponse("Esta clave no puede revisar comprobantes"),
      role: access.role,
      roleLabel: access.roleLabel,
    }
  }

  return { ok: true as const, response: null, role: access.role, roleLabel: access.roleLabel }
}

function getModuleUnavailableMessage(reason: "plan" | "owner") {
  if (reason === "plan") {
    return "Comprobantes de pago no está incluido en el plan activo. Solicita activación o sube el plan para usar esta función."
  }

  return "Comprobantes de pago está desactivado desde Configuración del negocio."
}

async function checkPaymentProofsModule() {
  const businessConfig = await getBusinessConfig()
  const moduleAccess = getModulePlanAccess(
    businessConfig as unknown as Record<string, unknown>,
    "paymentProofs"
  )

  if (!moduleAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(getModuleUnavailableMessage("plan")),
    }
  }

  if (!moduleAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse(getModuleUnavailableMessage("owner")),
    }
  }

  return { ok: true as const, response: null }
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function cleanMoney(value: unknown) {
  const rawValue = String(value || "").trim().replace(/\s/g, "")
  if (!rawValue) return 0

  const hasComma = rawValue.includes(",")
  const hasDot = rawValue.includes(".")
  const lastCommaIndex = rawValue.lastIndexOf(",")
  const lastDotIndex = rawValue.lastIndexOf(".")
  let normalizedValue = rawValue

  if (hasComma && hasDot) {
    normalizedValue =
      lastCommaIndex > lastDotIndex
        ? rawValue.replace(/\./g, "").replace(",", ".")
        : rawValue.replace(/,/g, "")
  } else if (hasComma) {
    normalizedValue = rawValue.replace(",", ".")
  }

  const numberValue = Number(normalizedValue)
  if (!Number.isFinite(numberValue) || numberValue < 0) return 0
  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function normalizeCreatePaymentProofInput(body: PublicProofBody): CreatePaymentProofInput {
  const orderId = cleanText(body.orderId)
  const dataUrl = cleanText(body.dataUrl)
  const amountReportedUSD = cleanMoney(body.amountReportedUSD)
  const amountReportedVES = cleanMoney(body.amountReportedVES)

  const paymentReference = cleanText(body.paymentReference)

  if (!orderId) throw new Error("Falta el número del pedido")
  // La captura es lo ideal, pero con la referencia de la operación alcanza
  // para que caja verifique el pago (transferencias/pago móvil).
  if (!dataUrl && !paymentReference) {
    throw new Error("Adjunta la captura del pago o indica la referencia de la operación")
  }

  const image = dataUrl
    ? assertDataUrlImage(dataUrl, {
        label: "El comprobante",
        maxBytes: getEnvByteLimit("PAYMENT_PROOF_IMAGE_MAX_BYTES", 5_500_000, {
          minBytes: 512_000,
          maxBytes: 7_000_000,
        }),
        fallbackMimeType: cleanText(body.mimeType) || "image/jpeg",
      })
    : null

  if (amountReportedUSD <= 0 && amountReportedVES <= 0) throw new Error("Indica el monto que reportaste como pagado")

  return {
    orderId,
    customerName: cleanText(body.customerName),
    customerPhone: cleanText(body.customerPhone),
    reportedMethod: cleanText(body.reportedMethod),
    amountReportedUSD,
    amountReportedVES,
    paymentReference,
    customerNote: cleanText(body.customerNote),
    dataUrl,
    fileName: image
      ? sanitizeUploadedImageFileName(body.fileName, `comprobante-${orderId}`, image.mimeType)
      : "",
    mimeType: image ? image.mimeType : "",
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = checkRole(request, ["owner", "manager", "cashier", "promoter"])
    if (!access.ok) return access.response

    const moduleCheck = await checkPaymentProofsModule()
    if (!moduleCheck.ok) return moduleCheck.response

    const orderId = request.nextUrl.searchParams.get("orderId") || undefined
    const status = request.nextUrl.searchParams.get("status") || undefined
    const paymentProofs = await getPaymentProofs({ orderId, status }, await resolveBranchId(request))

    return NextResponse.json({
      ok: true,
      paymentProofs,
      access: { role: access.role, roleLabel: access.roleLabel },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los comprobantes" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-payment-proofs-post",
    limit: 6,
    windowMs: 120_000,
    message: "Demasiados comprobantes enviados. Espera un momento e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  const originGuardResponse = enforceSameOriginRequest(request, undefined, "api-payment-proofs-post")

  if (originGuardResponse) return originGuardResponse

  const sizeLimitResponse = enforceRequestSizeLimit(request, {
    maxBytes: getEnvByteLimit("PAYMENT_PROOF_POST_MAX_BYTES", 8_000_000, {
      minBytes: 512_000,
      maxBytes: 10_000_000,
    }),
    message: "El comprobante es demasiado pesado. Usa una captura más liviana e intenta nuevamente.",
    route: "api-payment-proofs-post",
  })

  if (sizeLimitResponse) return sizeLimitResponse

  try {
    const moduleCheck = await checkPaymentProofsModule()
    if (!moduleCheck.ok) return moduleCheck.response

    const branchId = await resolveBranchId(request)
    const body = (await request.json()) as PublicProofBody
    const input = normalizeCreatePaymentProofInput(body)
    const orders = await getOrders(branchId)
    const order = orders.find((item) => item.id === input.orderId)

    if (!order) {
      return NextResponse.json({ error: "No se encontró el pedido para asociar el comprobante" }, { status: 404 })
    }

    if (order.status === "Cancelado") {
      return NextResponse.json({ error: "Este pedido está cancelado y no puede recibir comprobantes" }, { status: 409 })
    }

    // Anti-duplicado: si el pedido ya tiene un comprobante activo (enviado,
    // en revisión o confirmado), no se acepta otro sin confirmación expresa.
    if (body.confirmDuplicate !== true) {
      const existingProofs = await getPaymentProofs({ orderId: input.orderId }, branchId)
      const activeProof = existingProofs.find((proof) => ACTIVE_PROOF_STATUSES.has(proof.status))

      if (activeProof) {
        const isConfirmed = activeProof.status === "Confirmado por caja"

        return NextResponse.json(
          {
            error: isConfirmed
              ? "El pago de este pedido ya fue confirmado por caja. Si estás abonando un monto adicional, confirma el envío."
              : "Ya reportaste un pago para este pedido y está pendiente por revisar. No hace falta enviarlo otra vez; si es un pago distinto, confirma el envío.",
            duplicate: true,
            existingProof: {
              createdAt: activeProof.createdAt,
              status: activeProof.status,
              amountReportedUSD: activeProof.amountReportedUSD,
              amountReportedVES: activeProof.amountReportedVES,
            },
          },
          { status: 409 },
        )
      }
    }

    const paymentProof = await createPaymentProof({
      ...input,
      customerName: input.customerName || order.customerName,
      customerPhone: input.customerPhone || order.customerPhone || "",
    }, branchId)

    await writeAuditLog({
      action: "payment_proof.created",
      branchId,
      entityType: "payment_proof",
      entityId: paymentProof.id,
      actor: {
        role: "cliente",
        label: paymentProof.customerName || "Cliente",
        source: "public",
      },
      request,
      metadata: { orderId: input.orderId, amountReportedUSD: input.amountReportedUSD, amountReportedVES: input.amountReportedVES },
    })

    return NextResponse.json({ ok: true, paymentProof }, { status: 201 })
  } catch (error) {
    const status = error instanceof DataUrlImageError ? error.status : 400

    captureError(error, { route: "/api/payment-proofs", action: "POST" })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo enviar el comprobante" },
      { status }
    )
  }
}

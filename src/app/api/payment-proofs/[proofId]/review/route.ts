import { NextRequest, NextResponse } from "next/server"
import {
  getBusinessConfig,
  reviewPaymentProof,
  type PaymentProofStatus,
} from "@/lib/orders"
import { getLocalAccessAuditActor, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { writeAuditLog } from "@/lib/audit"

import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ReviewBody = {
  status?: unknown
  internalNote?: unknown
}

const VALID_STATUSES: PaymentProofStatus[] = [
  "Comprobante enviado",
  "En revisión",
  "Confirmado por caja",
  "Rechazado",
  "Necesita corrección",
]

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

  return { ok: true as const, response: null, role: access.role, roleLabel: access.roleLabel, access }
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
      response: forbiddenResponse("Comprobantes de pago no está incluido en el plan activo."),
    }
  }

  if (!moduleAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse("Comprobantes de pago está desactivado desde Configuración del negocio."),
    }
  }

  return { ok: true as const, response: null }
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function normalizeStatus(value: unknown): PaymentProofStatus {
  const status = cleanText(value) as PaymentProofStatus

  if (VALID_STATUSES.includes(status)) return status

  throw new Error("Estado de comprobante no válido")
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ proofId: string }> }
) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-payment-proofs-review-patch",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiadas revisiones de comprobantes. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  try {
    const access = checkRole(request, ["owner", "manager", "cashier", "promoter"])
    if (!access.ok) return access.response

    const moduleCheck = await checkPaymentProofsModule()
    if (!moduleCheck.ok) return moduleCheck.response

    const { proofId } = await context.params
    const branchId = await resolveBranchId(request)
    const body = (await request.json()) as ReviewBody
    const status = normalizeStatus(body.status)
    const internalNote = cleanText(body.internalNote)

    const actor = getLocalAccessAuditActor(access.access)

    const paymentProof = await reviewPaymentProof(proofId, {
      status,
      internalNote,
      reviewedBy: actor.label || access.roleLabel || "Caja",
    }, branchId)

    await writeAuditLog({
      action: "payment_proof.reviewed",
      branchId,
      entityType: "payment_proof",
      entityId: proofId,
      actor,
      request,
      metadata: { status, internalNote },
    })

    return NextResponse.json({ ok: true, paymentProof })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo revisar el comprobante" },
      { status: 400 }
    )
  }
}

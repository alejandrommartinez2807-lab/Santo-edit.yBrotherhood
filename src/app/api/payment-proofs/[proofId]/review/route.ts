import { NextRequest, NextResponse } from "next/server"
import {
  getBusinessConfig,
  reviewPaymentProof,
  updateOrderPayment,
  type PaymentProofStatus,
} from "@/lib/orders"
import { buildPaymentFromProof, type OrderPaymentSnapshot } from "@/lib/paymentProofRegistration"
import { sendOrderPaymentReviewedPush } from "@/lib/orderPushNotifications"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
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
  registerPayment?: unknown
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

// Cobro actual del pedido del comprobante, para decidir si el cobro se puede
// registrar automáticamente sin pisar nada (null = pedido no encontrado).
async function getOrderPaymentSnapshot(
  orderId: string,
  branchId: string | null,
): Promise<OrderPaymentSnapshot | null> {
  if (!orderId) return null

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("orders")
    .select("amount_received_usd, amount_received_ves")
    .eq("id", orderId)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as Record<string, unknown>

  return {
    amountReceivedUSD: Number(row.amount_received_usd || 0),
    amountReceivedVES: Number(row.amount_received_ves || 0),
  }
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
    const shouldRegisterPayment = body.registerPayment === true && status === "Confirmado por caja"

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

    // Al confirmar, registra el cobro reportado en el pedido (si se puede sin
    // pisar un cobro previo). Si falla, la confirmación del comprobante vale
    // igual: se devuelve el motivo para que Caja lo registre a mano.
    let paymentRegistered = false
    let paymentSkippedReason = ""

    if (shouldRegisterPayment) {
      try {
        const snapshot = await getOrderPaymentSnapshot(paymentProof.orderId, branchId)
        const decision = buildPaymentFromProof(paymentProof, snapshot)

        if (decision.ok) {
          const order = await updateOrderPayment(
            paymentProof.orderId,
            {
              ...decision.payment,
              chargedBy: { id: actor.id, name: actor.label, role: actor.role },
            },
            branchId,
          )

          paymentRegistered = true

          await writeAuditLog({
            action: "order.payment.updated",
            branchId,
            entityType: "order",
            entityId: paymentProof.orderId,
            actor,
            request,
            metadata: {
              source: "payment_proof",
              proofId,
              amountReceivedUSD: decision.payment.amountReceivedUSD,
              amountReceivedVES: decision.payment.amountReceivedVES,
              paymentStatus: order.paymentStatus,
            },
          })
        } else {
          paymentSkippedReason = decision.reason
        }
      } catch (registerError) {
        paymentSkippedReason =
          registerError instanceof Error
            ? `No se pudo registrar el cobro: ${registerError.message}`
            : "No se pudo registrar el cobro; hazlo desde Caja."
      }
    }

    // Avisa al cliente por push si se suscribió desde su seguimiento
    // (confirmado / rechazado / necesita corrección). Best-effort: su página
    // ya sondea, así que un fallo de push no afecta la revisión.
    void sendOrderPaymentReviewedPush(paymentProof.orderId, status, "", internalNote)

    return NextResponse.json({ ok: true, paymentProof, paymentRegistered, paymentSkippedReason })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo revisar el comprobante" },
      { status: 400 }
    )
  }
}

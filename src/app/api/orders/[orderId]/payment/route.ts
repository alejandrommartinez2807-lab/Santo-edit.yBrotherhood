import { NextRequest, NextResponse } from "next/server"
import {
  getBusinessConfig,
  updateOrderPayment,
} from "@/lib/orders"
import {
  canLocalAccessUseModule,
  getLocalAccessAuditActor,
  getRequestAccess,
  type LocalRole,
} from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { writeAuditLog } from "@/lib/audit"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DeliveryPaymentIn = "Divisas" | "Bolívares" | "Mixto" | "Sin registrar"

type UpdatePaymentPayload = {
  amountReceivedUSD: number
  amountReceivedVES: number
  paymentMethodUSD?: string
  paymentMethodVES?: string
  deliveryPaymentIn: DeliveryPaymentIn
  paymentNote?: string
}

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function getAccess(request: NextRequest) {
  return getRequestAccess(request, getRequestPassword(request))
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: "No autorizado",
    },
    {
      status: 401,
    }
  )
}

function forbiddenResponse(message = "Esta clave no tiene permiso para registrar cobros") {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 403,
    }
  )
}

function checkRole(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getAccess(request)

  if (!access.ok) {
    return {
      ok: false as const,
      response: unauthorizedResponse(),
      role: null,
    }
  }

  if (!allowedRoles.includes(access.role)) {
    return {
      ok: false as const,
      response: forbiddenResponse(),
      role: access.role,
    }
  }

  return {
    ok: true as const,
    response: null,
    role: access.role,
    access,
  }
}

async function checkCashierModuleAvailability() {
  const businessConfig = await getBusinessConfig()
  const moduleAccess = getModulePlanAccess(
    businessConfig as unknown as Record<string, unknown>,
    "cashier"
  )

  if (!moduleAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        "Caja no está incluida en el plan activo. Solicita activación o sube el plan para registrar cobros."
      ),
      moduleAccess,
    }
  }

  if (!moduleAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        "Caja está desactivada desde Configuración del negocio."
      ),
      moduleAccess,
    }
  }

  return {
    ok: true as const,
    response: null,
    moduleAccess,
  }
}

function normalizeComparableText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function roundMoney(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue)) {
    return 0
  }

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function normalizeMoney(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0
  }

  return roundMoney(numberValue)
}

function normalizePaymentMethodUSD(value: unknown) {
  const normalized = normalizeComparableText(value)

  if (
    !normalized ||
    normalized === "sin registrar" ||
    normalized === "sin metodo" ||
    normalized === "sin método" ||
    normalized === "divisas sin metodo" ||
    normalized === "divisas sin método"
  ) {
    return ""
  }

  if (
    normalized === "efectivo divisas" ||
    normalized === "efectivo en divisas" ||
    normalized === "divisas" ||
    normalized === "divisa" ||
    normalized === "dolares" ||
    normalized === "dólares" ||
    normalized === "dolares efectivo" ||
    normalized === "dólares efectivo" ||
    normalized === "usd" ||
    normalized === "cash" ||
    normalized.includes("efectivo")
  ) {
    return "Efectivo divisas"
  }

  if (normalized.includes("zelle")) {
    return "Zelle"
  }

  if (normalized.includes("binance")) {
    return "Binance"
  }

  if (normalized.includes("usdt") || normalized.includes("tether")) {
    return "USDT"
  }

  if (
    normalized.includes("transferencia internacional") ||
    normalized.includes("transferencia externa") ||
    normalized.includes("wire")
  ) {
    return "Transferencia internacional"
  }

  return "Otro"
}

function normalizePaymentMethodVES(value: unknown) {
  const normalized = normalizeComparableText(value)

  if (
    !normalized ||
    normalized === "sin registrar" ||
    normalized === "sin metodo" ||
    normalized === "sin método" ||
    normalized === "bolivares sin metodo" ||
    normalized === "bolivares sin método"
  ) {
    return ""
  }

  if (
    normalized === "pago movil" ||
    normalized === "pago móvil" ||
    normalized === "pagomovil" ||
    normalized.includes("pago movil") ||
    normalized.includes("pago móvil") ||
    normalized.includes("movil") ||
    normalized.includes("móvil")
  ) {
    return "Pago móvil"
  }

  if (normalized.includes("punto")) {
    return "Punto"
  }

  if (normalized.includes("transferencia")) {
    return "Transferencia"
  }

  if (
    normalized === "efectivo bs" ||
    normalized === "efectivo bolivares" ||
    normalized === "efectivo bolívares" ||
    normalized === "bolivares" ||
    normalized === "bolivar" ||
    normalized === "bs" ||
    normalized === "ves" ||
    normalized.includes("efectivo")
  ) {
    return "Efectivo Bs"
  }

  if (normalized.includes("biopago") || normalized.includes("bio pago")) {
    return "Biopago"
  }

  return "Otro"
}

function normalizeDeliveryPaymentIn(value: unknown): DeliveryPaymentIn {
  const normalized = normalizeComparableText(value)

  if (normalized === "divisas" || normalized === "divisa") {
    return "Divisas"
  }

  if (
    normalized === "bolivares" ||
    normalized === "bolivar" ||
    normalized === "bs" ||
    normalized === "ves"
  ) {
    return "Bolívares"
  }

  if (normalized === "mixto" || normalized === "mixta") {
    return "Mixto"
  }

  return "Sin registrar"
}

function getPaymentInput(body: Record<string, unknown>): UpdatePaymentPayload {
  const source =
    body.payment && typeof body.payment === "object"
      ? (body.payment as Record<string, unknown>)
      : body

  return {
    amountReceivedUSD: normalizeMoney(source.amountReceivedUSD),
    amountReceivedVES: normalizeMoney(source.amountReceivedVES),
    paymentMethodUSD: normalizePaymentMethodUSD(source.paymentMethodUSD),
    paymentMethodVES: normalizePaymentMethodVES(source.paymentMethodVES),
    deliveryPaymentIn: normalizeDeliveryPaymentIn(source.deliveryPaymentIn),
    paymentNote: String(source.paymentNote || "").trim(),
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-order-payment-patch",
    limit: 80,
    windowMs: 60_000,
    envMaxBytes: "ORDER_PAYMENT_MUTATION_MAX_BYTES",
    maxBytes: 64_000,
    minBytes: 16_000,
    hardMaxBytes: 256_000,
    rateLimitMessage: "Demasiados intentos de registrar cobros. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = checkRole(request, ["owner", "manager", "cashier"])

    if (!access.ok) {
      return access.response
    }

    const cashierModuleCheck = await checkCashierModuleAvailability()

    if (!cashierModuleCheck.ok) {
      return cashierModuleCheck.response
    }

    if (!canLocalAccessUseModule(access.access, "cashier")) {
      return forbiddenResponse("Este usuario no tiene permiso para Caja")
    }

    const { orderId } = await context.params
    const branchId = await resolveBranchId(request)
    const body = (await request.json()) as Record<string, unknown>
    const payment = getPaymentInput(body)
    const actor = getLocalAccessAuditActor(access.access)

    const order = await updateOrderPayment(
      orderId,
      {
        ...(payment as Parameters<typeof updateOrderPayment>[1]),
        chargedBy: { id: actor.id, name: actor.label, role: actor.role },
      },
      branchId
    )

    await writeAuditLog({
      action: "order.payment.updated",
      branchId,
      entityType: "order",
      entityId: orderId,
      actor,
      request,
      metadata: {
        amountReceivedUSD: payment.amountReceivedUSD,
        amountReceivedVES: payment.amountReceivedVES,
        deliveryPaymentIn: payment.deliveryPaymentIn,
        paymentStatus: order.paymentStatus,
        fiscal: order.fiscal,
      },
    })

    return NextResponse.json({
      order,
      access: {
        role: access.role,
        moduleKey: "cashier",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo registrar el cobro",
      },
      {
        status: 500,
      }
    )
  }
}

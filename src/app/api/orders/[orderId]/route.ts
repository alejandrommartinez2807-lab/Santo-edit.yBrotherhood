import { NextRequest, NextResponse } from "next/server"
import {
  confirmOrderStaffItems,
  deleteOrder,
  resetOrderStaffItems,
  getBusinessConfig,
  setOrderItemDelivered,
  updateOrderDeliveryReport,
  updateOrderStatus,
  type OrderStatus,
} from "@/lib/orders"
import {
  canLocalAccessUseModule,
  getLocalAccessAuditActor,
  getRequestAccess,
  type LocalModuleKey,
  type LocalRole,
} from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { writeAuditLog } from "@/lib/audit"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import {
  sendOrderCancelledStaffPush,
  sendOrderReadyPush,
} from "@/lib/orderPushNotifications"
import { getDisplayOrderNumber } from "@/lib/localOrderHelpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

function forbiddenResponse(message = "Esta clave no tiene permiso para esta acción") {
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

function getModuleUnavailableMessage(moduleLabel: string, reason: "plan" | "owner") {
  if (reason === "plan") {
    return `${moduleLabel} no está incluido en el plan activo. Solicita activación o sube el plan para usar esta función.`
  }

  return `${moduleLabel} está desactivado desde Configuración del negocio.`
}

async function checkModuleAvailability(moduleKey: LocalModuleKey, moduleLabel: string) {
  const businessConfig = await getBusinessConfig()
  const moduleAccess = getModulePlanAccess(
    businessConfig as unknown as Record<string, unknown>,
    moduleKey
  )

  if (!moduleAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(getModuleUnavailableMessage(moduleLabel, "plan")),
      moduleAccess,
    }
  }

  if (!moduleAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse(getModuleUnavailableMessage(moduleLabel, "owner")),
      moduleAccess,
    }
  }

  return {
    ok: true as const,
    response: null,
    moduleAccess,
  }
}

function isValidStatus(value: unknown): value is OrderStatus {
  return (
    value === "Nuevo" ||
    value === "Preparando" ||
    value === "Listo" ||
    value === "Entregado" ||
    value === "Cancelado"
  )
}

function canRoleUpdateStatus(role: LocalRole, status: OrderStatus) {
  if (role === "owner" || role === "manager") {
    return true
  }

  if (role === "cashier") {
    // "Listo": en los flujos mixto/sin cocina (kitchenFlowMode) caja marca
    // Listo directamente sin pasar por cocina.
    return (
      status === "Nuevo" ||
      status === "Preparando" ||
      status === "Listo" ||
      status === "Entregado" ||
      status === "Cancelado"
    )
  }

  // Cocina solo avanza la preparación: nunca cancela ni entrega.
  if (role === "kitchen") {
    return status === "Preparando" || status === "Listo"
  }

  // El promotor de eventos entrega lo que vende, pero no cancela pedidos.
  if (role === "promoter") {
    return (
      status === "Nuevo" ||
      status === "Preparando" ||
      status === "Listo" ||
      status === "Entregado"
    )
  }

  return false
}

function getStatusModuleForRole(role: LocalRole): LocalModuleKey {
  if (role === "cashier") return "cashier"
  if (role === "kitchen") return "kitchen"
  if (role === "promoter") return "cashier"

  return "mainPanel"
}

function canRoleConfirmStaffItems(role: LocalRole) {
  return role === "owner" || role === "manager" || role === "cashier" || role === "waiter"
}

function getStaffConfirmationModuleForRole(role: LocalRole): LocalModuleKey {
  if (role === "cashier") return "cashier"
  if (role === "waiter") return "openAccounts"

  return "mainPanel"
}

function getRoleLabel(role: LocalRole) {
  if (role === "owner") return "Dueño"
  if (role === "manager") return "Encargado"
  if (role === "cashier") return "Caja"
  if (role === "waiter") return "Mesonero"
  if (role === "kitchen") return "Cocina"
  if (role === "delivery") return "Delivery"
  if (role === "promoter") return "Promotor"

  return "Personal"
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-order-detail-patch",
    limit: 120,
    windowMs: 60_000,
    envMaxBytes: "ORDER_DETAIL_MUTATION_MAX_BYTES",
    maxBytes: 64_000,
    minBytes: 16_000,
    hardMaxBytes: 256_000,
    rateLimitMessage: "Demasiadas actualizaciones de pedidos. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = getAccess(request)

    if (!access.ok) {
      return unauthorizedResponse()
    }

    const { orderId } = await context.params
    const branchId = await resolveBranchId(request)
    const body = await request.json()


    if (body.action === "confirmStaffItems") {
      if (!canRoleConfirmStaffItems(access.role)) {
        return forbiddenResponse("Esta clave no puede confirmar productos del pedido")
      }

      const moduleKey = getStaffConfirmationModuleForRole(access.role)
      const moduleCheck = await checkModuleAvailability(
        moduleKey,
        moduleKey === "cashier"
          ? "Caja"
          : moduleKey === "openAccounts"
            ? "Mesonero"
            : "El panel de pedidos"
      )

      if (!moduleCheck.ok) {
        return moduleCheck.response
      }

      if (!canLocalAccessUseModule(access, moduleKey)) {
        return forbiddenResponse("Este usuario no tiene permiso para este módulo")
      }

      const order = await confirmOrderStaffItems(orderId, {
        confirmedBy: String(
          body.confirmedBy || getLocalAccessAuditActor(access).label || getRoleLabel(access.role)
        ).trim(),
        confirmedRole: String(body.confirmedRole || getRoleLabel(access.role)).trim(),
      }, branchId)

      await writeAuditLog({
        action: "order.staff.confirmed",
        branchId,
        entityType: "order",
        entityId: orderId,
        actor: getLocalAccessAuditActor(access),
        request,
      })

      return NextResponse.json({
        order,
        access: {
          role: access.role,
          moduleKey,
        },
      })
    }

    if (body.action === "setItemDelivered") {
      // Mismos roles que confirman productos: quien atiende la mesa/caja va
      // marcando lo que ya se entregó al cliente (cuentas abiertas).
      if (!canRoleConfirmStaffItems(access.role)) {
        return forbiddenResponse("Esta clave no puede marcar productos entregados")
      }

      const moduleKey = getStaffConfirmationModuleForRole(access.role)
      const moduleCheck = await checkModuleAvailability(
        moduleKey,
        moduleKey === "cashier"
          ? "Caja"
          : moduleKey === "openAccounts"
            ? "Mesonero"
            : "El panel de pedidos"
      )

      if (!moduleCheck.ok) {
        return moduleCheck.response
      }

      if (!canLocalAccessUseModule(access, moduleKey)) {
        return forbiddenResponse("Este usuario no tiene permiso para este módulo")
      }

      const delivered = body.delivered !== false
      const order = await setOrderItemDelivered(orderId, {
        lineId: String(body.lineId || "").trim() || undefined,
        productId: Number(body.productId || 0) || undefined,
        itemName: String(body.itemName || "").trim() || undefined,
        delivered,
        deliveredBy:
          String(body.deliveredBy || "").trim() ||
          getLocalAccessAuditActor(access).label ||
          getRoleLabel(access.role),
      }, branchId)

      await writeAuditLog({
        action: "order.item.delivered",
        branchId,
        entityType: "order",
        entityId: orderId,
        actor: getLocalAccessAuditActor(access),
        request,
        metadata: {
          item: String(body.itemName || body.lineId || ""),
          delivered,
        },
      })

      return NextResponse.json({
        order,
        access: {
          role: access.role,
          moduleKey,
        },
      })
    }

    if (body.action === "resetStaffItems") {
      if (!canRoleConfirmStaffItems(access.role)) {
        return forbiddenResponse("Esta clave no puede reabrir la revisión del pedido")
      }

      const moduleKey = getStaffConfirmationModuleForRole(access.role)
      const moduleCheck = await checkModuleAvailability(
        moduleKey,
        moduleKey === "cashier"
          ? "Caja"
          : moduleKey === "openAccounts"
            ? "Mesonero"
            : "El panel de pedidos"
      )

      if (!moduleCheck.ok) {
        return moduleCheck.response
      }

      if (!canLocalAccessUseModule(access, moduleKey)) {
        return forbiddenResponse("Este usuario no tiene permiso para este módulo")
      }

      const order = await resetOrderStaffItems(orderId, {
        resetBy: String(
          body.resetBy || getLocalAccessAuditActor(access).label || getRoleLabel(access.role)
        ).trim(),
        resetRole: String(body.resetRole || getRoleLabel(access.role)).trim(),
      }, branchId)

      await writeAuditLog({
        action: "order.staff.reset",
        branchId,
        entityType: "order",
        entityId: orderId,
        actor: getLocalAccessAuditActor(access),
        request,
      })

      return NextResponse.json({
        order,
        access: {
          role: access.role,
          moduleKey,
        },
      })
    }

    if (body.action === "reportDelivery") {
      if (!["owner", "manager", "delivery"].includes(access.role)) {
        return forbiddenResponse("Esta clave no puede reportar entregas de delivery")
      }

      const moduleCheck = await checkModuleAvailability("delivery", "Delivery")

      if (!moduleCheck.ok) {
        return moduleCheck.response
      }

      if (!canLocalAccessUseModule(access, "delivery")) {
        return forbiddenResponse("Este usuario no tiene permiso para este módulo")
      }

      const order = await updateOrderDeliveryReport(orderId, branchId)

      await writeAuditLog({
        action: "order.delivery.reported",
        branchId,
        entityType: "order",
        entityId: orderId,
        actor: getLocalAccessAuditActor(access),
        request,
      })

      return NextResponse.json({
        order,
        access: {
          role: access.role,
          moduleKey: "delivery",
        },
      })
    }

    const status = body.status

    if (!isValidStatus(status)) {
      return NextResponse.json(
        {
          error: "Estado inválido",
        },
        {
          status: 400,
        }
      )
    }

    if (!canRoleUpdateStatus(access.role, status)) {
      return forbiddenResponse("Esta clave no puede cambiar el pedido a ese estado")
    }

    const moduleKey = getStatusModuleForRole(access.role)
    const moduleCheck = await checkModuleAvailability(
      moduleKey,
      moduleKey === "cashier"
        ? "Caja"
        : moduleKey === "kitchen"
          ? "Cocina"
          : "El panel de pedidos"
    )

    if (!moduleCheck.ok) {
      return moduleCheck.response
    }

    if (!canLocalAccessUseModule(access, moduleKey)) {
      return forbiddenResponse("Este usuario no tiene permiso para este módulo")
    }

    const order = await updateOrderStatus(orderId, status, branchId)

    if (status === "Listo") {
      // Aviso web push al cliente suscrito. Nunca lanza: un fallo de push no
      // puede tumbar el cambio de estado de caja/cocina.
      await sendOrderReadyPush(orderId, getDisplayOrderNumber(order))
    }

    if (status === "Cancelado") {
      // Alarma de anulación al dueño/encargado (equipos suscritos): quién
      // anuló y qué productos llevaba el pedido. Nunca lanza.
      const actor = getLocalAccessAuditActor(access)
      const itemsSummary = (order.items || [])
        .map((item) => `${Math.max(1, Number(item.quantity || 1))}x ${item.name}`)
        .join(", ")

      await sendOrderCancelledStaffPush({
        displayNumber: getDisplayOrderNumber(order),
        customerName: order.customerName || "",
        itemsSummary,
        totalUSD: Number(order.totalUSD || order.totalPrice || 0),
        cancelledBy:
          [actor.label, getRoleLabel(access.role)].filter(Boolean).join(" · ") ||
          getRoleLabel(access.role),
        branchId,
      })
    }

    await writeAuditLog({
      action: "order.status.updated",
      branchId,
      entityType: "order",
      entityId: orderId,
      actor: getLocalAccessAuditActor(access),
      request,
      metadata: { status },
    })

    return NextResponse.json({
      order,
      access: {
        role: access.role,
        moduleKey,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el pedido",
      },
      {
        status: 500,
      }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-order-detail-delete",
    limit: 20,
    windowMs: 60_000,
    maxBytes: 32_000,
    rateLimitMessage: "Demasiados intentos de eliminar pedidos. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = checkRole(request, ["owner"])

    if (!access.ok) {
      return access.response
    }

    const moduleCheck = await checkModuleAvailability(
      "mainPanel",
      "El panel de pedidos"
    )

    if (!moduleCheck.ok) {
      return moduleCheck.response
    }

    const { orderId } = await context.params
    const branchId = await resolveBranchId(request)

    await deleteOrder(orderId, branchId)

    await writeAuditLog({
      action: "order.deleted",
      branchId,
      entityType: "order",
      entityId: orderId,
      actor: getLocalAccessAuditActor(access.access),
      request,
    })

    return NextResponse.json({
      ok: true,
      access: {
        role: access.role,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el pedido",
      },
      {
        status: 500,
      }
    )
  }
}

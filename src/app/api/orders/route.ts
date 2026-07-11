import { NextRequest, NextResponse } from "next/server"
import {
  clearOrders,
  createOrder,
  findOrderByClientOrderId,
  getBusinessConfig,
  getDeliveryDistanceSettings,
  getDeliveryZones,
  getOpenAccounts,
  getOrders,
  isTrainingModeActive,
} from "@/lib/orders"
import {
  isDeliveryDistanceReady,
  isShortMapsLink,
  parseCoordsFromText,
  quoteDeliveryByDistance,
} from "@/lib/deliveryDistance"
import { expandShortMapsLink } from "@/lib/deliveryDistanceServer"
import type { OrderType } from "@/types/localOrders"
import { calculateOrderTotalsFromItems } from "@/lib/localOrderMoney"
import {
  cleanNumber,
  cleanText,
  getDeliveryZoneOption,
  isValidOrderType,
  normalizeItems,
} from "@/lib/localOrderHelpers"
import {
  canLocalAccessUseModule,
  getLocalAccessAuditActor,
  getRequestAccess,
  type LocalRole,
} from "@/lib/localAccess"
import { getModulePlanAccess, type LocalModuleKey } from "@/lib/localPlans"
import { resolveBranchId, resolveScopedBranchId } from "@/lib/branch"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"
import { DataUrlImageError, assertDataUrlImage, sanitizeUploadedImageFileName } from "@/lib/dataUrlImages"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { enforceApiReadGuards } from "@/lib/apiReadGuards"
import {
  enforceRequestSizeLimit,
  enforceSameOriginRequest,
  getEnvByteLimit,
} from "@/lib/requestGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normalizeComparableText(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
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

function getReadModuleForRole(role: LocalRole): LocalModuleKey {
  if (role === "cashier") return "cashier"
  if (role === "kitchen") return "kitchen"
  if (role === "delivery") return "delivery"
  if (role === "waiter") return "mainPanel"
  if (role === "promoter") return "cashier"

  return "mainPanel"
}



export async function GET(request: NextRequest) {
  const guardResponse = enforceApiReadGuards(request, {
    id: "api-orders-get",
    limit: 180,
    windowMs: 60_000,
    rateLimitMessage: "Demasiadas consultas de pedidos. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = checkRole(request, [
      "owner",
      "manager",
      "cashier",
      "kitchen",
      "delivery",
      "waiter",
      "promoter",
    ])

    if (!access.ok) {
      return access.response
    }

    const moduleKey = getReadModuleForRole(access.role)
    const moduleCheck = await checkModuleAvailability(moduleKey, "El acceso a pedidos")

    if (!moduleCheck.ok) {
      return moduleCheck.response
    }

    if (!canLocalAccessUseModule(access.access, moduleKey)) {
      return forbiddenResponse("Este usuario no tiene permiso para este módulo")
    }

    const trainingConfig = await getBusinessConfig()
    const trainingActive = isTrainingModeActive(trainingConfig)
    const trainingAvailable = getModulePlanAccess(
      trainingConfig as unknown as Record<string, unknown>,
      "trainingMode",
    ).effectiveEnabled
    const allOrders = await getOrders(
      await resolveScopedBranchId(request, access.role),
    )

    // Modo entrenamiento: mientras está activo, el panel ve SOLO los pedidos de
    // práctica (sandbox); si no, solo los reales. Así los pedidos de práctica
    // nunca se mezclan con la operación real (reportes/cierre/stats del panel).
    const orders = allOrders.filter((order) =>
      trainingActive ? order.isTraining === true : order.isTraining !== true,
    )

    return NextResponse.json({
      orders,
      trainingModeActive: trainingActive,
      trainingModeAvailable: trainingAvailable,
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
            : "No se pudieron cargar los pedidos",
      },
      {
        status: 500,
      }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-orders-post",
    limit: 10,
    windowMs: 60_000,
    message: "Demasiados intentos de pedido. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  const originGuardResponse = enforceSameOriginRequest(request, undefined, "api-orders-post")

  if (originGuardResponse) return originGuardResponse

  const sizeLimitResponse = enforceRequestSizeLimit(request, {
    maxBytes: getEnvByteLimit("ORDERS_POST_MAX_BYTES", 9_000_000, {
      minBytes: 128_000,
      maxBytes: 12_000_000,
    }),
    message: "El pedido es demasiado grande. Reduce la imagen adjunta o vuelve a intentarlo.",
    route: "api-orders-post",
  })

  if (sizeLimitResponse) return sizeLimitResponse

  try {
    const body = await request.json()

    // Idempotencia (sync offline): si el cliente envía una clave y ya existe un
    // pedido con ella, devolvemos el existente sin reprocesar (evita duplicados
    // al reenviar la cola tras reconectar). Ver 0018_order_idempotency.
    const clientOrderId = cleanText(body.clientOrderId)
    if (clientOrderId) {
      const existing = await findOrderByClientOrderId(
        clientOrderId,
        await resolveBranchId(request),
      )
      if (existing) {
        return NextResponse.json({ order: existing, idempotent: true })
      }
    }

    const rawOrderType = cleanText(body.orderType)
    const rawTableNumber = cleanText(body.tableNumber)
    const customerName = cleanText(body.customerName) || "Cliente"
    const customerPhone = cleanText(body.customerPhone)
    const deliveryAddress = cleanText(body.deliveryAddress)
    const deliveryReference = cleanText(body.deliveryReference)
    const rawDeliveryZone = cleanText(body.deliveryZone)
    const paymentMethod = cleanText(body.paymentMethod)
    const explicitOpenAccountId = cleanText(body.openAccountId)
    const shouldAttachToOpenAccountByTable =
      body.attachToOpenAccountByTable === true ||
      body.attachToTableOpenAccount === true
    const hasOpenAccountIntent = Boolean(
      explicitOpenAccountId || shouldAttachToOpenAccountByTable
    )
    let openAccountId = explicitOpenAccountId

    const hasDeliveryData =
      rawOrderType === "Delivery" ||
      rawTableNumber.toLowerCase().startsWith("delivery") ||
      Boolean((hasOpenAccountIntent ? false : customerPhone) || deliveryAddress || deliveryReference || rawDeliveryZone)

    const orderType: OrderType = hasDeliveryData
      ? "Delivery"
      : isValidOrderType(rawOrderType)
        ? rawOrderType
        : "Comer aquí"

    const isDeliveryOrder = orderType === "Delivery"

    if (explicitOpenAccountId || shouldAttachToOpenAccountByTable) {
      const openAccountsModuleCheck = await checkModuleAvailability(
        "openAccounts",
        "Cuentas abiertas"
      )

      if (!openAccountsModuleCheck.ok) {
        return openAccountsModuleCheck.response
      }

      if (orderType !== "Comer aquí") {
        return NextResponse.json(
          { error: "Las cuentas abiertas solo aceptan pedidos para consumo en local" },
          { status: 400 }
        )
      }
    }

    if (isDeliveryOrder) {
      const deliveryModuleCheck = await checkModuleAvailability(
        "delivery",
        "Delivery"
      )

      if (!deliveryModuleCheck.ok) {
        return deliveryModuleCheck.response
      }
    }

    // Precio del envío: SIEMPRE lo decide el servidor (el cliente no puede
    // mandar el monto). Primero se intenta el envío por distancia con la
    // ubicación del cliente; si el negocio no lo configuró, se cae al match
    // por zonas guardadas (flujo viejo, aún usado por otras marcas).
    let deliveryZone = rawDeliveryZone
    let deliveryCostUSD = 0
    let distanceQuoted = false
    let legacyDeliveryZones: Awaited<ReturnType<typeof getDeliveryZones>> = []
    let selectedDeliveryZone: ReturnType<typeof getDeliveryZoneOption> = undefined

    if (isDeliveryOrder) {
      const branchId = await resolveBranchId(request)
      const distanceSettings = await getDeliveryDistanceSettings(branchId)

      if (isDeliveryDistanceReady(distanceSettings)) {
        const mapsUrl = cleanText(body.deliveryMapsUrl)
        const link = isShortMapsLink(mapsUrl)
          ? await expandShortMapsLink(mapsUrl)
          : mapsUrl
        const coords = link ? parseCoordsFromText(link) : null
        const quote = coords ? quoteDeliveryByDistance(distanceSettings, coords) : null

        if (quote?.ok) {
          deliveryCostUSD = quote.costUSD
          deliveryZone = `~${quote.distanceKm.toFixed(1)} km`
          distanceQuoted = true
        }
      }

      if (!distanceQuoted) {
        legacyDeliveryZones = await getDeliveryZones(branchId)
        selectedDeliveryZone = getDeliveryZoneOption(rawDeliveryZone, legacyDeliveryZones)

        deliveryZone = selectedDeliveryZone?.name || rawDeliveryZone
        deliveryCostUSD = Number(selectedDeliveryZone?.costUSD || 0)
      }
    }

    const tableNumber = isDeliveryOrder
      ? `Delivery${deliveryZone ? ` - ${deliveryZone}` : ""}`
      : rawTableNumber

    if (explicitOpenAccountId || shouldAttachToOpenAccountByTable) {
      const openAccounts = await getOpenAccounts({ status: "Abierta" }, await resolveBranchId(request))
      const tableKey = normalizeComparableText(tableNumber)
      const openAccount = explicitOpenAccountId
        ? openAccounts.find((account) => account.id === explicitOpenAccountId)
        : openAccounts.find(
            (account) => normalizeComparableText(account.tableNumber) === tableKey
          )

      if (!openAccount) {
        return NextResponse.json(
          {
            error: explicitOpenAccountId
              ? "No se encontró una cuenta abierta activa para asociar el pedido"
              : "La mesa ya no tiene una cuenta abierta activa. Puedes registrar el pedido separado o pedir al personal que abra la cuenta.",
          },
          { status: explicitOpenAccountId ? 404 : 409 }
        )
      }

      openAccountId = openAccount.id
    }

    const customerNote = cleanText(body.customerNote)
    const items = normalizeItems(body.items)
    const exchangeRate = cleanNumber(body.exchangeRate)
    const exchangeSource = cleanText(body.exchangeSource)
    const exchangeValueDate = cleanText(body.exchangeValueDate)

    if (!customerName) {
      return NextResponse.json(
        {
          error: "Falta el nombre del cliente",
        },
        {
          status: 400,
        }
      )
    }

    if (!items.length) {
      return NextResponse.json(
        {
          error: "El pedido no tiene productos",
        },
        {
          status: 400,
        }
      )
    }

    // Límites anti-abuso (endpoint público): evitar pedidos gigantes o imágenes
    // pesadas que saturen la base o el almacenamiento.
    if (items.length > 200) {
      return NextResponse.json(
        { error: "El pedido tiene demasiados productos" },
        { status: 400 }
      )
    }

    const attachmentDataUrl = cleanText(body.attachmentDataUrl)
    let attachmentMimeType = cleanText(body.attachmentMimeType)
    let attachmentFileName = cleanText(body.attachmentFileName)

    if (attachmentDataUrl) {
      const attachmentImage = assertDataUrlImage(attachmentDataUrl, {
        label: "La imagen adjunta",
        maxBytes: getEnvByteLimit("ORDER_ATTACHMENT_IMAGE_MAX_BYTES", 6_000_000, {
          minBytes: 512_000,
          maxBytes: 8_000_000,
        }),
        fallbackMimeType: attachmentMimeType || "image/jpeg",
      })
      attachmentMimeType = attachmentImage.mimeType
      attachmentFileName = sanitizeUploadedImageFileName(
        attachmentFileName,
        `pedido-${Date.now()}`,
        attachmentImage.mimeType,
      )
    }

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      return NextResponse.json(
        {
          error: "La tasa no es válida",
        },
        {
          status: 400,
        }
      )
    }

    if (!isDeliveryOrder && !tableNumber) {
      return NextResponse.json(
        {
          error: "Falta la mesa o ubicación",
        },
        {
          status: 400,
        }
      )
    }

    if (isDeliveryOrder) {
      if (!customerName || customerName === "Cliente") {
        return NextResponse.json(
          {
            error: "Falta el nombre del cliente para delivery",
          },
          {
            status: 400,
          }
        )
      }

      if (!customerPhone) {
        return NextResponse.json(
          {
            error: "Falta el teléfono para delivery",
          },
          {
            status: 400,
          }
        )
      }

      if (!deliveryAddress) {
        return NextResponse.json(
          {
            error: "Falta la dirección para delivery",
          },
          {
            status: 400,
          }
        )
      }

      // El punto de referencia es opcional (como en las apps grandes): la
      // ubicación exacta ya viene con el link de Maps o la dirección escrita.

      // Validación de zona: solo aplica al flujo viejo por zonas (negocios
      // sin envío por distancia configurado). Con cotización por km la zona
      // es la etiqueta "~X km" que asignó el servidor; y sin zonas cargadas
      // el costo queda en 0 y se confirma por WhatsApp.
      if (
        !distanceQuoted &&
        legacyDeliveryZones.length > 0 &&
        rawDeliveryZone &&
        !selectedDeliveryZone
      ) {
        return NextResponse.json(
          {
            error: "Selecciona una zona de delivery válida",
          },
          {
            status: 400,
          }
        )
      }

      if (!paymentMethod) {
        return NextResponse.json(
          {
            error: "Falta el método de pago",
          },
          {
            status: 400,
          }
        )
      }

      if (!Number.isFinite(deliveryCostUSD) || deliveryCostUSD < 0) {
        return NextResponse.json(
          {
            error: "El costo de delivery no es válido",
          },
          {
            status: 400,
          }
        )
      }
    }

    const totals = calculateOrderTotalsFromItems(items, exchangeRate, deliveryCostUSD)

    // Atribución de ventas (0022): si el pedido lo registra staff con sesión,
    // guardamos quién fue. Pedidos del cliente web/QR no traen sesión y quedan
    // sin actor (el reporte los agrupa como "Cliente (web/QR)").
    const staffAccess = getAccess(request)
    const staffActor = staffAccess.ok ? getLocalAccessAuditActor(staffAccess) : null
    const registeredBy = staffActor?.label
      ? { id: staffActor.id, name: staffActor.label, role: staffActor.role }
      : undefined

    const orderPayload = {
      clientOrderId,
      registeredBy,
      customerName,
      customerPhone,
      tableNumber,
      orderType,
      customerNote,
      openAccountId,
      deliveryAddress,
      deliveryReference,
      deliveryZone,
      paymentMethod,
      deliveryCostUSD,
      totalBeforeDeliveryUSD: totals.totalBeforeDeliveryUSD,
      items,
      exchangeRate,
      exchangeSource,
      exchangeValueDate,
      totalUSD: totals.totalUSD,
      totalCombosUSD: totals.totalCombosUSD,
      totalRegularUSD: totals.totalRegularUSD,
      totalRegularVES: totals.totalRegularVES,
      attachmentDataUrl,
      attachmentFileName,
      attachmentMimeType,
    }

    const order = await createOrder(
      orderPayload as unknown as Parameters<typeof createOrder>[0],
      await resolveBranchId(request),
    )

    return NextResponse.json({
      order,
    })
  } catch (error) {
    if (error instanceof DataUrlImageError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    captureError(error, { route: "/api/orders", action: "POST" })

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo registrar el pedido",
      },
      {
        status: 500,
      }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-orders-delete",
    limit: 8,
    windowMs: 60_000,
    maxBytes: 32_000,
    rateLimitMessage: "Demasiados intentos de reiniciar pedidos. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = checkRole(request, ["owner", "manager"])

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

    const data = await clearOrders(await resolveBranchId(request))

    return NextResponse.json({
      ok: true,
      deleted: data.deleted || 0,
      message: data.message || "Pedidos reiniciados correctamente.",
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
            : "No se pudieron reiniciar los pedidos",
      },
      {
        status: 500,
      }
    )
  }
}

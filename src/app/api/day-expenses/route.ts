import { NextRequest, NextResponse } from "next/server"
import {
  deleteDayExpense,
  getBusinessConfig,
  getDayExpenses,
  saveDayExpense,
  type SaveDayExpenseInput,
} from "@/lib/orders"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"

import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

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
  }
}

async function checkExpensesModuleAvailability() {
  const businessConfig = await getBusinessConfig()
  const moduleAccess = getModulePlanAccess(
    businessConfig as unknown as Record<string, unknown>,
    "expenses"
  )

  if (!moduleAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        "Gastos no está incluido en el plan activo. Solicita activación o sube el plan para usar esta función."
      ),
      moduleAccess,
    }
  }

  if (!moduleAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        "Gastos está desactivado desde Configuración del negocio."
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

async function readSafeJson(request: NextRequest) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function normalizeText(value: unknown) {
  return String(value || "").trim()
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0
  }

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value

  const cleanValue = normalizeText(value).toLowerCase()

  return (
    cleanValue === "true" ||
    cleanValue === "si" ||
    cleanValue === "sí" ||
    cleanValue === "1" ||
    cleanValue === "activo"
  )
}

export async function GET(request: NextRequest) {
  try {
    const access = checkRole(request, ["owner", "manager"])

    if (!access.ok) {
      return access.response
    }

    const expensesModuleCheck = await checkExpensesModuleAvailability()

    if (!expensesModuleCheck.ok) {
      return expensesModuleCheck.response
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = normalizeText(searchParams.get("dateFrom"))
    const dateTo = normalizeText(searchParams.get("dateTo"))
    const dateValue = normalizeText(searchParams.get("dateValue"))

    const dayExpenses = await getDayExpenses(
      {
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(dateValue ? { dateValue } : {}),
      },
      await resolveBranchId(request),
    )

    return NextResponse.json({
      ok: true,
      dayExpenses,
      access: {
        role: access.role,
        moduleKey: "expenses",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los gastos del día",
      },
      {
        status: 500,
      }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-day-expenses-post",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de gastos. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  try {
    const access = checkRole(request, ["owner", "manager"])

    if (!access.ok) {
      return access.response
    }

    const expensesModuleCheck = await checkExpensesModuleAvailability()

    if (!expensesModuleCheck.ok) {
      return expensesModuleCheck.response
    }

    const body = await readSafeJson(request)

    const concept = normalizeText(body.concept)
    const category = normalizeText(body.category) || "Otros"
    const method = normalizeText(body.method) || "Sin registrar"
    const note = normalizeText(body.note)
    const dateLabel = normalizeText(body.dateLabel)
    const dateValue = normalizeText(body.dateValue)
    const amountUSD = normalizeNumber(body.amountUSD)
    const amountVES = normalizeNumber(body.amountVES)
    const equivalentUSD = normalizeNumber(body.equivalentUSD)

    const provider = normalizeText(body.provider || body.supplier)
    const expenseType =
      normalizeText(body.expenseType || body.type) ||
      (category === "Materia prima" || category === "Compra de productos"
        ? "Compra de inventario"
        : "Gasto operativo")

    const inventoryItemId = normalizeText(body.inventoryItemId)
    const inventoryItemName = normalizeText(body.inventoryItemName)
    const inventoryQuantity = normalizeNumber(body.inventoryQuantity)
    const inventoryUnit = normalizeText(body.inventoryUnit) || "unidades"
    const inventoryLinked =
      normalizeBoolean(body.inventoryLinked) ||
      normalizeBoolean(body.relatedInventory) ||
      Boolean(inventoryItemId || inventoryItemName || inventoryQuantity > 0)

    if (!concept) {
      return NextResponse.json(
        {
          error: "Falta el concepto del gasto",
        },
        {
          status: 400,
        }
      )
    }

    if (amountUSD <= 0 && amountVES <= 0 && equivalentUSD <= 0) {
      return NextResponse.json(
        {
          error: "Debes registrar un monto de gasto",
        },
        {
          status: 400,
        }
      )
    }

    const input: SaveDayExpenseInput = {
      concept,
      category,
      method,
      note,
      amountUSD,
      amountVES,
      equivalentUSD,
      provider,
      expenseType,
      inventoryLinked,
      inventoryItemId,
      inventoryItemName,
      inventoryQuantity,
      inventoryUnit,
      ...(dateLabel ? { dateLabel } : {}),
      ...(dateValue ? { dateValue } : {}),
    }

    const dayExpense = await saveDayExpense(input, await resolveBranchId(request))

    return NextResponse.json({
      ok: true,
      dayExpense,
      access: {
        role: access.role,
        moduleKey: "expenses",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el gasto del día",
      },
      {
        status: 500,
      }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-day-expenses-delete",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 256_000,
    rateLimitMessage: "Demasiados cambios de gastos. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  try {
    const access = checkRole(request, ["owner"])

    if (!access.ok) {
      return access.response
    }

    const expensesModuleCheck = await checkExpensesModuleAvailability()

    if (!expensesModuleCheck.ok) {
      return expensesModuleCheck.response
    }

    const { searchParams } = new URL(request.url)
    const body = await readSafeJson(request)
    const expenseId = normalizeText(searchParams.get("id") || body.expenseId || body.id)

    if (!expenseId) {
      return NextResponse.json(
        {
          error: "Falta el ID del gasto",
        },
        {
          status: 400,
        }
      )
    }

    await deleteDayExpense(expenseId)

    return NextResponse.json({
      ok: true,
      access: {
        role: access.role,
        moduleKey: "expenses",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el gasto del día",
      },
      {
        status: 500,
      }
    )
  }
}

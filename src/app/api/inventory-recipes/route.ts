import { NextRequest, NextResponse } from "next/server"
import {
  deleteInventoryRecipe,
  getBusinessConfig,
  getInventoryRecipes,
  saveInventoryRecipe,
  type InventoryRecipeIngredient,
  type SaveInventoryRecipeInput,
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

function forbiddenResponse(message = "Esta clave no tiene permiso para usar recetas de inventario") {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 403,
    }
  )
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0
  }

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function normalizeBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value

  const normalized = String(value || "")
    .trim()
    .toLowerCase()

  if (["true", "1", "si", "sí", "activo", "activa", "enabled", "on"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no", "inactivo", "inactiva", "disabled", "off"].includes(normalized)) {
    return false
  }

  return fallback
}

function normalizeIngredients(value: unknown): InventoryRecipeIngredient[] {
  if (!Array.isArray(value)) return []

  return value
    .map((ingredient) => {
      const source = (ingredient || {}) as Partial<InventoryRecipeIngredient>

      return {
        itemId: String(source.itemId || "").trim(),
        itemName: String(source.itemName || "").trim(),
        quantity: normalizeNumber(source.quantity),
        unit: String(source.unit || "unidades").trim() || "unidades",
      }
    })
    .filter(
      (ingredient) =>
        ingredient.itemId && ingredient.itemName && ingredient.quantity > 0
    )
}

function normalizeRecipePayload(source: Record<string, unknown>): SaveInventoryRecipeInput {
  return {
    id: String(source.id || "").trim() || undefined,
    productId: Number(source.productId || 0),
    productName: String(source.productName || "").trim(),
    productCategory: String(source.productCategory || "").trim(),
    ingredients: normalizeIngredients(source.ingredients),
    note: String(source.note || "").trim(),
    isActive: normalizeBoolean(source.isActive, true),
  }
}

async function checkInventoryAccess(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

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

  const businessConfig = await getBusinessConfig()
  const inventoryAccess = getModulePlanAccess(businessConfig, "inventory")

  if (!inventoryAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        `Inventario básico está disponible desde ${inventoryAccess.minimumPlanLabel}.`
      ),
      role: access.role,
    }
  }

  if (!inventoryAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse("Inventario básico está desactivado para este negocio."),
      role: access.role,
    }
  }

  return {
    ok: true as const,
    response: null,
    role: access.role,
    businessConfig,
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkInventoryAccess(request, ["owner", "support"])

    if (!access.ok) {
      return access.response
    }

    const inventoryRecipes = await getInventoryRecipes(await resolveBranchId(request))

    return NextResponse.json({
      ok: true,
      inventoryRecipes,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las recetas de inventario",
      },
      {
        status: 500,
      }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-inventory-recipes-post",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "INVENTORY_MUTATION_MAX_BYTES",
    maxBytes: 2_000_000,
    rateLimitMessage: "Demasiados cambios de recetas. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  try {
    const access = await checkInventoryAccess(request, ["owner", "support"])

    if (!access.ok) {
      return access.response
    }

    const body = await request.json()
    const rawRecipe = (body.inventoryRecipe || body.recipe || body || {}) as Record<string, unknown>
    const recipeInput = normalizeRecipePayload(rawRecipe)

    if (!recipeInput.productId || !recipeInput.productName) {
      return NextResponse.json(
        {
          error: "Selecciona el producto del menú para esta receta",
        },
        {
          status: 400,
        }
      )
    }

    if (!recipeInput.ingredients.length) {
      return NextResponse.json(
        {
          error: "Agrega al menos un insumo a la receta",
        },
        {
          status: 400,
        }
      )
    }

    const result = await saveInventoryRecipe(recipeInput, await resolveBranchId(request))

    return NextResponse.json({
      ok: true,
      inventoryRecipe: result.inventoryRecipe,
      message: "Receta guardada correctamente.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la receta de inventario",
      },
      {
        status: 500,
      }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-inventory-recipes-delete",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 256_000,
    rateLimitMessage: "Demasiados cambios de recetas. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  try {
    const access = await checkInventoryAccess(request, ["owner", "support"])

    if (!access.ok) {
      return access.response
    }

    const recipeId = request.nextUrl.searchParams.get("id") || ""

    if (!recipeId.trim()) {
      return NextResponse.json(
        {
          error: "Falta el ID de la receta",
        },
        {
          status: 400,
        }
      )
    }

    const result = await deleteInventoryRecipe(recipeId, await resolveBranchId(request))

    return NextResponse.json({
      ok: true,
      message: result.message,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar la receta de inventario",
      },
      {
        status: 500,
      }
    )
  }
}

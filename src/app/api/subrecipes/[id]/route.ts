import { NextRequest, NextResponse } from "next/server"
import { deleteSubrecipe, getSubrecipes, saveSubrecipe } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkSubrecipesAccess } from "../guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function toNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function normalizeIngredients(value: unknown) {
  if (!Array.isArray(value)) return undefined
  return value
    .map((raw) => {
      const item = (raw || {}) as Record<string, unknown>
      return {
        itemId: cleanText(item.itemId),
        itemName: cleanText(item.itemName),
        quantity: toNumber(item.quantity),
        unit: cleanText(item.unit) || "unidades",
      }
    })
    .filter((ingredient) => ingredient.itemId || ingredient.itemName)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-subrecipes-patch",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de subrecetas. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkSubrecipesAccess(request, ["owner"])
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    if (body.name !== undefined && !cleanText(body.name)) {
      return NextResponse.json({ error: "El nombre no puede quedar vacío" }, { status: 400 })
    }

    const branchId = await resolveBranchId(request)

    // saveSubrecipe hace replace de los campos; partimos de la subreceta actual y
    // solo sobreescribimos lo enviado (PATCH parcial sin perder datos).
    const current = (await getSubrecipes(branchId)).find((s) => s.id === id)
    if (!current) return NextResponse.json({ error: "Subreceta no encontrada" }, { status: 404 })

    const nextIngredients = normalizeIngredients(body.ingredients)

    const subrecipe = await saveSubrecipe(
      {
        id,
        name: body.name !== undefined ? cleanText(body.name) : current.name,
        yieldQuantity:
          body.yieldQuantity !== undefined ? toNumber(body.yieldQuantity) || 1 : current.yieldQuantity,
        yieldUnit: body.yieldUnit !== undefined ? cleanText(body.yieldUnit) || "porción" : current.yieldUnit,
        ingredients: nextIngredients !== undefined ? nextIngredients : current.ingredients,
        note: body.note !== undefined ? cleanText(body.note) : current.note,
        isActive: body.isActive !== undefined ? body.isActive === true : current.isActive,
      },
      branchId,
    )

    return NextResponse.json({ ok: true, subrecipe })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar la subreceta",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-subrecipes-delete",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 128_000,
    rateLimitMessage: "Demasiados cambios de subrecetas. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkSubrecipesAccess(request, ["owner"])
    if (!access.ok) return access.response

    const { id } = await context.params
    await deleteSubrecipe(id, await resolveBranchId(request))

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo eliminar la subreceta",
      },
      { status: 500 }
    )
  }
}

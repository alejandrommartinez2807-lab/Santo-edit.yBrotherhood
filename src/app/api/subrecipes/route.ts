import { NextRequest, NextResponse } from "next/server"
import { getSubrecipes, saveSubrecipe, type SaveSubrecipeInput } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkSubrecipesAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function toNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function normalizeIngredients(value: unknown): SaveSubrecipeInput["ingredients"] {
  if (!Array.isArray(value)) return []
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

function normalizeSubrecipePayload(source: Record<string, unknown>): SaveSubrecipeInput {
  return {
    id: cleanText(source.id) || undefined,
    name: cleanText(source.name),
    yieldQuantity: toNumber(source.yieldQuantity) || 1,
    yieldUnit: cleanText(source.yieldUnit) || "porción",
    ingredients: normalizeIngredients(source.ingredients),
    note: cleanText(source.note),
    isActive: source.isActive === undefined ? true : source.isActive === true,
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkSubrecipesAccess(request, ["owner", "support"])
    if (!access.ok) return access.response

    const subrecipes = await getSubrecipes(await resolveBranchId(request))

    return NextResponse.json({ ok: true, subrecipes })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron cargar las subrecetas",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-subrecipes-post",
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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const subrecipeInput = normalizeSubrecipePayload(
      body.subrecipe ? (body.subrecipe as Record<string, unknown>) : body
    )

    if (!subrecipeInput.name) {
      return NextResponse.json({ error: "Escribe el nombre de la subreceta" }, { status: 400 })
    }

    const subrecipe = await saveSubrecipe(subrecipeInput, await resolveBranchId(request))

    return NextResponse.json({ ok: true, subrecipe }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar la subreceta",
      },
      { status: 500 }
    )
  }
}

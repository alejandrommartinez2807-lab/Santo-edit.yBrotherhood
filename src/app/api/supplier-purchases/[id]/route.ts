import { NextRequest, NextResponse } from "next/server"
import { deleteSupplierPurchase, updateSupplierPurchase } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkSuppliersAccess } from "../../suppliers/guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function normalizeAmount(value: unknown) {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-supplier-purchases-patch",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de compras. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkSuppliersAccess(request, ["owner"])
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    // Solo se actualizan los campos enviados; el proveedor de la compra no cambia.
    const patch: Parameters<typeof updateSupplierPurchase>[1] = {}
    if (body.purchaseDate !== undefined) {
      const date = cleanText(body.purchaseDate)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
      }
      patch.purchaseDate = date
    }
    if (body.documentNumber !== undefined) patch.documentNumber = cleanText(body.documentNumber)
    if (body.totalUSD !== undefined) patch.totalUSD = normalizeAmount(body.totalUSD)
    if (body.totalVES !== undefined) patch.totalVES = normalizeAmount(body.totalVES)
    if (body.note !== undefined) patch.note = cleanText(body.note)

    const updated = await updateSupplierPurchase(id, patch, await resolveBranchId(request))
    if (!updated) {
      return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, purchase: updated })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar la compra",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-supplier-purchases-delete",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 128_000,
    rateLimitMessage: "Demasiados cambios de compras. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkSuppliersAccess(request, ["owner"])
    if (!access.ok) return access.response

    const { id } = await context.params
    await deleteSupplierPurchase(id, await resolveBranchId(request))

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo eliminar la compra",
      },
      { status: 500 }
    )
  }
}

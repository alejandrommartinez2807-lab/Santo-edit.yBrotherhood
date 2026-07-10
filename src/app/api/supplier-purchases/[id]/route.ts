import { NextRequest, NextResponse } from "next/server"
import { deleteSupplierPurchase, updateSupplierPurchase } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { writeAuditLog } from "@/lib/audit"
import { getLocalAccessAuditActor } from "@/lib/localAccess"

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
    if (body.dueDate !== undefined) {
      const due = cleanText(body.dueDate)
      if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
        return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 })
      }
      patch.dueDate = due
    }
    if (body.documentNumber !== undefined) patch.documentNumber = cleanText(body.documentNumber)
    if (body.totalUSD !== undefined) patch.totalUSD = normalizeAmount(body.totalUSD)
    if (body.totalVES !== undefined) patch.totalVES = normalizeAmount(body.totalVES)
    if (body.note !== undefined) patch.note = cleanText(body.note)

    const branchId = await resolveBranchId(request)
    const updated = await updateSupplierPurchase(id, patch, branchId)
    if (!updated) {
      return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 })
    }

    await writeAuditLog({
      action: "supplier_purchase.updated",
      branchId,
      entityType: "supplier_purchase",
      entityId: updated.id,
      actor: getLocalAccessAuditActor(access.access),
      request,
      metadata: { changes: patch, totalUSD: updated.totalUSD, totalVES: updated.totalVES },
    })

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
    const branchId = await resolveBranchId(request)
    await deleteSupplierPurchase(id, branchId)

    await writeAuditLog({
      action: "supplier_purchase.deleted",
      branchId,
      entityType: "supplier_purchase",
      entityId: id,
      actor: getLocalAccessAuditActor(access.access),
      request,
    })

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

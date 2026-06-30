import { NextRequest, NextResponse } from "next/server"
import { getInventory, getSupplierPurchases, getSuppliers, saveSupplierPurchase } from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkSuppliersAccess } from "../suppliers/guard"

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

// Acepta YYYY-MM-DD; si viene vacío o inválido, usa la fecha de hoy.
function normalizeDate(value: unknown) {
  const text = cleanText(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10)
}

function normalizeOptionalDate(value: unknown) {
  const text = cleanText(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkSuppliersAccess(request, ["owner", "support"])
    if (!access.ok) return access.response

    const supplierId = request.nextUrl.searchParams.get("supplierId") || null
    const paymentStatus = request.nextUrl.searchParams.get("paymentStatus") || null
    const purchases = await getSupplierPurchases(await resolveBranchId(request), supplierId, { paymentStatus })

    return NextResponse.json({ ok: true, purchases })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron cargar las compras",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-supplier-purchases-post",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados registros de compras. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkSuppliersAccess(request, ["owner"])
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const supplierId = cleanText(body.supplierId)
    if (!supplierId) {
      return NextResponse.json({ error: "Selecciona el proveedor de la compra" }, { status: 400 })
    }

    const branchId = await resolveBranchId(request)

    // El proveedor debe existir y pertenecer a esta sucursal. Tomamos el nombre
    // como snapshot para conservar el historial aunque luego se borre.
    const supplier = (await getSuppliers(branchId)).find((s) => s.id === supplierId)
    if (!supplier) {
      return NextResponse.json({ error: "El proveedor seleccionado no existe en esta sucursal" }, { status: 400 })
    }

    // Relación opcional con inventario (Fase 2b). Si se indica un insumo, valida
    // que el módulo de inventario esté activo y que el insumo exista en la
    // sucursal; tomamos nombre/unidad como snapshot.
    const inventoryItemId = cleanText(body.inventoryItemId)
    let inventoryItemName = ""
    let inventoryUnit = ""
    const inventoryQuantity = Number(body.inventoryQuantity) || 0
    if (inventoryItemId) {
      const inventoryAccess = getModulePlanAccess(access.businessConfig, "inventory")
      if (!inventoryAccess.effectiveEnabled) {
        return NextResponse.json(
          { error: "Activa el módulo de inventario para sumar compras al stock." },
          { status: 400 }
        )
      }
      if (!(inventoryQuantity > 0)) {
        return NextResponse.json(
          { error: "Indica la cantidad que entra al inventario (mayor a cero)." },
          { status: 400 }
        )
      }
      const item = (await getInventory(branchId)).find((i) => i.id === inventoryItemId)
      if (!item) {
        return NextResponse.json(
          { error: "El insumo de inventario seleccionado no existe en esta sucursal." },
          { status: 400 }
        )
      }
      inventoryItemName = item.name
      inventoryUnit = item.unit
    }

    const purchase = await saveSupplierPurchase(
      {
        supplierId,
        supplierName: supplier.name,
        purchaseDate: normalizeDate(body.purchaseDate),
        dueDate: normalizeOptionalDate(body.dueDate),
        documentNumber: cleanText(body.documentNumber),
        totalUSD: normalizeAmount(body.totalUSD),
        totalVES: normalizeAmount(body.totalVES),
        note: cleanText(body.note),
        paymentMethod: cleanText(body.paymentMethod),
        paymentReference: cleanText(body.paymentReference),
        paymentNote: cleanText(body.paymentNote),
        initialPaidUSD: normalizeAmount(body.initialPaidUSD),
        initialPaidVES: normalizeAmount(body.initialPaidVES),
        inventoryItemId: inventoryItemId || null,
        inventoryItemName,
        inventoryQuantity,
        inventoryUnit,
      },
      branchId,
    )

    return NextResponse.json({ ok: true, purchase }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo registrar la compra",
      },
      { status: 500 }
    )
  }
}

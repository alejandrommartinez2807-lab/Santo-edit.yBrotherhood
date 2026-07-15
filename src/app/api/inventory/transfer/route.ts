import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import {
  canLocalAccessUseModule,
  getLocalAccessAuditActor,
  getRequestAccess,
} from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { writeAuditLog } from "@/lib/audit"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import {
  transferInventoryToBranch,
  type InventoryTransferItemInput,
} from "@/lib/inventoryTransfer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Transferencia de inventario entre sedes (surtir un evento/feria desde la
// sede principal). Solo dueño/soporte, igual que el resto del inventario.

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-inventory-transfer-post",
    limit: 30,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 256_000,
    rateLimitMessage:
      "Demasiadas transferencias seguidas. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = getRequestAccess(request, getRequestPassword(request))

    if (!access.ok) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    if (
      !["owner", "support"].includes(access.role) ||
      !canLocalAccessUseModule(access, "inventory")
    ) {
      return NextResponse.json(
        { error: "Solo el dueño puede transferir inventario entre sedes" },
        { status: 403 },
      )
    }

    const businessConfig = await getBusinessConfig()
    const inventoryAccess = getModulePlanAccess(businessConfig, "inventory")

    if (!inventoryAccess.includedInPlan || !inventoryAccess.effectiveEnabled) {
      return NextResponse.json(
        { error: "Inventario básico no está disponible para este negocio" },
        { status: 403 },
      )
    }

    const sourceBranchId = await resolveBranchId(request)

    if (!sourceBranchId) {
      return NextResponse.json(
        { error: "Selecciona primero la sede desde la que transfieres" },
        { status: 400 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const items = (Array.isArray(body.items) ? body.items : []) as InventoryTransferItemInput[]
    const targetBranchId = String(body.targetBranchId || "").trim()
    const note = String(body.note || "").trim()
    const actor = getLocalAccessAuditActor(access)

    const result = await transferInventoryToBranch({
      sourceBranchId,
      targetBranchId,
      items,
      note,
      actorLabel: actor.label || "",
    })

    await writeAuditLog({
      action: "inventory.transferred",
      branchId: sourceBranchId,
      entityType: "inventory_item",
      actor,
      request,
      metadata: {
        toBranch: result.targetBranchName,
        items: result.transferred
          .map((line) => `${line.quantity} ${line.unit} ${line.itemName}`)
          .join(", "),
        ...(note ? { note } : {}),
      },
    })

    return NextResponse.json({
      ok: true,
      message: `Transferencia a ${result.targetBranchName} registrada (${result.transferred.length} producto(s)).`,
      transferred: result.transferred,
      targetBranchName: result.targetBranchName,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo completar la transferencia",
      },
      { status: 400 },
    )
  }
}

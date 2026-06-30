import { NextRequest, NextResponse } from "next/server"
import { deleteSupplier, getSuppliers, saveSupplier } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkSuppliersAccess } from "../guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-suppliers-patch",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de proveedores. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkSuppliersAccess(request, ["owner"])
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    if (body.name !== undefined && !cleanText(body.name)) {
      return NextResponse.json({ error: "El nombre no puede quedar vacío" }, { status: 400 })
    }

    const branchId = await resolveBranchId(request)

    // saveSupplier hace replace de los campos; partimos del proveedor actual y
    // solo sobreescribimos los campos enviados (PATCH parcial sin perder datos).
    const current = (await getSuppliers(branchId)).find((s) => s.id === id)
    if (!current) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })

    const supplier = await saveSupplier(
      {
        id,
        name: body.name !== undefined ? cleanText(body.name) : current.name,
        contactName: body.contactName !== undefined ? cleanText(body.contactName) : current.contactName,
        phone: body.phone !== undefined ? cleanText(body.phone) : current.phone,
        email: body.email !== undefined ? cleanText(body.email) : current.email,
        note: body.note !== undefined ? cleanText(body.note) : current.note,
        isActive: body.isActive !== undefined ? body.isActive === true : current.isActive,
      },
      branchId,
    )

    return NextResponse.json({ ok: true, supplier })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar el proveedor",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-suppliers-delete",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 128_000,
    rateLimitMessage: "Demasiados cambios de proveedores. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkSuppliersAccess(request, ["owner"])
    if (!access.ok) return access.response

    const { id } = await context.params
    await deleteSupplier(id, await resolveBranchId(request))

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo eliminar el proveedor",
      },
      { status: 500 }
    )
  }
}

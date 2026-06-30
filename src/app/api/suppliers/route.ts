import { NextRequest, NextResponse } from "next/server"
import { getSuppliers, saveSupplier, type SaveSupplierInput } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkSuppliersAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function normalizeBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value
  const normalized = cleanText(value).toLowerCase()
  if (["true", "1", "si", "sí", "activo", "activa", "on"].includes(normalized)) return true
  if (["false", "0", "no", "inactivo", "inactiva", "off"].includes(normalized)) return false
  return fallback
}

function normalizeSupplierPayload(source: Record<string, unknown>): SaveSupplierInput {
  return {
    id: cleanText(source.id) || undefined,
    name: cleanText(source.name),
    contactName: cleanText(source.contactName),
    phone: cleanText(source.phone),
    email: cleanText(source.email),
    note: cleanText(source.note),
    isActive: normalizeBoolean(source.isActive, true),
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkSuppliersAccess(request, ["owner", "support"])
    if (!access.ok) return access.response

    const suppliers = await getSuppliers(await resolveBranchId(request))

    return NextResponse.json({ ok: true, suppliers })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron cargar los proveedores",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-suppliers-post",
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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const supplierInput = normalizeSupplierPayload(
      body.supplier ? (body.supplier as Record<string, unknown>) : body
    )

    if (!supplierInput.name) {
      return NextResponse.json({ error: "Escribe el nombre del proveedor" }, { status: 400 })
    }

    const supplier = await saveSupplier(supplierInput, await resolveBranchId(request))

    return NextResponse.json({ ok: true, supplier }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar el proveedor",
      },
      { status: 500 }
    )
  }
}

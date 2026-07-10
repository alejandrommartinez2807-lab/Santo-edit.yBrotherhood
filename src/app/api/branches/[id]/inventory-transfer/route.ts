import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getRequestAccess } from "@/lib/localAccess"
import {
  transferInventoryBetweenBranches,
  type InventoryTransferLine,
} from "@/lib/branchProvisioning"

import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Traslado de inventario entre la sede [id] (normalmente un evento) y otra
// sede. direction "in" = recibir stock de counterpartBranchId (enviar a la
// feria); "out" = enviar stock hacia counterpartBranchId (devolver el sobrante
// al finalizar). items: lista {itemId, quantity} de la sede ORIGEN, o "all"
// para mover todo el stock disponible.

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function cleanText(v: unknown) {
  return String(v || "").trim()
}

async function getBranch(branchId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("branches")
    .select("id, name")
    .eq("id", branchId)
    .maybeSingle()

  if (error) throw new Error(error.message || "No se pudo cargar la sede")
  return data as { id: string; name: string } | null
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-branches-inventory-transfer",
    limit: 30,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 256_000,
    rateLimitMessage: "Demasiados traslados seguidos. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  const access = getRequestAccess(request, getRequestPassword(request))
  if (!access.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (access.role !== "owner") {
    return NextResponse.json(
      { error: "Solo el dueño puede trasladar inventario entre sedes" },
      { status: 403 },
    )
  }

  try {
    const { id } = await context.params
    const branchId = cleanText(id)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const direction = cleanText(body.direction) === "out" ? "out" : "in"
    const counterpartBranchId = cleanText(body.counterpartBranchId)

    if (!counterpartBranchId) {
      return NextResponse.json({ error: "Indica la otra sede del traslado" }, { status: 400 })
    }

    const [branch, counterpart] = await Promise.all([
      getBranch(branchId),
      getBranch(counterpartBranchId),
    ])

    if (!branch) return NextResponse.json({ error: "Sede no encontrada" }, { status: 404 })
    if (!counterpart) {
      return NextResponse.json({ error: "La otra sede del traslado no existe" }, { status: 404 })
    }

    const items: InventoryTransferLine[] | "all" =
      body.items === "all"
        ? "all"
        : Array.isArray(body.items)
          ? (body.items as InventoryTransferLine[])
          : []

    if (items !== "all" && items.length === 0) {
      return NextResponse.json(
        { error: "Indica los insumos y cantidades a trasladar" },
        { status: 400 },
      )
    }

    const source = direction === "in" ? counterpart : branch
    const target = direction === "in" ? branch : counterpart

    const result = await transferInventoryBetweenBranches(source.id, target.id, items, {
      sourceName: source.name,
      targetName: target.name,
    })

    const movedCount = result.transferred.length
    return NextResponse.json({
      ok: true,
      ...result,
      message: movedCount
        ? `Traslado listo: ${movedCount} insumo(s) de ${source.name} a ${target.name}.`
        : "No había stock disponible para trasladar.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo completar el traslado",
      },
      { status: 500 },
    )
  }
}

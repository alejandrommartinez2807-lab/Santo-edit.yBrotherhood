import { NextRequest, NextResponse } from "next/server"
import {
  addFolioItem,
  deletePackage,
  getFolioByReservation,
  getHotelReservations,
  getPackages,
  savePackage,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { getLocalAccessAuditActor, getRequestAccess } from "@/lib/localAccess"

import { checkPackagesAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

// GET : catálogo de paquetes + reservas en casa (para aplicar).
export async function GET(request: NextRequest) {
  try {
    const access = await checkPackagesAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const today = new Date().toISOString().slice(0, 10)
    const to = `${new Date().getFullYear() + 1}-01-01`
    const [packages, reservations] = await Promise.all([
      getPackages(branchId),
      getHotelReservations({ from: today, to }, branchId),
    ])
    const inHouse = reservations
      .filter((r) => r.status === "checkin")
      .map((r) => ({ id: r.id, guestName: r.guestName }))
    return NextResponse.json({ ok: true, packages, inHouse })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los paquetes" },
      { status: 500 }
    )
  }
}

// POST : savePackage | deletePackage | applyToReservation.
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-packages-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de paquetes. Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkPackagesAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const actor = getLocalAccessAuditActor(getRequestAccess(request, request.headers.get("x-admin-password")))
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = cleanText(body.action) || "savePackage"

    if (action === "deletePackage") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Paquete no indicado" }, { status: 400 })
      await deletePackage(id, branchId)
      return NextResponse.json({ ok: true })
    }

    if (action === "applyToReservation") {
      const packageId = cleanText(body.packageId)
      const reservationId = cleanText(body.reservationId)
      if (!packageId || !reservationId) {
        return NextResponse.json({ error: "Indica el paquete y la reserva" }, { status: 400 })
      }
      const pkg = (await getPackages(branchId)).find((p) => p.id === packageId)
      if (!pkg) return NextResponse.json({ error: "Paquete no encontrado" }, { status: 404 })
      const folio = await getFolioByReservation(reservationId, branchId)
      if (!folio) {
        return NextResponse.json({ error: "El huésped no tiene folio abierto. Haz el check-in primero." }, { status: 409 })
      }
      if (pkg.price <= 0) {
        return NextResponse.json({ error: "El paquete no tiene precio para cargar" }, { status: 400 })
      }
      await addFolioItem(
        {
          folioId: folio.id,
          kind: "cargo",
          category: "paquete",
          description: `Paquete: ${pkg.name}`,
          amount: pkg.price,
          unitAmount: pkg.price,
          quantity: 1,
          createdBy: actor.label || "",
        },
        branchId,
      )
      return NextResponse.json({ ok: true })
    }

    // savePackage
    const name = cleanText(body.name)
    if (!name) return NextResponse.json({ error: "Escribe el nombre del paquete" }, { status: 400 })
    const pkg = await savePackage(
      {
        id: cleanText(body.id) || undefined,
        name,
        description: cleanText(body.description),
        includes: cleanText(body.includes),
        price: optionalNumber(body.price),
        active: body.active === undefined ? undefined : body.active !== false,
        sortOrder: optionalNumber(body.sortOrder),
      },
      branchId,
    )
    return NextResponse.json({ ok: true, package: pkg }, { status: body.id ? 200 : 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar el paquete" },
      { status: 500 }
    )
  }
}

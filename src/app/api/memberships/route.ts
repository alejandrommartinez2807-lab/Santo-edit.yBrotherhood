import { NextRequest, NextResponse } from "next/server"
import {
  assignGuestMembership,
  deleteGuestMembership,
  deleteMembership,
  getGuestMemberships,
  getGuestProfiles,
  getMemberships,
  saveMembership,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkMembershipsAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

// GET: niveles de membresía + membresías de huéspedes (con nombre y % del nivel)
// + fichas del CRM para poder asignar.
export async function GET(request: NextRequest) {
  try {
    const access = await checkMembershipsAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const [memberships, guestMemberships, guests] = await Promise.all([
      getMemberships(branchId),
      getGuestMemberships(branchId),
      getGuestProfiles(branchId).catch(() => []),
    ])
    const byId = new Map(memberships.map((m) => [m.id, m]))
    const assigned = guestMemberships.map((gm) => ({
      ...gm,
      membershipName: byId.get(gm.membershipId)?.name || "",
      discountPct: byId.get(gm.membershipId)?.discountPct || 0,
    }))
    return NextResponse.json({
      ok: true,
      memberships,
      guestMemberships: assigned,
      guests: guests.map((g) => ({ id: g.id, fullName: g.fullName, phone: g.phone })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las membresías" },
      { status: 500 },
    )
  }
}

// POST: saveMembership | deleteMembership | assign | deleteGuestMembership
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-memberships-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkMembershipsAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = cleanText(body.action)

    if (action === "saveMembership") {
      const name = cleanText(body.name)
      if (!name) return NextResponse.json({ error: "Indica el nombre de la membresía" }, { status: 400 })
      const membership = await saveMembership(
        {
          id: cleanText(body.id),
          name,
          level: cleanText(body.level),
          benefits: cleanText(body.benefits),
          discountPct: Number(body.discountPct) || 0,
          active: body.active !== false,
        },
        branchId,
      )
      return NextResponse.json({ ok: true, membership }, { status: 201 })
    }

    if (action === "deleteMembership") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Membresía no indicada" }, { status: 400 })
      await deleteMembership(id, branchId)
      return NextResponse.json({ ok: true })
    }

    if (action === "assign") {
      const membershipId = cleanText(body.membershipId)
      const guestName = cleanText(body.guestName)
      if (!membershipId) return NextResponse.json({ error: "Elige la membresía" }, { status: 400 })
      if (!guestName) return NextResponse.json({ error: "Indica el huésped" }, { status: 400 })
      const guestMembership = await assignGuestMembership(
        {
          membershipId,
          guestProfileId: cleanText(body.guestProfileId),
          guestName,
          expiresAt: cleanText(body.expiresAt),
        },
        branchId,
      )
      return NextResponse.json({ ok: true, guestMembership }, { status: 201 })
    }

    if (action === "deleteGuestMembership") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Registro no indicado" }, { status: 400 })
      await deleteGuestMembership(id, branchId)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar la membresía" },
      { status: 500 },
    )
  }
}

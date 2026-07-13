import { NextRequest, NextResponse } from "next/server"
import {
  addFolioItem,
  closeFolio,
  deleteFolioItem,
  folioBalance,
  getChargedOrderIds,
  getFolioByReservation,
  getFolioItems,
  getGuest,
  getHotelReservationById,
  getOrders,
  hasRoomCharge,
  openFolio,
  saveGuest,
  updateHotelReservationGuest,
  updateHotelReservationStatus,
} from "@/lib/orders"
import type { LocalOrder } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { getLocalAccessAuditActor } from "@/lib/localAccess"
import { getRequestAccess } from "@/lib/localAccess"

import { checkFolioAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function orderTotal(order: LocalOrder) {
  return Number(order.totalUSD ?? order.totalPrice ?? 0) || 0
}

// Pedidos del POS que se pueden cargar a una habitación: activos (no cancelados,
// no de práctica) y aún no cargados a ningún folio.
async function getChargeableOrders(branchId: string | null) {
  const [orders, chargedIds] = await Promise.all([
    getOrders(branchId),
    getChargedOrderIds(branchId),
  ])
  const charged = new Set(chargedIds)
  return orders
    .filter((order) => order.status !== "Cancelado" && !order.isTraining && !charged.has(order.id))
    .slice(0, 40)
    .map((order) => ({
      id: order.id,
      number: order.branchNumber ?? order.rowNumber ?? null,
      customerName: order.customerName,
      tableNumber: order.tableNumber,
      orderType: order.orderType,
      status: order.status,
      total: orderTotal(order),
    }))
}

async function buildFolioView(reservationId: string, branchId: string | null) {
  const folio = await getFolioByReservation(reservationId, branchId)
  const items = folio ? await getFolioItems(folio.id, branchId) : []
  const reservation = await getHotelReservationById(reservationId, branchId)
  const guest = reservation?.guestId ? await getGuest(reservation.guestId, branchId) : null
  const chargeableOrders = folio && folio.status !== "cerrado" ? await getChargeableOrders(branchId) : []
  return {
    folio,
    items,
    guest,
    reservation,
    balance: folioBalance(items),
    chargeableOrders,
  }
}

// GET ?reservationId= : devuelve folio + líneas + huésped + reserva (sin crear).
export async function GET(request: NextRequest) {
  try {
    const access = await checkFolioAccess(request, ["owner", "manager", "waiter", "support"])
    if (!access.ok) return access.response

    const reservationId = cleanText(request.nextUrl.searchParams.get("reservationId"))
    if (!reservationId) {
      return NextResponse.json({ error: "Indica la reserva" }, { status: 400 })
    }

    const branchId = await resolveBranchId(request)
    const view = await buildFolioView(reservationId, branchId)
    return NextResponse.json({ ok: true, ...view })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el folio" },
      { status: 500 }
    )
  }
}

// POST : acciones sobre el folio (open | charge | payment | deleteItem | close).
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-folios-post",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios en el folio. Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkFolioAccess(request, ["owner", "manager", "waiter"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const actor = getLocalAccessAuditActor(getRequestAccess(request, request.headers.get("x-admin-password")))
    const createdBy = actor.label || ""

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = cleanText(body.action) || "open"

    // --- Abrir folio: hace check-in, guarda ficha del huésped y publica el
    // cargo de habitación (noches × tarifa) una sola vez. ---
    if (action === "open") {
      const reservationId = cleanText(body.reservationId)
      if (!reservationId) {
        return NextResponse.json({ error: "Indica la reserva" }, { status: 400 })
      }

      const reservation = await getHotelReservationById(reservationId, branchId)
      if (!reservation) {
        return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 })
      }

      // Ficha del huésped (opcional): si viene, la guarda y la vincula.
      let guestId = reservation.guestId
      const guestInput = body.guest as Record<string, unknown> | undefined
      if (guestInput && cleanText(guestInput.fullName)) {
        const guest = await saveGuest(
          {
            id: cleanText(guestInput.id) || guestId || undefined,
            fullName: cleanText(guestInput.fullName),
            documentType: cleanText(guestInput.documentType) || undefined,
            documentNumber: cleanText(guestInput.documentNumber),
            phone: cleanText(guestInput.phone) || reservation.guestPhone,
            email: cleanText(guestInput.email),
            nationality: cleanText(guestInput.nationality),
            birthDate: cleanText(guestInput.birthDate),
            address: cleanText(guestInput.address),
            notes: cleanText(guestInput.notes),
          },
          branchId,
        )
        guestId = guest.id
        await updateHotelReservationGuest(reservationId, guestId, branchId)
      }

      const folio = await openFolio({ reservationId, guestId }, branchId)

      // Cargo de habitación una sola vez.
      if (!(await hasRoomCharge(folio.id, branchId)) && reservation.nights > 0 && reservation.ratePerNight > 0) {
        await addFolioItem(
          {
            folioId: folio.id,
            kind: "cargo",
            category: "habitacion",
            description: `Habitación · ${reservation.nights} noche(s)`,
            quantity: reservation.nights,
            unitAmount: reservation.ratePerNight,
            amount: reservation.totalAmount,
            createdBy,
          },
          branchId,
        )
      }

      // Marca check-in si aún estaba pendiente/confirmada.
      if (reservation.status === "pendiente" || reservation.status === "confirmada") {
        await updateHotelReservationStatus(reservationId, "checkin", branchId)
      }

      const view = await buildFolioView(reservationId, branchId)
      return NextResponse.json({ ok: true, ...view })
    }

    // --- Cargo o pago manual ---
    if (action === "charge" || action === "payment") {
      const folioId = cleanText(body.folioId)
      const reservationId = cleanText(body.reservationId)
      if (!folioId) return NextResponse.json({ error: "Folio no indicado" }, { status: 400 })

      const amount = Number(body.amount) || 0
      if (amount <= 0) {
        return NextResponse.json({ error: "Indica un monto mayor a cero" }, { status: 400 })
      }

      await addFolioItem(
        {
          folioId,
          kind: action === "payment" ? "pago" : "cargo",
          category: cleanText(body.category) || (action === "payment" ? "pago" : "extra"),
          description: cleanText(body.description),
          amount,
          unitAmount: amount,
          quantity: 1,
          method: cleanText(body.method),
          createdBy,
        },
        branchId,
      )

      const view = await buildFolioView(reservationId, branchId)
      return NextResponse.json({ ok: true, ...view })
    }

    // --- Cargar un pedido del restaurante a la habitación ---
    if (action === "chargeOrder") {
      const folioId = cleanText(body.folioId)
      const orderId = cleanText(body.orderId)
      const reservationId = cleanText(body.reservationId)
      if (!folioId || !orderId) {
        return NextResponse.json({ error: "Folio o pedido no indicado" }, { status: 400 })
      }

      // Idempotencia: no cargar dos veces el mismo pedido.
      const chargedIds = new Set(await getChargedOrderIds(branchId))
      if (chargedIds.has(orderId)) {
        return NextResponse.json({ error: "Ese pedido ya fue cargado a una habitación." }, { status: 409 })
      }

      const order = (await getOrders(branchId)).find((o) => o.id === orderId)
      if (!order) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
      }
      const amount = Number(order.totalUSD ?? order.totalPrice ?? 0) || 0
      if (amount <= 0) {
        return NextResponse.json({ error: "El pedido no tiene monto para cargar" }, { status: 400 })
      }

      const orderLabel = order.branchNumber ?? order.rowNumber
      await addFolioItem(
        {
          folioId,
          kind: "cargo",
          category: "restaurante",
          description: `Pedido${orderLabel ? ` #${orderLabel}` : ""}${order.customerName ? ` · ${order.customerName}` : ""}`,
          amount,
          unitAmount: amount,
          quantity: 1,
          sourceOrderId: orderId,
          createdBy,
        },
        branchId,
      )

      const view = await buildFolioView(reservationId, branchId)
      return NextResponse.json({ ok: true, ...view })
    }

    // --- Eliminar una línea ---
    if (action === "deleteItem") {
      const itemId = cleanText(body.itemId)
      const reservationId = cleanText(body.reservationId)
      if (!itemId) return NextResponse.json({ error: "Línea no indicada" }, { status: 400 })
      await deleteFolioItem(itemId, branchId)
      const view = await buildFolioView(reservationId, branchId)
      return NextResponse.json({ ok: true, ...view })
    }

    // --- Cerrar folio + check-out ---
    if (action === "close") {
      const folioId = cleanText(body.folioId)
      const reservationId = cleanText(body.reservationId)
      if (!folioId) return NextResponse.json({ error: "Folio no indicado" }, { status: 400 })

      const items = await getFolioItems(folioId, branchId)
      const balance = folioBalance(items)
      const force = body.force === true
      if (balance > 0 && !force) {
        return NextResponse.json(
          { error: `El folio tiene saldo pendiente de $${balance}. Registra el pago o confirma el cierre.`, balance },
          { status: 409 }
        )
      }

      await closeFolio(folioId, branchId)
      if (reservationId) await updateHotelReservationStatus(reservationId, "checkout", branchId)

      const view = await buildFolioView(reservationId, branchId)
      return NextResponse.json({ ok: true, ...view })
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar el folio" },
      { status: 500 }
    )
  }
}

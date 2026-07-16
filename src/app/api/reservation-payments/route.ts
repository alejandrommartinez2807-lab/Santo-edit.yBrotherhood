import { NextRequest, NextResponse } from "next/server"
import {
  createReservationPayment,
  getHotelReservationById,
  getHotelReservations,
  getReservationPayments,
  updateReservationPaymentStatus,
} from "@/lib/orders"
import { dispatchHotelWebhooks } from "@/lib/hotelWebhookDispatch"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkPaymentsAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

// GET : depósitos reportados + reservas con contexto (fechas, total) para que
// caja vea a quién pertenece cada pago y cuánto falta por abonar.
export async function GET(request: NextRequest) {
  try {
    const access = await checkPaymentsAccess(request, ["owner", "manager", "support", "cashier"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    // Ventana amplia hacia atrás para resolver también los pagos de estadías
    // pasadas que siguen en el historial (la lista trae 200 pagos máx.).
    const from = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10)
    const to = `${new Date().getFullYear() + 1}-12-31`
    const [payments, reservations] = await Promise.all([
      getReservationPayments({}, branchId),
      getHotelReservations({ from, to }, branchId),
    ])
    const today = new Date().toISOString().slice(0, 10)
    const summarize = (r: (typeof reservations)[number]) => ({
      id: r.id,
      guestName: r.guestName,
      code: r.code,
      status: r.status,
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      nights: r.nights,
      totalAmount: r.totalAmount,
      source: r.source,
    })
    // Para el formulario: estadías activas o por llegar.
    const upcoming = reservations
      .filter(
        (r) =>
          (r.status === "pendiente" || r.status === "confirmada" || r.status === "checkin") &&
          r.checkOutDate >= today,
      )
      .map(summarize)
      .slice(0, 120)
    // Para la lista: cualquier reserva referenciada por un pago.
    const referencedIds = new Set(payments.map((p) => p.reservationId))
    const referenced = reservations.filter((r) => referencedIds.has(r.id)).map(summarize)
    return NextResponse.json({ ok: true, payments, reservations: upcoming, referenced })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los pagos" },
      { status: 500 }
    )
  }
}

// POST : create | status.
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-reservation-payments-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkPaymentsAccess(request, ["owner", "manager", "cashier"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    if (cleanText(body.action) === "status") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Pago no indicado" }, { status: 400 })
      const payment = await updateReservationPaymentStatus(id, cleanText(body.status), branchId)

      // Webhook saliente al CONFIRMAR (awaiteado: serverless congela lo suelto).
      if (payment.status === "confirmado") {
        const reservation = await getHotelReservationById(payment.reservationId, branchId).catch(() => null)
        await dispatchHotelWebhooks(
          "pago_confirmado",
          {
            reservationCode: reservation?.code || "",
            guestName: reservation?.guestName || "",
            amount: payment.amount,
            method: payment.method,
            reference: payment.reference,
          },
          branchId,
        )
      }

      return NextResponse.json({ ok: true, payment })
    }

    const reservationId = cleanText(body.reservationId)
    const amount = Number(body.amount) || 0
    if (!reservationId) return NextResponse.json({ error: "Indica la reserva" }, { status: 400 })
    if (amount <= 0) return NextResponse.json({ error: "Indica el monto del depósito" }, { status: 400 })

    const payment = await createReservationPayment(
      {
        reservationId,
        method: cleanText(body.method) || "transferencia",
        amount,
        reference: cleanText(body.reference),
        note: cleanText(body.note),
      },
      branchId,
    )
    return NextResponse.json({ ok: true, payment }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar el pago" },
      { status: 500 }
    )
  }
}

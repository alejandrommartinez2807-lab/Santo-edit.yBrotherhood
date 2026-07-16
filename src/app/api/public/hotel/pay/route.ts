import { NextRequest, NextResponse } from "next/server"
import {
  createReservationPayment,
  getBusinessConfig,
  getHotelReservationByCode,
  getReservationPayments,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { HOTEL_RESERVATION_STATUS_LABELS } from "@/lib/hotelReservationConflicts"
import {
  activeReservationPaymentMethodDetails,
  summarizeReservationPayments,
} from "@/lib/hotelReservationPayments"
import { enforceRateLimit } from "@/lib/rateLimit"
import {
  enforceRequestSizeLimit,
  enforceSameOriginRequest,
  getEnvByteLimit,
} from "@/lib/requestGuards"
import {
  assertDataUrlImage,
  DataUrlImageError,
  sanitizeUploadedImageFileName,
} from "@/lib/dataUrlImages"
import { writeAuditLog } from "@/lib/audit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Endpoint público del "botón de pago" del hotel (P1-A · cobro online). El
// huésped, con su código + teléfono (últimos 4 dígitos), consulta cuánto le
// falta y REPORTA su abono (pago móvil / Zelle / transferencia / USDT) con
// referencia, monto y captura opcional. Cae como depósito "reportado" y ya
// aparece en Caja recepción para que recepción lo confirme.

function cleanText(value: unknown) {
  return String(value || "").trim()
}
function digits(value: string) {
  return value.replace(/\D+/g, "")
}
function noStore(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store")
  return NextResponse.json(data, { ...init, headers })
}

// Reservas que ya no admiten abonos.
const CLOSED_STATUSES = new Set(["cancelada", "no_show"])

const METHOD_MAX = 60
const REFERENCE_MAX = 80
const NOTE_MAX = 300

type PayBody = {
  action?: unknown
  code?: unknown
  phone?: unknown
  method?: unknown
  amount?: unknown
  reference?: unknown
  note?: unknown
  dataUrl?: unknown
  fileName?: unknown
  mimeType?: unknown
}

type PublicPaymentView = {
  createdAt: string
  method: string
  amount: number
  reference: string
  status: string
}

function publicPaymentView(payment: PublicPaymentView): PublicPaymentView {
  return {
    createdAt: payment.createdAt,
    method: payment.method,
    amount: payment.amount,
    reference: payment.reference,
    status: payment.status,
  }
}

// Métodos de cobro que el dueño activó y sus datos (reusa la config pública de
// /carta: publicPaymentMethods + publicPaymentMethodDetails).
async function resolvePublicPaymentConfig() {
  const config = (await getBusinessConfig()) as unknown as Record<string, unknown>
  const methods = Array.isArray(config.publicPaymentMethods)
    ? (config.publicPaymentMethods as unknown[]).map((m) => cleanText(m)).filter(Boolean)
    : []
  const rawDetails = config.publicPaymentMethodDetails
  const details =
    rawDetails && typeof rawDetails === "object" && !Array.isArray(rawDetails)
      ? (rawDetails as Record<string, string>)
      : {}
  return { methods, details }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-hotel-pay",
    limit: 12,
    windowMs: 120_000,
    message: "Demasiados intentos. Espera un momento e intenta nuevamente.",
  })
  if (rateLimitResponse) return rateLimitResponse

  const originGuardResponse = enforceSameOriginRequest(request, undefined, "api-public-hotel-pay")
  if (originGuardResponse) return originGuardResponse

  const sizeLimitResponse = enforceRequestSizeLimit(request, {
    maxBytes: getEnvByteLimit("PAYMENT_PROOF_POST_MAX_BYTES", 8_000_000, {
      minBytes: 512_000,
      maxBytes: 10_000_000,
    }),
    message: "El comprobante es demasiado pesado. Usa una captura más liviana.",
    route: "api-public-hotel-pay",
  })
  if (sizeLimitResponse) return sizeLimitResponse

  try {
    const body = (await request.json().catch(() => ({}))) as PayBody
    const action = cleanText(body.action) || "info"
    const code = cleanText(body.code)
    const phone = digits(cleanText(body.phone))
    if (!code || phone.length < 4) {
      return noStore({ ok: false, error: "Indica tu código y teléfono" }, { status: 400 })
    }

    const branchId = await resolveBranchId(request)
    const reservation = await getHotelReservationByCode(code, branchId)
    // Verificación simple: los últimos 4 dígitos del teléfono deben coincidir.
    const match = Boolean(
      reservation && digits(reservation.guestPhone).slice(-4) === phone.slice(-4),
    )
    if (!reservation || !match) {
      return noStore(
        { ok: false, error: "No encontramos una reserva con esos datos" },
        { status: 404 },
      )
    }

    if (action === "report") {
      if (CLOSED_STATUSES.has(cleanText(reservation.status))) {
        return noStore({ ok: false, error: "Esta reserva ya no admite abonos." }, { status: 409 })
      }
      const amount = Math.round((Number(body.amount) || 0) * 100) / 100
      if (!(amount > 0)) {
        return noStore({ ok: false, error: "Indica el monto que abonaste." }, { status: 400 })
      }

      // Captura opcional: si viene, se valida como imagen antes de guardar.
      const dataUrl = cleanText(body.dataUrl)
      let fileName = ""
      let mimeType = ""
      if (dataUrl) {
        const image = assertDataUrlImage(dataUrl, {
          label: "El comprobante",
          maxBytes: getEnvByteLimit("PAYMENT_PROOF_IMAGE_MAX_BYTES", 5_500_000, {
            minBytes: 512_000,
            maxBytes: 7_000_000,
          }),
          fallbackMimeType: cleanText(body.mimeType) || "image/jpeg",
        })
        mimeType = image.mimeType
        fileName = sanitizeUploadedImageFileName(
          body.fileName,
          `abono-${reservation.code}`,
          image.mimeType,
        )
      }

      const payment = await createReservationPayment(
        {
          reservationId: reservation.id,
          method: cleanText(body.method).slice(0, METHOD_MAX) || "transferencia",
          amount,
          reference: cleanText(body.reference).slice(0, REFERENCE_MAX),
          note: cleanText(body.note).slice(0, NOTE_MAX),
          proofDataUrl: dataUrl || undefined,
          proofFileName: fileName || undefined,
          proofMimeType: mimeType || undefined,
        },
        branchId,
      )

      await writeAuditLog({
        action: "reservation_payment.reported",
        branchId,
        entityType: "reservation_payment",
        entityId: payment.id,
        actor: { role: "cliente", label: reservation.guestName || "Huésped", source: "public" },
        request,
        metadata: { reservationCode: reservation.code, amount, method: payment.method },
      }).catch(() => {})

      return noStore({ ok: true, payment: publicPaymentView(payment) }, { status: 201 })
    }

    // action "info": saldo + métodos de cobro + abonos previos del huésped.
    const payments = await getReservationPayments(
      { reservationId: reservation.id },
      branchId,
    ).catch(() => [])
    const summary = summarizeReservationPayments(payments, reservation.totalAmount)
    const { methods, details } = await resolvePublicPaymentConfig()

    return noStore({
      ok: true,
      reservation: {
        code: reservation.code,
        guestName: reservation.guestName,
        totalAmount: reservation.totalAmount,
        status: reservation.status,
        statusLabel:
          HOTEL_RESERVATION_STATUS_LABELS[reservation.status] || reservation.status,
      },
      methods,
      methodDetails: activeReservationPaymentMethodDetails(methods, details),
      summary,
      payments: payments.map(publicPaymentView),
    })
  } catch (error) {
    const status = error instanceof DataUrlImageError ? error.status : 500
    captureError(error, { route: "/api/public/hotel/pay", action: "POST" })
    return noStore(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo procesar el pago" },
      { status },
    )
  }
}

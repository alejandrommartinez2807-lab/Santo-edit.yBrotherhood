import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { isElectronicPaymentMethod } from "@/lib/paymentOptions"
import {
  computePendingElectronicUSD,
  getRequiredReportUSD,
  isCashReportedMethod,
} from "@/lib/orderPaymentLegs"
import { maybeAutoCancelUnpaidOrder } from "@/lib/unpaidAutoCancel"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Estados que el cliente puede ver en su confirmación. Cualquier otro valor
// de la BD se colapsa a "Pendiente" para no filtrar estados internos nuevos.
const PUBLIC_STATUSES = new Set(["Nuevo", "Pendiente", "Preparando", "Listo", "Entregado", "Cancelado"])

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)

  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")

  return NextResponse.json(data, {
    ...init,
    headers,
  })
}

// Estado público de UN pedido: el cliente lo consulta desde su pantalla de
// confirmación con el id que recibió al pedir (ord-..., imprevisible). Solo
// devuelve estado + número visible; nada de datos personales ni montos.
export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-order-status-get",
    limit: 90,
    windowMs: 60_000,
    message: "Demasiadas consultas de pedido. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const orderId = String(request.nextUrl.searchParams.get("pedido") || "")
      .trim()
      .toLowerCase()

    if (!orderId || !orderId.startsWith("ord-")) {
      return noStoreResponse(
        { ok: false, error: "Indica el pedido que quieres consultar" },
        { status: 400 }
      )
    }

    // Anulación automática sin pago (configurable): se evalúa justo cuando
    // el cliente consulta, así ve el aviso y el motivo al instante.
    await maybeAutoCancelUnpaidOrder(orderId)

    const supabase = getSupabaseAdmin()
    // branch-exempt: lookup puntual por id único e imprevisible (ord-...);
    // el pedido pertenece a una sola sede y no expone datos de otras.
    let { data, error } = await supabase
      .from("orders")
      .select(
        "id,status,seq,branch_seq,branch_code,customer_note,order_type,payment_method,payment_status,open_account_id,total_usd,exchange_rate"
      )
      .eq("id", orderId)
      .maybeSingle()

    // Migración 0031 sin aplicar (payment_method no existe): el SEGUIMIENTO
    // nunca puede caerse por el dato del pago — reintenta sin la columna y el
    // bloque payment degrada a "no aplica".
    if (error && /payment_method/i.test(error.message || "")) {
      ;({ data, error } = await supabase
        .from("orders")
        .select(
          "id,status,seq,branch_seq,branch_code,customer_note,order_type,payment_status,open_account_id,total_usd,exchange_rate"
        )
        .eq("id", orderId)
        .maybeSingle())
    }

    if (error) throw new Error(error.message)

    if (!data) {
      return noStoreResponse(
        { ok: false, error: "Pedido no encontrado" },
        { status: 404 }
      )
    }

    const seq = Number(data.seq || 0)
    const branchSeq = Number(data.branch_seq || 0)
    const branchCode = String(data.branch_code || "").trim()
    const displayNumber =
      branchSeq > 0
        ? `#${String(branchSeq).padStart(2, "0")}${branchCode ? `-${branchCode}` : ""}`
        : seq > 0
          ? `#${String(seq).padStart(2, "0")}`
          : ""
    const rawStatus = String(data.status || "").trim()
    const status = PUBLIC_STATUSES.has(rawStatus) ? rawStatus : "Pendiente"

    // Contenido del pedido (nombre, cantidad y personalización): el cliente
    // que guarda el link quiere ver QUÉ pidió, no solo el estado. Mismo modelo
    // de confianza del resto de la respuesta: id imprevisible, sin datos
    // personales (ni teléfono ni dirección).
    const { data: itemRows } = await supabase
      .from("order_items")
      .select("name,quantity,price,selection_summary,sort_order")
      .eq("order_id", orderId)
      .order("sort_order", { ascending: true })

    const items = (itemRows ?? []).map((raw) => {
      const item = raw as Record<string, unknown>
      const quantity = Number(item.quantity || 0)
      const price = Number(item.price || 0)
      return {
        name: String(item.name || "").trim() || "Producto",
        quantity,
        selectionSummary: String(item.selection_summary || "").trim(),
        subtotalUSD: Math.round((price * quantity + Number.EPSILON) * 100) / 100,
      }
    })

    // Pedido anulado: el motivo se guarda en la nota como "ANULADO: …"; se
    // extrae SOLO ese tramo (sin el resto de la nota) para mostrárselo al
    // cliente en su seguimiento.
    const cancelMatch =
      status === "Cancelado"
        ? String(data.customer_note || "").match(/ANULADO:\s*([^|]+)/)
        : null
    const cancelReason = cancelMatch ? cancelMatch[1].trim() : ""

    // Estado del pago para la línea de avance del cliente (lote v6): aplica
    // "Esperando pago" solo a Pick up/Delivery con método electrónico (en mesa
    // o efectivo puro el cliente paga al entregar y no reporta nada). Se
    // sondea junto al estado, así el "Pagado" de caja llega solo al cliente.
    const orderRecord = data as Record<string, unknown>
    const orderType = String(orderRecord.order_type || "").trim()
    // "expected": el pedido tiene un método elegido por el cliente y se cobra
    // en caja (Pick up/Delivery sin cuenta abierta) → la línea muestra
    // "Esperando pago" hasta que caja registre el cobro, SEA CUAL SEA el
    // método (el dueño reportó 2026-07-23 que con efectivo no salía el paso).
    // "reportable" (más estricto) sigue mandando el CTA de subir captura:
    // solo métodos electrónicos; el efectivo se entrega en mano.
    const awaitsCashierPayment =
      (orderType === "Para llevar" || orderType === "Delivery") &&
      !orderRecord.open_account_id &&
      String(orderRecord.payment_method || "").trim() !== ""
    const paymentReportable =
      awaitsCashierPayment && isElectronicPaymentMethod(orderRecord.payment_method)
    const paymentStatusRaw = String(orderRecord.payment_status || "").trim()

    let paymentReported = false
    let proofConfirmed = false
    let pendingReportUSD = 0
    if (awaitsCashierPayment) {
      // Estado de los comprobantes + montos reportados: "reportado" exige que
      // las patas ELECTRÓNICAS estén cubiertas por comprobantes no-efectivo.
      // (Bug real 2026-07-23: en mixto efectivo+Pago móvil, la sola foto de
      // los billetes daba el pago por reportado y nadie pedía la referencia.)
      // Si la consulta falla, el seguimiento sigue con el estado del pedido.
      const { data: proofRows } = await supabase
        .from("payment_proofs")
        .select("status,reported_method,amount_reported_usd,amount_reported_ves")
        .eq("order_id", orderId)

      const exchangeRate = Number(orderRecord.exchange_rate || 0)
      const requiredReportUSD = getRequiredReportUSD({
        paymentMethod: orderRecord.payment_method,
        totalUSD: Number(orderRecord.total_usd || 0),
        exchangeRate,
      })

      let hasActiveProof = false
      const activeProofInputs: { method: unknown; amountUSD: number; amountVES: number }[] = []
      for (const row of proofRows ?? []) {
        const proof = row as Record<string, unknown>
        const proofStatus = String(proof.status || "")
        if (proofStatus === "Rechazado") continue
        hasActiveProof = true
        // Solo un comprobante ELECTRÓNICO confirmado implica pago: confirmar
        // la foto de los billetes solo valida que el efectivo existe — el
        // cobro real lo registra caja al recibirlo (fix lote v9).
        if (
          proofStatus === "Confirmado por caja" &&
          !isCashReportedMethod(proof.reported_method)
        ) {
          proofConfirmed = true
        }
        activeProofInputs.push({
          method: proof.reported_method,
          amountUSD: Number(proof.amount_reported_usd || 0),
          amountVES: Number(proof.amount_reported_ves || 0),
        })
      }

      pendingReportUSD = computePendingElectronicUSD({
        requiredUSD: requiredReportUSD,
        exchangeRate,
        proofs: activeProofInputs,
      })
      paymentReported =
        requiredReportUSD > 0 ? pendingReportUSD <= 0 : hasActiveProof
    }

    const paymentConfirmed = paymentStatusRaw === "Pagado" || proofConfirmed

    return noStoreResponse({
      ok: true,
      orderId: String(data.id || orderId),
      displayNumber,
      status,
      items,
      payment: {
        expected: awaitsCashierPayment,
        reportable: paymentReportable,
        reported: paymentReported || paymentConfirmed,
        confirmed: paymentConfirmed,
        // > 0 = al reporte le falta la parte electrónica (USD equivalentes);
        // el seguimiento lo usa para pedir "la parte de Pago móvil" en vez de
        // un genérico "no has reportado".
        pendingReportUSD: paymentConfirmed ? 0 : pendingReportUSD,
      },
      ...(cancelReason ? { cancelReason } : {}),
    })
  } catch (error) {
    captureError(error, { route: "/api/public/order-status", action: "GET" })

    return noStoreResponse(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "No se pudo consultar el estado del pedido",
      },
      { status: 500 }
    )
  }
}

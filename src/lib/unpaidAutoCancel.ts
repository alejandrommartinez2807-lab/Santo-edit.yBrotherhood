import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getBusinessConfig, getPaymentProofs } from "@/lib/orders"
import { isElectronicPaymentMethod } from "@/lib/paymentOptions"
import { getModulePlanAccess } from "@/lib/localPlans"
import { revertInventoryConsumptionForOrder } from "@/lib/ordersInventory"
import { sendOrderCancelledStaffPush } from "@/lib/orderPushNotifications"
import { writeAuditLog } from "@/lib/audit"
import { captureError } from "@/lib/monitoring"

// Anulación automática de pedidos SIN pago reportado (pedido del dueño
// 2026-07-21, configurable en publicUnpaidAutoCancelMinutes; 0 = apagada).
//
// Se evalúa "en caliente" cuando el propio cliente consulta su pedido
// (/api/public/order-status y /api/public/order-payment, que la página de
// seguimiento sondea cada pocos segundos): así el pedido se anula justo
// cuando vence el plazo y el cliente ve el aviso con el motivo al instante.
// Solo aplica a Para llevar / Delivery que siguen en "Nuevo" sin cobro de
// caja y sin NINGÚN comprobante reportado (un reporte pendiente lo protege).

type AutoCancelResult = {
  cancelled: boolean
}

function minutesSince(value: unknown): number {
  const createdAt = new Date(String(value || ""))
  if (Number.isNaN(createdAt.getTime())) return 0
  return (Date.now() - createdAt.getTime()) / 60_000
}

// Barrido periódico desde el panel: la anulación por pedido de abajo solo se
// evalúa cuando el CLIENTE consulta su seguimiento. Si el cliente cerró la app,
// el pedido vencido se quedaba en "Nuevo" y seguía apareciendo ACTIVO en la
// privada (nunca pasaba a Cancelado). Este barrido lo dispara el polling de
// /api/orders (staff), así el pedido se anula aunque el cliente no vuelva.
const SWEEP_INTERVAL_MS = 45_000
let lastSweepAt = 0
let sweepRunning = false

export async function maybeAutoCancelStaleUnpaidOrders(): Promise<void> {
  const now = Date.now()
  if (sweepRunning || now - lastSweepAt < SWEEP_INTERVAL_MS) return
  lastSweepAt = now
  sweepRunning = true

  try {
    const config = await getBusinessConfig()
    const limitMinutes = Number(config.publicUnpaidAutoCancelMinutes || 0)
    if (!Number.isFinite(limitMinutes) || limitMinutes <= 0) return
    // Sin el módulo de comprobantes el cliente no puede reportar: no se anula.
    if (!getModulePlanAccess(config, "paymentProofs").effectiveEnabled) return

    const supabase = getSupabaseAdmin()
    const cutoffIso = new Date(now - limitMinutes * 60_000).toISOString()

    // Candidatos: prepago (Para llevar/Delivery) aún en "Nuevo", sin cobro y ya
    // vencidos. Los demás filtros finos (método electrónico, registrado por
    // staff, comprobante activo, entrenamiento) los re-verifica la anulación por
    // pedido de abajo, que además hace la compensación anti-carrera.
    const { data: rows, error } = await supabase
      .from("orders")
      .select("id")
      .eq("status", "Nuevo")
      .in("order_type", ["Para llevar", "Delivery"])
      .eq("amount_received_usd", 0)
      .eq("amount_received_ves", 0)
      .lte("created_at", cutoffIso)
      .limit(50)

    if (error || !rows?.length) return

    for (const row of rows) {
      const orderId = String((row as { id?: unknown }).id || "")
      if (orderId) await maybeAutoCancelUnpaidOrder(orderId)
    }
  } catch (error) {
    captureError(error, { route: "lib/unpaidAutoCancel", action: "maybeAutoCancelStaleUnpaidOrders" })
  } finally {
    sweepRunning = false
  }
}

export async function maybeAutoCancelUnpaidOrder(
  orderId: string,
): Promise<AutoCancelResult> {
  try {
    const config = await getBusinessConfig()
    const limitMinutes = Number(config.publicUnpaidAutoCancelMinutes || 0)

    if (!Number.isFinite(limitMinutes) || limitMinutes <= 0) {
      return { cancelled: false }
    }

    // Sin el módulo de comprobantes el cliente NO TIENE cómo reportar su
    // pago: anular por "no reportó" sería una trampa sin salida.
    if (!getModulePlanAccess(config, "paymentProofs").effectiveEnabled) {
      return { cancelled: false }
    }

    const supabase = getSupabaseAdmin()
    // branch-exempt: lookup puntual por id único e imprevisible (ord-...).
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id,branch_id,status,order_type,payment_method,registered_by_name,created_at,customer_note,customer_name,amount_received_usd,amount_received_ves,seq,branch_seq,branch_code,is_training",
      )
      .eq("id", orderId)
      .maybeSingle()

    if (error || !order) return { cancelled: false }

    const orderType = String(order.order_type || "")
    const isPrepayType = orderType === "Para llevar" || orderType === "Delivery"
    const alreadyCharged =
      Number(order.amount_received_usd || 0) > 0 ||
      Number(order.amount_received_ves || 0) > 0

    if (
      String(order.status || "") !== "Nuevo" ||
      !isPrepayType ||
      alreadyCharged ||
      order.is_training === true ||
      // Efectivo / "Por confirmar": el cliente paga al retirar o recibir y no
      // tiene captura que reportar — la anulación automática NO aplica. Solo
      // métodos electrónicos (pago móvil, transferencia, Zelle…) prepagan.
      !isElectronicPaymentMethod(order.payment_method) ||
      // Pedidos registrados por el STAFF (teléfono/mostrador): el acuerdo de
      // pago es con el local, no con el flujo web de prepago.
      String(order.registered_by_name || "").trim() !== "" ||
      minutesSince(order.created_at) < limitMinutes
    ) {
      return { cancelled: false }
    }

    // Cualquier comprobante activo (enviado/en revisión/confirmado) protege
    // el pedido: el cliente sí reportó, falta que caja lo revise.
    const proofs = await getPaymentProofs(
      { orderId },
      String(order.branch_id || "") || null,
    )
    const hasActiveProof = proofs.some(
      (proof) => String(proof.status || "") !== "Rechazado",
    )
    if (hasActiveProof) return { cancelled: false }

    const reasonNote = `ANULADO: Sin pago reportado en ${limitMinutes} min (anulación automática). Si aún lo quieres, vuelve a pedir o pásate por caja.`
    const nextNote = String(order.customer_note || "").trim()
      ? `${String(order.customer_note).trim()} | ${reasonNote}`
      : reasonNote

    // Lock optimista: solo anula si SIGUE en "Nuevo" Y sigue sin cobro (el
    // cobro de caja no cambia el status, así que el WHERE re-verifica los
    // montos: si caja cobró en la ventana, 0 filas y no se toca).
    const { data: updatedRows, error: updateError } = await supabase
      .from("orders")
      .update({ status: "Cancelado", customer_note: nextNote })
      .eq("id", orderId)
      .eq("status", "Nuevo")
      .eq("amount_received_usd", 0)
      .eq("amount_received_ves", 0)
      .select("id")

    if (updateError || !updatedRows?.length) return { cancelled: false }

    // Compensación anti-carrera: si un comprobante aterrizó entre la lectura
    // de proofs y el UPDATE, se revierte la anulación (el cliente SÍ reportó).
    const lateProofs = await getPaymentProofs(
      { orderId },
      String(order.branch_id || "") || null,
    ).catch(() => [])
    const hasLateProof = lateProofs.some(
      (proof) => String(proof.status || "") !== "Rechazado",
    )
    if (hasLateProof) {
      await supabase
        .from("orders")
        .update({
          status: "Nuevo",
          customer_note: String(order.customer_note || "").trim(),
        })
        .eq("id", orderId)
        .eq("status", "Cancelado")
      return { cancelled: false }
    }

    // El pedido nunca entró a cocina (estaba en "Nuevo"): los ingredientes no
    // se usaron, así que el consumo descontado al crearlo vuelve al stock.
    await revertInventoryConsumptionForOrder(
      orderId,
      String(order.branch_id || "") || null,
    ).catch(() => undefined)

    await writeAuditLog({
      action: "order.status.updated",
      branchId: String(order.branch_id || "") || null,
      entityType: "order",
      entityId: orderId,
      actor: { label: "Sistema", role: "system", source: "auto-cancel" },
      metadata: {
        status: "Cancelado",
        cancelReason: `Sin pago reportado en ${limitMinutes} min (automático)`,
      },
    }).catch(() => undefined)

    if (config.cancellationAlertsEnabled !== false) {
      const branchSeq = Number(order.branch_seq || 0)
      const branchCode = String(order.branch_code || "").trim()
      const seq = Number(order.seq || 0)
      const displayNumber =
        branchSeq > 0
          ? `#${String(branchSeq).padStart(2, "0")}${branchCode ? `-${branchCode}` : ""}`
          : seq > 0
            ? `#${String(seq).padStart(2, "0")}`
            : orderId

      await sendOrderCancelledStaffPush({
        displayNumber,
        customerName: String(order.customer_name || ""),
        itemsSummary: `Anulación automática: sin pago reportado en ${limitMinutes} min`,
        cancelledBy: "Sistema (sin pago reportado)",
        branchId: String(order.branch_id || "") || null,
      }).catch(() => undefined)
    }

    return { cancelled: true }
  } catch (error) {
    captureError(error, { route: "lib/unpaidAutoCancel", action: "maybeAutoCancelUnpaidOrder" })
    return { cancelled: false }
  }
}

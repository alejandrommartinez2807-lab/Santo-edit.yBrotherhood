import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { updateOrderPayment } from "@/lib/orders"
import { writeAuditLog } from "@/lib/audit"
import { captureError } from "@/lib/monitoring"
import { roundMoney } from "@/lib/localOrderMoney"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature") || ""
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (e) {
    return NextResponse.json(
      { error: `Firma inválida: ${e instanceof Error ? e.message : "error"}` },
      { status: 400 },
    )
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = String(session.metadata?.orderId || "")
    const amountUSD = (session.amount_total ?? 0) / 100

    // Fix auditoría 2026-07-24: antes este webhook escribía a mano
    // payment_received_equiv_usd = TOTAL del pedido (aunque el cobro fuera
    // parcial), sin idempotencia, sin sede y sin bitácora. Ahora suma lo
    // realmente cobrado por el camino oficial (updateOrderPayment), que
    // recalcula estado/pendiente, excluye pedidos anulados y actualiza la
    // cuenta abierta si aplica.
    if (orderId && amountUSD > 0) {
      try {
        const supabase = getSupabaseAdmin()
        const { data: order } = await supabase
          .from("orders")
          .select(
            "id, branch_id, status, payment_status, payment_pending_usd, amount_received_usd, amount_received_ves, payment_method_ves, delivery_payment_in, payment_note",
          )
          .eq("id", orderId)
          .maybeSingle()

        const o = (order ?? null) as Record<string, unknown> | null

        if (!o) {
          captureError(new Error(`Stripe webhook: pedido ${orderId} no existe`), {
            route: "/api/payments/webhook",
            action: event.type,
          })
        } else if (String(o.status) === "Cancelado") {
          // Se responde 200 igualmente: si no, Stripe reintenta para siempre.
          captureError(
            new Error(`Stripe webhook: cobro recibido para pedido ANULADO ${orderId}`),
            { route: "/api/payments/webhook", action: event.type },
          )
        } else if (
          String(o.payment_status) === "Pagado" &&
          Number(o.payment_pending_usd ?? 0) <= 0.01
        ) {
          // Idempotencia: reintento de un evento ya aplicado (el checkout
          // cobra siempre el pendiente completo) — no se vuelve a sumar.
        } else {
          const branchId = (o.branch_id as string | null) ?? null

          await updateOrderPayment(
            orderId,
            {
              amountReceivedUSD: roundMoney(Number(o.amount_received_usd ?? 0) + amountUSD),
              amountReceivedVES: roundMoney(Number(o.amount_received_ves ?? 0)),
              paymentMethodUSD: "Pago en línea",
              paymentMethodVES: String(o.payment_method_ves ?? ""),
              deliveryPaymentIn: (o.delivery_payment_in as never) ?? "",
              paymentNote: String(o.payment_note ?? ""),
              chargedBy: { id: "stripe", name: "Pago en línea (Stripe)", role: "system" },
            },
            branchId,
          )

          await writeAuditLog({
            action: "order.payment.updated",
            branchId,
            entityType: "order",
            entityId: orderId,
            actor: { id: "stripe", label: "Stripe (pago en línea)", role: "system" },
            request,
            metadata: { eventId: event.id, amountUSD },
          })
        }
      } catch (error) {
        // Errores transitorios (BD caída): 500 para que Stripe reintente.
        captureError(error, { route: "/api/payments/webhook", action: event.type })
        return NextResponse.json(
          { error: "No se pudo registrar el cobro; se reintentará" },
          { status: 500 },
        )
      }
    }
  }

  return NextResponse.json({ received: true })
}

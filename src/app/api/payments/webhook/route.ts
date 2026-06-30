import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { getSupabaseAdmin } from "@/lib/supabaseServer"

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

    if (orderId) {
      const supabase = getSupabaseAdmin()
      const { data: order } = await supabase
        .from("orders")
        .select("total_usd")
        .eq("id", orderId)
        .maybeSingle()
      const total = Number((order as Record<string, unknown>)?.total_usd ?? amountUSD)

      await supabase
        .from("orders")
        .update({
          payment_status: "Pagado",
          amount_received_usd: amountUSD,
          payment_received_equiv_usd: total,
          payment_pending_usd: 0,
          payment_method_usd: "Pago en línea",
          payment_updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
    }
  }

  return NextResponse.json({ received: true })
}

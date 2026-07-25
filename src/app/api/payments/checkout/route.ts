import { NextRequest, NextResponse } from "next/server"
import { getStripe, getPaymentCurrency } from "@/lib/stripe"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(v: unknown) {
  return String(v || "").trim()
}

export async function POST(request: NextRequest) {
  // Blindaje A4 (2026-07-24): era la única ruta mutante sin rate limit ni
  // guard de origen — cualquiera con un orderId creaba sesiones de Stripe
  // ilimitadas y podía sondear qué pedidos existen.
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-payments-checkout-post",
    limit: 20,
    windowMs: 60_000,
    envMaxBytes: "PUBLIC_API_MUTATION_MAX_BYTES",
    maxBytes: 10_000,
    rateLimitMessage:
      "Demasiados intentos de pago. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { error: "Pagos en línea no están configurados en este negocio" },
      { status: 503 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const orderId = cleanText(body.orderId)
  if (!orderId) {
    return NextResponse.json({ error: "Falta el pedido" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, customer_name, total_usd, payment_pending_usd, payment_status, status")
    .eq("id", orderId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })

  const o = order as Record<string, unknown>

  // Estado del pedido (A4): estas columnas ya se consultaban pero no se
  // usaban — se podía iniciar el pago de un pedido anulado o ya pagado.
  if (cleanText(o.status) === "Cancelado") {
    return NextResponse.json(
      { error: "Este pedido está anulado: no se puede pagar" },
      { status: 409 },
    )
  }

  if (cleanText(o.payment_status) === "Pagado") {
    return NextResponse.json({ error: "Este pedido ya está pagado" }, { status: 409 })
  }

  const pending = Number(o.payment_pending_usd ?? 0)
  const total = Number(o.total_usd ?? 0)
  const amountUSD = pending > 0 ? pending : total
  if (!(amountUSD > 0)) {
    return NextResponse.json({ error: "Este pedido no tiene saldo por cobrar" }, { status: 400 })
  }

  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.nextUrl.origin

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: getPaymentCurrency(),
            product_data: { name: `Pedido ${orderId}` },
            unit_amount: Math.round(amountUSD * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { orderId },
      success_url: `${origin}/pago/exito?order=${encodeURIComponent(orderId)}`,
      cancel_url: `${origin}/pago/cancelado?order=${encodeURIComponent(orderId)}`,
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo iniciar el pago" },
      { status: 500 },
    )
  }
}

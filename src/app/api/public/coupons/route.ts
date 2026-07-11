import { NextRequest, NextResponse } from "next/server"
import { getRawBusinessConfig } from "@/lib/orders"
import { findPublicCoupon } from "@/lib/publicPageConfig"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Valida UN cupón del carrito público. La lista completa de códigos nunca
// sale del servidor: el cliente manda su código y recibe solo el porcentaje
// del suyo (o un "no válido"). Rate limit corto para frenar fuerza bruta.
export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-coupons-post",
    limit: 15,
    windowMs: 60_000,
    message: "Demasiados intentos de cupón. Espera un minuto e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const config = (await getRawBusinessConfig()) as Record<string, unknown>
    const coupon = findPublicCoupon(config.publicCoupons, body.code)

    if (!coupon) {
      return NextResponse.json(
        { ok: false, error: "Cupón no válido o vencido" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      )
    }

    return NextResponse.json(
      { ok: true, code: coupon.code, percent: coupon.percent },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    captureError(error, { route: "/api/public/coupons", action: "POST" })

    return NextResponse.json(
      { ok: false, error: "No se pudo validar el cupón" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

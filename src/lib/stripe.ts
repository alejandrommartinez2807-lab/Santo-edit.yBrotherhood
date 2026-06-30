import Stripe from "stripe"

// Cliente de Stripe para el servidor. La función devuelve null si no hay clave
// configurada, de modo que los pagos online quedan DESACTIVADOS hasta que el
// negocio ponga su STRIPE_SECRET_KEY. Nada se rompe si no está configurado.

let client: Stripe | null = null

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (!client) client = new Stripe(key)
  return client
}

export function isOnlinePaymentsEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

// Moneda para el cobro online (Stripe no soporta VES; se cobra en la divisa
// base configurable, por defecto USD).
export function getPaymentCurrency(): string {
  return (process.env.STRIPE_CURRENCY || "usd").toLowerCase()
}

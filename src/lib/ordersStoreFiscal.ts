import { computeFiscalTotals, type FiscalConfig } from "@/lib/fiscal"
import { cleanText } from "@/lib/localOrderHelpers"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import type { OrderFiscalSnapshot, OrderItem } from "@/types/localOrders"
import { num } from "./ordersStoreMappers"

// Lee la config fiscal del negocio (business_config id=1) sin pasar por
// lib/orders, para evitar dependencias circulares. Devuelve null si no factura.
export async function buildOrderFiscalSnapshot(
  items: OrderItem[],
  divisaPaymentUSD = 0,
): Promise<OrderFiscalSnapshot | null> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from("business_config").select("config").eq("id", 1).maybeSingle()
  const config = ((data as { config?: Record<string, unknown> } | null)?.config || {}) as Record<
    string,
    unknown
  >
  if (config.fiscalEnabled !== true) return null

  const fiscalConfig: FiscalConfig = {
    ivaDefaultRate: Number.isFinite(Number(config.ivaDefaultRate)) ? Number(config.ivaDefaultRate) : 16,
    pricesIncludeIva: config.pricesIncludeIva !== false,
    igtfEnabled: config.igtfEnabled !== false,
    igtfRate: Number.isFinite(Number(config.igtfRate)) ? Number(config.igtfRate) : 3,
  }

  const totals = computeFiscalTotals(
    items.map((it) => ({ priceUSD: num(it.price), quantity: num(it.quantity), ivaRate: it.ivaRate })),
    fiscalConfig,
    divisaPaymentUSD,
  )

  return {
    ...totals,
    pricesIncludeIva: fiscalConfig.pricesIncludeIva,
    igtfRate: fiscalConfig.igtfRate,
    rifNumber: cleanText(config.rifNumber) || undefined,
    razonSocial: cleanText(config.razonSocial) || undefined,
  }
}

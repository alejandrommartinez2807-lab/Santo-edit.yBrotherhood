"use client"

import { computeFiscalTotals, type FiscalConfig } from "@/lib/fiscal"
import type { CartItem, PublicBusinessConfig } from "@/components/cartTypes"
import type { OrderFiscalSnapshot } from "@/types/localOrders"

// Desglose fiscal (Venezuela) para la pre-cuenta: base imponible por tasa de IVA,
// IVA total e IGTF. La factura fiscal OFICIAL la emite la máquina fiscal; esto es
// el detalle que el cajero concilia con la máquina. Solo se muestra si el negocio
// activó la facturación fiscal.

function usd(n: number) {
  return `$${(n || 0).toFixed(2)}`
}

// Muestra el desglose FIJADO guardado en la orden (panel de caja/cobro).
export function FiscalSnapshotView({ fiscal }: { fiscal: OrderFiscalSnapshot }) {
  if (!fiscal || fiscal.totalBeforeIgtfUSD <= 0) return null
  return (
    <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3 text-[var(--brand-ink-2)]">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        Desglose fiscal {fiscal.rifNumber ? `· RIF ${fiscal.rifNumber}` : ""}
      </p>
      <div className="mt-2 space-y-1 text-sm font-bold">
        <div className="flex justify-between">
          <span>Base imponible</span>
          <span>{usd(fiscal.subtotalUSD)}</span>
        </div>
        {fiscal.ivaByRate.map((b) => (
          <div key={b.rate} className="flex justify-between text-[var(--brand-ink-2)]/75">
            <span>{b.rate === 0 ? "Exento (0%)" : `IVA ${b.rate}%`}</span>
            <span>{usd(b.ivaUSD)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-[var(--brand-primary)]/15 pt-1">
          <span>IVA total</span>
          <span>{usd(fiscal.ivaTotalUSD)}</span>
        </div>
        {fiscal.igtfUSD > 0 && (
          <div className="flex justify-between">
            <span>IGTF {fiscal.igtfRate}% sobre {usd(fiscal.igtfBaseUSD)}</span>
            <span>{usd(fiscal.igtfUSD)}</span>
          </div>
        )}
        <div className="flex justify-between border-t-2 border-[var(--brand-primary)]/25 pt-1.5 text-base font-black text-[var(--brand-ink-3)]">
          <span>Total</span>
          <span>{usd(fiscal.totalUSD)}</span>
        </div>
      </div>
    </div>
  )
}

export default function FiscalBreakdown({
  items,
  config,
  divisaPaymentUSD = 0,
}: {
  items: CartItem[]
  config: PublicBusinessConfig
  divisaPaymentUSD?: number
}) {
  if (!config.fiscalEnabled) return null

  const fiscalConfig: FiscalConfig = {
    ivaDefaultRate: config.ivaDefaultRate,
    pricesIncludeIva: config.pricesIncludeIva,
    igtfEnabled: config.igtfEnabled,
    igtfRate: config.igtfRate,
  }

  const totals = computeFiscalTotals(
    items.map((it) => ({ priceUSD: it.price, quantity: it.quantity, ivaRate: it.ivaRate })),
    fiscalConfig,
    divisaPaymentUSD,
  )

  if (totals.totalBeforeIgtfUSD <= 0) return null

  return (
    <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white/70 p-4 text-[var(--brand-ink-2)]">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
        Desglose fiscal
      </p>

      <div className="mt-3 space-y-1.5 text-sm font-bold">
        <div className="flex justify-between">
          <span>Base imponible</span>
          <span>{usd(totals.subtotalUSD)}</span>
        </div>

        {totals.ivaByRate.map((b) => (
          <div key={b.rate} className="flex justify-between text-[var(--brand-ink-2)]/75">
            <span>
              {b.rate === 0 ? "Exento (0%)" : `IVA ${b.rate}%`}
              {b.rate > 0 ? ` · base ${usd(b.baseUSD)}` : ""}
            </span>
            <span>{usd(b.ivaUSD)}</span>
          </div>
        ))}

        <div className="flex justify-between border-t border-[var(--brand-primary)]/15 pt-1.5">
          <span>IVA total</span>
          <span>{usd(totals.ivaTotalUSD)}</span>
        </div>

        {config.igtfEnabled &&
          (totals.igtfUSD > 0 ? (
            <div className="flex justify-between">
              <span>IGTF {config.igtfRate}% (divisas)</span>
              <span>{usd(totals.igtfUSD)}</span>
            </div>
          ) : (
            <p className="text-xs font-bold text-[var(--brand-ink-2)]/55">
              Si pagas en divisas se suma IGTF {config.igtfRate}%.
            </p>
          ))}

        <div className="flex justify-between border-t-2 border-[var(--brand-primary)]/25 pt-2 text-base font-black text-[var(--brand-ink-3)]">
          <span>Total</span>
          <span>{usd(totals.totalUSD)}</span>
        </div>
      </div>

      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/45">
        La factura fiscal la emite la máquina fiscal.
      </p>
    </div>
  )
}

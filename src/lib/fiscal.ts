// ============================================================
// Cálculo fiscal (Venezuela): IVA por producto + IGTF en divisas.
//
// Decisiones del negocio (Santo Edit · 2026-06-27):
//  - Emisión por MÁQUINA FISCAL SENIAT: aquí solo CALCULAMOS impuestos y
//    armamos el desglose para el ticket/pre-cuenta. El documento fiscal oficial
//    lo emite la máquina homologada (no imprimimos factura fiscal nosotros).
//  - IVA por producto: cada ítem trae su tasa (16 / 8 / 0 = exento).
//  - IGTF configurable (on/off + tasa) sobre el monto pagado en divisas.
//
// Modelo de precio: por defecto los precios del menú son "IVA incluido"
// (precio final al público, lo usual en VE). Se puede cambiar a "IVA aparte".
// ============================================================

export type FiscalConfig = {
  /** Tasa de IVA por defecto cuando el producto no define una. */
  ivaDefaultRate: number
  /** Si los precios del menú ya incluyen IVA (true) o se suma aparte (false). */
  pricesIncludeIva: boolean
  /** IGTF activo. */
  igtfEnabled: boolean
  /** Tasa de IGTF (ej. 3). */
  igtfRate: number
}

export const DEFAULT_FISCAL_CONFIG: FiscalConfig = {
  ivaDefaultRate: 16,
  pricesIncludeIva: true,
  igtfEnabled: true,
  igtfRate: 3,
}

export type FiscalLineInput = {
  /** Precio unitario en USD (según pricesIncludeIva, con o sin IVA). */
  priceUSD: number
  quantity: number
  /** Tasa de IVA del producto (16 / 8 / 0). Si es undefined, usa la default. */
  ivaRate?: number | null
}

export type IvaBucket = { rate: number; baseUSD: number; ivaUSD: number }

export type FiscalTotals = {
  /** Base imponible total (neto, sin IVA). */
  subtotalUSD: number
  /** Desglose de IVA por tasa. */
  ivaByRate: IvaBucket[]
  /** IVA total. */
  ivaTotalUSD: number
  /** Total antes de IGTF (base + IVA). */
  totalBeforeIgtfUSD: number
  /** IGTF cobrado (3% del monto en divisas), 0 si no aplica. */
  igtfUSD: number
  /** Base sobre la que se calculó el IGTF (monto pagado en divisas). */
  igtfBaseUSD: number
  /** Total final a cobrar. */
  totalUSD: number
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function safeNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0) return 0
  if (rate > 100) return 100
  return rate
}

/**
 * Calcula el desglose fiscal de una venta.
 * @param items   líneas con precio, cantidad y tasa de IVA.
 * @param config  configuración fiscal del negocio.
 * @param divisaPaymentUSD  monto pagado en divisas (USD efectivo), base del IGTF.
 */
export function computeFiscalTotals(
  items: FiscalLineInput[],
  config: FiscalConfig = DEFAULT_FISCAL_CONFIG,
  divisaPaymentUSD = 0,
): FiscalTotals {
  const buckets = new Map<number, IvaBucket>()
  let subtotal = 0
  let ivaTotal = 0

  for (const item of items) {
    const qty = safeNum(item.quantity)
    const price = safeNum(item.priceUSD)
    if (qty <= 0 || price < 0) continue

    const rate = clampRate(item.ivaRate == null ? config.ivaDefaultRate : safeNum(item.ivaRate))
    const gross = price * qty

    let base: number
    let iva: number
    if (config.pricesIncludeIva) {
      // El precio ya incluye IVA: lo extraemos.
      base = gross / (1 + rate / 100)
      iva = gross - base
    } else {
      base = gross
      iva = gross * (rate / 100)
    }

    subtotal += base
    ivaTotal += iva

    const bucket = buckets.get(rate) || { rate, baseUSD: 0, ivaUSD: 0 }
    bucket.baseUSD += base
    bucket.ivaUSD += iva
    buckets.set(rate, bucket)
  }

  const totalBeforeIgtf = subtotal + ivaTotal

  // IGTF: 3% del monto pagado en divisas (acotado a lo que se debe).
  const igtfBase = Math.max(0, Math.min(safeNum(divisaPaymentUSD), totalBeforeIgtf))
  const igtf =
    config.igtfEnabled && config.igtfRate > 0 ? igtfBase * (clampRate(config.igtfRate) / 100) : 0

  const ivaByRate = [...buckets.values()]
    .sort((a, b) => b.rate - a.rate)
    .map((b) => ({ rate: b.rate, baseUSD: round2(b.baseUSD), ivaUSD: round2(b.ivaUSD) }))

  // ⚠️ PENDIENTE DE DECISIÓN DEL DUEÑO (auditoría 2026-08-02).
  //
  // Este `totalUSD` incluye el IGTF, pero NADIE lo exige al cobrar: el estado
  // del pago se decide comparando lo recibido contra `orders.total_usd`, que
  // NO lo lleva. Con la facturación fiscal encendida, un pedido de $50 pagado
  // con $50 en divisas queda "Pagado" y el IGTF ($1,50) nunca se le cobra al
  // cliente… pero el cierre del día sí imprime "IGTF cobrado". El negocio
  // declararía un impuesto que no trasladó y acabaría asumiéndolo (~3% de toda
  // la venta en divisas). Además, el snapshot se calcula solo sobre los ítems:
  // con delivery, el "Total" de este recuadro no cuadra con el total del pedido
  // que se ve en la misma pantalla.
  //
  // HOY NO CUESTA DINERO en Brotherhood: `fiscalEnabled` está en false, así que
  // nada de esto se muestra ni se declara. Es una bomba de relojería para el
  // día que se active.
  //
  // Hay que elegir UN modelo antes de encender la facturación:
  //   (a) el IGTF se traslada al cliente → el pendiente del pedido tiene que
  //       recalcularse cuando el pago es en divisas, para que no se marque
  //       "Pagado" de menos. Toca todo el flujo de cobro.
  //   (b) el IGTF lo asume el negocio → sacarlo de este "Total", etiquetarlo
  //       "IGTF asumido" y renombrar la línea del cierre.
  // En ambos casos, pasar el costo de delivery a buildOrderFiscalSnapshot.
  return {
    subtotalUSD: round2(subtotal),
    ivaByRate,
    ivaTotalUSD: round2(ivaTotal),
    totalBeforeIgtfUSD: round2(totalBeforeIgtf),
    igtfUSD: round2(igtf),
    igtfBaseUSD: round2(igtfBase),
    totalUSD: round2(totalBeforeIgtf + igtf),
  }
}

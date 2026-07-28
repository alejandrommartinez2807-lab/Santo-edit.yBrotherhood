import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { canLocalAccessUseModule, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiReadGuards } from "@/lib/apiReadGuards"
import {
  getBusinessConfig,
  getInventory,
  getInventoryRecipes,
  getMenuProducts,
  getSupplierPurchases,
} from "@/lib/orders"
import {
  buildInventoryHealthReport,
  buildManagerAlerts,
  buildProductMarginsReport,
  buildSupplierPayablesReport,
} from "@/lib/reportAnalytics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED: LocalRole[] = ["owner", "manager", "cashier"]

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

class InvalidRangeError extends Error {}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// Rango de fechas a partir de ?period=today|week|month (o from/to ISO).
// toISO es opcional: para períodos NO se aplica tope superior (no existen
// pedidos futuros), evitando que el desfase de reloj máquina/DB descarte
// pedidos recién creados.
function resolveRange(request: NextRequest): { fromISO: string; toISO: string | null; label: string } {
  const period = request.nextUrl.searchParams.get("period") || "today"
  const fromParam = request.nextUrl.searchParams.get("from")
  const toParam = request.nextUrl.searchParams.get("to")
  const now = new Date()

  if (fromParam) {
    // Fechas inválidas: antes new Date("basura").toISOString() lanzaba
    // RangeError y el GET (sin try/catch) devolvía un 500 crudo.
    const from = new Date(fromParam)
    const to = toParam ? new Date(toParam) : null

    if (Number.isNaN(from.getTime()) || (to && Number.isNaN(to.getTime()))) {
      throw new InvalidRangeError("Rango de fechas inválido (usa formato ISO, ej. 2026-07-24)")
    }

    return {
      fromISO: from.toISOString(),
      toISO: to ? to.toISOString() : null,
      label: "Personalizado",
    }
  }

  const start = new Date(now)
  if (period === "week") {
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    return { fromISO: start.toISOString(), toISO: null, label: "Últimos 7 días" }
  }
  if (period === "month") {
    start.setDate(start.getDate() - 29)
    start.setHours(0, 0, 0, 0)
    return { fromISO: start.toISOString(), toISO: null, label: "Últimos 30 días" }
  }
  start.setHours(0, 0, 0, 0)
  return { fromISO: start.toISOString(), toISO: null, label: "Hoy" }
}

export async function GET(request: NextRequest) {
  const guardResponse = enforceApiReadGuards(request, {
    id: "api-reports-get",
    limit: 60,
    windowMs: 60_000,
    rateLimitMessage: "Demasiadas consultas de reportes. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  const access = getRequestAccess(request, getRequestPassword(request))
  if (!access.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  if (!ALLOWED.includes(access.role) || !canLocalAccessUseModule(access, "reports")) {
    return NextResponse.json({ error: "Sin permiso para ver reportes" }, { status: 403 })
  }

  let range: { fromISO: string; toISO: string | null; label: string }
  try {
    range = resolveRange(request)
  } catch (error) {
    if (error instanceof InvalidRangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
  const { fromISO, toISO, label } = range
  const supabase = getSupabaseAdmin()

  // Alcance: ?scope=all = consolidado (todas las sucursales); si no, la
  // sucursal actual (header x-branch-id → default).
  const consolidated = request.nextUrl.searchParams.get("scope") === "all"
  if (consolidated && access.role !== "owner" && access.role !== "support") {
    return NextResponse.json({ error: "Solo dueño o soporte pueden ver consolidado" }, { status: 403 })
  }
  const branchId = consolidated ? null : await resolveBranchId(request)

  const SELECT_COLS =
    "id, created_at, status, order_type, total_usd, payment_status, payment_received_equiv_usd, payment_pending_usd, payment_method_usd, payment_method_ves, amount_received_usd, amount_received_ves, exchange_rate, delivery_cost_usd, is_training, open_account_id"

  let query = supabase
    .from("orders")
    .select(SELECT_COLS)
    .gte("created_at", fromISO)
    .order("created_at", { ascending: true })

  if (toISO) {
    query = query.lte("created_at", toISO)
  }
  if (branchId) {
    query = query.eq("branch_id", branchId)
  }

  const { data: orderRows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Excluye cancelados y pedidos de práctica (Modo entrenamiento) para que los
  // reportes reflejen solo la operación real.
  const orders = (orderRows ?? []).filter((o) => {
    const row = o as { status?: string; is_training?: boolean }
    return row.status !== "Cancelado" && row.is_training !== true
  })

  // Fecha (YYYY-MM-DD) en la zona horaria del negocio, para agrupar por día.
  const dayFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  // Hora local del negocio para "ventas por hora": getHours() usaría la hora
  // del servidor (UTC en Vercel) y correría el gráfico 4 horas.
  const hourFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Caracas",
    hour: "2-digit",
    hourCycle: "h23",
  })

  let totalUSD = 0
  let collectedUSD = 0
  let pendingUSD = 0
  const byType: Record<string, { count: number; totalUSD: number }> = {}
  const byPayment: Record<string, number> = {}
  const byHour: number[] = Array.from({ length: 24 }, () => 0)
  const byDayMap = new Map<string, { date: string; orders: number; totalUSD: number }>()
  // Métodos de pago reales (efectivo, Zelle, pago móvil…). Un pedido mixto
  // aparece en ambos métodos, pero cada uno suma SOLO lo cobrado en su moneda.
  const byMethod: Record<string, { count: number; totalUSD: number }> = {}
  let deliveryOrders = 0
  let deliveryRevenueUSD = 0
  let deliveryCostUSD = 0
  // Cobros por ORIGEN: pedidos que vinieron de una cuenta de mesa (el cobro
  // de la cuenta completa se reparte FIFO entre ellos) vs pedidos directos.
  const accountOrigin = { orders: 0, totalUSD: 0, collectedUSD: 0, pendingUSD: 0, accounts: new Set<string>() }
  const directOrigin = { orders: 0, totalUSD: 0, collectedUSD: 0, pendingUSD: 0 }

  for (const raw of orders) {
    const o = raw as Record<string, unknown>
    const t = num(o.total_usd)
    totalUSD += t
    collectedUSD += num(o.payment_received_equiv_usd)
    pendingUSD += num(o.payment_pending_usd)

    const type = String(o.order_type || "Otro")
    byType[type] = byType[type] || { count: 0, totalUSD: 0 }
    byType[type].count += 1
    byType[type].totalUSD += t

    const accountId = String(o.open_account_id || "").trim()
    const origin = accountId ? accountOrigin : directOrigin
    origin.orders += 1
    origin.totalUSD += t
    origin.collectedUSD += num(o.payment_received_equiv_usd)
    origin.pendingUSD += num(o.payment_pending_usd)
    if (accountId) accountOrigin.accounts.add(accountId)

    const pay = String(o.payment_status || "Pendiente")
    byPayment[pay] = (byPayment[pay] || 0) + 1

    // Por método se reparte lo REALMENTE cobrado en cada moneda (auditoría
    // 2026-07-24): antes se sumaba el TOTAL del pedido a AMBOS métodos y un
    // pedido mixto Zelle+pago móvil contaba doble (Σ byMethod ≠ total).
    const receivedUSD = num(o.amount_received_usd)
    const receivedVES = num(o.amount_received_ves)
    const rate = num(o.exchange_rate)
    const methodUSD = String(o.payment_method_usd || "").trim()
    const methodVES = String(o.payment_method_ves || "").trim()
    const legs: { method: string; amountUSD: number }[] = []

    if (methodUSD && receivedUSD > 0) {
      legs.push({ method: methodUSD, amountUSD: receivedUSD })
    }
    if (methodVES && receivedVES > 0 && rate > 0) {
      legs.push({ method: methodVES, amountUSD: receivedVES / rate })
    }
    // Pedido con método marcado pero sin montos por pata (datos viejos): se
    // atribuye una sola vez lo cobrado equivalente, sin duplicar.
    if (!legs.length && (methodUSD || methodVES)) {
      legs.push({ method: methodUSD || methodVES, amountUSD: num(o.payment_received_equiv_usd) })
    }

    for (const leg of legs) {
      byMethod[leg.method] = byMethod[leg.method] || { count: 0, totalUSD: 0 }
      byMethod[leg.method].count += 1
      byMethod[leg.method].totalUSD += leg.amountUSD
    }

    const dCost = num(o.delivery_cost_usd)
    if (/delivery|domicilio|env[íi]o/i.test(type) || dCost > 0) {
      deliveryOrders += 1
      deliveryRevenueUSD += t
      deliveryCostUSD += dCost
    }

    const created = new Date(String(o.created_at))
    const hour = Number(hourFmt.format(created))
    if (hour >= 0 && hour < 24) byHour[hour] += t

    const dayKey = dayFmt.format(created)
    const day = byDayMap.get(dayKey) || { date: dayKey, orders: 0, totalUSD: 0 }
    day.orders += 1
    day.totalUSD += t
    byDayMap.set(dayKey, day)
  }

  const byDay = [...byDayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, totalUSD: round2(d.totalUSD) }))

  const count = orders.length
  const avgTicket = count > 0 ? totalUSD / count : 0

  // Top productos: ítems de los pedidos del rango.
  const ids = orders.map((o) => (o as { id: string }).id)
  const topProducts: { name: string; quantity: number; totalUSD: number }[] = []
  if (ids.length) {
    // En rangos grandes el .in() con cientos de ids reventaba la URL de
    // PostgREST y el error se descartaba: topProducts quedaba [] en silencio
    // (auditoría 2026-07-24). Se trocea y se propaga el error.
    const itemRows: unknown[] = []
    const CHUNK = 150
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data: chunkRows, error: itemsError } = await supabase
        .from("order_items")
        .select("name, quantity, price, order_id")
        .in("order_id", ids.slice(i, i + CHUNK))
      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }
      itemRows.push(...(chunkRows ?? []))
    }
    const map = new Map<string, { name: string; quantity: number; totalUSD: number }>()
    for (const raw of itemRows ?? []) {
      const it = raw as Record<string, unknown>
      const name = String(it.name || "—")
      const qty = num(it.quantity)
      const sub = num(it.price) * qty
      const cur = map.get(name) || { name, quantity: 0, totalUSD: 0 }
      cur.quantity += qty
      cur.totalUSD += sub
      map.set(name, cur)
    }
    topProducts.push(
      ...[...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    )
  }

  // --- Comparación con el período anterior (mismo tamaño, justo antes) ---
  const rangeEnd = toISO ? new Date(toISO) : new Date()
  const rangeStart = new Date(fromISO)
  const durationMs = Math.max(0, rangeEnd.getTime() - rangeStart.getTime())
  const prevStart = new Date(rangeStart.getTime() - durationMs)

  let prevQuery = supabase
    .from("orders")
    .select("total_usd, status, is_training")
    .gte("created_at", prevStart.toISOString())
    .lt("created_at", rangeStart.toISOString())
  if (branchId) prevQuery = prevQuery.eq("branch_id", branchId)
  const { data: prevRows } = await prevQuery

  const prevOrders = (prevRows ?? []).filter((o) => {
    const row = o as { status?: string; is_training?: boolean }
    return row.status !== "Cancelado" && row.is_training !== true
  })
  const prevTotalUSD = prevOrders.reduce((s, o) => s + num((o as Record<string, unknown>).total_usd), 0)
  const prevCount = prevOrders.length
  const prevAvgTicket = prevCount > 0 ? prevTotalUSD / prevCount : 0

  // Variación %: null cuando el período anterior fue 0 (no hay base de comparación).
  const pctDelta = (current: number, previous: number): number | null =>
    previous > 0 ? round2(((current - previous) / previous) * 100) : null

  const comparison = {
    previous: {
      orders: prevCount,
      totalUSD: round2(prevTotalUSD),
      avgTicket: round2(prevAvgTicket),
    },
    deltas: {
      ordersPct: pctDelta(count, prevCount),
      totalPct: pctDelta(totalUSD, prevTotalUSD),
      avgTicketPct: pctDelta(avgTicket, prevAvgTicket),
    },
  }

  // --- Secciones "2e" (proveedores / márgenes / inventario / alertas) ---
  // Cada bloque se arma solo si su módulo está activo; si no, queda en null.
  // managerAlerts siempre se devuelve (usa reportes vacíos como base cuando el
  // módulo está apagado) para que el panel del dueño tenga algo que mostrar.
  const config = await getBusinessConfig()
  const suppliersOn = config.supplierPurchasesModuleEnabled || config.accountsPayableModuleEnabled
  const inventoryOn = config.inventoryModuleEnabled

  let supplierPayables: ReturnType<typeof buildSupplierPayablesReport> | null = null
  let supplierPurchases: {
    summary: { purchases: number; totalUSD: number; totalVES: number }
    bySupplier: ReturnType<typeof buildSupplierPayablesReport>["bySupplier"]
  } | null = null
  if (suppliersOn) {
    const purchases = await getSupplierPurchases(branchId)
    // Las DEUDAS (payables) son estado actual y no se filtran por fecha; las
    // COMPRAS del resumen sí respetan el rango pedido — antes "Compras
    // registradas" bajo "Resumen de hoy" era el histórico completo (C3).
    const fromDay = fromISO.slice(0, 10)
    const toDay = (toISO ?? new Date().toISOString()).slice(0, 10)
    const purchasesInRange = purchases.filter((purchase) => {
      const day = String(purchase.purchaseDate || "").slice(0, 10)
      return day >= fromDay && day <= toDay
    })
    const purchasesInRangeReport = buildSupplierPayablesReport(purchasesInRange)

    supplierPayables = buildSupplierPayablesReport(purchases)
    supplierPurchases = {
      summary: {
        purchases: purchasesInRangeReport.summary.purchases,
        totalUSD: purchasesInRangeReport.summary.totalUSD,
        totalVES: purchasesInRangeReport.summary.totalVES,
      },
      bySupplier: purchasesInRangeReport.bySupplier,
    }
  }

  let productMargins: ReturnType<typeof buildProductMarginsReport> | null = null
  let inventoryHealth: ReturnType<typeof buildInventoryHealthReport> | null = null
  if (inventoryOn) {
    const [inventoryItems, recipes, products] = await Promise.all([
      getInventory(branchId),
      getInventoryRecipes(branchId),
      getMenuProducts({}, branchId),
    ])
    productMargins = buildProductMarginsReport({ products, recipes, inventoryItems, topProducts })
    inventoryHealth = buildInventoryHealthReport({ inventoryItems, recipes })
  }

  const managerAlerts = buildManagerAlerts({
    payables: supplierPayables ?? buildSupplierPayablesReport([]),
    margins: productMargins ?? buildProductMarginsReport({ products: [], recipes: [], inventoryItems: [] }),
    inventory: inventoryHealth ?? buildInventoryHealthReport({ inventoryItems: [], recipes: [] }),
  })

  return NextResponse.json({
    ok: true,
    scope: consolidated ? "all" : "branch",
    supplierPayables,
    supplierPurchases,
    productMargins,
    inventoryHealth,
    managerAlerts,
    range: { from: fromISO, to: toISO ?? new Date().toISOString(), label },
    comparison,
    delivery: {
      orders: deliveryOrders,
      revenueUSD: round2(deliveryRevenueUSD),
      deliveryCostUSD: round2(deliveryCostUSD),
      avgDeliveryUSD: deliveryOrders > 0 ? round2(deliveryCostUSD / deliveryOrders) : 0,
    },
    // Cuentas de mesa vs pedidos directos, con lo cobrado y lo pendiente de
    // cada origen (pedido del dueño 2026-07-28).
    collectionByOrigin: {
      openAccounts: {
        accounts: accountOrigin.accounts.size,
        orders: accountOrigin.orders,
        totalUSD: round2(accountOrigin.totalUSD),
        collectedUSD: round2(accountOrigin.collectedUSD),
        pendingUSD: round2(accountOrigin.pendingUSD),
      },
      direct: {
        orders: directOrigin.orders,
        totalUSD: round2(directOrigin.totalUSD),
        collectedUSD: round2(directOrigin.collectedUSD),
        pendingUSD: round2(directOrigin.pendingUSD),
      },
    },
    byPaymentMethod: Object.entries(byMethod)
      .map(([method, v]) => ({ method, count: v.count, totalUSD: round2(v.totalUSD) }))
      .sort((a, b) => b.totalUSD - a.totalUSD),
    summary: {
      orders: count,
      totalUSD: round2(totalUSD),
      collectedUSD: round2(collectedUSD),
      pendingUSD: round2(pendingUSD),
      avgTicket: round2(avgTicket),
    },
    byType: Object.entries(byType).map(([type, v]) => ({ type, count: v.count, totalUSD: round2(v.totalUSD) })),
    byPayment: Object.entries(byPayment).map(([status, c]) => ({ status, count: c })),
    byHour: byHour.map((v, hour) => ({ hour, totalUSD: round2(v) })),
    byDay,
    topProducts: topProducts.map((p) => ({ ...p, totalUSD: round2(p.totalUSD) })),
  })
}

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
    return {
      fromISO: new Date(fromParam).toISOString(),
      toISO: toParam ? new Date(toParam).toISOString() : null,
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

  const { fromISO, toISO, label } = resolveRange(request)
  const supabase = getSupabaseAdmin()

  // Alcance: ?scope=all = consolidado (todas las sucursales); si no, la
  // sucursal actual (header x-branch-id → default).
  const consolidated = request.nextUrl.searchParams.get("scope") === "all"
  if (consolidated && access.role !== "owner" && access.role !== "support") {
    return NextResponse.json({ error: "Solo dueño o soporte pueden ver consolidado" }, { status: 403 })
  }
  const branchId = consolidated ? null : await resolveBranchId(request)

  const SELECT_COLS =
    "id, created_at, status, order_type, total_usd, payment_status, payment_received_equiv_usd, payment_pending_usd, payment_method_usd, payment_method_ves, delivery_cost_usd, is_training"

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

  let totalUSD = 0
  let collectedUSD = 0
  let pendingUSD = 0
  const byType: Record<string, { count: number; totalUSD: number }> = {}
  const byPayment: Record<string, number> = {}
  const byHour: number[] = Array.from({ length: 24 }, () => 0)
  const byDayMap = new Map<string, { date: string; orders: number; totalUSD: number }>()
  // Métodos de pago reales (efectivo, Zelle, pago móvil…). Un pedido puede usar
  // método en divisas y en bolívares a la vez: cuenta en ambos.
  const byMethod: Record<string, { count: number; totalUSD: number }> = {}
  let deliveryOrders = 0
  let deliveryRevenueUSD = 0
  let deliveryCostUSD = 0

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

    const pay = String(o.payment_status || "Pendiente")
    byPayment[pay] = (byPayment[pay] || 0) + 1

    for (const method of [String(o.payment_method_usd || ""), String(o.payment_method_ves || "")]) {
      const m = method.trim()
      if (!m) continue
      byMethod[m] = byMethod[m] || { count: 0, totalUSD: 0 }
      byMethod[m].count += 1
      byMethod[m].totalUSD += t
    }

    const dCost = num(o.delivery_cost_usd)
    if (/delivery|domicilio|env[íi]o/i.test(type) || dCost > 0) {
      deliveryOrders += 1
      deliveryRevenueUSD += t
      deliveryCostUSD += dCost
    }

    const created = new Date(String(o.created_at))
    const hour = created.getHours()
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
    const { data: itemRows } = await supabase
      .from("order_items")
      .select("name, quantity, price, order_id")
      .in("order_id", ids)
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
    supplierPayables = buildSupplierPayablesReport(purchases)
    supplierPurchases = {
      summary: {
        purchases: supplierPayables.summary.purchases,
        totalUSD: supplierPayables.summary.totalUSD,
        totalVES: supplierPayables.summary.totalVES,
      },
      bySupplier: supplierPayables.bySupplier,
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

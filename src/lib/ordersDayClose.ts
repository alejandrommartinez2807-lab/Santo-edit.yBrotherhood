import { getSupabaseAdmin } from "./supabaseServer"
import { signPaymentProofPaths } from "./ordersPaymentProofs"

export type DayCloseSummaryItem = {
  label: string
  count: number
  totalUSD: number
  totalVES?: number
  totalCombosUSD?: number
  totalRegularUSD?: number
  totalRegularVES?: number
  deliveryCostUSD?: number
}

export type DayCloseProductSold = {
  name: string
  quantity: number
  totalUSD: number
  totalVES: number
  onlyCurrency: boolean
}

export type DayCloseExpense = {
  id?: string
  dateLabel?: string
  dateValue?: string
  concept: string
  category: string
  amountUSD: number
  amountVES: number
  equivalentUSD: number
  method: string
  note?: string
  createdAt?: string

  provider?: string
  expenseType?: string
  inventoryLinked?: boolean
  inventoryItemId?: string
  inventoryItemName?: string
  inventoryQuantity?: number
  inventoryUnit?: string
}

// Fotografía de cada pedido del día al momento del cierre: el historial la
// muestra pedido por pedido aunque el reinicio posterior borre los pedidos.
export type DayCloseOrderItem = {
  name: string
  quantity: number
  priceUSD: number
  selectionSummary?: string
}

export type DayCloseOrder = {
  id: string
  displayNumber: string
  createdAt: string
  customerName: string
  location: string
  orderType: string
  status: string
  paymentStatus: string
  totalUSD: number
  receivedEquivalentUSD: number
  registeredBy?: string
  // Motivo de anulación (solo pedidos Cancelados): se extrae de la nota
  // "ANULADO: …" para que el cierre y el historial lo listen.
  cancelReason?: string
  items: DayCloseOrderItem[]
}

// Comprobantes reportados por clientes, con su pedido asociado: al cerrar se
// archivan aquí y salen del panel de comprobantes.
export type DayCloseProof = {
  orderId: string
  orderDisplayNumber: string
  customerName: string
  reportedMethod: string
  amountReportedUSD: number
  amountReportedVES: number
  paymentReference: string
  status: string
  createdAt: string
  proofImageUrl: string
  // Ruta del archivo en Storage (bucket privado): permite re-firmar la URL al
  // ver un cierre viejo, porque las URLs firmadas caducan.
  proofFileId?: string
}

export type DayCloseInventoryProduct = {
  itemName: string
  quantity: number
  unit: string
  movementCount?: number
}

export type DayCloseInventoryAlert = {
  orderNumber: string
  customerName?: string
  warning: string
}

export type SaveDayCloseInput = {
  id?: string
  createdAt?: string
  dateLabel: string
  summaryText: string

  ordersRegistered: number
  activeOrders: number
  deliveredOrders: number
  canceledOrders: number
  deliveryRegistered: number
  deliveryDelivered: number
  deliveryActive: number

  totalConfirmedUSD: number
  productSalesUSD: number
  combosUSD: number
  regularUSD: number
  regularVES: number
  deliveryCollectedUSD: number

  pendingTotalUSD: number
  pendingCombosUSD: number
  pendingRegularUSD: number
  pendingRegularVES: number
  pendingDeliveryUSD: number

  totalSoldUSD?: number
  realCollectedUSD?: number
  realCashUSD?: number
  realVES?: number
  realVESEquivalentUSD?: number
  realPendingUSD?: number
  paidOrders?: number
  partialPaymentOrders?: number
  pendingPaymentOrders?: number
  deliveryPaidInUSD?: number
  deliveryPaidInVES?: number
  deliveryPaidInVESEquivalentUSD?: number
  deliveryPaidMixedUSD?: number

  fiscalOrders?: number
  fiscalSubtotalUSD?: number
  fiscalIvaTotalUSD?: number
  fiscalIgtfBaseUSD?: number
  fiscalIgtfUSD?: number
  fiscalTotalUSD?: number
  fiscalIvaByRate?: Array<{ rate: number; baseUSD: number; ivaUSD: number }>

  expensesCount?: number
  expensesTotalUSD?: number
  expensesCashUSD?: number
  expensesVES?: number
  expensesVESEquivalentUSD?: number
  netEstimatedUSD?: number
  expenses?: DayCloseExpense[]

  // Compras a proveedores: abonos pagados dentro del rango del cierre (todos los
  // métodos) como salida de caja. netAfterPurchasesUSD = netEstimatedUSD − abonos.
  // No altera netEstimatedUSD (ventas − gastos) para no romper cierres previos.
  supplierPaymentsCount?: number
  supplierPaymentsUSD?: number
  supplierPaymentsVES?: number
  supplierPaymentsEquivalentUSD?: number
  netAfterPurchasesUSD?: number

  inventoryProcessedOrders?: number
  inventoryPendingOrders?: number
  inventoryWarningOrders?: number
  inventoryMovementCount?: number
  inventoryProducts?: DayCloseInventoryProduct[]
  inventoryAlerts?: DayCloseInventoryAlert[]

  salesByType: DayCloseSummaryItem[]
  deliveryByPayment: DayCloseSummaryItem[]
  deliveryByZone: DayCloseSummaryItem[]
  paymentByStatus?: DayCloseSummaryItem[]
  paymentByUSDMethod?: DayCloseSummaryItem[]
  paymentByVESMethod?: DayCloseSummaryItem[]
  deliveryByPaymentIn?: DayCloseSummaryItem[]
  // Ventas por vendedor (0022): cobros agrupados por quién los registró y
  // pedidos agrupados por quién los registró (cliente web = sin actor).
  salesBySeller?: DayCloseSummaryItem[]
  ordersByRegistrar?: DayCloseSummaryItem[]
  productsSold: DayCloseProductSold[]

  // Fotografía pedido por pedido + comprobantes del día (las llena el
  // servidor al guardar el cierre; ver /api/day-close).
  orders?: DayCloseOrder[]
  paymentProofs?: DayCloseProof[]
}

export type SavedDayClose = SaveDayCloseInput & {
  id: string
  createdAt: string
  // Sede dueña del cierre (columna branch_id): el historial consolidado la
  // usa para etiquetar de qué sede es cada cierre.
  branchId?: string
}

export type DayExpense = {
  id: string
  dateLabel: string
  dateValue: string
  concept: string
  category: string
  amountUSD: number
  amountVES: number
  equivalentUSD: number
  method: string
  note: string
  createdAt: string
  closeStatus?: string
  closeId?: string
  closedAt?: string

  provider?: string
  expenseType?: string
  inventoryLinked?: boolean
  inventoryItemId?: string
  inventoryItemName?: string
  inventoryQuantity?: number
  inventoryUnit?: string
}

export type SaveDayExpenseInput = {
  id?: string
  dateLabel?: string
  dateValue?: string
  concept: string
  category?: string
  amountUSD?: number
  amountVES?: number
  equivalentUSD?: number
  method?: string
  note?: string
  createdAt?: string

  provider?: string
  expenseType?: string
  inventoryLinked?: boolean
  inventoryItemId?: string
  inventoryItemName?: string
  inventoryQuantity?: number
  inventoryUnit?: string
}

export type DayExpenseFilters = {
  dateFrom?: string
  dateTo?: string
  dateValue?: string
  includeClosed?: boolean
}

// Caja (cierres y gastos) en Supabase. Cierres y gastos guardan
// todo su contenido en la columna JSONB `data`.
export async function saveDayClose(input: SaveDayCloseInput, branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  const id = cleanText((input as { id?: string }).id) || `close-${Date.now()}-${randomSuffix()}`
  const createdAt =
    cleanText((input as { createdAt?: string }).createdAt) || new Date().toISOString()
  const payload = { ...input, id, createdAt } as SavedDayClose

  const { error } = await supabase
    .from("day_closes")
    .upsert({ id, branch_id: branchId ?? null, created_at: createdAt, data: payload })

  if (error) {
    throw new Error(error.message || "No se pudo guardar el cierre del día")
  }

  return payload
}


export async function getDayCloses(branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  let q = supabase
    .from("day_closes")
    .select("*")
    .order("created_at", { ascending: false })
  if (branchId) q = q.eq("branch_id", branchId)
  const { data, error } = await q

  if (error) {
    throw new Error(error.message || "No se pudieron cargar los cierres guardados")
  }

  const closes = (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>
    const payload = (row.data && typeof row.data === "object" ? row.data : {}) as Record<string, unknown>
    return {
      ...payload,
      id: cleanText(row.id),
      createdAt: cleanText(payload.createdAt) || cleanText(row.created_at),
      branchId: cleanText(row.branch_id) || undefined,
    } as SavedDayClose
  })

  // Bucket de comprobantes es privado: las URLs firmadas guardadas en el
  // snapshot del cierre caducan. Re-firmamos desde la ruta del archivo para que
  // el historial siga mostrando las imágenes. La ruta sale de `proofFileId`
  // (cierres nuevos) o, si no está, se deriva de la URL pública vieja guardada
  // en `proofImageUrl` (cierres previos al bucket privado): así el historial
  // antiguo no se rompe con la migración a privado.
  const pathForProof = (proof: DayCloseProof) =>
    cleanText(proof.proofFileId) || extractStoredProofPath(proof.proofImageUrl)

  const proofPaths: string[] = []
  for (const close of closes) {
    for (const proof of close.paymentProofs ?? []) {
      const path = pathForProof(proof)
      if (path) proofPaths.push(path)
    }
  }

  if (proofPaths.length > 0) {
    const signedByPath = await signPaymentProofPaths(proofPaths)
    for (const close of closes) {
      if (!Array.isArray(close.paymentProofs)) continue
      close.paymentProofs = close.paymentProofs.map((proof) => {
        const path = pathForProof(proof)
        return path && signedByPath.has(path)
          ? { ...proof, proofImageUrl: signedByPath.get(path) || "" }
          : proof
      })
    }
  }

  return closes
}

// Extrae la ruta del bucket ("proofs/xxxx") desde una URL de Storage guardada
// (pública `/object/public/payment-proofs/...` o firmada `/object/sign/...`),
// para poder re-firmarla cuando el snapshot no trae `proofFileId`.
function extractStoredProofPath(url: unknown): string {
  const value = cleanText(url)
  if (!value) return ""
  const match = value.match(/\/payment-proofs\/([^?]+)/)
  if (!match) return ""
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}


export async function clearDayCloses(branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  let countQ = supabase.from("day_closes").select("id", { count: "exact", head: true })
  if (branchId) countQ = countQ.eq("branch_id", branchId)
  const { count } = await countQ

  // Borra SOLO los cierres de la sucursal indicada (no toca otras sucursales).
  let delQ = supabase.from("day_closes").delete()
  delQ = branchId ? delQ.eq("branch_id", branchId) : delQ.neq("id", "")
  const { error } = await delQ
  if (error) {
    throw new Error(error.message || "No se pudo borrar el historial de cierres")
  }

  return {
    deleted: count ?? 0,
    message: "Historial de cierres borrado correctamente.",
  }
}


function isClosedExpenseStatus(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .includes("cerr")
}

export async function getDayExpenses(
  filters: DayExpenseFilters = {},
  branchId?: string | null,
) {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("day_expenses").select("*").order("created_at", { ascending: false })

  if (branchId) query = query.eq("branch_id", branchId)
  if (filters.dateValue) {
    query = query.eq("date_value", filters.dateValue)
  }
  if (filters.dateFrom) {
    query = query.gte("date_value", filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte("date_value", filters.dateTo)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message || "No se pudieron cargar los gastos del día")
  }

  let expenses = (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>
    return (row.data && typeof row.data === "object" ? row.data : {}) as DayExpense
  })

  if (!filters.includeClosed) {
    expenses = expenses.filter((expense) => !isClosedExpenseStatus(expense.closeStatus))
  }

  return expenses
}

export async function saveDayExpense(input: SaveDayExpenseInput, branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  const id = cleanText(input.id) || `exp-${Date.now()}-${randomSuffix()}`
  const createdAt = cleanText(input.createdAt) || new Date().toISOString()

  const expense: DayExpense = {
    id,
    dateLabel: cleanText(input.dateLabel),
    dateValue: cleanText(input.dateValue),
    concept: cleanText(input.concept),
    category: cleanText(input.category) || "General",
    amountUSD: Number(input.amountUSD || 0),
    amountVES: Number(input.amountVES || 0),
    equivalentUSD: Number(input.equivalentUSD || input.amountUSD || 0),
    method: cleanText(input.method),
    note: cleanText(input.note),
    createdAt,
    provider: cleanText(input.provider) || undefined,
    expenseType: cleanText(input.expenseType) || undefined,
    inventoryLinked: input.inventoryLinked === true,
    inventoryItemId: cleanText(input.inventoryItemId) || undefined,
    inventoryItemName: cleanText(input.inventoryItemName) || undefined,
    inventoryQuantity: input.inventoryQuantity,
    inventoryUnit: cleanText(input.inventoryUnit) || undefined,
  }

  const { error } = await supabase.from("day_expenses").upsert({
    id,
    branch_id: branchId ?? null,
    created_at: createdAt,
    date_value: expense.dateValue,
    close_status: "",
    data: expense,
  })

  if (error) {
    throw new Error(error.message || "No se pudo guardar el gasto del día")
  }

  return expense
}

export async function deleteDayExpense(expenseId: string) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from("day_expenses").delete().eq("id", cleanText(expenseId))

  if (error) {
    throw new Error(error.message || "No se pudo eliminar el gasto del día")
  }

  return { ok: true }
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getBusinessConfig } from "@/lib/orders"
import { captureError } from "@/lib/monitoring"
import { writeAuditLog } from "@/lib/audit"
import { sendStaffAlertPush } from "@/lib/orderPushNotifications"
import {
  calculateSupplierPayableTotals,
  normalizeSupplierPaymentStatus,
} from "@/lib/supplierPayables"

// Recordatorios de CUENTAS POR PAGAR como notificación: facturas a crédito
// de proveedores con vencimiento cercano (o ya vencidas) le llegan al dueño/
// encargado suscrito aunque la app esté cerrada. El dueño configura cuántos
// días antes del vencimiento quiere el aviso (payablesReminderDaysBefore).
//
// Anti-spam: un aviso por sede cada 24 horas mientras haya facturas en la
// ventana, y se repite antes solo si la situación cambió (venció una nueva,
// se pagó otra…). Marca persistente en audit_logs, igual que reposición.

const RUN_INTERVAL_MS = 10 * 60 * 1000
const NOTIFY_WINDOW_HOURS = 24
const MAX_ITEMS_IN_MESSAGE = 5

let lastRunAt = 0
let isRunning = false

type PayableAlert = {
  id: string
  supplierName: string
  dueDate: string
  pendingUSD: number
  pendingVES: number
  overdue: boolean
  daysLeft: number
}

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" })
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysBetween(fromKey: string, toKey: string) {
  const from = new Date(`${fromKey}T12:00:00Z`).getTime()
  const to = new Date(`${toKey}T12:00:00Z`).getTime()
  return Math.round((to - from) / 86_400_000)
}

function formatPending(alert: PayableAlert) {
  if (alert.pendingUSD > 0) return `$${alert.pendingUSD.toFixed(2)}`
  if (alert.pendingVES > 0) return `Bs ${alert.pendingVES.toFixed(2)}`
  return ""
}

function buildSignature(alerts: PayableAlert[]) {
  return alerts
    .map((alert) => `${alert.id}:${alert.overdue ? "vencida" : alert.daysLeft}`)
    .sort()
    .join("|")
}

async function getBranchPayableAlerts(
  branchId: string,
  daysBefore: number,
): Promise<PayableAlert[]> {
  const supabase = getSupabaseAdmin()
  const today = todayKey()
  const horizon = addDays(today, daysBefore)

  const { data, error } = await supabase
    .from("supplier_purchases")
    .select("id, supplier_name, total_usd, total_ves, paid_usd, paid_ves, payment_status, due_date")
    .eq("branch_id", branchId)
    .neq("payment_status", "Pagado")
    .not("due_date", "is", null)
    .lte("due_date", horizon)
    .limit(50)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((raw) => {
      const row = raw as Record<string, unknown>
      const totals = calculateSupplierPayableTotals({
        totalUSD: row.total_usd,
        totalVES: row.total_ves,
        paidUSD: row.paid_usd,
        paidVES: row.paid_ves,
      })
      const dueDate = String(row.due_date || "").slice(0, 10)

      return {
        id: String(row.id || ""),
        supplierName: String(row.supplier_name || "").trim() || "Proveedor",
        dueDate,
        pendingUSD: totals.pendingUSD,
        pendingVES: totals.pendingVES,
        overdue: dueDate < today,
        daysLeft: daysBetween(today, dueDate),
      }
    })
    .filter(
      (alert) =>
        alert.id &&
        alert.dueDate &&
        normalizeSupplierPaymentStatus("Pendiente") !== "Pagado" &&
        (alert.pendingUSD > 0 || alert.pendingVES > 0),
    )
    .sort((first, second) => first.dueDate.localeCompare(second.dueDate))
}

// Último recordatorio de esta sede (marca persistente en audit_logs).
async function getLastReminder(
  branchId: string,
): Promise<{ createdAt: string; signature: string } | null> {
  const supabase = getSupabaseAdmin()
  // branch-exempt: audit_logs se consulta por sede vía columna branch_id.
  const { data, error } = await supabase
    .from("audit_logs")
    .select("created_at, metadata")
    .eq("action", "payables.reminder.notified")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) return null
  const row = data?.[0] as Record<string, unknown> | undefined
  if (!row) return null

  const metadata = (row.metadata || {}) as Record<string, unknown>

  return {
    createdAt: String(row.created_at || ""),
    signature: String(metadata.signature || ""),
  }
}

export type PayablesDispatchResult = {
  ok: boolean
  notifiedBranches: number
  reason?: string
}

export async function dispatchPayablesReminders(): Promise<PayablesDispatchResult> {
  const config = (await getBusinessConfig()) as unknown as Record<string, unknown>

  if (config.payablesReminderPushEnabled === false) {
    return { ok: true, notifiedBranches: 0, reason: "Apagado en Configuración" }
  }

  const daysBefore = Math.min(
    60,
    Math.max(0, Math.round(Number(config.payablesReminderDaysBefore) || 3)),
  )

  const supabase = getSupabaseAdmin()
  const { data: branchRows, error: branchError } = await supabase
    .from("branches")
    .select("id, name, is_active")
    .eq("is_active", true)

  if (branchError) throw new Error(branchError.message)

  let notifiedBranches = 0

  for (const raw of branchRows ?? []) {
    const branch = raw as Record<string, unknown>
    const branchId = String(branch.id || "")
    const branchName = String(branch.name || "").trim() || "Sede"

    try {
      const alerts = await getBranchPayableAlerts(branchId, daysBefore)
      if (!alerts.length) continue

      const signature = buildSignature(alerts)
      const lastReminder = await getLastReminder(branchId)

      if (lastReminder) {
        const ageMs = Date.now() - new Date(lastReminder.createdAt).getTime()
        const insideWindow =
          Number.isFinite(ageMs) && ageMs < NOTIFY_WINDOW_HOURS * 60 * 60 * 1000

        if (insideWindow && lastReminder.signature === signature) continue
      }

      const overdue = alerts.filter((alert) => alert.overdue)
      const upcoming = alerts.filter((alert) => !alert.overdue)
      const parts: string[] = []

      if (overdue.length) {
        parts.push(
          `${overdue.length} VENCIDA(S): ${overdue
            .slice(0, MAX_ITEMS_IN_MESSAGE)
            .map((alert) => `${alert.supplierName} ${formatPending(alert)} (venció ${alert.dueDate.slice(5)})`)
            .join(", ")}${overdue.length > MAX_ITEMS_IN_MESSAGE ? "…" : ""}`,
        )
      }

      if (upcoming.length) {
        parts.push(
          `${upcoming.length} por vencer: ${upcoming
            .slice(0, MAX_ITEMS_IN_MESSAGE)
            .map(
              (alert) =>
                `${alert.supplierName} ${formatPending(alert)} (${
                  alert.daysLeft === 0 ? "vence HOY" : `en ${alert.daysLeft} día${alert.daysLeft === 1 ? "" : "s"}`
                })`,
            )
            .join(", ")}${upcoming.length > MAX_ITEMS_IN_MESSAGE ? "…" : ""}`,
        )
      }

      await sendStaffAlertPush(branchId, {
        title: `💳 Cuentas por pagar · ${branchName}`,
        body: parts.join(" · "),
        url: "/local-santo/cuentas-por-pagar",
      })

      await writeAuditLog({
        action: "payables.reminder.notified",
        branchId,
        entityType: "supplier_purchase",
        actor: { role: "sistema", label: "Recordatorio de pagos", source: "auto" },
        metadata: {
          signature,
          vencidas: overdue.length,
          porVencer: upcoming.length,
          resumen: parts.join(" · ").slice(0, 500),
        },
      })

      notifiedBranches += 1
    } catch (error) {
      captureError(error, {
        route: "lib/payablesReminderAlerts",
        action: `branch-${branchId.slice(0, 8)}`,
      })
    }
  }

  return { ok: true, notifiedBranches }
}

// Disparo oportunista con throttle: lo llama el GET de pedidos del panel.
export function maybeDispatchPayablesReminders(): void {
  const now = Date.now()

  if (isRunning || now - lastRunAt < RUN_INTERVAL_MS) return

  lastRunAt = now
  isRunning = true

  void dispatchPayablesReminders()
    .catch((error) => {
      captureError(error, { route: "lib/payablesReminderAlerts", action: "maybeDispatch" })
    })
    .finally(() => {
      isRunning = false
    })
}

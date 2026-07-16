import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getBusinessConfig } from "@/lib/orders"
import { captureError } from "@/lib/monitoring"
import { writeAuditLog } from "@/lib/audit"
import { sendStaffAlertPush } from "@/lib/orderPushNotifications"

// Alertas inteligentes de reposición COMO NOTIFICACIÓN: cuando una sede
// tiene productos agotados o con stock bajo, los equipos suscritos del
// dueño/encargado reciben un push con el resumen, aunque la app esté
// cerrada. Mismo canal que la alarma de anulación (botón "Alertas" del
// panel de Pedidos).
//
// Anti-spam: máximo UN aviso por sede cada 12 horas, y solo si la lista de
// productos en alerta CAMBIÓ desde el último aviso. La marca persistente
// vive en audit_logs (action inventory.restock.notified), así el dedupe
// sobrevive los reinicios del servidor sin necesitar otra migración.

const RUN_INTERVAL_MS = 10 * 60 * 1000
const NOTIFY_WINDOW_HOURS = 12
const MAX_ITEMS_IN_MESSAGE = 6

let lastRunAt = 0
let isRunning = false

type RestockAlertItem = {
  name: string
  quantity: number
  minimumStock: number
  unit: string
  out: boolean
}

function buildSignature(items: RestockAlertItem[]): string {
  return items
    .map((item) => `${item.name}:${item.out ? "out" : "low"}`)
    .sort()
    .join("|")
}

async function getBranchAlertItems(branchId: string): Promise<RestockAlertItem[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("inventory_items")
    .select("name, quantity, minimum_stock, unit, is_active")
    .eq("branch_id", branchId)
    .eq("is_active", true)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((raw) => {
      const row = raw as Record<string, unknown>
      const quantity = Number(row.quantity ?? 0) || 0
      const minimumStock = Number(row.minimum_stock ?? 0) || 0

      return {
        name: String(row.name || "").trim(),
        quantity,
        minimumStock,
        unit: String(row.unit || "").trim() || "unid",
        out: quantity <= 0,
      }
    })
    .filter(
      (item) =>
        item.name &&
        (item.out || (item.minimumStock > 0 && item.quantity <= item.minimumStock)),
    )
    .sort((first, second) => Number(second.out) - Number(first.out))
}

// Último aviso de reposición de esta sede (marca persistente en audit_logs).
async function getLastNotification(
  branchId: string,
): Promise<{ createdAt: string; signature: string } | null> {
  const supabase = getSupabaseAdmin()
  // branch-exempt: audit_logs se consulta por sede vía columna branch_id.
  const { data, error } = await supabase
    .from("audit_logs")
    .select("created_at, metadata")
    .eq("action", "inventory.restock.notified")
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

export type RestockDispatchResult = {
  ok: boolean
  notifiedBranches: number
  reason?: string
}

export async function dispatchRestockAlerts(): Promise<RestockDispatchResult> {
  const config = (await getBusinessConfig()) as unknown as Record<string, unknown>

  if (config.inventoryRestockPushEnabled === false) {
    return { ok: true, notifiedBranches: 0, reason: "Apagado en Configuración" }
  }

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
      const items = await getBranchAlertItems(branchId)
      if (!items.length) continue

      const signature = buildSignature(items)
      const lastNotification = await getLastNotification(branchId)

      if (lastNotification) {
        const ageMs = Date.now() - new Date(lastNotification.createdAt).getTime()
        const insideWindow =
          Number.isFinite(ageMs) && ageMs < NOTIFY_WINDOW_HOURS * 60 * 60 * 1000

        // Dentro de la ventana solo se repite si la situación CAMBIÓ
        // (se agotó algo nuevo, se repuso otro, etc.).
        if (insideWindow && lastNotification.signature === signature) continue
      }

      const outItems = items.filter((item) => item.out)
      const lowItems = items.filter((item) => !item.out)
      const parts: string[] = []

      if (outItems.length) {
        parts.push(
          `${outItems.length} agotado(s): ${outItems
            .slice(0, MAX_ITEMS_IN_MESSAGE)
            .map((item) => item.name)
            .join(", ")}${outItems.length > MAX_ITEMS_IN_MESSAGE ? "…" : ""}`,
        )
      }

      if (lowItems.length) {
        parts.push(
          `${lowItems.length} bajo(s): ${lowItems
            .slice(0, MAX_ITEMS_IN_MESSAGE)
            .map((item) => `${item.name} (${item.quantity}/${item.minimumStock} ${item.unit})`)
            .join(", ")}${lowItems.length > MAX_ITEMS_IN_MESSAGE ? "…" : ""}`,
        )
      }

      await sendStaffAlertPush(branchId, {
        title: `📦 Reposición · ${branchName}`,
        body: parts.join(" · "),
        url: "/local-santo/inventario-alertas",
      })

      await writeAuditLog({
        action: "inventory.restock.notified",
        branchId,
        entityType: "inventory_item",
        actor: { role: "sistema", label: "Alertas de reposición", source: "auto" },
        metadata: {
          signature,
          agotados: outItems.length,
          bajos: lowItems.length,
          resumen: parts.join(" · ").slice(0, 500),
        },
      })

      notifiedBranches += 1
    } catch (error) {
      captureError(error, {
        route: "lib/inventoryRestockAlerts",
        action: `branch-${branchId.slice(0, 8)}`,
      })
    }
  }

  return { ok: true, notifiedBranches }
}

// Disparo oportunista con throttle: lo llama el GET de pedidos del panel y
// se AWAITEA antes de responder (en serverless el trabajo suelto tras
// responder se congela). Solo una petición cada 10 min paga esta latencia.
export async function maybeDispatchRestockAlerts(): Promise<void> {
  const now = Date.now()

  if (isRunning || now - lastRunAt < RUN_INTERVAL_MS) return

  lastRunAt = now
  isRunning = true

  try {
    await dispatchRestockAlerts()
  } catch (error) {
    captureError(error, { route: "lib/inventoryRestockAlerts", action: "maybeDispatch" })
  } finally {
    isRunning = false
  }
}

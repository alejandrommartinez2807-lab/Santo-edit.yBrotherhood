import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import type { DeliveryZone } from "@/types/localOrders"

import { num, type Row } from "./ordersStoreMappers"

// ============================================================
// ZONAS DE DELIVERY SOBRE SUPABASE
// ============================================================

export async function getDeliveryZones(branchId?: string | null): Promise<DeliveryZone[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("delivery_zones")
    .select("*")
    .order("sort_order", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((raw) => {
      const row = raw as Row
      return {
        name: cleanText(row.name),
        costUSD: num(row.cost_usd),
        isActive: row.is_active !== false,
      }
    })
    .filter((zone) => zone.name && Number.isFinite(zone.costUSD) && zone.costUSD >= 0)
}

export async function saveDeliveryZones(
  zones: DeliveryZone[],
  branchId?: string | null,
): Promise<DeliveryZone[]> {
  const supabase = getSupabaseAdmin()

  // Reemplazo total: la lista de zonas se guarda completa cada vez,
  // pero SOLO las de esta sucursal (no toca las de otras sucursales).
  let deleteQuery = supabase.from("delivery_zones").delete()
  deleteQuery = branchId ? deleteQuery.eq("branch_id", branchId) : deleteQuery.not("id", "is", null)
  const { error: deleteError } = await deleteQuery
  if (deleteError) throw new Error(deleteError.message)

  const rows = zones
    .filter((zone) => cleanText(zone.name))
    .map((zone, index) => ({
      branch_id: branchId ?? null,
      name: cleanText(zone.name),
      cost_usd: num(zone.costUSD),
      is_active: zone.isActive !== false,
      sort_order: index,
    }))

  if (rows.length) {
    // branch-exempt: cada fila de `rows` incluye branch_id (asignado arriba).
    const { error: insertError } = await supabase.from("delivery_zones").insert(rows)
    if (insertError) throw new Error(insertError.message)
  }

  return getDeliveryZones(branchId)
}

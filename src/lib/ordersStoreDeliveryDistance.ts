import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getDefaultBranchId } from "@/lib/branch"
import {
  normalizeDeliveryDistanceSettings,
  type DeliveryDistanceSettings,
} from "@/lib/deliveryDistance"

// ============================================================
// ENVÍO POR DISTANCIA SOBRE SUPABASE
// Una fila de configuración por sucursal. Si la sede no tiene fila propia,
// hereda la de la sucursal principal (misma regla que el menú por sede).
// ============================================================

type SettingsRow = {
  branch_id?: string | null
  enabled?: boolean | null
  origin_maps_url?: string | null
  origin_lat?: number | null
  origin_lng?: number | null
  road_factor?: number | null
  tiers?: unknown
}

function rowToSettings(row: SettingsRow): DeliveryDistanceSettings {
  return normalizeDeliveryDistanceSettings({
    enabled: row.enabled === true,
    originMapsUrl: row.origin_maps_url || "",
    originLat: row.origin_lat,
    originLng: row.origin_lng,
    roadFactor: row.road_factor,
    tiers: row.tiers,
  })
}

export type DeliveryDistanceSettingsMeta = {
  settings: DeliveryDistanceSettings
  // La sede NO tiene fila propia y está usando la config de otra (H9,
  // auditoría 2026-07-24): antes esta herencia era MUDA y el dueño veía
  // "San Diego configurado" cuando en realidad cotizaba desde Valencia.
  inherited: boolean
  inheritedFromBranchId: string | null
}

export async function getDeliveryDistanceSettingsWithMeta(
  branchId?: string | null,
): Promise<DeliveryDistanceSettingsMeta> {
  const supabase = getSupabaseAdmin()

  // branch-exempt: tabla de configuración pequeña (una fila por sede); se trae
  // completa y la herencia sede → principal → global se resuelve aquí mismo.
  const { data, error } = await supabase.from("delivery_distance_settings").select("*")

  if (error) throw new Error(error.message || "No se pudo cargar el envío por distancia")

  const rows = (data ?? []) as SettingsRow[]
  const cleanBranchId = String(branchId || "").trim()

  const ownRow = cleanBranchId
    ? rows.find((row) => String(row.branch_id || "") === cleanBranchId)
    : undefined
  if (ownRow) {
    return { settings: rowToSettings(ownRow), inherited: false, inheritedFromBranchId: null }
  }

  // Sede sin configuración propia: hereda la de la sucursal principal.
  const defaultBranchId = await getDefaultBranchId()
  const mainRow = defaultBranchId
    ? rows.find((row) => String(row.branch_id || "") === defaultBranchId)
    : undefined
  if (mainRow) {
    return {
      settings: rowToSettings(mainRow),
      inherited: Boolean(cleanBranchId && cleanBranchId !== defaultBranchId),
      inheritedFromBranchId:
        cleanBranchId && cleanBranchId !== defaultBranchId ? defaultBranchId : null,
    }
  }

  const globalRow = rows.find((row) => !row.branch_id)
  if (globalRow) {
    return {
      settings: rowToSettings(globalRow),
      inherited: Boolean(cleanBranchId),
      inheritedFromBranchId: null,
    }
  }

  return {
    settings: normalizeDeliveryDistanceSettings(null),
    inherited: false,
    inheritedFromBranchId: null,
  }
}

export async function getDeliveryDistanceSettings(
  branchId?: string | null,
): Promise<DeliveryDistanceSettings> {
  return (await getDeliveryDistanceSettingsWithMeta(branchId)).settings
}

export async function saveDeliveryDistanceSettings(
  settings: DeliveryDistanceSettings,
  branchId?: string | null,
): Promise<DeliveryDistanceSettings> {
  const supabase = getSupabaseAdmin()
  const cleanSettings = normalizeDeliveryDistanceSettings(settings)
  const cleanBranchId = String(branchId || "").trim() || null

  const row = {
    branch_id: cleanBranchId,
    enabled: cleanSettings.enabled,
    origin_maps_url: cleanSettings.originMapsUrl,
    origin_lat: cleanSettings.originLat,
    origin_lng: cleanSettings.originLng,
    road_factor: cleanSettings.roadFactor,
    tiers: cleanSettings.tiers,
    updated_at: new Date().toISOString(),
  }

  // Upsert manual (el índice único es por expresión coalesce y PostgREST no
  // permite onConflict sobre él): borra la fila de la sede y re-inserta.
  let deleteQuery = supabase.from("delivery_distance_settings").delete()
  deleteQuery = cleanBranchId
    ? deleteQuery.eq("branch_id", cleanBranchId)
    : deleteQuery.is("branch_id", null)
  const { error: deleteError } = await deleteQuery
  if (deleteError) {
    throw new Error(deleteError.message || "No se pudo guardar el envío por distancia")
  }

  // branch-exempt: la fila insertada incluye branch_id (asignado arriba).
  const { error: insertError } = await supabase
    .from("delivery_distance_settings")
    .insert(row)
  if (insertError) {
    throw new Error(insertError.message || "No se pudo guardar el envío por distancia")
  }

  return cleanSettings
}

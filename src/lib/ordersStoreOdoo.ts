import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { normalizeOdooBaseUrl } from "@/lib/odooSync"
import { type Row } from "./ordersStoreMappers"

// ============================================================
// Hotel · V8-A · Conector Odoo sobre Supabase (una conexión por branch_id).
//
// La API KEY es un SECRETO: esta tabla solo la toca el service role. NUNCA se
// devuelve al cliente en claro (la API expone solo si hay clave, no su valor).
// ============================================================

export type OdooIntegration = {
  baseUrl: string
  dbName: string
  login: string
  apiKey: string
  active: boolean
  liveSync: boolean
  lastUid: number | null
  lastSyncAt: string
  lastResult: string
}

function num(value: unknown, fallback: number | null = null): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mapIntegration(raw: Row): OdooIntegration {
  return {
    baseUrl: cleanText(raw.base_url),
    dbName: cleanText(raw.db_name),
    login: cleanText(raw.login),
    apiKey: String(raw.api_key || ""),
    active: raw.active === true,
    liveSync: raw.live_sync === true,
    lastUid: num(raw.last_uid, null),
    lastSyncAt: raw.last_sync_at ? String(raw.last_sync_at) : "",
    lastResult: cleanText(raw.last_result),
  }
}

/** La conexión Odoo del negocio, o null si nunca se configuró. */
export async function getOdooIntegration(branchId?: string | null): Promise<OdooIntegration | null> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("odoo_integration").select("*").limit(1)
  query = branchId ? query.eq("branch_id", branchId) : query.is("branch_id", null)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapIntegration(data as Row) : null
}

export type SaveOdooIntegrationInput = {
  baseUrl: string
  dbName: string
  login: string
  apiKey: string
  active?: boolean
  liveSync?: boolean
}

/**
 * Guarda (crea o actualiza) la conexión del branch. Si apiKey viene vacío y ya
 * había una guardada, se conserva la anterior (para no borrar el secreto al
 * editar los demás campos desde una UI que no reenvía la clave en claro).
 */
export async function saveOdooIntegration(
  input: SaveOdooIntegrationInput,
  branchId?: string | null,
): Promise<OdooIntegration> {
  const supabase = getSupabaseAdmin()
  const existing = await getOdooIntegration(branchId)
  const apiKey = cleanText(input.apiKey) || existing?.apiKey || ""
  const payload = {
    branch_id: branchId ?? null,
    base_url: normalizeOdooBaseUrl(input.baseUrl),
    db_name: cleanText(input.dbName),
    login: cleanText(input.login),
    api_key: apiKey,
    active: input.active !== false,
    live_sync: input.liveSync === true,
    updated_at: new Date().toISOString(),
  }
  if (existing) {
    let q = supabase.from("odoo_integration").update(payload)
    q = branchId ? q.eq("branch_id", branchId) : q.is("branch_id", null)
    const { data, error } = await q.select("*").single()
    if (error) throw new Error(error.message)
    return mapIntegration(data as Row)
  }
  const { data, error } = await supabase.from("odoo_integration").insert(payload).select("*").single()
  if (error) throw new Error(error.message)
  return mapIntegration(data as Row)
}

/** Registra el resultado de una prueba/sincronización (uid válido + texto). */
export async function updateOdooConnectionState(
  branchId: string | null | undefined,
  state: { lastUid?: number | null; lastResult?: string; touchSync?: boolean },
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (state.lastUid !== undefined) patch.last_uid = state.lastUid
  if (state.lastResult !== undefined) patch.last_result = cleanText(state.lastResult).slice(0, 300)
  if (state.touchSync) patch.last_sync_at = new Date().toISOString()
  let q = supabase.from("odoo_integration").update(patch)
  q = branchId ? q.eq("branch_id", branchId) : q.is("branch_id", null)
  const { error } = await q
  if (error) throw new Error(error.message)
}

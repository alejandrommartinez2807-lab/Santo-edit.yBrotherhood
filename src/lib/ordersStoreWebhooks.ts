import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"
import { parseWebhookEvents } from "@/lib/hotelWebhooks"

// Webhooks salientes sobre Supabase (Hotel · P2-E). Todo por branch_id.

export type Webhook = {
  id: string
  name: string
  url: string
  events: string
  secret: string
  active: boolean
  lastStatus: string
  lastFiredAt: string
  createdAt: string
}

export type SaveWebhookInput = {
  id?: string
  name: string
  url: string
  events: string
  secret: string
  active: boolean
}

function mapWebhook(raw: Row): Webhook {
  return {
    id: String(raw.id || ""),
    name: cleanText(raw.name),
    url: cleanText(raw.url),
    events: parseWebhookEvents(raw.events).join(","),
    secret: cleanText(raw.secret),
    active: raw.active !== false,
    lastStatus: cleanText(raw.last_status),
    lastFiredAt: raw.last_fired_at ? String(raw.last_fired_at) : "",
    createdAt: String(raw.created_at || ""),
  }
}

export async function getWebhooks(branchId?: string | null): Promise<Webhook[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("webhooks").select("*").order("created_at", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data as Row[]) || []).map(mapWebhook)
}

export async function saveWebhook(input: SaveWebhookInput, branchId?: string | null): Promise<Webhook> {
  const supabase = getSupabaseAdmin()
  const fields = {
    name: cleanText(input.name),
    url: cleanText(input.url),
    events: parseWebhookEvents(input.events).join(","),
    secret: cleanText(input.secret),
    active: input.active !== false,
  }

  if (input.id) {
    let query = supabase.from("webhooks").update(fields).eq("id", input.id)
    if (branchId) query = query.eq("branch_id", branchId)
    const { data, error } = await query.select("*").single()
    if (error) throw new Error(error.message)
    return mapWebhook(data as Row)
  }

  const { data, error } = await supabase
    .from("webhooks")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapWebhook(data as Row)
}

export async function deleteWebhook(id: string, branchId?: string | null): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("webhooks").delete().eq("id", id)
  if (branchId) query = query.eq("branch_id", branchId)
  const { error } = await query
  if (error) throw new Error(error.message)
  return { ok: true }
}

/** Anota el resultado del último disparo (código HTTP o "error"). */
export async function recordWebhookResult(id: string, status: string, branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("webhooks")
    .update({ last_status: cleanText(status).slice(0, 40), last_fired_at: new Date().toISOString() })
    .eq("id", id)
  if (branchId) query = query.eq("branch_id", branchId)
  const { error } = await query
  if (error) throw new Error(error.message)
}

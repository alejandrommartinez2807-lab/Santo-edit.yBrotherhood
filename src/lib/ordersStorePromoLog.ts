import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"

// Bitácora de promociones enviadas por WhatsApp (campañas del CRM + promos
// automáticas). Por HUÉSPED/TELÉFONO, no por reserva. Ver 0046_promo_send_log.

export type PromoLogEntry = {
  id: string
  phoneKey: string
  promoKind: string
  periodKey: string
  guestName: string
  channel: string
  sentAt: string
}

export type LogPromoInput = {
  phoneKey: string
  promoKind: string
  periodKey: string
  guestName?: string
  channel?: string
}

function mapEntry(raw: Row): PromoLogEntry {
  return {
    id: String(raw.id || ""),
    phoneKey: cleanText(raw.phone_key),
    promoKind: cleanText(raw.promo_kind),
    periodKey: cleanText(raw.period_key),
    guestName: cleanText(raw.guest_name),
    channel: cleanText(raw.channel) || "whatsapp",
    sentAt: String(raw.sent_at || ""),
  }
}

/** Clave compuesta para dedupe en memoria (planeación de promos automáticas). */
export function promoKeyOf(promoKind: string, periodKey: string, phoneKey: string): string {
  return `${promoKind}|${periodKey}|${phoneKey}`
}

/**
 * Registra un envío. Idempotente: si ese (branch, teléfono, promo, periodo) ya
 * existe, NO inserta y devuelve { inserted: false } — así el que llama sabe que
 * no debe volver a enviar. Race-safe (lo resuelve el UNIQUE en la base).
 */
export async function logPromoSend(
  input: LogPromoInput,
  branchId?: string | null,
): Promise<{ inserted: boolean }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("promo_send_log")
    .upsert(
      {
        branch_id: branchId ?? null,
        phone_key: cleanText(input.phoneKey),
        promo_kind: cleanText(input.promoKind) || "manual",
        period_key: cleanText(input.periodKey),
        guest_name: cleanText(input.guestName) || null,
        channel: cleanText(input.channel) || "whatsapp",
      },
      { onConflict: "branch_id,phone_key,promo_kind,period_key", ignoreDuplicates: true },
    )
    .select("id")
  if (error) throw new Error(error.message)
  return { inserted: (data ?? []).length > 0 }
}

/** Conjunto de claves ya enviadas (promoKind|periodKey|phoneKey) para planear. */
export async function getSentPromoKeys(
  branchId?: string | null,
  limit = 5000,
): Promise<Set<string>> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("promo_send_log")
    .select("phone_key, promo_kind, period_key")
    .order("sent_at", { ascending: false })
    .limit(limit)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const set = new Set<string>()
  for (const raw of data ?? []) {
    const r = raw as Row
    set.add(promoKeyOf(cleanText(r.promo_kind), cleanText(r.period_key), cleanText(r.phone_key)))
  }
  return set
}

/** Últimos envíos para mostrar en el panel. */
export async function getRecentPromoLog(
  branchId?: string | null,
  limit = 100,
): Promise<PromoLogEntry[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("promo_send_log")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(limit)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapEntry(raw as Row))
}

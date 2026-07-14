import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"

// Registro de notificaciones enviadas sobre Supabase (Hotel · Fase 12).

export type NotificationEntry = {
  id: string
  reservationId: string
  kind: string
  channel: string
  sentAt: string
}

function mapEntry(raw: Row): NotificationEntry {
  return {
    id: String(raw.id || ""),
    reservationId: cleanText(raw.reservation_id),
    kind: cleanText(raw.kind) || "confirmacion",
    channel: cleanText(raw.channel) || "whatsapp",
    sentAt: String(raw.sent_at || ""),
  }
}

export async function getNotificationLog(branchId?: string | null): Promise<NotificationEntry[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("notification_log").select("*").order("sent_at", { ascending: false }).limit(300)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapEntry(raw as Row))
}

export async function logNotification(
  input: { reservationId: string; kind?: string; channel?: string },
  branchId?: string | null,
): Promise<NotificationEntry> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("notification_log")
    .insert({
      branch_id: branchId ?? null,
      reservation_id: cleanText(input.reservationId) || null,
      kind: cleanText(input.kind) || "confirmacion",
      channel: cleanText(input.channel) || "whatsapp",
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapEntry(data as Row)
}

import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"
import { normalizeStayDate } from "./hotelReservationConflicts"

// Cierres de día sobre Supabase (Hotel · Fase 15). Todo por branch_id.

export type BusinessDay = {
  id: string
  date: string
  arrivals: number
  departures: number
  inHouse: number
  roomRevenue: number
  note: string
  closedAt: string
}

export type CloseBusinessDayInput = {
  date: string
  arrivals: number
  departures: number
  inHouse: number
  roomRevenue: number
  note?: string
}

function num(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mapDay(raw: Row): BusinessDay {
  return {
    id: String(raw.id || ""),
    date: normalizeStayDate(raw.date),
    arrivals: num(raw.arrivals, 0),
    departures: num(raw.departures, 0),
    inHouse: num(raw.in_house, 0),
    roomRevenue: num(raw.room_revenue, 0),
    note: cleanText(raw.note),
    closedAt: String(raw.closed_at || ""),
  }
}

export async function getBusinessDays(branchId?: string | null): Promise<BusinessDay[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("business_days").select("*").order("date", { ascending: false }).limit(60)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapDay(raw as Row))
}

export async function closeBusinessDay(
  input: CloseBusinessDayInput,
  branchId?: string | null,
): Promise<BusinessDay> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("business_days")
    .insert({
      branch_id: branchId ?? null,
      date: normalizeStayDate(input.date),
      arrivals: num(input.arrivals, 0),
      departures: num(input.departures, 0),
      in_house: num(input.inHouse, 0),
      room_revenue: num(input.roomRevenue, 0),
      note: cleanText(input.note),
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapDay(data as Row)
}

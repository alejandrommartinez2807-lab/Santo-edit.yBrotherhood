import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"
import {
  generateGuestPassCode,
  generateMembershipCode,
  normalizeDiscountPct,
} from "@/lib/hotelMemberships"

// Membresías / fidelización sobre Supabase (Hotel · P2-C). Todo por branch_id.

export type Membership = {
  id: string
  name: string
  level: string
  benefits: string
  discountPct: number
  active: boolean
  createdAt: string
}

export type GuestMembership = {
  id: string
  membershipId: string
  guestProfileId: string
  guestName: string
  code: string
  guestPassCode: string
  passUses: number
  lastReferral: string
  expiresAt: string
  active: boolean
  createdAt: string
}

function num(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mapMembership(raw: Row): Membership {
  return {
    id: String(raw.id || ""),
    name: cleanText(raw.name),
    level: cleanText(raw.level),
    benefits: cleanText(raw.benefits),
    discountPct: num(raw.discount_pct, 0),
    active: raw.active !== false,
    createdAt: String(raw.created_at || ""),
  }
}

function mapGuestMembership(raw: Row): GuestMembership {
  return {
    id: String(raw.id || ""),
    membershipId: cleanText(raw.membership_id),
    guestProfileId: cleanText(raw.guest_profile_id),
    guestName: cleanText(raw.guest_name),
    code: cleanText(raw.code),
    guestPassCode: cleanText(raw.guest_pass_code),
    passUses: num(raw.pass_uses, 0),
    lastReferral: cleanText(raw.last_referral),
    expiresAt: raw.expires_at ? String(raw.expires_at).slice(0, 10) : "",
    active: raw.active !== false,
    createdAt: String(raw.created_at || ""),
  }
}

// ---------------- memberships (niveles) ----------------
export async function getMemberships(branchId?: string | null): Promise<Membership[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("memberships").select("*").order("created_at", { ascending: false }).limit(100)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapMembership(raw as Row))
}

export type SaveMembershipInput = {
  id?: string
  name: string
  level?: string
  benefits?: string
  discountPct?: number
  active?: boolean
}

export async function saveMembership(
  input: SaveMembershipInput,
  branchId?: string | null,
): Promise<Membership> {
  const supabase = getSupabaseAdmin()
  const payload = {
    branch_id: branchId ?? null,
    name: cleanText(input.name),
    level: cleanText(input.level),
    benefits: cleanText(input.benefits),
    discount_pct: normalizeDiscountPct(input.discountPct),
    active: input.active !== false,
  }
  if (cleanText(input.id)) {
    let q = supabase.from("memberships").update(payload).eq("id", cleanText(input.id))
    if (branchId) q = q.eq("branch_id", branchId)
    const { data, error } = await q.select("*").single()
    if (error) throw new Error(error.message)
    return mapMembership(data as Row)
  }
  const { data, error } = await supabase.from("memberships").insert(payload).select("*").single()
  if (error) throw new Error(error.message)
  return mapMembership(data as Row)
}

export async function deleteMembership(id: string, branchId?: string | null): Promise<void> {
  const supabase = getSupabaseAdmin()
  let q = supabase.from("memberships").delete().eq("id", cleanText(id))
  if (branchId) q = q.eq("branch_id", branchId)
  const { error } = await q
  if (error) throw new Error(error.message)
}

// ------------- guest_memberships (la membresía de cada huésped) -------------
export async function getGuestMemberships(branchId?: string | null): Promise<GuestMembership[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("guest_memberships")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapGuestMembership(raw as Row))
}

export type AssignGuestMembershipInput = {
  membershipId: string
  guestProfileId?: string
  guestName: string
  expiresAt?: string
}

export async function assignGuestMembership(
  input: AssignGuestMembershipInput,
  branchId?: string | null,
): Promise<GuestMembership> {
  const supabase = getSupabaseAdmin()
  const payload = {
    branch_id: branchId ?? null,
    membership_id: cleanText(input.membershipId) || null,
    guest_profile_id: cleanText(input.guestProfileId) || null,
    guest_name: cleanText(input.guestName),
    code: generateMembershipCode(),
    guest_pass_code: generateGuestPassCode(),
    expires_at: cleanText(input.expiresAt) || null,
    active: true,
  }
  const { data, error } = await supabase.from("guest_memberships").insert(payload).select("*").single()
  if (error) throw new Error(error.message)
  return mapGuestMembership(data as Row)
}

export async function deleteGuestMembership(id: string, branchId?: string | null): Promise<void> {
  const supabase = getSupabaseAdmin()
  let q = supabase.from("guest_memberships").delete().eq("id", cleanText(id))
  if (branchId) q = q.eq("branch_id", branchId)
  const { error } = await q
  if (error) throw new Error(error.message)
}

// Resuelve una membresía por su código propio o por el pase de invitado.
// Sanitiza el código (solo A-Z0-9-) para no inyectar en el filtro PostgREST.
export async function findGuestMembershipByCode(
  code: string,
  branchId?: string | null,
): Promise<{ guestMembership: GuestMembership; viaPass: boolean } | null> {
  const supabase = getSupabaseAdmin()
  const clean = cleanText(code).toUpperCase().replace(/[^A-Z0-9-]/g, "")
  if (!clean) return null
  let query = supabase
    .from("guest_memberships")
    .select("*")
    .or(`code.eq.${clean},guest_pass_code.eq.${clean}`)
    .limit(1)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const row = (data ?? [])[0]
  if (!row) return null
  const guestMembership = mapGuestMembership(row as Row)
  const viaPass =
    guestMembership.guestPassCode.toUpperCase() === clean &&
    guestMembership.code.toUpperCase() !== clean
  return { guestMembership, viaPass }
}

// Registra el uso del pase de invitado: +1 y guarda el último referido.
export async function recordGuestPassUse(
  id: string,
  referral: string,
  branchId?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin()
  let readQ = supabase.from("guest_memberships").select("pass_uses").eq("id", cleanText(id))
  if (branchId) readQ = readQ.eq("branch_id", branchId)
  const { data: current } = await readQ.maybeSingle()
  const uses = num((current as Row)?.pass_uses, 0) + 1
  let q = supabase
    .from("guest_memberships")
    .update({ pass_uses: uses, last_referral: cleanText(referral).slice(0, 160) })
    .eq("id", cleanText(id))
  if (branchId) q = q.eq("branch_id", branchId)
  const { error } = await q
  if (error) throw new Error(error.message)
}

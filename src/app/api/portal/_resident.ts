import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { verifyToken, bearerToken } from "./_session"
import type { SupabaseClient } from "@supabase/supabase-js"

// Contexto del residente autenticado en el portal (a partir del token).
export type PortalLink = { unit_id: string; can_vote: boolean; units: { code?: string; alicuota?: number } | null }
export type PortalResident = {
  supabase: SupabaseClient
  residentId: string
  branchId: string
  resident: { id: string; full_name: string; phone: string }
  links: PortalLink[]
  unitIds: string[]
}

export async function getPortalResident(request: { headers: { get(n: string): string | null } }): Promise<PortalResident | null> {
  const residentId = verifyToken(bearerToken(request))
  if (!residentId) return null
  const supabase = getSupabaseAdmin()
  const { data: resident } = await supabase.from("residents").select("id, branch_id, full_name, phone").eq("id", residentId).maybeSingle()
  if (!resident) return null
  const { data: links } = await supabase.from("unit_residents").select("unit_id, can_vote, units(code, alicuota)").eq("resident_id", residentId)
  const l = (links ?? []) as PortalLink[]
  return {
    supabase,
    residentId,
    branchId: (resident as { branch_id: string }).branch_id,
    resident: resident as PortalResident["resident"],
    links: l,
    unitIds: l.map((x) => x.unit_id).filter(Boolean),
  }
}

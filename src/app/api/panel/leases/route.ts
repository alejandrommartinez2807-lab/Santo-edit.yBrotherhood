import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) {
  return String(v ?? "").trim()
}
function num(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
function int(v: unknown, fallback = 0) {
  return Math.trunc(num(v, fallback))
}
function dateOrNull(v: unknown) {
  const s = text(v)
  return s || null
}

// GET: contratos de arrendamiento + locales y comerciantes (para el formulario).
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, leases: [], units: [], residents: [] })
    const supabase = getSupabaseAdmin()
    const [leasesRes, unitsRes, resRes] = await Promise.all([
      supabase
        .from("leases")
        .select("*, units(code, commercial_name), residents(full_name)")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false }),
      supabase
        .from("units")
        .select("id, code, commercial_name, activity, status")
        .eq("branch_id", branchId)
        .order("code", { ascending: true }),
      supabase
        .from("residents")
        .select("id, full_name")
        .eq("branch_id", branchId)
        .order("full_name", { ascending: true }),
    ])
    if (leasesRes.error) throw new Error(leasesRes.error.message)
    return NextResponse.json({
      ok: true,
      leases: leasesRes.data ?? [],
      units: unitsRes.data ?? [],
      residents: resRes.data ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los contratos" },
      { status: 500 },
    )
  }
}

// POST: alta/edición de contrato de arrendamiento.
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "No hay centro comercial configurado" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    const unitId = text(body.unitId)
    if (!unitId) return NextResponse.json({ error: "Elige el local del contrato" }, { status: 400 })

    const row = {
      branch_id: branchId,
      unit_id: unitId,
      resident_id: text(body.residentId) || null,
      code: text(body.code),
      status: text(body.status) || "borrador",
      starts_on: dateOrNull(body.startsOn),
      ends_on: dateOrNull(body.endsOn),
      canon_amount: num(body.canonAmount),
      canon_currency: text(body.canonCurrency) || "USD",
      condo_included: !!body.condoIncluded,
      billing_day: int(body.billingDay, 1),
      due_day: int(body.dueDay, 5),
      grace_days: int(body.graceDays, 0),
      late_fee_percent: num(body.lateFeePercent),
      deposit_amount: num(body.depositAmount),
      deposit_currency: text(body.depositCurrency) || "USD",
      deposit_held: !!body.depositHeld,
      percentage_rent: !!body.percentageRent,
      percentage_rent_rate: num(body.percentageRentRate),
      percentage_rent_min: num(body.percentageRentMin),
      auto_renew: !!body.autoRenew,
      renewal_notice_days: int(body.renewalNoticeDays, 60),
      guarantor_name: text(body.guarantorName),
      guarantor_phone: text(body.guarantorPhone),
      notes: text(body.notes),
    }

    if (body.id) {
      const { data, error } = await supabase
        .from("leases")
        .update(row)
        .eq("id", body.id)
        .eq("branch_id", branchId)
        .select("*, units(code, commercial_name), residents(full_name)")
        .maybeSingle()
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, lease: data })
    }
    const { data, error } = await supabase
      .from("leases")
      .insert(row)
      .select("*, units(code, commercial_name), residents(full_name)")
      .maybeSingle()
    if (error) throw new Error(error.message)

    // Si el local queda con contrato activo, márcalo ocupado.
    if (row.status === "activo") {
      await supabase.from("units").update({ status: "ocupado" }).eq("id", unitId).eq("branch_id", branchId)
    }
    return NextResponse.json({ ok: true, lease: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el contrato" },
      { status: 500 },
    )
  }
}

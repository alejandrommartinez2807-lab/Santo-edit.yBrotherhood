import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"
import { computeParkingFee } from "@/lib/parkingFee"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }
function num(v: unknown, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f }
function int(v: unknown, f = 0) { return Math.trunc(num(v, f)) }

function genCode() {
  const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let c = ""
  for (let i = 0; i < 5; i++) c += s[Math.floor(Math.random() * s.length)]
  return "P-" + c
}

async function getConfig(supabase: ReturnType<typeof getSupabaseAdmin>, branchId: string) {
  const { data } = await supabase.from("parking_config").select("*").eq("branch_id", branchId).maybeSingle()
  return data || { branch_id: branchId, free_minutes: 15, rate_per_hour: 1, rate_currency: "USD", daily_cap: 0, grace_exit_minutes: 15 }
}

// GET: config + tickets abiertos/por pagar + abonos.
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, config: null, tickets: [], passes: [] })
    const supabase = getSupabaseAdmin()
    const [cfg, ticketsRes, passesRes] = await Promise.all([
      getConfig(supabase, branchId),
      supabase.from("parking_tickets").select("*").eq("branch_id", branchId).order("entered_at", { ascending: false }).limit(200),
      supabase.from("parking_passes").select("*").eq("branch_id", branchId).order("created_at", { ascending: false }),
    ])
    const now = Date.now()
    const tickets = (ticketsRes.data ?? []).map((t) => {
      if (t.status === "abierto") {
        const { minutes, amount } = computeParkingFee(t.entered_at, now, cfg)
        return { ...t, live_minutes: minutes, live_amount: amount }
      }
      return t
    })
    const open = tickets.filter((t) => t.status === "abierto" || t.status === "por_pagar").length
    return NextResponse.json({ ok: true, config: cfg, tickets, passes: passesRes.data ?? [], openCount: open })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "Sin centro comercial" }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const action = text(body.action)

    if (action === "saveConfig") {
      const row = {
        branch_id: branchId,
        free_minutes: int(body.freeMinutes, 15),
        rate_per_hour: num(body.ratePerHour, 1),
        rate_currency: text(body.rateCurrency) || "USD",
        daily_cap: num(body.dailyCap, 0),
        grace_exit_minutes: int(body.graceExitMinutes, 15),
      }
      const { error } = await supabase.from("parking_config").upsert(row, { onConflict: "branch_id" })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    if (action === "entry") {
      // Genera un código único (reintenta ante colisión).
      let code = genCode()
      for (let i = 0; i < 5; i++) {
        const { data: dup } = await supabase.from("parking_tickets").select("id").eq("branch_id", branchId).eq("code", code).maybeSingle()
        if (!dup) break
        code = genCode()
      }
      const cfg = await getConfig(supabase, branchId)
      const { data, error } = await supabase.from("parking_tickets").insert({
        branch_id: branchId, code, plate: text(body.plate).toUpperCase(), vehicle_type: text(body.vehicleType) || "carro",
        currency: cfg.rate_currency || "USD", status: "abierto",
      }).select().maybeSingle()
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, ticket: data }, { status: 201 })
    }

    if (action === "close") {
      // Cobro/salida: calcula minutos y monto; cortesía o pago.
      const id = text(body.ticketId)
      if (!id) return NextResponse.json({ error: "Falta el ticket" }, { status: 400 })
      const { data: t } = await supabase.from("parking_tickets").select("*").eq("id", id).eq("branch_id", branchId).maybeSingle()
      if (!t) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 })
      const cfg = await getConfig(supabase, branchId)
      const now = Date.now()
      const { minutes, amount } = computeParkingFee(t.entered_at, now, cfg)
      const courtesy = text(body.courtesyBy)
      const update: Record<string, unknown> = {
        exited_at: new Date(now).toISOString(), minutes,
        amount: courtesy ? 0 : amount,
        status: courtesy ? "cortesia" : "pagado",
        paid_at: new Date(now).toISOString(),
        paid_method: courtesy ? "" : (text(body.method) || "efectivo"),
        validated_by: courtesy,
      }
      const { error } = await supabase.from("parking_tickets").update(update).eq("id", id).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, minutes, amount: courtesy ? 0 : amount })
    }

    if (action === "void") {
      const id = text(body.ticketId)
      const { error } = await supabase.from("parking_tickets").update({ status: "anulado" }).eq("id", id).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    if (action === "pass") {
      const row = {
        branch_id: branchId,
        plate: text(body.plate).toUpperCase(),
        holder_name: text(body.holderName),
        unit_id: text(body.unitId) || null,
        valid_from: text(body.validFrom) || null,
        valid_to: text(body.validTo) || null,
        monthly_fee: num(body.monthlyFee, 0),
        active: body.active === undefined ? true : !!body.active,
        notes: text(body.notes),
      }
      if (body.id) {
        const { error } = await supabase.from("parking_passes").update(row).eq("id", body.id).eq("branch_id", branchId)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }
      const { error } = await supabase.from("parking_passes").insert(row)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

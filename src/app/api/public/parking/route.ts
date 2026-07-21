import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { computeParkingFee } from "@/lib/parkingFee"
import { computeIgtfOnDivisa } from "@/lib/fiscal"
import { getBusinessConfig } from "@/lib/ordersBusinessConfig"
import { enforceRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }

// IGTF + estado fiscal del centro comercial (config global). Si falla, inactivo.
async function loadIgtf(): Promise<{ enabled: boolean; rate: number; fiscalEnabled: boolean }> {
  try {
    const cfg = await getBusinessConfig()
    return {
      enabled: cfg.igtfEnabled !== false,
      rate: Number.isFinite(Number(cfg.igtfRate)) ? Number(cfg.igtfRate) : 3,
      fiscalEnabled: cfg.fiscalEnabled === true,
    }
  } catch {
    return { enabled: false, rate: 0, fiscalEnabled: false }
  }
}

// El IGTF (3%) aplica sólo a pagos en divisas en efectivo (tarifa en USD +
// método "efectivo"). Pago móvil / tarjeta / transferencia (bolívares) no lo llevan.
function isDivisaCash(currency: string, method: string): boolean {
  return (currency || "USD") === "USD" && method === "efectivo"
}

function genCode() {
  const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let c = ""
  for (let i = 0; i < 5; i++) c += s[Math.floor(Math.random() * s.length)]
  return "P-" + c
}

// GET ?code=P-XXXXX : el cliente escanea el QR del ticket y ve cuánto debe.
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const code = String(url.searchParams.get("code") ?? "").trim().toUpperCase()
    if (!code) return NextResponse.json({ ok: false, error: "Falta el código" }, { status: 400 })
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: false, error: "No disponible" }, { status: 404 })
    const supabase = getSupabaseAdmin()
    const { data: t } = await supabase
      .from("parking_tickets")
      .select("code, plate, entered_at, exited_at, minutes, amount, currency, status")
      .eq("branch_id", branchId)
      .eq("code", code)
      .maybeSingle()
    if (!t) return NextResponse.json({ ok: false, error: "Ticket no encontrado" }, { status: 404 })

    const { data: cfg } = await supabase.from("parking_config").select("free_minutes, rate_per_hour, daily_cap, rate_currency").eq("branch_id", branchId).maybeSingle()
    const config = cfg || { free_minutes: 15, rate_per_hour: 1, daily_cap: 0, rate_currency: "USD" }

    let minutes = t.minutes
    let amount = t.amount
    if (t.status === "abierto") {
      const live = computeParkingFee(t.entered_at, Date.now(), config)
      minutes = live.minutes
      amount = live.amount
    }
    const igtf = await loadIgtf()
    return NextResponse.json({
      ok: true,
      code: t.code, plate: t.plate, status: t.status,
      enteredAt: t.entered_at, exitedAt: t.exited_at,
      minutes, amount, currency: t.currency || config.rate_currency || "USD",
      // Para que el cliente muestre el desglose si paga en divisas efectivo.
      igtf: { enabled: igtf.enabled, rate: igtf.rate },
      nonFiscal: !igtf.fiscalEnabled,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

// POST: autoservicio del cliente (sin caja, sin cuenta).
//   action "checkin" : el cliente que acaba de llegar genera su propio ticket/QR.
//   action "pay"     : el cliente reporta su pago desde el teléfono (queda
//                      "por_pagar" hasta que un asesor lo confirma en la salida).
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = text(body.action)
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: false, error: "No disponible" }, { status: 404 })
    const supabase = getSupabaseAdmin()

    if (action === "checkin") {
      const limited = enforceRateLimit(request, {
        id: "api-public-parking-checkin",
        limit: 8,
        windowMs: 60_000,
        message: "Demasiados tickets seguidos. Espera un momento e intenta de nuevo.",
      })
      if (limited) return limited

      const { data: cfg } = await supabase.from("parking_config").select("rate_currency").eq("branch_id", branchId).maybeSingle()
      const currency = cfg?.rate_currency || "USD"

      // Código único (reintenta ante colisión).
      let code = genCode()
      for (let i = 0; i < 6; i++) {
        const { data: dup } = await supabase.from("parking_tickets").select("id").eq("branch_id", branchId).eq("code", code).maybeSingle()
        if (!dup) break
        code = genCode()
      }
      const { data, error } = await supabase
        .from("parking_tickets")
        .insert({
          branch_id: branchId,
          code,
          plate: text(body.plate).toUpperCase().slice(0, 12),
          vehicle_type: ["carro", "moto", "otro"].includes(text(body.vehicleType)) ? text(body.vehicleType) : "carro",
          currency,
          status: "abierto",
          notes: "Autoservicio (cliente)",
        })
        .select("code, plate, entered_at, currency, status")
        .maybeSingle()
      if (error) throw new Error(error.message)
      const igtf = await loadIgtf()
      return NextResponse.json({ ok: true, ...data, igtf: { enabled: igtf.enabled, rate: igtf.rate }, nonFiscal: !igtf.fiscalEnabled }, { status: 201 })
    }

    if (action === "pay") {
      const limited = enforceRateLimit(request, {
        id: "api-public-parking-pay",
        limit: 12,
        windowMs: 60_000,
        message: "Demasiados intentos. Espera un momento e intenta de nuevo.",
      })
      if (limited) return limited

      const code = text(body.code).toUpperCase()
      const ALLOWED_METHODS = ["pago_movil", "tarjeta", "efectivo", "transferencia"]
      const method = ALLOWED_METHODS.includes(text(body.method)) ? text(body.method) : "pago_movil"
      const reference = text(body.reference).slice(0, 60)
      if (!code) return NextResponse.json({ ok: false, error: "Falta el código" }, { status: 400 })

      const { data: t } = await supabase
        .from("parking_tickets")
        .select("id, entered_at, amount, currency, status, notes")
        .eq("branch_id", branchId)
        .eq("code", code)
        .maybeSingle()
      if (!t) return NextResponse.json({ ok: false, error: "Ticket no encontrado" }, { status: 404 })
      if (t.status === "pagado" || t.status === "cortesia") {
        return NextResponse.json({ ok: true, alreadySettled: true, status: t.status })
      }
      // Un ticket anulado no admite pago; el cliente debe hablar con el personal.
      if (t.status === "anulado") {
        return NextResponse.json({ ok: false, error: "Este ticket fue anulado. Acércate a la caseta de estacionamiento." }, { status: 409 })
      }

      const { data: cfg } = await supabase.from("parking_config").select("free_minutes, rate_per_hour, daily_cap, rate_currency").eq("branch_id", branchId).maybeSingle()
      const config = cfg || { free_minutes: 15, rate_per_hour: 1, daily_cap: 0, rate_currency: "USD" }
      const { minutes, amount } = computeParkingFee(t.entered_at, Date.now(), config)
      const currency = t.currency || config.rate_currency || "USD"

      // IGTF (3%) sólo si paga en divisas efectivo. Se muestra y se anota; el
      // documento fiscal oficial lo emite la máquina fiscal en la caseta.
      const igtfCfg = await loadIgtf()
      const igtf = isDivisaCash(currency, method)
        ? computeIgtfOnDivisa(amount, { igtfEnabled: igtfCfg.enabled, igtfRate: igtfCfg.rate })
        : 0
      const total = Math.round((amount + igtf) * 100) / 100

      const igtfNote = igtf > 0 ? ` · IGTF ${igtfCfg.rate}% ${igtf} · total ${total}` : ""
      const note = `Pago reportado por el cliente · ${method}${reference ? ` · ref ${reference}` : ""}${igtfNote}`
      const { error } = await supabase
        .from("parking_tickets")
        .update({
          status: "por_pagar",
          minutes,
          amount,
          paid_method: method,
          notes: t.notes ? `${t.notes} — ${note}` : note,
        })
        .eq("branch_id", branchId)
        .eq("code", code)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, minutes, amount, igtf, total, currency, igtfRate: igtfCfg.rate, nonFiscal: !igtfCfg.fiscalEnabled })
    }

    return NextResponse.json({ ok: false, error: "Acción no soportada" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

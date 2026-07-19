import type { Metadata } from "next"
import { BRAND } from "@/lib/brand"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { computeParkingFee } from "@/lib/parkingFee"

export const metadata: Metadata = { title: `Estacionamiento · ${BRAND.name}` }
export const dynamic = "force-dynamic"

type Ticket = { code: string; plate: string; status: string; entered_at: string; minutes: number; amount: number; currency: string }

async function lookup(code: string): Promise<Ticket | null> {
  try {
    const supabase = getSupabaseAdmin()
    const { data: branch } = await supabase.from("branches").select("id").order("sort_order").limit(1).maybeSingle()
    const branchId = branch?.id
    if (!branchId) return null
    const { data: t } = await supabase.from("parking_tickets").select("code, plate, status, entered_at, minutes, amount, currency").eq("branch_id", branchId).eq("code", code).maybeSingle()
    if (!t) return null
    if (t.status === "abierto") {
      const { data: cfg } = await supabase.from("parking_config").select("free_minutes, rate_per_hour, daily_cap").eq("branch_id", branchId).maybeSingle()
      const live = computeParkingFee(t.entered_at, Date.now(), cfg || { free_minutes: 15, rate_per_hour: 1, daily_cap: 0 })
      return { ...(t as Ticket), minutes: live.minutes, amount: live.amount }
    }
    return t as Ticket
  } catch { return null }
}

export default async function ParkingPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const sp = await searchParams
  const code = String(sp.code ?? "").trim().toUpperCase()
  const ticket = code ? await lookup(code) : null
  const sym = (ticket?.currency || "USD") === "VES" ? "Bs" : "$"
  const wa = ticket
    ? `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(`Hola, pago de estacionamiento — ticket ${ticket.code}, placa ${ticket.plate}, monto ${sym}${ticket.amount}.`)}`
    : `https://wa.me/${BRAND.whatsapp}`

  return (
    <div style={{ minHeight: "100vh", background: "#0f9bd7", color: "#fff", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", color: "#163243", borderRadius: 20, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/concepto-logo.png" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{BRAND.name}</div>
            <div style={{ fontSize: 12, color: "#5b6b82" }}>Estacionamiento</div>
          </div>
        </div>

        {!code && (
          <form method="get" style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0, color: "#5b6b82", fontSize: 14 }}>Escanea el QR de tu ticket o escribe el código para ver cuánto debes.</p>
            <input name="code" placeholder="P-XXXXX" style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #cfe6f2", fontSize: 16, textTransform: "uppercase" }} />
            <button type="submit" style={{ background: "#0f9bd7", color: "#fff", border: 0, borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 15 }}>Consultar</button>
          </form>
        )}

        {code && !ticket && (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 40 }}>🔍</div>
            <p style={{ color: "#c0392b", fontWeight: 700, margin: "8px 0" }}>Ticket «{code}» no encontrado.</p>
            <a href="/estacionamiento" style={{ color: "#0a6f9c", fontWeight: 700 }}>Intentar otro código</a>
          </div>
        )}

        {ticket && (
          <div>
            <div style={{ textAlign: "center", background: "#f6fbfe", borderRadius: 16, padding: "18px 14px", border: "1px solid #eaf3f8" }}>
              <div style={{ fontSize: 13, color: "#5b6b82" }}>Ticket {ticket.code}{ticket.plate ? ` · ${ticket.plate}` : ""}</div>
              <div style={{ fontSize: 44, fontWeight: 800, margin: "6px 0", color: "#0a6f9c" }}>{sym}{ticket.amount}</div>
              <div style={{ fontSize: 13, color: "#5b6b82" }}>
                {ticket.status === "abierto" ? `${fmt(ticket.minutes)} en el estacionamiento` :
                  ticket.status === "pagado" ? "✅ Pagado" :
                    ticket.status === "cortesia" ? "🎁 Cortesía" : ticket.status}
              </div>
            </div>
            {ticket.status === "abierto" && (
              <>
                <a href={wa} target="_blank" rel="noopener" style={{ display: "block", textAlign: "center", background: "#25D366", color: "#fff", textDecoration: "none", borderRadius: 12, padding: "13px", fontWeight: 700, marginTop: 14 }}>Reportar mi pago por WhatsApp</a>
                <p style={{ fontSize: 12, color: "#8494a8", textAlign: "center", marginTop: 10 }}>El monto puede aumentar mientras el vehículo permanezca dentro.</p>
              </>
            )}
            <div style={{ textAlign: "center", marginTop: 12 }}><a href="/estacionamiento" style={{ color: "#0a6f9c", fontSize: 13 }}>Consultar otro ticket</a></div>
          </div>
        )}
      </div>
    </div>
  )
}

function fmt(m: number) { const h = Math.floor(m / 60); const mm = m % 60; return h > 0 ? `${h}h ${mm}m` : `${mm} min` }

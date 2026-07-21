"use client"

import { useEffect, useState } from "react"

type Ticket = {
  code: string
  plate: string
  status: string
  minutes: number
  amount: number
  currency: string
  enteredAt?: string
}

const C = {
  bg: "#0f9bd7",
  ink: "#163243",
  soft: "#5b6b82",
  line: "#cfe6f2",
  accent: "#0a6f9c",
  green: "#25D366",
}

function qrUrl(data: string, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&ecc=H&data=${encodeURIComponent(data)}`
}
function sym(cur?: string) {
  return (cur || "USD") === "VES" ? "Bs" : "$"
}
function fmtMin(m: number) {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return h > 0 ? `${h}h ${mm}m` : `${mm} min`
}

const METHODS = [
  { key: "pago_movil", label: "Pago móvil" },
  { key: "tarjeta", label: "Tarjeta" },
  { key: "efectivo", label: "Efectivo en caja" },
  { key: "transferencia", label: "Transferencia" },
]

export default function ParkingApp({
  initialCode,
  startNew,
  whatsapp,
  brandName,
  logo,
}: {
  initialCode: string
  startNew: boolean
  whatsapp: string
  brandName: string
  logo: string
}) {
  // screen: 'home' | 'checkin' | 'ticket'
  const [screen, setScreen] = useState<"home" | "checkin" | "ticket">(initialCode ? "ticket" : startNew ? "checkin" : "home")
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [codeInput, setCodeInput] = useState(initialCode || "")
  const [plate, setPlate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Pago
  const [method, setMethod] = useState("pago_movil")
  const [reference, setReference] = useState("")
  const [paid, setPaid] = useState(false)
  const [igtf, setIgtf] = useState<{ enabled: boolean; rate: number }>({ enabled: false, rate: 0 })

  useEffect(() => {
    if (initialCode) void lookup(initialCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const ticketLink = (code: string) => `${origin}/estacionamiento?code=${code}`

  async function lookup(code: string) {
    const c = code.trim().toUpperCase()
    if (!c) return
    setLoading(true)
    setError("")
    setPaid(false)
    try {
      const res = await fetch(`/api/public/parking?code=${encodeURIComponent(c)}`, { cache: "no-store" })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || "Ticket no encontrado")
        setTicket(null)
      } else {
        setTicket(data as Ticket)
        setIgtf(data.igtf || { enabled: false, rate: 0 })
        setScreen("ticket")
      }
    } catch {
      setError("No pudimos consultar. Revisa tu conexión.")
    } finally {
      setLoading(false)
    }
  }

  async function checkin() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/public/parking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin", plate }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || "No pudimos generar el ticket")
      } else {
        setTicket({ code: data.code, plate: data.plate || "", status: "abierto", minutes: 0, amount: 0, currency: data.currency, enteredAt: data.entered_at })
        setIgtf(data.igtf || { enabled: false, rate: 0 })
        setCodeInput(data.code)
        setScreen("ticket")
      }
    } catch {
      setError("No pudimos generar el ticket. Revisa tu conexión.")
    } finally {
      setLoading(false)
    }
  }

  async function reportPay() {
    if (!ticket) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/public/parking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", code: ticket.code, method, reference }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || "No pudimos registrar el pago")
      } else {
        setPaid(true)
        setTicket({ ...ticket, status: "por_pagar", amount: data.amount ?? ticket.amount, minutes: data.minutes ?? ticket.minutes })
      }
    } catch {
      setError("No pudimos registrar el pago. Revisa tu conexión.")
    } finally {
      setLoading(false)
    }
  }

  const wa = (msg: string) => `https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`

  // IGTF (3%): sólo si paga en divisas efectivo (tarifa en $ + método "efectivo").
  const showIgtf = !!ticket && igtf.enabled && method === "efectivo" && (ticket.currency || "USD") !== "VES" && ticket.amount > 0
  const igtfAmt = showIgtf && ticket ? Math.round(ticket.amount * igtf.rate) / 100 : 0
  const totalWithIgtf = ticket ? Math.round((ticket.amount + igtfAmt) * 100) / 100 : 0

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", color: C.ink, borderRadius: 20, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        {/* Encabezado */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={40} height={40} style={{ borderRadius: 10 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{brandName}</div>
            <div style={{ fontSize: 12, color: C.soft }}>Estacionamiento</div>
          </div>
          {screen !== "home" && (
            <button onClick={() => { setScreen("home"); setTicket(null); setError(""); setPaid(false); setCodeInput("") }} style={{ marginLeft: "auto", border: 0, background: "#f2f9fd", color: C.accent, borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>← Inicio</button>
          )}
        </div>

        {error && (
          <div style={{ background: "#fdecea", color: "#c0392b", borderRadius: 12, padding: "10px 14px", fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{error}</div>
        )}

        {/* HOME: dos caminos */}
        {screen === "home" && (
          <div style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0, color: C.soft, fontSize: 14 }}>¿Qué necesitas hacer?</p>
            <button onClick={() => { setScreen("checkin"); setError("") }} style={bigBtn(C.bg)}>
              <span style={{ fontSize: 26 }}>🅿️</span>
              <span><b>Acabo de llegar</b><br /><span style={{ fontWeight: 400, fontSize: 13, opacity: 0.9 }}>Generar mi ticket</span></span>
            </button>
            <button onClick={() => { setScreen("ticket"); setTicket(null); setError("") }} style={bigBtn(C.accent)}>
              <span style={{ fontSize: 26 }}>🎟️</span>
              <span><b>Ya tengo un ticket</b><br /><span style={{ fontWeight: 400, fontSize: 13, opacity: 0.9 }}>Consultar y pagar</span></span>
            </button>
          </div>
        )}

        {/* CHECK-IN */}
        {screen === "checkin" && (
          <div style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0, color: C.soft, fontSize: 14 }}>Genera tu ticket al entrar. Guárdalo o toma captura: lo mostrarás al salir.</p>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.soft }}>Placa (opcional)</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="AB123CD" style={inp} />
            <button onClick={checkin} disabled={loading} style={primary}>{loading ? "Generando…" : "Generar mi ticket"}</button>
          </div>
        )}

        {/* TICKET: consulta / recién generado / pago */}
        {screen === "ticket" && !ticket && (
          <form onSubmit={(e) => { e.preventDefault(); void lookup(codeInput) }} style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0, color: C.soft, fontSize: 14 }}>Escanea el QR de tu ticket o escribe el código.</p>
            <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} name="code" placeholder="P-XXXXX" style={{ ...inp, textTransform: "uppercase" }} />
            <button type="submit" disabled={loading} style={primary}>{loading ? "Consultando…" : "Consultar"}</button>
          </form>
        )}

        {screen === "ticket" && ticket && (
          <div>
            {/* QR + código */}
            <div style={{ textAlign: "center", background: "#f6fbfe", borderRadius: 16, padding: "16px 14px", border: "1px solid #eaf3f8" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl(ticketLink(ticket.code))} alt={`QR ${ticket.code}`} width={168} height={168} style={{ width: 168, height: 168 }} />
              <div style={{ fontSize: 13, color: C.soft, marginTop: 4 }}>Ticket <b style={{ color: C.ink }}>{ticket.code}</b>{ticket.plate ? ` · ${ticket.plate}` : ""}</div>
            </div>

            {/* Monto */}
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: C.accent, lineHeight: 1 }}>{sym(ticket.currency)}{ticket.amount}</div>
              <div style={{ fontSize: 13, color: C.soft, marginTop: 4 }}>
                {ticket.status === "abierto" && `${fmtMin(ticket.minutes)} en el estacionamiento`}
                {ticket.status === "por_pagar" && "🕓 Pago reportado — se confirma en la salida"}
                {ticket.status === "pagado" && "✅ Pagado"}
                {ticket.status === "cortesia" && "🎁 Cortesía"}
              </div>
            </div>

            {/* Estado abierto/por_pagar → registrar pago */}
            {(ticket.status === "abierto" || ticket.status === "por_pagar") && !paid && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Registrar mi pago</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {METHODS.map((m) => (
                    <button key={m.key} onClick={() => setMethod(m.key)} style={{ border: `1px solid ${method === m.key ? C.bg : C.line}`, background: method === m.key ? C.bg : "#fff", color: method === m.key ? "#fff" : C.ink, borderRadius: 999, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{m.label}</button>
                  ))}
                </div>
                {method !== "efectivo" && (
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referencia / últimos 4 dígitos (opcional)" style={{ ...inp, marginBottom: 10 }} />
                )}
                {showIgtf && (
                  <div style={{ background: "#f6fbfe", border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 10, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: C.soft }}><span>Tarifa</span><span>{sym(ticket.currency)}{ticket.amount}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: C.soft }}><span>IGTF {igtf.rate}% (pago en divisas)</span><span>{sym(ticket.currency)}{igtfAmt}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginTop: 4, borderTop: `1px solid ${C.line}`, paddingTop: 4 }}><span>Total</span><span>{sym(ticket.currency)}{totalWithIgtf}</span></div>
                  </div>
                )}
                <button onClick={reportPay} disabled={loading} style={primary}>{loading ? "Registrando…" : "Registrar mi pago"}</button>
                <a href={wa(`Hola, pago de estacionamiento — ticket ${ticket.code}${ticket.plate ? `, placa ${ticket.plate}` : ""}, monto ${sym(ticket.currency)}${showIgtf ? totalWithIgtf : ticket.amount}${showIgtf ? ` (incluye IGTF ${igtf.rate}%)` : ""}.`)} target="_blank" rel="noopener" style={{ display: "block", textAlign: "center", background: C.green, color: "#fff", textDecoration: "none", borderRadius: 12, padding: "12px", fontWeight: 700, marginTop: 10 }}>Enviar comprobante por WhatsApp</a>
                <p style={{ fontSize: 12, color: "#8494a8", textAlign: "center", marginTop: 10 }}>El monto puede aumentar mientras el vehículo permanezca dentro.{igtf.enabled ? " El IGTF (3%) aplica al pagar en divisas en efectivo." : ""}</p>
              </div>
            )}

            {/* Pago recién reportado */}
            {paid && (
              <div style={{ marginTop: 16, textAlign: "center", background: "#eafaf1", color: "#1e874b", borderRadius: 12, padding: "14px" }}>
                <div style={{ fontSize: 32 }}>✅</div>
                <p style={{ margin: "6px 0 0", fontWeight: 700 }}>¡Pago registrado!</p>
                <p style={{ margin: "4px 0 0", fontSize: 13 }}>Muestra este código en la salida. Un asesor lo confirma.</p>
              </div>
            )}

            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={() => { setTicket(null); setError(""); setPaid(false); setCodeInput("") }} style={{ border: 0, background: "transparent", color: C.accent, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Consultar otro ticket</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.line}`, fontSize: 16, width: "100%", boxSizing: "border-box" }
const primary: React.CSSProperties = { background: C.bg, color: "#fff", border: 0, borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%" }
function bigBtn(bg: string): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 14, textAlign: "left", background: bg, color: "#fff", border: 0, borderRadius: 14, padding: "16px 18px", fontSize: 15, cursor: "pointer" }
}

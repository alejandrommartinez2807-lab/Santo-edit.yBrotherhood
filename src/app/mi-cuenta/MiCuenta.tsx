"use client"

import { useCallback, useEffect, useState } from "react"

// Portal del residente: login por teléfono + código, y su cuenta completa
// (unidades, saldo, recibos, cargos y pagos).

const TOKEN_KEY = "palulu_res_token"

type UnitLink = {
  id: string
  role: string
  is_primary: boolean
  receives_billing: boolean
  units?: { id: string; code: string; tower: string; floor: string; area_m2: number; alicuota: number; balance: number; status: string } | null
}
type Charge = { id: string; unit_id: string; concept: string; description: string; amount: number; amount_paid: number; status: string; due_date: string | null; created_at: string }
type Payment = { id: string; unit_id: string; amount: number; amount_local: number; method: string; reference: string; status: string; paid_on: string }
type Receipt = { id: string; number: number; new_balance: number; charges_total: number; payments_total: number; status: string; issued_at: string }
type Account = { resident: { full_name: string; phone: string; email: string }; units: UnitLink[]; charges: Charge[]; payments: Payment[]; receipts: Receipt[] }

function money(n: number) {
  return `$${(Number(n) || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function MiCuenta() {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY))
    setReady(true)
  }, [])

  if (!ready) return null
  if (!token) return <Login onToken={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t) }} />
  return <Dashboard token={token} onLogout={() => { localStorage.removeItem(TOKEN_KEY); setToken(null) }} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: "#f4f7fb", color: "#0a1a30", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" }}>{children}</div>
}

function Login({ onToken }: { onToken: (t: string) => void }) {
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(""); setLoading(true)
    try {
      const res = await fetch("/api/portal/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "No se pudo entrar")
      onToken(data.token)
    } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }

  return (
    <Shell>
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "linear-gradient(160deg,#0a1a30,#1554b8)" }}>
        <form onSubmit={submit} style={{ background: "#fff", borderRadius: 20, padding: 30, width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(10,26,48,.35)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/palulu-mark.svg" alt="" width={44} height={44} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Mi cuenta</div>
              <div style={{ fontSize: 12, color: "#5b6b82" }}>Apartamentos Palulu</div>
            </div>
          </div>
          <label style={lbl}>Teléfono</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+58 412 …" style={inp} autoFocus />
          <label style={{ ...lbl, marginTop: 12 }}>Código de acceso</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 dígitos" style={inp} inputMode="numeric" />
          {err && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>{err}</div>}
          <button type="submit" disabled={loading} style={{ ...btn, width: "100%", marginTop: 16 }}>{loading ? "Entrando…" : "Entrar"}</button>
          <p style={{ fontSize: 12, color: "#8494a8", marginTop: 12, textAlign: "center" }}>¿No tienes código? Pídeselo a la administración.</p>
        </form>
      </div>
    </Shell>
  )
}

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [acc, setAcc] = useState<Account | null>(null)
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/account", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) { onLogout(); return }
      if (!res.ok) throw new Error(data?.error || "Error")
      setAcc(data as Account)
    } catch (e) { setErr(String((e as Error).message)) }
  }, [token, onLogout])
  useEffect(() => { load() }, [load])

  const totalDue = acc?.units.reduce((s, l) => s + Math.max(0, Number(l.units?.balance || 0)), 0) ?? 0
  const pendingCharges = acc?.charges.filter((c) => c.status !== "pagado" && c.status !== "anulado") ?? []

  return (
    <Shell>
      <header style={{ background: "#0a1a30", color: "#fff", padding: "12px 16px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/palulu-mark.svg" alt="" width={32} height={32} />
          <strong>Mi cuenta</strong>
          {acc && <span style={{ fontSize: 13, opacity: 0.75 }}>· {acc.resident.full_name}</span>}
          <button onClick={onLogout} style={{ marginLeft: "auto", background: "rgba(255,255,255,.12)", color: "#fff", border: 0, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>Salir</button>
        </div>
      </header>

      <main style={{ maxWidth: 820, margin: "0 auto", padding: "20px 16px" }}>
        {err && <div style={{ background: "#fdecea", color: "#c0392b", padding: 12, borderRadius: 10, marginBottom: 12 }}>{err}</div>}
        {!acc ? <p style={{ color: "#5b6b82" }}>Cargando tu información…</p> : (
          <>
            {/* Saldo grande */}
            <div style={{ ...card, background: totalDue > 0 ? "linear-gradient(120deg,#1554b8,#2f80ed)" : "linear-gradient(120deg,#1e874b,#2fa968)", color: "#fff", marginBottom: 16 }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{totalDue > 0 ? "Saldo pendiente" : "Estás al día"}</div>
              <div style={{ fontSize: 36, fontWeight: 800, marginTop: 4 }}>{money(totalDue)}</div>
              {totalDue > 0 && <button style={{ ...btn, background: "#fff", color: "#1554b8", marginTop: 10 }} onClick={() => alert("El reporte de pago en línea se activa en la próxima fase.")}>Reportar mi pago</button>}
            </div>

            {/* Unidades */}
            <Section title="Mis unidades">
              {acc.units.length === 0 ? <Empty text="Aún no tienes unidades asociadas." /> : acc.units.map((l) => (
                <div key={l.id} style={row}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{l.units?.code} {l.units?.tower ? `· Torre ${l.units.tower}` : ""}</div>
                    <div style={{ fontSize: 13, color: "#5b6b82" }}>{l.role} · alícuota {(Number(l.units?.alicuota || 0) * 100).toLocaleString("es-VE", { maximumFractionDigits: 4 })} %</div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: Number(l.units?.balance || 0) > 0 ? "#c0392b" : "#1e874b" }}>{money(Number(l.units?.balance || 0))}</div>
                    <div style={{ fontSize: 12, color: "#8494a8" }}>saldo</div>
                  </div>
                </div>
              ))}
            </Section>

            {/* Cargos pendientes */}
            <Section title="Cargos pendientes">
              {pendingCharges.length === 0 ? <Empty text="No tienes cargos pendientes." /> : pendingCharges.map((c) => (
                <div key={c.id} style={row}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.description || c.concept}</div>
                    <div style={{ fontSize: 12, color: "#8494a8" }}>{c.due_date ? `Vence ${c.due_date}` : ""}</div>
                  </div>
                  <div style={{ marginLeft: "auto", fontWeight: 700 }}>{money(Number(c.amount) - Number(c.amount_paid || 0))}</div>
                </div>
              ))}
            </Section>

            {/* Recibos */}
            <Section title="Mis recibos">
              {acc.receipts.length === 0 ? <Empty text="Todavía no hay recibos emitidos." /> : acc.receipts.map((r) => (
                <div key={r.id} style={row}>
                  <div><div style={{ fontWeight: 600 }}>Recibo #{r.number}</div><div style={{ fontSize: 12, color: "#8494a8" }}>{new Date(r.issued_at).toLocaleDateString("es-VE")}</div></div>
                  <div style={{ marginLeft: "auto", fontWeight: 700 }}>{money(r.new_balance)}</div>
                </div>
              ))}
            </Section>

            {/* Pagos */}
            <Section title="Mis pagos">
              {acc.payments.length === 0 ? <Empty text="Aún no hay pagos registrados." /> : acc.payments.map((p) => (
                <div key={p.id} style={row}>
                  <div><div style={{ fontWeight: 600 }}>{money(p.amount)} · {p.method}</div><div style={{ fontSize: 12, color: "#8494a8" }}>{p.reference} · {p.paid_on}</div></div>
                  <div style={{ marginLeft: "auto" }}><span style={{ fontSize: 12, fontWeight: 700, color: p.status === "confirmado" ? "#1e874b" : "#8a5a00" }}>{p.status}</span></div>
                </div>
              ))}
            </Section>
          </>
        )}
      </main>
    </Shell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#16324f", margin: "0 0 8px" }}>{title}</h2>
      <div style={card}>{children}</div>
    </div>
  )
}
function Empty({ text }: { text: string }) {
  return <p style={{ color: "#8494a8", margin: 0, fontSize: 14 }}>{text}</p>
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 6px 20px rgba(10,26,48,.06)" }
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f3f8" }
const inp: React.CSSProperties = { width: "100%", marginTop: 6, padding: "12px 14px", borderRadius: 12, border: "1px solid #d5deeb", fontSize: 15 }
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#16324f" }
const btn: React.CSSProperties = { padding: "12px 18px", borderRadius: 12, border: 0, background: "#1f6feb", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }

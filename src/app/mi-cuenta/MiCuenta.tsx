"use client"

import { useCallback, useEffect, useState } from "react"

// Portal del residente: login por teléfono + código y cuenta completa con
// pestañas (cuenta, reservas, incidencias, avisos, votaciones, visitas, docs).

const TOKEN_KEY = "palulu_res_token"

function money(n: number) {
  return `$${(Number(n) || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function MiCuenta() {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => { setToken(localStorage.getItem(TOKEN_KEY)); setReady(true) }, [])
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
    e.preventDefault(); setErr(""); setLoading(true)
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
            <div><div style={{ fontWeight: 800, fontSize: 17 }}>Mi cuenta</div><div style={{ fontSize: 12, color: "#5b6b82" }}>Apartamentos Palulu</div></div>
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

const TABS = [
  { key: "cuenta", label: "Cuenta", icon: "💳" },
  { key: "reservas", label: "Reservas", icon: "🏊" },
  { key: "incidencias", label: "Incidencias", icon: "🛠️" },
  { key: "avisos", label: "Avisos", icon: "📣" },
  { key: "votar", label: "Votar", icon: "🗳️" },
  { key: "visitas", label: "Visitas", icon: "🚪" },
  { key: "docs", label: "Documentos", icon: "📄" },
] as const
type TabKey = typeof TABS[number]["key"]

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<TabKey>("cuenta")
  const api = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } })
    if (res.status === 401) { onLogout(); throw new Error("Sesión expirada") }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || "Error")
    return data as Record<string, unknown>
  }, [token, onLogout])

  return (
    <Shell>
      <header style={{ background: "#0a1a30", color: "#fff", padding: "12px 16px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/palulu-mark.svg" alt="" width={32} height={32} />
          <strong>Mi cuenta · Apartamentos Palulu</strong>
          <button onClick={onLogout} style={{ marginLeft: "auto", background: "rgba(255,255,255,.12)", color: "#fff", border: 0, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>Salir</button>
        </div>
      </header>
      <nav style={{ background: "#fff", borderBottom: "1px solid #e6ebf3", overflowX: "auto" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", gap: 4, padding: "8px 12px" }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ whiteSpace: "nowrap", border: 0, borderRadius: 999, padding: "8px 14px", cursor: "pointer", fontSize: 14, fontWeight: tab === t.key ? 700 : 500, background: tab === t.key ? "#1f6feb" : "transparent", color: tab === t.key ? "#fff" : "#16324f" }}>{t.icon} {t.label}</button>
          ))}
        </div>
      </nav>
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "18px 16px" }}>
        {tab === "cuenta" && <CuentaTab api={api} />}
        {tab === "reservas" && <ReservasTab api={api} />}
        {tab === "incidencias" && <IncidenciasTab api={api} />}
        {tab === "avisos" && <AvisosTab api={api} />}
        {tab === "votar" && <VotarTab api={api} />}
        {tab === "visitas" && <VisitasTab api={api} />}
        {tab === "docs" && <DocsTab api={api} />}
      </main>
    </Shell>
  )
}

type Api = (p: string, i?: RequestInit) => Promise<Record<string, unknown>>

// ---------- Cuenta ----------
type UnitLink = { id: string; role: string; unit_id: string; units?: { id: string; code: string; tower: string; alicuota: number; balance: number } | null }
type Charge = { id: string; concept: string; description: string; amount: number; amount_paid: number; status: string; due_date: string | null }
type Payment = { id: string; amount: number; method: string; reference: string; status: string; paid_on: string }
type Receipt = { id: string; number: number; new_balance: number; status: string; issued_at: string }

function CuentaTab({ api }: { api: Api }) {
  const [units, setUnits] = useState<UnitLink[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [err, setErr] = useState("")
  const [pay, setPay] = useState(false)
  const [form, setForm] = useState({ unitId: "", amount: "", method: "transferencia", reference: "" })
  const [msg, setMsg] = useState("")
  const load = useCallback(async () => {
    try { const d = await api("/api/portal/account"); setUnits((d.units as UnitLink[]) || []); setCharges((d.charges as Charge[]) || []); setPayments((d.payments as Payment[]) || []); setReceipts((d.receipts as Receipt[]) || []) } catch (e) { setErr(String((e as Error).message)) }
  }, [api])
  useEffect(() => { load() }, [load])
  const totalDue = units.reduce((s, l) => s + Math.max(0, Number(l.units?.balance || 0)), 0)
  const pending = charges.filter((c) => c.status !== "pagado" && c.status !== "anulado")
  async function report(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    try {
      const unitId = form.unitId || units[0]?.unit_id
      await api("/api/portal/report-payment", { method: "POST", body: JSON.stringify({ unitId, amount: Number(form.amount || 0), method: form.method, reference: form.reference }) })
      setPay(false); setForm({ unitId: "", amount: "", method: "transferencia", reference: "" }); setMsg("✓ Pago reportado. La administración lo confirmará.")
    } catch (e) { setErr(String((e as Error).message)) }
  }
  return (
    <div>
      {err && <div style={errBox}>{err}</div>}
      {msg && <div style={{ background: "#e6f4ea", color: "#1e874b", padding: 12, borderRadius: 10, marginBottom: 12 }}>{msg}</div>}
      <div style={{ ...card, background: totalDue > 0 ? "linear-gradient(120deg,#1554b8,#2f80ed)" : "linear-gradient(120deg,#1e874b,#2fa968)", color: "#fff", marginBottom: 16 }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{totalDue > 0 ? "Saldo pendiente" : "Estás al día"}</div>
        <div style={{ fontSize: 36, fontWeight: 800, marginTop: 4 }}>{money(totalDue)}</div>
        {totalDue > 0 && <button onClick={() => { setPay(true); setForm((f) => ({ ...f, amount: String(totalDue) })) }} style={{ ...btn, background: "#fff", color: "#1554b8", marginTop: 10 }}>Reportar mi pago</button>}
      </div>
      <Section title="Mis unidades">
        {units.length === 0 ? <Empty text="Sin unidades asociadas." /> : units.map((l) => (
          <Row key={l.id} left={<><b>{l.units?.code}</b> {l.units?.tower ? `· Torre ${l.units.tower}` : ""}<div style={sub}>{l.role} · alícuota {(Number(l.units?.alicuota || 0) * 100).toLocaleString("es-VE", { maximumFractionDigits: 4 })} %</div></>} right={<span style={{ fontWeight: 700, color: Number(l.units?.balance || 0) > 0 ? "#c0392b" : "#1e874b" }}>{money(Number(l.units?.balance || 0))}</span>} />
        ))}
      </Section>
      <Section title="Cargos pendientes">
        {pending.length === 0 ? <Empty text="No tienes cargos pendientes." /> : pending.map((c) => (
          <Row key={c.id} left={<><b>{c.description || c.concept}</b><div style={sub}>{c.due_date ? `Vence ${c.due_date}` : ""}</div></>} right={<b>{money(Number(c.amount) - Number(c.amount_paid || 0))}</b>} />
        ))}
      </Section>
      <Section title="Mis recibos">
        {receipts.length === 0 ? <Empty text="Sin recibos." /> : receipts.map((r) => <Row key={r.id} left={<><b>Recibo #{r.number}</b><div style={sub}>{new Date(r.issued_at).toLocaleDateString("es-VE")}</div></>} right={<b>{money(r.new_balance)}</b>} />)}
      </Section>
      <Section title="Mis pagos">
        {payments.length === 0 ? <Empty text="Sin pagos." /> : payments.map((p) => <Row key={p.id} left={<><b>{money(p.amount)} · {p.method}</b><div style={sub}>{p.reference} · {p.paid_on}</div></>} right={<span style={{ fontSize: 12, fontWeight: 700, color: p.status === "confirmado" ? "#1e874b" : p.status === "rechazado" ? "#c0392b" : "#8a5a00" }}>{p.status}</span>} />)}
      </Section>

      {pay && (
        <Modal onClose={() => setPay(false)}>
          <form onSubmit={report}>
            <h3 style={{ margin: "0 0 12px" }}>Reportar mi pago</h3>
            {units.length > 1 && <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} style={{ ...inp, marginBottom: 10 }}>{units.map((u) => <option key={u.id} value={u.unit_id}>{u.units?.code}</option>)}</select>}
            <input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Monto ($)" style={{ ...inp, marginBottom: 10 }} />
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} style={{ ...inp, marginBottom: 10 }}>{["transferencia", "pago_movil", "efectivo", "zelle", "tarjeta", "otro"].map((m) => <option key={m} value={m}>{m}</option>)}</select>
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Referencia / nº de confirmación" style={{ ...inp, marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 10 }}><button type="submit" style={btn}>Enviar</button><button type="button" onClick={() => setPay(false)} style={btnGhost}>Cancelar</button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ---------- Reservas ----------
type PAmenity = { id: string; name: string; description: string; fee: number; requires_approval: boolean; open_time: string; close_time: string }
type PRes = { id: string; reservation_date: string; start_time: string; end_time: string; status: string; fee_amount: number; amenities?: { name?: string } | null }

function ReservasTab({ api }: { api: Api }) {
  const [amenities, setAmenities] = useState<PAmenity[]>([])
  const [mine, setMine] = useState<PRes[]>([])
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("")
  const [form, setForm] = useState({ amenityId: "", date: "", startTime: "18:00", endTime: "22:00", guests: "" })
  const load = useCallback(async () => {
    try { const [a, r] = await Promise.all([api("/api/portal/amenities"), api("/api/portal/reservations")]); setAmenities((a.amenities as PAmenity[]) || []); setMine((r.reservations as PRes[]) || []) } catch (e) { setErr(String((e as Error).message)) }
  }, [api])
  useEffect(() => { load() }, [load])
  async function reserve(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setMsg("")
    try { const d = await api("/api/portal/reservations", { method: "POST", body: JSON.stringify(form) }); setMsg(d.status === "pendiente" ? "✓ Reserva enviada, queda por aprobar." : "✓ Reserva confirmada."); setForm({ amenityId: "", date: "", startTime: "18:00", endTime: "22:00", guests: "" }); await load() } catch (e) { setErr(String((e as Error).message)) }
  }
  return (
    <div>
      {err && <div style={errBox}>{err}</div>}{msg && <div style={okBox}>{msg}</div>}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Reservar un área común</div>
        <form onSubmit={reserve} style={{ display: "grid", gap: 10 }}>
          <select required value={form.amenityId} onChange={(e) => setForm({ ...form, amenityId: e.target.value })} style={inp}><option value="">Elige el área…</option>{amenities.map((a) => <option key={a.id} value={a.id}>{a.name}{a.fee > 0 ? ` (${money(a.fee)})` : " (gratis)"}</option>)}</select>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={{ ...inp, flex: 1 }} />
            <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} style={{ ...inp, width: 120 }} />
            <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} style={{ ...inp, width: 120 }} />
          </div>
          <button type="submit" style={{ ...btn, justifySelf: "start" }}>Reservar</button>
        </form>
      </div>
      <Section title="Mis reservas">
        {mine.length === 0 ? <Empty text="Sin reservas." /> : mine.map((r) => <Row key={r.id} left={<><b>{r.amenities?.name}</b><div style={sub}>{r.reservation_date} · {r.start_time}-{r.end_time}</div></>} right={<span style={{ fontSize: 12, fontWeight: 700, color: r.status === "confirmada" ? "#1e874b" : r.status === "rechazada" ? "#c0392b" : "#8a5a00" }}>{r.status}</span>} />)}
      </Section>
    </div>
  )
}

// ---------- Incidencias ----------
type PTicket = { id: string; code: string; category: string; status: string; title: string; description: string; created_at: string }
function IncidenciasTab({ api }: { api: Api }) {
  const [items, setItems] = useState<PTicket[]>([])
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("")
  const [form, setForm] = useState({ category: "mantenimiento", title: "", description: "" })
  const load = useCallback(async () => { try { const d = await api("/api/portal/tickets"); setItems((d.tickets as PTicket[]) || []) } catch (e) { setErr(String((e as Error).message)) } }, [api])
  useEffect(() => { load() }, [load])
  async function create(e: React.FormEvent) { e.preventDefault(); setErr(""); setMsg(""); try { await api("/api/portal/tickets", { method: "POST", body: JSON.stringify(form) }); setMsg("✓ Incidencia enviada."); setForm({ category: "mantenimiento", title: "", description: "" }); await load() } catch (e) { setErr(String((e as Error).message)) } }
  return (
    <div>
      {err && <div style={errBox}>{err}</div>}{msg && <div style={okBox}>{msg}</div>}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Reportar una incidencia</div>
        <form onSubmit={create} style={{ display: "grid", gap: 10 }}>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inp}>{["mantenimiento", "limpieza", "seguridad", "ruido", "administrativo", "otro"].map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título (ej. Fuga en el pasillo)" style={inp} />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción…" rows={3} style={{ ...inp, resize: "vertical" }} />
          <button type="submit" style={{ ...btn, justifySelf: "start" }}>Enviar</button>
        </form>
      </div>
      <Section title="Mis incidencias">
        {items.length === 0 ? <Empty text="Sin incidencias." /> : items.map((t) => <Row key={t.id} left={<><b>{t.title}</b><div style={sub}>{t.code} · {t.category}</div></>} right={<span style={{ fontSize: 12, fontWeight: 700, color: t.status === "resuelto" || t.status === "cerrado" ? "#1e874b" : "#8a5a00" }}>{t.status}</span>} />)}
      </Section>
    </div>
  )
}

// ---------- Avisos ----------
type PAnn = { id: string; title: string; body: string; category: string; is_pinned: boolean; published_at: string | null }
function AvisosTab({ api }: { api: Api }) {
  const [items, setItems] = useState<PAnn[]>([]); const [err, setErr] = useState("")
  const load = useCallback(async () => { try { const d = await api("/api/portal/announcements"); setItems((d.announcements as PAnn[]) || []) } catch (e) { setErr(String((e as Error).message)) } }, [api])
  useEffect(() => { load() }, [load])
  return (
    <div>
      {err && <div style={errBox}>{err}</div>}
      {items.length === 0 ? <div style={card}><Empty text="No hay comunicados por ahora." /></div> : items.map((a) => (
        <div key={a.id} style={{ ...card, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>{a.is_pinned ? "📌 " : ""}{a.title}</div>
          <div style={{ color: "#5b6b82", fontSize: 14, marginTop: 4, whiteSpace: "pre-wrap" }}>{a.body}</div>
          <div style={{ fontSize: 11, color: "#8494a8", marginTop: 6 }}>{a.category} · {a.published_at ? new Date(a.published_at).toLocaleDateString("es-VE") : ""}</div>
        </div>
      ))}
    </div>
  )
}

// ---------- Votar ----------
type POpt = { id: string; label: string }
type PPoll = { id: string; question: string; options: POpt[]; myVote: string | null }
function VotarTab({ api }: { api: Api }) {
  const [polls, setPolls] = useState<PPoll[]>([]); const [err, setErr] = useState(""); const [msg, setMsg] = useState("")
  const load = useCallback(async () => { try { const d = await api("/api/portal/polls"); setPolls((d.polls as PPoll[]) || []) } catch (e) { setErr(String((e as Error).message)) } }, [api])
  useEffect(() => { load() }, [load])
  async function vote(pollId: string, optionId: string) { setErr(""); setMsg(""); try { await api("/api/portal/polls", { method: "POST", body: JSON.stringify({ pollId, optionId }) }); setMsg("✓ Voto registrado."); await load() } catch (e) { setErr(String((e as Error).message)) } }
  return (
    <div>
      {err && <div style={errBox}>{err}</div>}{msg && <div style={okBox}>{msg}</div>}
      {polls.length === 0 ? <div style={card}><Empty text="No hay votaciones abiertas." /></div> : polls.map((p) => (
        <div key={p.id} style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{p.question}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {p.options.map((o) => (
              <button key={o.id} disabled={!!p.myVote} onClick={() => vote(p.id, o.id)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: p.myVote === o.id ? "2px solid #1f6feb" : "1px solid #d5deeb", background: p.myVote === o.id ? "#eef3fb" : "#fff", cursor: p.myVote ? "default" : "pointer", fontWeight: 600 }}>{p.myVote === o.id ? "✓ " : ""}{o.label}</button>
            ))}
          </div>
          {p.myVote && <div style={{ fontSize: 12, color: "#1e874b", marginTop: 8 }}>Ya votaste en esta consulta.</div>}
        </div>
      ))}
    </div>
  )
}

// ---------- Visitas ----------
type PVis = { id: string; kind: string; full_name: string; access_code: string; status: string; valid_until: string | null }
function VisitasTab({ api }: { api: Api }) {
  const [items, setItems] = useState<PVis[]>([]); const [err, setErr] = useState(""); const [code, setCode] = useState("")
  const [form, setForm] = useState({ fullName: "", kind: "visita", documentNumber: "", vehiclePlate: "", validUntil: "" })
  const load = useCallback(async () => { try { const d = await api("/api/portal/visitors"); setItems((d.visitors as PVis[]) || []) } catch (e) { setErr(String((e as Error).message)) } }, [api])
  useEffect(() => { load() }, [load])
  async function authorize(e: React.FormEvent) { e.preventDefault(); setErr(""); setCode(""); try { const d = await api("/api/portal/visitors", { method: "POST", body: JSON.stringify(form) }); setCode(String(d.code)); setForm({ fullName: "", kind: "visita", documentNumber: "", vehiclePlate: "", validUntil: "" }); await load() } catch (e) { setErr(String((e as Error).message)) } }
  return (
    <div>
      {err && <div style={errBox}>{err}</div>}
      {code && <div style={okBox}>✓ Visita autorizada. Código para la garita: <b style={{ fontSize: 18, letterSpacing: 3 }}>{code}</b></div>}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Autorizar una visita</div>
        <form onSubmit={authorize} style={{ display: "grid", gap: 10 }}>
          <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Nombre de la visita" style={inp} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={{ ...inp, width: 130 }}>{["visita", "proveedor", "delivery", "taxi"].map((k) => <option key={k} value={k}>{k}</option>)}</select>
            <input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} placeholder="Cédula" style={{ ...inp, flex: 1, minWidth: 120 }} />
            <input value={form.vehiclePlate} onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value })} placeholder="Placa" style={{ ...inp, width: 110 }} />
          </div>
          <button type="submit" style={{ ...btn, justifySelf: "start" }}>Autorizar</button>
        </form>
      </div>
      <Section title="Mis visitas">
        {items.length === 0 ? <Empty text="Sin visitas." /> : items.map((v) => <Row key={v.id} left={<><b>{v.full_name}</b><div style={sub}>{v.kind} · código {v.access_code}</div></>} right={<span style={{ fontSize: 12, fontWeight: 700 }}>{v.status}</span>} />)}
      </Section>
    </div>
  )
}

// ---------- Documentos ----------
type PDoc = { id: string; title: string; category: string; description: string; file_url: string }
function DocsTab({ api }: { api: Api }) {
  const [items, setItems] = useState<PDoc[]>([]); const [err, setErr] = useState("")
  const load = useCallback(async () => { try { const d = await api("/api/portal/documents"); setItems((d.documents as PDoc[]) || []) } catch (e) { setErr(String((e as Error).message)) } }, [api])
  useEffect(() => { load() }, [load])
  return (
    <div>
      {err && <div style={errBox}>{err}</div>}
      {items.length === 0 ? <div style={card}><Empty text="No hay documentos publicados." /></div> : items.map((d) => (
        <a key={d.id} href={d.file_url} target="_blank" rel="noopener" style={{ ...card, marginBottom: 10, display: "flex", gap: 12, alignItems: "center", textDecoration: "none", color: "#0a1a30" }}>
          <span style={{ fontSize: 24 }}>📄</span>
          <div><div style={{ fontWeight: 700, color: "#1554b8" }}>{d.title}</div><div style={sub}>{d.category}{d.description ? ` · ${d.description}` : ""}</div></div>
        </a>
      ))}
    </div>
  )
}

// ---------- helpers ----------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}><h2 style={{ fontSize: 15, fontWeight: 700, color: "#16324f", margin: "0 0 8px" }}>{title}</h2><div style={card}>{children}</div></div>
}
function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f3f8" }}><div>{left}</div><div style={{ marginLeft: "auto", textAlign: "right" }}>{right}</div></div>
}
function Empty({ text }: { text: string }) { return <p style={{ color: "#8494a8", margin: 0, fontSize: 14 }}>{text}</p> }
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,26,48,.45)", display: "grid", placeItems: "center", padding: 20, zIndex: 50 }}><div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 22, width: "100%", maxWidth: 400 }}>{children}</div></div>
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 6px 20px rgba(10,26,48,.06)" }
const sub: React.CSSProperties = { fontSize: 12, color: "#8494a8", marginTop: 2 }
const inp: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid #d5deeb", fontSize: 15, background: "#fff", color: "#0a1a30" }
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#16324f" }
const btn: React.CSSProperties = { padding: "12px 18px", borderRadius: 12, border: 0, background: "#1f6feb", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }
const btnGhost: React.CSSProperties = { padding: "12px 18px", borderRadius: 12, border: 0, background: "#eef3fb", color: "#16324f", fontWeight: 600, fontSize: 15, cursor: "pointer" }
const errBox: React.CSSProperties = { background: "#fdecea", color: "#c0392b", padding: 12, borderRadius: 10, marginBottom: 12, fontSize: 14 }
const okBox: React.CSSProperties = { background: "#e6f4ea", color: "#1e874b", padding: 12, borderRadius: 10, marginBottom: 12, fontSize: 14 }

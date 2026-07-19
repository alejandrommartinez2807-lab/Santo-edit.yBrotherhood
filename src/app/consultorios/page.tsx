"use client"
import { useEffect, useMemo, useState } from "react"

type Doctor = { id: string; full_name: string; specialty: string; photo_url: string; bio: string; consult_fee: number; currency: string; units?: { floor?: string } | null }
type Slot = { time: string; iso: string }

export default function ConsultoriosPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Doctor | null>(null)
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [form, setForm] = useState({ name: "", phone: "", email: "", reason: "" })
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch("/api/public/medical").then((r) => r.json()).then((d) => setDoctors(d.doctors || [])).catch(() => {}).finally(() => setLoading(false))
    const t = new Date(); t.setDate(t.getDate())
    setDate(t.toISOString().slice(0, 10))
  }, [])

  useEffect(() => {
    if (!sel || !date) { setSlots([]); return }
    setSlotsLoading(true); setSlot(null)
    fetch(`/api/public/medical?doctorId=${sel.id}&date=${date}`).then((r) => r.json()).then((d) => setSlots(d.slots || [])).catch(() => setSlots([])).finally(() => setSlotsLoading(false))
  }, [sel, date])

  const specialties = useMemo(() => Array.from(new Set(doctors.map((d) => d.specialty).filter(Boolean))), [doctors])
  const [filter, setFilter] = useState("")
  const shown = filter ? doctors.filter((d) => d.specialty === filter) : doctors

  async function book() {
    if (!sel || !slot) return
    setErr(""); setMsg("")
    if (!form.name.trim() || !form.phone.trim()) { setErr("Escribe tu nombre y teléfono"); return }
    try {
      const r = await fetch("/api/public/medical", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doctorId: sel.id, date, time: slot.time, patientName: form.name, patientPhone: form.phone, patientEmail: form.email, reason: form.reason }) })
      const d = await r.json()
      if (!r.ok || !d.ok) { setErr(d.error || "No se pudo reservar"); return }
      setDone(true); setMsg("¡Cita solicitada! Te confirmaremos por teléfono.")
    } catch { setErr("No se pudo reservar") }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6fbfe", color: "#163243", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #dcecf5" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/concepto-logo.png" alt="" width={36} height={36} style={{ borderRadius: 8 }} />
          <strong>Consultorios · Concepto La Granja</strong>
          <a href="/portal" style={{ marginLeft: "auto", color: "#0a6f9c", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 6px" }}>Agenda tu cita médica</h1>
        <p style={{ color: "#5b6b82", marginTop: 0 }}>Elige un especialista de la torre médica y reserva en línea.</p>

        {loading ? <p>Cargando…</p> : doctors.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, textAlign: "center", color: "#5b6b82", border: "1px solid #eaf3f8" }}>
            Aún no hay doctores publicados. Vuelve pronto.
          </div>
        ) : done ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center", border: "1px solid #eaf3f8" }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <h2 style={{ margin: "8px 0" }}>{msg}</h2>
            <p style={{ color: "#5b6b82" }}>{sel?.full_name} · {new Date(slot!.iso).toLocaleString("es-VE", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
            <button onClick={() => { setDone(false); setSel(null); setSlot(null); setForm({ name: "", phone: "", email: "", reason: "" }) }} style={btn}>Agendar otra cita</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 20 }}>
            <div>
              {specialties.length > 1 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  <button onClick={() => setFilter("")} style={chip(filter === "")}>Todas</button>
                  {specialties.map((s) => <button key={s} onClick={() => setFilter(s)} style={chip(filter === s)}>{s}</button>)}
                </div>
              )}
              <div style={{ display: "grid", gap: 12 }}>
                {shown.map((d) => (
                  <button key={d.id} onClick={() => { setSel(d); setSlot(null) }} style={{ textAlign: "left", cursor: "pointer", background: sel?.id === d.id ? "#e5f4fb" : "#fff", border: sel?.id === d.id ? "2px solid #0f9bd7" : "1px solid #eaf3f8", borderRadius: 14, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#0f9bd7", color: "#fff", display: "grid", placeItems: "center", fontSize: 20, flexShrink: 0 }}>🩺</div>
                    <div>
                      <div style={{ fontWeight: 800 }}>{d.full_name}</div>
                      <div style={{ fontSize: 13, color: "#5b6b82" }}>{d.specialty || "Medicina general"}{d.units?.floor ? ` · Piso ${d.units.floor}` : ""}{d.consult_fee ? ` · $${d.consult_fee}` : ""}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {sel && (
              <div style={{ background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #eaf3f8", height: "fit-content" }}>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{sel.full_name}</div>
                <div style={{ fontSize: 13, color: "#5b6b82", marginBottom: 12 }}>{sel.specialty || "Medicina general"}</div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Fecha
                  <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} style={{ ...inp, marginTop: 4 }} />
                </label>
                <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600 }}>Horarios disponibles</div>
                {slotsLoading ? <p style={{ color: "#5b6b82" }}>Buscando…</p> : slots.length === 0 ? (
                  <p style={{ color: "#8494a8", fontSize: 14 }}>Sin cupos ese día. Prueba otra fecha.</p>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {slots.map((s) => <button key={s.iso} onClick={() => setSlot(s)} style={{ cursor: "pointer", borderRadius: 10, padding: "8px 12px", fontWeight: 700, fontSize: 14, border: slot?.iso === s.iso ? "2px solid #0f9bd7" : "1px solid #cfe6f2", background: slot?.iso === s.iso ? "#0f9bd7" : "#fff", color: slot?.iso === s.iso ? "#fff" : "#163243" }}>{s.time}</button>)}
                  </div>
                )}

                {slot && (
                  <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                    <input placeholder="Tu nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
                    <input placeholder="Teléfono *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inp} />
                    <input placeholder="Correo (opcional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inp} />
                    <input placeholder="Motivo (opcional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} style={inp} />
                    {err && <div style={{ color: "#c0392b", fontSize: 14 }}>{err}</div>}
                    <button onClick={book} style={btn}>Reservar {slot.time}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cfe6f2", fontSize: 15 }
const btn: React.CSSProperties = { background: "#0f9bd7", color: "#fff", border: 0, borderRadius: 12, padding: "12px 18px", fontWeight: 700, fontSize: 15, cursor: "pointer" }
function chip(active: boolean): React.CSSProperties {
  return { cursor: "pointer", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600, border: active ? "0" : "1px solid #cfe6f2", background: active ? "#0f9bd7" : "#fff", color: active ? "#fff" : "#163243" }
}

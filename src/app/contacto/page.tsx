"use client"
import { useState } from "react"

const KINDS = [
  { v: "consulta", l: "Consulta" },
  { v: "reclamo", l: "Reclamo" },
  { v: "sugerencia", l: "Sugerencia" },
  { v: "objeto_perdido", l: "Objeto perdido" },
  { v: "solicitud_local", l: "Quiero alquilar un local" },
  { v: "propuesta_proveedor", l: "Soy proveedor" },
  { v: "otro", l: "Otro" },
]

export default function ContactoPage() {
  const [form, setForm] = useState({ kind: "consulta", subject: "", message: "", customerName: "", customerPhone: "", customerEmail: "" })
  const [err, setErr] = useState("")
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true)
    try {
      const r = await fetch("/api/public/crm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) })
      const d = await r.json()
      if (!r.ok || !d.ok) { setErr(d.error || "No se pudo enviar"); return }
      setDone(true)
    } catch { setErr("No se pudo enviar") } finally { setBusy(false) }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6fbfe", color: "#163243", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #dcecf5" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/concepto-logo.png" alt="" width={36} height={36} style={{ borderRadius: 8 }} />
          <strong>Atención al cliente</strong>
          <a href="/portal" style={{ marginLeft: "auto", color: "#0a6f9c", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>← Volver</a>
        </div>
      </header>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        {done ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center", border: "1px solid #eaf3f8" }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <h2>¡Mensaje enviado!</h2>
            <p style={{ color: "#5b6b82" }}>Gracias por escribirnos. Te responderemos pronto.</p>
            <a href="/portal" style={{ color: "#0a6f9c", fontWeight: 700 }}>Volver al inicio</a>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px" }}>¿Cómo podemos ayudarte?</h1>
            <p style={{ color: "#5b6b82", marginTop: 0 }}>Escríbenos tu consulta, reclamo o sugerencia. También reportamos objetos perdidos.</p>
            <form onSubmit={submit} style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #eaf3f8", display: "grid", gap: 12 }}>
              <label style={lbl}>Motivo
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={inp}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select>
              </label>
              <label style={lbl}>Asunto<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={inp} /></label>
              <label style={lbl}>Mensaje *<textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} style={{ ...inp, resize: "vertical" }} /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={lbl}>Tu nombre *<input required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} style={inp} /></label>
                <label style={lbl}>Teléfono<input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} style={inp} /></label>
              </div>
              <label style={lbl}>Correo (opcional)<input value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} style={inp} /></label>
              {err && <div style={{ color: "#c0392b", fontSize: 14 }}>{err}</div>}
              <button type="submit" disabled={busy} style={{ background: "#0f9bd7", color: "#fff", border: 0, borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{busy ? "Enviando…" : "Enviar"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, display: "grid", gap: 4 }
const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cfe6f2", fontSize: 15, fontFamily: "inherit" }

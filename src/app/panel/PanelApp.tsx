"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

// ============================================================
// Panel administrativo de condominio — Apartamentos Palulu
// Diseño propio (no hereda el panel del hotel). Fase 1: Unidades + Residentes.
// Auth: clave por rol del template; se guarda en localStorage y se envía como
// header x-local-password a /api/panel/*.
// ============================================================

const PW_KEY = "palulu_panel_pw"

type UnitType = { id: string; name: string; description?: string; sort_order?: number }
type Unit = {
  id: string
  code: string
  tower: string
  floor: string
  area_m2: number
  alicuota: number
  parking_slots: number
  storage_slots: number
  status: string
  notes: string
  unit_type_id: string | null
  sort_order: number
}
type Resident = {
  id: string
  full_name: string
  document_type: string
  document_number: string
  phone: string
  email: string
  is_active: boolean
  notes: string
}
type Link = {
  id: string
  unit_id: string
  resident_id: string
  role: string
  is_primary: boolean
  receives_billing: boolean
  units?: { code?: string; tower?: string } | null
}
type Summary = { unitsCount: number; residentsCount: number; alicuotaSum: number; balanceDue: number }

type Tab = "resumen" | "unidades" | "residentes"

const UNIT_STATUS = ["activa", "desocupada", "en_mora", "inactiva"]
const RES_ROLES = ["propietario", "inquilino", "autorizado", "familiar"]

const MODULES: { key: Tab | string; label: string; icon: string; ready: boolean }[] = [
  { key: "resumen", label: "Resumen", icon: "▦", ready: true },
  { key: "unidades", label: "Unidades", icon: "🏢", ready: true },
  { key: "residentes", label: "Residentes", icon: "👥", ready: true },
  { key: "cuotas", label: "Cuotas", icon: "🧾", ready: false },
  { key: "estado", label: "Estado de cuenta", icon: "💳", ready: false },
  { key: "amenidades", label: "Áreas comunes", icon: "🏊", ready: false },
  { key: "incidencias", label: "Incidencias", icon: "🛠️", ready: false },
  { key: "comunicados", label: "Comunicados", icon: "📣", ready: false },
  { key: "asambleas", label: "Asambleas", icon: "🗳️", ready: false },
  { key: "accesos", label: "Accesos", icon: "🚪", ready: false },
]

function money(n: number) {
  return `$${(Number(n) || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function pct(fraction: number) {
  return `${((Number(fraction) || 0) * 100).toLocaleString("es-VE", { maximumFractionDigits: 4 })} %`
}

export default function PanelApp() {
  const [pw, setPw] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>("resumen")

  useEffect(() => {
    setPw(localStorage.getItem(PW_KEY))
    setReady(true)
  }, [])

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "x-local-password": pw || "",
          ...(init?.headers || {}),
        },
      })
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(PW_KEY)
        setPw(null)
        throw new Error("Sesión expirada. Vuelve a entrar.")
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Error")
      return data
    },
    [pw],
  )

  if (!ready) return null
  if (!pw) return <LoginGate onOk={setPw} />

  return (
    <div style={{ minHeight: "100vh", background: "#f4f7fb", color: "#0a1a30" }}>
      <TopBar onLogout={() => { localStorage.removeItem(PW_KEY); setPw(null) }} />
      <div style={{ display: "flex", maxWidth: 1200, margin: "0 auto", gap: 20, padding: "20px 16px" }}>
        <Sidebar tab={tab} setTab={(t) => setTab(t)} />
        <main style={{ flex: 1, minWidth: 0 }}>
          {tab === "resumen" && <ResumenView api={api} goTo={setTab} />}
          {tab === "unidades" && <UnidadesView api={api} />}
          {tab === "residentes" && <ResidentesView api={api} />}
        </main>
      </div>
    </div>
  )
}

// ---------- Login ----------
function LoginGate({ onOk }: { onOk: (pw: string) => void }) {
  const [value, setValue] = useState("")
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr("")
    setLoading(true)
    try {
      const res = await fetch("/api/panel/summary", { headers: { "x-local-password": value } })
      if (!res.ok) throw new Error("Clave incorrecta")
      localStorage.setItem(PW_KEY, value)
      onOk(value)
    } catch {
      setErr("Clave incorrecta. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(160deg,#0a1a30,#1554b8)", padding: 20 }}>
      <form onSubmit={submit} style={{ background: "#fff", borderRadius: 20, padding: 32, width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(10,26,48,.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/palulu-mark.svg" alt="" width={48} height={48} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#0a1a30" }}>Apartamentos Palulu</div>
            <div style={{ fontSize: 12, color: "#5b6b82" }}>Panel administrativo</div>
          </div>
        </div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#16324f" }}>Clave de acceso</label>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          style={{ width: "100%", marginTop: 6, padding: "12px 14px", borderRadius: 12, border: "1px solid #d5deeb", fontSize: 15 }}
          placeholder="••••••••"
        />
        {err && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>{err}</div>}
        <button type="submit" disabled={loading} style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 12, border: 0, background: "#1f6feb", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          {loading ? "Entrando…" : "Entrar al panel"}
        </button>
      </form>
    </div>
  )
}

// ---------- Chrome ----------
function TopBar({ onLogout }: { onLogout: () => void }) {
  return (
    <header style={{ background: "#0a1a30", color: "#fff", padding: "12px 16px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/palulu-mark.svg" alt="" width={34} height={34} />
        <div style={{ fontWeight: 800 }}>Apartamentos Palulu</div>
        <span style={{ fontSize: 12, opacity: 0.7 }}>· Administración</span>
        <button onClick={onLogout} style={{ marginLeft: "auto", background: "rgba(255,255,255,.12)", color: "#fff", border: 0, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>
          Salir
        </button>
      </div>
    </header>
  )
}

function Sidebar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <nav style={{ width: 210, flexShrink: 0 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 8, boxShadow: "0 6px 20px rgba(10,26,48,.06)" }}>
        {MODULES.map((m) => {
          const active = tab === m.key
          return (
            <button
              key={m.key}
              disabled={!m.ready}
              onClick={() => m.ready && setTab(m.key as Tab)}
              style={{
                width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10, border: 0, cursor: m.ready ? "pointer" : "not-allowed",
                background: active ? "#1f6feb" : "transparent", color: active ? "#fff" : m.ready ? "#16324f" : "#9fb0c6",
                fontWeight: active ? 700 : 500, fontSize: 14, marginBottom: 2,
              }}
            >
              <span style={{ width: 20, textAlign: "center" }}>{m.icon}</span>
              <span style={{ flex: 1 }}>{m.label}</span>
              {!m.ready && <span style={{ fontSize: 10, color: "#9fb0c6" }}>pronto</span>}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 6px 20px rgba(10,26,48,.06)" }}>{children}</div>
}

// ---------- Resumen ----------
function ResumenView({ api, goTo }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>>; goTo: (t: Tab) => void }) {
  const [s, setS] = useState<Summary | null>(null)
  const [err, setErr] = useState("")
  const [backupMsg, setBackupMsg] = useState("")
  const [busy, setBusy] = useState("")
  useEffect(() => {
    api("/api/panel/summary").then((d) => setS(d as unknown as Summary)).catch((e) => setErr(String(e.message || e)))
  }, [api])

  const alicuotaOk = s ? Math.abs(s.alicuotaSum - 1) < 0.005 : true

  async function downloadBackup() {
    setBusy("download"); setBackupMsg("")
    try {
      const res = await fetch("/api/panel/backup?download=1", { headers: { "x-local-password": localStorage.getItem(PW_KEY) || "" } })
      if (!res.ok) throw new Error("No se pudo generar")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `palulu-respaldo-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      setBackupMsg("Respaldo descargado ✓")
    } catch (e) { setBackupMsg(String((e as Error).message)) } finally { setBusy("") }
  }
  async function storeBackup() {
    setBusy("store"); setBackupMsg("")
    try {
      const d = await api("/api/panel/backup")
      setBackupMsg(`Respaldo guardado en la nube ✓ (${d.totalRows ?? 0} registros)`)
    } catch (e) { setBackupMsg(String((e as Error).message)) } finally { setBusy("") }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 16px" }}>Resumen del condominio</h1>
      {err && <div style={{ color: "#c0392b", marginBottom: 12 }}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        <Stat label="Unidades" value={s ? String(s.unitsCount) : "…"} onClick={() => goTo("unidades")} />
        <Stat label="Residentes" value={s ? String(s.residentsCount) : "…"} onClick={() => goTo("residentes")} />
        <Stat
          label="Suma de alícuotas"
          value={s ? pct(s.alicuotaSum) : "…"}
          hint={s ? (alicuotaOk ? "✓ suma 100 %" : "⚠ debería sumar 100 %") : ""}
          hintColor={alicuotaOk ? "#1e874b" : "#c0392b"}
        />
        <Stat label="Saldo por cobrar" value={s ? money(s.balanceDue) : "…"} hint="morosidad total" />
      </div>
      <div style={{ marginTop: 18 }}>
        <Card>
          <p style={{ margin: 0, color: "#5b6b82", fontSize: 14, lineHeight: 1.6 }}>
            Bienvenido al panel de <b>Apartamentos Palulu</b>. Empieza cargando las <b>unidades</b> (con su alícuota) y los
            <b> residentes</b>. Con eso listo, en las próximas fases se activan la emisión de cuotas, el estado de cuenta,
            las reservas de áreas comunes, las incidencias y los comunicados.
          </p>
        </Card>
      </div>
      <div style={{ marginTop: 14 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700 }}>🛡️ Respaldo de la información</div>
              <div style={{ fontSize: 13, color: "#5b6b82" }}>Se respalda automáticamente cada día en la nube. También puedes hacerlo ahora.</div>
            </div>
            <button onClick={storeBackup} disabled={!!busy} style={btnGhost}>{busy === "store" ? "Respaldando…" : "Respaldar ahora"}</button>
            <button onClick={downloadBackup} disabled={!!busy} style={btnPrimary}>{busy === "download" ? "Generando…" : "Descargar respaldo"}</button>
          </div>
          {backupMsg && <div style={{ marginTop: 10, fontSize: 13, color: "#1554b8" }}>{backupMsg}</div>}
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, hint, hintColor, onClick }: { label: string; value: string; hint?: string; hintColor?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ textAlign: "left", border: 0, cursor: onClick ? "pointer" : "default", background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 6px 20px rgba(10,26,48,.06)" }}>
      <div style={{ fontSize: 12, color: "#5b6b82", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#0a1a30", marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: hintColor || "#5b6b82", marginTop: 4 }}>{hint}</div>}
    </button>
  )
}

// ---------- Unidades ----------
const emptyUnitForm = {
  id: "", code: "", tower: "", floor: "", unitTypeId: "", areaM2: "", alicuotaPct: "", parkingSlots: "0", storageSlots: "0", status: "activa", notes: "",
}

function UnidadesView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [units, setUnits] = useState<Unit[]>([])
  const [types, setTypes] = useState<UnitType[]>([])
  const [form, setForm] = useState({ ...emptyUnitForm })
  const [showForm, setShowForm] = useState(false)
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(true)
  const [newType, setNewType] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api("/api/panel/units")
      setUnits((d.units as Unit[]) || [])
      setTypes((d.unitTypes as UnitType[]) || [])
    } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }, [api])
  useEffect(() => { load() }, [load])

  const typeName = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t.name])), [types])

  function edit(u: Unit) {
    setForm({
      id: u.id, code: u.code, tower: u.tower || "", floor: u.floor || "", unitTypeId: u.unit_type_id || "",
      areaM2: String(u.area_m2 || ""), alicuotaPct: String(((u.alicuota || 0) * 100) || ""),
      parkingSlots: String(u.parking_slots || 0), storageSlots: String(u.storage_slots || 0), status: u.status || "activa", notes: u.notes || "",
    })
    setShowForm(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErr("")
    try {
      await api("/api/panel/units", {
        method: "POST",
        body: JSON.stringify({
          id: form.id || undefined, code: form.code, tower: form.tower, floor: form.floor, unitTypeId: form.unitTypeId,
          areaM2: Number(form.areaM2 || 0), alicuota: Number(form.alicuotaPct || 0) / 100,
          parkingSlots: Number(form.parkingSlots || 0), storageSlots: Number(form.storageSlots || 0), status: form.status, notes: form.notes,
        }),
      })
      setForm({ ...emptyUnitForm }); setShowForm(false); await load()
    } catch (e) { setErr(String((e as Error).message)) }
  }

  async function remove(u: Unit) {
    if (!confirm(`¿Eliminar la unidad ${u.code}?`)) return
    try { await api(`/api/panel/units/${u.id}`, { method: "DELETE" }); await load() } catch (e) { setErr(String((e as Error).message)) }
  }

  async function addType() {
    if (!newType.trim()) return
    try { const d = await api("/api/panel/units", { method: "POST", body: JSON.stringify({ kind: "unitType", name: newType.trim() }) }); setNewType(""); await load(); const t = d.unitType as UnitType; if (t) setForm((f) => ({ ...f, unitTypeId: t.id })) } catch (e) { setErr(String((e as Error).message)) }
  }

  const alicuotaSum = units.reduce((s, u) => s + Number(u.alicuota || 0), 0)

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Unidades</h1>
        <span style={{ fontSize: 13, color: Math.abs(alicuotaSum - 1) < 0.005 ? "#1e874b" : "#c0392b" }}>Alícuota total: {pct(alicuotaSum)}</span>
        <button onClick={() => { setForm({ ...emptyUnitForm }); setShowForm((v) => !v) }} style={btnPrimary}>+ Nueva unidad</button>
      </div>
      {err && <div style={errBox}>{err}</div>}

      {showForm && (
        <Card>
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <Field label="Código *"><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="A-12B" style={input} /></Field>
            <Field label="Torre / Bloque"><input value={form.tower} onChange={(e) => setForm({ ...form, tower: e.target.value })} style={input} /></Field>
            <Field label="Piso"><input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} style={input} /></Field>
            <Field label="Tipo">
              <div style={{ display: "flex", gap: 6 }}>
                <select value={form.unitTypeId} onChange={(e) => setForm({ ...form, unitTypeId: e.target.value })} style={{ ...input, flex: 1 }}>
                  <option value="">—</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Área (m²)"><input type="number" step="0.01" value={form.areaM2} onChange={(e) => setForm({ ...form, areaM2: e.target.value })} style={input} /></Field>
            <Field label="Alícuota (%)"><input type="number" step="0.0001" value={form.alicuotaPct} onChange={(e) => setForm({ ...form, alicuotaPct: e.target.value })} placeholder="1.25" style={input} /></Field>
            <Field label="Estac."><input type="number" value={form.parkingSlots} onChange={(e) => setForm({ ...form, parkingSlots: e.target.value })} style={input} /></Field>
            <Field label="Estado">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
                {UNIT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
              <button type="submit" style={btnPrimary}>{form.id ? "Guardar cambios" : "Crear unidad"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btnGhost}>Cancelar</button>
              <span style={{ flex: 1 }} />
              <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Nuevo tipo…" style={{ ...input, width: 130 }} />
              <button type="button" onClick={addType} style={btnGhost}>+ tipo</button>
            </div>
          </form>
        </Card>
      )}

      <div style={{ marginTop: 14 }}>
        <Card>
          {loading ? <p style={{ color: "#5b6b82" }}>Cargando…</p> : units.length === 0 ? (
            <p style={{ color: "#5b6b82", margin: 0 }}>Aún no hay unidades. Crea la primera con “+ Nueva unidad”.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Código", "Torre", "Piso", "Tipo", "m²", "Alícuota", "Estac.", "Estado", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{u.code}</td>
                      <td style={td}>{u.tower || "—"}</td>
                      <td style={td}>{u.floor || "—"}</td>
                      <td style={td}>{u.unit_type_id ? typeName[u.unit_type_id] || "—" : "—"}</td>
                      <td style={td}>{u.area_m2 || "—"}</td>
                      <td style={td}>{pct(u.alicuota)}</td>
                      <td style={td}>{u.parking_slots || 0}</td>
                      <td style={td}><span style={badge(u.status)}>{u.status}</span></td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button onClick={() => edit(u)} style={btnMini}>Editar</button>
                        <button onClick={() => remove(u)} style={btnMiniDanger}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ---------- Residentes ----------
const emptyResForm = { id: "", fullName: "", documentType: "cedula", documentNumber: "", phone: "", email: "", notes: "" }

function ResidentesView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [residents, setResidents] = useState<Resident[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [form, setForm] = useState({ ...emptyResForm })
  const [showForm, setShowForm] = useState(false)
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(true)
  const [linkFor, setLinkFor] = useState<Resident | null>(null)
  const [linkUnit, setLinkUnit] = useState("")
  const [linkRole, setLinkRole] = useState("propietario")
  const [codeInfo, setCodeInfo] = useState<{ name: string; code: string; phone: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, u] = await Promise.all([api("/api/panel/residents"), api("/api/panel/units")])
      setResidents((r.residents as Resident[]) || [])
      setLinks((r.links as Link[]) || [])
      setUnits((u.units as Unit[]) || [])
    } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }, [api])
  useEffect(() => { load() }, [load])

  const linksByResident = useMemo(() => {
    const map: Record<string, Link[]> = {}
    for (const l of links) { (map[l.resident_id] ||= []).push(l) }
    return map
  }, [links])

  function edit(r: Resident) {
    setForm({ id: r.id, fullName: r.full_name, documentType: r.document_type || "cedula", documentNumber: r.document_number || "", phone: r.phone || "", email: r.email || "", notes: r.notes || "" })
    setShowForm(true)
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    try {
      await api("/api/panel/residents", { method: "POST", body: JSON.stringify({ ...form, id: form.id || undefined }) })
      setForm({ ...emptyResForm }); setShowForm(false); await load()
    } catch (e) { setErr(String((e as Error).message)) }
  }
  async function remove(r: Resident) {
    if (!confirm(`¿Eliminar a ${r.full_name}?`)) return
    try { await api(`/api/panel/residents/${r.id}`, { method: "DELETE" }); await load() } catch (e) { setErr(String((e as Error).message)) }
  }
  async function addLink() {
    if (!linkFor || !linkUnit) return
    try {
      await api("/api/panel/residents", { method: "POST", body: JSON.stringify({ kind: "link", residentId: linkFor.id, unitId: linkUnit, role: linkRole }) })
      setLinkFor(null); setLinkUnit(""); await load()
    } catch (e) { setErr(String((e as Error).message)) }
  }
  async function removeLink(l: Link) {
    try { await api(`/api/panel/residents/${l.resident_id}?link=${l.id}`, { method: "DELETE" }); await load() } catch (e) { setErr(String((e as Error).message)) }
  }
  async function genAccess(r: Resident) {
    try {
      const d = await api("/api/panel/residents/access", { method: "POST", body: JSON.stringify({ residentId: r.id }) })
      setCodeInfo({ name: r.full_name, code: String(d.code), phone: r.phone })
    } catch (e) { setErr(String((e as Error).message)) }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Residentes</h1>
        <button onClick={() => { setForm({ ...emptyResForm }); setShowForm((v) => !v) }} style={btnPrimary}>+ Nuevo residente</button>
      </div>
      {err && <div style={errBox}>{err}</div>}

      {showForm && (
        <Card>
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <Field label="Nombre completo *"><input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} style={input} /></Field>
            <Field label="Documento">
              <div style={{ display: "flex", gap: 6 }}>
                <select value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })} style={{ ...input, width: 90 }}>
                  {["cedula", "pasaporte", "rif", "otro"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} style={{ ...input, flex: 1 }} />
              </div>
            </Field>
            <Field label="Teléfono / WhatsApp"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+58…" style={input} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} /></Field>
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, marginTop: 4 }}>
              <button type="submit" style={btnPrimary}>{form.id ? "Guardar cambios" : "Crear residente"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btnGhost}>Cancelar</button>
            </div>
          </form>
        </Card>
      )}

      <div style={{ marginTop: 14 }}>
        <Card>
          {loading ? <p style={{ color: "#5b6b82" }}>Cargando…</p> : residents.length === 0 ? (
            <p style={{ color: "#5b6b82", margin: 0 }}>Aún no hay residentes. Crea el primero con “+ Nuevo residente”.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Nombre", "Documento", "Contacto", "Unidades", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {residents.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{r.full_name}</td>
                      <td style={td}>{r.document_number ? `${r.document_type} ${r.document_number}` : "—"}</td>
                      <td style={td}>{[r.phone, r.email].filter(Boolean).join(" · ") || "—"}</td>
                      <td style={td}>
                        {(linksByResident[r.id] || []).map((l) => (
                          <span key={l.id} style={chip} onClick={() => removeLink(l)} title="Clic para quitar">
                            {l.units?.code || "unidad"} · {l.role} ✕
                          </span>
                        ))}
                        <button onClick={() => { setLinkFor(r); setLinkUnit(""); setLinkRole("propietario") }} style={btnMini}>+ vincular</button>
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button onClick={() => genAccess(r)} style={btnMini} title="Genera el código para que entre a su cuenta">🔑 acceso</button>
                        <button onClick={() => edit(r)} style={btnMini}>Editar</button>
                        <button onClick={() => remove(r)} style={btnMiniDanger}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {linkFor && (
        <div style={modalWrap} onClick={() => setLinkFor(null)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px" }}>Vincular {linkFor.full_name} a una unidad</h3>
            <select value={linkUnit} onChange={(e) => setLinkUnit(e.target.value)} style={{ ...input, width: "100%", marginBottom: 10 }}>
              <option value="">Elige unidad…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.code}{u.tower ? ` (Torre ${u.tower})` : ""}</option>)}
            </select>
            <select value={linkRole} onChange={(e) => setLinkRole(e.target.value)} style={{ ...input, width: "100%", marginBottom: 14 }}>
              {RES_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={addLink} disabled={!linkUnit} style={btnPrimary}>Vincular</button>
              <button onClick={() => setLinkFor(null)} style={btnGhost}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {codeInfo && (
        <div style={modalWrap} onClick={() => setCodeInfo(null)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 6px" }}>Código de acceso</h3>
            <p style={{ margin: "0 0 12px", color: "#5b6b82", fontSize: 14 }}>Entrégaselo a <b>{codeInfo.name}</b>. Entrará en <b>/mi-cuenta</b> con su teléfono y este código.</p>
            <div style={{ textAlign: "center", background: "#eef3fb", borderRadius: 12, padding: "16px", fontSize: 34, fontWeight: 800, letterSpacing: 6, color: "#1554b8" }}>{codeInfo.code}</div>
            {codeInfo.phone && <p style={{ textAlign: "center", color: "#8494a8", fontSize: 13, marginTop: 8 }}>Teléfono registrado: {codeInfo.phone}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => { navigator.clipboard?.writeText(codeInfo.code); }} style={btnGhost}>Copiar código</button>
              <button onClick={() => setCodeInfo(null)} style={btnPrimary}>Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- pequeños helpers de UI ----------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "block" }}><span style={{ fontSize: 12, fontWeight: 600, color: "#16324f" }}>{label}</span><div style={{ marginTop: 4 }}>{children}</div></label>
}

const input: React.CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: 10, border: "1px solid #d5deeb", fontSize: 14, background: "#fff", color: "#0a1a30" }
const btnPrimary: React.CSSProperties = { background: "#1f6feb", color: "#fff", border: 0, borderRadius: 10, padding: "9px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" }
const btnGhost: React.CSSProperties = { background: "#eef3fb", color: "#16324f", border: 0, borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" }
const btnMini: React.CSSProperties = { background: "#eef3fb", color: "#1554b8", border: 0, borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginRight: 6 }
const btnMiniDanger: React.CSSProperties = { ...btnMini, background: "#fdecea", color: "#c0392b", marginRight: 0 }
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14 }
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #eef1f6", fontSize: 12, color: "#5b6b82", fontWeight: 700 }
const td: React.CSSProperties = { padding: "10px", borderBottom: "1px solid #f0f3f8" }
const errBox: React.CSSProperties = { background: "#fdecea", color: "#c0392b", padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 14 }
const chip: React.CSSProperties = { display: "inline-block", background: "#eef3fb", color: "#1554b8", borderRadius: 999, padding: "3px 9px", fontSize: 12, marginRight: 6, marginBottom: 4, cursor: "pointer" }
const modalWrap: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(10,26,48,.45)", display: "grid", placeItems: "center", padding: 20, zIndex: 50 }
const modalBox: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 22, width: "100%", maxWidth: 400 }

function badge(status: string): React.CSSProperties {
  const map: Record<string, string> = { activa: "#e6f4ea|#1e874b", desocupada: "#eef3fb|#1554b8", en_mora: "#fdecea|#c0392b", inactiva: "#f0f0f0|#6b7280" }
  const [bg, fg] = (map[status] || "#eef3fb|#1554b8").split("|")
  return { background: bg, color: fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }
}

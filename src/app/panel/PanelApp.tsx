"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import ImageField from "@/components/ImageField"
import { slugify as slugPreview, parseProductsInput, productsToInput, sanitizeProducts } from "@/lib/mallText"

// Cada vista carga sus datos al montar con el patrón useEffect(() => load(),
// [load]) (load es un useCallback que hace setState tras el fetch). Es
// intencional y uniforme en todo el panel; desactivamos la regla nueva del
// plugin que lo desaconseja para no fragmentar el patrón.
/* eslint-disable react-hooks/set-state-in-effect */

// ============================================================
// Panel administrativo de condominio — Concepto La Granja
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
  commercial_name?: string
  activity?: string
  logo_url?: string
  microsite_enabled?: boolean
  microsite_slug?: string
  tagline?: string
  description?: string
  phone?: string
  microsite_whatsapp?: string
  instagram?: string
  website_url?: string
  hours?: string
  promo?: string
  cover_url?: string
  featured_products?: unknown
  accent_color?: string
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
type Summary = {
  unitsCount: number; residentsCount: number; alicuotaSum: number; balanceDue: number
  occupied?: number; available?: number; delinquent?: number
  leasesActive?: number; leasesExpiring?: number
  income?: { canon: number; condominio: number; renta_pct: number; estacionamiento: number; publicidad: number; total: number }
}

type Tab = "resumen" | "unidades" | "residentes" | "contratos" | "ventas" | "cuotas" | "estado" | "galeria" | "amenidades" | "incidencias" | "estacionamiento" | "publicidad" | "consultorios" | "atencion" | "fidelidad" | "comunicados" | "asambleas" | "accesos" | "documentos" | "fiscal"

const UNIT_STATUS = ["disponible", "ocupado", "reservado", "mantenimiento", "inactivo"]
const RES_ROLES = ["propietario", "inquilino", "encargado", "autorizado"]
// Rubros comerciales (para clasificar el local y el directorio público)
const ACTIVITIES = ["comida", "moda", "salud", "belleza", "electronica", "hogar", "servicios", "banco", "consultorio", "oficina", "kiosco", "entretenimiento", "supermercado", "otro"]

const MODULES: { key: Tab | string; label: string; icon: string; ready: boolean }[] = [
  { key: "resumen", label: "Resumen", icon: "▦", ready: true },
  { key: "unidades", label: "Locales", icon: "🏬", ready: true },
  { key: "residentes", label: "Comerciantes", icon: "🧑‍💼", ready: true },
  { key: "contratos", label: "Contratos", icon: "📑", ready: true },
  { key: "ventas", label: "Ventas (renta %)", icon: "📈", ready: true },
  { key: "cuotas", label: "Canon y condominio", icon: "🧾", ready: true },
  { key: "estado", label: "Estado de cuenta", icon: "💳", ready: true },
  { key: "galeria", label: "Galería", icon: "🖼️", ready: true },
  { key: "amenidades", label: "Áreas comunes", icon: "🏊", ready: true },
  { key: "incidencias", label: "Incidencias", icon: "🛠️", ready: true },
  { key: "estacionamiento", label: "Estacionamiento", icon: "🅿️", ready: true },
  { key: "publicidad", label: "Publicidad", icon: "📢", ready: true },
  { key: "consultorios", label: "Consultorios", icon: "🩺", ready: true },
  { key: "atencion", label: "Atención al cliente", icon: "💬", ready: true },
  { key: "fidelidad", label: "Fidelidad", icon: "⭐", ready: true },
  { key: "comunicados", label: "Comunicados", icon: "📣", ready: true },
  { key: "asambleas", label: "Asambleas", icon: "🗳️", ready: true },
  { key: "accesos", label: "Accesos", icon: "🚪", ready: true },
  { key: "documentos", label: "Documentos", icon: "📄", ready: true },
  { key: "fiscal", label: "Fiscal", icon: "🏛️", ready: true },
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
          {tab === "contratos" && <ContratosView api={api} />}
          {tab === "ventas" && <VentasView api={api} />}
          {tab === "cuotas" && <CuotasView api={api} />}
          {tab === "estado" && <EstadoView api={api} />}
          {tab === "galeria" && <GaleriaView api={api} />}
          {tab === "amenidades" && <AmenidadesView api={api} />}
          {tab === "incidencias" && <IncidenciasView api={api} />}
          {tab === "estacionamiento" && <EstacionamientoView api={api} />}
          {tab === "publicidad" && <PublicidadView api={api} />}
          {tab === "consultorios" && <ConsultoriosView api={api} />}
          {tab === "atencion" && <AtencionView api={api} />}
          {tab === "fidelidad" && <FidelidadView api={api} />}
          {tab === "comunicados" && <ComunicadosView api={api} />}
          {tab === "asambleas" && <AsambleasView api={api} />}
          {tab === "accesos" && <AccesosView api={api} />}
          {tab === "documentos" && <DocumentosView api={api} />}
          {tab === "fiscal" && <FiscalView api={api} />}
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
          <img src="/concepto-logo.png" alt="" width={48} height={48} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#0a1a30" }}>Concepto La Granja</div>
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
        <img src="/concepto-logo.png" alt="" width={34} height={34} />
        <div style={{ fontWeight: 800 }}>Concepto La Granja</div>
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
      a.href = url; a.download = `concepto-respaldo-${new Date().toISOString().slice(0, 10)}.json`
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
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 16px" }}>Resumen del centro comercial</h1>
      {err && <div style={{ color: "#c0392b", marginBottom: 12 }}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <Stat label="Locales" value={s ? String(s.unitsCount) : "…"} hint={s ? `${s.occupied ?? 0} ocupados · ${s.available ?? 0} disponibles` : ""} onClick={() => goTo("unidades")} />
        <Stat label="Contratos activos" value={s ? String(s.leasesActive ?? 0) : "…"} hint={s && (s.leasesExpiring ?? 0) > 0 ? `⏰ ${s.leasesExpiring} por vencer` : "al día"} hintColor={s && (s.leasesExpiring ?? 0) > 0 ? "#b26a00" : "#1e874b"} onClick={() => goTo("contratos")} />
        <Stat label="Morosidad" value={s ? money(s.balanceDue) : "…"} hint={s ? `${s.delinquent ?? 0} local(es) con saldo` : ""} hintColor="#c0392b" onClick={() => goTo("estado")} />
        <Stat label="Ingresos del mes" value={s?.income ? money(s.income.total) : "…"} hint="canon + servicios" hintColor="#1e874b" />
      </div>

      {s?.income && (
        <div style={{ marginTop: 14 }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Ingresos del mes por fuente</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 }}>
              <IncomeCell label="Canon" value={money(s.income.canon)} icon="🏬" />
              <IncomeCell label="Condominio" value={money(s.income.condominio)} icon="🧾" />
              <IncomeCell label="Renta %" value={money(s.income.renta_pct)} icon="📈" />
              <IncomeCell label="Estacionamiento" value={money(s.income.estacionamiento)} icon="🅿️" />
              <IncomeCell label="Publicidad" value={money(s.income.publicidad)} icon="📢" />
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#8494a8" }}>
              Suma de lo emitido/cobrado este mes. La alícuota total {alicuotaOk ? "cuadra en 100 %" : <b style={{ color: "#c0392b" }}>no suma 100 % ({pct(s.alicuotaSum)})</b>}.
            </div>
          </Card>
        </div>
      )}
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

function IncomeCell({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div style={{ background: "#f6fbfe", borderRadius: 12, padding: 12, border: "1px solid #eaf3f8" }}>
      <div style={{ fontSize: 12, color: "#5b6b82", fontWeight: 600 }}>{icon} {label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: "#0c2432", marginTop: 2 }}>{value}</div>
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
  id: "", code: "", commercialName: "", activity: "", logoUrl: "", tower: "", floor: "", unitTypeId: "", areaM2: "", alicuotaPct: "", parkingSlots: "0", storageSlots: "0", status: "disponible", notes: "",
  // Micrositio ("la web" del local)
  micrositeEnabled: false, micrositeSlug: "", tagline: "", description: "", phone: "", micrositeWhatsapp: "", instagram: "", websiteUrl: "", hours: "", promo: "", coverUrl: "",
  accentColor: "", productsText: "",
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
      id: u.id, code: u.code, commercialName: u.commercial_name || "", activity: u.activity || "", logoUrl: u.logo_url || "",
      tower: u.tower || "", floor: u.floor || "", unitTypeId: u.unit_type_id || "",
      areaM2: String(u.area_m2 || ""), alicuotaPct: String(((u.alicuota || 0) * 100) || ""),
      parkingSlots: String(u.parking_slots || 0), storageSlots: String(u.storage_slots || 0), status: u.status || "disponible", notes: u.notes || "",
      micrositeEnabled: !!u.microsite_enabled, micrositeSlug: u.microsite_slug || "", tagline: u.tagline || "", description: u.description || "",
      phone: u.phone || "", micrositeWhatsapp: u.microsite_whatsapp || "", instagram: u.instagram || "", websiteUrl: u.website_url || "",
      hours: u.hours || "", promo: u.promo || "", coverUrl: u.cover_url || "",
      accentColor: u.accent_color || "", productsText: productsToInput(sanitizeProducts(u.featured_products)),
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
          id: form.id || undefined, code: form.code, commercialName: form.commercialName, activity: form.activity, logoUrl: form.logoUrl,
          tower: form.tower, floor: form.floor, unitTypeId: form.unitTypeId,
          areaM2: Number(form.areaM2 || 0), alicuota: Number(form.alicuotaPct || 0) / 100,
          parkingSlots: Number(form.parkingSlots || 0), storageSlots: Number(form.storageSlots || 0), status: form.status, notes: form.notes,
          micrositeEnabled: form.micrositeEnabled, micrositeSlug: form.micrositeSlug, tagline: form.tagline, description: form.description,
          phone: form.phone, micrositeWhatsapp: form.micrositeWhatsapp, instagram: form.instagram, websiteUrl: form.websiteUrl,
          hours: form.hours, promo: form.promo, coverUrl: form.coverUrl,
          accentColor: form.accentColor, featuredProducts: parseProductsInput(form.productsText),
        }),
      })
      setForm({ ...emptyUnitForm }); setShowForm(false); await load()
    } catch (e) { setErr(String((e as Error).message)) }
  }

  async function remove(u: Unit) {
    if (!confirm(`¿Eliminar el local ${u.code}?`)) return
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
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Locales</h1>
        <span style={{ fontSize: 13, color: Math.abs(alicuotaSum - 1) < 0.005 ? "#1e874b" : "#c0392b" }}>Alícuota total: {pct(alicuotaSum)}</span>
        <button onClick={() => { setForm({ ...emptyUnitForm }); setShowForm((v) => !v) }} style={btnPrimary}>+ Nuevo local</button>
      </div>
      {err && <div style={errBox}>{err}</div>}

      {showForm && (
        <Card>
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <Field label="Código *"><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Local 3" style={input} /></Field>
            <Field label="Nombre comercial"><input value={form.commercialName} onChange={(e) => setForm({ ...form, commercialName: e.target.value })} placeholder="Beco, Capitán Grill…" style={input} /></Field>
            <Field label="Rubro">
              <select value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} style={input}>
                <option value="">—</option>
                {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Logo"><ImageField value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} api={api} endpoint="/api/panel/upload-image" folder="logos" round /></Field>
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
            {/* MICROSITIO — la "web" del local dentro del portal del centro comercial */}
            <div style={{ gridColumn: "1/-1", borderTop: "1px solid #e6eef5", marginTop: 6, paddingTop: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox" checked={form.micrositeEnabled} onChange={(e) => setForm({ ...form, micrositeEnabled: e.target.checked })} />
                🌐 Publicar micrositio (la web del local)
              </label>
              <p style={{ fontSize: 12, color: "#7c93a6", margin: "4px 0 0" }}>
                Al publicarlo, la tarjeta del directorio enlaza a <code>/tienda/{form.micrositeSlug || slugPreview(form.commercialName)}</code>.
              </p>
            </div>
            {form.micrositeEnabled && (
              <>
                <Field label="URL amigable (slug)"><input value={form.micrositeSlug} onChange={(e) => setForm({ ...form, micrositeSlug: e.target.value })} placeholder={slugPreview(form.commercialName) || "capitan-grill"} style={input} /></Field>
                <Field label="Frase corta (tagline)"><input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Las mejores hamburguesas" style={input} /></Field>
                <div style={{ gridColumn: "1/-1" }}>
                  <Field label="Portada"><ImageField value={form.coverUrl} onChange={(url) => setForm({ ...form, coverUrl: url })} api={api} endpoint="/api/panel/upload-image" folder="portadas" /></Field>
                </div>
                <Field label="Teléfono"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0241-…" style={input} /></Field>
                <Field label="WhatsApp del local"><input value={form.micrositeWhatsapp} onChange={(e) => setForm({ ...form, micrositeWhatsapp: e.target.value })} placeholder="58412…" style={input} /></Field>
                <Field label="Instagram"><input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@usuario" style={input} /></Field>
                <Field label="Sitio web propio"><input value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://…" style={input} /></Field>
                <Field label="Promoción vigente"><input value={form.promo} onChange={(e) => setForm({ ...form, promo: e.target.value })} placeholder="2x1 los martes" style={input} /></Field>
                <Field label="Color del sitio">
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form.accentColor) ? form.accentColor : "#0f9bd7"} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} style={{ width: 44, height: 38, padding: 2, border: "1px solid #cfe0ec", borderRadius: 10, background: "#fff", cursor: "pointer" }} />
                    {form.accentColor ? (
                      <button type="button" onClick={() => setForm({ ...form, accentColor: "" })} style={{ ...btnGhost, padding: "8px 10px", fontSize: 12 }}>Usar el del rubro</button>
                    ) : (
                      <span style={{ fontSize: 12, color: "#7c93a6" }}>Ahora: color del rubro</span>
                    )}
                  </div>
                </Field>
                <div style={{ gridColumn: "1/-1" }}>
                  <Field label="Horario"><textarea value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder={"Lun–Sáb 10:00–20:00\nDom 11:00–18:00"} style={{ ...input, minHeight: 54, resize: "vertical" }} /></Field>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <Field label="Descripción / Sobre nosotros"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Cuéntale a los visitantes qué ofreces…" style={{ ...input, minHeight: 80, resize: "vertical" }} /></Field>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <Field label="Productos y precios (uno por línea: Nombre | precio | url de imagen | descripción)">
                    <textarea value={form.productsText} onChange={(e) => setForm({ ...form, productsText: e.target.value })} placeholder={"Hamburguesa Clásica | 6 | https://… | Carne 100% res\nPapas | 2.5"} style={{ ...input, minHeight: 90, resize: "vertical", fontFamily: "ui-monospace, monospace", fontSize: 13 }} />
                  </Field>
                </div>
              </>
            )}
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
              <button type="submit" style={btnPrimary}>{form.id ? "Guardar cambios" : "Crear local"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btnGhost}>Cancelar</button>
              {form.micrositeEnabled && form.id && (form.micrositeSlug || form.commercialName) && (
                <a href={`/tienda/${form.micrositeSlug || slugPreview(form.commercialName)}`} target="_blank" rel="noopener" style={{ ...btnGhost, textDecoration: "none" }}>Ver micrositio ↗</a>
              )}
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
            <p style={{ color: "#5b6b82", margin: 0 }}>Aún no hay locales. Crea el primero con “+ Nuevo local”.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Código", "Nombre comercial", "Rubro", "Piso", "m²", "Alícuota", "Estado", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{u.code}</td>
                      <td style={td}>{u.commercial_name || <span style={{ color: "#98a6ba" }}>—</span>}</td>
                      <td style={td}>{u.activity || "—"}</td>
                      <td style={td}>{u.floor || "—"}</td>
                      <td style={td}>{u.area_m2 || "—"}</td>
                      <td style={td}>{pct(u.alicuota)}</td>
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
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Comerciantes</h1>
        <button onClick={() => { setForm({ ...emptyResForm }); setShowForm((v) => !v) }} style={btnPrimary}>+ Nuevo comerciante</button>
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
              <button type="submit" style={btnPrimary}>{form.id ? "Guardar cambios" : "Crear comerciante"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btnGhost}>Cancelar</button>
            </div>
          </form>
        </Card>
      )}

      <div style={{ marginTop: 14 }}>
        <Card>
          {loading ? <p style={{ color: "#5b6b82" }}>Cargando…</p> : residents.length === 0 ? (
            <p style={{ color: "#5b6b82", margin: 0 }}>Aún no hay comerciantes. Crea el primero con “+ Nuevo comerciante”.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Nombre", "Documento", "Contacto", "Locales", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
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

// ---------- Contratos de arrendamiento ----------
type Lease = {
  id: string; code: string; status: string; unit_id: string; resident_id: string | null
  starts_on: string | null; ends_on: string | null
  canon_amount: number; canon_currency: string; condo_included: boolean
  due_day: number; late_fee_percent: number
  deposit_amount: number; deposit_currency: string
  percentage_rent: boolean; percentage_rent_rate: number; percentage_rent_min: number
  guarantor_name: string; guarantor_phone: string; notes: string
  units?: { code?: string; commercial_name?: string } | null
  residents?: { full_name?: string } | null
}
const LEASE_STATUS = ["borrador", "activo", "por_vencer", "vencido", "renovado", "terminado"]
const emptyLeaseForm = {
  id: "", unitId: "", residentId: "", code: "", status: "activo", startsOn: "", endsOn: "",
  canonAmount: "", canonCurrency: "USD", condoIncluded: false, dueDay: "5", lateFeePercent: "0",
  depositAmount: "", depositCurrency: "USD", percentageRent: false, percentageRentRate: "", percentageRentMin: "",
  guarantorName: "", guarantorPhone: "", notes: "",
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso + "T00:00:00")
  if (isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}

function ContratosView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [leases, setLeases] = useState<Lease[]>([])
  const [units, setUnits] = useState<{ id: string; code: string; commercial_name?: string }[]>([])
  const [residents, setResidents] = useState<{ id: string; full_name: string }[]>([])
  const [form, setForm] = useState({ ...emptyLeaseForm })
  const [showForm, setShowForm] = useState(false)
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api("/api/panel/leases")
      setLeases((d.leases as Lease[]) || [])
      setUnits((d.units as { id: string; code: string; commercial_name?: string }[]) || [])
      setResidents((d.residents as { id: string; full_name: string }[]) || [])
    } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }, [api])
  useEffect(() => { load() }, [load])

  function edit(l: Lease) {
    setForm({
      id: l.id, unitId: l.unit_id, residentId: l.resident_id || "", code: l.code || "", status: l.status || "activo",
      startsOn: l.starts_on || "", endsOn: l.ends_on || "",
      canonAmount: String(l.canon_amount || ""), canonCurrency: l.canon_currency || "USD", condoIncluded: !!l.condo_included,
      dueDay: String(l.due_day || 5), lateFeePercent: String(l.late_fee_percent || 0),
      depositAmount: String(l.deposit_amount || ""), depositCurrency: l.deposit_currency || "USD",
      percentageRent: !!l.percentage_rent, percentageRentRate: String(l.percentage_rent_rate || ""), percentageRentMin: String(l.percentage_rent_min || ""),
      guarantorName: l.guarantor_name || "", guarantorPhone: l.guarantor_phone || "", notes: l.notes || "",
    })
    setShowForm(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErr("")
    if (!form.unitId) { setErr("Elige el local"); return }
    try {
      await api("/api/panel/leases", {
        method: "POST",
        body: JSON.stringify({
          id: form.id || undefined, unitId: form.unitId, residentId: form.residentId || undefined, code: form.code, status: form.status,
          startsOn: form.startsOn, endsOn: form.endsOn,
          canonAmount: Number(form.canonAmount || 0), canonCurrency: form.canonCurrency, condoIncluded: form.condoIncluded,
          dueDay: Number(form.dueDay || 5), lateFeePercent: Number(form.lateFeePercent || 0),
          depositAmount: Number(form.depositAmount || 0), depositCurrency: form.depositCurrency,
          percentageRent: form.percentageRent, percentageRentRate: Number(form.percentageRentRate || 0), percentageRentMin: Number(form.percentageRentMin || 0),
          guarantorName: form.guarantorName, guarantorPhone: form.guarantorPhone, notes: form.notes,
        }),
      })
      setForm({ ...emptyLeaseForm }); setShowForm(false); await load()
    } catch (e) { setErr(String((e as Error).message)) }
  }

  const unitLabel = (l: Lease) => l.units?.commercial_name || l.units?.code || "—"
  const expiring = leases.filter((l) => l.status === "activo" && (daysUntil(l.ends_on) ?? 999) <= 60 && (daysUntil(l.ends_on) ?? -1) >= 0)

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Contratos</h1>
        <button onClick={() => { setForm({ ...emptyLeaseForm }); setShowForm((v) => !v) }} style={btnPrimary}>+ Nuevo contrato</button>
      </div>
      {err && <div style={errBox}>{err}</div>}
      {expiring.length > 0 && (
        <div style={{ background: "#fff5e6", border: "1px solid #f4c77d", color: "#8a5a00", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 14 }}>
          ⏰ {expiring.length} contrato(s) por vencer en los próximos 60 días: {expiring.map((l) => unitLabel(l)).join(", ")}
        </div>
      )}

      {showForm && (
        <Card>
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <Field label="Local *">
              <select required value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} style={input}>
                <option value="">—</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.commercial_name ? `${u.commercial_name} (${u.code})` : u.code}</option>)}
              </select>
            </Field>
            <Field label="Comerciante">
              <select value={form.residentId} onChange={(e) => setForm({ ...form, residentId: e.target.value })} style={input}>
                <option value="">—</option>
                {residents.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </Field>
            <Field label="N° contrato"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="C-2026-001" style={input} /></Field>
            <Field label="Estado">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
                {LEASE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Inicio"><input type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} style={input} /></Field>
            <Field label="Vencimiento"><input type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} style={input} /></Field>
            <Field label="Canon mensual">
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" step="0.01" value={form.canonAmount} onChange={(e) => setForm({ ...form, canonAmount: e.target.value })} style={{ ...input, flex: 1 }} />
                <select value={form.canonCurrency} onChange={(e) => setForm({ ...form, canonCurrency: e.target.value })} style={{ ...input, width: 76 }}>
                  <option value="USD">USD</option><option value="VES">Bs</option><option value="EUR">EUR</option>
                </select>
              </div>
            </Field>
            <Field label="Depósito garantía"><input type="number" step="0.01" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} style={input} /></Field>
            <Field label="Día de vencimiento"><input type="number" min="1" max="28" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} style={input} /></Field>
            <Field label="Recargo mora (%)"><input type="number" step="0.01" value={form.lateFeePercent} onChange={(e) => setForm({ ...form, lateFeePercent: e.target.value })} style={input} /></Field>
            <Field label="Fiador"><input value={form.guarantorName} onChange={(e) => setForm({ ...form, guarantorName: e.target.value })} style={input} /></Field>
            <Field label="Tel. fiador"><input value={form.guarantorPhone} onChange={(e) => setForm({ ...form, guarantorPhone: e.target.value })} style={input} /></Field>
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", background: "#f6fbfe", borderRadius: 10, padding: "8px 12px" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, fontWeight: 600 }}>
                <input type="checkbox" checked={form.percentageRent} onChange={(e) => setForm({ ...form, percentageRent: e.target.checked })} /> Renta porcentual (sobre ventas)
              </label>
              {form.percentageRent && (
                <>
                  <label style={{ fontSize: 13, color: "#3f5a6b" }}>Tasa %: <input type="number" step="0.01" value={form.percentageRentRate} onChange={(e) => setForm({ ...form, percentageRentRate: e.target.value })} style={{ ...input, width: 90, display: "inline-block" }} /></label>
                  <label style={{ fontSize: 13, color: "#3f5a6b" }}>Canon mínimo: <input type="number" step="0.01" value={form.percentageRentMin} onChange={(e) => setForm({ ...form, percentageRentMin: e.target.value })} style={{ ...input, width: 100, display: "inline-block" }} /></label>
                </>
              )}
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
                <input type="checkbox" checked={form.condoIncluded} onChange={(e) => setForm({ ...form, condoIncluded: e.target.checked })} /> El canon incluye condominio
              </label>
            </div>
            <Field label="Notas"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={input} /></Field>
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, marginTop: 4 }}>
              <button type="submit" style={btnPrimary}>{form.id ? "Guardar cambios" : "Crear contrato"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btnGhost}>Cancelar</button>
            </div>
          </form>
        </Card>
      )}

      <div style={{ marginTop: 14 }}>
        <Card>
          {loading ? <p style={{ color: "#5b6b82" }}>Cargando…</p> : leases.length === 0 ? (
            <p style={{ color: "#5b6b82", margin: 0 }}>Aún no hay contratos. Crea el primero con “+ Nuevo contrato”.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Local", "Comerciante", "Canon", "Vigencia", "Renta %", "Estado", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {leases.map((l) => {
                    const du = daysUntil(l.ends_on)
                    const soon = l.status === "activo" && du !== null && du >= 0 && du <= 60
                    return (
                      <tr key={l.id}>
                        <td style={{ ...td, fontWeight: 700 }}>{unitLabel(l)}</td>
                        <td style={td}>{l.residents?.full_name || "—"}</td>
                        <td style={td}>{l.canon_amount ? `${l.canon_currency === "VES" ? "Bs" : "$"}${l.canon_amount}` : "—"}</td>
                        <td style={td}>
                          {l.starts_on || "—"} → {l.ends_on || "—"}
                          {soon && <span style={{ color: "#b26a00", fontSize: 12, fontWeight: 700 }}> · vence en {du}d</span>}
                        </td>
                        <td style={td}>{l.percentage_rent ? `${l.percentage_rent_rate}%` : "—"}</td>
                        <td style={td}><span style={badge(l.status)}>{l.status}</span></td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>
                          <button onClick={() => edit(l)} style={btnMini}>Editar</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ---------- Ventas (renta porcentual) ----------
type PctLease = { id: string; unit_id: string; percentage_rent_rate: number; percentage_rent_min: number; units?: { code?: string; commercial_name?: string } | null }
type SaleRow = { lease_id: string; gross_sales: number }

function VentasView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`)
  const [leases, setLeases] = useState<PctLease[]>([])
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [err, setErr] = useState("")
  const [msg, setMsg] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setErr("")
    try {
      const d = await api(`/api/panel/sales?month=${encodeURIComponent(month)}`)
      const ls = (d.leases as PctLease[]) || []
      const sales = (d.sales as SaleRow[]) || []
      setLeases(ls)
      const map: Record<string, string> = {}
      for (const s of sales) map[s.lease_id] = String(s.gross_sales ?? "")
      setInputs(map)
    } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }, [api, month])
  useEffect(() => { load() }, [load])

  async function save(l: PctLease) {
    setSavingId(l.id); setErr(""); setMsg("")
    try {
      await api("/api/panel/sales", { method: "POST", body: JSON.stringify({ leaseId: l.id, unitId: l.unit_id, periodMonth: month, grossSales: Number(inputs[l.id] || 0) }) })
      setMsg("✓ Ventas guardadas")
    } catch (e) { setErr(String((e as Error).message)) } finally { setSavingId("") }
  }

  const label = (l: PctLease) => l.units?.commercial_name || l.units?.code || "—"
  const estPct = (l: PctLease) => Math.max(0, Number(inputs[l.id] || 0) * (Number(l.percentage_rent_rate) / 100) - Number(l.percentage_rent_min))

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Ventas · renta porcentual</h1>
        <label style={{ fontSize: 13, color: "#3f5a6b" }}>Mes: <input type="date" value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...input, width: 160, display: "inline-block" }} /></label>
      </div>
      <p style={{ margin: "0 0 12px", color: "#5b6b82", fontSize: 13 }}>Registra las ventas brutas del mes de cada local con <b>renta porcentual</b>. Al emitir el cobro del mes, se cobra el excedente de (ventas × tasa) sobre el mínimo garantizado.</p>
      {err && <div style={errBox}>{err}</div>}
      {msg && <div style={{ ...errBox, background: "#e6f4ea", color: "#1e874b" }}>{msg}</div>}
      <Card>
        {loading ? <p style={{ color: "#5b6b82" }}>Cargando…</p> : leases.length === 0 ? (
          <p style={{ color: "#5b6b82", margin: 0 }}>Ningún contrato activo tiene renta porcentual. Actívala en <b>Contratos</b> (casilla “Renta porcentual”).</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead><tr>{["Local", "Tasa %", "Mínimo", "Ventas del mes", "Renta % estimada", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {leases.map((l) => (
                  <tr key={l.id}>
                    <td style={{ ...td, fontWeight: 700 }}>{label(l)}</td>
                    <td style={td}>{l.percentage_rent_rate}%</td>
                    <td style={td}>${l.percentage_rent_min}</td>
                    <td style={td}><input type="number" step="0.01" value={inputs[l.id] || ""} onChange={(e) => setInputs({ ...inputs, [l.id]: e.target.value })} placeholder="0.00" style={{ ...input, width: 130 }} /></td>
                    <td style={{ ...td, fontWeight: 700, color: estPct(l) > 0 ? "#1e874b" : "#98a6ba" }}>${round2ui(estPct(l))}</td>
                    <td style={td}><button onClick={() => save(l)} disabled={savingId === l.id} style={btnMini}>{savingId === l.id ? "…" : "Guardar"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
function round2ui(n: number) { return Math.round(n * 100) / 100 }

// ---------- Cuotas ----------
type Period = { id: string; label: string; period_month: string; status: string; due_date: string | null; common_expense_total: number; issued_at: string | null }

function CuotasView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [periods, setPeriods] = useState<Period[]>([])
  const [err, setErr] = useState("")
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const [form, setForm] = useState({ periodMonth: firstOfMonth, commonExpenseTotal: "", dueDate: "" })

  const load = useCallback(async () => {
    try { const d = await api("/api/panel/periods"); setPeriods((d.periods as Period[]) || []) } catch (e) { setErr(String((e as Error).message)) }
  }, [api])
  useEffect(() => { load() }, [load])

  async function emit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(""); setMsg("")
    try {
      const d = await api("/api/panel/periods", { method: "POST", body: JSON.stringify({ action: "emit", periodMonth: form.periodMonth, label: form.periodMonth.slice(0, 7), commonExpenseTotal: Number(form.commonExpenseTotal || 0), dueDate: form.dueDate || undefined }) })
      setMsg(`✓ Emitido a ${d.unitsEmitted} local(es) · canon + condominio · total ${money(Number(d.totalEmitted || 0))}`)
      setForm({ ...form, commonExpenseTotal: "" }); await load()
    } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 14px" }}>Canon y condominio</h1>
      {err && <div style={errBox}>{err}</div>}
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Emitir cobro del mes</div>
        <p style={{ margin: "0 0 12px", color: "#5b6b82", fontSize: 13 }}>Se cobra a los locales <b>ocupados o con contrato activo</b>: el gasto común se prorratea por <b>alícuota</b> (condominio) y se agrega el <b>canon</b> de cada contrato activo. Cada local recibe su cargo y su recibo.</p>
        <form onSubmit={emit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, alignItems: "end" }}>
          <Field label="Mes"><input type="date" value={form.periodMonth} onChange={(e) => setForm({ ...form, periodMonth: e.target.value })} style={input} /></Field>
          <Field label="Gasto común total ($)"><input type="number" step="0.01" required value={form.commonExpenseTotal} onChange={(e) => setForm({ ...form, commonExpenseTotal: e.target.value })} placeholder="2500" style={input} /></Field>
          <Field label="Vence"><input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={input} /></Field>
          <button type="submit" disabled={busy} style={btnPrimary}>{busy ? "Emitiendo…" : "Emitir cobro"}</button>
        </form>
        {msg && <div style={{ marginTop: 10, color: "#1e874b", fontSize: 14 }}>{msg}</div>}
      </Card>

      <div style={{ marginTop: 14 }}>
        <Card>
          {periods.length === 0 ? <p style={{ color: "#5b6b82", margin: 0 }}>Aún no has emitido ningún período.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Período", "Mes", "Gasto común", "Vence", "Estado"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{p.label}</td>
                      <td style={td}>{p.period_month}</td>
                      <td style={td}>{money(p.common_expense_total)}</td>
                      <td style={td}>{p.due_date || "—"}</td>
                      <td style={td}><span style={badge(p.status === "emitido" ? "activa" : "desocupada")}>{p.status}</span></td>
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

// ---------- Estado de cuenta / Pagos ----------
type UnitBalance = { id: string; code: string; tower: string; balance: number; status: string }
type PaymentRow = { id: string; unit_id: string; amount: number; method: string; reference: string; status: string; paid_on: string }

function EstadoView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [units, setUnits] = useState<UnitBalance[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(true)
  const [payFor, setPayFor] = useState<UnitBalance | null>(null)
  const [payForm, setPayForm] = useState({ amount: "", method: "transferencia", reference: "", paidOn: "" })

  const load = useCallback(async () => {
    setLoading(true)
    try { const d = await api("/api/panel/payments"); setUnits((d.units as UnitBalance[]) || []); setPayments((d.payments as PaymentRow[]) || []) } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }, [api])
  useEffect(() => { load() }, [load])

  const codeOf = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u.code])), [units])
  const reported = payments.filter((p) => p.status === "reportado")
  const totalDue = units.reduce((s, u) => s + Math.max(0, Number(u.balance || 0)), 0)

  async function register(e: React.FormEvent) {
    e.preventDefault()
    if (!payFor) return
    try {
      await api("/api/panel/payments", { method: "POST", body: JSON.stringify({ action: "register", unitId: payFor.id, amount: Number(payForm.amount || 0), method: payForm.method, reference: payForm.reference, paidOn: payForm.paidOn || undefined }) })
      setPayFor(null); setPayForm({ amount: "", method: "transferencia", reference: "", paidOn: "" }); await load()
    } catch (e) { setErr(String((e as Error).message)) }
  }
  async function decide(p: PaymentRow, action: "confirm" | "reject") {
    try { await api("/api/panel/payments", { method: "POST", body: JSON.stringify({ action, paymentId: p.id }) }); await load() } catch (e) { setErr(String((e as Error).message)) }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Estado de cuenta</h1>
        <span style={{ fontSize: 13, color: totalDue > 0 ? "#c0392b" : "#1e874b" }}>Por cobrar: {money(totalDue)}</span>
      </div>
      {err && <div style={errBox}>{err}</div>}

      {reported.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Pagos reportados por residentes ({reported.length})</div>
            {reported.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f0f3f8" }}>
                <div><b>{codeOf[p.unit_id] || "—"}</b> · {money(p.amount)} · {p.method} · {p.reference}</div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button onClick={() => decide(p, "confirm")} style={btnMini}>Confirmar</button>
                  <button onClick={() => decide(p, "reject")} style={btnMiniDanger}>Rechazar</button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      <Card>
        {loading ? <p style={{ color: "#5b6b82" }}>Cargando…</p> : units.length === 0 ? (
          <p style={{ color: "#5b6b82", margin: 0 }}>No hay unidades. Créalas primero en Unidades.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead><tr>{["Unidad", "Torre", "Saldo", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td style={{ ...td, fontWeight: 700 }}>{u.code}</td>
                    <td style={td}>{u.tower || "—"}</td>
                    <td style={{ ...td, fontWeight: 700, color: Number(u.balance) > 0 ? "#c0392b" : "#1e874b" }}>{money(u.balance)}</td>
                    <td style={td}><button onClick={() => { setPayFor(u); setPayForm({ amount: String(Math.max(0, Number(u.balance || 0)) || ""), method: "transferencia", reference: "", paidOn: "" }) }} style={btnMini}>Registrar pago</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {payments.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Pagos recientes</div>
            {payments.slice(0, 15).map((p) => (
              <div key={p.id} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f3f8", fontSize: 14 }}>
                <span><b>{codeOf[p.unit_id] || "—"}</b> · {money(p.amount)} · {p.method}</span>
                <span style={{ marginLeft: "auto", color: p.status === "confirmado" ? "#1e874b" : p.status === "rechazado" ? "#c0392b" : "#8a5a00" }}>{p.status}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {payFor && (
        <div style={modalWrap} onClick={() => setPayFor(null)}>
          <form style={modalBox} onClick={(e) => e.stopPropagation()} onSubmit={register}>
            <h3 style={{ margin: "0 0 4px" }}>Registrar pago · {payFor.code}</h3>
            <p style={{ margin: "0 0 12px", color: "#5b6b82", fontSize: 13 }}>Saldo actual: {money(payFor.balance)}</p>
            <Field label="Monto ($)"><input type="number" step="0.01" required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} style={input} /></Field>
            <div style={{ height: 10 }} />
            <Field label="Método"><select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} style={input}>{["transferencia", "pago_movil", "efectivo", "zelle", "tarjeta", "otro"].map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
            <div style={{ height: 10 }} />
            <Field label="Referencia"><input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} style={input} /></Field>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button type="submit" style={btnPrimary}>Registrar</button>
              <button type="button" onClick={() => setPayFor(null)} style={btnGhost}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ---------- Galería ----------
type GalleryItem = { id: string; url: string; caption: string }

function GaleriaView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [url, setUrl] = useState("")
  const [caption, setCaption] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { const d = await api("/api/panel/gallery"); setItems((d.gallery as GalleryItem[]) || []) } catch (e) { setErr(String((e as Error).message)) }
  }, [api])
  useEffect(() => { load() }, [load])

  async function addUrl() {
    if (!url.trim()) return
    setBusy(true); setErr("")
    try { const d = await api("/api/panel/gallery", { method: "POST", body: JSON.stringify({ url: url.trim(), caption }) }); setItems((d.gallery as GalleryItem[]) || []); setUrl(""); setCaption("") } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 6_000_000) { setErr("La imagen supera 6 MB"); return }
    const reader = new FileReader()
    reader.onload = async () => {
      setBusy(true); setErr("")
      try { const d = await api("/api/panel/gallery", { method: "POST", body: JSON.stringify({ dataUrl: reader.result, caption }) }); setItems((d.gallery as GalleryItem[]) || []); setCaption("") } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }
  async function remove(id: string) {
    if (!confirm("¿Quitar esta imagen de la galería?")) return
    try { const d = await api(`/api/panel/gallery/${id}`, { method: "DELETE" }); setItems((d.gallery as GalleryItem[]) || []) } catch (e) { setErr(String((e as Error).message)) }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 14px" }}>Galería</h1>
      {err && <div style={errBox}>{err}</div>}
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Fotos del edificio (se muestran en la página pública)</div>
        <p style={{ margin: "0 0 12px", color: "#5b6b82", fontSize: 13 }}>Sube fotos reales de los apartamentos, áreas comunes y fachada. Mientras no cargues ninguna, la web muestra imágenes de ejemplo.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <Field label="URL de imagen"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/foto.jpg" style={input} /></Field>
          <Field label="Descripción (opcional)"><input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Salón social" style={input} /></Field>
          <button onClick={addUrl} disabled={busy} style={btnPrimary}>Agregar URL</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ ...btnGhost, display: "inline-block", cursor: "pointer" }}>
            {busy ? "Subiendo…" : "⬆️ Subir imagen desde tu equipo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} style={{ display: "none" }} disabled={busy} />
          </label>
        </div>
      </Card>

      <div style={{ marginTop: 14 }}>
        <Card>
          {items.length === 0 ? <p style={{ color: "#5b6b82", margin: 0 }}>Aún no hay fotos. La web pública muestra imágenes de ejemplo hasta que subas las tuyas.</p> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
              {items.map((it) => (
                <div key={it.id} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #eef1f6", background: "#f7f9fc" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt={it.caption} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                  <div style={{ padding: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#5b6b82", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.caption || "—"}</span>
                    <button onClick={() => remove(it.id)} style={btnMiniDanger}>Quitar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ---------- Áreas comunes ----------
type Amenity = { id: string; name: string; description: string; booking_mode: string; fee: number; requires_approval: boolean; active: boolean }
type AmenityRes = { id: string; reservation_date: string; start_time: string; end_time: string; status: string; fee_amount: number; resident_name: string; units?: { code?: string } | null }

function AmenidadesView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [amenities, setAmenities] = useState<Amenity[]>([])
  const [reservations, setReservations] = useState<AmenityRes[]>([])
  const [err, setErr] = useState("")
  const [form, setForm] = useState({ name: "", description: "", fee: "", bookingMode: "por_franja", requiresApproval: false })
  const [show, setShow] = useState(false)
  const load = useCallback(async () => {
    try { const d = await api("/api/panel/amenities"); setAmenities((d.amenities as Amenity[]) || []); setReservations((d.reservations as AmenityRes[]) || []) } catch (e) { setErr(String((e as Error).message)) }
  }, [api])
  useEffect(() => { load() }, [load])
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    try { await api("/api/panel/amenities", { method: "POST", body: JSON.stringify({ name: form.name, description: form.description, fee: Number(form.fee || 0), bookingMode: form.bookingMode, requiresApproval: form.requiresApproval }) }); setForm({ name: "", description: "", fee: "", bookingMode: "por_franja", requiresApproval: false }); setShow(false); await load() } catch (e) { setErr(String((e as Error).message)) }
  }
  async function decide(id: string, decision: "confirmar" | "rechazar") {
    try { await api("/api/panel/amenities", { method: "POST", body: JSON.stringify({ kind: "decision", reservationId: id, decision }) }); await load() } catch (e) { setErr(String((e as Error).message)) }
  }
  const pending = reservations.filter((r) => r.status === "pendiente")
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Áreas comunes</h1>
        <button onClick={() => setShow((v) => !v)} style={btnPrimary}>+ Nueva área</button>
      </div>
      {err && <div style={errBox}>{err}</div>}
      {show && (
        <Card>
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, alignItems: "end" }}>
            <Field label="Nombre *"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} placeholder="Salón social" /></Field>
            <Field label="Descripción"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={input} /></Field>
            <Field label="Costo de uso ($)"><input type="number" step="0.01" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} style={input} /></Field>
            <Field label="Modo"><select value={form.bookingMode} onChange={(e) => setForm({ ...form, bookingMode: e.target.value })} style={input}><option value="por_franja">Por franja</option><option value="por_dia">Por día</option></select></Field>
            <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={form.requiresApproval} onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })} /> Requiere aprobación</label>
            <button type="submit" style={btnPrimary}>Crear</button>
          </form>
        </Card>
      )}
      {pending.length > 0 && (
        <div style={{ marginTop: 14 }}><Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Reservas por aprobar ({pending.length})</div>
          {pending.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f0f3f8" }}>
              <div><b>{r.units?.code || ""}</b> {r.resident_name} · {r.reservation_date} {r.start_time}-{r.end_time}</div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}><button onClick={() => decide(r.id, "confirmar")} style={btnMini}>Aprobar</button><button onClick={() => decide(r.id, "rechazar")} style={btnMiniDanger}>Rechazar</button></div>
            </div>
          ))}
        </Card></div>
      )}
      <div style={{ marginTop: 14 }}><Card>
        {amenities.length === 0 ? <p style={{ color: "#5b6b82", margin: 0 }}>Sin áreas comunes. Crea la primera.</p> : (
          <div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Área", "Modo", "Costo", "Aprobación", "Reservas"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
            {amenities.map((a) => (
              <tr key={a.id}><td style={{ ...td, fontWeight: 700 }}>{a.name}</td><td style={td}>{a.booking_mode}</td><td style={td}>{a.fee > 0 ? money(a.fee) : "gratis"}</td><td style={td}>{a.requires_approval ? "sí" : "no"}</td><td style={td}>{reservations.filter((r) => r.status !== "rechazada").length ? reservations.filter((r) => r.status !== "rechazada").length : "—"}</td></tr>
            ))}
          </tbody></table></div>
        )}
      </Card></div>
    </div>
  )
}

// ---------- Incidencias ----------
type Ticket = { id: string; code: string; category: string; priority: string; status: string; title: string; description: string; reporter_name: string; created_at: string; units?: { code?: string } | null }

function IncidenciasView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [err, setErr] = useState("")
  const load = useCallback(async () => {
    try { const d = await api("/api/panel/tickets"); setTickets((d.tickets as Ticket[]) || []) } catch (e) { setErr(String((e as Error).message)) }
  }, [api])
  useEffect(() => { load() }, [load])
  async function setStatus(t: Ticket, status: string) {
    try { await api("/api/panel/tickets", { method: "POST", body: JSON.stringify({ kind: "update", ticketId: t.id, status }) }); await load() } catch (e) { setErr(String((e as Error).message)) }
  }
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 14px" }}>Incidencias</h1>
      {err && <div style={errBox}>{err}</div>}
      <Card>
        {tickets.length === 0 ? <p style={{ color: "#5b6b82", margin: 0 }}>No hay incidencias reportadas.</p> : tickets.map((t) => (
          <div key={t.id} style={{ padding: "10px 0", borderBottom: "1px solid #f0f3f8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={badge(t.status === "resuelto" || t.status === "cerrado" ? "activa" : t.status === "abierto" ? "en_mora" : "desocupada")}>{t.status}</span>
              <b>{t.title}</b>
              <span style={{ fontSize: 12, color: "#8494a8" }}>{t.units?.code ? `· ${t.units.code}` : ""} · {t.reporter_name} · {t.category} · {t.priority}</span>
              <select value={t.status} onChange={(e) => setStatus(t, e.target.value)} style={{ ...input, marginLeft: "auto", width: 150 }}>{["abierto", "en_proceso", "en_espera", "resuelto", "cerrado"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </div>
            {t.description && <div style={{ fontSize: 13, color: "#5b6b82", marginTop: 4 }}>{t.description}</div>}
          </div>
        ))}
      </Card>
    </div>
  )
}

// ---------- Estacionamiento ----------
type PkTicket = { id: string; code: string; plate: string; vehicle_type: string; entered_at: string; exited_at: string | null; minutes: number; amount: number; currency: string; status: string; live_minutes?: number; live_amount?: number; validated_by?: string; paid_method?: string; notes?: string }
type PkPass = { id: string; plate: string; holder_name: string; valid_from: string | null; valid_to: string | null; monthly_fee: number; active: boolean }
type PkConfig = { free_minutes: number; rate_per_hour: number; rate_currency: string; daily_cap: number; grace_exit_minutes: number }

function EstacionamientoView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [config, setConfig] = useState<PkConfig | null>(null)
  const [tickets, setTickets] = useState<PkTicket[]>([])
  const [passes, setPasses] = useState<PkPass[]>([])
  const [cfgForm, setCfgForm] = useState<PkConfig>({ free_minutes: 15, rate_per_hour: 1, rate_currency: "USD", daily_cap: 0, grace_exit_minutes: 15 })
  const [plate, setPlate] = useState("")
  const [vtype, setVtype] = useState("carro")
  const [passForm, setPassForm] = useState({ plate: "", holderName: "", monthlyFee: "", validTo: "" })
  const [showCfg, setShowCfg] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [err, setErr] = useState("")
  const [msg, setMsg] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setErr("")
    try {
      const d = await api("/api/panel/parking")
      const c = d.config as PkConfig | null
      setConfig(c); if (c) setCfgForm(c)
      setTickets((d.tickets as PkTicket[]) || [])
      setPasses((d.passes as PkPass[]) || [])
    } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }, [api])
  useEffect(() => { load() }, [load])

  const sym = (config?.rate_currency || "USD") === "VES" ? "Bs" : "$"

  async function act(body: Record<string, unknown>, okMsg?: string) {
    setErr(""); setMsg("")
    try { await api("/api/panel/parking", { method: "POST", body: JSON.stringify(body) }); if (okMsg) setMsg(okMsg); await load() }
    catch (e) { setErr(String((e as Error).message)) }
  }

  const open = tickets.filter((t) => t.status === "abierto")
  const reported = tickets.filter((t) => t.status === "por_pagar")
  const closed = tickets.filter((t) => t.status !== "abierto" && t.status !== "por_pagar").slice(0, 30)
  const methodLabel = (m?: string) => ({ pago_movil: "Pago móvil", tarjeta: "Tarjeta", efectivo: "Efectivo", transferencia: "Transferencia" }[m || ""] || m || "—")

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Estacionamiento</h1>
        <span style={{ fontSize: 13, color: "#0a6f9c", fontWeight: 700 }}>🅿️ {open.length} adentro</span>
        <a href="/estacionamiento/qr" target="_blank" rel="noopener" style={{ ...btnGhost, textDecoration: "none" }}>🖨️ Póster QR de entrada</a>
        <button onClick={() => setShowCfg((v) => !v)} style={btnGhost}>Tarifas</button>
      </div>
      {err && <div style={errBox}>{err}</div>}
      {msg && <div style={{ ...errBox, background: "#e6f4ea", color: "#1e874b" }}>{msg}</div>}

      {showCfg && (
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Tarifas</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, alignItems: "end" }}>
            <Field label="Gracia (min)"><input type="number" value={cfgForm.free_minutes} onChange={(e) => setCfgForm({ ...cfgForm, free_minutes: Number(e.target.value) })} style={input} /></Field>
            <Field label="Tarifa / hora"><input type="number" step="0.01" value={cfgForm.rate_per_hour} onChange={(e) => setCfgForm({ ...cfgForm, rate_per_hour: Number(e.target.value) })} style={input} /></Field>
            <Field label="Moneda">
              <select value={cfgForm.rate_currency} onChange={(e) => setCfgForm({ ...cfgForm, rate_currency: e.target.value })} style={input}><option value="USD">USD</option><option value="VES">Bs</option></select>
            </Field>
            <Field label="Tope diario (0=sin)"><input type="number" step="0.01" value={cfgForm.daily_cap} onChange={(e) => setCfgForm({ ...cfgForm, daily_cap: Number(e.target.value) })} style={input} /></Field>
            <button onClick={() => act({ action: "saveConfig", freeMinutes: cfgForm.free_minutes, ratePerHour: cfgForm.rate_per_hour, rateCurrency: cfgForm.rate_currency, dailyCap: cfgForm.daily_cap, graceExitMinutes: cfgForm.grace_exit_minutes }, "✓ Tarifas guardadas")} style={btnPrimary}>Guardar</button>
          </div>
        </Card>
      )}

      <div style={{ marginTop: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Registrar entrada</div>
          <form onSubmit={(e) => { e.preventDefault(); if (!plate.trim()) { setErr("Escribe la placa"); return } act({ action: "entry", plate, vehicleType: vtype }, "✓ Entrada registrada").then(() => setPlate("")) }} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <Field label="Placa"><input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="AB123CD" style={{ ...input, width: 150 }} /></Field>
            <Field label="Tipo"><select value={vtype} onChange={(e) => setVtype(e.target.value)} style={{ ...input, width: 120 }}><option value="carro">Carro</option><option value="moto">Moto</option><option value="otro">Otro</option></select></Field>
            <button type="submit" style={btnPrimary}>+ Entrada (genera QR)</button>
          </form>
        </Card>
      </div>

      {reported.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 8, color: "#8a5a00" }}>🕓 Pagos reportados por clientes — por confirmar ({reported.length})</div>
            <p style={{ fontSize: 12, color: "#7c93a6", margin: "0 0 8px" }}>El cliente registró su pago desde el teléfono. Verifica el pago y confirma para abrir la barrera.</p>
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Código", "Placa", "Método", "Monto", "Reporte", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {reported.map((t) => (
                    <tr key={t.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{t.code}</td>
                      <td style={td}>{t.plate || "—"}</td>
                      <td style={td}>{methodLabel(t.paid_method)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{sym}{t.amount}</td>
                      <td style={{ ...td, fontSize: 12, color: "#5b6b82", maxWidth: 240 }}>{t.notes || "—"}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button onClick={() => act({ action: "close", ticketId: t.id, method: t.paid_method || "reportado" }, "✓ Pago confirmado · barrera abierta")} style={btnMini}>Confirmar (abre barrera)</button>
                        <button onClick={() => { const by = prompt("Local que da la cortesía:") || ""; if (by) act({ action: "close", ticketId: t.id, courtesyBy: by }, "✓ Cortesía aplicada") }} style={btnMini}>Cortesía</button>
                        <button onClick={() => { if (confirm("¿Anular ticket?")) act({ action: "void", ticketId: t.id }) }} style={btnMiniDanger}>Anular</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Adentro ahora ({open.length})</div>
          {loading ? <p style={{ color: "#5b6b82" }}>Cargando…</p> : open.length === 0 ? (
            <p style={{ color: "#5b6b82", margin: 0 }}>No hay vehículos adentro.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Código", "Placa", "Entró", "Tiempo", "A cobrar", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {open.map((t) => (
                    <tr key={t.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{t.code}</td>
                      <td style={td}>{t.plate || "—"}</td>
                      <td style={td}>{new Date(t.entered_at).toLocaleString("es-VE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</td>
                      <td style={td}>{fmtMin(t.live_minutes ?? 0)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{sym}{t.live_amount ?? 0}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button onClick={() => act({ action: "close", ticketId: t.id, method: "efectivo" }, "✓ Cobrado y salida")} style={btnMini}>Cobrar salida</button>
                        <button onClick={() => { const by = prompt("Local que da la cortesía:") || ""; if (by) act({ action: "close", ticketId: t.id, courtesyBy: by }, "✓ Cortesía aplicada") }} style={btnMini}>Cortesía</button>
                        <button onClick={() => { if (confirm("¿Anular ticket?")) act({ action: "void", ticketId: t.id }) }} style={btnMiniDanger}>Anular</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 14 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 700, flex: 1 }}>Abonos / vehículos autorizados</div>
            <button onClick={() => setShowPass((v) => !v)} style={btnGhost}>+ Abono</button>
          </div>
          {showPass && (
            <form onSubmit={(e) => { e.preventDefault(); act({ action: "pass", plate: passForm.plate, holderName: passForm.holderName, monthlyFee: Number(passForm.monthlyFee || 0), validTo: passForm.validTo || undefined }, "✓ Abono guardado").then(() => { setPassForm({ plate: "", holderName: "", monthlyFee: "", validTo: "" }); setShowPass(false) }) }} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 12 }}>
              <Field label="Placa"><input value={passForm.plate} onChange={(e) => setPassForm({ ...passForm, plate: e.target.value.toUpperCase() })} style={{ ...input, width: 130 }} /></Field>
              <Field label="Titular"><input value={passForm.holderName} onChange={(e) => setPassForm({ ...passForm, holderName: e.target.value })} style={{ ...input, width: 170 }} /></Field>
              <Field label="Cuota mensual"><input type="number" step="0.01" value={passForm.monthlyFee} onChange={(e) => setPassForm({ ...passForm, monthlyFee: e.target.value })} style={{ ...input, width: 120 }} /></Field>
              <Field label="Vence"><input type="date" value={passForm.validTo} onChange={(e) => setPassForm({ ...passForm, validTo: e.target.value })} style={input} /></Field>
              <button type="submit" style={btnPrimary}>Guardar</button>
            </form>
          )}
          {passes.length === 0 ? <p style={{ color: "#5b6b82", margin: 0 }}>Sin abonos registrados.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Placa", "Titular", "Cuota", "Vence", "Estado"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {passes.map((p) => (
                    <tr key={p.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{p.plate}</td>
                      <td style={td}>{p.holder_name || "—"}</td>
                      <td style={td}>{p.monthly_fee ? `${sym}${p.monthly_fee}` : "—"}</td>
                      <td style={td}>{p.valid_to || "—"}</td>
                      <td style={td}><span style={badge(p.active ? "activo" : "inactivo")}>{p.active ? "activo" : "inactivo"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {closed.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Movimientos recientes</div>
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Código", "Placa", "Tiempo", "Monto", "Estado"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {closed.map((t) => (
                    <tr key={t.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{t.code}</td>
                      <td style={td}>{t.plate || "—"}</td>
                      <td style={td}>{fmtMin(t.minutes)}</td>
                      <td style={td}>{t.status === "cortesia" ? `Cortesía${t.validated_by ? ` (${t.validated_by})` : ""}` : `${sym}${t.amount}`}</td>
                      <td style={td}><span style={badge(t.status)}>{t.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
function fmtMin(m: number) { const h = Math.floor(m / 60); const mm = m % 60; return h > 0 ? `${h}h ${mm}m` : `${mm}m` }

// ---------- Publicidad ----------
type AdSpace = { id: string; name: string; kind: string; location: string; base_price: number; currency: string; active: boolean }
type AdBooking = { id: string; space_id: string; client_name: string; client_phone: string; starts_on: string | null; ends_on: string | null; price: number; currency: string; status: string; ad_spaces?: { name?: string; kind?: string } | null }
const AD_KINDS = ["pantalla", "valla", "banner", "pendon", "pasillo", "estacionamiento", "redes", "web", "otro"]
const AD_STATUS = ["reservado", "activo", "finalizado", "cancelado"]
const emptySpaceForm = { id: "", name: "", kind: "pantalla", location: "", basePrice: "", currency: "USD", active: true }
const emptyBookingForm = { id: "", spaceId: "", clientName: "", clientPhone: "", startsOn: "", endsOn: "", price: "", currency: "USD", status: "reservado", designUrl: "", proofUrl: "" }

function PublicidadView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [spaces, setSpaces] = useState<AdSpace[]>([])
  const [bookings, setBookings] = useState<AdBooking[]>([])
  const [sForm, setSForm] = useState({ ...emptySpaceForm })
  const [bForm, setBForm] = useState({ ...emptyBookingForm })
  const [showSpace, setShowSpace] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setErr("")
    try {
      const d = await api("/api/panel/advertising")
      setSpaces((d.spaces as AdSpace[]) || [])
      setBookings((d.bookings as AdBooking[]) || [])
    } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }, [api])
  useEffect(() => { load() }, [load])

  async function saveSpace(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    try {
      await api("/api/panel/advertising", { method: "POST", body: JSON.stringify({ action: "space", id: sForm.id || undefined, name: sForm.name, kind: sForm.kind, location: sForm.location, basePrice: Number(sForm.basePrice || 0), currency: sForm.currency, active: sForm.active }) })
      setSForm({ ...emptySpaceForm }); setShowSpace(false); await load()
    } catch (e) { setErr(String((e as Error).message)) }
  }
  async function saveBooking(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    if (!bForm.spaceId) { setErr("Elige el espacio"); return }
    try {
      await api("/api/panel/advertising", { method: "POST", body: JSON.stringify({ action: "booking", id: bForm.id || undefined, spaceId: bForm.spaceId, clientName: bForm.clientName, clientPhone: bForm.clientPhone, startsOn: bForm.startsOn, endsOn: bForm.endsOn, price: Number(bForm.price || 0), currency: bForm.currency, status: bForm.status, designUrl: bForm.designUrl, proofUrl: bForm.proofUrl }) })
      setBForm({ ...emptyBookingForm }); setShowBooking(false); await load()
    } catch (e) { setErr(String((e as Error).message)) }
  }
  const sym = (c: string) => (c === "VES" ? "Bs" : "$")

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Publicidad y espacios</h1>
        <button onClick={() => { setSForm({ ...emptySpaceForm }); setShowSpace((v) => !v) }} style={btnGhost}>+ Espacio</button>
        <button onClick={() => { setBForm({ ...emptyBookingForm }); setShowBooking((v) => !v) }} style={btnPrimary}>+ Contratación</button>
      </div>
      {err && <div style={errBox}>{err}</div>}

      {showSpace && (
        <Card>
          <form onSubmit={saveSpace} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <Field label="Nombre *"><input required value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} placeholder="Pantalla LED entrada" style={input} /></Field>
            <Field label="Tipo"><select value={sForm.kind} onChange={(e) => setSForm({ ...sForm, kind: e.target.value })} style={input}>{AD_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
            <Field label="Ubicación"><input value={sForm.location} onChange={(e) => setSForm({ ...sForm, location: e.target.value })} style={input} /></Field>
            <Field label="Precio ref."><input type="number" step="0.01" value={sForm.basePrice} onChange={(e) => setSForm({ ...sForm, basePrice: e.target.value })} style={input} /></Field>
            <Field label="Moneda"><select value={sForm.currency} onChange={(e) => setSForm({ ...sForm, currency: e.target.value })} style={input}><option value="USD">USD</option><option value="VES">Bs</option></select></Field>
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 10 }}>
              <button type="submit" style={btnPrimary}>{sForm.id ? "Guardar" : "Crear espacio"}</button>
              <button type="button" onClick={() => setShowSpace(false)} style={btnGhost}>Cancelar</button>
            </div>
          </form>
        </Card>
      )}

      {showBooking && (
        <Card>
          <form onSubmit={saveBooking} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <Field label="Espacio *"><select required value={bForm.spaceId} onChange={(e) => setBForm({ ...bForm, spaceId: e.target.value })} style={input}><option value="">—</option>{spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Cliente"><input value={bForm.clientName} onChange={(e) => setBForm({ ...bForm, clientName: e.target.value })} style={input} /></Field>
            <Field label="Teléfono"><input value={bForm.clientPhone} onChange={(e) => setBForm({ ...bForm, clientPhone: e.target.value })} style={input} /></Field>
            <Field label="Desde"><input type="date" value={bForm.startsOn} onChange={(e) => setBForm({ ...bForm, startsOn: e.target.value })} style={input} /></Field>
            <Field label="Hasta"><input type="date" value={bForm.endsOn} onChange={(e) => setBForm({ ...bForm, endsOn: e.target.value })} style={input} /></Field>
            <Field label="Precio"><input type="number" step="0.01" value={bForm.price} onChange={(e) => setBForm({ ...bForm, price: e.target.value })} style={input} /></Field>
            <Field label="Estado"><select value={bForm.status} onChange={(e) => setBForm({ ...bForm, status: e.target.value })} style={input}>{AD_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
            <Field label="Arte (URL)"><input value={bForm.designUrl} onChange={(e) => setBForm({ ...bForm, designUrl: e.target.value })} style={input} /></Field>
            <Field label="Evidencia (URL)"><input value={bForm.proofUrl} onChange={(e) => setBForm({ ...bForm, proofUrl: e.target.value })} style={input} /></Field>
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 10 }}>
              <button type="submit" style={btnPrimary}>{bForm.id ? "Guardar" : "Crear contratación"}</button>
              <button type="button" onClick={() => setShowBooking(false)} style={btnGhost}>Cancelar</button>
            </div>
          </form>
        </Card>
      )}

      <div style={{ marginTop: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Espacios ({spaces.length})</div>
          {loading ? <p style={{ color: "#5b6b82" }}>Cargando…</p> : spaces.length === 0 ? (
            <p style={{ color: "#5b6b82", margin: 0 }}>Aún no hay espacios. Crea el primero con “+ Espacio”.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Nombre", "Tipo", "Ubicación", "Precio ref.", "Estado", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {spaces.map((s) => (
                    <tr key={s.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{s.name}</td>
                      <td style={td}>{s.kind}</td>
                      <td style={td}>{s.location || "—"}</td>
                      <td style={td}>{s.base_price ? `${sym(s.currency)}${s.base_price}` : "—"}</td>
                      <td style={td}><span style={badge(s.active ? "activo" : "inactivo")}>{s.active ? "activo" : "inactivo"}</span></td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button onClick={() => { setSForm({ id: s.id, name: s.name, kind: s.kind, location: s.location || "", basePrice: String(s.base_price || ""), currency: s.currency || "USD", active: s.active }); setShowSpace(true) }} style={btnMini}>Editar</button>
                        <button onClick={() => { if (confirm(`¿Eliminar el espacio ${s.name}?`)) api("/api/panel/advertising", { method: "POST", body: JSON.stringify({ action: "deleteSpace", id: s.id }) }).then(load) }} style={btnMiniDanger}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Contrataciones ({bookings.length})</div>
          {bookings.length === 0 ? (
            <p style={{ color: "#5b6b82", margin: 0 }}>Sin contrataciones. Crea una con “+ Contratación”.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Espacio", "Cliente", "Vigencia", "Precio", "Estado", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{b.ad_spaces?.name || "—"}</td>
                      <td style={td}>{b.client_name || "—"}</td>
                      <td style={td}>{b.starts_on || "—"} → {b.ends_on || "—"}</td>
                      <td style={td}>{b.price ? `${sym(b.currency)}${b.price}` : "—"}</td>
                      <td style={td}><span style={badge(b.status)}>{b.status}</span></td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button onClick={() => { setBForm({ id: b.id, spaceId: b.space_id, clientName: b.client_name || "", clientPhone: b.client_phone || "", startsOn: b.starts_on || "", endsOn: b.ends_on || "", price: String(b.price || ""), currency: b.currency || "USD", status: b.status, designUrl: "", proofUrl: "" }); setShowBooking(true) }} style={btnMini}>Editar</button>
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

// ---------- Consultorios ----------
type Doctor = { id: string; full_name: string; specialty: string; phone: string; consult_fee: number; currency: string; active: boolean }
type Sched = { id: string; doctor_id: string; weekday: number; start_time: string; end_time: string; slot_minutes: number }
type Appt = { id: string; doctor_id: string; patient_name: string; patient_phone: string; starts_at: string; status: string; reason: string; doctors?: { full_name?: string; specialty?: string } | null }
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const APPT_STATUS = ["solicitada", "confirmada", "atendida", "cancelada", "no_asistio"]
const emptyDocForm = { id: "", fullName: "", specialty: "", phone: "", consultFee: "", currency: "USD", active: true }

function ConsultoriosView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [schedule, setSchedule] = useState<Sched[]>([])
  const [appts, setAppts] = useState<Appt[]>([])
  const [docForm, setDocForm] = useState({ ...emptyDocForm })
  const [showDoc, setShowDoc] = useState(false)
  const [schedFor, setSchedFor] = useState<Doctor | null>(null)
  const [schedRows, setSchedRows] = useState<{ weekday: number; enabled: boolean; startTime: string; endTime: string; slotMinutes: string }[]>([])
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setErr("")
    try {
      const d = await api("/api/panel/medical")
      setDoctors((d.doctors as Doctor[]) || [])
      setSchedule((d.schedule as Sched[]) || [])
      setAppts((d.appointments as Appt[]) || [])
    } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }, [api])
  useEffect(() => { load() }, [load])

  async function saveDoc(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    try {
      await api("/api/panel/medical", { method: "POST", body: JSON.stringify({ action: "doctor", id: docForm.id || undefined, fullName: docForm.fullName, specialty: docForm.specialty, phone: docForm.phone, consultFee: Number(docForm.consultFee || 0), currency: docForm.currency, active: docForm.active }) })
      setDocForm({ ...emptyDocForm }); setShowDoc(false); await load()
    } catch (e) { setErr(String((e as Error).message)) }
  }

  function openSchedule(doc: Doctor) {
    const rows = WEEKDAYS.map((_, wd) => {
      const b = schedule.find((s) => s.doctor_id === doc.id && s.weekday === wd)
      return { weekday: wd, enabled: !!b, startTime: b?.start_time || "09:00", endTime: b?.end_time || "13:00", slotMinutes: String(b?.slot_minutes || 30) }
    })
    setSchedRows(rows); setSchedFor(doc)
  }
  async function saveSchedule() {
    if (!schedFor) return
    setErr("")
    try {
      const blocks = schedRows.filter((r) => r.enabled).map((r) => ({ weekday: r.weekday, startTime: r.startTime, endTime: r.endTime, slotMinutes: Number(r.slotMinutes || 30) }))
      await api("/api/panel/medical", { method: "POST", body: JSON.stringify({ action: "schedule", doctorId: schedFor.id, blocks }) })
      setSchedFor(null); await load()
    } catch (e) { setErr(String((e as Error).message)) }
  }
  async function setApptStatus(id: string, status: string) {
    try { await api("/api/panel/medical", { method: "POST", body: JSON.stringify({ action: "apptStatus", id, status }) }); await load() } catch (e) { setErr(String((e as Error).message)) }
  }

  // "Próximas": desde hace 1h en adelante. Date.now() al render es intencional (lista viva).
  // eslint-disable-next-line react-hooks/purity
  const upcoming = appts.filter((a) => new Date(a.starts_at).getTime() >= Date.now() - 3600000 && a.status !== "cancelada")

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Consultorios médicos</h1>
        <button onClick={() => { setDocForm({ ...emptyDocForm }); setShowDoc((v) => !v) }} style={btnPrimary}>+ Doctor</button>
      </div>
      {err && <div style={errBox}>{err}</div>}

      {showDoc && (
        <Card>
          <form onSubmit={saveDoc} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <Field label="Nombre *"><input required value={docForm.fullName} onChange={(e) => setDocForm({ ...docForm, fullName: e.target.value })} placeholder="Dra. Ana Pérez" style={input} /></Field>
            <Field label="Especialidad"><input value={docForm.specialty} onChange={(e) => setDocForm({ ...docForm, specialty: e.target.value })} placeholder="Pediatría" style={input} /></Field>
            <Field label="Teléfono"><input value={docForm.phone} onChange={(e) => setDocForm({ ...docForm, phone: e.target.value })} style={input} /></Field>
            <Field label="Consulta ($)"><input type="number" step="0.01" value={docForm.consultFee} onChange={(e) => setDocForm({ ...docForm, consultFee: e.target.value })} style={input} /></Field>
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 10 }}>
              <button type="submit" style={btnPrimary}>{docForm.id ? "Guardar" : "Crear doctor"}</button>
              <button type="button" onClick={() => setShowDoc(false)} style={btnGhost}>Cancelar</button>
            </div>
          </form>
        </Card>
      )}

      {schedFor && (
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Horario de {schedFor.full_name}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {schedRows.map((r, i) => (
              <div key={r.weekday} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ width: 90, display: "flex", gap: 6, alignItems: "center", fontWeight: 600 }}>
                  <input type="checkbox" checked={r.enabled} onChange={(e) => setSchedRows(schedRows.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} /> {WEEKDAYS[r.weekday]}
                </label>
                <input type="time" value={r.startTime} disabled={!r.enabled} onChange={(e) => setSchedRows(schedRows.map((x, j) => j === i ? { ...x, startTime: e.target.value } : x))} style={{ ...input, width: 120 }} />
                <span>a</span>
                <input type="time" value={r.endTime} disabled={!r.enabled} onChange={(e) => setSchedRows(schedRows.map((x, j) => j === i ? { ...x, endTime: e.target.value } : x))} style={{ ...input, width: 120 }} />
                <label style={{ fontSize: 13, color: "#5b6b82" }}>cada <input type="number" value={r.slotMinutes} disabled={!r.enabled} onChange={(e) => setSchedRows(schedRows.map((x, j) => j === i ? { ...x, slotMinutes: e.target.value } : x))} style={{ ...input, width: 70, display: "inline-block" }} /> min</label>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button onClick={saveSchedule} style={btnPrimary}>Guardar horario</button>
            <button onClick={() => setSchedFor(null)} style={btnGhost}>Cerrar</button>
          </div>
        </Card>
      )}

      <div style={{ marginTop: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Doctores ({doctors.length})</div>
          {loading ? <p style={{ color: "#5b6b82" }}>Cargando…</p> : doctors.length === 0 ? (
            <p style={{ color: "#5b6b82", margin: 0 }}>Aún no hay doctores. Crea el primero con “+ Doctor”.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Nombre", "Especialidad", "Teléfono", "Consulta", "Estado", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {doctors.map((d) => (
                    <tr key={d.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{d.full_name}</td>
                      <td style={td}>{d.specialty || "—"}</td>
                      <td style={td}>{d.phone || "—"}</td>
                      <td style={td}>{d.consult_fee ? `$${d.consult_fee}` : "—"}</td>
                      <td style={td}><span style={badge(d.active ? "activo" : "inactivo")}>{d.active ? "activo" : "inactivo"}</span></td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button onClick={() => openSchedule(d)} style={btnMini}>Horario</button>
                        <button onClick={() => { setDocForm({ id: d.id, fullName: d.full_name, specialty: d.specialty || "", phone: d.phone || "", consultFee: String(d.consult_fee || ""), currency: d.currency || "USD", active: d.active }); setShowDoc(true) }} style={btnMini}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Próximas citas ({upcoming.length})</div>
          {upcoming.length === 0 ? <p style={{ color: "#5b6b82", margin: 0 }}>No hay citas próximas.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Fecha/hora", "Doctor", "Paciente", "Motivo", "Estado", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {upcoming.map((a) => (
                    <tr key={a.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{new Date(a.starts_at).toLocaleString("es-VE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={td}>{a.doctors?.full_name || "—"}</td>
                      <td style={td}>{a.patient_name}<div style={{ fontSize: 12, color: "#8494a8" }}>{a.patient_phone}</div></td>
                      <td style={td}>{a.reason || "—"}</td>
                      <td style={td}><span style={badge(a.status)}>{a.status}</span></td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {a.status === "solicitada" && <button onClick={() => setApptStatus(a.id, "confirmada")} style={btnMini}>Confirmar</button>}
                        {(a.status === "solicitada" || a.status === "confirmada") && <button onClick={() => setApptStatus(a.id, "atendida")} style={btnMini}>Atendida</button>}
                        <button onClick={() => { if (confirm("¿Cancelar cita?")) setApptStatus(a.id, "cancelada") }} style={btnMiniDanger}>Cancelar</button>
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

// ---------- Atención al cliente (CRM) ----------
type CrmCase = { id: string; kind: string; subject: string; message: string; customer_name: string; customer_phone: string; customer_email: string; channel: string; status: string; priority: string; resolution: string; created_at: string }
const CRM_STATUS = ["nuevo", "en_proceso", "resuelto", "cerrado"]
const CRM_KIND_LABEL: Record<string, string> = { reclamo: "Reclamo", sugerencia: "Sugerencia", consulta: "Consulta", objeto_perdido: "Objeto perdido", solicitud_local: "Solicitud de local", propuesta_proveedor: "Propuesta proveedor", otro: "Otro" }

function AtencionView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [cases, setCases] = useState<CrmCase[]>([])
  const [filter, setFilter] = useState("")
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setErr("")
    try { const d = await api("/api/panel/crm"); setCases((d.cases as CrmCase[]) || []) } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }, [api])
  useEffect(() => { load() }, [load])

  async function update(id: string, patch: Record<string, unknown>) {
    try { await api("/api/panel/crm", { method: "POST", body: JSON.stringify({ action: "update", id, ...patch }) }); await load() } catch (e) { setErr(String((e as Error).message)) }
  }
  const shown = filter ? cases.filter((c) => c.status === filter) : cases
  const openCount = cases.filter((c) => c.status === "nuevo" || c.status === "en_proceso").length

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Atención al cliente</h1>
        <span style={{ fontSize: 13, color: "#0a6f9c", fontWeight: 700 }}>{openCount} abierto(s)</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...input, width: 150 }}>
          <option value="">Todos</option>{CRM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {err && <div style={errBox}>{err}</div>}
      <Card>
        {loading ? <p style={{ color: "#5b6b82" }}>Cargando…</p> : shown.length === 0 ? (
          <p style={{ color: "#5b6b82", margin: 0 }}>Sin casos. Los que lleguen por la web aparecerán aquí.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead><tr>{["Fecha", "Tipo", "Cliente", "Mensaje", "Prioridad", "Estado", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id}>
                    <td style={td}>{new Date(c.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit" })}</td>
                    <td style={td}>{CRM_KIND_LABEL[c.kind] || c.kind}</td>
                    <td style={td}>{c.customer_name || "—"}<div style={{ fontSize: 12, color: "#8494a8" }}>{c.customer_phone}</div></td>
                    <td style={{ ...td, maxWidth: 320 }}>{c.subject ? <b>{c.subject}: </b> : null}{c.message}</td>
                    <td style={td}>
                      <select value={c.priority} onChange={(e) => update(c.id, { priority: e.target.value })} style={{ ...input, width: 90, padding: "4px 6px" }}>{["baja", "media", "alta"].map((p) => <option key={p} value={p}>{p}</option>)}</select>
                    </td>
                    <td style={td}><span style={badge(c.status)}>{c.status}</span></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <select value={c.status} onChange={(e) => update(c.id, { status: e.target.value })} style={{ ...input, width: 120, padding: "4px 6px" }}>{CRM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ---------- Fidelidad ----------
type LoyalCustomer = { id: string; full_name: string; phone: string; email: string; points: number; tier: string; active: boolean }
type LoyalTx = { id: string; points: number; kind: string; amount: number; note: string; created_at: string; loyalty_customers?: { full_name?: string } | null }
const emptyLoyalForm = { id: "", fullName: "", phone: "", email: "", tier: "general" }

function FidelidadView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [customers, setCustomers] = useState<LoyalCustomer[]>([])
  const [txs, setTxs] = useState<LoyalTx[]>([])
  const [form, setForm] = useState({ ...emptyLoyalForm })
  const [showForm, setShowForm] = useState(false)
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setErr("")
    try {
      const d = await api("/api/panel/loyalty")
      setCustomers((d.customers as LoyalCustomer[]) || [])
      setTxs((d.transactions as LoyalTx[]) || [])
    } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }, [api])
  useEffect(() => { load() }, [load])

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    try {
      await api("/api/panel/loyalty", { method: "POST", body: JSON.stringify({ action: "customer", id: form.id || undefined, fullName: form.fullName, phone: form.phone, email: form.email, tier: form.tier }) })
      setForm({ ...emptyLoyalForm }); setShowForm(false); await load()
    } catch (e) { setErr(String((e as Error).message)) }
  }
  async function addPoints(c: LoyalCustomer, sign: number) {
    const raw = prompt(sign > 0 ? `Puntos a acumular para ${c.full_name}:` : `Puntos a canjear de ${c.full_name} (saldo ${c.points}):`)
    if (!raw) return
    const pts = Math.abs(parseInt(raw, 10) || 0) * sign
    if (!pts) return
    try { await api("/api/panel/loyalty", { method: "POST", body: JSON.stringify({ action: "points", customerId: c.id, points: pts, kind: sign > 0 ? "compra" : "canje" }) }); await load() } catch (e) { setErr(String((e as Error).message)) }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Fidelidad</h1>
        <button onClick={() => { setForm({ ...emptyLoyalForm }); setShowForm((v) => !v) }} style={btnPrimary}>+ Cliente</button>
      </div>
      {err && <div style={errBox}>{err}</div>}
      {showForm && (
        <Card>
          <form onSubmit={saveCustomer} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <Field label="Nombre *"><input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} style={input} /></Field>
            <Field label="Teléfono *"><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={input} /></Field>
            <Field label="Correo"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} /></Field>
            <Field label="Nivel"><select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} style={input}>{["general", "plata", "oro"].map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 10 }}>
              <button type="submit" style={btnPrimary}>{form.id ? "Guardar" : "Crear cliente"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btnGhost}>Cancelar</button>
            </div>
          </form>
        </Card>
      )}
      <div style={{ marginTop: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Clientes ({customers.length})</div>
          {loading ? <p style={{ color: "#5b6b82" }}>Cargando…</p> : customers.length === 0 ? (
            <p style={{ color: "#5b6b82", margin: 0 }}>Aún no hay clientes en el programa.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Cliente", "Teléfono", "Nivel", "Puntos", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{c.full_name}</td>
                      <td style={td}>{c.phone}</td>
                      <td style={td}><span style={badge(c.tier === "oro" ? "por_vencer" : c.tier === "plata" ? "reservado" : "ocupado")}>{c.tier}</span></td>
                      <td style={{ ...td, fontWeight: 800, color: "#0a6f9c" }}>{c.points}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button onClick={() => addPoints(c, 1)} style={btnMini}>+ pts</button>
                        <button onClick={() => addPoints(c, -1)} style={btnMini}>canjear</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      {txs.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Movimientos recientes</div>
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead><tr>{["Fecha", "Cliente", "Tipo", "Puntos"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {txs.map((t) => (
                    <tr key={t.id}>
                      <td style={td}>{new Date(t.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit" })}</td>
                      <td style={td}>{t.loyalty_customers?.full_name || "—"}</td>
                      <td style={td}>{t.kind}</td>
                      <td style={{ ...td, fontWeight: 700, color: t.points >= 0 ? "#1e874b" : "#c0392b" }}>{t.points >= 0 ? "+" : ""}{t.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ---------- Comunicados ----------
type Announcement = { id: string; title: string; body: string; category: string; is_pinned: boolean; published_at: string | null }

function ComunicadosView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [items, setItems] = useState<Announcement[]>([])
  const [err, setErr] = useState("")
  const [form, setForm] = useState({ title: "", body: "", category: "general", isPinned: false })
  const load = useCallback(async () => {
    try { const d = await api("/api/panel/announcements"); setItems((d.announcements as Announcement[]) || []) } catch (e) { setErr(String((e as Error).message)) }
  }, [api])
  useEffect(() => { load() }, [load])
  async function publish(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    try { await api("/api/panel/announcements", { method: "POST", body: JSON.stringify(form) }); setForm({ title: "", body: "", category: "general", isPinned: false }); await load() } catch (e) { setErr(String((e as Error).message)) }
  }
  async function remove(id: string) { if (!confirm("¿Eliminar comunicado?")) return; try { await api("/api/panel/announcements", { method: "POST", body: JSON.stringify({ kind: "delete", id }) }); await load() } catch (e) { setErr(String((e as Error).message)) } }
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 14px" }}>Comunicados</h1>
      {err && <div style={errBox}>{err}</div>}
      <Card>
        <form onSubmit={publish} style={{ display: "grid", gap: 10 }}>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título del comunicado" style={input} />
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Mensaje…" rows={3} style={{ ...input, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ ...input, width: 170 }}>{["general", "mantenimiento", "asamblea", "cobranza", "seguridad", "evento"].map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} /> Fijar arriba</label>
            <button type="submit" style={{ ...btnPrimary, marginLeft: "auto" }}>Publicar</button>
          </div>
        </form>
      </Card>
      <div style={{ marginTop: 14 }}><Card>
        {items.length === 0 ? <p style={{ color: "#5b6b82", margin: 0 }}>Sin comunicados.</p> : items.map((a) => (
          <div key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid #f0f3f8", display: "flex", gap: 10 }}>
            <div><div style={{ fontWeight: 700 }}>{a.is_pinned ? "📌 " : ""}{a.title}</div><div style={{ fontSize: 13, color: "#5b6b82" }}>{a.body}</div><div style={{ fontSize: 11, color: "#8494a8", marginTop: 2 }}>{a.category} · {a.published_at ? new Date(a.published_at).toLocaleDateString("es-VE") : ""}</div></div>
            <button onClick={() => remove(a.id)} style={{ ...btnMiniDanger, marginLeft: "auto", alignSelf: "start" }}>Eliminar</button>
          </div>
        ))}
      </Card></div>
    </div>
  )
}

// ---------- Asambleas ----------
type PollOpt = { id: string; label: string; votes: number; weight: number }
type Poll = { id: string; question: string; status: string; weighting: string; options: PollOpt[] }

function AsambleasView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [polls, setPolls] = useState<Poll[]>([])
  const [err, setErr] = useState("")
  const [q, setQ] = useState("")
  const [opts, setOpts] = useState("Sí\nNo")
  const load = useCallback(async () => {
    try { const d = await api("/api/panel/assemblies"); setPolls((d.polls as Poll[]) || []) } catch (e) { setErr(String((e as Error).message)) }
  }, [api])
  useEffect(() => { load() }, [load])
  async function createPoll(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    try { await api("/api/panel/assemblies", { method: "POST", body: JSON.stringify({ kind: "poll", question: q, options: opts.split("\n").map((s) => s.trim()).filter(Boolean) }) }); setQ(""); setOpts("Sí\nNo"); await load() } catch (e) { setErr(String((e as Error).message)) }
  }
  async function toggle(p: Poll) { try { await api("/api/panel/assemblies", { method: "POST", body: JSON.stringify({ kind: "pollStatus", pollId: p.id, status: p.status === "abierta" ? "cerrada" : "abierta" }) }); await load() } catch (e) { setErr(String((e as Error).message)) } }
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 14px" }}>Asambleas y votaciones</h1>
      {err && <div style={errBox}>{err}</div>}
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Nueva votación (voto ponderado por alícuota)</div>
        <form onSubmit={createPoll} style={{ display: "grid", gap: 10 }}>
          <input required value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pregunta (ej. ¿Aprueba la cuota extraordinaria?)" style={input} />
          <textarea value={opts} onChange={(e) => setOpts(e.target.value)} rows={3} style={{ ...input, resize: "vertical" }} placeholder="Una opción por línea" />
          <button type="submit" style={{ ...btnPrimary, justifySelf: "start" }}>Abrir votación</button>
        </form>
      </Card>
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {polls.map((p) => {
          const totalW = p.options.reduce((s, o) => s + Number(o.weight || 0), 0) || 1
          return (
            <Card key={p.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <b>{p.question}</b>
                <span style={badge(p.status === "abierta" ? "activa" : "desocupada")}>{p.status}</span>
                <button onClick={() => toggle(p)} style={{ ...btnMini, marginLeft: "auto" }}>{p.status === "abierta" ? "Cerrar" : "Reabrir"}</button>
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {p.options.map((o) => (
                  <div key={o.id}>
                    <div style={{ display: "flex", fontSize: 13 }}><span>{o.label}</span><span style={{ marginLeft: "auto", color: "#5b6b82" }}>{o.votes} voto(s) · {((Number(o.weight) / totalW) * 100).toFixed(1)}%</span></div>
                    <div style={{ height: 8, background: "#eef3fb", borderRadius: 999, marginTop: 3 }}><div style={{ height: 8, width: `${(Number(o.weight) / totalW) * 100}%`, background: "#1f6feb", borderRadius: 999 }} /></div>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Accesos ----------
type Visitor = { id: string; kind: string; full_name: string; access_code: string; status: string; valid_until: string | null; units?: { code?: string } | null }
type Delivery = { id: string; courier: string; description: string; status: string; received_at: string; delivered_to: string; units?: { code?: string } | null }

function AccesosView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [err, setErr] = useState("")
  const [del, setDel] = useState({ courier: "", description: "" })
  const load = useCallback(async () => {
    try { const d = await api("/api/panel/visitors"); setVisitors((d.visitors as Visitor[]) || []); setDeliveries((d.deliveries as Delivery[]) || []) } catch (e) { setErr(String((e as Error).message)) }
  }, [api])
  useEffect(() => { load() }, [load])
  async function vStatus(v: Visitor, status: string) { try { await api("/api/panel/visitors", { method: "POST", body: JSON.stringify({ kind: "visitorStatus", visitorId: v.id, status }) }); await load() } catch (e) { setErr(String((e as Error).message)) } }
  async function addDelivery(e: React.FormEvent) { e.preventDefault(); try { await api("/api/panel/visitors", { method: "POST", body: JSON.stringify({ kind: "delivery", courier: del.courier, description: del.description }) }); setDel({ courier: "", description: "" }); await load() } catch (e) { setErr(String((e as Error).message)) } }
  async function delDone(d: Delivery) { const who = prompt("¿Quién retira?") || ""; try { await api("/api/panel/visitors", { method: "POST", body: JSON.stringify({ kind: "deliveryDone", deliveryId: d.id, deliveredTo: who }) }); await load() } catch (e) { setErr(String((e as Error).message)) } }
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 14px" }}>Accesos y encomiendas</h1>
      {err && <div style={errBox}>{err}</div>}
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Visitas</div>
        {visitors.length === 0 ? <p style={{ color: "#5b6b82", margin: 0 }}>Sin visitas registradas.</p> : visitors.map((v) => (
          <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f0f3f8" }}>
            <span style={badge(v.status === "dentro" ? "activa" : v.status === "salio" ? "desocupada" : "en_mora")}>{v.status}</span>
            <b>{v.full_name}</b><span style={{ fontSize: 12, color: "#8494a8" }}>{v.units?.code ? `· ${v.units.code}` : ""} · {v.kind} · cód {v.access_code}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}><button onClick={() => vStatus(v, "dentro")} style={btnMini}>Entró</button><button onClick={() => vStatus(v, "salio")} style={btnMini}>Salió</button></div>
          </div>
        ))}
      </Card>
      <div style={{ marginTop: 14 }}><Card>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Encomiendas</div>
        <form onSubmit={addDelivery} style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <input value={del.courier} onChange={(e) => setDel({ ...del, courier: e.target.value })} placeholder="Empresa (MRW, Zoom…)" style={{ ...input, width: 160 }} />
          <input value={del.description} onChange={(e) => setDel({ ...del, description: e.target.value })} placeholder="Descripción / unidad" style={{ ...input, flex: 1, minWidth: 160 }} />
          <button type="submit" style={btnPrimary}>Registrar</button>
        </form>
        {deliveries.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f3f8", fontSize: 14 }}>
            <span style={badge(d.status === "entregada" ? "activa" : "en_mora")}>{d.status}</span>
            <span>{d.courier} · {d.description} {d.units?.code ? `· ${d.units.code}` : ""}</span>
            {d.status !== "entregada" && <button onClick={() => delDone(d)} style={{ ...btnMini, marginLeft: "auto" }}>Entregar</button>}
          </div>
        ))}
      </Card></div>
    </div>
  )
}

// ---------- Documentos ----------
type Doc = { id: string; title: string; category: string; file_url: string; file_name: string; visibility: string; created_at: string }

function DocumentosView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [items, setItems] = useState<Doc[]>([])
  const [err, setErr] = useState("")
  const [form, setForm] = useState({ title: "", category: "reglamento", url: "", visibility: "residentes" })
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { const d = await api("/api/panel/documents"); setItems((d.documents as Doc[]) || []) } catch (e) { setErr(String((e as Error).message)) }
  }, [api])
  useEffect(() => { load() }, [load])
  async function addUrl() { if (!form.title.trim()) { setErr("Escribe el título"); return } setBusy(true); setErr(""); try { await api("/api/panel/documents", { method: "POST", body: JSON.stringify(form) }); setForm({ title: "", category: "reglamento", url: "", visibility: "residentes" }); await load() } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) } }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (!form.title.trim()) { setErr("Escribe el título antes de subir"); e.target.value = ""; return }
    const reader = new FileReader()
    reader.onload = async () => { setBusy(true); setErr(""); try { await api("/api/panel/documents", { method: "POST", body: JSON.stringify({ title: form.title, category: form.category, visibility: form.visibility, dataUrl: reader.result, fileName: file.name }) }); setForm({ title: "", category: "reglamento", url: "", visibility: "residentes" }); await load() } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) } }
    reader.readAsDataURL(file); e.target.value = ""
  }
  async function remove(id: string) { if (!confirm("¿Eliminar documento?")) return; try { await api("/api/panel/documents", { method: "POST", body: JSON.stringify({ kind: "delete", id }) }); await load() } catch (e) { setErr(String((e as Error).message)) } }
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 14px" }}>Documentos</h1>
      {err && <div style={errBox}>{err}</div>}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, alignItems: "end" }}>
          <Field label="Título *"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Reglamento interno" style={input} /></Field>
          <Field label="Categoría"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={input}>{["reglamento", "acta", "estado_financiero", "poliza", "contrato", "general"].map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Visible para"><select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} style={input}><option value="residentes">Residentes</option><option value="junta">Solo junta</option></select></Field>
          <Field label="URL (opcional)"><input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" style={input} /></Field>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={addUrl} disabled={busy} style={btnPrimary}>Agregar por URL</button>
          <label style={{ ...btnGhost, cursor: "pointer" }}>{busy ? "Subiendo…" : "⬆️ Subir archivo"}<input type="file" onChange={onFile} style={{ display: "none" }} disabled={busy} /></label>
        </div>
      </Card>
      <div style={{ marginTop: 14 }}><Card>
        {items.length === 0 ? <p style={{ color: "#5b6b82", margin: 0 }}>Sin documentos.</p> : items.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #f0f3f8" }}>
            <span>📄</span><a href={d.file_url} target="_blank" rel="noopener" style={{ fontWeight: 600, color: "#1554b8", textDecoration: "none" }}>{d.title}</a>
            <span style={{ fontSize: 12, color: "#8494a8" }}>{d.category} · {d.visibility}</span>
            <button onClick={() => remove(d.id)} style={{ ...btnMiniDanger, marginLeft: "auto" }}>Eliminar</button>
          </div>
        ))}
      </Card></div>
    </div>
  )
}

// ---------- Fiscal ----------
type FiscalState = { fiscalEnabled: boolean; rifNumber: string; fiscalAddress: string; igtfEnabled: boolean; igtfRate: number }

function FiscalView({ api }: { api: (p: string, i?: RequestInit) => Promise<Record<string, unknown>> }) {
  const [f, setF] = useState<FiscalState>({ fiscalEnabled: false, rifNumber: "", fiscalAddress: "", igtfEnabled: true, igtfRate: 3 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const [msg, setMsg] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setErr("")
    try { const d = await api("/api/panel/fiscal"); if (d.fiscal) setF(d.fiscal as FiscalState) } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }, [api])
  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true); setErr(""); setMsg("")
    try {
      const d = await api("/api/panel/fiscal", { method: "POST", body: JSON.stringify(f) })
      if (d.fiscal) setF(d.fiscal as FiscalState)
      setMsg("✓ Configuración fiscal guardada")
    } catch (e) { setErr(String((e as Error).message)) } finally { setSaving(false) }
  }

  const modeBanner = f.fiscalEnabled
    ? { bg: "linear-gradient(120deg,#1e874b,#2fa968)", icon: "🏛️", title: "Facturación fiscal activa", desc: "El sistema está en modo fiscal. El documento fiscal oficial lo emite la máquina fiscal SENIAT." }
    : { bg: "linear-gradient(120deg,#0a6f9c,#0f9bd7)", icon: "📄", title: "Solo recibos (no fiscal)", desc: "Los documentos que ve el cliente son recibos, no facturas. Sin riesgos con el SENIAT. Toda la base ya está lista para fiscalizar cuando lo decidas." }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 14px" }}>Configuración fiscal</h1>
      {err && <div style={errBox}>{err}</div>}
      {msg && <div style={{ ...errBox, background: "#e6f4ea", color: "#1e874b" }}>{msg}</div>}

      <div style={{ background: modeBanner.bg, color: "#fff", marginBottom: 14, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 34 }}>{modeBanner.icon}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{modeBanner.title}</div>
            <div style={{ fontSize: 13, opacity: 0.92, maxWidth: 620 }}>{modeBanner.desc}</div>
          </div>
        </div>
      </div>

      {loading ? <Card><p style={{ color: "#5b6b82", margin: 0 }}>Cargando…</p></Card> : (
        <Card>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, cursor: "pointer", marginBottom: 6 }}>
            <input type="checkbox" checked={f.fiscalEnabled} onChange={(e) => setF({ ...f, fiscalEnabled: e.target.checked })} />
            Activar facturación fiscal (emitir facturas en vez de solo recibos)
          </label>
          <p style={{ fontSize: 12, color: "#8494a8", margin: "0 0 14px" }}>
            Actívalo solo cuando tengas RIF y máquina fiscal homologada. Mientras esté apagado, el centro comercial emite <b>recibos no fiscales</b>.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            <Field label="RIF del centro comercial"><input value={f.rifNumber} onChange={(e) => setF({ ...f, rifNumber: e.target.value })} placeholder="J-12345678-9" style={input} /></Field>
            <Field label="Dirección fiscal"><input value={f.fiscalAddress} onChange={(e) => setF({ ...f, fiscalAddress: e.target.value })} placeholder="Av. …, Naguanagua" style={input} /></Field>
          </div>

          <div style={{ borderTop: "1px solid #e6eef5", marginTop: 14, paddingTop: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
              <input type="checkbox" checked={f.igtfEnabled} onChange={(e) => setF({ ...f, igtfEnabled: e.target.checked })} />
              Cobrar IGTF en pagos en divisas
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
              <Field label="Tasa de IGTF (%)"><input type="number" step="0.1" min={0} max={100} value={f.igtfRate} onChange={(e) => setF({ ...f, igtfRate: Number(e.target.value) })} style={input} /></Field>
            </div>
            <p style={{ fontSize: 12, color: "#8494a8", margin: "8px 0 0" }}>Aplica al pagar en divisas en efectivo (ej. estacionamiento). Los pagos en bolívares no llevan IGTF.</p>
          </div>

          <div style={{ marginTop: 16 }}>
            <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Guardando…" : "Guardar configuración"}</button>
          </div>
        </Card>
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
  const map: Record<string, string> = {
    // locales
    disponible: "#e6f4ea|#1e874b", ocupado: "#eef3fb|#1554b8", reservado: "#fff5e6|#8a5a00", mantenimiento: "#f3e8fd|#7a3fb0", inactivo: "#f0f0f0|#6b7280",
    // contratos
    activo: "#e6f4ea|#1e874b", borrador: "#f0f0f0|#6b7280", por_vencer: "#fff5e6|#8a5a00", vencido: "#fdecea|#c0392b", renovado: "#e6f4ea|#1e874b", terminado: "#f0f0f0|#6b7280",
    // estacionamiento
    abierto: "#e5f4fb|#0a6f9c", pagado: "#e6f4ea|#1e874b", cortesia: "#fff5e6|#8a5a00", anulado: "#f0f0f0|#6b7280", por_pagar: "#fff5e6|#8a5a00",
    // publicidad
    finalizado: "#eef3fb|#1554b8", cancelado: "#f0f0f0|#6b7280",
    // consultorios
    solicitada: "#fff5e6|#8a5a00", confirmada: "#e5f4fb|#0a6f9c", atendida: "#e6f4ea|#1e874b", cancelada: "#f0f0f0|#6b7280", no_asistio: "#fdecea|#c0392b",
    // atención al cliente
    nuevo: "#fff5e6|#8a5a00", en_proceso: "#e5f4fb|#0a6f9c", resuelto: "#e6f4ea|#1e874b", cerrado: "#f0f0f0|#6b7280",
    // legado condominio
    activa: "#e6f4ea|#1e874b", desocupada: "#eef3fb|#1554b8", en_mora: "#fdecea|#c0392b", inactiva: "#f0f0f0|#6b7280",
  }
  const [bg, fg] = (map[status] || "#eef3fb|#1554b8").split("|")
  return { background: bg, color: fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }
}

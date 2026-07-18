"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Copy, Download, Loader2, Megaphone, Plus, Save, Send, Star, Trash2, UserRound } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import ProviderConnectionCard from "@/components/local/ProviderConnectionCard"
import {
  campaignPhoneList,
  filterCampaignRows,
  renderCampaignTemplate,
  type CampaignFilters,
  type CampaignGuestRow,
  type CampaignTemplate,
} from "@/lib/hotelCampaigns"
import {
  DEFAULT_HOTEL_AUTO_PROMOS,
  type HotelAutoPromosConfig,
} from "@/lib/hotelAutoPromos"
import { downloadCsv, toCsv } from "@/lib/csv"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Profile = {
  id: string
  fullName: string
  phone: string
  email: string
  tags: string
  vip: boolean
  notes: string
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

const CRM_INPUT_CLASS =
  "rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

// Campañas / listas segmentadas (P2-D): filtra la base unificada de huéspedes
// y la convierte en teléfonos para WhatsApp, CSV o mensajes con plantilla.
function CampaignsSection({ inputClass }: { inputClass: string }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [rows, setRows] = useState<CampaignGuestRow[]>([])
  const [templates, setTemplates] = useState<CampaignTemplate[]>([])
  const [hotelName, setHotelName] = useState("")

  const [stayedFrom, setStayedFrom] = useState("")
  const [stayedTo, setStayedTo] = useState("")
  const [minSpent, setMinSpent] = useState("")
  const [birthdayMonth, setBirthdayMonth] = useState("")
  const [membership, setMembership] = useState<"" | "member" | "nonmember">("")
  const [vipOnly, setVipOnly] = useState(false)

  const [templateId, setTemplateId] = useState("")
  const [templateText, setTemplateText] = useState("")
  const [savingTpl, setSavingTpl] = useState(false)

  const [whatsappReady, setWhatsappReady] = useState(false)
  const [sendMode, setSendMode] = useState<"template" | "freetext" | "off">("off")
  const [sending, setSending] = useState(false)

  const [autoPromos, setAutoPromos] = useState<HotelAutoPromosConfig>(DEFAULT_HOTEL_AUTO_PROMOS)
  const [savingAuto, setSavingAuto] = useState(false)
  const [runningAuto, setRunningAuto] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/guest-profiles?view=campaigns", { headers: authHeaders(), cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la base de campañas")
      setRows(data.rows || [])
      setTemplates(data.templates || [])
      setHotelName(data.hotelName || "")
      setWhatsappReady(data.whatsappReady === true)
      setSendMode(data.sendMode === "template" || data.sendMode === "freetext" ? data.sendMode : "off")
      if (data.autoPromos) setAutoPromos(data.autoPromos as HotelAutoPromosConfig)
      if ((data.templates || []).length > 0) {
        setTemplateId(data.templates[0].id)
        setTemplateText(data.templates[0].text)
      }
      setLoaded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  const filters: CampaignFilters = useMemo(
    () => ({
      stayedFrom,
      stayedTo,
      minSpent: Number(minSpent) || 0,
      birthdayMonth: Number(birthdayMonth) || null,
      membership,
      vipOnly,
    }),
    [stayedFrom, stayedTo, minSpent, birthdayMonth, membership, vipOnly],
  )

  const filtered = useMemo(() => filterCampaignRows(rows, filters), [rows, filters])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(""), 3000)
  }

  async function copyPhones() {
    const list = campaignPhoneList(filtered)
    if (!list) {
      flash("La selección no tiene teléfonos para copiar.")
      return
    }
    try {
      await navigator.clipboard.writeText(list)
      flash(`${list.split(", ").length} teléfonos copiados. Pégalos en WhatsApp.`)
    } catch {
      flash("Tu navegador no permitió copiar. Usa el CSV.")
    }
  }

  function exportCsv() {
    const header = ["Nombre", "Teléfono", "Email", "Estadías", "Gastado (USD)", "Última llegada", "Cumple (mes)", "Membresía", "VIP", "Mensaje"]
    const body = filtered.map((r) => [
      r.name,
      r.phone,
      r.email,
      r.stays,
      r.totalSpent,
      r.lastCheckIn,
      r.birthMonth ? MONTH_NAMES[r.birthMonth - 1] : "",
      r.isMember ? "Sí" : "No",
      r.vip ? "Sí" : "No",
      renderCampaignTemplate(templateText, { nombre: r.name.split(" ")[0], hotel: hotelName }),
    ])
    downloadCsv(`campana-huespedes-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...body]))
    flash(`CSV exportado con ${filtered.length} huéspedes.`)
  }

  function pickTemplate(id: string) {
    setTemplateId(id)
    const found = templates.find((t) => t.id === id)
    if (found) setTemplateText(found.text)
  }

  async function saveTemplates() {
    setSavingTpl(true)
    setError("")
    try {
      const next = templates.map((t) => (t.id === templateId ? { ...t, text: templateText.trim() } : t))
      const res = await fetch("/api/guest-profiles", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "saveCampaignTemplates", templates: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la plantilla")
      setTemplates(data.templates || next)
      flash("Plantillas guardadas.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSavingTpl(false)
    }
  }

  async function sendCampaign() {
    if (!whatsappReady) {
      flash("Conecta WhatsApp Business para enviar automáticamente.")
      return
    }
    const count = filtered.length
    if (count === 0) {
      flash("La selección no tiene huéspedes.")
      return
    }
    if (!templateText.trim()) {
      flash("Escribe el mensaje de la campaña.")
      return
    }
    const modeNote =
      sendMode === "freetext"
        ? "\n\nSin plantilla de marketing: solo llegará a quienes te escribieron en las últimas 24 h."
        : ""
    const ok = window.confirm(
      `Se enviará por WhatsApp a ${count} huésped${count === 1 ? "" : "es"} del segmento.${modeNote}\n\n¿Continuar?`,
    )
    if (!ok) return
    setSending(true)
    setError("")
    try {
      const res = await fetch("/api/guest-profiles", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "sendCampaign", templateText: templateText.trim(), filters }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo enviar la campaña")
      const parts = [`Enviados: ${data.sent}`]
      if (data.alreadySent) parts.push(`ya recibidos: ${data.alreadySent}`)
      if (data.failed) parts.push(`fallidos: ${data.failed}`)
      if (data.invalidPhone) parts.push(`sin WhatsApp válido: ${data.invalidPhone}`)
      if (data.truncated) parts.push(`tope ${data.recipients} (quedaron más)`)
      flash(parts.join(" · "))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSending(false)
    }
  }

  async function saveAutoPromos() {
    setSavingAuto(true)
    setError("")
    try {
      const res = await fetch("/api/guest-profiles", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "saveAutoPromos", autoPromos }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo guardar")
      if (data.autoPromos) setAutoPromos(data.autoPromos as HotelAutoPromosConfig)
      flash("Promociones automáticas guardadas.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSavingAuto(false)
    }
  }

  async function runAutoPromosNow() {
    if (!whatsappReady) {
      flash("Conecta WhatsApp Business para enviar automáticamente.")
      return
    }
    if (!window.confirm("Se enviarán ahora las promos automáticas que correspondan a hoy. ¿Continuar?")) return
    setRunningAuto(true)
    setError("")
    try {
      const res = await fetch("/api/guest-profiles", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "runAutoPromosNow" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudieron enviar")
      const d = data.dispatch || {}
      flash(`Promos de hoy · enviadas: ${d.sent || 0} · ya recibidas: ${d.alreadySent || 0} · fallidas: ${d.failed || 0}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setRunningAuto(false)
    }
  }

  const preview = filtered[0]
    ? renderCampaignTemplate(templateText, { nombre: filtered[0].name.split(" ")[0], hotel: hotelName })
    : renderCampaignTemplate(templateText, { nombre: "María", hotel: hotelName })

  return (
    <section className="mt-4 rounded-2xl border border-[var(--brand-primary)]/20 bg-white">
      <button
        onClick={() => {
          setOpen((v) => !v)
          if (!loaded && !loading) load()
        }}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 font-serif text-lg font-semibold text-[var(--brand-ink-3)]">
          <Megaphone size={18} className="text-[var(--brand-primary)]" /> Campañas y listas
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          {open ? "Ocultar" : "Segmentar huéspedes"}
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--brand-primary)]/15 px-4 py-4">
          {loading ? (
            <p className="inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={16} /> Cargando la base…</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--brand-ink-2)]/60">
                  Estuvo desde
                  <input type="date" value={stayedFrom} onChange={(e) => setStayedFrom(e.target.value)} className={`${inputClass} mt-1 w-full`} />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--brand-ink-2)]/60">
                  Hasta
                  <input type="date" value={stayedTo} onChange={(e) => setStayedTo(e.target.value)} className={`${inputClass} mt-1 w-full`} />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--brand-ink-2)]/60">
                  Gastó más de (USD)
                  <input type="number" min={0} value={minSpent} onChange={(e) => setMinSpent(e.target.value)} placeholder="0" className={`${inputClass} mt-1 w-full`} />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--brand-ink-2)]/60">
                  Cumple años en
                  <select value={birthdayMonth} onChange={(e) => setBirthdayMonth(e.target.value)} className={`${inputClass} mt-1 w-full`}>
                    <option value="">Cualquier mes</option>
                    {MONTH_NAMES.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--brand-ink-2)]/60">
                  Membresía
                  <select value={membership} onChange={(e) => setMembership(e.target.value as "" | "member" | "nonmember")} className={`${inputClass} mt-1 w-full`}>
                    <option value="">Todos</option>
                    <option value="member">Con membresía</option>
                    <option value="nonmember">Sin membresía</option>
                  </select>
                </label>
                <label className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                  <input type="checkbox" checked={vipOnly} onChange={(e) => setVipOnly(e.target.checked)} className="h-4 w-4" /> Solo VIP
                </label>
              </div>

              <p className="mt-4 font-bold text-[var(--brand-ink-3)]">
                {filtered.length} huésped{filtered.length === 1 ? "" : "es"} en la selección
                <span className="ml-2 text-sm font-bold text-[var(--brand-ink-2)]/55">(base total: {rows.length})</span>
              </p>

              {filtered.length > 0 && (
                <ul className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {filtered.slice(0, 60).map((r) => (
                    <li key={`${r.name}-${r.phone}`} className="rounded-full border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-1 text-xs font-bold text-[var(--brand-ink-2)]">
                      {r.name}
                      {r.phone && <span className="ml-1 text-[var(--brand-ink-2)]/55">{r.phone}</span>}
                      {r.isMember && <span className="ml-1 text-[var(--brand-primary)]">· miembro</span>}
                    </li>
                  ))}
                  {filtered.length > 60 && (
                    <li className="px-3 py-1 text-xs font-bold text-[var(--brand-ink-2)]/55">y {filtered.length - 60} más…</li>
                  )}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={sendCampaign} disabled={!whatsappReady || sending || filtered.length === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold uppercase text-white disabled:opacity-50">
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {sending ? "Enviando…" : "Enviar por WhatsApp"}
                </button>
                <button onClick={copyPhones} disabled={filtered.length === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-bold uppercase text-white disabled:opacity-50">
                  <Copy size={15} /> Copiar teléfonos
                </button>
                <button onClick={exportCsv} disabled={filtered.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-primary)]/40 px-4 py-2.5 text-sm font-bold uppercase text-[var(--brand-primary)] disabled:opacity-50">
                  <Download size={15} /> Exportar CSV
                </button>
              </div>

              <div className="mt-2 rounded-xl border border-emerald-600/20 bg-emerald-50/60 px-3 py-2 text-xs font-bold text-emerald-900/80">
                {!whatsappReady ? (
                  <>WhatsApp Business no está conectado. El envío automático se activa cuando el hotel configura sus credenciales (variables <code>WHATSAPP_BUSINESS_*</code>). Mientras tanto usa Copiar/Exportar.</>
                ) : sendMode === "template" ? (
                  <>WhatsApp Business conectado · se enviará tu plantilla de marketing aprobada (nombre y hotel personalizados) a todo el segmento.</>
                ) : (
                  <>WhatsApp Business conectado, sin plantilla de marketing: el envío llega solo a huéspedes que te escribieron en las últimas 24 h. Para llegar a todos, aprueba una plantilla en Meta y ponla en <code>WHATSAPP_CAMPAIGN_TEMPLATE</code>.</>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/60 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-ink-2)]/60">
                  Plantilla de mensaje — usa {"{nombre}"} y {"{hotel}"}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-[200px_1fr]">
                  <select value={templateId} onChange={(e) => pickTemplate(e.target.value)} className={`${inputClass} h-fit`}>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <textarea value={templateText} onChange={(e) => setTemplateText(e.target.value)} rows={3} className={`${inputClass} w-full font-medium`} />
                </div>
                <p className="mt-2 text-sm font-medium text-[var(--brand-ink-2)]/75">
                  <span className="font-bold text-[var(--brand-ink-2)]/55">Así se ve: </span>
                  {preview}
                </p>
                <button onClick={saveTemplates} disabled={savingTpl || !templateText.trim()} className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-primary)]/40 px-3 py-2 text-xs font-bold uppercase text-[var(--brand-primary)] disabled:opacity-50">
                  <Save size={14} /> {savingTpl ? "Guardando…" : "Guardar plantilla"}
                </button>
              </div>

              <p className="mt-3 text-xs font-bold text-[var(--brand-ink-2)]/50">
                El CSV incluye una columna Mensaje ya personalizada por huésped. Con WhatsApp Business conectado, &quot;Enviar por WhatsApp&quot; manda la promo a todo el segmento con un clic.
              </p>

              <div className="mt-6 rounded-xl border border-[var(--brand-primary)]/20 bg-white p-3">
                <p className="font-serif text-base font-semibold text-[var(--brand-ink-3)]">Promociones automáticas</p>
                <p className="mt-1 text-xs font-medium text-[var(--brand-ink-2)]/60">
                  El sistema las envía solo (una vez al día). Cada una se prende por separado y solo funciona con WhatsApp Business conectado. Usa {"{nombre}"} y {"{hotel}"}.
                </p>

                {/* Cumpleaños */}
                <div className="mt-3 rounded-lg border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-3">
                  <label className="flex items-center gap-2 font-bold text-[var(--brand-ink-3)]">
                    <input type="checkbox" className="h-4 w-4" checked={autoPromos.birthday.enabled}
                      onChange={(e) => setAutoPromos((c) => ({ ...c, birthday: { ...c.birthday, enabled: e.target.checked } }))} />
                    🎂 Cumpleaños del mes
                  </label>
                  <textarea rows={2} value={autoPromos.birthday.message}
                    onChange={(e) => setAutoPromos((c) => ({ ...c, birthday: { ...c.birthday, message: e.target.value } }))}
                    className={`${inputClass} mt-2 w-full font-medium`} />
                </div>

                {/* Post-estadía */}
                <div className="mt-2 rounded-lg border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="flex items-center gap-2 font-bold text-[var(--brand-ink-3)]">
                      <input type="checkbox" className="h-4 w-4" checked={autoPromos.postStay.enabled}
                        onChange={(e) => setAutoPromos((c) => ({ ...c, postStay: { ...c.postStay, enabled: e.target.checked } }))} />
                      👋 Post-estadía
                    </label>
                    <label className="text-xs font-bold text-[var(--brand-ink-2)]/70">
                      a los
                      <input type="number" min={1} max={90} value={autoPromos.postStay.days}
                        onChange={(e) => setAutoPromos((c) => ({ ...c, postStay: { ...c.postStay, days: Number(e.target.value) || 1 } }))}
                        className={`${inputClass} mx-1 w-16 px-2 py-1`} />
                      días del check-out
                    </label>
                  </div>
                  <textarea rows={2} value={autoPromos.postStay.message}
                    onChange={(e) => setAutoPromos((c) => ({ ...c, postStay: { ...c.postStay, message: e.target.value } }))}
                    className={`${inputClass} mt-2 w-full font-medium`} />
                </div>

                {/* Reactivar inactivos */}
                <div className="mt-2 rounded-lg border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="flex items-center gap-2 font-bold text-[var(--brand-ink-3)]">
                      <input type="checkbox" className="h-4 w-4" checked={autoPromos.winback.enabled}
                        onChange={(e) => setAutoPromos((c) => ({ ...c, winback: { ...c.winback, enabled: e.target.checked } }))} />
                      💤 Reactivar inactivos
                    </label>
                    <label className="text-xs font-bold text-[var(--brand-ink-2)]/70">
                      sin volver hace
                      <input type="number" min={1} max={36} value={autoPromos.winback.months}
                        onChange={(e) => setAutoPromos((c) => ({ ...c, winback: { ...c.winback, months: Number(e.target.value) || 1 } }))}
                        className={`${inputClass} mx-1 w-16 px-2 py-1`} />
                      meses
                    </label>
                  </div>
                  <textarea rows={2} value={autoPromos.winback.message}
                    onChange={(e) => setAutoPromos((c) => ({ ...c, winback: { ...c.winback, message: e.target.value } }))}
                    className={`${inputClass} mt-2 w-full font-medium`} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={saveAutoPromos} disabled={savingAuto} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-primary)]/40 px-3 py-2 text-xs font-bold uppercase text-[var(--brand-primary)] disabled:opacity-50">
                    <Save size={14} /> {savingAuto ? "Guardando…" : "Guardar automáticas"}
                  </button>
                  <button onClick={runAutoPromosNow} disabled={!whatsappReady || runningAuto} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold uppercase text-white disabled:opacity-50">
                    {runningAuto ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {runningAuto ? "Enviando…" : "Enviar las de hoy"}
                  </button>
                </div>
                <p className="mt-2 text-xs font-medium text-[var(--brand-ink-2)]/55">
                  La oferta de temporada se envía cuando quieras con el botón &quot;Enviar por WhatsApp&quot; de arriba. Para que corran solas cada día, el hosting debe tener configurado el secreto del cron (<code>CRON_SECRET</code>).
                </p>
              </div>
            </>
          )}
          {notice && <p className="mt-3 font-bold text-emerald-700">{notice}</p>}
          {error && <p className="mt-3 font-bold text-red-600">{error}</p>}
        </div>
      )}
    </section>
  )
}

export default function CrmPage() {
  return (
    <ModuleAccessGuard moduleKey="guestCrm" moduleName="CRM de huéspedes">
      <CrmContent />
    </ModuleAccessGuard>
  )
}

function CrmContent() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [tags, setTags] = useState("")
  const [vip, setVip] = useState(false)
  const [notes, setNotes] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/guest-profiles", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setProfiles(data.profiles || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter(
      (p) => p.fullName.toLowerCase().includes(q) || p.phone.includes(q) || p.tags.toLowerCase().includes(q),
    )
  }, [profiles, search])

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/guest-profiles", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo procesar")
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function addProfile() {
    if (!fullName.trim()) return
    const ok = await post({ fullName: fullName.trim(), phone: phone.trim(), tags: tags.trim(), vip, notes: notes.trim() })
    if (ok) {
      setFullName("")
      setPhone("")
      setTags("")
      setVip(false)
      setNotes("")
    }
  }

  const inputClass = CRM_INPUT_CLASS

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <UserRound size={24} />
          </span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">CRM de huéspedes</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Fichas con etiquetas, VIP y notas para fidelizar.</p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para el CRM, o el módulo está desactivado.
          </p>
        ) : (
          <>
            <div className="mt-6 grid gap-2 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre del huésped" className={inputClass} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" className={inputClass} />
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Etiquetas (habitual, luna de miel…)" className={inputClass} />
              <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} className="h-4 w-4" /> VIP
              </label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (preferencias, alergias…)" className={`${inputClass} sm:col-span-2`} />
              <button onClick={addProfile} disabled={busy || !fullName.trim()} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-50 sm:col-span-2">
                <Plus size={16} /> Agregar ficha
              </button>
            </div>

            <CampaignsSection inputClass={inputClass} />

            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, teléfono o etiqueta…" className={`${inputClass} mt-4 w-full`} />

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                {profiles.length === 0 ? "Aún no hay fichas de huéspedes." : "Sin resultados para la búsqueda."}
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {filtered.map((p) => (
                  <li key={p.id} className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--brand-ink-3)]">
                          {p.fullName}
                          {p.vip && <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold uppercase text-amber-600"><Star size={12} className="fill-amber-400 text-amber-400" /> VIP</span>}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-3 text-sm font-bold text-[var(--brand-ink-2)]/65">
                          {p.phone && <span>{p.phone}</span>}
                          {p.tags && <span className="text-[var(--brand-primary)]">{p.tags}</span>}
                        </p>
                        {p.notes && <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/55">{p.notes}</p>}
                      </div>
                      <button
                        onClick={() => { if (window.confirm(`¿Eliminar la ficha de ${p.fullName}?`)) post({ action: "delete", id: p.id }) }}
                        disabled={busy}
                        title="Eliminar"
                        className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <ProviderConnectionCard providerId="email" />
          </>
        )}
      </div>
    </main>
  )
}

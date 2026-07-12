"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Copy, Loader2, Plus, Save, Settings2, Trash2 } from "lucide-react"
import { authHeaders, type Branch } from "./shared"

type BranchTable = { name: string; area: string }

type BranchScopedConfig = {
  mainWhatsapp?: string
  deliveryWhatsapp?: string
  localTables?: { name?: string; area?: string }[]
  exchangeRateMode?: "automatic" | "automaticEur" | "manual"
  manualExchangeRate?: number
}

// "" = heredar lo definido en Configuración → "Tasa y moneda".
type BranchRateMode = "" | "automatic" | "automaticEur" | "manual"

const EMPTY_TABLE: BranchTable = { name: "", area: "" }

// Sección "Configuración por sede": edita los campos que pisan la config
// global SOLO para la sucursal elegida (mesas propias y whatsapps), usando
// PATCH /api/branches/[id]/config. Sin mesas propias, la sede usa las mesas
// globales de Configuración; los QR (?branch=) leen esto en el flujo público.
export default function BranchConfigPanel({ branches }: { branches: Branch[] }) {
  const active = branches.filter((b) => b.is_active)

  const [branchId, setBranchId] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [okMsg, setOkMsg] = useState("")

  const [mainWhatsapp, setMainWhatsapp] = useState("")
  const [deliveryWhatsapp, setDeliveryWhatsapp] = useState("")
  const [useOwnTables, setUseOwnTables] = useState(false)
  const [tables, setTables] = useState<BranchTable[]>([])
  const [copyFrom, setCopyFrom] = useState("")
  const [rateMode, setRateMode] = useState<BranchRateMode>("")
  const [manualRate, setManualRate] = useState("")

  // Descarta respuestas viejas si el usuario cambia de sede a mitad de carga.
  const seqRef = useRef(0)

  const selectedId = branchId || active[0]?.id || ""
  const selectedBranch = active.find((b) => b.id === selectedId) || null

  const applyConfig = useCallback((config: BranchScopedConfig) => {
    setMainWhatsapp(config.mainWhatsapp || "")
    setDeliveryWhatsapp(config.deliveryWhatsapp || "")
    setRateMode(
      config.exchangeRateMode === "automatic" ||
        config.exchangeRateMode === "automaticEur" ||
        config.exchangeRateMode === "manual"
        ? config.exchangeRateMode
        : "",
    )
    setManualRate(
      Number(config.manualExchangeRate) > 0 ? String(config.manualExchangeRate) : "",
    )
    const ownTables = Array.isArray(config.localTables)
    setUseOwnTables(ownTables)
    setTables(
      ownTables && config.localTables!.length
        ? config.localTables!.map((t) => ({ name: t.name || "", area: t.area || "" }))
        : ownTables
          ? [{ ...EMPTY_TABLE }]
          : [],
    )
  }, [])

  const load = useCallback(
    async (id: string) => {
      if (!id) return
      const seq = ++seqRef.current
      setLoading(true)
      setError("")
      setOkMsg("")
      try {
        const res = await fetch(`/api/branches/${id}/config`, {
          headers: authHeaders(),
          cache: "no-store",
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "No se pudo cargar la configuración de la sede")
        if (seq !== seqRef.current) return
        applyConfig(data.branchConfig || {})
      } catch (e) {
        if (seq !== seqRef.current) return
        setError(e instanceof Error ? e.message : "Error")
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    },
    [applyConfig],
  )

  useEffect(() => {
    // Difiere la carga un tick para no hacer setState síncrono en el efecto.
    const timer = setTimeout(() => load(selectedId), 0)
    return () => clearTimeout(timer)
  }, [selectedId, load])

  if (active.length === 0) return null

  const cleanedTables = tables
    .map((t) => ({ name: t.name.trim(), area: t.area.trim() }))
    .filter((t) => t.name)
  const tablesInvalid = useOwnTables && cleanedTables.length === 0

  async function patchConfig(body: Record<string, unknown>, successFallback: string) {
    setSaving(true)
    setError("")
    setOkMsg("")
    try {
      const res = await fetch(`/api/branches/${selectedId}/config`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la configuración de la sede")
      applyConfig(data.branchConfig || {})
      setOkMsg(data.message || successFallback)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSaving(false)
    }
  }

  const manualRateValue = Number(manualRate)
  const manualRateInvalid =
    rateMode === "manual" && (!Number.isFinite(manualRateValue) || manualRateValue <= 0)

  function save() {
    if (tablesInvalid) {
      setError("Agrega al menos una mesa con nombre, o vuelve a usar las mesas globales.")
      return
    }
    if (manualRateInvalid) {
      setError("Pon la tasa manual de esta sede (Bs por dólar), o elige otra opción de tasa.")
      return
    }
    patchConfig(
      {
        branchConfig: {
          mainWhatsapp: mainWhatsapp.trim() || null,
          deliveryWhatsapp: deliveryWhatsapp.trim() || null,
          localTables: useOwnTables ? cleanedTables.map((t) => (t.area ? t : { name: t.name })) : null,
          exchangeRateMode: rateMode || null,
          manualExchangeRate: rateMode === "manual" ? manualRateValue : null,
        },
      },
      "Configuración de la sede guardada.",
    )
  }

  function copyFromBranch() {
    const source = active.find((b) => b.id === copyFrom)
    if (!source || !selectedBranch || source.id === selectedBranch.id) return
    if (
      !window.confirm(
        `¿Copiar la configuración de "${source.name}" a "${selectedBranch.name}"?\n\nSe reemplaza TODA la configuración propia de "${selectedBranch.name}" (mesas, whatsapps, tasa y textos públicos).`,
      )
    )
      return
    patchConfig({ copyFromBranchId: copyFrom }, "Configuración copiada a la sede.")
  }

  function updateTable(index: number, patch: Partial<BranchTable>) {
    setTables((current) => current.map((t, i) => (i === index ? { ...t, ...patch } : t)))
  }

  const inputClass =
    "w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 font-bold outline-none focus:border-[var(--brand-primary)]"
  const labelClass =
    "text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-3)]"

  return (
    <section className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
        <Settings2 size={16} /> Configuración por sede
      </h2>
      <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
        Mesas y WhatsApp propios de cada sucursal. Lo que definas aquí pisa lo
        global solo para esa sede; los QR de mesa y el menú público con ?branch=
        usan estos valores.
      </p>

      <div className="mt-4">
        <label className={labelClass} htmlFor="branch-config-branch">
          Sede a configurar
        </label>
        <select
          id="branch-config-branch"
          value={selectedId}
          onChange={(e) => {
            setBranchId(e.target.value)
            setCopyFrom("")
          }}
          className={`mt-1 ${inputClass}`}
        >
          {active.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-4 inline-flex items-center gap-2 font-bold">
          <Loader2 className="animate-spin" size={16} /> Cargando configuración…
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="branch-config-main-wa">
                WhatsApp principal de la sede
              </label>
              <input
                id="branch-config-main-wa"
                value={mainWhatsapp}
                onChange={(e) => setMainWhatsapp(e.target.value)}
                placeholder="Vacío = usa el global"
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="branch-config-delivery-wa">
                WhatsApp de delivery de la sede
              </label>
              <input
                id="branch-config-delivery-wa"
                value={deliveryWhatsapp}
                onChange={(e) => setDeliveryWhatsapp(e.target.value)}
                placeholder="Vacío = usa el global"
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </div>

          <div className="mt-5">
            <p className={labelClass}>Tasa de cambio de esta sede</p>
            <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
              Por defecto la sede hereda la tasa del negocio (Configuración →
              Tasa y moneda). Aquí puedes fijar una tasa propia solo para esta
              sucursal.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {([
                { value: "" as BranchRateMode, label: "Heredar del negocio" },
                { value: "automatic" as BranchRateMode, label: "BCV dólar" },
                { value: "automaticEur" as BranchRateMode, label: "BCV euro" },
                { value: "manual" as BranchRateMode, label: "Manual de esta sede" },
              ]).map((option) => (
                <button
                  key={option.value || "inherit"}
                  type="button"
                  onClick={() => setRateMode(option.value)}
                  className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                    rateMode === option.value
                      ? "border-green-600/30 bg-green-50 text-green-700"
                      : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]/60"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {rateMode === "manual" ? (
              <div className="mt-3 max-w-xs">
                <label className={labelClass} htmlFor="branch-config-manual-rate">
                  Tasa manual (Bs por dólar)
                </label>
                <input
                  id="branch-config-manual-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                  placeholder="Ej: 667.05"
                  className={`mt-1 ${inputClass}`}
                />
                {manualRateInvalid ? (
                  <p className="mt-1 text-xs font-bold text-red-600">
                    Pon un valor mayor que cero.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            <p className={labelClass}>Mesas de esta sede</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setUseOwnTables(false)
                  setTables([])
                }}
                className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                  !useOwnTables
                    ? "border-green-600/30 bg-green-50 text-green-700"
                    : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]/60"
                }`}
              >
                Usar mesas globales
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseOwnTables(true)
                  setTables((current) => (current.length ? current : [{ ...EMPTY_TABLE }]))
                }}
                className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                  useOwnTables
                    ? "border-green-600/30 bg-green-50 text-green-700"
                    : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]/60"
                }`}
              >
                Mesas propias
              </button>
            </div>

            {useOwnTables ? (
              <div className="mt-3 space-y-2">
                {tables.map((table, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <input
                      value={table.name}
                      onChange={(e) => updateTable(index, { name: e.target.value })}
                      placeholder={`Mesa ${index + 1}`}
                      aria-label={`Nombre de la mesa ${index + 1}`}
                      className={`min-w-0 flex-1 ${inputClass}`}
                    />
                    <input
                      value={table.area}
                      onChange={(e) => updateTable(index, { area: e.target.value })}
                      placeholder="Área (opcional)"
                      aria-label={`Área de la mesa ${index + 1}`}
                      className={`min-w-0 flex-1 ${inputClass}`}
                    />
                    <button
                      type="button"
                      onClick={() => setTables((current) => current.filter((_, i) => i !== index))}
                      title="Quitar mesa"
                      className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setTables((current) => [...current, { ...EMPTY_TABLE }])}
                  className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-xs font-black uppercase text-[var(--brand-primary)]"
                >
                  <Plus size={14} /> Agregar mesa
                </button>
                {tablesInvalid ? (
                  <p className="text-xs font-bold text-red-600">
                    Agrega al menos una mesa con nombre, o vuelve a usar las mesas globales.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-xs font-bold text-[var(--brand-ink-2)]/65">
                Esta sede usa las mesas globales definidas en Configuración.
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || tablesInvalid}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-black uppercase text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Guardar sede
            </button>

            {active.length > 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={copyFrom}
                  onChange={(e) => setCopyFrom(e.target.value)}
                  aria-label="Sede origen para copiar configuración"
                  className={inputClass + " w-auto"}
                >
                  <option value="">Copiar desde…</option>
                  {active
                    .filter((b) => b.id !== selectedId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={copyFromBranch}
                  disabled={saving || !copyFrom}
                  className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-sm font-black uppercase text-[var(--brand-primary)] disabled:opacity-50"
                >
                  <Copy size={15} /> Copiar
                </button>
              </div>
            ) : null}
          </div>

          {error ? <p className="mt-3 font-bold text-red-600">{error}</p> : null}
          {okMsg ? <p className="mt-3 font-bold text-green-700">{okMsg}</p> : null}
        </>
      )}
    </section>
  )
}

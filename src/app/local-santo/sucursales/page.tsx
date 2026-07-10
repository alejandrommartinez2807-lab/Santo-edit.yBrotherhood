"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRightLeft,
  Boxes,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  PartyPopper,
  Plus,
  QrCode,
  Trash2,
  Building2,
  UtensilsCrossed,
} from "lucide-react"
import BranchConfigPanel from "./BranchConfigPanel"
import { authHeaders, type Branch } from "./shared"

// Módulos operativos con enlace por sede: al abrir el enlace en un
// dispositivo, esa sede queda fijada ahí (ideal para la tablet de cada área).
const LINKABLE_MODULES = [
  { path: "caja", label: "Caja" },
  { path: "cocina", label: "Cocina" },
  { path: "mesonero", label: "Mesonero" },
  { path: "mesas", label: "Mesas y QR" },
  { path: "delivery", label: "Delivery" },
  { path: "inventario", label: "Inventario" },
] as const

function BranchLinksPanel({ branches }: { branches: Branch[] }) {
  const [copied, setCopied] = useState("")
  const active = branches.filter((b) => b.is_active)

  if (active.length === 0) return null

  const origin = typeof window !== "undefined" ? window.location.origin : ""

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied(""), 1500)
    } catch {
      /* sin permiso de portapapeles */
    }
  }

  return (
    <section className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
        <Link2 size={16} /> Enlaces por sede
      </h2>
      <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
        Abre el enlace en el dispositivo de cada área (o guárdalo como favorito):
        ese equipo queda fijado a su sede y el empleado solo pone su usuario.
      </p>
      <div className="mt-4 space-y-4">
        {active.map((b) => (
          <div key={b.id}>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink-3)]">
              {b.name}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {LINKABLE_MODULES.map((m) => {
                const url = `${origin}/local-santo/${m.path}?sede=${b.id}`
                return (
                  <button
                    key={m.path}
                    type="button"
                    onClick={() => copy(url)}
                    title={url}
                    className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[var(--brand-ink-2)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                  >
                    {copied === url ? (
                      <Check size={12} className="text-green-600" />
                    ) : (
                      <Copy size={12} />
                    )}
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Modo evento: cada evento/feria es una sede temporal con su propio QR. El
// cliente escanea y pide desde el menú público ya fijado a esa sede; al
// finalizarlo se desactiva (el QR deja de aplicar) pero sus ventas, cierres y
// reportes se conservan como los de cualquier sede.
type InventoryApiItem = {
  id: string
  name: string
  quantity: number
  unit: string
  category?: string
}

// Traslado de inventario del evento: enviar stock desde una sede (descuenta
// allá, suma aquí, con movimiento registrado en ambos lados) y devolver el
// sobrante al finalizar. Si el dueño prefiere un inventario propio del evento,
// no traslada nada y carga los insumos directo en el módulo Inventario con la
// sede del evento seleccionada.
function EventInventoryTools({ event, sedes }: { event: Branch; sedes: Branch[] }) {
  const [open, setOpen] = useState(false)
  const [sourceId, setSourceId] = useState(sedes[0]?.id || "")
  const [items, setItems] = useState<InventoryApiItem[]>([])
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [loadingItems, setLoadingItems] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState("")
  const [problem, setProblem] = useState("")

  async function loadSourceItems(branchId: string) {
    setLoadingItems(true)
    setProblem("")
    setItems([])
    setQuantities({})
    try {
      const res = await fetch("/api/inventory", {
        headers: { ...authHeaders(), "x-branch-id": branchId },
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el inventario de la sede")
      const list = (Array.isArray(data.inventory) ? data.inventory : []) as InventoryApiItem[]
      setItems(list.filter((item) => Number(item.quantity) > 0))
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Error cargando inventario")
    } finally {
      setLoadingItems(false)
    }
  }

  function toggleOpen() {
    const next = !open
    setOpen(next)
    setNotice("")
    if (next && sourceId) loadSourceItems(sourceId)
  }

  function changeSource(branchId: string) {
    setSourceId(branchId)
    if (branchId) loadSourceItems(branchId)
  }

  async function transfer(direction: "in" | "out", counterpartBranchId: string, payload: unknown) {
    setWorking(true)
    setProblem("")
    setNotice("")
    try {
      const res = await fetch(`/api/branches/${event.id}/inventory-transfer`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ direction, counterpartBranchId, items: payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo completar el traslado")
      setNotice(data.message || "Traslado listo.")
      return true
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Error en el traslado")
      return false
    } finally {
      setWorking(false)
    }
  }

  async function sendToEvent() {
    const lines = items
      .map((item) => ({ itemId: item.id, quantity: Number(quantities[item.id] || 0) }))
      .filter((line) => line.quantity > 0)
    if (!lines.length) {
      setProblem("Indica la cantidad a enviar en al menos un insumo.")
      return
    }
    if (await transfer("in", sourceId, lines)) {
      await loadSourceItems(sourceId)
    }
  }

  async function returnLeftover() {
    const target = sedes.find((s) => s.id === sourceId) || sedes[0]
    if (!target) return
    if (
      !window.confirm(
        `¿Devolver TODO el stock del evento "${event.name}" a "${target.name}"?\n\nSe traslada todo lo que quede disponible y ambos lados registran el movimiento.`,
      )
    )
      return
    await transfer("out", target.id, "all")
  }

  return (
    <div className="mt-3 rounded-xl border border-[var(--brand-primary)]/15 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70">
          <Boxes size={13} /> Inventario del evento
        </p>
        <button
          type="button"
          onClick={toggleOpen}
          className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[var(--brand-ink-2)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          {open ? "Cerrar traslado" : "Trasladar stock"}
        </button>
      </div>

      <p className="mt-1.5 text-[0.68rem] font-bold leading-5 text-[var(--brand-ink-2)]/60">
        Envía insumos desde una sede y devuelve el sobrante al finalizar. ¿Prefieres un
        inventario propio solo del evento? Cárgalo directo en{" "}
        <a
          href={`/local-santo/inventario?sede=${encodeURIComponent(event.id)}`}
          className="font-black text-[var(--brand-primary)] underline"
        >
          Inventario con esta sede
        </a>{" "}
        sin trasladar nada.
      </p>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/60">
              Sede origen
            </label>
            <select
              value={sourceId}
              onChange={(e) => changeSource(e.target.value)}
              className="rounded-lg border-2 border-[var(--brand-primary)]/25 bg-white px-2 py-1.5 text-xs font-bold outline-none focus:border-[var(--brand-primary)]"
            >
              {sedes.map((sede) => (
                <option key={sede.id} value={sede.id}>
                  {sede.name}
                </option>
              ))}
            </select>
          </div>

          {loadingItems ? (
            <p className="inline-flex items-center gap-2 text-xs font-bold text-[var(--brand-ink-2)]/60">
              <Loader2 className="animate-spin" size={14} /> Cargando inventario…
            </p>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-3 py-2 text-xs font-bold text-[var(--brand-ink-2)]/60">
              Esa sede no tiene stock disponible para enviar.
            </p>
          ) : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-3 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-[var(--brand-ink-3)]">{item.name}</p>
                    <p className="text-[0.62rem] font-bold text-[var(--brand-ink-2)]/55">
                      Disponible: {item.quantity} {item.unit}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={item.quantity}
                    step="any"
                    value={quantities[item.id] ?? ""}
                    onChange={(e) =>
                      setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="0"
                    className="w-20 rounded-lg border-2 border-[var(--brand-primary)]/25 bg-white px-2 py-1 text-right text-xs font-bold outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sendToEvent}
              disabled={working || loadingItems || items.length === 0}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)] px-4 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.08em] text-white disabled:opacity-50"
            >
              {working ? <Loader2 className="animate-spin" size={13} /> : <ArrowRightLeft size={13} />}
              Enviar al evento
            </button>
            <button
              type="button"
              onClick={returnLeftover}
              disabled={working}
              className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)] disabled:opacity-50"
            >
              <ArrowRightLeft size={13} />
              Devolver sobrante a la sede
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p className="mt-2 rounded-lg border border-green-600/25 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">
          {notice}
        </p>
      )}
      {problem && (
        <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
          {problem}
        </p>
      )}
    </div>
  )
}

function EventsPanel({
  events,
  sedes,
  busy,
  onCreate,
  onPatch,
  onRemove,
}: {
  events: Branch[]
  sedes: Branch[]
  busy: boolean
  onCreate: (name: string, copyMenuFromBranchId: string) => Promise<boolean>
  onPatch: (id: string, body: Record<string, unknown>) => Promise<void>
  onRemove: (branch: Branch) => Promise<void>
}) {
  const [newEventName, setNewEventName] = useState("")
  const [menuSourceId, setMenuSourceId] = useState(sedes[0]?.id || "")
  const [copied, setCopied] = useState("")

  const origin = typeof window !== "undefined" ? window.location.origin : ""

  function buildEventLink(branch: Branch) {
    return `${origin}/?branch=${encodeURIComponent(branch.id)}`
  }

  function buildQrImageUrl(link: string, size = 240) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=16&data=${encodeURIComponent(link)}`
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied(""), 1500)
    } catch {
      /* sin permiso de portapapeles */
    }
  }

  async function create() {
    const name = newEventName.trim()
    if (!name) return
    if (await onCreate(name, menuSourceId)) setNewEventName("")
  }

  function finishEvent(branch: Branch) {
    if (
      !window.confirm(
        `¿Finalizar el evento "${branch.name}"?\n\nEl QR dejará de funcionar y el evento se ocultará del menú público. Sus ventas, cierres y reportes se conservan.`,
      )
    )
      return
    onPatch(branch.id, { is_active: false })
  }

  return (
    <section className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
        <PartyPopper size={16} /> Modo evento
      </h2>
      <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
        Crea un evento (feria, festival, pop-up) como sede temporal: tiene su propio menú,
        caja y cierre, y un QR para que los clientes pidan desde el sitio. Asigna a tus
        promotores a esta sede en Usuarios y, al terminar, finalízalo: los números quedan
        guardados en reportes y cierres.
      </p>

      <div className="mt-4 space-y-2">
        <div className="flex gap-2">
          <input
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Nombre del evento (ej. Feria La Candelaria)"
            className="flex-1 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
          />
          <button
            onClick={create}
            disabled={busy || !newEventName.trim()}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
          >
            <Plus size={16} /> Crear evento
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/60">
            <UtensilsCrossed size={13} /> Menú inicial
          </label>
          <select
            value={menuSourceId}
            onChange={(e) => setMenuSourceId(e.target.value)}
            className="rounded-lg border-2 border-[var(--brand-primary)]/25 bg-white px-2 py-1.5 text-xs font-bold outline-none focus:border-[var(--brand-primary)]"
          >
            {sedes.map((sede) => (
              <option key={sede.id} value={sede.id}>
                Copiar menú de {sede.name}
              </option>
            ))}
            <option value="">Empezar con menú vacío</option>
          </select>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 rounded-xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4 text-xs font-bold text-[var(--brand-ink-2)]/60">
          Sin eventos todavía. Crea uno y comparte su QR el día de la feria.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {events.map((event) => {
            const link = buildEventLink(event)
            return (
              <li
                key={event.id}
                className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <input
                    defaultValue={event.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== event.name) onPatch(event.id, { name: v })
                    }}
                    className="min-w-0 flex-1 rounded-lg border-2 border-transparent bg-transparent px-2 py-1 text-lg font-black text-[var(--brand-ink-3)] outline-none hover:border-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                  />
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                        event.is_active
                          ? "border-green-600/30 bg-green-50 text-green-700"
                          : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]/60"
                      }`}
                    >
                      {event.is_active ? "En curso" : "Finalizado"}
                    </span>
                    {event.is_active ? (
                      <button
                        onClick={() => finishEvent(event)}
                        disabled={busy}
                        className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-3 py-1.5 text-xs font-black uppercase text-[var(--brand-primary)] disabled:opacity-50"
                      >
                        Finalizar
                      </button>
                    ) : (
                      <button
                        onClick={() => onPatch(event.id, { is_active: true })}
                        disabled={busy}
                        className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-xs font-black uppercase text-[var(--brand-ink-2)]/70 disabled:opacity-50"
                      >
                        Reactivar
                      </button>
                    )}
                    <button
                      onClick={() => onRemove(event)}
                      disabled={busy}
                      title="Eliminar evento y todos sus datos"
                      className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {event.is_active ? (
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <div className="rounded-xl border-2 border-[var(--brand-primary)]/15 bg-white p-2">
                      <Image
                        src={buildQrImageUrl(link)}
                        alt={`QR del evento ${event.name}`}
                        width={120}
                        height={120}
                        unoptimized
                        className="h-28 w-28 rounded-lg object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="inline-flex items-center gap-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70">
                        <QrCode size={13} /> QR del evento
                      </p>
                      <p className="mt-1 break-all text-xs font-bold text-[var(--brand-ink-2)]/80">{link}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyLink(link)}
                          className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[var(--brand-ink-2)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                        >
                          {copied === link ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                          Copiar enlace
                        </button>
                        <a
                          href={buildQrImageUrl(link, 600)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[var(--brand-ink-2)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                        >
                          <QrCode size={12} /> QR grande (imprimir)
                        </a>
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[var(--brand-ink-2)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                        >
                          <ExternalLink size={12} /> Abrir menú
                        </a>
                      </div>
                      <EventInventoryTools event={event} sedes={sedes} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs font-bold text-[var(--brand-ink-2)]/55">
                    Evento finalizado: el QR ya no aplica. Sus ventas y cierres siguen
                    disponibles en Reportes y Cierres. Reactívalo si vuelves a la feria.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default function SucursalesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/branches", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setBranches(data.branches || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Difiere la carga un tick para no hacer setState síncrono en el efecto.
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function createBranch(name: string, isEvent: boolean, copyMenuFromBranchId = "") {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          ...(isEvent ? { isEvent: true } : {}),
          ...(copyMenuFromBranchId ? { copyMenuFromBranchId } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear")
      // La sede quedó creada aunque el clonado del menú fallara: se avisa para
      // reintentar desde Menú o cargarlo a mano.
      if (data.menuCloneWarning) {
        setError(`Sede creada, pero el menú no se pudo clonar: ${data.menuCloneWarning}`)
      }
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    const name = newName.trim()
    if (!name) return
    if (await createBranch(name, false)) setNewName("")
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/branches/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function remove(b: Branch) {
    if (
      !window.confirm(
        `¿Eliminar la sucursal "${b.name}"?\n\nSe borrarán TODOS sus datos (pedidos, menú, inventario, caja). Esta acción no se puede deshacer.`,
      )
    )
      return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/branches/${b.id}`, { method: "DELETE", headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/local-santo"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Building2 size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Sucursales</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Cada sucursal tiene su propio menú, inventario, caja y reportes.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Solo el dueño puede gestionar las sucursales. Inicia sesión como dueño.
          </p>
        ) : (
          <>
            <div className="mt-6 flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Nombre de la nueva sucursal"
                className="flex-1 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
              />
              <button
                onClick={create}
                disabled={busy || !newName.trim()}
                className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
              >
                <Plus size={16} /> Crear
              </button>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {branches.filter((b) => !b.isEvent).map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4"
                  >
                    <input
                      defaultValue={b.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v && v !== b.name) patch(b.id, { name: v })
                      }}
                      className="min-w-0 flex-1 rounded-lg border-2 border-transparent bg-transparent px-2 py-1 text-lg font-black text-[var(--brand-ink-3)] outline-none hover:border-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => patch(b.id, { is_active: !b.is_active })}
                        disabled={busy}
                        className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                          b.is_active
                            ? "border-green-600/30 bg-green-50 text-green-700"
                            : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]/60"
                        }`}
                      >
                        {b.is_active ? "Activa" : "Inactiva"}
                      </button>
                      <button
                        onClick={() => remove(b)}
                        disabled={busy}
                        title="Eliminar sucursal"
                        className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!loading ? (
              <EventsPanel
                events={branches.filter((b) => b.isEvent)}
                sedes={branches.filter((b) => !b.isEvent && b.is_active)}
                busy={busy}
                onCreate={(name, copyMenuFromBranchId) =>
                  createBranch(name, true, copyMenuFromBranchId)
                }
                onPatch={patch}
                onRemove={remove}
              />
            ) : null}

            {!loading ? <BranchConfigPanel branches={branches} /> : null}

            {!loading ? <BranchLinksPanel branches={branches} /> : null}
          </>
        )}
      </div>
    </main>
  )
}

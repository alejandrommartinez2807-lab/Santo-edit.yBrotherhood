"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BedDouble,
  CalendarRange,
  CreditCard,
  Loader2,
  LogOut,
  Plus,
  Receipt,
  Trash2,
  UserRound,
  UtensilsCrossed,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Reservation = {
  id: string
  code: string
  guestName: string
  guestPhone: string
  roomId: string
  checkInDate: string
  checkOutDate: string
  nights: number
  ratePerNight: number
  totalAmount: number
  status: string
}
type Room = { id: string; name: string }
type Guest = {
  id: string
  fullName: string
  documentType: string
  documentNumber: string
  phone: string
  email: string
  nationality: string
  address: string
}
type Folio = { id: string; status: string }
type FolioItem = {
  id: string
  kind: "cargo" | "pago"
  category: string
  description: string
  amount: number
  method: string
  createdAt: string
}
type ChargeableOrder = {
  id: string
  number: number | null
  customerName: string
  tableNumber: string
  orderType: string
  status: string
  total: number
}
type FolioView = {
  folio: Folio | null
  items: FolioItem[]
  guest: Guest | null
  reservation: Reservation | null
  balance: number
  chargeableOrders?: ChargeableOrder[]
}

const CATEGORY_LABELS: Record<string, string> = {
  habitacion: "Habitación",
  restaurante: "Restaurante",
  minibar: "Minibar",
  lavanderia: "Lavandería",
  extra: "Extra",
  pago: "Pago",
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function FolioPage() {
  return (
    <ModuleAccessGuard moduleKey="folio" moduleName="Folio del huésped">
      <FolioContent />
    </ModuleAccessGuard>
  )
}

function FolioContent() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [view, setView] = useState<FolioView | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // Ficha del huésped (editable)
  const [g, setG] = useState<Guest>({
    id: "", fullName: "", documentType: "cedula", documentNumber: "",
    phone: "", email: "", nationality: "", address: "",
  })

  // Alta de cargo / pago
  const [chargeDesc, setChargeDesc] = useState("")
  const [chargeCat, setChargeCat] = useState("restaurante")
  const [chargeAmount, setChargeAmount] = useState("")
  const [payMethod, setPayMethod] = useState("Efectivo")
  const [payAmount, setPayAmount] = useState("")

  const roomNameById = useMemo(() => {
    const map = new Map<string, string>()
    rooms.forEach((r) => map.set(r.id, r.name))
    return map
  }, [rooms])

  const loadReservations = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const today = new Date()
      const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
      const res = await fetch(`/api/hotel-reservations?from=${from}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      // Solo estadías vigentes: pendiente/confirmada/checkin.
      setReservations(
        (data.reservations || []).filter((r: Reservation) =>
          ["pendiente", "confirmada", "checkin"].includes(r.status),
        ),
      )
      setRooms(data.rooms || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(loadReservations, 0)
    return () => clearTimeout(timer)
  }, [loadReservations])

  const applyView = useCallback((data: FolioView) => {
    setView(data)
    const guest = data.guest
    const reservation = data.reservation
    setG({
      id: guest?.id || "",
      fullName: guest?.fullName || reservation?.guestName || "",
      documentType: guest?.documentType || "cedula",
      documentNumber: guest?.documentNumber || "",
      phone: guest?.phone || reservation?.guestPhone || "",
      email: guest?.email || "",
      nationality: guest?.nationality || "",
      address: guest?.address || "",
    })
  }, [])

  const selectReservation = useCallback(async (reservationId: string) => {
    setSelectedId(reservationId)
    setView(null)
    if (!reservationId) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/folios?reservationId=${reservationId}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el folio")
      applyView(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }, [applyView])

  async function post(payload: Record<string, unknown>, okMsg?: string) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/folios", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...payload, reservationId: selectedId }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.balance !== undefined) {
          if (
            window.confirm(
              `${data.error}\n\n¿Cerrar de todos modos (check-out con saldo $${data.balance})?`,
            )
          ) {
            return post({ ...payload, force: true }, okMsg)
          }
          return
        }
        throw new Error(data.error || "No se pudo procesar")
      }
      applyView(data)
      if (okMsg) await loadReservations()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  function guestPayload() {
    return {
      id: g.id || undefined,
      fullName: g.fullName.trim(),
      documentType: g.documentType,
      documentNumber: g.documentNumber.trim(),
      phone: g.phone.trim(),
      email: g.email.trim(),
      nationality: g.nationality.trim(),
      address: g.address.trim(),
    }
  }

  const folio = view?.folio || null
  const items = view?.items || []
  const balance = view?.balance || 0
  const reservation = view?.reservation || null
  const chargeableOrders = view?.chargeableOrders || []
  const closed = folio?.status === "cerrado"

  const inputClass =
    "rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/local-santo"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Receipt size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Folio del huésped</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Ficha del huésped, cargos y pagos de la estadía, con check-in y check-out.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para usar el folio, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Selector de reserva */}
            <div className="mt-6 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
              <label className="text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                Estadía
              </label>
              {loading ? (
                <p className="mt-2 inline-flex items-center gap-2 font-bold">
                  <Loader2 className="animate-spin" size={18} /> Cargando…
                </p>
              ) : (
                <select
                  value={selectedId}
                  onChange={(e) => selectReservation(e.target.value)}
                  className={`${inputClass} mt-2 w-full`}
                >
                  <option value="">Elige una reserva…</option>
                  {reservations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.guestName} · {roomNameById.get(r.roomId) || "sin hab."} · {r.checkInDate}→{r.checkOutDate} ({r.status})
                    </option>
                  ))}
                </select>
              )}
              {reservations.length === 0 && !loading && (
                <p className="mt-2 text-sm font-bold text-[var(--brand-ink-2)]/55">
                  No hay estadías vigentes. Crea una reserva en “Reservas hotel”.
                </p>
              )}
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {reservation && (
              <>
                {/* Ficha del huésped */}
                <section className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                  <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                    <UserRound size={16} /> Ficha del huésped
                  </h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      value={g.fullName}
                      onChange={(e) => setG({ ...g, fullName: e.target.value })}
                      placeholder="Nombre completo"
                      className={inputClass}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={g.documentType}
                        onChange={(e) => setG({ ...g, documentType: e.target.value })}
                        className={inputClass}
                      >
                        <option value="cedula">Cédula</option>
                        <option value="pasaporte">Pasaporte</option>
                        <option value="rif">RIF</option>
                        <option value="otro">Otro</option>
                      </select>
                      <input
                        value={g.documentNumber}
                        onChange={(e) => setG({ ...g, documentNumber: e.target.value })}
                        placeholder="Documento"
                        className={`${inputClass} col-span-2`}
                      />
                    </div>
                    <input
                      value={g.phone}
                      onChange={(e) => setG({ ...g, phone: e.target.value })}
                      placeholder="Teléfono"
                      className={inputClass}
                    />
                    <input
                      value={g.nationality}
                      onChange={(e) => setG({ ...g, nationality: e.target.value })}
                      placeholder="Nacionalidad"
                      className={inputClass}
                    />
                    <input
                      value={g.email}
                      onChange={(e) => setG({ ...g, email: e.target.value })}
                      placeholder="Email (opcional)"
                      className={inputClass}
                    />
                    <input
                      value={g.address}
                      onChange={(e) => setG({ ...g, address: e.target.value })}
                      placeholder="Dirección (opcional)"
                      className={inputClass}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                    <span className="inline-flex items-center gap-1">
                      <CalendarRange size={14} /> {reservation.checkInDate} → {reservation.checkOutDate}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BedDouble size={14} /> {roomNameById.get(reservation.roomId) || "sin habitación"}
                    </span>
                  </div>

                  {!folio && (
                    <button
                      onClick={() => post({ action: "open", guest: guestPayload() }, "reload")}
                      disabled={busy || !g.fullName.trim()}
                      className="mt-3 inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
                    >
                      <Receipt size={16} /> Check-in · abrir folio
                    </button>
                  )}
                </section>

                {/* Folio */}
                {folio && (
                  <section className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                        <Receipt size={16} /> Folio {closed ? "(cerrado)" : ""}
                      </h2>
                      <span className="text-lg font-black text-[var(--brand-ink-3)]">
                        Saldo: ${balance}
                      </span>
                    </div>

                    {items.length === 0 ? (
                      <p className="mt-3 text-sm font-bold text-[var(--brand-ink-2)]/55">Sin movimientos.</p>
                    ) : (
                      <ul className="mt-3 divide-y divide-[var(--brand-primary)]/10">
                        {items.map((item) => (
                          <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                            <div className="min-w-0">
                              <p className="font-bold text-[var(--brand-ink-3)]">
                                {item.description || CATEGORY_LABELS[item.category] || item.category}
                              </p>
                              <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-ink-2)]/50">
                                {CATEGORY_LABELS[item.category] || item.category}
                                {item.method ? ` · ${item.method}` : ""}
                              </p>
                            </div>
                            <span
                              className={`font-black ${item.kind === "pago" ? "text-green-700" : "text-[var(--brand-ink-3)]"}`}
                            >
                              {item.kind === "pago" ? "-" : ""}${item.amount}
                            </span>
                            {!closed && (
                              <button
                                onClick={() => post({ action: "deleteItem", itemId: item.id })}
                                disabled={busy}
                                title="Eliminar línea"
                                className="text-red-500 disabled:opacity-50"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {!closed && (
                      <>
                        {/* Agregar cargo */}
                        <div className="mt-4 grid gap-2 sm:grid-cols-4">
                          <input
                            value={chargeDesc}
                            onChange={(e) => setChargeDesc(e.target.value)}
                            placeholder="Concepto del cargo"
                            className={`${inputClass} sm:col-span-2`}
                          />
                          <select
                            value={chargeCat}
                            onChange={(e) => setChargeCat(e.target.value)}
                            className={inputClass}
                          >
                            <option value="restaurante">Restaurante</option>
                            <option value="minibar">Minibar</option>
                            <option value="lavanderia">Lavandería</option>
                            <option value="extra">Extra</option>
                          </select>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={0}
                              value={chargeAmount}
                              onChange={(e) => setChargeAmount(e.target.value)}
                              placeholder="$"
                              className={`${inputClass} w-full`}
                            />
                            <button
                              onClick={() => {
                                post({
                                  action: "charge",
                                  folioId: folio.id,
                                  description: chargeDesc.trim(),
                                  category: chargeCat,
                                  amount: Number(chargeAmount) || 0,
                                })
                                setChargeDesc("")
                                setChargeAmount("")
                              }}
                              disabled={busy || !(Number(chargeAmount) > 0)}
                              title="Agregar cargo"
                              className="inline-flex items-center justify-center rounded-xl bg-[var(--brand-primary)] px-3 text-white disabled:opacity-50"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Registrar pago */}
                        <div className="mt-2 grid gap-2 sm:grid-cols-4">
                          <select
                            value={payMethod}
                            onChange={(e) => setPayMethod(e.target.value)}
                            className={`${inputClass} sm:col-span-3`}
                          >
                            <option>Efectivo</option>
                            <option>Tarjeta</option>
                            <option>Pago móvil</option>
                            <option>Transferencia</option>
                            <option>Divisas</option>
                          </select>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={0}
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              placeholder="$"
                              className={`${inputClass} w-full`}
                            />
                            <button
                              onClick={() => {
                                post({
                                  action: "payment",
                                  folioId: folio.id,
                                  method: payMethod,
                                  amount: Number(payAmount) || 0,
                                })
                                setPayAmount("")
                              }}
                              disabled={busy || !(Number(payAmount) > 0)}
                              title="Registrar pago"
                              className="inline-flex items-center justify-center rounded-xl bg-green-600 px-3 text-white disabled:opacity-50"
                            >
                              <CreditCard size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Cargar consumo del restaurante a la habitación */}
                        <div className="mt-5 rounded-xl border-2 border-dashed border-[var(--brand-primary)]/25 p-3">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                            <UtensilsCrossed size={15} /> Cargar consumo del restaurante
                          </p>
                          {chargeableOrders.length === 0 ? (
                            <p className="mt-2 text-sm font-bold text-[var(--brand-ink-2)]/55">
                              No hay pedidos pendientes por cargar.
                            </p>
                          ) : (
                            <ul className="mt-2 space-y-2">
                              {chargeableOrders.map((order) => (
                                <li
                                  key={order.id}
                                  className="flex items-center justify-between gap-3 rounded-lg bg-[var(--brand-cream)] px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="font-bold text-[var(--brand-ink-3)]">
                                      Pedido {order.number ? `#${order.number}` : ""}
                                      {order.customerName ? ` · ${order.customerName}` : ""}
                                    </p>
                                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-ink-2)]/50">
                                      {order.orderType}
                                      {order.tableNumber ? ` · ${order.tableNumber}` : ""} · {order.status}
                                    </p>
                                  </div>
                                  <span className="font-black text-[var(--brand-ink-3)]">${order.total}</span>
                                  <button
                                    onClick={() =>
                                      post({ action: "chargeOrder", folioId: folio.id, orderId: order.id })
                                    }
                                    disabled={busy}
                                    className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-black uppercase text-white disabled:opacity-50"
                                  >
                                    <Plus size={13} /> Cargar
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <button
                          onClick={() => post({ action: "close", folioId: folio.id }, "reload")}
                          disabled={busy}
                          className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-xl border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-4 py-3 text-sm font-black uppercase text-[var(--brand-primary)] disabled:opacity-50"
                        >
                          <LogOut size={16} /> Check-out · cerrar folio
                        </button>
                      </>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

"use client"

// Sección hotelera del panel principal, al estilo de un PMS 5★: la recepción
// abre el turno viendo llegadas y salidas de HOY con nombre y habitación,
// los indicadores del día y accesos compactos a los módulos del PMS
// (Recepción → Dinero → Resort y huésped). Autocontenida: hace sus propios
// fetch con la clave de sesión y desaparece si el negocio no es hotel.

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeDollarSign,
  BedDouble,
  BellRing,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Globe,
  Gift,
  KeyRound,
  LogIn,
  LogOut,
  MessagesSquare,
  Moon,
  ReceiptText,
  Sparkles,
  Star,
  Tags,
  UserRound,
  Users,
  Wallet,
  Wand2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { MetricCard } from "./PanelPrimitiveCards"
import { getModulePlanAccess, type LocalPlanConfigLike } from "@/lib/localPlans"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type HotelReservation = {
  id: string
  roomId: string
  guestName: string
  checkInDate: string
  checkOutDate: string
  status: string
}
type HotelRoom = {
  id: string
  name?: string
  active: boolean
  outOfService: boolean
  housekeepingStatus?: string
  status?: string
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

// Estados que ocupan habitación (misma regla que hotelReservationConflicts).
const BLOCKING_STATUSES = new Set(["pendiente", "confirmada", "checkin"])

function SectionKicker({ label }: { label: string }) {
  return (
    <p className="mt-7 text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[var(--brand-primary-dark)]">
      {label}
    </p>
  )
}

// Ficha compacta de módulo: densa y silenciosa, para que 20+ módulos no
// abrumen. El detalle de cada módulo vive dentro de su propia página.
function ModuleTile({
  href,
  icon: Icon,
  title,
  metric,
}: {
  href: string
  icon: LucideIcon
  title: string
  metric: string
}) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-[var(--brand-border)] bg-white px-3.5 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-primary)]/45 hover:shadow-md"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--brand-primary)]/25 bg-[rgba(var(--brand-primary-rgb),0.10)] text-[var(--brand-primary-dark)]">
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-[15px] font-semibold leading-tight text-[var(--brand-ink-3)]">
          {title}
        </span>
        <span className="block truncate text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--brand-ink-2)]">
          {metric}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="text-[var(--brand-primary-dark)] opacity-0 transition-opacity group-hover:opacity-100"
      >
        →
      </span>
    </a>
  )
}

const STAY_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  checkin: "En casa",
}

export default function HotelPanelSection({
  businessConfig,
  isOwnerAccess,
  canUseOperationalPanel,
}: {
  businessConfig: LocalPlanConfigLike
  isOwnerAccess: boolean
  canUseOperationalPanel: boolean
}) {
  const can = useCallback(
    (moduleKey: Parameters<typeof getModulePlanAccess>[1], ownerOnly = false) => {
      if (ownerOnly && !isOwnerAccess) return false
      if (!ownerOnly && !canUseOperationalPanel) return false
      return getModulePlanAccess(businessConfig, moduleKey).effectiveEnabled
    },
    [businessConfig, isOwnerAccess, canUseOperationalPanel]
  )

  const showRooms = can("rooms")
  const showReservations = can("hotelReservations")
  const showFolio = can("folio")
  const showHousekeeping = can("housekeeping")
  const showTapeChart = can("tapeChart")
  const showBookingEngine = can("bookingEngine")
  const showGuestPortal = can("guestPortal")
  const showRateSeasons = can("rateSeasons")
  const showAdvancedRates = can("advancedRates")
  const showOnlinePayments = can("onlinePayments")
  const showInvoicing = can("fiscalInvoicing")
  const showNightAudit = can("nightAudit")
  const showHotelReports = can("hotelReports", true)
  const showResortServices = can("resortServices")
  const showResortCharges = can("resortCharges")
  const showPackages = can("hotelPackages")
  const showReviews = can("guestReviews")
  const showCrm = can("guestCrm")
  const showMemberships = can("guestMemberships")
  const showGroups = can("groupBookings")
  const showChannels = can("channelManager")
  const showNotifications = can("guestNotifications")
  const showHotelLanding = can("hotelLanding", true)

  const receptionVisible =
    showReservations || showTapeChart || showRooms || showFolio || showHousekeeping ||
    showBookingEngine || showGuestPortal
  const moneyVisible =
    showRateSeasons || showAdvancedRates || showOnlinePayments || showInvoicing ||
    showNightAudit || showHotelReports
  const resortVisible =
    showResortServices || showResortCharges || showPackages || showReviews ||
    showCrm || showMemberships || showGroups || showChannels || showNotifications || showHotelLanding

  const [reservations, setReservations] = useState<HotelReservation[]>([])
  const [rooms, setRooms] = useState<HotelRoom[]>([])
  const [loaded, setLoaded] = useState(false)

  const canLoadBoard = showReservations || showRooms || showHousekeeping

  useEffect(() => {
    if (!canLoadBoard) return
    let cancelled = false
    const today = toISO(new Date())
    // from = ayer para que las salidas de HOY (checkout exclusivo) entren al rango.
    const load = async () => {
      try {
        if (showReservations) {
          const res = await fetch(
            `/api/hotel-reservations?from=${addDaysISO(today, -1)}&to=${addDaysISO(today, 30)}`,
            { headers: authHeaders(), cache: "no-store" }
          )
          if (res.ok) {
            const data = await res.json()
            if (!cancelled) {
              setReservations(Array.isArray(data.reservations) ? data.reservations : [])
              if (Array.isArray(data.rooms)) setRooms(data.rooms)
            }
          }
        } else if (showHousekeeping || showRooms) {
          const res = await fetch("/api/housekeeping", { headers: authHeaders(), cache: "no-store" })
          if (res.ok) {
            const data = await res.json()
            if (!cancelled && Array.isArray(data.rooms)) setRooms(data.rooms)
          }
        }
      } catch {
        // El panel no debe romperse por esto: la sección muestra los accesos sin métricas.
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [canLoadBoard, showReservations, showHousekeeping, showRooms])

  const roomNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const room of rooms) if (room.name) map.set(room.id, room.name)
    return map
  }, [rooms])

  if (!receptionVisible && !moneyVisible && !resortVisible) return null

  const today = toISO(new Date())
  const arrivals = reservations.filter(
    (r) => r.checkInDate === today && (r.status === "pendiente" || r.status === "confirmada")
  )
  const departures = reservations.filter(
    (r) => r.checkOutDate === today && r.status === "checkin"
  )
  const inHouse = reservations.filter((r) => r.status === "checkin").length
  const serviceRooms = rooms.filter((room) => room.active && !room.outOfService)
  const occupiedToday = new Set(
    reservations
      .filter(
        (r) =>
          BLOCKING_STATUSES.has(r.status) && r.checkInDate <= today && today < r.checkOutDate
      )
      .map((r) => r.roomId)
  )
  const occupancyPct =
    serviceRooms.length > 0
      ? Math.round(
          (serviceRooms.filter((room) => occupiedToday.has(room.id)).length /
            serviceRooms.length) *
            100
        )
      : 0
  const dirtyRooms = rooms.filter(
    (room) => (room.housekeepingStatus || room.status) === "sucia"
  ).length
  const metric = (value: string) => (loaded ? value : "…")

  const stayLine = (stay: HotelReservation, kind: "in" | "out") => (
    <li key={stay.id} className="flex items-center gap-2.5 py-2">
      {kind === "in" ? (
        <LogIn size={15} className="shrink-0 text-green-700" />
      ) : (
        <LogOut size={15} className="shrink-0 text-[var(--brand-primary-dark)]" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--brand-ink-3)]">
        {stay.guestName}
      </span>
      <span className="shrink-0 rounded-full border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--brand-ink-2)]">
        Hab {roomNameById.get(stay.roomId) || "—"}
      </span>
      <span className="hidden shrink-0 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--brand-ink-2)] sm:inline">
        {STAY_STATUS_LABELS[stay.status] || stay.status}
      </span>
    </li>
  )

  return (
    <section className="mt-5 rounded-2xl border border-[var(--brand-border)] bg-white/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2.5 font-serif text-2xl font-semibold text-[var(--brand-ink-3)]">
          <Building2 size={21} className="text-[var(--brand-primary-dark)]" />
          El hotel hoy
        </h2>
        {showTapeChart && (
          <a
            href="/local-santo/calendario"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/35 bg-white px-4 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--brand-primary-dark)] transition hover:border-[var(--brand-primary)]"
          >
            <CalendarDays size={14} /> Calendario
          </a>
        )}
      </div>

      {canLoadBoard && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <MetricCard label="Llegadas hoy" value={metric(String(arrivals.length))} tone={arrivals.length > 0 ? "yellow" : "red"} />
            <MetricCard label="Salidas hoy" value={metric(String(departures.length))} tone={departures.length > 0 ? "yellow" : "red"} />
            <MetricCard label="En casa" value={metric(String(inHouse))} />
            <MetricCard label="Ocupación" value={metric(`${occupancyPct}%`)} />
            <MetricCard label="Por limpiar" value={metric(String(dirtyRooms))} tone={dirtyRooms > 0 ? "yellow" : "red"} />
          </div>

          {/* Turno de recepción: quién llega y quién sale HOY, con nombre. */}
          {(arrivals.length > 0 || departures.length > 0) && (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--brand-border)] bg-white p-4 shadow-sm">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--brand-primary-dark)]">
                  Llegadas de hoy
                </p>
                {arrivals.length === 0 ? (
                  <p className="mt-2 text-sm font-medium text-[var(--brand-ink-2)]">
                    Sin llegadas pendientes.
                  </p>
                ) : (
                  <ul className="mt-1 divide-y divide-black/5">
                    {arrivals.slice(0, 6).map((stay) => stayLine(stay, "in"))}
                  </ul>
                )}
                {showReservations && arrivals.length > 0 && (
                  <a
                    href="/local-santo/reservas-hotel"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary-dark)] hover:text-[var(--brand-ink-3)]"
                  >
                    Hacer check-in →
                  </a>
                )}
              </div>
              <div className="rounded-xl border border-[var(--brand-border)] bg-white p-4 shadow-sm">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--brand-primary-dark)]">
                  Salidas de hoy
                </p>
                {departures.length === 0 ? (
                  <p className="mt-2 text-sm font-medium text-[var(--brand-ink-2)]">
                    Sin salidas programadas.
                  </p>
                ) : (
                  <ul className="mt-1 divide-y divide-black/5">
                    {departures.slice(0, 6).map((stay) => stayLine(stay, "out"))}
                  </ul>
                )}
                {showFolio && departures.length > 0 && (
                  <a
                    href="/local-santo/folio"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary-dark)] hover:text-[var(--brand-ink-3)]"
                  >
                    Cobrar y hacer check-out →
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {receptionVisible && (
        <>
          <SectionKicker label="Recepción" />
          <div className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {showReservations && (
              <ModuleTile href="/local-santo/reservas-hotel" icon={CalendarRange} title="Reservas" metric={metric(`${arrivals.length} llegan hoy`)} />
            )}
            {showTapeChart && (
              <ModuleTile href="/local-santo/calendario" icon={CalendarDays} title="Calendario" metric={metric(`${occupancyPct}% hoy`)} />
            )}
            {showRooms && (
              <ModuleTile href="/local-santo/habitaciones" icon={BedDouble} title="Habitaciones" metric={metric(`${Math.max(serviceRooms.length - occupiedToday.size, 0)} libres`)} />
            )}
            {showFolio && (
              <ModuleTile href="/local-santo/folio" icon={KeyRound} title="Folio del huésped" metric={metric(`${inHouse} en casa`)} />
            )}
            {showHousekeeping && (
              <ModuleTile href="/local-santo/housekeeping" icon={Sparkles} title="Limpieza" metric={metric(`${dirtyRooms} por limpiar`)} />
            )}
            {showBookingEngine && (
              <ModuleTile href="/local-santo/reservas-online" icon={Globe} title="Reservas online" metric="Página pública" />
            )}
            {showGuestPortal && (
              <ModuleTile href="/local-santo/portal-huesped" icon={UserRound} title="Portal del huésped" metric="Consultas y reseñas" />
            )}
            {showGroups && (
              <ModuleTile href="/local-santo/grupos" icon={Users} title="Grupos y bloqueos" metric="Apartar habitaciones" />
            )}
          </div>
        </>
      )}

      {moneyVisible && (
        <>
          <SectionKicker label="Dinero del hotel" />
          <div className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {showRateSeasons && (
              <ModuleTile href="/local-santo/tarifas" icon={Tags} title="Tarifas" metric="Temporadas" />
            )}
            {showAdvancedRates && (
              <ModuleTile href="/local-santo/planes-tarifa" icon={Wand2} title="Planes de tarifa" metric="Reglas de venta" />
            )}
            {showOnlinePayments && (
              <ModuleTile href="/local-santo/pagos-online" icon={Wallet} title="Pagos y depósitos" metric="Confirmar reportados" />
            )}
            {showInvoicing && (
              <ModuleTile href="/local-santo/facturacion" icon={ReceiptText} title="Facturación" metric="Correlativo + IVA" />
            )}
            {showNightAudit && (
              <ModuleTile href="/local-santo/cierre-dia" icon={Moon} title="Cierre de día" metric="Night audit" />
            )}
            {showHotelReports && (
              <ModuleTile href="/local-santo/reportes-hotel" icon={BadgeDollarSign} title="Reportes del hotel" metric="Ocupación · ADR · RevPAR" />
            )}
          </div>
        </>
      )}

      {resortVisible && (
        <>
          <SectionKicker label="Resort y huésped" />
          <div className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {showResortServices && (
              <ModuleTile href="/local-santo/servicios" icon={Sparkles} title="Servicios" metric="Spa, tours, eventos" />
            )}
            {showResortCharges && (
              <ModuleTile href="/local-santo/cargos-resort" icon={ClipboardList} title="Cargos a la habitación" metric="Bar · spa · tienda" />
            )}
            {showPackages && (
              <ModuleTile href="/local-santo/paquetes" icon={Gift} title="Paquetes" metric="Combos de estadía" />
            )}
            {showReviews && (
              <ModuleTile href="/local-santo/resenas" icon={Star} title="Reseñas" metric="Moderar opiniones" />
            )}
            {showCrm && (
              <ModuleTile href="/local-santo/crm" icon={Users} title="CRM de huéspedes" metric="Fichas y VIP" />
            )}
            {showMemberships && (
              <ModuleTile href="/local-santo/membresias" icon={Star} title="Membresías" metric="Fidelización · pases" />
            )}
            {showChannels && (
              <ModuleTile href="/local-santo/canales" icon={Globe} title="Canales y OTAs" metric="Feed iCal" />
            )}
            {showNotifications && (
              <ModuleTile href="/local-santo/notificaciones" icon={MessagesSquare} title="Notificaciones" metric="Avisos WhatsApp" />
            )}
            {showHotelLanding && (
              <ModuleTile href="/local-santo/pagina-hotel" icon={BellRing} title="Página del hotel" metric="Editar la pública" />
            )}
          </div>
        </>
      )}
    </section>
  )
}

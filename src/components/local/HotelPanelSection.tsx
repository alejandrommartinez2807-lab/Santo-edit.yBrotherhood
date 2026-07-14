"use client"

// Sección hotelera del panel principal: recepción de un vistazo (llegadas,
// salidas, en casa, ocupación, limpieza) + accesos a los módulos del PMS
// agrupados como en un hotel (Recepción → Dinero → Resort y huésped).
// Autocontenida: hace sus propios fetch con la clave de sesión del staff y
// desaparece sola si el negocio no tiene módulos hoteleros activos.

import { useCallback, useEffect, useState } from "react"
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
import { ModuleAccessCard, MetricCard } from "./PanelPrimitiveCards"
import { getModulePlanAccess, type LocalPlanConfigLike } from "@/lib/localPlans"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type HotelReservation = {
  roomId: string
  checkInDate: string
  checkOutDate: string
  status: string
}
type HotelRoom = {
  id: string
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
    <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-[var(--brand-primary)]">
      {label}
    </p>
  )
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
    showCrm || showGroups || showChannels || showNotifications || showHotelLanding

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

  if (!receptionVisible && !moneyVisible && !resortVisible) return null

  const today = toISO(new Date())
  const arrivalsToday = reservations.filter(
    (r) => r.checkInDate === today && (r.status === "pendiente" || r.status === "confirmada")
  ).length
  const departuresToday = reservations.filter(
    (r) => r.checkOutDate === today && r.status === "checkin"
  ).length
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

  return (
    <section className="mt-4 rounded-[1.6rem] border-2 border-[var(--brand-primary)]/30 bg-[var(--brand-surface-2)]/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
          <Building2 size={18} />
          Hotel · hoy
        </p>
        {showTapeChart && (
          <a
            href="/local-santo/calendario"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
          >
            <CalendarDays size={14} /> Ver calendario
          </a>
        )}
      </div>

      {canLoadBoard && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <MetricCard label="Llegadas hoy" value={metric(String(arrivalsToday))} tone={arrivalsToday > 0 ? "yellow" : "red"} />
          <MetricCard label="Salidas hoy" value={metric(String(departuresToday))} tone={departuresToday > 0 ? "yellow" : "red"} />
          <MetricCard label="En casa" value={metric(String(inHouse))} />
          <MetricCard label="Ocupación" value={metric(`${occupancyPct}%`)} />
          <MetricCard label="Por limpiar" value={metric(String(dirtyRooms))} tone={dirtyRooms > 0 ? "yellow" : "red"} />
        </div>
      )}

      {receptionVisible && (
        <>
          <SectionKicker label="Recepción" />
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {showReservations && (
              <ModuleAccessCard
                href="/local-santo/reservas-hotel"
                icon={<CalendarRange size={24} />}
                eyebrow="Recepción"
                title="Reservas"
                description="Crea estadías por noches, confirma llegadas y haz check-in y check-out."
                metric={metric(`${arrivalsToday} llegan hoy`)}
              />
            )}
            {showTapeChart && (
              <ModuleAccessCard
                href="/local-santo/calendario"
                icon={<CalendarDays size={24} />}
                eyebrow="Recepción"
                title="Calendario"
                description="Mapa de habitaciones por día: libres, ocupadas, bloqueadas y fuera de servicio."
                metric={metric(`${occupancyPct}% hoy`)}
              />
            )}
            {showRooms && (
              <ModuleAccessCard
                href="/local-santo/habitaciones"
                icon={<BedDouble size={24} />}
                eyebrow="Recepción"
                title="Habitaciones"
                description="Tipos, tarifas base y estado de cada habitación del hotel."
                metric={metric(`${Math.max(serviceRooms.length - occupiedToday.size, 0)} libres`)}
              />
            )}
            {showFolio && (
              <ModuleAccessCard
                href="/local-santo/folio"
                icon={<KeyRound size={24} />}
                eyebrow="Recepción"
                title="Folio del huésped"
                description="Ficha del huésped, cargos, pagos y check-out con saldo en cero."
                metric={metric(`${inHouse} en casa`)}
              />
            )}
            {showHousekeeping && (
              <ModuleAccessCard
                href="/local-santo/housekeeping"
                icon={<Sparkles size={24} />}
                eyebrow="Recepción"
                title="Limpieza"
                description="Tablero de housekeeping: habitaciones sucias, tareas y asignaciones."
                metric={metric(`${dirtyRooms} por limpiar`)}
              />
            )}
            {showBookingEngine && (
              <ModuleAccessCard
                href="/local-santo/reservas-online"
                icon={<Globe size={24} />}
                eyebrow="Recepción"
                title="Reservas online"
                description="Reservas que entran solas desde la página pública del hotel."
                metric="Web"
              />
            )}
            {showGuestPortal && (
              <ModuleAccessCard
                href="/local-santo/portal-huesped"
                icon={<UserRound size={24} />}
                eyebrow="Recepción"
                title="Portal del huésped"
                description="Consulta de reservas por código y reseñas que dejan los huéspedes."
                metric="Portal"
              />
            )}
          </div>
        </>
      )}

      {moneyVisible && (
        <>
          <SectionKicker label="Dinero del hotel" />
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {showRateSeasons && (
              <ModuleAccessCard
                href="/local-santo/tarifas"
                icon={<Tags size={24} />}
                eyebrow="Dinero"
                title="Tarifas"
                description="Temporadas altas y bajas: precios por fecha que aplican solos al reservar."
                metric="Temporadas"
              />
            )}
            {showAdvancedRates && (
              <ModuleAccessCard
                href="/local-santo/planes-tarifa"
                icon={<Wand2 size={24} />}
                eyebrow="Dinero"
                title="Planes de tarifa"
                description="Restricciones de venta: estadía mínima y fechas cerradas a llegada o salida."
                metric="Reglas"
              />
            )}
            {showOnlinePayments && (
              <ModuleAccessCard
                href="/local-santo/pagos-online"
                icon={<Wallet size={24} />}
                eyebrow="Dinero"
                title="Pagos y depósitos"
                description="Depósitos reportados por huéspedes: confírmalos o recházalos con respaldo."
                metric="Depósitos"
              />
            )}
            {showInvoicing && (
              <ModuleAccessCard
                href="/local-santo/facturacion"
                icon={<ReceiptText size={24} />}
                eyebrow="Dinero"
                title="Facturación"
                description="Facturas con número correlativo e IVA a partir del folio del huésped."
                metric="Facturas"
              />
            )}
            {showNightAudit && (
              <ModuleAccessCard
                href="/local-santo/cierre-dia"
                icon={<Moon size={24} />}
                eyebrow="Dinero"
                title="Cierre de día"
                description="Night audit: cierra el día hotelero y deja el corte registrado."
                metric="Auditoría"
              />
            )}
            {showHotelReports && (
              <ModuleAccessCard
                href="/local-santo/reportes-hotel"
                icon={<BadgeDollarSign size={24} />}
                eyebrow="Dinero"
                title="Reportes del hotel"
                description="Ocupación, tarifa promedio (ADR) y RevPAR por período."
                metric="ADR · RevPAR"
              />
            )}
          </div>
        </>
      )}

      {resortVisible && (
        <>
          <SectionKicker label="Resort y huésped" />
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {showResortServices && (
              <ModuleAccessCard
                href="/local-santo/servicios"
                icon={<Sparkles size={24} />}
                eyebrow="Resort"
                title="Servicios"
                description="Spa, tours, clases y experiencias con cupo por franja horaria."
                metric="Catálogo"
              />
            )}
            {showResortCharges && (
              <ModuleAccessCard
                href="/local-santo/cargos-resort"
                icon={<ClipboardList size={24} />}
                eyebrow="Resort"
                title="Cargos a la habitación"
                description="Carga consumos de bar, spa o tienda directo al folio del huésped."
                metric="A folio"
              />
            )}
            {showPackages && (
              <ModuleAccessCard
                href="/local-santo/paquetes"
                icon={<Gift size={24} />}
                eyebrow="Resort"
                title="Paquetes"
                description="Combos de estadía + servicios que se aplican a la reserva en un clic."
                metric="Combos"
              />
            )}
            {showReviews && (
              <ModuleAccessCard
                href="/local-santo/resenas"
                icon={<Star size={24} />}
                eyebrow="Huésped"
                title="Reseñas"
                description="Modera opiniones de huéspedes y decide cuáles se publican en la página."
                metric="Opiniones"
              />
            )}
            {showCrm && (
              <ModuleAccessCard
                href="/local-santo/crm"
                icon={<Users size={24} />}
                eyebrow="Huésped"
                title="CRM de huéspedes"
                description="Fichas con historial, etiquetas, VIP y notas para atender mejor."
                metric="Fichas"
              />
            )}
            {showGroups && (
              <ModuleAccessCard
                href="/local-santo/grupos"
                icon={<Users size={24} />}
                eyebrow="Recepción"
                title="Grupos y bloqueos"
                description="Aparta habitaciones por rango para mantenimiento, eventos o grupos."
                metric="Bloqueos"
              />
            )}
            {showChannels && (
              <ModuleAccessCard
                href="/local-santo/canales"
                icon={<Globe size={24} />}
                eyebrow="Canales"
                title="Canales y OTAs"
                description="Feed iCal con las fechas ocupadas para sincronizar calendarios externos."
                metric="iCal"
              />
            )}
            {showNotifications && (
              <ModuleAccessCard
                href="/local-santo/notificaciones"
                icon={<MessagesSquare size={24} />}
                eyebrow="Huésped"
                title="Notificaciones"
                description="Avisos de reserva y llegada listos para enviar por WhatsApp."
                metric="WhatsApp"
              />
            )}
            {showHotelLanding && (
              <ModuleAccessCard
                href="/local-santo/pagina-hotel"
                icon={<BellRing size={24} />}
                eyebrow="Página pública"
                title="Página del hotel"
                description="Edita el texto, amenidades y datos de contacto de la página pública."
                metric="Landing"
              />
            )}
          </div>
        </>
      )}
    </section>
  )
}

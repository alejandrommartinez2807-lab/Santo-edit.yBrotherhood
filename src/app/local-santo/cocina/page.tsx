"use client"

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { BRAND } from "@/lib/brand"
import { signOutLocalStaff } from "@/lib/staffSession"
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CookingPot,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react"
import {
  buildStaffConfirmationText,
  getOrderItemDetailLines,
  hasConfirmedStaffConfirmationItems,
  hasStaffConfirmationItems,
  isStaffConfirmationItemConfirmed,
  isStaffConfirmationItemRequired,
} from "@/lib/localOrderHelpers"
import ModuleAccessGuard, { useHotelMode } from "@/components/ModuleAccessGuard"
import {
  useOperationalSounds,
  useOrderSoundAlerts,
} from "@/hooks/useOperationalSounds"

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"

type ProductPaymentMode = "divisa" | "mixto"
type OrderStatus = "Nuevo" | "Preparando" | "Listo" | "Entregado" | "Cancelado"
type PaymentStatus = "Pendiente" | "Pago parcial" | "Pagado"
type OrderType = "Comer aquí" | "Para llevar" | "Delivery"
type DeliveryPaymentIn = "Divisas" | "Bolívares" | "Mixto" | "Sin registrar"
type KitchenFilter = "En cocina" | "Listos" | "Completos" | "Todos"

type CartItem = {
  id: number
  name: string
  category: string
  price: number
  basePrice?: number
  unitOptionsPrice?: number
  image: string
  quantity: number
  note?: string
  noteEnabled?: boolean
  paymentMode?: ProductPaymentMode
  productType?: string
  selectedVariation?: unknown
  selectedAddons?: unknown[]
  removedIngredients?: unknown[]
  selectionSummary?: string
  requiresWaiterConfirmation?: boolean
  staffConfirmationStatus?: string
  staffConfirmedAt?: string
  staffConfirmedBy?: string
  staffConfirmedRole?: string
}

type OrderPayment = {
  status: PaymentStatus
  amountReceivedUSD: number
  amountReceivedVES: number
  paymentMethodUSD: string
  paymentMethodVES: string
  deliveryPaymentIn: DeliveryPaymentIn
  paymentNote: string
  totalOrderUSD: number
  receivedEquivalentUSD: number
  pendingUSD: number
  updatedAt?: string
}

type LocalOrder = {
  rowNumber?: number
  branchNumber?: number
  branchCode?: string
  id: string
  createdAt: string
  customerName: string
  customerPhone?: string
  tableNumber: string
  orderType: OrderType
  customerNote: string
  deliveryAddress?: string
  deliveryReference?: string
  deliveryZone?: string
  paymentMethod?: string
  deliveryCostUSD?: number
  totalBeforeDeliveryUSD?: number
  items: CartItem[]
  itemsText: string
  totalPrice: number
  totalVES: number
  totalUSD?: number
  totalCombosUSD?: number
  totalRegularUSD?: number
  totalRegularVES?: number
  exchangeRate: number
  exchangeSource?: string
  exchangeValueDate?: string
  status: OrderStatus
  payment?: OrderPayment
  paymentStatus?: PaymentStatus
  amountReceivedUSD?: number
  amountReceivedVES?: number
  paymentMethodUSD?: string
  paymentMethodVES?: string
  deliveryPaymentIn?: DeliveryPaymentIn
  paymentNote?: string
  paymentTotalOrderUSD?: number
  paymentReceivedEquivalentUSD?: number
  paymentPendingUSD?: number
  paymentUpdatedAt?: string
}

function isComboItem(item: CartItem) {
  return item.paymentMode === "divisa"
}

function isDeliveryOrder(order: LocalOrder) {
  return (
    order.orderType === "Delivery" ||
    order.tableNumber?.toLowerCase().startsWith("delivery") ||
    Boolean(
      order.customerPhone ||
        order.deliveryAddress ||
        order.deliveryReference ||
        order.deliveryZone
    )
  )
}

function getDisplayOrderNumber(order: LocalOrder) {
  if (order.branchNumber && order.branchNumber > 0) {
    return `#${String(order.branchNumber).padStart(2, "0")}${
      order.branchCode ? `-${order.branchCode}` : ""
    }`
  }

  if (order.rowNumber && order.rowNumber > 1) {
    return `#${String(order.rowNumber - 1).padStart(2, "0")}`
  }

  const parts = order.id.split("-")
  const lastPart = parts[parts.length - 1] || order.id

  return `#${lastPart.slice(-3)}`
}

function cleanDeliveryLocation(value: string) {
  return value.replace(/^delivery\s*-\s*/i, "").trim()
}

function getDisplayTableNumber(order: LocalOrder) {
  if (isDeliveryOrder(order)) {
    const cleanZone = String(order.deliveryZone || "").trim()
    const cleanTableNumber = cleanDeliveryLocation(String(order.tableNumber || ""))

    return cleanZone || cleanTableNumber || "Delivery"
  }

  return order.tableNumber || "Sin ubicación"
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(new Date(value))
  } catch {
    return value
  }
}


function getElapsedMinutes(value: string) {
  const createdAt = new Date(value).getTime()

  if (!Number.isFinite(createdAt)) return 0

  const minutes = Math.floor((Date.now() - createdAt) / 60000)

  return minutes > 0 ? minutes : 0
}

function formatElapsedMinutes(minutes: number) {
  if (minutes < 1) return "Menos de 1 min"
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (!remainingMinutes) return `${hours} h`

  return `${hours} h ${remainingMinutes} min`
}

function getElapsedToneClasses(minutes: number) {
  if (minutes >= 25) return "border-red-500 bg-red-100 text-red-800"
  if (minutes >= 15) return "border-orange-400 bg-orange-100 text-orange-800"
  if (minutes >= 8) return "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"

  return "border-green-500 bg-green-50 text-green-800"
}

function getElapsedPriorityLabel(minutes: number) {
  if (minutes >= 25) return "Urgente"
  if (minutes >= 15) return "Atención"
  if (minutes >= 8) return "En tiempo"

  return "Reciente"
}

function getStatusStyle(status: OrderStatus) {
  if (status === "Preparando") return "bg-orange-400 text-[var(--brand-ink-2)]"
  if (status === "Listo") return "bg-[var(--brand-accent)] text-[var(--brand-ink-2)]"
  if (status === "Entregado") return "bg-green-500 text-white"
  if (status === "Cancelado") return "bg-[var(--brand-ink-3)] text-white"

  return "bg-red-500 text-white"
}

function getStatusIcon(status: OrderStatus) {
  if (status === "Preparando") return <CookingPot size={16} />
  if (status === "Listo") return <PackageCheck size={16} />
  if (status === "Entregado") return <CheckCircle2 size={16} />
  if (status === "Cancelado") return <XCircle size={16} />

  return <Clock size={16} />
}

function shouldShowInKitchen(order: LocalOrder) {
  return (
    order.status === "Preparando" ||
    order.status === "Listo" ||
    order.status === "Entregado"
  )
}

function shouldShowAsPreparing(order: LocalOrder) {
  return order.status === "Preparando"
}

function shouldShowAsReady(order: LocalOrder) {
  return order.status === "Listo"
}

function shouldShowAsCompleted(order: LocalOrder) {
  return order.status === "Entregado"
}

function normalizeComparableText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function matchesSearch(order: LocalOrder, query: string) {
  const cleanQuery = normalizeComparableText(query)

  if (!cleanQuery) return true

  const productsText = order.items
    .map((item) => [item.name, ...getOrderItemDetailLines(item)].join(" "))
    .join(" ")

  const searchableText = normalizeComparableText(
    [
      order.id,
      getDisplayOrderNumber(order),
      order.customerName,
      order.customerPhone,
      order.tableNumber,
      order.deliveryZone,
      order.deliveryAddress,
      order.deliveryReference,
      order.status,
      productsText,
    ]
      .filter(Boolean)
      .join(" ")
  )

  return searchableText.includes(cleanQuery)
}

function readApiResponse(response: Response) {
  return response.text().then((text) => {
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(
        "El servidor respondió con una página HTML en vez de datos. Revisa que la API de pedidos y Supabase estén funcionando correctamente."
      )
    }
  })
}

function ProductGroup({
  title,
  items,
}: {
  title: string
  items: CartItem[]
}) {
  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {title}
      </p>

      <div className="mt-2 space-y-2">
        {items.map((item, index) => {
          const requiresStaffConfirmation = isStaffConfirmationItemRequired(item)
          const staffConfirmationConfirmed = isStaffConfirmationItemConfirmed(item)

          return (
            <div
              key={`${item.id}-${item.name}-${index}`}
              className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink-3)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p>
                  {item.name}
                </p>

                <p className="shrink-0 rounded-full bg-[var(--brand-accent)] px-3 py-1 text-xs font-black uppercase tracking-[0.10em] text-[var(--brand-ink)]">
                  Cantidad: {item.quantity}
                </p>
              </div>

              {requiresStaffConfirmation ? (
                <p
                  className={`mt-2 inline-flex rounded-full px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.10em] ${
                    staffConfirmationConfirmed
                      ? "bg-green-100 text-green-700"
                      : "bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                  }`}
                >
                  {staffConfirmationConfirmed ? "Confirmado" : "Pendiente por revisar"}
                </p>
              ) : null}

              {getOrderItemDetailLines(item).map((line) => (
                <p key={line} className="mt-1 rounded-lg bg-[var(--brand-cream)] px-2 py-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/75">
                  {line}
                </p>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-3">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-[var(--brand-ink-3)]">
        {value || "—"}
      </p>
    </div>
  )
}

// Debajo del guard el subtítulo sabe si el negocio opera como hotel y habla
// de room service en vez de pedidos del local.
function CocinaSubtitle() {
  const hotelMode = useHotelMode()
  return (
    <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
      {hotelMode
        ? "Aquí aparecen los consumos y pedidos de room service cuando caja los confirma. Cocina puede revisar preparación, listos y completos sin cerrar ventas."
        : "Aquí aparecen los pedidos cuando caja los confirma y los envía a cocina. Cocina puede revisar preparación, listos y completos sin cerrar ventas."}
    </p>
  )
}

export default function CocinaPage() {
  const [adminPassword, setAdminPassword] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [orders, setOrders] = useState<LocalOrder[]>([])
  const [activeFilter, setActiveFilter] = useState<KitchenFilter>("En cocina")
  const [searchText, setSearchText] = useState("")
  const [areFiltersVisible, setAreFiltersVisible] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const pendingStatusRef = useRef<Map<string, OrderStatus>>(new Map())
  const isLoggedIn = adminPassword.length > 0
  const soundControls = useOperationalSounds({ adminPassword })

  useOrderSoundAlerts(orders, {
    module: "kitchen",
    enabled: isLoggedIn && soundControls.isSoundEnabled,
    playSound: soundControls.playSound,
  })

  async function loadOrders(password = adminPassword, silent = false) {
    if (!password) return

    if (!silent) setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch("/api/orders", {
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar los pedidos")
      }

      let nextOrders: LocalOrder[] = Array.isArray(data.orders) ? data.orders : []

      nextOrders = nextOrders
        .filter(shouldShowInKitchen)
        .map((order) => {
          const pendingStatus = pendingStatusRef.current.get(order.id)

          if (!pendingStatus) return order

          return {
            ...order,
            status: pendingStatus,
          }
        })

      setOrders(nextOrders)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los pedidos"
      )
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  function handleLogin() {
    const password = passwordInput.trim()

    if (!password) return

    window.sessionStorage.setItem(ADMIN_STORAGE_KEY, password)
    setAdminPassword(password)
    loadOrders(password)
  }

  function handleLogout() {
    // Cierra la sesión de verdad (incluye Supabase) y va al login para poder
    // entrar como otro usuario. Ver signOutLocalStaff.
    window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
    setAdminPassword("")
    setPasswordInput("")
    void signOutLocalStaff()
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    if (!adminPassword) return

    const previousOrder = orders.find((order) => order.id === orderId)

    setErrorMessage(null)
    pendingStatusRef.current.set(orderId, status)

    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status,
            }
          : order
      )
    )

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          status,
        }),
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo actualizar el pedido")
      }

      window.setTimeout(() => {
        if (pendingStatusRef.current.get(orderId) === status) {
          pendingStatusRef.current.delete(orderId)
        }

        loadOrders(adminPassword, true)
      }, 600)
    } catch (error) {
      pendingStatusRef.current.delete(orderId)

      if (previousOrder) {
        setOrders((currentOrders) =>
          currentOrders.map((order) =>
            order.id === orderId ? previousOrder : order
          )
        )
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el pedido"
      )
    }
  }

  const restoreSession = useEffectEvent(() => {
    const savedPassword = window.sessionStorage.getItem(ADMIN_STORAGE_KEY)

    if (savedPassword) {
      setAdminPassword(savedPassword)
      setPasswordInput(savedPassword)
      loadOrders(savedPassword)
    }
  })

  useEffect(() => {
    // Difiere la restauración de sesión un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(restoreSession, 0)
    return () => clearTimeout(timer)
  }, [])

  const refreshOrdersTick = useEffectEvent(() => {
    loadOrders(adminPassword, true)
  })

  useEffect(() => {
    if (!adminPassword) return

    const interval = window.setInterval(refreshOrdersTick, 2500)

    return () => {
      window.clearInterval(interval)
    }
  }, [adminPassword])

  const preparingOrders = orders.filter(shouldShowAsPreparing)
  const readyOrders = orders.filter(shouldShowAsReady)
  const completedOrders = orders.filter(shouldShowAsCompleted)
  const deliveryOrders = orders.filter(isDeliveryOrder)

  const filteredOrders = useMemo(() => {
    let nextOrders = orders

    if (activeFilter === "En cocina") {
      nextOrders = nextOrders.filter(shouldShowAsPreparing)
    } else if (activeFilter === "Listos") {
      nextOrders = nextOrders.filter(shouldShowAsReady)
    } else if (activeFilter === "Completos") {
      nextOrders = nextOrders.filter(shouldShowAsCompleted)
    }

    return nextOrders.filter((order) => matchesSearch(order, searchText))
  }, [activeFilter, orders, searchText])

  const visibleDeliveryCount = filteredOrders.filter(isDeliveryOrder).length

  if (!isLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)]">
        <div className="w-full max-w-md overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]">
          <div className="h-6 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="px-6 py-6">
            <a
              href="/local-santo"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
            >
              <ArrowLeft size={16} />
              Panel
            </a>

            <Image
              src={BRAND.logoUrl || "/logoremovebg.png"}
              alt={BRAND.name}
              width={112}
              height={112}
              unoptimized
              className="mx-auto mt-6 h-28 w-28 object-contain"
            />

            <p className="mt-5 text-center text-xs font-black uppercase tracking-[0.28em] text-[var(--brand-primary)]">
              Acceso cocina
            </p>

            <h1 className="mt-2 text-center text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
              Cocina
            </h1>

            <p className="mt-3 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
              Solo muestra pedidos que caja ya envió a preparación.
            </p>
          </div>

          <div className="space-y-4 px-6 pb-6">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Clave de acceso
              </label>

              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleLogin()
                  }}
                  placeholder="Ingresa la clave autorizada"
                  className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 pr-12 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-ink)]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border-2 border-red-500/30 bg-red-50 px-4 py-3">
                <p className="text-sm font-bold leading-6 text-red-800">
                  {errorMessage}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:scale-[1.02]"
            >
              <LogIn size={21} />
              Entrar
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <ModuleAccessGuard moduleKey="kitchen" moduleName="Cocina">
      <main className="min-h-screen bg-[var(--brand-cream)] px-3 py-4 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="overflow-hidden rounded-[1.6rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)]">
            <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="/local-santo"
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                    >
                      <ArrowLeft size={16} />
                      Panel
                    </a>

                    <button
                      type="button"
                      onClick={() => loadOrders()}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                    >
                      {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      Actualizar
                    </button>

                    <button
                      type="button"
                      onClick={
                        soundControls.isSoundEnabled
                          ? soundControls.deactivateSound
                          : soundControls.activateSound
                      }
                      disabled={!soundControls.businessAllowsSound}
                      className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        soundControls.isSoundEnabled
                          ? "border-green-700 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                      }`}
                    >
                      {soundControls.isSoundEnabled ? (
                        <Volume2 size={16} />
                      ) : (
                        <VolumeX size={16} />
                      )}
                      {soundControls.isSoundEnabled
                        ? "Avisos permitidos"
                        : soundControls.businessAllowsSound
                          ? "Permitir avisos en este equipo"
                          : "Sonidos desactivados por configuración"}
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                    >
                      Cambiar de usuario
                    </button>
                  </div>

                  <p className="mt-5 text-xs font-black uppercase tracking-[0.32em] text-[var(--brand-primary)]">
                    {BRAND.name}
                  </p>

                  <h1 className="mt-1 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                    Módulo cocina
                  </h1>

                  <CocinaSubtitle />
                </div>

                <div className="grid gap-3 sm:grid-cols-4 lg:w-[680px]">
                  <InfoBox label="En cocina" value={String(preparingOrders.length)} />
                  <InfoBox label="Listos" value={String(readyOrders.length)} />
                  <InfoBox label="Completos" value={String(completedOrders.length)} />
                  <InfoBox label="Delivery" value={String(deliveryOrders.length)} />
                </div>
              </div>
            </div>
          </header>

          <section className="sticky top-0 z-30 mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-3 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Controles de cocina
                </p>

                <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                  {filteredOrders.length} pedido(s) en pantalla · {activeFilter}
                </p>

                {!areFiltersVisible && (
                  <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]/70">
                    Filtros ocultos · {activeFilter}
                    {searchText.trim() ? ` · ${searchText.trim()}` : ""}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => loadOrders()}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                >
                  {isLoading ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <RefreshCw size={17} />
                  )}
                  Actualizar
                </button>

                <button
                  type="button"
                  onClick={() => setAreFiltersVisible((value) => !value)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                >
                  {areFiltersVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                  {areFiltersVisible ? "Ocultar filtros" : "Mostrar filtros"}
                </button>
              </div>
            </div>

            {areFiltersVisible && (
              <>
                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]"
                    />

                    <input
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      placeholder="Buscar por pedido, mesa, zona, cliente o producto"
                      className="w-full rounded-full border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-11 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {(["En cocina", "Listos", "Completos", "Todos"] as KitchenFilter[]).map(
                      (filter) => {
                        const isActive = activeFilter === filter

                        return (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setActiveFilter(filter)}
                            className={`shrink-0 rounded-full border-2 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] transition ${
                              isActive
                                ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                                : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                            }`}
                          >
                            {filter}
                          </button>
                        )
                      }
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <InfoBox label="En pantalla" value={String(filteredOrders.length)} />
                  <InfoBox label="Filtro" value={activeFilter} />
                  <InfoBox label="Completos" value={String(completedOrders.length)} />
                  <InfoBox label="Delivery visible" value={String(visibleDeliveryCount)} />
                </div>
              </>
            )}

            {errorMessage && (
              <div className="mt-3 rounded-2xl border-2 border-red-500/35 bg-red-100 px-4 py-3">
                <p className="text-sm font-bold leading-6 text-red-800">
                  {errorMessage}
                </p>
              </div>
            )}
          </section>

          {filteredOrders.length === 0 ? (
            <section className="mt-5 rounded-[2rem] border-2 border-[var(--brand-primary)] bg-white px-6 py-14 text-center shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]">
              <Image
                src={BRAND.logoUrl || "/logoremovebg.png"}
                alt={BRAND.name}
                width={112}
                height={112}
                unoptimized
                className="mx-auto h-28 w-28 object-contain"
              />

              <h2 className="mt-5 text-3xl font-black uppercase text-[var(--brand-primary)]">
                Sin pedidos en cocina
              </h2>

              <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                Cuando caja confirme un pedido y lo envíe a preparación, aparecerá en esta pantalla. Los pedidos completos quedan como consulta para cocina.
              </p>
            </section>
          ) : (
            <section className="mt-5 grid gap-4 xl:grid-cols-2">
              {filteredOrders.map((order) => {
                const comboItems = order.items.filter(isComboItem)
                const regularItems = order.items.filter((item) => !isComboItem(item))
                const isDelivery = isDeliveryOrder(order)
                const displayTableNumber = getDisplayTableNumber(order)
                const elapsedMinutes = getElapsedMinutes(order.createdAt)
                const hasProductsToConfirm = hasStaffConfirmationItems(order)
                const hasConfirmedProducts = hasConfirmedStaffConfirmationItems(order)
                const productsToConfirmText = buildStaffConfirmationText(order)

                return (
                  <article
                    key={order.id}
                    className="overflow-hidden rounded-[1.6rem] border-2 border-[var(--brand-primary)] bg-white shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]"
                  >
                    <div className="border-b-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-4xl font-black leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
                              {getDisplayOrderNumber(order)}
                            </p>

                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase ${getStatusStyle(
                                order.status
                              )}`}
                            >
                              {getStatusIcon(order.status)}
                              {order.status}
                            </span>

                            {isDelivery && (
                              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-black uppercase text-white">
                                <Truck size={15} />
                                Delivery
                              </span>
                            )}

                            {hasProductsToConfirm && (
                              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-black uppercase text-[var(--brand-ink)]">
                                <Eye size={15} />
                                Revisar producto
                              </span>
                            )}

                            {!hasProductsToConfirm && hasConfirmedProducts && (
                              <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-xs font-black uppercase text-green-700">
                                <CheckCircle2 size={15} />
                                Revisión confirmada
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-xs font-bold text-[var(--brand-ink-2)]/70">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>

                        <div className={`rounded-[1.15rem] border-2 px-4 py-3 text-right ${getElapsedToneClasses(elapsedMinutes)}`}>
                          <p className="text-[0.62rem] font-black uppercase tracking-[0.14em]">
                            Tiempo
                          </p>
                          <p className="mt-1 text-2xl font-black leading-none">
                            {formatElapsedMinutes(elapsedMinutes)}
                          </p>
                          <p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.14em]">
                            {getElapsedPriorityLabel(elapsedMinutes)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoBox label="Cliente" value={order.customerName || "Cliente"} />
                        <InfoBox
                          label={isDelivery ? "Zona delivery" : "Mesa / ubicación"}
                          value={displayTableNumber}
                        />
                        <InfoBox label="Tipo" value={isDelivery ? "Delivery" : order.orderType} />
                        <InfoBox label="Tiempo" value={formatElapsedMinutes(elapsedMinutes)} />
                      </div>

                      {isDelivery && (
                        <div className="space-y-3 rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            <Truck size={16} />
                            Datos de delivery
                          </p>

                          <div className="grid gap-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/80">
                            <p className="rounded-2xl bg-white px-3 py-2">
                              <strong>Teléfono:</strong> {order.customerPhone || "Sin teléfono"}
                            </p>

                            <p className="rounded-2xl bg-white px-3 py-2">
                              <strong>Dirección:</strong> {order.deliveryAddress || "Sin dirección"}
                            </p>

                            <p className="rounded-2xl bg-white px-3 py-2">
                              <strong>Referencia:</strong> {order.deliveryReference || "Sin referencia"}
                            </p>
                          </div>
                        </div>
                      )}


                      {hasProductsToConfirm && (
                        <div className="rounded-[1.4rem] border-2 border-yellow-500 bg-[var(--brand-accent-100)] p-4">
                          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-amber)]">
                            <Eye size={17} />
                            Productos por confirmar
                          </p>
                          <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]">
                            Revisar antes de preparar o entregar el pedido: {productsToConfirmText}.
                          </p>
                        </div>
                      )}

                      {!hasProductsToConfirm && hasConfirmedProducts && (
                        <div className="rounded-[1.4rem] border-2 border-green-500/35 bg-green-50 p-4">
                          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-green-700">
                            <CheckCircle2 size={17} />
                            Revisión confirmada
                          </p>
                          <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]">
                            Los productos que requerían revisión ya fueron confirmados por el personal.
                          </p>
                        </div>
                      )}

                      <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Productos
                        </p>

                        <div className="mt-3 space-y-2">
                          {comboItems.length > 0 && (
                            <ProductGroup
                              title="Combos"
                              items={comboItems}
                            />
                          )}

                          {regularItems.length > 0 && (
                            <ProductGroup
                              title="Productos normales"
                              items={regularItems}
                            />
                          )}
                        </div>
                      </div>

                      {order.customerNote && (
                        <div className="rounded-[1.4rem] border-2 border-yellow-400 bg-[var(--brand-accent-100)] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-amber)]">
                            Nota general
                          </p>

                          <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]">
                            {order.customerNote}
                          </p>
                        </div>
                      )}

                      <div className="grid gap-2 sm:grid-cols-2">
                        {order.status === "Preparando" && (
                          hasProductsToConfirm ? (
                            <div className="rounded-full border-2 border-yellow-500 bg-[var(--brand-accent-100)] px-5 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-amber)]">
                              Revisión pendiente antes de marcar listo
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateStatus(order.id, "Listo")}
                              className="rounded-full bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)] transition hover:bg-[var(--brand-accent-200)]"
                            >
                              Marcar listo
                            </button>
                          )
                        )}

                        {order.status === "Listo" && (
                          <div className="rounded-2xl border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-amber)]">
                            Pedido listo. Caja o Delivery continúan el flujo.
                          </div>
                        )}

                        {order.status === "Entregado" && (
                          <div className="rounded-2xl border-2 border-green-500/35 bg-green-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-green-700">
                            Pedido completo. Solo consulta para cocina.
                          </div>
                        )}

                        {order.status !== "Cancelado" && order.status !== "Entregado" && (
                          <button
                            type="button"
                            onClick={() => updateStatus(order.id, "Cancelado")}
                            className="rounded-full bg-red-700 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-red-800"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </section>
          )}
        </div>
      </main>
    </ModuleAccessGuard>
  )
}

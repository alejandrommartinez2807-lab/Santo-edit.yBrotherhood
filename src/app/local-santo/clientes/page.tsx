"use client"

import ModuleAccessGuard, { useHotelMode } from "@/components/ModuleAccessGuard"
import { BRAND } from "@/lib/brand"
import { useEffect, useEffectEvent, useMemo, useState } from "react"
import {
  ArrowLeft,
  Clock,
  Loader2,
  LogIn,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingBag,
  Star,
  UserRound,
} from "lucide-react"
import { formatUSD } from "@/utils/formatCurrency"
import {
  getModulePlanAccess,
  getShortPlanLabel,
  normalizeLocalModuleList,
  normalizeLocalPlanKey,
  normalizeLocalPlanMode,
  type LocalModuleKey,
  type LocalPlanKey,
  type LocalPlanMode,
} from "@/lib/localPlans"

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"

type OrderStatus = "Nuevo" | "Preparando" | "Listo" | "Entregado" | "Cancelado"
type OrderType = "Comer aquí" | "Para llevar" | "Delivery"

type OrderItem = {
  id?: number
  name: string
  category?: string
  price?: number
  quantity?: number
  paymentMode?: "divisa" | "mixto"
}

type LocalOrder = {
  id: string
  createdAt: string
  customerName: string
  customerPhone?: string
  tableNumber?: string
  orderType?: OrderType
  deliveryZone?: string
  items?: OrderItem[]
  totalPrice?: number
  totalUSD?: number
  totalCombosUSD?: number
  totalRegularUSD?: number
  deliveryCostUSD?: number
  status?: OrderStatus
}

type BusinessConfig = {
  businessName: string
  businessShortDescription: string
  membershipPlan: LocalPlanKey
  membershipPlanMode: LocalPlanMode
  customIncludedModules: LocalModuleKey[]
  customBlockedModules: LocalModuleKey[]
  customersModuleEnabled: boolean
}

type CustomerSummary = {
  key: string
  name: string
  phone: string
  whatsappPhone: string
  orderCount: number
  totalSpentUSD: number
  lastOrderAt: string
  lastOrderStatus: string
  preferredType: string
  products: {
    name: string
    quantity: number
  }[]
}

const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  businessName: BRAND.name,
  businessShortDescription: "Menú y pedidos",
  membershipPlan: "complete",
  membershipPlanMode: "plan",
  customIncludedModules: [],
  customBlockedModules: [],
  customersModuleEnabled: true,
}

async function readApiResponse(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      "El servidor respondió con una página en vez de datos. Revisa que el acceso privado esté funcionando correctamente."
    )
  }
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value

  const normalized = String(value || "").trim().toLowerCase()

  if (["true", "1", "si", "sí", "activo", "activa", "activado", "activada"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no", "inactivo", "inactiva", "desactivado", "desactivada"].includes(normalized)) {
    return false
  }

  return fallback
}

function normalizeBusinessConfig(value: unknown): BusinessConfig {
  const source = (value || {}) as Record<string, unknown>

  return {
    businessName:
      String(source.businessName || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.businessName,
    businessShortDescription:
      String(source.businessShortDescription || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.businessShortDescription,
    membershipPlan: normalizeLocalPlanKey(source.membershipPlan),
    membershipPlanMode: normalizeLocalPlanMode(source.membershipPlanMode),
    customIncludedModules: normalizeLocalModuleList(source.customIncludedModules),
    customBlockedModules: normalizeLocalModuleList(source.customBlockedModules),
    customersModuleEnabled: normalizeBoolean(
      source.customersModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.customersModuleEnabled
    ),
  }
}

function normalizeComparableText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function normalizePhoneDigits(value: string) {
  return String(value || "").replace(/\D/g, "")
}

function normalizePhoneForWhatsApp(value: string) {
  const digits = normalizePhoneDigits(value)

  if (!digits) return ""

  if (digits.startsWith("0") && digits.length === 11) {
    return `58${digits.slice(1)}`
  }

  if (digits.startsWith("4") && digits.length === 10) {
    return `58${digits}`
  }

  if (digits.startsWith("58") && digits.length === 12) {
    return digits
  }

  if (!digits.startsWith("0") && digits.length >= 10 && digits.length <= 15) {
    return digits
  }

  return ""
}

function roundMoney(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue)) {
    return 0
  }

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function getOrderTotalUSD(order: LocalOrder) {
  if (Number(order.totalUSD || 0) > 0) return roundMoney(order.totalUSD)
  if (Number(order.totalPrice || 0) > 0) return roundMoney(order.totalPrice)

  const itemsTotal = Array.isArray(order.items)
    ? order.items.reduce((total, item) => {
        return total + Number(item.price || 0) * Number(item.quantity || 0)
      }, 0)
    : 0

  return roundMoney(itemsTotal + Number(order.deliveryCostUSD || 0))
}

function getDisplayOrderType(order: LocalOrder) {
  if (
    order.orderType === "Delivery" ||
    order.tableNumber?.toLowerCase().startsWith("delivery") ||
    order.deliveryZone
  ) {
    return "Delivery"
  }

  if (order.orderType === "Para llevar") return "Para llevar"

  return "Comer aquí"
}

function formatDate(value: string) {
  if (!value) return "Sin fecha"

  try {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(date)
  } catch {
    return value
  }
}

function getCustomerKey(order: LocalOrder) {
  const phoneDigits = normalizePhoneDigits(order.customerPhone || "")
  const nameKey = normalizeComparableText(order.customerName || "")

  if (phoneDigits.length >= 7) return `phone:${phoneDigits}`
  if (nameKey) return `name:${nameKey}`

  return `order:${order.id}`
}

function buildCustomerSummaries(orders: LocalOrder[]) {
  const customerMap = new Map<
    string,
    CustomerSummary & {
      typeCounter: Map<string, number>
      productCounter: Map<string, number>
    }
  >()

  orders
    .filter((order) => order.status !== "Cancelado")
    .forEach((order) => {
      const key = getCustomerKey(order)
      const current = customerMap.get(key) || {
        key,
        name: String(order.customerName || "Cliente").trim() || "Cliente",
        phone: String(order.customerPhone || "").trim(),
        whatsappPhone: normalizePhoneForWhatsApp(order.customerPhone || ""),
        orderCount: 0,
        totalSpentUSD: 0,
        lastOrderAt: "",
        lastOrderStatus: "Sin estado",
        preferredType: "Sin definir",
        products: [],
        typeCounter: new Map<string, number>(),
        productCounter: new Map<string, number>(),
      }

      const cleanName = String(order.customerName || "").trim()
      const cleanPhone = String(order.customerPhone || "").trim()
      const whatsappPhone = normalizePhoneForWhatsApp(cleanPhone)
      const orderType = getDisplayOrderType(order)

      current.name = current.name === "Cliente" && cleanName ? cleanName : current.name
      current.phone = current.phone || cleanPhone
      current.whatsappPhone = current.whatsappPhone || whatsappPhone
      current.orderCount += 1
      current.totalSpentUSD += getOrderTotalUSD(order)
      current.typeCounter.set(
        orderType,
        (current.typeCounter.get(orderType) || 0) + 1
      )

      if (
        order.createdAt &&
        (!current.lastOrderAt || new Date(order.createdAt) > new Date(current.lastOrderAt))
      ) {
        current.lastOrderAt = order.createdAt
        current.lastOrderStatus = order.status || "Sin estado"
      }

      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const name = String(item.name || "").trim()
          const quantity = Number(item.quantity || 0)

          if (!name || quantity <= 0) return

          current.productCounter.set(
            name,
            (current.productCounter.get(name) || 0) + quantity
          )
        })
      }

      customerMap.set(key, current)
    })

  return Array.from(customerMap.values())
    .map((customer) => {
      const preferredType = Array.from(customer.typeCounter.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0]

      const products = Array.from(customer.productCounter.entries())
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 3)

      return {
        key: customer.key,
        name: customer.name,
        phone: customer.phone,
        whatsappPhone: customer.whatsappPhone,
        orderCount: customer.orderCount,
        totalSpentUSD: roundMoney(customer.totalSpentUSD),
        lastOrderAt: customer.lastOrderAt,
        lastOrderStatus: customer.lastOrderStatus,
        preferredType: preferredType || "Sin definir",
        products,
      }
    })
    .sort((a, b) => {
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount
      if (b.totalSpentUSD !== a.totalSpentUSD) return b.totalSpentUSD - a.totalSpentUSD

      return new Date(b.lastOrderAt || 0).getTime() - new Date(a.lastOrderAt || 0).getTime()
    })
}

function buildWhatsAppUrl(customer: CustomerSummary) {
  if (!customer.whatsappPhone) return ""

  const message = [
    `Hola, somos ${BRAND.name}.`,
    "",
    `${customer.name}, gracias por comprar con nosotros.`,
    "Tenemos opciones del menú listas para tu próximo pedido.",
    "",
    "¿Te gustaría hacer un pedido hoy?",
  ].join("\n")

  return `https://wa.me/${customer.whatsappPhone}?text=${encodeURIComponent(message)}`
}

export default function FrequentCustomersPage() {
  return (
    <ModuleAccessGuard moduleKey="customers" moduleName="Clientes">
      <FrequentCustomersPageContent />
    </ModuleAccessGuard>
  )
}

function FrequentCustomersPageContent() {
  // Con la recepción activa el módulo habla de huéspedes y consumos.
  const hotelMode = useHotelMode()
  const [adminPassword, setAdminPassword] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig>(
    DEFAULT_BUSINESS_CONFIG
  )
  const [orders, setOrders] = useState<LocalOrder[]>([])
  const [searchText, setSearchText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const customersAccess = getModulePlanAccess(businessConfig, "customers")
  const canUseCustomers = customersAccess.effectiveEnabled
  const planLabel = getShortPlanLabel(businessConfig.membershipPlan)

  const customers = useMemo(() => buildCustomerSummaries(orders), [orders])

  const filteredCustomers = useMemo(() => {
    const query = normalizeComparableText(searchText)

    if (!query) return customers

    return customers.filter((customer) => {
      const searchableText = normalizeComparableText(
        [
          customer.name,
          customer.phone,
          customer.preferredType,
          customer.lastOrderStatus,
          customer.products.map((product) => product.name).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
      )

      return searchableText.includes(query)
    })
  }, [customers, searchText])

  const frequentCustomers = customers.filter((customer) => customer.orderCount >= 2)
  const totalCustomerSales = customers.reduce(
    (total, customer) => total + customer.totalSpentUSD,
    0
  )
  const topCustomer = customers[0]

  async function loadCustomers(password = adminPassword) {
    if (!password) return

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const configResponse = await fetch("/api/business-config", {
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })
      const configData = await readApiResponse(configResponse)

      if (!configResponse.ok) {
        throw new Error(
          configData.error || "No se pudo cargar la configuración del negocio"
        )
      }

      const nextConfig = normalizeBusinessConfig(
        configData.businessConfig || configData.config || configData
      )

      setBusinessConfig(nextConfig)

      const access = getModulePlanAccess(nextConfig, "customers")

      if (!access.effectiveEnabled) {
        setOrders([])
        return
      }

      const ordersResponse = await fetch("/api/orders", {
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })
      const ordersData = await readApiResponse(ordersResponse)

      if (!ordersResponse.ok) {
        throw new Error(ordersData.error || "No se pudieron cargar los pedidos")
      }

      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : [])
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los clientes frecuentes"
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleLogin() {
    const password = passwordInput.trim()

    if (!password) return

    window.sessionStorage.setItem(ADMIN_STORAGE_KEY, password)
    setAdminPassword(password)
    loadCustomers(password)
  }

  function handleLogout() {
    window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
    setAdminPassword("")
    setPasswordInput("")
    setOrders([])
    setErrorMessage(null)
    setSearchText("")
  }

  const restoreSession = useEffectEvent(() => {
    const savedPassword = window.sessionStorage.getItem(ADMIN_STORAGE_KEY)

    if (!savedPassword) return

    setAdminPassword(savedPassword)
    setPasswordInput(savedPassword)
    loadCustomers(savedPassword)
  })

  useEffect(() => {
    // Difiere la restauración de sesión un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(restoreSession, 0)
    return () => clearTimeout(timer)
  }, [])

  if (!adminPassword) {
    return (
      <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-6 text-[var(--brand-ink-3)]">
        <section className="mx-auto max-w-xl rounded-[1.5rem] border border-[var(--brand-primary)]/45 bg-white p-5 shadow-sm">
          <a
            href="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
          >
            <ArrowLeft size={16} />
            Volver
          </a>

          <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] text-[var(--brand-ink)]">
            <UserRound size={28} />
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.28em] text-[var(--brand-primary)]">
            Acceso privado
          </p>
          <h1 className="font-serif mt-2 text-4xl leading-tight text-[var(--brand-ink-3)] font-semibold">
            Clientes frecuentes
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
            Ingresa con la clave del dueño para revisar clientes, pedidos repetidos y contacto por WhatsApp.
          </p>

          <div className="mt-5 grid gap-3">
            <input
              type="password"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleLogin()
              }}
              className="rounded-2xl border border-[var(--brand-primary)]/30 bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
              placeholder="Clave privada"
            />

            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoading || !passwordInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              Entrar
            </button>
          </div>

          {errorMessage && (
            <p className="mt-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {errorMessage}
            </p>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-3 py-4 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[1.6rem] border border-[var(--brand-primary)]/45 bg-white shadow-sm">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/admin"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <ArrowLeft size={16} />
                    Volver al panel
                  </a>

                  <button
                    type="button"
                    onClick={() => loadCustomers()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Actualizar
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    Cerrar sesión
                  </button>
                </div>

                <p className="mt-4 text-xs font-bold uppercase tracking-[0.32em] text-[var(--brand-primary)]">
                  {businessConfig.businessName}
                </p>

                <h1 className="font-serif mt-1 text-4xl leading-tight text-[var(--brand-ink-3)] sm:text-5xl font-semibold">
                  Clientes frecuentes
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  {hotelMode
                    ? "Revisa qué huéspedes y clientes consumen más, cuándo fue su último consumo y escríbeles por WhatsApp para invitarlos a volver."
                    : "Revisa quiénes compran más, cuándo fue su último pedido y escríbeles por WhatsApp para facilitar una recompra."}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:w-[620px]">
                <MetricCard label="Clientes" value={customers.length} />
                <MetricCard label="Frecuentes" value={frequentCustomers.length} tone="yellow" />
                <MetricCard label="Ventas asociadas" value={formatUSD(totalCustomerSales)} />
                <MetricCard label="Plan" value={planLabel} tone={canUseCustomers ? "good" : "warning"} />
              </div>
            </div>
          </div>
        </header>

        {!canUseCustomers && (
          <section className="mt-4 rounded-[1.4rem] border border-yellow-400 bg-[var(--brand-accent-100)] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] text-[var(--brand-ink)]">
                <ShieldAlert size={22} />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--brand-amber)]">
                  Módulo no activo
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Clientes frecuentes está disponible desde {customersAccess.minimumPlanLabel}. Si el plan ya lo incluye, actívalo desde configuración del negocio.
                </p>
              </div>
            </div>
          </section>
        )}

        {canUseCustomers && (
          <>
            <section className="sticky top-0 z-20 mt-4 rounded-[1.4rem] border border-[var(--brand-primary)]/40 bg-white p-3 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Seguimiento de clientes
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                    {customers.length} cliente(s) detectado(s) · {frequentCustomers.length} con más de un pedido
                  </p>
                </div>

                <label className="flex min-w-0 items-center gap-2 rounded-full border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-2">
                  <Search size={16} className="text-[var(--brand-primary)]" />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Buscar por nombre, teléfono o producto"
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--brand-ink-2)] outline-none placeholder:text-[var(--brand-ink-2)]/45"
                  />
                </label>
              </div>
            </section>

            {topCustomer && (
              <section className="mt-4 rounded-[1.6rem] border border-[var(--brand-primary)]/45 bg-[var(--brand-accent)] p-4 text-[var(--brand-ink)] shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em]">
                      Cliente con más movimiento
                    </p>
                    <h2 className="font-serif mt-2 text-3xl leading-tight sm:text-4xl font-semibold">
                      {topCustomer.name}
                    </h2>
                    <p className="mt-2 text-sm font-bold">
                      {topCustomer.orderCount} pedido(s) · {formatUSD(topCustomer.totalSpentUSD)} · Último pedido {formatDate(topCustomer.lastOrderAt)}
                    </p>
                  </div>

                  {buildWhatsAppUrl(topCustomer) ? (
                    <a
                      href={buildWhatsAppUrl(topCustomer)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-cream)]"
                    >
                      <MessageCircle size={16} />
                      Escribir por WhatsApp
                    </a>
                  ) : (
                    <span className="rounded-full border border-[var(--brand-primary)]/40 bg-white/50 px-5 py-3 text-center text-xs font-bold uppercase tracking-[0.14em]">
                      Sin WhatsApp válido
                    </span>
                  )}
                </div>
              </section>
            )}

            <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredCustomers.map((customer, index) => {
                const whatsappUrl = buildWhatsAppUrl(customer)

                return (
                  <article
                    key={customer.key}
                    className="rounded-[1.5rem] border border-[var(--brand-primary)]/40 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] text-[var(--brand-ink)]">
                        {index === 0 ? <Star size={22} /> : <UserRound size={22} />}
                      </div>

                      <span className="rounded-full border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-3 py-1 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                        {customer.orderCount} pedido(s)
                      </span>
                    </div>

                    <h2 className="font-serif mt-4 text-2xl leading-tight text-[var(--brand-ink-3)] font-semibold">
                      {customer.name}
                    </h2>

                    <div className="mt-3 grid gap-2 text-sm font-bold text-[var(--brand-ink-2)]/75">
                      <p className="flex items-center gap-2">
                        <Phone size={16} className="text-[var(--brand-primary)]" />
                        {customer.phone || "Sin teléfono registrado"}
                      </p>
                      <p className="flex items-center gap-2">
                        <ShoppingBag size={16} className="text-[var(--brand-primary)]" />
                        Total aproximado: {formatUSD(customer.totalSpentUSD)}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock size={16} className="text-[var(--brand-primary)]" />
                        Último pedido: {formatDate(customer.lastOrderAt)}
                      </p>
                    </div>

                    <div className="mt-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3">
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        Preferencias
                      </p>
                      <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]">
                        Tipo frecuente: {customer.preferredType}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {customer.products.length ? (
                          customer.products.map((product) => (
                            <span
                              key={product.name}
                              className="rounded-full border border-[var(--brand-primary)]/20 bg-white px-3 py-1 text-[0.68rem] font-bold text-[var(--brand-primary)]"
                            >
                              {product.name} x{product.quantity}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-bold text-[var(--brand-ink-2)]/60">
                            Sin productos detallados.
                          </span>
                        )}
                      </div>
                    </div>

                    {whatsappUrl ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                      >
                        <MessageCircle size={16} />
                        Escribir por WhatsApp
                      </a>
                    ) : (
                      <div className="mt-4 rounded-full border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]/70">
                        Teléfono no válido para WhatsApp
                      </div>
                    )}
                  </article>
                )
              })}
            </section>

            {!filteredCustomers.length && (
              <section className="mt-4 rounded-[1.4rem] border border-[var(--brand-primary)]/20 bg-white p-5 text-center">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Sin clientes para mostrar
                </p>
                <p className="mt-2 text-sm font-bold text-[var(--brand-ink-2)]/65">
                  Cuando existan pedidos con nombre o teléfono, aquí aparecerá el seguimiento de clientes frecuentes.
                </p>
              </section>
            )}
          </>
        )}

        {errorMessage && (
          <section className="mt-4 rounded-[1.4rem] border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorMessage}
          </section>
        )}
      </div>
    </main>
  )
}

function MetricCard({
  label,
  value,
  tone = "soft",
}: {
  label: string
  value: string | number
  tone?: "soft" | "good" | "warning" | "yellow"
}) {
  const toneClass =
    tone === "good"
      ? "border-green-400 bg-green-50 text-green-700"
      : tone === "warning"
        ? "border-red-300 bg-red-50 text-red-700"
        : tone === "yellow"
          ? "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
          : "border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] text-[var(--brand-primary)]"

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <p className="text-[0.58rem] font-bold uppercase tracking-[0.16em] opacity-75">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
    </div>
  )
}

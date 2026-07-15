"use client"

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { BRAND } from "@/lib/brand"
import { signOutLocalStaff } from "@/lib/staffSession"
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Link2,
  RefreshCw,
  Search,
  UploadCloud,
  Volume2,
  VolumeX,
} from "lucide-react"
import { formatUSD, formatVES } from "@/utils/formatCurrency"
import type { LocalOrder as StoredLocalOrder, OpenAccount } from "@/types/localOrders"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import { LocalTableQrLinksPanel } from "@/components/local/LocalTableQrLinksPanel"
import { OpenAccountsPanel } from "@/components/local/OpenAccountsPanel"
import {
  DEFAULT_LOCAL_TABLES,
  LocalTablesMap,
  normalizeLocalTableText,
  normalizeLocalTablesForMap,
  type LocalTableMapItem,
} from "@/components/local/LocalTablesMap"
import { useOperationalSounds, useOrderSoundAlerts } from "@/hooks/useOperationalSounds"
import { usePersistedToggle } from "@/hooks/usePersistedToggle"
import { usePaymentProofAlerts } from "@/hooks/usePaymentProofAlerts"
import PaymentProofAlertToast from "@/components/PaymentProofAlertToast"
import {
  getOrderItemDetailLines,
  getOrderStaffConfirmationSummary,
  getStaffConfirmationStatusLabel,
  hasStaffConfirmationItems,
} from "@/lib/localOrderHelpers"
import {
  ADMIN_STORAGE_KEY,
  CASH_FILTERS,
  DELIVERY_PAYMENT_OPTIONS,
  EMPTY_PAYMENT_FORM,
  PAYMENT_METHOD_USD_OPTIONS,
  PAYMENT_METHOD_VES_OPTIONS,
  calculatePaymentDraft,
  createPaymentFormFromOrder,
  findOpenAccountForOrder,
  findSuggestedOpenAccountForOrder,
  formatMoneyForInput,
  formatPaymentProofDate,
  getDisplayLocation,
  getDisplayOrderNumber,
  getDisplayOrderType,
  getOpenAccountOrderCount,
  getOpenAccountPendingUSD,
  getOpenAccountTotalUSD,
  getOrderPayment,
  getPendingPaymentProofs,
  isDeliveryOrder,
  isDeliveryReported,
  parseMoneyInput,
  readApiResponse,
  roundMoney,
  type CashFilter,
  type DeliveryPaymentIn,
  type LocalOrder,
  type OrderStatus,
  type PaymentForm,
  type PaymentProof,
} from "./domain"
import {
  CashOrderCard,
  InfoBox,
  InputBox,
  LoginShell,
  MetricCard,
  MiniMetric,
  ModalShell,
  SelectBox,
} from "./components"

export default function CajaPage() {
  return (
    <ModuleAccessGuard moduleKey="cashier" moduleName="Caja">
      <CajaPageContent />
    </ModuleAccessGuard>
  )
}

function CajaPageContent() {
  const [adminPassword, setAdminPassword] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [orders, setOrders] = useState<LocalOrder[]>([])
  const [openAccounts, setOpenAccounts] = useState<OpenAccount[]>([])
  const [localTables, setLocalTables] = useState<LocalTableMapItem[]>(DEFAULT_LOCAL_TABLES)
  const [activeFilter, setActiveFilter] = useState<CashFilter>("Por confirmar")
  const [searchText, setSearchText] = useState("")
  const [selectedCashTableName, setSelectedCashTableName] = useState("")
  // Preferencias de pantalla recordadas por equipo (localStorage).
  const [showControls, setShowControls] = usePersistedToggle("caja_show_controls", true)
  const [showTablesMap, setShowTablesMap] = usePersistedToggle("caja_show_tables_map", true)
  const [showQrLinks, setShowQrLinks] = usePersistedToggle("caja_show_qr_links", false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<LocalOrder | null>(null)
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(EMPTY_PAYMENT_FORM)
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null)
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([])
  const [isLoadingPaymentProofs, setIsLoadingPaymentProofs] = useState(false)
  const [paymentProofsMessage, setPaymentProofsMessage] = useState<string | null>(null)
  const [confirmingStaffOrderId, setConfirmingStaffOrderId] = useState<string | null>(null)
  const [attachingOpenAccountOrderId, setAttachingOpenAccountOrderId] = useState<string | null>(null)
  const [canSplitBill, setCanSplitBill] = useState(false)
  // Encuesta post-venta por WhatsApp (configurable por el dueño).
  const [postSaleSurvey, setPostSaleSurvey] = useState({
    enabled: false,
    message: "",
    reviewUrl: "",
  })

  const pendingStatusRef = useRef<Map<string, OrderStatus>>(new Map())
  const isLoggedIn = adminPassword.length > 0
  const soundControls = useOperationalSounds({ adminPassword })

  useOrderSoundAlerts(orders, {
    module: "cashier",
    enabled: isLoggedIn && soundControls.isSoundEnabled,
    playSound: soundControls.playSound,
  })

  // Aviso notorio cuando un cliente reporta un pago: sonido tipo caja
  // registradora + toast verde con acceso directo a la revisión.
  const paymentProofAlerts = usePaymentProofAlerts(paymentProofs, {
    enabled: isLoggedIn,
    onNewProof: () => void soundControls.playSound("paymentProof"),
  })

  async function loadLocalTables() {
    try {
      const response = await fetch("/api/public/business-config", {
        cache: "no-store",
      })
      const data = await readApiResponse(response)
      const businessConfig = data.businessConfig && typeof data.businessConfig === "object"
        ? data.businessConfig
        : data

      setLocalTables(normalizeLocalTablesForMap(businessConfig.localTables))
      setCanSplitBill(Boolean(businessConfig.splitBillEnabled))
      setPostSaleSurvey({
        enabled: businessConfig.postSaleSurveyEnabled !== false,
        message: String(businessConfig.postSaleSurveyMessage || ""),
        reviewUrl: String(businessConfig.googleReviewUrl || ""),
      })
    } catch {
      setLocalTables(DEFAULT_LOCAL_TABLES)
    }
  }

  async function loadOpenAccounts(password = adminPassword, silent = true) {
    if (!password) {
      setOpenAccounts([])
      return
    }

    try {
      const response = await fetch("/api/open-accounts?status=Abierta", {
        headers: { "x-admin-password": password },
        cache: "no-store",
      })
      const data = await readApiResponse(response)

      if (!response.ok) throw new Error(data.error || "No se pudieron cargar las cuentas abiertas")

      setOpenAccounts(Array.isArray(data.openAccounts) ? data.openAccounts : [])
    } catch (error) {
      setOpenAccounts([])
      if (!silent) {
        setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las cuentas abiertas")
      }
    }
  }

  async function loadOrders(password = adminPassword, silent = false) {
    if (!password) return
    if (!silent) setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch("/api/orders", {
        headers: { "x-admin-password": password },
        cache: "no-store",
      })
      const data = await readApiResponse(response)
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los pedidos de caja")

      let nextOrders: LocalOrder[] = data.orders || []
      nextOrders = nextOrders.map((order) => {
        const pendingStatus = pendingStatusRef.current.get(order.id)
        if (!pendingStatus) return order
        return { ...order, status: pendingStatus }
      })
      setOrders(nextOrders)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los pedidos de caja")
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  async function loadPaymentProofs(password = adminPassword, silent = false) {
    if (!password) return

    if (!silent) {
      setIsLoadingPaymentProofs(true)
    }

    setPaymentProofsMessage(null)

    try {
      const response = await fetch("/api/payment-proofs", {
        headers: { "x-admin-password": password },
        cache: "no-store",
      })
      const data = await readApiResponse(response)

      if (!response.ok) {
        if (response.status === 403) {
          setPaymentProofs([])
          return
        }

        throw new Error(data.error || "No se pudieron cargar los comprobantes")
      }

      setPaymentProofs(Array.isArray(data.paymentProofs) ? data.paymentProofs : [])
    } catch (error) {
      setPaymentProofsMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los comprobantes"
      )
    } finally {
      if (!silent) {
        setIsLoadingPaymentProofs(false)
      }
    }
  }

  async function attachOrderToOpenAccount(order: LocalOrder, account: OpenAccount) {
    const cleanPassword = adminPassword.trim()

    if (!cleanPassword) {
      setErrorMessage("Ingresa la clave de caja para asociar el pedido a la cuenta.")
      return
    }

    const accountId = String(account.id || "").trim()

    if (!accountId) {
      setErrorMessage("No se encontró la cuenta abierta de esta mesa.")
      return
    }

    setAttachingOpenAccountOrderId(order.id)
    setErrorMessage(null)
    setAccountMessage(null)

    try {
      const response = await fetch(`/api/open-accounts/${encodeURIComponent(accountId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": cleanPassword,
        },
        cache: "no-store",
        body: JSON.stringify({ action: "attachOrder", orderId: order.id }),
      })
      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo asociar el pedido a la cuenta abierta")
      }

      if (data.order) {
        setOrders((currentOrders) =>
          currentOrders.map((currentOrder) =>
            currentOrder.id === order.id ? data.order : currentOrder
          )
        )
      }

      await loadOrders(cleanPassword, true)
      await loadOpenAccounts(cleanPassword, true)
      setAccountMessage(`Pedido asociado a la cuenta abierta de ${account.tableNumber}.`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo asociar el pedido a la cuenta abierta")
    } finally {
      setAttachingOpenAccountOrderId(null)
    }
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    if (!adminPassword) return
    const previousOrder = orders.find((order) => order.id === orderId)
    pendingStatusRef.current.set(orderId, status)
    setErrorMessage(null)
    setOrders((currentOrders) => currentOrders.map((order) => order.id === orderId ? { ...order, status } : order))

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ status }),
      })
      const data = await readApiResponse(response)
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar el pedido")

      window.setTimeout(() => {
        if (pendingStatusRef.current.get(orderId) === status) pendingStatusRef.current.delete(orderId)
        loadOrders(adminPassword, true)
      }, 600)
    } catch (error) {
      pendingStatusRef.current.delete(orderId)
      if (previousOrder) {
        setOrders((currentOrders) => currentOrders.map((order) => order.id === orderId ? previousOrder : order))
      }
      setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar el pedido")
    }
  }

  async function confirmStaffItems(order: LocalOrder) {
    if (!adminPassword || !order.id || confirmingStaffOrderId) return

    setConfirmingStaffOrderId(order.id)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          action: "confirmStaffItems",
          confirmedBy: "Caja",
          confirmedRole: "Caja",
        }),
      })
      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo confirmar la revisión del pedido")
      }

      const updatedOrder = data.order as LocalOrder

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder
        )
      )

      if (selectedPaymentOrder?.id === updatedOrder.id) {
        setSelectedPaymentOrder(updatedOrder)
      }

      window.setTimeout(() => loadOrders(adminPassword, true), 600)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo confirmar la revisión del pedido"
      )
    } finally {
      setConfirmingStaffOrderId(null)
    }
  }

  async function resetStaffItems(order: LocalOrder) {
    if (!adminPassword || !order.id || confirmingStaffOrderId) return

    setConfirmingStaffOrderId(order.id)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          action: "resetStaffItems",
          resetBy: "Caja",
          resetRole: "Caja",
        }),
      })
      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo reabrir la revisión del pedido")
      }

      const updatedOrder = data.order as LocalOrder

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder
        )
      )

      if (selectedPaymentOrder?.id === updatedOrder.id) {
        setSelectedPaymentOrder(updatedOrder)
      }

      window.setTimeout(() => loadOrders(adminPassword, true), 600)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo reabrir la revisión del pedido"
      )
    } finally {
      setConfirmingStaffOrderId(null)
    }
  }

  function handleLogin() {
    const password = passwordInput.trim()
    if (!password) return
    window.sessionStorage.setItem(ADMIN_STORAGE_KEY, password)
    setAdminPassword(password)
    loadLocalTables()
    loadOrders(password)
    loadOpenAccounts(password, true)
    loadPaymentProofs(password)
  }

  function handleLogout() {
    // Cierra la sesión de verdad (incluye Supabase) y va al login para poder
    // entrar como otro usuario. Ver signOutLocalStaff.
    window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
    setAdminPassword("")
    setPasswordInput("")
    void signOutLocalStaff()
  }

  function openPaymentModal(order: LocalOrder) {
    setSelectedPaymentOrder(order)
    setPaymentForm(createPaymentFormFromOrder(order))
    setPaymentMessage(null)
  }

  function updatePaymentForm<K extends keyof PaymentForm>(field: K, value: PaymentForm[K]) {
    setPaymentForm((currentForm) => ({ ...currentForm, [field]: value }))
    setPaymentMessage(null)
  }

  async function savePayment() {
    if (!adminPassword || !selectedPaymentOrder) return

    try {
      setIsSavingPayment(true)
      setPaymentMessage(null)
      setErrorMessage(null)

      const response = await fetch(`/api/orders/${selectedPaymentOrder.id}/payment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          amountReceivedUSD: parseMoneyInput(paymentForm.amountReceivedUSD),
          amountReceivedVES: parseMoneyInput(paymentForm.amountReceivedVES),
          paymentMethodUSD: paymentForm.paymentMethodUSD,
          paymentMethodVES: paymentForm.paymentMethodVES,
          deliveryPaymentIn: paymentForm.deliveryPaymentIn,
          paymentNote: paymentForm.paymentNote,
        }),
      })
      const data = await readApiResponse(response)
      if (!response.ok) throw new Error(data.error || "No se pudo registrar el cobro")

      const updatedOrder = data.order as LocalOrder
      setOrders((currentOrders) => currentOrders.map((order) => order.id === updatedOrder.id ? updatedOrder : order))
      setSelectedPaymentOrder(updatedOrder)
      setPaymentForm(createPaymentFormFromOrder(updatedOrder))
      setPaymentMessage("Cobro registrado correctamente.")

      window.setTimeout(() => {
        loadOrders(adminPassword, true)
        loadOpenAccounts(adminPassword, true)
      }, 600)
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : "No se pudo registrar el cobro")
    } finally {
      setIsSavingPayment(false)
    }
  }

  const restoreSession = useEffectEvent(() => {
    const savedPassword = window.sessionStorage.getItem(ADMIN_STORAGE_KEY)

    loadLocalTables()

    if (savedPassword) {
      setAdminPassword(savedPassword)
      setPasswordInput(savedPassword)
      loadOrders(savedPassword)
      loadOpenAccounts(savedPassword, true)
      loadPaymentProofs(savedPassword, true)
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
    loadOpenAccounts(adminPassword, true)
  })

  useEffect(() => {
    if (!adminPassword) return
    const interval = window.setInterval(refreshOrdersTick, 2500)
    return () => window.clearInterval(interval)
  }, [adminPassword])

  const refreshProofsTick = useEffectEvent(() => loadPaymentProofs(adminPassword, true))

  useEffect(() => {
    if (!adminPassword) return
    const interval = window.setInterval(refreshProofsTick, 10000)
    return () => window.clearInterval(interval)
  }, [adminPassword])

  const selectedCashTableKey = useMemo(
    () => normalizeLocalTableText(selectedCashTableName),
    [selectedCashTableName],
  )

  const filteredOrders = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    return orders
      .filter((order) => {
        const payment = getOrderPayment(order)

        if (activeFilter === "Por confirmar") {
          return order.status === "Nuevo"
        }

        if (activeFilter === "Por revisar") {
          return order.status !== "Cancelado" && hasStaffConfirmationItems(order)
        }

        if (activeFilter === "Delivery por confirmar") {
          return isDeliveryOrder(order) && isDeliveryReported(order) && order.status === "Listo"
        }

        if (activeFilter === "Pendientes") {
          return order.status !== "Cancelado" && payment.status === "Pendiente"
        }

        if (activeFilter === "Pago parcial") {
          return order.status !== "Cancelado" && payment.status === "Pago parcial"
        }

        if (activeFilter === "Listos") {
          return order.status === "Listo"
        }

        if (activeFilter === "Completos") {
          return order.status === "Entregado" && payment.status === "Pagado"
        }

        if (activeFilter === "Delivery") {
          return order.status !== "Cancelado" && isDeliveryOrder(order)
        }

        if (activeFilter === "Pagados") {
          return order.status !== "Cancelado" && payment.status === "Pagado"
        }

        if (activeFilter === "Cancelados") {
          return order.status === "Cancelado"
        }

        return true
      })
      .filter((order) => {
        if (!selectedCashTableKey) return true

        return (
          order.orderType === "Comer aquí" &&
          !isDeliveryOrder(order) &&
          normalizeLocalTableText(order.tableNumber) === selectedCashTableKey
        )
      })
      .filter((order) => {
        if (!query) return true
        const searchableText = [
          getDisplayOrderNumber(order),
          order.deliveryReportStatus,
          order.deliveryReportedAt,
          order.deliveryReportedBy,
          order.customerName,
          order.customerPhone,
          order.tableNumber,
          order.deliveryZone,
          order.deliveryAddress,
          order.deliveryReference,
          order.customerNote,
          order.itemsText,
          order.items
            .map((item) =>
              [
                item.name,
                item.selectionSummary,
                item.selectedVariation?.name,
                item.selectedAddons?.map((option) => option.name).join(" "),
                item.removedIngredients?.map((option) => option.name).join(" "),
                item.staffConfirmationStatus,
                item.staffConfirmedBy,
                getOrderItemDetailLines(item).join(" "),
              ].join(" ")
            )
            .join(" "),
          getOrderStaffConfirmationSummary(order).pendingText,
          getStaffConfirmationStatusLabel(getOrderStaffConfirmationSummary(order).status),
          getDisplayLocation(order),
          getDisplayOrderType(order),
          order.status,
          getOrderPayment(order).status,
        ]
          .join(" ")
          .toLowerCase()
        return searchableText.includes(query)
      })
  }, [activeFilter, orders, searchText, selectedCashTableKey])

  const pendingPaymentCount = orders.filter((order) => getOrderPayment(order).status === "Pendiente" && order.status !== "Cancelado").length
  const partialPaymentCount = orders.filter((order) => getOrderPayment(order).status === "Pago parcial" && order.status !== "Cancelado").length
  const readyCount = orders.filter((order) => order.status === "Listo").length
  const deliveryCount = orders.filter((order) => isDeliveryOrder(order) && order.status !== "Cancelado").length
  const pendingStaffReviewCount = orders.filter(
    (order) => order.status !== "Cancelado" && hasStaffConfirmationItems(order)
  ).length
  const pendingPaymentProofs = getPendingPaymentProofs(paymentProofs)
  const pendingPaymentProofsCount = pendingPaymentProofs.length
  const latestPendingPaymentProof = pendingPaymentProofs[0] || null
  const filteredPendingUSD = filteredOrders.reduce((total, order) => total + getOrderPayment(order).pendingUSD, 0)

  const paymentModalOrder = selectedPaymentOrder
    ? orders.find((order) => order.id === selectedPaymentOrder.id) || selectedPaymentOrder
    : null
  const paymentDraft = paymentModalOrder ? calculatePaymentDraft(paymentModalOrder, paymentForm) : null
  const paymentOpenAccount = findOpenAccountForOrder(paymentModalOrder, openAccounts)
  const paymentOpenAccountOrderCount = getOpenAccountOrderCount(paymentOpenAccount)
  const currentPaymentForModal = paymentModalOrder ? getOrderPayment(paymentModalOrder) : null
  const paymentOpenAccountPendingBeforeDraft = getOpenAccountPendingUSD(paymentOpenAccount)
  const paymentOpenAccountTotalBeforeDraft = getOpenAccountTotalUSD(paymentOpenAccount)
  const paymentOpenAccountPendingAfterDraft = paymentOpenAccount && paymentDraft && currentPaymentForModal
    ? roundMoney(Math.max(paymentOpenAccountPendingBeforeDraft - currentPaymentForModal.pendingUSD + paymentDraft.pendingUSD, 0))
    : 0
  const paymentOpenAccountCollectedAfterDraft = paymentOpenAccount && paymentDraft && currentPaymentForModal
    ? roundMoney(Math.max(Number(paymentOpenAccount.totalCollectedUSD || 0) - currentPaymentForModal.receivedEquivalentUSD + paymentDraft.receivedEquivalentUSD, 0))
    : 0
  const currentPaymentVES = parseMoneyInput(paymentForm.amountReceivedVES)
  const currentPaymentUSD = parseMoneyInput(paymentForm.amountReceivedUSD)
  const paymentExchangeRate = Number(paymentModalOrder?.exchangeRate || 0)
  const pendingVESForPayment = paymentDraft && paymentExchangeRate > 0 ? roundMoney(paymentDraft.pendingUSD * paymentExchangeRate) : 0

  function completePaymentPendingInVES() {
    if (!paymentDraft || !paymentExchangeRate) return
    const nextVES = currentPaymentVES + paymentDraft.pendingUSD * paymentExchangeRate
    updatePaymentForm("amountReceivedVES", formatMoneyForInput(nextVES))
  }

  function completePaymentPendingInUSD() {
    if (!paymentDraft) return
    const nextUSD = currentPaymentUSD + paymentDraft.pendingUSD
    updatePaymentForm("amountReceivedUSD", formatMoneyForInput(nextUSD))
  }

  if (!isLoggedIn) {
    return (
      <LoginShell
        title="Caja"
        subtitle="Ingresa la clave del local para confirmar pedidos, registrar cobros y coordinar entregas."
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        handleLogin={handleLogin}
        errorMessage={errorMessage}
      />
    )
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-3 py-4 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
      <PaymentProofAlertToast
        alert={paymentProofAlerts.newProofAlert}
        onDismiss={paymentProofAlerts.dismissNewProofAlert}
      />
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[1.6rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)]">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <a href="/local-santo" className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]">
                    <ArrowLeft size={16} /> Panel
                  </a>
                  <button type="button" onClick={() => { loadOrders(); loadOpenAccounts(adminPassword, true); loadLocalTables(); }} disabled={isLoading} className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50">
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Actualizar
                  </button>
                  <a href="/local-santo/comprobantes" className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${pendingPaymentProofsCount > 0 ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] hover:bg-[var(--brand-accent-200)]" : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"}`}>
                    <UploadCloud size={16} />
                    Comprobantes{pendingPaymentProofsCount > 0 ? ` · ${pendingPaymentProofsCount}` : ""}
                  </a>
                  <button
                    type="button"
                    onClick={
                      soundControls.isSoundEnabled
                        ? soundControls.deactivateSound
                        : soundControls.activateSound
                    }
                    disabled={!soundControls.businessAllowsSound}
                    className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-55 ${
                      soundControls.isSoundEnabled
                        ? "border-green-600 bg-green-100 text-green-700 hover:bg-green-200"
                        : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                    }`}
                  >
                    {soundControls.isSoundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    {soundControls.isSoundEnabled
                      ? "Avisos permitidos"
                      : soundControls.businessAllowsSound
                        ? "Permitir avisos en este equipo"
                        : "Sonidos desactivados por configuración"}
                  </button>
                  <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]">
                    Cambiar de usuario
                  </button>
                </div>

                <p className="mt-4 text-xs font-black uppercase tracking-[0.32em] text-[var(--brand-primary)]">{BRAND.name}</p>
                <h1 className="mt-1 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">Módulo caja</h1>
                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Caja confirma pedidos, registra pagos y decide cuándo enviar a cocina. Cuando cocina marca listo, caja puede avisar la salida y cerrar la entrega.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-6 lg:w-[900px]">
                <MetricCard label="Pendientes" value={pendingPaymentCount} />
                <MetricCard label="Por revisar" value={pendingStaffReviewCount} tone={pendingStaffReviewCount > 0 ? "yellow" : "soft"} />
                <MetricCard label="Parciales" value={partialPaymentCount} tone="yellow" />
                <MetricCard label="Listos" value={readyCount} tone="soft" />
                <MetricCard label="Delivery" value={deliveryCount} tone="soft" />
                <MetricCard label="Comprobantes" value={pendingPaymentProofsCount} tone={pendingPaymentProofsCount > 0 ? "yellow" : "soft"} />
              </div>
            </div>
          </div>
        </header>

        {(pendingPaymentProofsCount > 0 || paymentProofsMessage) && (
          <section className={`mt-4 rounded-[1.4rem] border-2 p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)] ${pendingPaymentProofsCount > 0 ? "border-[var(--brand-primary)] bg-[var(--brand-accent-100)]" : "border-orange-400 bg-orange-100"}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  <UploadCloud size={18} />
                  Comprobantes de pago
                </p>
                {pendingPaymentProofsCount > 0 ? (
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                    Hay {pendingPaymentProofsCount} comprobante(s) por revisar.
                    {latestPendingPaymentProof
                      ? ` Último: ${latestPendingPaymentProof.customerName || "Cliente"} · Pedido ${latestPendingPaymentProof.orderId} · ${formatPaymentProofDate(latestPendingPaymentProof.createdAt)}.`
                      : ""}
                    Confirmar un comprobante no registra el cobro real; el pago se sigue guardando desde caja.
                  </p>
                ) : (
                  <p className="mt-2 text-sm font-bold leading-6 text-orange-900">
                    {paymentProofsMessage}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => loadPaymentProofs(adminPassword)} disabled={isLoadingPaymentProofs} className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-yellow-50 disabled:opacity-50">
                  {isLoadingPaymentProofs ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Revisar estado
                </button>
                <a href="/local-santo/comprobantes" className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)]">
                  Abrir comprobantes
                </a>
              </div>
            </div>
          </section>
        )}

        <section className="mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-3 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.08)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Mapa de mesas
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                Filtra caja por ubicación. Puedes ocultarlo cuando la caja necesite más espacio para cobrar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTablesMap((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
            >
              {showTablesMap ? <EyeOff size={17} /> : <Eye size={17} />}
              {showTablesMap ? "Ocultar mapa" : "Mostrar mapa"}
            </button>
          </div>

          {showTablesMap ? (
            <div className="mt-3">
              <LocalTablesMap
                tables={localTables}
                orders={orders}
                openAccounts={openAccounts}
                compact
                selectedTableName={selectedCashTableName}
                onSelectTable={(tableName) => {
                  setSelectedCashTableName(tableName)
                  setActiveFilter("Todos")
                  setSearchText("")
                }}
                onClearSelection={() => setSelectedCashTableName("")}
                title="Mapa de mesas para caja"
                description="Toca una mesa para filtrar caja por esa ubicación. Los cobros reales se siguen registrando desde las tarjetas de pedido."
              />
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
              Mapa oculto. Los pedidos y cobros siguen visibles abajo.
            </p>
          )}
        </section>

        <section className="mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-3 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.08)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                QR y enlaces por mesa
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                Se mantiene oculto por defecto para que no estorbe durante la operación diaria de caja.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowQrLinks((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
            >
              {showQrLinks ? <EyeOff size={17} /> : <Eye size={17} />}
              {showQrLinks ? "Ocultar QR" : "Mostrar QR"}
            </button>
          </div>

          {showQrLinks ? (
            <div className="mt-3">
              <LocalTableQrLinksPanel
                tables={localTables}
                compact
                title="QR y enlaces por mesa"
                description="Copia enlaces de mesa para imprimirlos como QR o enviarlos al cliente. Caja sigue registrando los cobros reales desde cada pedido."
              />
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
              QR ocultos. Usa “Mostrar QR” solo cuando necesites copiar, imprimir o revisar enlaces de mesa.
            </p>
          )}
        </section>


        <OpenAccountsPanel
          adminPassword={adminPassword}
          orders={orders as unknown as StoredLocalOrder[]}
          externalOpenAccounts={openAccounts}
          collapsible
          canManage
          canCloseAccounts
          canRegisterPayments
          canSplitBill={canSplitBill}
          compact
          title="Cuentas abiertas de caja"
          description="Revisa todo lo asociado a cada mesa, cobra la cuenta completa en un solo paso y ciérrala solo cuando la mesa termine."
          closeRoleLabel="Caja"
          tableOptions={localTables.map((table) => table.name)}
          preferredTableName={selectedCashTableName}
          onOrdersShouldRefresh={() => {
            loadOrders(adminPassword, true)
            loadOpenAccounts(adminPassword, true)
          }}
        />

        <section className="sticky top-0 z-30 mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-3 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Controles de caja
              </p>
              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                {filteredOrders.length} pedido(s) en pantalla · Pendiente visible {formatUSD(filteredPendingUSD)} · {activeFilter}
                {selectedCashTableName ? ` · Mesa: ${selectedCashTableName}` : ""}
                {searchText.trim() ? ` · Búsqueda: ${searchText.trim()}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { loadOrders(); loadOpenAccounts(adminPassword, true); loadLocalTables(); }} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50">
                {isLoading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                Actualizar
              </button>

              <button
                type="button"
                onClick={() => setShowControls((value) => !value)}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
              >
                {showControls ? <EyeOff size={17} /> : <Eye size={17} />}
                {showControls ? "Ocultar filtros" : "Mostrar filtros"}
              </button>
            </div>
          </div>

          {showControls ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]" />
                  <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Buscar por pedido, cliente, teléfono, mesa, zona o producto" className="w-full rounded-full border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-11 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]" />
                </div>
                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {selectedCashTableName && (
                    <button
                      type="button"
                      onClick={() => setSelectedCashTableName("")}
                      className="shrink-0 rounded-full border-2 border-yellow-500 bg-[var(--brand-accent-100)] px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                    >
                      Mesa: {selectedCashTableName} · limpiar
                    </button>
                  )}
                  {CASH_FILTERS.map((filter) => {
                    const isActive = activeFilter === filter
                    return (
                      <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full border-2 px-4 py-3 text-xs font-black uppercase tracking-[0.1em] transition ${isActive ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]" : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"}`}>
                        {filter}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <MiniMetric label="En pantalla" value={filteredOrders.length} />
                <MiniMetric label="Pendiente visible" value={formatUSD(filteredPendingUSD)} />
                <MiniMetric label="Filtro" value={activeFilter} />
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
              Filtros ocultos · {filteredOrders.length} pedido(s) en pantalla · Pendiente visible {formatUSD(filteredPendingUSD)} · {activeFilter}
              {selectedCashTableName ? ` · Mesa: ${selectedCashTableName}` : ""}
              {searchText.trim() ? ` · Búsqueda: ${searchText.trim()}` : ""}
            </div>
          )}

          {accountMessage && (
            <div className="mt-3 rounded-2xl border-2 border-green-600/35 bg-green-100 px-4 py-3">
              <p className="text-sm font-bold leading-6 text-green-800">{accountMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 rounded-2xl border-2 border-red-500/35 bg-red-100 px-4 py-3">
              <p className="text-sm font-bold leading-6 text-red-800">{errorMessage}</p>
            </div>
          )}
        </section>

        {filteredOrders.length === 0 ? (
          <section className="mt-5 rounded-[2rem] border-2 border-[var(--brand-primary)] bg-white px-6 py-14 text-center shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]">
            <Image src={BRAND.logoUrl || "/logoremovebg.png"} alt={BRAND.name} width={112} height={112} unoptimized className="mx-auto h-28 w-28 object-contain" />
            <h2 className="mt-5 text-3xl font-black uppercase text-[var(--brand-primary)]">Sin pedidos para caja</h2>
            <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">Cambia el filtro o espera nuevos pedidos.</p>
          </section>
        ) : (
          <section className="mt-5 grid gap-4 xl:grid-cols-2">
            {filteredOrders.map((order) => (
              <CashOrderCard
                key={order.id}
                order={order}
                paymentProofs={paymentProofs.filter(
                  (proof) => proof.orderId === order.id,
                )}
                onOpenPayment={() => openPaymentModal(order)}
                onSendToKitchen={() => updateStatus(order.id, "Preparando")}
                onMarkDelivered={() => updateStatus(order.id, "Entregado")}
                onCancelOrder={() => updateStatus(order.id, "Cancelado")}
                suggestedOpenAccount={findSuggestedOpenAccountForOrder(order, openAccounts)}
                onAttachToSuggestedOpenAccount={(account) => attachOrderToOpenAccount(order, account)}
                onConfirmStaffItems={() => confirmStaffItems(order)}
                onResetStaffItems={() => resetStaffItems(order)}
                isConfirmingStaff={confirmingStaffOrderId === order.id}
                isAttachingToOpenAccount={attachingOpenAccountOrderId === order.id}
                postSaleSurveyEnabled={postSaleSurvey.enabled}
                postSaleSurveyMessage={postSaleSurvey.message}
                googleReviewUrl={postSaleSurvey.reviewUrl}
              />
            ))}
          </section>
        )}
      </div>

      {paymentModalOrder && paymentDraft && (
        <ModalShell title="Registrar cobro" onClose={() => {
          if (!isSavingPayment) {
            setSelectedPaymentOrder(null)
            setPaymentForm(EMPTY_PAYMENT_FORM)
            setPaymentMessage(null)
          }
        }}>
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                {getDisplayOrderNumber(paymentModalOrder)} · {paymentModalOrder.customerName || "Cliente"}
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                Registra el dinero recibido por caja. El sistema calcula si queda pagado, parcial o pendiente.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoBox label="Total pedido" value={formatUSD(paymentDraft.totalOrderUSD)} />
              <InfoBox label="Recibido equiv." value={formatUSD(paymentDraft.receivedEquivalentUSD)} />
              <InfoBox label="Pendiente" value={formatUSD(paymentDraft.pendingUSD)} />
            </div>

            {paymentOpenAccount && (
              <div className="rounded-[1.4rem] border-2 border-green-600 bg-green-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-green-700">
                      <Link2 size={16} />
                      Pedido dentro de cuenta abierta
                    </p>
                    <p className="mt-2 text-sm font-bold leading-6 text-[#234000]">
                      Este cobro pertenece a la cuenta de {paymentOpenAccount.tableNumber || paymentModalOrder.tableNumber}. Caja está cobrando este pedido seleccionado, no cerrando la cuenta completa. El total de la cuenta se recalcula con los cobros reales guardados por pedido.
                    </p>
                  </div>
                  <div className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-green-600 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-green-700">
                    Cuenta activa
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <InfoBox label="Pedidos en cuenta" value={String(paymentOpenAccountOrderCount)} />
                  <InfoBox label="Total cuenta" value={formatUSD(paymentOpenAccountTotalBeforeDraft)} />
                  <InfoBox label="Cobrado al guardar" value={formatUSD(paymentOpenAccountCollectedAfterDraft)} />
                  <InfoBox label="Pendiente al guardar" value={formatUSD(paymentOpenAccountPendingAfterDraft)} />
                </div>

                <div className="mt-3 rounded-2xl border-2 border-yellow-500 bg-yellow-50 px-3 py-3 text-xs font-bold leading-5 text-[var(--brand-ink)]">
                  Cerrar la cuenta no registra cobro ni marca pedidos como pagados. Revisa el pendiente antes de cerrar administrativamente desde el panel de cuentas.
                </div>

                {Array.isArray(paymentOpenAccount.orders) && paymentOpenAccount.orders.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-green-600/25 bg-white px-3 py-3">
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-green-700">Pedidos asociados</p>
                    <div className="mt-2 space-y-1">
                      {paymentOpenAccount.orders.slice(0, 4).map((accountOrder) => (
                        <div key={accountOrder.id} className="flex items-center justify-between gap-3 text-xs font-black text-[#234000]">
                          <span>{accountOrder.displayNumber || accountOrder.id} · {accountOrder.status}</span>
                          <span>{formatUSD(Number(accountOrder.pendingUSD || 0))} pendiente</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {paymentDraft.status !== "Pagado" && (
              <div className="rounded-[1.4rem] border-2 border-yellow-400 bg-[var(--brand-accent-100)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-amber)]">Ayuda rápida</p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Pendiente actual: {formatUSD(paymentDraft.pendingUSD)}. En bolívares serían Bs {formatVES(pendingVESForPayment)} según la tasa del pedido.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={completePaymentPendingInVES} disabled={paymentDraft.pendingUSD <= 0 || paymentExchangeRate <= 0} className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50">Completar pendiente en Bs</button>
                  <button type="button" onClick={completePaymentPendingInUSD} disabled={paymentDraft.pendingUSD <= 0} className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50">Completar pendiente en divisas</button>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <InputBox label="Monto recibido en divisas" value={paymentForm.amountReceivedUSD} onChange={(value) => updatePaymentForm("amountReceivedUSD", value)} placeholder="Ej: 35.00" />
              <SelectBox label="Método en divisas" value={paymentForm.paymentMethodUSD} onChange={(value) => updatePaymentForm("paymentMethodUSD", value)} options={PAYMENT_METHOD_USD_OPTIONS} emptyLabel="Sin registrar" />
              <InputBox label="Monto recibido en bolívares reales" value={paymentForm.amountReceivedVES} onChange={(value) => updatePaymentForm("amountReceivedVES", value)} placeholder="Ej: 1569.25 o 1569,25" helper="Escribe el monto real en bolívares, no el equivalente en dólares." />
              <SelectBox label="Método en bolívares" value={paymentForm.paymentMethodVES} onChange={(value) => updatePaymentForm("paymentMethodVES", value)} options={PAYMENT_METHOD_VES_OPTIONS} emptyLabel="Sin registrar" />
            </div>

            <SelectBox label="Delivery pagado en" value={paymentForm.deliveryPaymentIn} onChange={(value) => updatePaymentForm("deliveryPaymentIn", value as DeliveryPaymentIn)} options={DELIVERY_PAYMENT_OPTIONS} />

            <div>
              <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">Nota de pago</label>
              <textarea value={paymentForm.paymentNote} onChange={(event) => updatePaymentForm("paymentNote", event.target.value)} placeholder="Ejemplo: Cliente pagó productos mixto y delivery por pago móvil." rows={4} className="mt-2 w-full resize-none rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]" />
            </div>

            {paymentMessage && (
              <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white px-4 py-3">
                <p className="text-sm font-black text-[var(--brand-ink-2)]">{paymentMessage}</p>
              </div>
            )}

            <button type="button" onClick={savePayment} disabled={isSavingPayment} className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50">
              {isSavingPayment && <Loader2 size={18} className="animate-spin" />}
              Guardar cobro
            </button>
          </div>
        </ModalShell>
      )}
    </main>
  )
}

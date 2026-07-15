"use client"

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { BRAND } from "@/lib/brand"
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock,
  ClipboardCopy,
  CookingPot,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  LogIn,
  MapPin,
  MessageCircle,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  CalendarClock,
  Truck,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react"
import { formatUSD, formatVES } from "@/utils/formatCurrency"
import { getModulePlanAccess, getShortPlanLabel } from "@/lib/localPlans"
import type { OpenAccount } from "@/types/localOrders"
import { FiscalSnapshotView } from "@/components/FiscalBreakdown"
import { LocalTableQrLinksPanel } from "@/components/local/LocalTableQrLinksPanel"
import {
  getOrderStaffConfirmationSummary,
  getStaffConfirmationStatusLabel,
  hasConfirmedStaffConfirmationItems,
  hasStaffConfirmationItems,
} from "@/lib/localOrderHelpers"

import type {
  OrderStatus,
  DeliveryPaymentIn,
  StatusFilter,
  PanelPaymentFilter,
  PanelOrderScopeFilter,
  PaymentForm,
  LocalOrder,
  NewOrderToast,
  DaySummaryTotals,
  PaymentSummaryTotals,
  FiscalIvaBucket,
  FiscalCloseTotals,
  ExpenseSummaryItem,
  CloseReviewItem,
  DayExpense,
  ExpenseForm,
  InventoryItemForExpense,
  ExpenseInventoryForm,
  ExpenseQuickConcept,
  PanelSoundKind,
  LocalAccessRole,
  LocalAccessData,
  PaymentProof,
  OpenAccountsApiResponse,
  BusinessConfig
} from "./domain"
import {
  LOCAL_ROLE_HOME_PATHS,
  LOCAL_ROLE_LABELS,
  isWorkerOnlyRole,
  ADMIN_STORAGE_KEY,
  LOCATIONS_STORAGE_KEY,
  SOUND_STORAGE_KEY,
  EXPENSE_CONCEPTS_STORAGE_KEY,
  CUSTOM_EXPENSE_CONCEPT_ID,
  DEFAULT_ORDER_LOCATIONS,
  DEFAULT_BUSINESS_CONFIG,
  DELIVERY_PAYMENT_OPTIONS,
  PAYMENT_METHOD_USD_OPTIONS,
  PAYMENT_METHOD_VES_OPTIONS,
  EMPTY_PAYMENT_FORM,
  filterOptions,
  panelPaymentFilterOptions,
  panelOrderScopeFilterOptions,
  EXPENSE_CATEGORIES,
  EXPENSE_TYPES,
  EXPENSE_METHODS,
  EMPTY_EXPENSE_FORM,
  EMPTY_EXPENSE_INVENTORY_FORM,
  EXPENSE_INVENTORY_UNIT_OPTIONS,
  DEFAULT_EXPENSE_QUICK_CONCEPTS,
  isComboItem,
  isDeliveryOrder,
  getDisplayOrderType,
  normalizeComparableText,
  getDefaultExpenseTypeFromCategory,
  createExpenseQuickConceptId,
  normalizeExpenseQuickConcepts,
  mergeExpenseQuickConceptsWithInventory,
  getDisplayTableNumber,
  getOrderTotals,
  roundMoney,
  parseMoneyInput,
  formatMoneyForInput,
  normalizePaymentMethodUSD,
  normalizePaymentMethodVES,
  getOrderPayment,
  getPaymentStatusStyle,
  createPaymentFormFromOrder,
  calculatePaymentDraft,
  createEmptySummaryTotals,
  addOrderToSummaryTotals,
  addOrderToSummaryMap,
  summaryMapToArray,
  addPaymentToSummaryMap,
  paymentSummaryMapToArray,
  getDeliveryPaymentLabel,
  readApiResponse,
  getPendingPaymentProofs,
  formatPaymentProofDate,
  formatDate,
  getDateKeyInCaracas,
  formatCaracasLongDate,
  getDisplayOrderNumber,
  getStatusStyle,
  getStatusIcon,
  getPrimaryAction,
  shouldShowAsActive,
  playPanelSoundWithContext,
  getProductsSoldFromOrders,
  normalizePhoneForWhatsApp,
  buildCourierHandoffText,
  buildDeliveryWhatsAppUrl,
  matchesPanelPaymentFilter,
  matchesPanelScopeFilter,
  matchesPanelSearch,
  normalizeDayExpense,
  normalizeInventoryItemForExpense,
  getExpenseEquivalentUSDFromForm,
  getActiveLocalTableNames,
  buildLocalTablesFromNames,
  isOpenAccountActive,
  getOpenAccountPendingUSD,
  getLocalTableOperationalSummary,
  getLocalTableStatusLabel,
  getLocalTableStatusClass,
  normalizeBusinessConfig,
  isBusinessModuleEffective
} from "./domain"
import {
  ModuleAccessCard,
  PanelMiniMetric,
  MetricCard,
  InfoBox,
  CloseDetailSection,
  ExpenseSummaryList,
  PaymentSummaryList,
  SummaryList,
  ProductGroup,
  getCloseReviewItemClasses,
  CloseReviewPanel,
  ModalShell
} from "./components"
import CurrentBranchBanner from "@/components/local/CurrentBranchBanner"
import PaymentProofAlertToast from "@/components/PaymentProofAlertToast"
import OrderCancellationAlertToast, {
  type CancelledOrderAlert,
} from "@/components/OrderCancellationAlertToast"
import OrderPaymentProofsList from "@/components/OrderPaymentProofsList"
import { usePaymentProofAlerts } from "@/hooks/usePaymentProofAlerts"
import { useStaffAlertsPush } from "@/hooks/useStaffAlertsPush"

export default function PedidosPage() {
  const [adminPassword, setAdminPassword] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [orders, setOrders] = useState<LocalOrder[]>([])
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("Activos")
  const [panelPaymentFilter, setPanelPaymentFilter] =
    useState<PanelPaymentFilter>("Todos los cobros")
  const [panelOrderScopeFilter, setPanelOrderScopeFilter] =
    useState<PanelOrderScopeFilter>("Todos los tipos")
  const [panelSearchText, setPanelSearchText] = useState("")
  const [arePanelFiltersVisible, setArePanelFiltersVisible] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [highlightedIds, setHighlightedIds] = useState<string[]>([])
  const [newOrderToast, setNewOrderToast] = useState<NewOrderToast | null>(null)
  // Alarma de anulación (dueño/gerencia): queda fija hasta que la cierren.
  const [cancelledOrderAlert, setCancelledOrderAlert] =
    useState<CancelledOrderAlert | null>(null)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [closeSummaryMessage, setCloseSummaryMessage] = useState<string | null>(
    null
  )
  // Pedido cuyo resumen para el repartidor se acaba de copiar (feedback breve).
  const [copiedCourierOrderId, setCopiedCourierOrderId] = useState("")
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [resetConfirmationText, setResetConfirmationText] = useState("")
  const [isResetReviewVisible, setIsResetReviewVisible] = useState(true)
  const [isResettingDay, setIsResettingDay] = useState(false)
  const [isLocationsModalOpen, setIsLocationsModalOpen] = useState(false)
  const [orderLocations, setOrderLocations] = useState<string[]>(
    DEFAULT_ORDER_LOCATIONS
  )
  const [newLocationName, setNewLocationName] = useState("")
  const [locationsMessage, setLocationsMessage] = useState<string | null>(null)
  const [isSavingLocations, setIsSavingLocations] = useState(false)
  const [selectedPaymentOrder, setSelectedPaymentOrder] =
    useState<LocalOrder | null>(null)
  const [paymentForm, setPaymentForm] =
    useState<PaymentForm>(EMPTY_PAYMENT_FORM)
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null)
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [updatingStaffConfirmationOrderId, setUpdatingStaffConfirmationOrderId] =
    useState<string | null>(null)

  const [dayExpenses, setDayExpenses] = useState<DayExpense[]>([])
  // Modo entrenamiento (global): mientras está activo, el panel ve pedidos de
  // práctica y los nuevos no afectan inventario/reportes/cierre.
  const [trainingActive, setTrainingActive] = useState(false)
  const [trainingAvailable, setTrainingAvailable] = useState(false)
  const [isSavingTraining, setIsSavingTraining] = useState(false)
  // Abonos a proveedores del día (compras): salida de caja para el cierre.
  const [supplierDayPayments, setSupplierDayPayments] = useState<
    { amountUSD: number; amountVES: number }[]
  >([])
  const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false)
  const [expenseForm, setExpenseForm] =
    useState<ExpenseForm>(EMPTY_EXPENSE_FORM)
  const [expenseMessage, setExpenseMessage] = useState<string | null>(null)
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false)
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const [areExpensesVisible, setAreExpensesVisible] = useState(true)
  const [expenseInventory, setExpenseInventory] = useState<InventoryItemForExpense[]>([])
  const [linkExpenseToInventory, setLinkExpenseToInventory] = useState(false)
  const [expenseInventoryForm, setExpenseInventoryForm] = useState<ExpenseInventoryForm>(
    EMPTY_EXPENSE_INVENTORY_FORM
  )
  const [isLoadingExpenseInventory, setIsLoadingExpenseInventory] = useState(false)
  const [expenseQuickConcepts, setExpenseQuickConcepts] = useState<ExpenseQuickConcept[]>(
    DEFAULT_EXPENSE_QUICK_CONCEPTS
  )
  const [selectedExpenseQuickConceptId, setSelectedExpenseQuickConceptId] = useState("")
  const [newExpenseQuickConceptName, setNewExpenseQuickConceptName] = useState("")
  const [newExpenseQuickConceptCategory, setNewExpenseQuickConceptCategory] =
    useState("Materia prima")
  const [newExpenseQuickConceptUnit, setNewExpenseQuickConceptUnit] =
    useState("unidades")
  const [newExpenseQuickConceptRelatedInventory, setNewExpenseQuickConceptRelatedInventory] =
    useState(true)

  const [businessConfig, setBusinessConfig] = useState<BusinessConfig>(
    DEFAULT_BUSINESS_CONFIG
  )
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([])
  const [paymentProofsMessage, setPaymentProofsMessage] = useState<string | null>(null)
  const [openAccounts, setOpenAccounts] = useState<OpenAccount[]>([])
  const [openAccountsMessage, setOpenAccountsMessage] = useState<string | null>(null)
  const [isLoadingBusinessConfig, setIsLoadingBusinessConfig] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [soundMessage, setSoundMessage] = useState<string | null>(null)
  const [localAccessRole, setLocalAccessRole] = useState<LocalAccessRole | null>(
    null
  )
  const [localAccessRoleLabel, setLocalAccessRoleLabel] = useState("")

  const knownOrderIdsRef = useRef<Set<string>>(new Set())
  const knownOrderStatusRef = useRef<Map<string, OrderStatus>>(new Map())
  const hasLoadedOnceRef = useRef(false)
  const pendingStatusRef = useRef<Map<string, OrderStatus>>(new Map())
  const businessConfigRef = useRef<BusinessConfig>(DEFAULT_BUSINESS_CONFIG)
  const soundEnabledRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  const isLoggedIn = adminPassword.length > 0

  // Aviso notorio cuando un cliente reporta un pago: sonido tipo caja
  // registradora + toast verde con acceso directo a la revisión.
  const paymentProofAlerts = usePaymentProofAlerts(paymentProofs, {
    enabled: isLoggedIn,
    onNewProof: () => playPanelSound("payment"),
  })

  // Push "pedido anulado" para este equipo (dueño/encargado): llega aunque
  // la app esté cerrada. El toast rojo del panel funciona sin esto.
  const staffAlertsPush = useStaffAlertsPush(adminPassword, isLoggedIn)

  function getPanelAudioContext() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext

      if (!AudioContextClass) return null

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass()
      }

      return audioContextRef.current
    } catch {
      return null
    }
  }

  function playPanelSound(kind: PanelSoundKind, force = false) {
    const config = businessConfigRef.current

    if (
      !force &&
      (!isBusinessModuleEffective(config, "sounds") ||
        !config.soundEnabled ||
        !soundEnabledRef.current)
    ) {
      return
    }

    try {
      const audioContext = getPanelAudioContext()

      if (!audioContext) return

      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => undefined)
      }

      playPanelSoundWithContext(audioContext, kind)
    } catch {
      setSoundMessage(
        "El navegador bloqueó el sonido. Pulsa Activar sonido desde el panel."
      )
    }
  }

  async function activatePanelSound() {
    if (!isBusinessModuleEffective(businessConfigRef.current, "sounds")) {
      setSoundMessage("Los avisos sonoros no están activos en este plan.")
      return
    }

    try {
      const audioContext = getPanelAudioContext()

      if (audioContext && audioContext.state === "suspended") {
        await audioContext.resume()
      }

      window.localStorage.setItem(SOUND_STORAGE_KEY, "true")
      setSoundEnabled(true)
      soundEnabledRef.current = true
      setSoundMessage("Avisos sonoros activos en este dispositivo.")
      playPanelSound("success", true)
    } catch {
      setSoundMessage(
        "No se pudo activar el sonido. Revisa permisos del navegador o vuelve a intentarlo."
      )
    }
  }

  function disablePanelSound() {
    window.localStorage.setItem(SOUND_STORAGE_KEY, "false")
    setSoundEnabled(false)
    soundEnabledRef.current = false
    setSoundMessage("Avisos sonoros pausados en este dispositivo.")
  }

  async function loadBusinessConfig(password = adminPassword, silent = false) {
    if (!password) return undefined

    if (!silent) {
      setIsLoadingBusinessConfig(true)
    }

    try {
      const response = await fetch("/api/business-config", {
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        if (response.status === 403) {
          return
        }

        throw new Error(
          data.error || "No se pudo cargar la configuración del negocio"
        )
      }

      const nextConfig = normalizeBusinessConfig(
        data.businessConfig || data.config || data
      )
      const savedSoundPreference = window.localStorage.getItem(SOUND_STORAGE_KEY)
      const nextSoundEnabled =
        savedSoundPreference === null
          ? nextConfig.soundEnabled
          : savedSoundPreference === "true"

      setBusinessConfig(nextConfig)
      businessConfigRef.current = nextConfig
      setOrderLocations(getActiveLocalTableNames(nextConfig.localTables))
      setSoundEnabled(nextConfig.soundEnabled && nextSoundEnabled)
      soundEnabledRef.current = nextConfig.soundEnabled && nextSoundEnabled
      setArePanelFiltersVisible(nextConfig.filtersOpenByDefault)

      if (!isBusinessModuleEffective(nextConfig, "expenses")) {
        setDayExpenses([])
        setIsExpensesModalOpen(false)
      }

      if (!isBusinessModuleEffective(nextConfig, "paymentProofs")) {
        setPaymentProofs([])
        setPaymentProofsMessage(null)
      }

      if (!isBusinessModuleEffective(nextConfig, "openAccounts")) {
        setOpenAccounts([])
        setOpenAccountsMessage(null)
      }

      setSoundMessage(null)

      return nextConfig
    } catch (error) {
      if (!silent) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar la configuración del negocio"
        )
      }
    } finally {
      if (!silent) {
        setIsLoadingBusinessConfig(false)
      }
    }
  }

  async function saveOrderLocations(nextLocations: string[], message?: string) {
    const cleanLocations = Array.from(
      new Set(
        nextLocations.map((location) => location.trim()).filter(Boolean)
      )
    )

    const finalLocations =
      cleanLocations.length > 0 ? cleanLocations : DEFAULT_ORDER_LOCATIONS
    const nextLocalTables = buildLocalTablesFromNames(
      finalLocations,
      businessConfigRef.current.localTables
    )
    const previousConfig = businessConfigRef.current
    const optimisticConfig = {
      ...previousConfig,
      localTables: nextLocalTables,
    }

    setIsSavingLocations(true)
    setOrderLocations(finalLocations)
    setBusinessConfig(optimisticConfig)
    businessConfigRef.current = optimisticConfig
    setLocationsMessage("Guardando mesas en configuración...")

    try {
      const response = await fetch("/api/business-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          businessConfig: {
            localTables: nextLocalTables,
          },
        }),
      })
      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron guardar las mesas")
      }

      const savedConfig = normalizeBusinessConfig(
        data.businessConfig || data.config || optimisticConfig
      )
      setBusinessConfig(savedConfig)
      businessConfigRef.current = savedConfig
      setOrderLocations(getActiveLocalTableNames(savedConfig.localTables))
      window.localStorage.setItem(
        LOCATIONS_STORAGE_KEY,
        JSON.stringify(getActiveLocalTableNames(savedConfig.localTables))
      )
      setLocationsMessage(message || "Mesas guardadas en configuración.")
    } catch (error) {
      setBusinessConfig(previousConfig)
      businessConfigRef.current = previousConfig
      setOrderLocations(getActiveLocalTableNames(previousConfig.localTables))
      setLocationsMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar las mesas"
      )
    } finally {
      setIsSavingLocations(false)
    }
  }

  async function addOrderLocation() {
    const nextLocation = newLocationName.trim()

    if (!nextLocation) {
      setLocationsMessage("Escribe el nombre de la mesa o ubicación.")
      return
    }

    const alreadyExists = orderLocations.some(
      (location) => normalizeComparableText(location) === normalizeComparableText(nextLocation)
    )

    if (alreadyExists) {
      setLocationsMessage("Esa mesa o ubicación ya existe.")
      return
    }

    await saveOrderLocations(
      [...orderLocations, nextLocation],
      "Mesa agregada y guardada correctamente."
    )
    setNewLocationName("")
  }

  async function removeOrderLocation(locationToRemove: string) {
    if (orderLocations.length <= 1) {
      setLocationsMessage("Debe quedar al menos una mesa o ubicación disponible.")
      return
    }

    await saveOrderLocations(
      orderLocations.filter((location) => location !== locationToRemove),
      "Mesa eliminada y guardada correctamente."
    )
  }

  async function restoreDefaultOrderLocations() {
    await saveOrderLocations(
      DEFAULT_ORDER_LOCATIONS,
      "Mesas base restauradas correctamente."
    )
    setNewLocationName("")
  }

  async function loadPaymentProofs(password = adminPassword, silent = false) {
    if (!password) return

    if (!isBusinessModuleEffective(businessConfigRef.current, "paymentProofs")) {
      setPaymentProofs([])
      setPaymentProofsMessage(null)
      return
    }

    try {
      const response = await fetch("/api/payment-proofs", {
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        if (response.status === 403) {
          setPaymentProofs([])
          setPaymentProofsMessage(null)
          return
        }

        throw new Error(data.error || "No se pudieron cargar los comprobantes")
      }

      setPaymentProofs(Array.isArray(data.paymentProofs) ? data.paymentProofs : [])
      setPaymentProofsMessage(null)
    } catch (error) {
      if (!silent) {
        setPaymentProofsMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los comprobantes"
        )
      }
    }
  }

  async function loadOpenAccounts(password = adminPassword, silent = true) {
    if (!password) return

    if (!isBusinessModuleEffective(businessConfigRef.current, "openAccounts")) {
      setOpenAccounts([])
      setOpenAccountsMessage(null)
      return
    }

    try {
      const response = await fetch("/api/open-accounts?status=all", {
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })

      const data = (await readApiResponse(response)) as OpenAccountsApiResponse

      if (!response.ok) {
        if (response.status === 403) {
          setOpenAccounts([])
          setOpenAccountsMessage(null)
          return
        }

        throw new Error(data.error || "No se pudieron cargar las cuentas abiertas")
      }

      setOpenAccounts(Array.isArray(data.openAccounts) ? data.openAccounts : [])
      setOpenAccountsMessage(null)
    } catch (error) {
      setOpenAccounts([])

      if (!silent) {
        setOpenAccountsMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las cuentas abiertas"
        )
      }
    }
  }

  // Abonos a proveedores del día (módulo Compras). Se cargan junto con los
  // gastos para que el cierre pueda restar las "salidas a proveedores".
  async function loadSupplierDayPayments(password = adminPassword) {
    if (!password) return

    if (!isBusinessModuleEffective(businessConfigRef.current, "supplierPurchases")) {
      setSupplierDayPayments([])
      return
    }

    try {
      const todayKey = getDateKeyInCaracas(new Date())
      const response = await fetch(
        `/api/supplier-purchases/payments?dateValue=${todayKey}`,
        { headers: { "x-admin-password": password }, cache: "no-store" },
      )

      if (!response.ok) {
        // No-fatal: si Compras está apagado o falla, el cierre sigue sin la línea.
        setSupplierDayPayments([])
        return
      }

      const data = await readApiResponse(response)
      const payments = Array.isArray(data.payments) ? data.payments : []
      setSupplierDayPayments(
        payments.map((payment: { amountUSD?: unknown; amountVES?: unknown }) => ({
          amountUSD: Number(payment.amountUSD) || 0,
          amountVES: Number(payment.amountVES) || 0,
        })),
      )
    } catch {
      setSupplierDayPayments([])
    }
  }

  async function loadDayExpenses(password = adminPassword, silent = false) {
    if (!password) return

    void loadSupplierDayPayments(password)

    if (!isBusinessModuleEffective(businessConfigRef.current, "expenses")) {
      setDayExpenses([])
      return
    }

    if (!silent) {
      setIsLoadingExpenses(true)
    }

    try {
      const todayKey = getDateKeyInCaracas(new Date())
      const response = await fetch(`/api/day-expenses?dateValue=${todayKey}`, {
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar los gastos del día")
      }

      const cleanExpenses = Array.isArray(data.dayExpenses)
        ? data.dayExpenses.map(normalizeDayExpense)
        : []

      setDayExpenses(cleanExpenses)
    } catch (error) {
      setExpenseMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los gastos del día"
      )
    } finally {
      if (!silent) {
        setIsLoadingExpenses(false)
      }
    }
  }

  async function setTrainingMode(active: boolean) {
    if (!adminPassword || isSavingTraining) return

    setIsSavingTraining(true)
    setErrorMessage(null)

    try {
      const response = await fetch("/api/business-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ businessConfig: { trainingModeActive: active } }),
      })
      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo cambiar el modo entrenamiento"
        )
      }

      if (data.businessConfig) {
        businessConfigRef.current = normalizeBusinessConfig(data.businessConfig)
      }

      setTrainingActive(active)
      // Recarga: la lista cambia entre pedidos reales y de práctica.
      await loadOrders(adminPassword, true)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar el modo entrenamiento"
      )
    } finally {
      setIsSavingTraining(false)
    }
  }

  async function loadOrders(password = adminPassword, silent = false) {
    if (!password) return

    if (!silent) {
      setIsLoading(true)
    }

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

      setTrainingActive(data.trainingModeActive === true)
      setTrainingAvailable(data.trainingModeAvailable === true)

      let nextOrders: LocalOrder[] = data.orders || []

      nextOrders = nextOrders.map((order) => {
        const pendingStatus = pendingStatusRef.current.get(order.id)

        if (!pendingStatus) return order

        return {
          ...order,
          status: pendingStatus,
        }
      })

      if (hasLoadedOnceRef.current) {
        const previousStatuses = knownOrderStatusRef.current
        const changedOrders = nextOrders.filter((order) => {
          const previousStatus = previousStatuses.get(order.id)

          return Boolean(previousStatus && previousStatus !== order.status)
        })

        const readyChange = changedOrders.find((order) => order.status === "Listo")
        const kitchenChange = changedOrders.find(
          (order) => order.status === "Preparando"
        )
        const deliveredChange = changedOrders.find(
          (order) => order.status === "Entregado"
        )

        // Alarma de anulación: toast rojo persistente + sonido de advertencia
        // para que gerencia/dueño lo vea sí o sí.
        const cancelledChange = changedOrders.find(
          (order) => order.status === "Cancelado"
        )

        if (cancelledChange) {
          const cancelledTotals = getOrderTotals(cancelledChange)

          setCancelledOrderAlert({
            orderId: cancelledChange.id,
            number: getDisplayOrderNumber(cancelledChange),
            customerName: cancelledChange.customerName || "Cliente",
            itemsSummary: (cancelledChange.items || [])
              .map(
                (item) =>
                  `${Math.max(1, Number(item.quantity || 1))}x ${item.name}`
              )
              .join(", "),
            totalUSD: cancelledTotals.totalUSD,
          })
          playPanelSound("warning")
        }

        if (readyChange) {
          playPanelSound("ready")
        } else if (kitchenChange) {
          playPanelSound("sent-kitchen")
        } else if (deliveredChange) {
          playPanelSound(isDeliveryOrder(deliveredChange) ? "delivery" : "success")
        }

        const currentIds = knownOrderIdsRef.current
        const newOrders = nextOrders.filter(
          (order) => order.status === "Nuevo" && !currentIds.has(order.id)
        )

        if (newOrders.length > 0) {
          const newIds = newOrders.map((order) => order.id)
          const newestOrder = newOrders[0]
          const newestOrderTotals = getOrderTotals(newestOrder)

          setHighlightedIds(newIds)
          setNewOrderToast({
            id: newestOrder.id,
            number: getDisplayOrderNumber(newestOrder),
            customerName: newestOrder.customerName || "Cliente",
            tableNumber: getDisplayTableNumber(newestOrder),
            totalUSD: newestOrderTotals.totalUSD,
            orderType: getDisplayOrderType(newestOrder),
          })
          playPanelSound("new-order")

          window.setTimeout(() => {
            setHighlightedIds([])
          }, 12000)

          window.setTimeout(() => {
            setNewOrderToast((currentToast) =>
              currentToast?.id === newestOrder.id ? null : currentToast
            )
          }, 10000)
        }
      }

      knownOrderIdsRef.current = new Set(nextOrders.map((order) => order.id))
      knownOrderStatusRef.current = new Map(
        nextOrders.map((order) => [order.id, order.status] as [string, OrderStatus])
      )
      hasLoadedOnceRef.current = true

      setOrders(nextOrders)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los pedidos"
      )
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }

  async function validateLocalAccess(password: string) {
    const response = await fetch("/api/local-auth?moduleKey=mainPanel", {
      headers: {
        "x-admin-password": password,
      },
      cache: "no-store",
    })

    const data = (await readApiResponse(response)) as LocalAccessData
    const role = data.access?.role || null
    const roleLabel =
      data.access?.roleLabel || (role ? LOCAL_ROLE_LABELS[role] : "")

    if (role) {
      setLocalAccessRole(role)
      setLocalAccessRoleLabel(roleLabel)
    }

    if (response.status === 401 || !role) {
      throw new Error(data.error || "Clave no autorizada")
    }

    return {
      role,
      roleLabel,
      allowed: Boolean(response.ok && data.ok && data.access?.allowed),
      error: data.error || "",
    }
  }

  function redirectWorkerRole(role: LocalAccessRole) {
    if (!isWorkerOnlyRole(role)) {
      return false
    }

    window.location.assign(LOCAL_ROLE_HOME_PATHS[role])
    return true
  }

  async function startLocalSession(password: string) {
    setErrorMessage(null)

    const access = await validateLocalAccess(password)

    window.sessionStorage.setItem(ADMIN_STORAGE_KEY, password)
    setAdminPassword(password)
    setPasswordInput(password)

    if (redirectWorkerRole(access.role)) {
      return
    }

    if (!access.allowed) {
      throw new Error(access.error || "Esta clave no tiene acceso al panel principal")
    }

    const loadedConfig = await loadBusinessConfig(password, true)
    const activeConfig = loadedConfig || businessConfigRef.current

    loadOrders(password)

    if (isBusinessModuleEffective(activeConfig, "openAccounts")) {
      loadOpenAccounts(password, true)
    } else {
      setOpenAccounts([])
      setOpenAccountsMessage(null)
    }

    if (isBusinessModuleEffective(activeConfig, "paymentProofs")) {
      loadPaymentProofs(password, true)
    } else {
      setPaymentProofs([])
      setPaymentProofsMessage(null)
    }

    if (isBusinessModuleEffective(activeConfig, "expenses")) {
      loadDayExpenses(password, true)
    } else {
      setDayExpenses([])
    }
  }

  async function handleLogin() {
    const password = passwordInput.trim()

    if (!password) return

    try {
      setIsLoading(true)
      await startLocalSession(password)
    } catch (error) {
      window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
      setAdminPassword("")
      setLocalAccessRole(null)
      setLocalAccessRoleLabel("")
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo validar la clave de acceso"
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleLogout() {
    window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
    setAdminPassword("")
    setPasswordInput("")
    setOrders([])
    setErrorMessage(null)
    setSelectedPaymentOrder(null)
    setPaymentForm(EMPTY_PAYMENT_FORM)
    setPaymentMessage(null)
    setDayExpenses([])
    setPaymentProofs([])
    setPaymentProofsMessage(null)
    setOpenAccounts([])
    setOpenAccountsMessage(null)
    setExpenseForm(EMPTY_EXPENSE_FORM)
    setExpenseMessage(null)
    setExpenseInventory([])
    setExpenseInventoryForm(EMPTY_EXPENSE_INVENTORY_FORM)
    setLinkExpenseToInventory(false)
    setIsExpensesModalOpen(false)
    setArePanelFiltersVisible(true)
    setBusinessConfig(DEFAULT_BUSINESS_CONFIG)
    setOrderLocations(DEFAULT_ORDER_LOCATIONS)
    setSoundMessage(null)
    setLocalAccessRole(null)
    setLocalAccessRoleLabel("")
    knownOrderIdsRef.current = new Set()
    knownOrderStatusRef.current = new Map()
    hasLoadedOnceRef.current = false
    pendingStatusRef.current = new Map()
    businessConfigRef.current = DEFAULT_BUSINESS_CONFIG
  }

  useEffect(() => {
    // Difiere la lectura de localStorage un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      try {
        const storedLocations = window.localStorage.getItem(LOCATIONS_STORAGE_KEY)

        if (!storedLocations) return

        const parsedLocations = JSON.parse(storedLocations)

        if (!Array.isArray(parsedLocations)) return

        const cleanLocations = parsedLocations
          .map((location) => String(location || "").trim())
          .filter(Boolean)

        if (cleanLocations.length > 0) {
          setOrderLocations(cleanLocations)
        }
      } catch {
        setOrderLocations(DEFAULT_ORDER_LOCATIONS)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedConcepts = window.localStorage.getItem(EXPENSE_CONCEPTS_STORAGE_KEY)

        if (!savedConcepts) {
          return
        }

        const parsedConcepts = JSON.parse(savedConcepts)
        const cleanConcepts = normalizeExpenseQuickConcepts(parsedConcepts)

        if (cleanConcepts.length > 0) {
          setExpenseQuickConcepts(cleanConcepts)
        }
      } catch {
        setExpenseQuickConcepts(DEFAULT_EXPENSE_QUICK_CONCEPTS)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    businessConfigRef.current = businessConfig

    const timer = setTimeout(() => {
      if (!isBusinessModuleEffective(businessConfig, "cashier")) {
        setPanelPaymentFilter("Todos los cobros")
      }

      if (!isBusinessModuleEffective(businessConfig, "delivery")) {
        setPanelOrderScopeFilter("Todos los tipos")
      }

      if (!isBusinessModuleEffective(businessConfig, "paymentProofs")) {
        setPaymentProofs([])
        setPaymentProofsMessage(null)
      }

      if (!isBusinessModuleEffective(businessConfig, "openAccounts")) {
        setOpenAccounts([])
        setOpenAccountsMessage(null)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [businessConfig])

  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedSoundPreference = window.localStorage.getItem(SOUND_STORAGE_KEY)

        if (savedSoundPreference !== null) {
          const isSoundEnabled = savedSoundPreference === "true"

          setSoundEnabled(isSoundEnabled)
          soundEnabledRef.current = isSoundEnabled
        }
      } catch {
        soundEnabledRef.current = false
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const restoreSession = useEffectEvent((savedPassword: string) => {
    startLocalSession(savedPassword).catch((error) => {
      window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
      setAdminPassword("")
      setPasswordInput("")
      setLocalAccessRole(null)
      setLocalAccessRoleLabel("")
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo restaurar el acceso privado"
      )
    })
  })

  useEffect(() => {
    const savedPassword = window.sessionStorage.getItem(ADMIN_STORAGE_KEY)

    if (!savedPassword) return

    const timer = setTimeout(() => restoreSession(savedPassword), 0)
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

  const refreshOpenAccountsTick = useEffectEvent(() => {
    loadOpenAccounts(adminPassword, true)
  })

  useEffect(() => {
    if (!adminPassword) return

    const interval = window.setInterval(refreshOpenAccountsTick, 8000)

    return () => {
      window.clearInterval(interval)
    }
  }, [adminPassword])

  const refreshProofsTick = useEffectEvent(() => {
    loadPaymentProofs(adminPassword, true)
  })

  useEffect(() => {
    if (!adminPassword) return

    const interval = window.setInterval(refreshProofsTick, 10000)

    return () => {
      window.clearInterval(interval)
    }
  }, [adminPassword])

  const filteredOrders = useMemo(() => {
    let nextOrders = orders

    if (activeFilter === "Activos") {
      nextOrders = nextOrders.filter(shouldShowAsActive)
    } else if (activeFilter !== "Todos") {
      nextOrders = nextOrders.filter((order) => order.status === activeFilter)
    }

    return nextOrders.filter(
      (order) =>
        matchesPanelPaymentFilter(order, panelPaymentFilter) &&
        matchesPanelScopeFilter(order, panelOrderScopeFilter) &&
        matchesPanelSearch(order, panelSearchText)
    )
  }, [activeFilter, orders, panelOrderScopeFilter, panelPaymentFilter, panelSearchText])

  const activeOrders = orders.filter(shouldShowAsActive)
  const newOrdersCount = orders.filter((order) => order.status === "Nuevo").length
  const readyOrdersCount = orders.filter((order) => order.status === "Listo").length
  const staffConfirmationPendingOrders = orders.filter(
    (order) => order.status !== "Cancelado" && hasStaffConfirmationItems(order)
  )
  const latestStaffConfirmationOrder = staffConfirmationPendingOrders[0] || null

  const totalRegistered = orders
    .filter((order) => order.status !== "Cancelado")
    .reduce((total, order) => total + getOrderTotals(order).totalUSD, 0)

  const isOwnerAccess = localAccessRole === "owner"
  const isManagerAccess = localAccessRole === "manager"
  const canUseOperationalPanel = isOwnerAccess || isManagerAccess
  const canEditSensitiveSettings = isOwnerAccess

  const planLabel = getShortPlanLabel(businessConfig.membershipPlan)
  const ownerDashboardAccess = getModulePlanAccess(businessConfig, "ownerDashboard")
  const cashierAccess = getModulePlanAccess(businessConfig, "cashier")
  const kitchenAccess = getModulePlanAccess(businessConfig, "kitchen")
  const deliveryAccess = getModulePlanAccess(businessConfig, "delivery")
  const historyAccess = getModulePlanAccess(businessConfig, "history")
  const expensesAccess = getModulePlanAccess(businessConfig, "expenses")
  const menuProductsAccess = getModulePlanAccess(
    businessConfig,
    "menuProducts"
  )
  const customersAccess = getModulePlanAccess(businessConfig, "customers")
  const inventoryAccess = getModulePlanAccess(businessConfig, "inventory")
  const paymentProofsAccess = getModulePlanAccess(businessConfig, "paymentProofs")
  const openAccountsAccess = getModulePlanAccess(businessConfig, "openAccounts")
  const advancedMenuAccess = getModulePlanAccess(businessConfig, "advancedMenu")
  const tablesAccess = getModulePlanAccess(businessConfig, "tables")
  const qrTablesAccess = getModulePlanAccess(businessConfig, "qrTables")
  const kitchenItemsAccess = getModulePlanAccess(businessConfig, "kitchenItems")
  const ticketsAccess = getModulePlanAccess(businessConfig, "tickets")
  const reportsAccess = getModulePlanAccess(businessConfig, "reports")
  const rolesAccess = getModulePlanAccess(businessConfig, "roles")
  const suppliersAccess = getModulePlanAccess(businessConfig, "suppliers")
  const reservationsAccess = getModulePlanAccess(businessConfig, "reservations")
  const soundsAccess = getModulePlanAccess(businessConfig, "sounds")
  const auditLogAccess = getModulePlanAccess(businessConfig, "auditLog")

  const canDeleteExpenses = isOwnerAccess && expensesAccess.effectiveEnabled

  const isOwnerDashboardModuleVisible =
    isOwnerAccess && ownerDashboardAccess.effectiveEnabled
  const isCashierModuleVisible =
    canUseOperationalPanel && cashierAccess.effectiveEnabled
  const isKitchenModuleVisible =
    canUseOperationalPanel && kitchenAccess.effectiveEnabled
  const isDeliveryModuleVisible =
    canUseOperationalPanel && deliveryAccess.effectiveEnabled
  const isHistoryModuleVisible =
    canUseOperationalPanel && historyAccess.effectiveEnabled
  const isExpensesModuleVisible =
    canUseOperationalPanel && expensesAccess.effectiveEnabled
  const isMenuProductsModuleVisible =
    isOwnerAccess && menuProductsAccess.effectiveEnabled
  const isCustomersModuleVisible =
    isOwnerAccess && customersAccess.effectiveEnabled
  const isInventoryModuleVisible =
    isOwnerAccess && inventoryAccess.effectiveEnabled
  const isPaymentProofsModuleVisible =
    canUseOperationalPanel && paymentProofsAccess.effectiveEnabled
  const isOpenAccountsModuleVisible =
    canUseOperationalPanel && openAccountsAccess.effectiveEnabled
  const isAdvancedMenuModuleVisible =
    isOwnerAccess && advancedMenuAccess.effectiveEnabled
  const isTablesModuleVisible =
    canUseOperationalPanel && (tablesAccess.effectiveEnabled || qrTablesAccess.effectiveEnabled)
  const isKitchenItemsModuleVisible =
    canUseOperationalPanel && kitchenItemsAccess.effectiveEnabled
  const isTicketsModuleVisible =
    canUseOperationalPanel && ticketsAccess.effectiveEnabled
  const isReportsModuleVisible =
    isOwnerAccess && reportsAccess.effectiveEnabled
  const isRolesModuleVisible =
    isOwnerAccess && rolesAccess.effectiveEnabled
  const isSuppliersModuleVisible =
    isOwnerAccess && suppliersAccess.effectiveEnabled
  const isReservationsModuleVisible =
    canUseOperationalPanel && reservationsAccess.effectiveEnabled
  const isBranchesModuleVisible = isOwnerAccess
  const isAuditLogModuleVisible =
    isOwnerAccess && auditLogAccess.effectiveEnabled
  const activeOpenAccounts = openAccounts.filter(isOpenAccountActive)
  const pendingOpenAccountsCount = activeOpenAccounts.filter(
    (account) => getOpenAccountPendingUSD(account) > 0
  ).length
  const pendingPaymentProofs = getPendingPaymentProofs(paymentProofs)
  const pendingPaymentProofsCount = pendingPaymentProofs.length
  const latestPendingPaymentProof = pendingPaymentProofs[0] || null
  const visibleOperationalModules = [
    isOwnerDashboardModuleVisible,
    isCashierModuleVisible,
    isKitchenModuleVisible,
    isDeliveryModuleVisible,
    isHistoryModuleVisible,
    isExpensesModuleVisible,
    isMenuProductsModuleVisible,
    isCustomersModuleVisible,
    isInventoryModuleVisible,
    isPaymentProofsModuleVisible,
    isOpenAccountsModuleVisible,
    isAdvancedMenuModuleVisible,
    isTablesModuleVisible,
    isKitchenItemsModuleVisible,
    isTicketsModuleVisible,
    isReportsModuleVisible,
    isRolesModuleVisible,
    isSuppliersModuleVisible,
    isReservationsModuleVisible,
    isBranchesModuleVisible,
  ].filter(Boolean).length
  const visibleOperationalModulesLimit = isOwnerAccess ? 20 : 10
  const isPanelSoundAvailable = soundsAccess.effectiveEnabled
  const isPanelSoundActive = isPanelSoundAvailable && soundEnabled

  const filteredPanelTotal = filteredOrders.reduce(
    (total, order) => total + getOrderTotals(order).totalUSD,
    0
  )
  const filteredPanelPending = filteredOrders.reduce(
    (total, order) => total + getOrderPayment(order).pendingUSD,
    0
  )
  const filteredPanelDeliveryCount = filteredOrders.filter(isDeliveryOrder).length
  const filteredPanelPaymentPendingCount = filteredOrders.filter(
    (order) => getOrderPayment(order).status !== "Pagado"
  ).length
  const filteredStaffConfirmationPendingCount = filteredOrders.filter(
    hasStaffConfirmationItems
  ).length
  const filteredStaffConfirmationConfirmedCount = filteredOrders.filter(
    (order) => !hasStaffConfirmationItems(order) && hasConfirmedStaffConfirmationItems(order)
  ).length


  const latestExpenseExchangeRate =
    orders.find((order) => Number(order.exchangeRate || 0) > 0)?.exchangeRate || 0

  const expenseDraftEquivalentUSD = getExpenseEquivalentUSDFromForm(
    expenseForm,
    Number(latestExpenseExchangeRate || 0)
  )

  const dayExpenseTotals = useMemo(() => {
    return dayExpenses.reduce(
      (totals, expense) => {
        totals.count += 1
        totals.amountUSD += roundMoney(expense.amountUSD)
        totals.amountVES += roundMoney(expense.amountVES)
        totals.equivalentUSD += roundMoney(expense.equivalentUSD)
        return totals
      },
      {
        count: 0,
        amountUSD: 0,
        amountVES: 0,
        equivalentUSD: 0,
      }
    )
  }, [dayExpenses])

  // Salidas a proveedores del día: suma de abonos (compras), con el equivalente
  // en USD calculado con la misma tasa que usa el resto del cierre.
  const supplierPaymentTotals = useMemo(() => {
    const rate = Number(latestExpenseExchangeRate || 0)
    return supplierDayPayments.reduce<{
      count: number
      amountUSD: number
      amountVES: number
      equivalentUSD: number
    }>(
      (totals, payment) => {
        const amountUSD = roundMoney(payment.amountUSD)
        const amountVES = roundMoney(payment.amountVES)
        totals.count += 1
        totals.amountUSD += amountUSD
        totals.amountVES += amountVES
        totals.equivalentUSD += roundMoney(
          amountUSD + (amountVES > 0 && rate > 0 ? amountVES / rate : 0)
        )
        return totals
      },
      { count: 0, amountUSD: 0, amountVES: 0, equivalentUSD: 0 }
    )
  }, [supplierDayPayments, latestExpenseExchangeRate])

  const expenseCloseBreakdown = useMemo(() => {
    const createSummary = (label: string): ExpenseSummaryItem => ({
      label,
      count: 0,
      totalUSD: 0,
      amountUSD: 0,
      amountVES: 0,
    })

    const addExpenseToMap = (
      map: Map<string, ExpenseSummaryItem>,
      label: string,
      expense: DayExpense
    ) => {
      const cleanLabel = String(label || "").trim() || "Sin registrar"
      const current = map.get(cleanLabel) || createSummary(cleanLabel)

      current.count += 1
      current.totalUSD = roundMoney(current.totalUSD + expense.equivalentUSD)
      current.amountUSD = roundMoney(current.amountUSD + expense.amountUSD)
      current.amountVES = roundMoney(current.amountVES + expense.amountVES)

      map.set(cleanLabel, current)
    }

    const toArray = (map: Map<string, ExpenseSummaryItem>) =>
      Array.from(map.values()).sort((a, b) => b.totalUSD - a.totalUSD)

    const byProvider = new Map<string, ExpenseSummaryItem>()
    const byType = new Map<string, ExpenseSummaryItem>()
    const byCategory = new Map<string, ExpenseSummaryItem>()
    const byMethod = new Map<string, ExpenseSummaryItem>()

    dayExpenses.forEach((expense) => {
      addExpenseToMap(byProvider, expense.provider || "Sin proveedor", expense)
      addExpenseToMap(byType, expense.expenseType || "Gasto operativo", expense)
      addExpenseToMap(byCategory, expense.category || "Otros", expense)
      addExpenseToMap(byMethod, expense.method || "Sin registrar", expense)
    })

    return {
      byProvider: toArray(byProvider),
      byType: toArray(byType),
      byCategory: toArray(byCategory),
      byMethod: toArray(byMethod),
      inventoryLinkedExpenses: dayExpenses.filter(
        (expense) => expense.inventoryLinked && expense.inventoryItemName
      ),
      expensesWithoutProvider: dayExpenses.filter(
        (expense) => !String(expense.provider || "").trim()
      ),
    }
  }, [dayExpenses])

  const dayStats = useMemo(() => {
    const today = new Date()
    const todayKey = getDateKeyInCaracas(today)
    const ordersToday = orders.filter(
      (order) => getDateKeyInCaracas(order.createdAt) === todayKey
    )

    const deliveredToday = ordersToday.filter(
      (order) => order.status === "Entregado"
    )

    const canceledToday = ordersToday.filter(
      (order) => order.status === "Cancelado"
    )

    const billableToday = ordersToday.filter(
      (order) => order.status !== "Cancelado"
    )

    const activeToday = ordersToday.filter(shouldShowAsActive)
    const deliveryToday = ordersToday.filter(isDeliveryOrder)
    const deliveredDeliveryToday = deliveredToday.filter(isDeliveryOrder)
    const activeDeliveryToday = activeToday.filter(isDeliveryOrder)

    const deliveredTotals = deliveredToday.reduce((totals, order) => {
      addOrderToSummaryTotals(totals, order)
      return totals
    }, createEmptySummaryTotals())

    const activeTotals = activeToday.reduce((totals, order) => {
      addOrderToSummaryTotals(totals, order)
      return totals
    }, createEmptySummaryTotals())

    const deliveredByTypeMap = new Map<string, DaySummaryTotals>()
    const deliveredByPaymentMap = new Map<string, DaySummaryTotals>()
    const deliveredByZoneMap = new Map<string, DaySummaryTotals>()

    deliveredToday.forEach((order) => {
      addOrderToSummaryMap(deliveredByTypeMap, getDisplayOrderType(order), order)

      if (isDeliveryOrder(order)) {
        addOrderToSummaryMap(
          deliveredByPaymentMap,
          getDeliveryPaymentLabel(order),
          order
        )
        addOrderToSummaryMap(
          deliveredByZoneMap,
          getDisplayTableNumber(order),
          order
        )
      }
    })

    const paymentByStatusMap = new Map<string, PaymentSummaryTotals>()
    const paymentByUSDMethodMap = new Map<string, PaymentSummaryTotals>()
    const paymentByVESMethodMap = new Map<string, PaymentSummaryTotals>()
    const deliveryByPaymentInMap = new Map<string, PaymentSummaryTotals>()
    // Ventas por vendedor: lo cobrado agrupado por quién registró el cobro y
    // los pedidos agrupados por quién los registró (cliente web = sin actor).
    const salesBySellerMap = new Map<string, PaymentSummaryTotals>()
    const ordersByRegistrarMap = new Map<string, DaySummaryTotals>()

    const fiscalMap = new Map<number, FiscalIvaBucket>()
    const fiscalTotalsRaw = billableToday.reduce(
      (totals, order) => {
        const fiscal = order.fiscal

        if (!fiscal) {
          return totals
        }

        totals.fiscalOrders += 1
        totals.fiscalSubtotalUSD += Number(fiscal.subtotalUSD || 0)
        totals.fiscalIvaTotalUSD += Number(fiscal.ivaTotalUSD || 0)
        totals.fiscalIgtfBaseUSD += Number(fiscal.igtfBaseUSD || 0)
        totals.fiscalIgtfUSD += Number(fiscal.igtfUSD || 0)
        totals.fiscalTotalUSD += Number(fiscal.totalUSD || 0)

        ;(fiscal.ivaByRate || []).forEach((bucket) => {
          const rate = Number(bucket.rate || 0)
          const current = fiscalMap.get(rate) || { rate, baseUSD: 0, ivaUSD: 0 }
          current.baseUSD += Number(bucket.baseUSD || 0)
          current.ivaUSD += Number(bucket.ivaUSD || 0)
          fiscalMap.set(rate, current)
        })

        return totals
      },
      {
        fiscalOrders: 0,
        fiscalSubtotalUSD: 0,
        fiscalIvaTotalUSD: 0,
        fiscalIgtfBaseUSD: 0,
        fiscalIgtfUSD: 0,
        fiscalTotalUSD: 0,
      }
    )

    const fiscalTotals: FiscalCloseTotals = {
      fiscalOrders: fiscalTotalsRaw.fiscalOrders,
      fiscalSubtotalUSD: roundMoney(fiscalTotalsRaw.fiscalSubtotalUSD),
      fiscalIvaTotalUSD: roundMoney(fiscalTotalsRaw.fiscalIvaTotalUSD),
      fiscalIgtfBaseUSD: roundMoney(fiscalTotalsRaw.fiscalIgtfBaseUSD),
      fiscalIgtfUSD: roundMoney(fiscalTotalsRaw.fiscalIgtfUSD),
      fiscalTotalUSD: roundMoney(fiscalTotalsRaw.fiscalTotalUSD),
      fiscalIvaByRate: Array.from(fiscalMap.values())
        .sort((a, b) => b.rate - a.rate)
        .map((bucket) => ({
          rate: bucket.rate,
          baseUSD: roundMoney(bucket.baseUSD),
          ivaUSD: roundMoney(bucket.ivaUSD),
        })),
    }

    const realPaymentTotals = billableToday.reduce(
      (totals, order) => {
        const orderTotals = getOrderTotals(order)
        const payment = getOrderPayment(order)
        const exchangeRate = Number(order.exchangeRate || 0)
        const amountReceivedVESEquivalentUSD =
          payment.amountReceivedVES > 0 && exchangeRate > 0
            ? payment.amountReceivedVES / exchangeRate
            : 0

        totals.totalSoldUSD += orderTotals.totalUSD
        totals.realCollectedUSD += payment.receivedEquivalentUSD
        totals.realCashUSD += payment.amountReceivedUSD
        totals.realVES += payment.amountReceivedVES
        totals.realVESEquivalentUSD += amountReceivedVESEquivalentUSD
        totals.realPendingUSD += payment.pendingUSD

        if (payment.status === "Pagado") {
          totals.paidOrders += 1
        } else if (payment.status === "Pago parcial") {
          totals.partialPaymentOrders += 1
        } else {
          totals.pendingPaymentOrders += 1
        }

        addPaymentToSummaryMap(
          paymentByStatusMap,
          payment.status,
          payment.receivedEquivalentUSD
        )

        addOrderToSummaryMap(
          ordersByRegistrarMap,
          order.registeredByName || "Cliente (web/QR)",
          order
        )

        if (payment.receivedEquivalentUSD > 0) {
          addPaymentToSummaryMap(
            salesBySellerMap,
            order.chargedByName || "Sin registrar",
            payment.receivedEquivalentUSD,
            payment.amountReceivedVES
          )
        }

        if (payment.amountReceivedUSD > 0) {
          addPaymentToSummaryMap(
            paymentByUSDMethodMap,
            normalizePaymentMethodUSD(payment.paymentMethodUSD) || "Divisas sin método",
            payment.amountReceivedUSD
          )
        }

        if (payment.amountReceivedVES > 0) {
          addPaymentToSummaryMap(
            paymentByVESMethodMap,
            normalizePaymentMethodVES(payment.paymentMethodVES) || "Bolívares sin método",
            amountReceivedVESEquivalentUSD,
            payment.amountReceivedVES
          )
        }

        if (isDeliveryOrder(order) && orderTotals.deliveryCostUSD > 0) {
          const deliveryCostVES = orderTotals.deliveryCostUSD * exchangeRate
          const hasRegisteredDeliveryPayment =
            payment.deliveryPaymentIn !== "Sin registrar" &&
            payment.receivedEquivalentUSD > 0

          totals.deliveryTotalRegisteredUSD += orderTotals.deliveryCostUSD

          if (hasRegisteredDeliveryPayment) {
            totals.deliveryWithPaymentMethodUSD += orderTotals.deliveryCostUSD

            addPaymentToSummaryMap(
              deliveryByPaymentInMap,
              payment.deliveryPaymentIn,
              orderTotals.deliveryCostUSD,
              payment.deliveryPaymentIn === "Bolívares" ? deliveryCostVES : 0,
              orderTotals.deliveryCostUSD
            )

            if (payment.deliveryPaymentIn === "Divisas") {
              totals.deliveryPaidInUSD += orderTotals.deliveryCostUSD
            } else if (payment.deliveryPaymentIn === "Bolívares") {
              totals.deliveryPaidInVES += deliveryCostVES
              totals.deliveryPaidInVESEquivalentUSD += orderTotals.deliveryCostUSD
            } else if (payment.deliveryPaymentIn === "Mixto") {
              totals.deliveryPaidMixedUSD += orderTotals.deliveryCostUSD
            }
          } else {
            totals.deliveryWithoutPaymentMethodUSD += orderTotals.deliveryCostUSD
          }
        }

        return totals
      },
      {
        totalSoldUSD: 0,
        realCollectedUSD: 0,
        realCashUSD: 0,
        realVES: 0,
        realVESEquivalentUSD: 0,
        realPendingUSD: 0,
        paidOrders: 0,
        partialPaymentOrders: 0,
        pendingPaymentOrders: 0,
        deliveryTotalRegisteredUSD: 0,
        deliveryWithPaymentMethodUSD: 0,
        deliveryWithoutPaymentMethodUSD: 0,
        deliveryPaidInUSD: 0,
        deliveryPaidInVES: 0,
        deliveryPaidInVESEquivalentUSD: 0,
        deliveryPaidMixedUSD: 0,
      }
    )

    realPaymentTotals.totalSoldUSD = roundMoney(realPaymentTotals.totalSoldUSD)
    realPaymentTotals.realCashUSD = roundMoney(realPaymentTotals.realCashUSD)
    realPaymentTotals.realVES = roundMoney(realPaymentTotals.realVES)
    realPaymentTotals.realVESEquivalentUSD = roundMoney(
      realPaymentTotals.realVESEquivalentUSD
    )
    realPaymentTotals.realCollectedUSD = roundMoney(
      realPaymentTotals.realCashUSD + realPaymentTotals.realVESEquivalentUSD
    )
    realPaymentTotals.realPendingUSD = roundMoney(
      Math.max(
        realPaymentTotals.realPendingUSD,
        realPaymentTotals.totalSoldUSD - realPaymentTotals.realCollectedUSD
      )
    )
    realPaymentTotals.deliveryTotalRegisteredUSD = roundMoney(
      realPaymentTotals.deliveryTotalRegisteredUSD
    )
    realPaymentTotals.deliveryWithPaymentMethodUSD = roundMoney(
      realPaymentTotals.deliveryWithPaymentMethodUSD
    )
    realPaymentTotals.deliveryWithoutPaymentMethodUSD = roundMoney(
      realPaymentTotals.deliveryWithoutPaymentMethodUSD
    )
    realPaymentTotals.deliveryPaidInUSD = roundMoney(
      realPaymentTotals.deliveryPaidInUSD
    )
    realPaymentTotals.deliveryPaidInVES = roundMoney(
      realPaymentTotals.deliveryPaidInVES
    )
    realPaymentTotals.deliveryPaidInVESEquivalentUSD = roundMoney(
      realPaymentTotals.deliveryPaidInVESEquivalentUSD
    )
    realPaymentTotals.deliveryPaidMixedUSD = roundMoney(
      realPaymentTotals.deliveryPaidMixedUSD
    )

    const productsSold = getProductsSoldFromOrders(deliveredToday)
    const topProduct = productsSold[0]

    return {
      dateLabel: formatCaracasLongDate(today),
      ordersToday,
      deliveredToday,
      canceledToday,
      billableToday,
      activeToday,
      deliveryToday,
      deliveredDeliveryToday,
      activeDeliveryToday,
      deliveredTotals,
      activeTotals,
      deliveredByType: summaryMapToArray(deliveredByTypeMap),
      deliveredByPayment: summaryMapToArray(deliveredByPaymentMap),
      deliveredByZone: summaryMapToArray(deliveredByZoneMap),
      realPaymentTotals,
      fiscalTotals,
      paymentByStatus: paymentSummaryMapToArray(paymentByStatusMap),
      paymentByUSDMethod: paymentSummaryMapToArray(paymentByUSDMethodMap),
      paymentByVESMethod: paymentSummaryMapToArray(paymentByVESMethodMap),
      deliveryByPaymentIn: paymentSummaryMapToArray(deliveryByPaymentInMap),
      salesBySeller: paymentSummaryMapToArray(salesBySellerMap),
      ordersByRegistrar: summaryMapToArray(ordersByRegistrarMap),
      productsSold,
      topProduct,
    }
  }, [orders])

  const closeSummaryText = useMemo(() => {
    const productLines =
      dayStats.productsSold.length > 0
        ? dayStats.productsSold.map((product) => {
            if (product.onlyCurrency) {
              return `- ${product.name} x${product.quantity} | ${formatUSD(
                product.totalUSD
              )} | Solo divisas`
            }

            return `- ${product.name} x${product.quantity} | ${formatUSD(
              product.totalUSD
            )} | Bs ${formatVES(product.totalVES)}`
          })
        : ["- Sin productos entregados"]

    const typeLines =
      dayStats.deliveredByType.length > 0
        ? dayStats.deliveredByType.map(
            (item) =>
              `- ${item.label}: ${item.count} pedido(s) | ${formatUSD(
                item.totalUSD
              )}`
          )
        : ["- Sin ventas confirmadas"]

    const paymentLines =
      dayStats.deliveredByPayment.length > 0
        ? dayStats.deliveredByPayment.map(
            (item) =>
              `- ${item.label}: ${item.count} delivery(s) | ${formatUSD(
                item.totalUSD
              )} | Delivery cobrado ${formatUSD(item.deliveryCostUSD)}`
          )
        : ["- Sin deliveries entregados"]

    const zoneLines =
      dayStats.deliveredByZone.length > 0
        ? dayStats.deliveredByZone.map(
            (item) =>
              `- ${item.label}: ${item.count} delivery(s) | ${formatUSD(
                item.totalUSD
              )} | Delivery cobrado ${formatUSD(item.deliveryCostUSD)}`
          )
        : ["- Sin deliveries entregados"]

    const paymentStatusLines =
      dayStats.paymentByStatus.length > 0
        ? dayStats.paymentByStatus.map(
            (item) =>
              `- ${item.label}: ${item.count} pedido(s) | Cobrado ${formatUSD(
                item.totalUSD
              )}`
          )
        : ["- Sin cobros registrados"]

    const sellerLines =
      dayStats.salesBySeller.length > 0
        ? dayStats.salesBySeller.map(
            (item) =>
              `- ${item.label}: ${item.count} cobro(s) | ${formatUSD(
                item.totalUSD
              )}${
                item.totalVES && item.totalVES > 0
                  ? ` | Bs ${formatVES(item.totalVES)}`
                  : ""
              }`
          )
        : ["- Sin cobros registrados"]

    const registrarLines =
      dayStats.ordersByRegistrar.length > 0
        ? dayStats.ordersByRegistrar.map(
            (item) =>
              `- ${item.label}: ${item.count} pedido(s) | ${formatUSD(
                item.totalUSD
              )}`
          )
        : ["- Sin pedidos registrados"]

    const usdMethodLines =
      dayStats.paymentByUSDMethod.length > 0
        ? dayStats.paymentByUSDMethod.map(
            (item) =>
              `- ${item.label}: ${item.count} pago(s) | ${formatUSD(
                item.totalUSD
              )}`
          )
        : ["- Sin divisas registradas"]

    const vesMethodLines =
      dayStats.paymentByVESMethod.length > 0
        ? dayStats.paymentByVESMethod.map(
            (item) =>
              `- ${item.label}: ${item.count} pago(s) | Bs ${formatVES(
                item.totalVES || 0
              )} | Equiv. ${formatUSD(item.totalUSD)}`
          )
        : ["- Sin bolívares registrados"]

    const deliveryRealLines =
      dayStats.deliveryByPaymentIn.length > 0
        ? dayStats.deliveryByPaymentIn.map(
            (item) =>
              `- ${item.label}: ${item.count} delivery(s) | ${formatUSD(
                item.deliveryCostUSD || item.totalUSD
              )}${
                item.totalVES && item.totalVES > 0
                  ? ` | Bs ${formatVES(item.totalVES)}`
                  : ""
              }`
          )
        : ["- Sin delivery marcado como cobrado"]

    const fiscalLines =
      dayStats.fiscalTotals.fiscalOrders > 0
        ? [
            `Pedidos con fiscal: ${dayStats.fiscalTotals.fiscalOrders}`,
            `Base imponible: ${formatUSD(dayStats.fiscalTotals.fiscalSubtotalUSD)}`,
            ...dayStats.fiscalTotals.fiscalIvaByRate.map((bucket) =>
              bucket.rate === 0
                ? `Exento 0%: base ${formatUSD(bucket.baseUSD)} | IVA ${formatUSD(bucket.ivaUSD)}`
                : `IVA ${bucket.rate}%: base ${formatUSD(bucket.baseUSD)} | IVA ${formatUSD(bucket.ivaUSD)}`
            ),
            `IVA total: ${formatUSD(dayStats.fiscalTotals.fiscalIvaTotalUSD)}`,
            `Base IGTF cobrada en divisas: ${formatUSD(dayStats.fiscalTotals.fiscalIgtfBaseUSD)}`,
            `IGTF cobrado: ${formatUSD(dayStats.fiscalTotals.fiscalIgtfUSD)}`,
            `Total fiscal con IGTF: ${formatUSD(dayStats.fiscalTotals.fiscalTotalUSD)}`,
          ]
        : ["- Sin desglose fiscal guardado en pedidos cobrados"]

    const expenseLines =
      dayExpenses.length > 0
        ? dayExpenses.map((expense) => {
            const parts = [
              `- ${expense.concept || "Gasto"}`,
              expense.expenseType || "Gasto operativo",
              expense.category || "Otros",
              expense.method || "Sin registrar",
              formatUSD(expense.equivalentUSD),
            ]

            if (expense.provider) {
              parts.push(`Proveedor: ${expense.provider}`)
            }

            if (expense.amountUSD > 0) {
              parts.push(`Divisas ${formatUSD(expense.amountUSD)}`)
            }

            if (expense.amountVES > 0) {
              parts.push(`Bs ${formatVES(expense.amountVES)}`)
            }

            if (expense.inventoryLinked && expense.inventoryItemName) {
              parts.push(
                `Inventario: ${expense.inventoryItemName} +${expense.inventoryQuantity || 0} ${expense.inventoryUnit || "unidades"}`
              )
            }

            if (expense.note) {
              parts.push(`Nota: ${expense.note}`)
            }

            return parts.join(" | ")
          })
        : ["- Sin gastos registrados"]

    const netEstimatedUSD = roundMoney(
      dayStats.realPaymentTotals.realCollectedUSD -
        dayExpenseTotals.equivalentUSD
    )

    return [
      "CIERRE DEL DÍA - SANTO PERRITO",
      `Fecha: ${dayStats.dateLabel}`,
      "",
      `Pedidos registrados: ${dayStats.ordersToday.length}`,
      `Pedidos activos: ${dayStats.activeToday.length}`,
      `Pedidos entregados: ${dayStats.deliveredToday.length}`,
      `Pedidos cancelados: ${dayStats.canceledToday.length}`,
      `Pedidos delivery registrados: ${dayStats.deliveryToday.length}`,
      `Pedidos delivery entregados: ${dayStats.deliveredDeliveryToday.length}`,
      `Pedidos delivery activos: ${dayStats.activeDeliveryToday.length}`,
      "",
      "COBROS REALES",
      `Total vendido registrado: ${formatUSD(dayStats.realPaymentTotals.totalSoldUSD)}`,
      `Total cobrado real: ${formatUSD(
        dayStats.realPaymentTotals.realCollectedUSD
      )}`,
      `Divisas recibidas: ${formatUSD(dayStats.realPaymentTotals.realCashUSD)}`,
      `Bolívares recibidos: Bs ${formatVES(
        dayStats.realPaymentTotals.realVES
      )} | Equiv. ${formatUSD(
        dayStats.realPaymentTotals.realVESEquivalentUSD
      )}`,
      `Pendiente de cobro: ${formatUSD(
        dayStats.realPaymentTotals.realPendingUSD
      )}`,
      `Pedidos pagados: ${dayStats.realPaymentTotals.paidOrders}`,
      `Pedidos con pago parcial: ${dayStats.realPaymentTotals.partialPaymentOrders}`,
      `Pedidos pendientes de pago: ${dayStats.realPaymentTotals.pendingPaymentOrders}`,
      "",
      "DESGLOSE FISCAL",
      ...fiscalLines,
      "",
      "GASTOS DEL DÍA",
      `Gastos registrados: ${dayExpenseTotals.count}`,
      `Total gastos estimado: ${formatUSD(dayExpenseTotals.equivalentUSD)}`,
      `Gastos en divisas: ${formatUSD(dayExpenseTotals.amountUSD)}`,
      `Gastos en bolívares: Bs ${formatVES(dayExpenseTotals.amountVES)}`,
      `Neto estimado del día: ${formatUSD(netEstimatedUSD)}`,
      ...expenseLines,
      "",
      "DELIVERY COBRADO REAL",
      `Delivery total registrado: ${formatUSD(
        dayStats.realPaymentTotals.deliveryTotalRegisteredUSD
      )}`,
      `Delivery con forma de cobro registrada: ${formatUSD(
        dayStats.realPaymentTotals.deliveryWithPaymentMethodUSD
      )}`,
      `Delivery sin forma de cobro registrada: ${formatUSD(
        dayStats.realPaymentTotals.deliveryWithoutPaymentMethodUSD
      )}`,
      `Delivery en divisas: ${formatUSD(
        dayStats.realPaymentTotals.deliveryPaidInUSD
      )}`,
      `Delivery en bolívares: Bs ${formatVES(
        dayStats.realPaymentTotals.deliveryPaidInVES
      )} | Equiv. ${formatUSD(
        dayStats.realPaymentTotals.deliveryPaidInVESEquivalentUSD
      )}`,
      `Delivery mixto marcado: ${formatUSD(
        dayStats.realPaymentTotals.deliveryPaidMixedUSD
      )}`,
      "",
      "VENTAS POR VENDEDOR (COBRADO POR)",
      ...sellerLines,
      "",
      "PEDIDOS POR REGISTRADOR",
      ...registrarLines,
      "",
      "COBROS POR ESTADO",
      ...paymentStatusLines,
      "",
      "COBROS EN DIVISAS",
      ...usdMethodLines,
      "",
      "COBROS EN BOLÍVARES",
      ...vesMethodLines,
      "",
      "DELIVERY POR FORMA DE COBRO REAL",
      ...deliveryRealLines,
      "",
      "VENTAS CONFIRMADAS POR ENTREGA",
      `Total general en divisas: ${formatUSD(dayStats.deliveredTotals.totalUSD)}`,
      `Venta de productos: ${formatUSD(
        dayStats.deliveredTotals.totalUSD -
          dayStats.deliveredTotals.deliveryCostUSD
      )}`,
      `Combos solo divisas: ${formatUSD(dayStats.deliveredTotals.totalCombosUSD)}`,
      `Productos normales: ${formatUSD(dayStats.deliveredTotals.totalRegularUSD)}`,
      `Referencia productos normales Bs: ${formatVES(
        dayStats.deliveredTotals.totalRegularVES
      )}`,
      `Delivery cobrado por entrega: ${formatUSD(dayStats.deliveredTotals.deliveryCostUSD)}`,
      "",
      "VENTAS POR TIPO",
      ...typeLines,
      "",
      "DELIVERY POR MÉTODO INDICADO EN PEDIDO",
      ...paymentLines,
      "",
      "DELIVERY POR ZONA",
      ...zoneLines,
      "",
      "PENDIENTE POR ENTREGAR",
      `Total pendiente en divisas: ${formatUSD(dayStats.activeTotals.totalUSD)}`,
      `Combos pendientes solo divisas: ${formatUSD(
        dayStats.activeTotals.totalCombosUSD
      )}`,
      `Productos normales pendientes: ${formatUSD(
        dayStats.activeTotals.totalRegularUSD
      )}`,
      `Referencia productos normales pendientes Bs: ${formatVES(
        dayStats.activeTotals.totalRegularVES
      )}`,
      `Delivery pendiente: ${formatUSD(dayStats.activeTotals.deliveryCostUSD)}`,
      "",
      "PRODUCTOS VENDIDOS",
      ...productLines,
    ].join("\n")
  }, [dayExpenseTotals, dayExpenses, dayStats])


  const closeReviewItems = useMemo<CloseReviewItem[]>(() => {
    const reviewItems: CloseReviewItem[] = []
    const totals = dayStats.realPaymentTotals
    const pendingPercent =
      totals.totalSoldUSD > 0
        ? Math.round((totals.realPendingUSD / totals.totalSoldUSD) * 100)
        : 0

    if (dayStats.ordersToday.length === 0) {
      reviewItems.push({
        title: "Sin pedidos para cerrar",
        description:
          "No hay pedidos registrados hoy. Si reinicias, solo se limpiará la pantalla sin guardar un cierre con ventas.",
        value: "0 pedido(s)",
        tone: "info",
      })
    }

    if (dayStats.activeToday.length > 0) {
      reviewItems.push({
        title: "Pedidos activos antes del cierre",
        description:
          "Hay pedidos que todavía no están entregados ni cancelados. Revisa si deben seguir activos, entregarse o cancelarse antes de reiniciar.",
        value: `${dayStats.activeToday.length} pedido(s)`,
        tone: "warning",
      })
    }

    if (totals.pendingPaymentOrders > 0) {
      reviewItems.push({
        title: "Pedidos pendientes de pago",
        description:
          "Hay pedidos sin cobro real registrado. Caja debería revisar estos pedidos antes de cerrar definitivamente.",
        value: `${totals.pendingPaymentOrders} pedido(s)`,
        tone: "danger",
      })
    }

    if (totals.partialPaymentOrders > 0) {
      reviewItems.push({
        title: "Pagos parciales detectados",
        description:
          "Hay pedidos con abono parcial. Conviene confirmar si el cliente completó el pago o si quedará pendiente.",
        value: `${totals.partialPaymentOrders} pedido(s)`,
        tone: "warning",
      })
    }

    if (totals.realPendingUSD > 0) {
      reviewItems.push({
        title: "Pendiente de cobro",
        description:
          "El cierre todavía tiene dinero pendiente por cobrar. Si cierras así, el historial guardará ese pendiente para revisión.",
        value: `${formatUSD(totals.realPendingUSD)} · ${pendingPercent}%`,
        tone: pendingPercent >= 25 ? "danger" : "warning",
      })
    }

    if (totals.deliveryWithoutPaymentMethodUSD > 0) {
      reviewItems.push({
        title: "Delivery sin forma de cobro",
        description:
          "Hay costos de delivery registrados, pero sin indicar si se cobraron en divisas, bolívares o mixto.",
        value: formatUSD(totals.deliveryWithoutPaymentMethodUSD),
        tone: "warning",
      })
    }

    if (dayStats.activeDeliveryToday.length > 0) {
      reviewItems.push({
        title: "Delivery activo",
        description:
          "Hay pedidos delivery que todavía aparecen activos. Revisa si ya fueron entregados, cancelados o siguen pendientes.",
        value: `${dayStats.activeDeliveryToday.length} delivery(s)`,
        tone: "warning",
      })
    }

    const usdWithoutMethod = dayStats.paymentByUSDMethod.find(
      (item) => normalizeComparableText(item.label) === "divisas sin metodo"
    )

    if (usdWithoutMethod && usdWithoutMethod.totalUSD > 0) {
      reviewItems.push({
        title: "Divisas sin método",
        description:
          "Hay divisas cobradas, pero no se indicó si fueron efectivo, Zelle, Binance / USDT u otro método.",
        value: formatUSD(usdWithoutMethod.totalUSD),
        tone: "warning",
      })
    }

    const vesWithoutMethod = dayStats.paymentByVESMethod.find(
      (item) => normalizeComparableText(item.label) === "bolivares sin metodo"
    )

    const vesWithoutMethodTotalVES = vesWithoutMethod?.totalVES || 0

    if (vesWithoutMethodTotalVES > 0) {
      reviewItems.push({
        title: "Bolívares sin método",
        description:
          "Hay bolívares cobrados, pero no se indicó si fueron pago móvil, punto, transferencia, efectivo Bs u otro método.",
        value: `Bs ${formatVES(vesWithoutMethodTotalVES)}`,
        tone: "warning",
      })
    }

    if (
      totals.totalSoldUSD > 0 &&
      dayStats.deliveredToday.length === 0 &&
      dayStats.activeToday.length > 0
    ) {
      reviewItems.push({
        title: "Ventas con pedidos no entregados",
        description:
          "Hay venta registrada, pero ningún pedido aparece entregado. Puede ser normal si todavía están activos, pero conviene revisarlo.",
        value: `${dayStats.activeToday.length} activo(s)`,
        tone: "warning",
      })
    }

    if (dayExpenseTotals.equivalentUSD > 0) {
      const netEstimatedUSD = roundMoney(
        totals.realCollectedUSD - dayExpenseTotals.equivalentUSD
      )

      reviewItems.push({
        title: "Gastos registrados en el día",
        description:
          "Estos gastos se incluirán en el resumen guardado para calcular el neto estimado del cierre.",
        value: `${formatUSD(dayExpenseTotals.equivalentUSD)} · Neto ${formatUSD(
          netEstimatedUSD
        )}`,
        tone: netEstimatedUSD < 0 ? "warning" : "info",
      })
    }

    if (
      reviewItems.length === 0 ||
      reviewItems.every((item) => item.tone === "info")
    ) {
      reviewItems.push({
        title: "Cierre limpio",
        description:
          "No se detectaron pendientes, pagos parciales ni delivery sin forma de cobro. El cierre parece listo para guardarse.",
        value: "Sin alertas",
        tone: "success",
      })
    }

    return reviewItems
  }, [dayExpenseTotals, dayStats])

  const hasCloseReviewWarnings = closeReviewItems.some(
    (item) => item.tone === "danger" || item.tone === "warning"
  )

  async function copyCloseSummary() {
    try {
      await navigator.clipboard.writeText(closeSummaryText)
      setCloseSummaryMessage("Resumen copiado correctamente.")
    } catch {
      setCloseSummaryMessage("No se pudo copiar automáticamente.")
    }
  }

  // Copia en un toque los datos del pedido para pasárselos al repartidor:
  // teléfono, link de la dirección y resumen corto de qué lleva.
  async function copyCourierHandoff(order: LocalOrder) {
    try {
      await navigator.clipboard.writeText(buildCourierHandoffText(order))
      setCopiedCourierOrderId(order.id)
      window.setTimeout(() => {
        setCopiedCourierOrderId((current) =>
          current === order.id ? "" : current,
        )
      }, 2500)
    } catch {
      // Sin permiso de portapapeles: el staff puede copiar manualmente de la
      // tarjeta, que muestra los mismos datos.
    }
  }

  function buildDayClosePayload() {
    return {
      id: `CIE-${Date.now()}`,
      createdAt: new Date().toISOString(),
      dateLabel: dayStats.dateLabel,
      summaryText: closeSummaryText,

      ordersRegistered: dayStats.ordersToday.length,
      activeOrders: dayStats.activeToday.length,
      deliveredOrders: dayStats.deliveredToday.length,
      canceledOrders: dayStats.canceledToday.length,
      deliveryRegistered: dayStats.deliveryToday.length,
      deliveryDelivered: dayStats.deliveredDeliveryToday.length,
      deliveryActive: dayStats.activeDeliveryToday.length,

      totalConfirmedUSD: dayStats.deliveredTotals.totalUSD,
      productSalesUSD:
        dayStats.deliveredTotals.totalUSD -
        dayStats.deliveredTotals.deliveryCostUSD,
      combosUSD: dayStats.deliveredTotals.totalCombosUSD,
      regularUSD: dayStats.deliveredTotals.totalRegularUSD,
      regularVES: dayStats.deliveredTotals.totalRegularVES,
      deliveryCollectedUSD: dayStats.deliveredTotals.deliveryCostUSD,

      pendingTotalUSD: dayStats.activeTotals.totalUSD,
      pendingCombosUSD: dayStats.activeTotals.totalCombosUSD,
      pendingRegularUSD: dayStats.activeTotals.totalRegularUSD,
      pendingRegularVES: dayStats.activeTotals.totalRegularVES,
      pendingDeliveryUSD: dayStats.activeTotals.deliveryCostUSD,

      totalSoldUSD: dayStats.realPaymentTotals.totalSoldUSD,
      realCollectedUSD: dayStats.realPaymentTotals.realCollectedUSD,
      realCashUSD: dayStats.realPaymentTotals.realCashUSD,
      realVES: dayStats.realPaymentTotals.realVES,
      realVESEquivalentUSD: dayStats.realPaymentTotals.realVESEquivalentUSD,
      realPendingUSD: dayStats.realPaymentTotals.realPendingUSD,
      paidOrders: dayStats.realPaymentTotals.paidOrders,
      partialPaymentOrders: dayStats.realPaymentTotals.partialPaymentOrders,
      pendingPaymentOrders: dayStats.realPaymentTotals.pendingPaymentOrders,
      deliveryTotalRegisteredUSD:
        dayStats.realPaymentTotals.deliveryTotalRegisteredUSD,
      deliveryWithPaymentMethodUSD:
        dayStats.realPaymentTotals.deliveryWithPaymentMethodUSD,
      deliveryWithoutPaymentMethodUSD:
        dayStats.realPaymentTotals.deliveryWithoutPaymentMethodUSD,
      deliveryPaidInUSD: dayStats.realPaymentTotals.deliveryPaidInUSD,
      deliveryPaidInVES: dayStats.realPaymentTotals.deliveryPaidInVES,
      deliveryPaidInVESEquivalentUSD:
        dayStats.realPaymentTotals.deliveryPaidInVESEquivalentUSD,
      deliveryPaidMixedUSD: dayStats.realPaymentTotals.deliveryPaidMixedUSD,

      fiscalOrders: dayStats.fiscalTotals.fiscalOrders,
      fiscalSubtotalUSD: dayStats.fiscalTotals.fiscalSubtotalUSD,
      fiscalIvaTotalUSD: dayStats.fiscalTotals.fiscalIvaTotalUSD,
      fiscalIgtfBaseUSD: dayStats.fiscalTotals.fiscalIgtfBaseUSD,
      fiscalIgtfUSD: dayStats.fiscalTotals.fiscalIgtfUSD,
      fiscalTotalUSD: dayStats.fiscalTotals.fiscalTotalUSD,
      fiscalIvaByRate: dayStats.fiscalTotals.fiscalIvaByRate,

      expensesCount: dayExpenseTotals.count,
      expensesTotalUSD: dayExpenseTotals.equivalentUSD,
      expensesCashUSD: dayExpenseTotals.amountUSD,
      expensesVES: dayExpenseTotals.amountVES,
      expensesVESEquivalentUSD: roundMoney(
        Math.max(dayExpenseTotals.equivalentUSD - dayExpenseTotals.amountUSD, 0)
      ),
      netEstimatedUSD: roundMoney(
        dayStats.realPaymentTotals.realCollectedUSD -
          dayExpenseTotals.equivalentUSD
      ),

      supplierPaymentsCount: supplierPaymentTotals.count,
      supplierPaymentsUSD: supplierPaymentTotals.amountUSD,
      supplierPaymentsVES: supplierPaymentTotals.amountVES,
      supplierPaymentsEquivalentUSD: supplierPaymentTotals.equivalentUSD,
      netAfterPurchasesUSD: roundMoney(
        dayStats.realPaymentTotals.realCollectedUSD -
          dayExpenseTotals.equivalentUSD -
          supplierPaymentTotals.equivalentUSD
      ),
      expenses: dayExpenses.map((expense) => ({
        id: expense.id,
        dateLabel: expense.dateLabel,
        dateValue: expense.dateValue,
        concept: expense.concept,
        category: expense.category,
        amountUSD: expense.amountUSD,
        amountVES: expense.amountVES,
        equivalentUSD: expense.equivalentUSD,
        method: expense.method,
        note: expense.note,
        createdAt: expense.createdAt,
        provider: expense.provider || "",
        expenseType: expense.expenseType || "Gasto operativo",
        inventoryLinked: Boolean(expense.inventoryLinked),
        inventoryItemId: expense.inventoryItemId || "",
        inventoryItemName: expense.inventoryItemName || "",
        inventoryQuantity: expense.inventoryQuantity || 0,
        inventoryUnit: expense.inventoryUnit || "unidades",
      })),

      salesByType: dayStats.deliveredByType,
      deliveryByPayment: dayStats.deliveredByPayment,
      deliveryByZone: dayStats.deliveredByZone,
      paymentByStatus: dayStats.paymentByStatus,
      paymentByUSDMethod: dayStats.paymentByUSDMethod,
      paymentByVESMethod: dayStats.paymentByVESMethod,
      deliveryByPaymentIn: dayStats.deliveryByPaymentIn,
      salesBySeller: dayStats.salesBySeller,
      ordersByRegistrar: dayStats.ordersByRegistrar,
      productsSold: dayStats.productsSold,
    }
  }

  async function resetDayOrders() {
    if (!adminPassword) return

    if (resetConfirmationText.trim().toUpperCase() !== "REINICIAR") {
      setErrorMessage("Debes escribir REINICIAR para confirmar el reinicio.")
      return
    }

    try {
      setIsResettingDay(true)
      setErrorMessage(null)

      const shouldSaveDayClose = dayStats.ordersToday.length > 0 || dayExpenseTotals.count > 0

      if (shouldSaveDayClose) {
        const closeResponse = await fetch("/api/day-close", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({
            dayClose: buildDayClosePayload(),
          }),
        })

        const closeData = await readApiResponse(closeResponse)

        if (!closeResponse.ok) {
          throw new Error(
            closeData.error || "No se pudo guardar el cierre del día"
          )
        }
      }

      const response = await fetch("/api/orders", {
        method: "DELETE",
        headers: {
          "x-admin-password": adminPassword,
        },
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron reiniciar los pedidos")
      }

      pendingStatusRef.current = new Map()
      knownOrderIdsRef.current = new Set()
      knownOrderStatusRef.current = new Map()
      hasLoadedOnceRef.current = false

      setOrders([])
      setHighlightedIds([])
      setNewOrderToast(null)
      setDayExpenses([])
      setResetConfirmationText("")
      setIsResetModalOpen(false)
      setIsCloseModalOpen(false)
      setCloseSummaryMessage(
        shouldSaveDayClose
          ? `Cierre guardado y ${
              data.message || "pedidos reiniciados correctamente."
            }`
          : data.message || "Pedidos reiniciados correctamente."
      )

      await loadOrders(adminPassword, true)
      await loadDayExpenses(adminPassword, true)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron reiniciar los pedidos"
      )
    } finally {
      setIsResettingDay(false)
    }
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    if (!adminPassword) return

    const previousOrder = orders.find((order) => order.id === orderId)
    const requestedStatus = status

    setErrorMessage(null)
    pendingStatusRef.current.set(orderId, requestedStatus)

    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: requestedStatus,
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
          status: requestedStatus,
        }),
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo actualizar el pedido")
      }

      if (requestedStatus === "Preparando") {
        playPanelSound("sent-kitchen")
      } else if (requestedStatus === "Listo") {
        playPanelSound("ready")
      } else if (requestedStatus === "Entregado") {
        playPanelSound(previousOrder && isDeliveryOrder(previousOrder) ? "delivery" : "success")
      } else if (requestedStatus === "Cancelado") {
        playPanelSound("warning")
      }

      window.setTimeout(() => {
        if (pendingStatusRef.current.get(orderId) === requestedStatus) {
          pendingStatusRef.current.delete(orderId)
        }

        loadOrders(adminPassword, true)
        loadOpenAccounts(adminPassword, true)
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

  async function updateStaffConfirmation(
    order: LocalOrder,
    action: "confirmStaffItems" | "resetStaffItems"
  ) {
    if (!adminPassword || updatingStaffConfirmationOrderId) return

    try {
      setUpdatingStaffConfirmationOrderId(order.id)
      setErrorMessage(null)

      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          action,
        }),
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(
          data.error ||
            (action === "confirmStaffItems"
              ? "No se pudo confirmar la revisión"
              : "No se pudo reabrir la revisión")
        )
      }

      const updatedOrder = data.order as LocalOrder

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder
        )
      )

      playPanelSound(action === "confirmStaffItems" ? "success" : "warning")

      window.setTimeout(() => {
        loadOrders(adminPassword, true)
      }, 600)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : action === "confirmStaffItems"
            ? "No se pudo confirmar la revisión"
            : "No se pudo reabrir la revisión"
      )
    } finally {
      setUpdatingStaffConfirmationOrderId(null)
    }
  }

  function openPaymentModal(order: LocalOrder) {
    setSelectedPaymentOrder(order)
    setPaymentForm(createPaymentFormFromOrder(order))
    setPaymentMessage(null)
  }

  function updatePaymentForm<K extends keyof PaymentForm>(
    field: K,
    value: PaymentForm[K]
  ) {
    setPaymentForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setPaymentMessage(null)
  }

  async function savePayment() {
    if (!adminPassword || !selectedPaymentOrder) return

    if (!isBusinessModuleEffective(businessConfigRef.current, "cashier")) {
      setPaymentMessage("Caja no está activa en este plan.")
      return
    }

    try {
      setIsSavingPayment(true)
      setPaymentMessage(null)
      setErrorMessage(null)

      const response = await fetch(
        `/api/orders/${selectedPaymentOrder.id}/payment`,
        {
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
            deliveryPaymentIn: isDeliveryOrder(selectedPaymentOrder)
              ? paymentForm.deliveryPaymentIn
              : "Sin registrar",
            paymentNote: paymentForm.paymentNote,
          }),
        }
      )

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo registrar el cobro")
      }

      const updatedOrder = data.order as LocalOrder

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === updatedOrder.id ? updatedOrder : order
        )
      )
      setSelectedPaymentOrder(updatedOrder)
      setPaymentForm(createPaymentFormFromOrder(updatedOrder))
      setPaymentMessage("Cobro registrado correctamente.")

      window.setTimeout(() => {
        loadOrders(adminPassword, true)
        loadOpenAccounts(adminPassword, true)
      }, 600)
    } catch (error) {
      setPaymentMessage(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el cobro"
      )
    } finally {
      setIsSavingPayment(false)
    }
  }


  function updateExpenseForm<K extends keyof ExpenseForm>(
    field: K,
    value: ExpenseForm[K]
  ) {
    setExpenseForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setExpenseMessage(null)
  }

  function resetExpenseForm() {
    setExpenseForm(EMPTY_EXPENSE_FORM)
    setExpenseInventoryForm(EMPTY_EXPENSE_INVENTORY_FORM)
    setLinkExpenseToInventory(false)
    setSelectedExpenseQuickConceptId("")
    setExpenseMessage(null)
  }

  function saveExpenseQuickConcepts(nextConcepts: ExpenseQuickConcept[]) {
    const cleanConcepts = normalizeExpenseQuickConcepts(nextConcepts)

    setExpenseQuickConcepts(cleanConcepts)

    try {
      window.localStorage.setItem(
        EXPENSE_CONCEPTS_STORAGE_KEY,
        JSON.stringify(cleanConcepts)
      )
    } catch {
      setExpenseMessage(
        "La lista se actualizó en pantalla, pero el navegador no permitió guardarla en este dispositivo."
      )
    }

    return cleanConcepts
  }

  function resetExpenseQuickConcepts() {
    saveExpenseQuickConcepts(DEFAULT_EXPENSE_QUICK_CONCEPTS)
    setSelectedExpenseQuickConceptId("")
    setExpenseMessage("Lista de conceptos frecuentes restaurada.")
  }

  function applyExpenseQuickConcept(concept: ExpenseQuickConcept) {
    setExpenseForm((currentForm) => ({
      ...currentForm,
      concept: concept.name,
      category: concept.category || currentForm.category,
      expenseType: getDefaultExpenseTypeFromCategory(
        concept.category || currentForm.category,
        concept.relatedInventory
      ),
    }))

    if (concept.relatedInventory && isInventoryModuleVisible) {
      setLinkExpenseToInventory(true)
      setExpenseInventoryForm((currentForm) => ({
        ...currentForm,
        mode: "new",
        itemId: "",
        name: concept.name,
        category: concept.category || "Materia prima",
        unit: concept.unit || "unidades",
      }))

      loadExpenseInventory(true).then((items: InventoryItemForExpense[]) => {
        const matchedItem = items.find(
          (item: InventoryItemForExpense) =>
            normalizeComparableText(item.name) ===
            normalizeComparableText(concept.name)
        )

        if (!matchedItem) {
          return
        }

        setExpenseInventoryForm((currentForm) => ({
          ...currentForm,
          mode: "existing",
          itemId: matchedItem.id,
          name: matchedItem.name,
          category: matchedItem.category,
          unit: matchedItem.unit,
        }))
      })
    } else {
      setLinkExpenseToInventory(false)
      setExpenseInventoryForm((currentForm) => ({
        ...currentForm,
        mode: "new",
        itemId: "",
        name: concept.relatedInventory ? concept.name : "",
        category: concept.category || "Materia prima",
        unit: concept.unit || "unidades",
      }))
    }
  }

  function selectExpenseQuickConcept(conceptId: string) {
    setSelectedExpenseQuickConceptId(conceptId)
    setExpenseMessage(null)

    if (conceptId === CUSTOM_EXPENSE_CONCEPT_ID) {
      setExpenseForm((currentForm) => ({
        ...currentForm,
        concept: "",
      }))
      setLinkExpenseToInventory(false)
      setExpenseInventoryForm(EMPTY_EXPENSE_INVENTORY_FORM)
      return
    }

    const selectedConcept = expenseQuickConcepts.find(
      (concept) => concept.id === conceptId
    )

    if (!selectedConcept) {
      return
    }

    applyExpenseQuickConcept(selectedConcept)
  }

  function addExpenseQuickConcept() {
    const name = newExpenseQuickConceptName.trim()

    if (!name) {
      setExpenseMessage("Escribe el nombre del concepto frecuente.")
      return
    }

    const alreadyExists = expenseQuickConcepts.some(
      (concept) =>
        normalizeComparableText(concept.name) === normalizeComparableText(name)
    )

    if (alreadyExists) {
      setExpenseMessage("Ese concepto ya existe en la lista.")
      return
    }

    const nextConcept: ExpenseQuickConcept = {
      id: createExpenseQuickConceptId(name),
      name,
      category: newExpenseQuickConceptCategory || "Otros",
      unit: newExpenseQuickConceptUnit || "unidades",
      relatedInventory: newExpenseQuickConceptRelatedInventory,
    }

    saveExpenseQuickConcepts([...expenseQuickConcepts, nextConcept])

    setNewExpenseQuickConceptName("")
    setNewExpenseQuickConceptCategory("Materia prima")
    setNewExpenseQuickConceptUnit("unidades")
    setNewExpenseQuickConceptRelatedInventory(true)
    setExpenseMessage("Concepto frecuente agregado.")
  }

  function removeExpenseQuickConcept(conceptId: string) {
    const nextConcepts = expenseQuickConcepts.filter(
      (concept) => concept.id !== conceptId
    )

    if (!nextConcepts.length) {
      setExpenseMessage("Debe quedar al menos un concepto frecuente.")
      return
    }

    saveExpenseQuickConcepts(nextConcepts)

    if (selectedExpenseQuickConceptId === conceptId) {
      setSelectedExpenseQuickConceptId("")
    }

    setExpenseMessage("Concepto frecuente eliminado.")
  }


  function updateExpenseInventoryForm<K extends keyof ExpenseInventoryForm>(
    field: K,
    value: ExpenseInventoryForm[K]
  ) {
    setExpenseInventoryForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setExpenseMessage(null)
  }

  async function loadExpenseInventory(silent = false): Promise<InventoryItemForExpense[]> {
    if (!adminPassword) return []

    if (!isBusinessModuleEffective(businessConfigRef.current, "inventory")) {
      setExpenseInventory([])
      return []
    }

    if (!silent) {
      setIsLoadingExpenseInventory(true)
    }

    try {
      const response = await fetch("/api/inventory", {
        headers: {
          "x-admin-password": adminPassword,
        },
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo cargar el inventario")
      }

      const cleanInventory = Array.isArray(data.inventory)
        ? data.inventory.map(normalizeInventoryItemForExpense)
        : []

      setExpenseInventory(cleanInventory)
      saveExpenseQuickConcepts(
        mergeExpenseQuickConceptsWithInventory(expenseQuickConcepts, cleanInventory)
      )

      return cleanInventory
    } catch (error) {
      setExpenseMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el inventario"
      )
      return []
    } finally {
      if (!silent) {
        setIsLoadingExpenseInventory(false)
      }
    }
  }

  async function saveExpenseInventoryEntry(equivalentUSD: number, amountUSD: number, amountVES: number) {
    if (!isBusinessModuleEffective(businessConfigRef.current, "inventory")) {
      throw new Error("Inventario no está activo en este plan.")
    }

    const quantityToAdd = parseMoneyInput(expenseInventoryForm.quantity)

    if (quantityToAdd <= 0) {
      throw new Error("Escribe la cantidad que entra al inventario.")
    }

    let currentInventory = expenseInventory

    if (!currentInventory.length) {
      currentInventory = await loadExpenseInventory(true)
    }

    const selectedItem = currentInventory.find(
      (item) => item.id === expenseInventoryForm.itemId
    )
    const isExisting = expenseInventoryForm.mode === "existing"

    if (isExisting && !selectedItem) {
      throw new Error("Selecciona un producto de inventario válido.")
    }

    const itemName = isExisting
      ? selectedItem!.name
      : expenseInventoryForm.name.trim()

    if (!itemName) {
      throw new Error("Escribe el nombre del producto de inventario.")
    }

    const nextQuantity = isExisting
      ? roundMoney((selectedItem?.quantity || 0) + quantityToAdd)
      : quantityToAdd

    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": adminPassword,
      },
      body: JSON.stringify({
        id: isExisting ? selectedItem!.id : undefined,
        name: itemName,
        category: isExisting ? selectedItem!.category : expenseInventoryForm.category,
        quantity: nextQuantity,
        unit: isExisting ? selectedItem!.unit : expenseInventoryForm.unit,
        minimumStock: isExisting
          ? selectedItem!.minimumStock
          : parseMoneyInput(expenseInventoryForm.minimumStock),
        costUSD: amountUSD > 0 ? amountUSD : selectedItem?.costUSD || 0,
        costVES: amountVES > 0 ? amountVES : selectedItem?.costVES || 0,
        equivalentCostUSD: equivalentUSD > 0 ? equivalentUSD : selectedItem?.equivalentCostUSD || 0,
        note:
          expenseInventoryForm.note.trim() ||
          `Entrada desde gastos: +${quantityToAdd} ${
            isExisting ? selectedItem!.unit : expenseInventoryForm.unit
          }.`,
        isActive: true,
      }),
    })

    const data = await readApiResponse(response)

    if (!response.ok) {
      throw new Error(data.error || "No se pudo sumar el gasto al inventario")
    }

    const savedItem = normalizeInventoryItemForExpense(data.inventoryItem)

    setExpenseInventory((currentItems) => {
      const exists = currentItems.some((item) => item.id === savedItem.id)

      if (exists) {
        return currentItems.map((item) =>
          item.id === savedItem.id ? savedItem : item
        )
      }

      return [savedItem, ...currentItems]
    })
    saveExpenseQuickConcepts(
      mergeExpenseQuickConceptsWithInventory(expenseQuickConcepts, [savedItem])
    )

    return savedItem
  }

  async function saveDayExpense() {
    if (!adminPassword) return

    if (!isBusinessModuleEffective(businessConfigRef.current, "expenses")) {
      setExpenseMessage("Gastos no está activo en este plan.")
      return
    }

    const concept = expenseForm.concept.trim()
    const amountUSD = parseMoneyInput(expenseForm.amountUSD)
    const amountVES = parseMoneyInput(expenseForm.amountVES)
    const equivalentUSD = expenseDraftEquivalentUSD
    const inventoryQuantity = linkExpenseToInventory
      ? parseMoneyInput(expenseInventoryForm.quantity)
      : 0
    const selectedExpenseInventoryItem = expenseInventory.find(
      (item) => item.id === expenseInventoryForm.itemId
    )
    const inventoryItemNameForExpense = linkExpenseToInventory
      ? expenseInventoryForm.mode === "existing"
        ? selectedExpenseInventoryItem?.name || ""
        : expenseInventoryForm.name.trim()
      : ""
    const inventoryUnitForExpense = linkExpenseToInventory
      ? expenseInventoryForm.mode === "existing"
        ? selectedExpenseInventoryItem?.unit || "unidades"
        : expenseInventoryForm.unit || "unidades"
      : "unidades"

    if (!concept) {
      setExpenseMessage("Escribe el concepto del gasto.")
      return
    }

    if (amountVES > 0 && !parseMoneyInput(expenseForm.equivalentUSD) && latestExpenseExchangeRate <= 0) {
      setExpenseMessage(
        "No hay una tasa disponible para convertir bolívares. Escribe el equivalente en USD manualmente."
      )
      return
    }

    if (amountUSD <= 0 && amountVES <= 0 && equivalentUSD <= 0) {
      setExpenseMessage("Registra un monto en divisas, bolívares o equivalente USD.")
      return
    }

    if (linkExpenseToInventory) {
      if (!isBusinessModuleEffective(businessConfigRef.current, "inventory")) {
        setExpenseMessage("Inventario no está activo en este plan.")
        return
      }

      if (inventoryQuantity <= 0) {
        setExpenseMessage("Escribe la cantidad que entrará al inventario.")
        return
      }

      if (expenseInventoryForm.mode === "existing" && !expenseInventoryForm.itemId) {
        setExpenseMessage("Selecciona el producto de inventario que recibirá la entrada.")
        return
      }

      if (expenseInventoryForm.mode === "new" && !expenseInventoryForm.name.trim()) {
        setExpenseMessage("Escribe el nombre del producto que se creará en inventario.")
        return
      }
    }

    try {
      setIsSavingExpense(true)
      setExpenseMessage(null)

      const response = await fetch("/api/day-expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          concept,
          category: expenseForm.category,
          provider: expenseForm.provider,
          expenseType: expenseForm.expenseType,
          amountUSD,
          amountVES,
          equivalentUSD,
          method: expenseForm.method,
          note: expenseForm.note,
          inventoryLinked: linkExpenseToInventory,
          inventoryItemId:
            linkExpenseToInventory && expenseInventoryForm.mode === "existing"
              ? expenseInventoryForm.itemId
              : "",
          inventoryItemName: inventoryItemNameForExpense,
          inventoryQuantity,
          inventoryUnit: inventoryUnitForExpense,
          dateValue: getDateKeyInCaracas(new Date()),
          dateLabel: formatCaracasLongDate(new Date()),
        }),
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo guardar el gasto del día")
      }

      const savedExpense = normalizeDayExpense(data.dayExpense)
      let inventoryWasUpdated = false
      let inventoryErrorMessage = ""

      if (linkExpenseToInventory) {
        try {
          await saveExpenseInventoryEntry(equivalentUSD, amountUSD, amountVES)
          inventoryWasUpdated = true
        } catch (inventoryError) {
          inventoryErrorMessage =
            inventoryError instanceof Error
              ? inventoryError.message
              : "No se pudo sumar este gasto al inventario"
        }
      }

      setDayExpenses((currentExpenses) => [savedExpense, ...currentExpenses])
      setExpenseForm(EMPTY_EXPENSE_FORM)
      setExpenseInventoryForm(EMPTY_EXPENSE_INVENTORY_FORM)
      setLinkExpenseToInventory(false)
      setSelectedExpenseQuickConceptId("")
      setExpenseMessage(
        inventoryWasUpdated
          ? "Gasto guardado y entrada de inventario registrada correctamente."
          : inventoryErrorMessage
            ? `Gasto guardado, pero inventario no se actualizó: ${inventoryErrorMessage}`
            : "Gasto guardado correctamente."
      )
    } catch (error) {
      setExpenseMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el gasto del día"
      )
    } finally {
      setIsSavingExpense(false)
    }
  }

  async function deleteDayExpense(expenseId: string) {
    if (!adminPassword || !expenseId) return

    if (!isBusinessModuleEffective(businessConfigRef.current, "expenses")) {
      setExpenseMessage("Gastos no está activo en este plan.")
      return
    }

    try {
      setDeletingExpenseId(expenseId)
      setExpenseMessage(null)

      const response = await fetch(
        `/api/day-expenses?id=${encodeURIComponent(expenseId)}`,
        {
          method: "DELETE",
          headers: {
            "x-admin-password": adminPassword,
          },
        }
      )

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo eliminar el gasto")
      }

      setDayExpenses((currentExpenses) =>
        currentExpenses.filter((expense) => expense.id !== expenseId)
      )
      setExpenseMessage("Gasto eliminado correctamente.")
    } catch (error) {
      setExpenseMessage(
        error instanceof Error ? error.message : "No se pudo eliminar el gasto"
      )
    } finally {
      setDeletingExpenseId(null)
    }
  }

  const paymentModalOrder = selectedPaymentOrder
    ? orders.find((order) => order.id === selectedPaymentOrder.id) ||
      selectedPaymentOrder
    : null

  const paymentModalIsDelivery = Boolean(
    paymentModalOrder && isDeliveryOrder(paymentModalOrder)
  )

  const paymentDraft = paymentModalOrder
    ? calculatePaymentDraft(paymentModalOrder, paymentForm)
    : null

  const currentPaymentVES = parseMoneyInput(paymentForm.amountReceivedVES)
  const currentPaymentUSD = parseMoneyInput(paymentForm.amountReceivedUSD)
  const paymentExchangeRate = Number(paymentModalOrder?.exchangeRate || 0)
  const pendingVESForPayment =
    paymentDraft && paymentExchangeRate > 0
      ? roundMoney(paymentDraft.pendingUSD * paymentExchangeRate)
      : 0
  const showLowVESWarning =
    Boolean(paymentDraft && paymentExchangeRate > 100) &&
    currentPaymentVES > 0 &&
    currentPaymentVES < paymentExchangeRate * 0.2 &&
    paymentDraft!.pendingUSD > 0.5

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
      <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)]">
        <div className="w-full max-w-md overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]">
          <div className="h-6 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="px-6 py-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
            >
              <ArrowLeft size={16} />
              Volver
            </Link>

            <Image
              src={BRAND.logoUrl || "/logoremovebg.png"}
              alt={BRAND.name}
              width={112}
              height={112}
              unoptimized
              className="mx-auto mt-6 h-28 w-28 object-contain"
            />

            <p className="mt-5 text-center text-xs font-black uppercase tracking-[0.28em] text-[var(--brand-primary)]">
              Acceso privado
            </p>

            <h1 className="mt-2 text-center text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
              Panel del local
            </h1>

            <p className="mt-3 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
              Ingresa la clave autorizada para gestionar los pedidos del negocio.
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
                  placeholder="Ingresa la clave del local"
                  className="w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 pr-12 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
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
              <div className="rounded-2xl border-2 border-red-500/35 bg-red-500/100/15 px-4 py-3">
                <p className="text-sm font-bold leading-6 text-red-300">
                  {errorMessage}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:scale-[1.02] disabled:opacity-60"
            >
              {isLoading ? <Loader2 size={21} className="animate-spin" /> : <LogIn size={21} />}
              {isLoading ? "Validando acceso" : "Entrar al panel"}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-3 py-4 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
      <PaymentProofAlertToast
        alert={paymentProofAlerts.newProofAlert}
        onDismiss={paymentProofAlerts.dismissNewProofAlert}
      />
      <OrderCancellationAlertToast
        alert={cancelledOrderAlert}
        onDismiss={() => setCancelledOrderAlert(null)}
      />
      {newOrderToast && (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] p-4 shadow-2xl shadow-black/20">
          <div className="flex gap-3">
            <BellRing className="mt-1 text-[var(--brand-primary)]" size={24} />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Nuevo pedido
              </p>
              <p className="mt-1 text-lg font-black text-[var(--brand-ink-3)]">
                {newOrderToast.number} · {formatUSD(newOrderToast.totalUSD)}
              </p>
              <p className="text-sm font-bold text-[var(--brand-ink-2)]/70">
                {newOrderToast.customerName} · {newOrderToast.orderType} · {newOrderToast.tableNumber}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[1.6rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)]">
          <div className="h-1.5 shrink-0 bg-[linear-gradient(90deg,var(--brand-primary),var(--brand-accent))]" />

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                  >
                    <ArrowLeft size={16} />
                    Menú
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setCloseSummaryMessage(null)
                      setIsCloseModalOpen(true)
                    }}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                  >
                    <Clock size={16} />
                    Cierre del día
                  </button>

                  {isHistoryModuleVisible && (
                    <a
                      href="/local-santo/cierres"
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                    >
                      <Clock size={16} />
                      Historial de cierres
                    </a>
                  )}

                  {isExpensesModuleVisible && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpenseMessage(null)
                        setIsExpensesModalOpen(true)
                        loadDayExpenses(adminPassword, true)
                        if (isBusinessModuleEffective(businessConfigRef.current, "inventory")) {
                          loadExpenseInventory(true)
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                    >
                      <Plus size={16} />
                      Gastos
                    </button>
                  )}

                  {isCustomersModuleVisible && (
                    <a
                      href="/local-santo/clientes"
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                    >
                      <MessageCircle size={16} />
                      Clientes
                    </a>
                  )}

                  {isInventoryModuleVisible && (
                    <a
                      href="/local-santo/inventario"
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                    >
                      <PackageCheck size={16} />
                      Inventario
                    </a>
                  )}

                  {isMenuProductsModuleVisible && (
                    <a
                      href="/local-santo/menu"
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                    >
                      <Store size={16} />
                      Productos
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setOpenAccountsMessage(null)
                      setIsLocationsModalOpen(true)
                      loadOpenAccounts(adminPassword, true)
                    }}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                  >
                    <MapPin size={16} />
                    Mesas
                  </button>

                  {canEditSensitiveSettings && (
                    <button
                      type="button"
                      onClick={() => loadBusinessConfig(adminPassword)}
                      disabled={isLoadingBusinessConfig}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)] disabled:opacity-50"
                    >
                      {isLoadingBusinessConfig ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      Config
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={isPanelSoundActive ? disablePanelSound : activatePanelSound}
                    disabled={!isPanelSoundAvailable}
                    className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isPanelSoundActive
                        ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] hover:bg-[rgba(var(--brand-primary-rgb),0.2)]"
                        : "border-[var(--brand-primary)] bg-[var(--brand-surface-2)] text-[var(--brand-primary)] hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                    }`}
                  >
                    {isPanelSoundActive ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    {isPanelSoundActive ? "Sonido activo" : isPanelSoundAvailable ? "Activar sonido" : "Sonido no activo"}
                  </button>

                  {staffAlertsPush.state !== "unavailable" && (
                    <button
                      type="button"
                      onClick={() => void staffAlertsPush.toggle()}
                      disabled={staffAlertsPush.state === "working"}
                      title="Notificación en este equipo cuando se anule un pedido, aunque la app esté cerrada"
                      className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-60 ${
                        staffAlertsPush.state === "on"
                          ? "border-red-600 bg-red-50 text-red-700 hover:bg-red-100"
                          : "border-[var(--brand-primary)] bg-[var(--brand-surface-2)] text-[var(--brand-primary)] hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                      }`}
                    >
                      {staffAlertsPush.state === "working" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <BellRing size={16} />
                      )}
                      {staffAlertsPush.state === "on"
                        ? "Alerta de anulación activa"
                        : "Alertas de anulación"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.2)]"
                  >
                    Cerrar sesión
                  </button>
                </div>

                <p className="mt-4 text-xs font-black uppercase tracking-[0.32em] text-[var(--brand-primary)]">
                  {businessConfig.businessName}
                </p>

                <h1 className="mt-1 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  Control de pedidos
                </h1>

                <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  {businessConfig.businessShortDescription} · Plan {planLabel} · Acceso {localAccessRoleLabel || "privado"} · {visibleOperationalModules}/{visibleOperationalModulesLimit} módulos visibles · Vista {businessConfig.defaultViewMode}
                  {isPanelSoundAvailable ? " · Sonidos permitidos" : " · Sonidos no activos"}
                </p>

                {soundMessage && (
                  <p className="mt-2 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-3 py-2 text-xs font-black text-[var(--brand-ink-2)]">
                    {soundMessage}
                  </p>
                )}

                {staffAlertsPush.message && (
                  <p className="mt-2 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-3 py-2 text-xs font-black text-[var(--brand-ink-2)]">
                    {staffAlertsPush.message}
                  </p>
                )}

                <CurrentBranchBanner />
              </div>

              <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-5 2xl:max-w-[880px]">
                <MetricCard label="Activos" value={activeOrders.length} />
                <MetricCard label="Nuevos" value={newOrdersCount} />
                <MetricCard label="Listos" value={readyOrdersCount} tone="yellow" />
                <MetricCard label="Por revisar" value={staffConfirmationPendingOrders.length} tone={staffConfirmationPendingOrders.length > 0 ? "yellow" : "red"} />
                <MetricCard label="Ventas" value={formatUSD(totalRegistered)} />
              </div>
            </div>
          </div>
        </header>

        {(trainingActive || (canEditSensitiveSettings && trainingAvailable)) && (
          <section
            className={`mt-4 flex flex-col gap-3 rounded-[1.4rem] border-2 p-4 sm:flex-row sm:items-center sm:justify-between ${
              trainingActive
                ? "border-orange-500 bg-orange-100"
                : "border-[var(--brand-border)] bg-[var(--brand-surface-2)]"
            }`}
          >
            <div className="flex items-start gap-2">
              <GraduationCap
                size={22}
                className={
                  trainingActive
                    ? "text-orange-700"
                    : "text-[var(--brand-primary)]"
                }
              />
              <div>
                <p
                  className={`text-sm font-black uppercase tracking-[0.12em] ${
                    trainingActive
                      ? "text-orange-800"
                      : "text-[var(--brand-primary)]"
                  }`}
                >
                  {trainingActive
                    ? "Modo entrenamiento ACTIVO"
                    : "Modo entrenamiento"}
                </p>
                <p className="mt-0.5 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                  {trainingActive
                    ? "Los pedidos que se creen ahora son de práctica: no cuentan en inventario, reportes ni cierre. Acuérdate de salir al terminar."
                    : "Actívalo para entrenar al personal: los pedidos nuevos serán de práctica y no afectarán la operación real."}
                </p>
              </div>
            </div>
            {canEditSensitiveSettings && (
              <button
                type="button"
                onClick={() => setTrainingMode(!trainingActive)}
                disabled={isSavingTraining}
                className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-50 ${
                  trainingActive
                    ? "border-orange-600 bg-orange-600 text-white hover:bg-orange-700"
                    : "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] hover:bg-[rgba(var(--brand-primary-rgb),0.2)]"
                }`}
              >
                {isSavingTraining ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <GraduationCap size={15} />
                )}
                {trainingActive
                  ? "Salir de entrenamiento"
                  : "Entrar a entrenamiento"}
              </button>
            )}
          </section>
        )}

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isOwnerDashboardModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/dueno"
              icon={<PackageCheck size={24} />}
              eyebrow="Dueño"
              title="Resumen del negocio"
              description="Revisa ventas, cobros, gastos, delivery, pendientes y alertas importantes del día."
              metric="Resumen"
            />
          )}

          {isCashierModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/caja"
              icon={<CheckCircle2 size={24} />}
              eyebrow="Módulo Caja"
              title="Confirmar y cobrar"
              description="Confirma pedidos, registra pagos y coordina la entrega final."
              metric={`${orders.filter((order) => getOrderPayment(order).status !== "Pagado" && order.status !== "Cancelado").length} por cobrar`}
            />
          )}

          {isPaymentProofsModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/comprobantes"
              icon={<BellRing size={24} />}
              eyebrow="Comprobantes"
              title="Pagos reportados"
              description="Revisa capturas enviadas por clientes y decide si el comprobante queda confirmado, rechazado o requiere corrección."
              metric={pendingPaymentProofsCount > 0 ? `${pendingPaymentProofsCount} por revisar` : "Al día"}
            />
          )}

          {isOpenAccountsModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/mesonero"
              icon={<MapPin size={24} />}
              eyebrow="Cuentas abiertas"
              title="Mesas con cuenta"
              description="Revisa mesas ocupadas, cuentas abiertas y pedidos asociados al consumo en local."
              metric={activeOpenAccounts.length > 0 ? `${activeOpenAccounts.length} abierta(s)` : "Sin cuentas"}
            />
          )}

          {isKitchenModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/cocina"
              icon={<CookingPot size={24} />}
              eyebrow="Módulo Cocina"
              title="Preparación"
              description="Solo muestra pedidos enviados por caja y permite marcarlos como listos."
              metric={`${orders.filter((order) => order.status === "Preparando").length} en cocina`}
            />
          )}

          {isDeliveryModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/delivery"
              icon={<Truck size={24} />}
              eyebrow="Módulo Delivery"
              title="Ruta y WhatsApp"
              description="Coordina datos del cliente, salida, llegada y entregas a domicilio."
              metric={`${orders.filter(isDeliveryOrder).length} delivery`}
            />
          )}

          {isHistoryModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/cierres"
              icon={<Clock size={24} />}
              eyebrow="Historial"
              title="Cierres y reportes"
              description="Revisa cierres guardados, gráficas, alertas y exportaciones."
              metric="Reportes"
            />
          )}

          {isExpensesModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/control-gastos"
              icon={<Wallet size={24} />}
              eyebrow="Egresos"
              title="Control de gastos"
              description="Gastos del día, compras, proveedores y alertas de inventario, por sede o negocio completo."
              metric={formatUSD(dayExpenseTotals.equivalentUSD)}
            />
          )}

          {isCustomersModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/clientes"
              icon={<MessageCircle size={24} />}
              eyebrow="Clientes"
              title="Clientes frecuentes"
              description="Revisa clientes que más compran, último pedido, total aproximado y contacto por WhatsApp."
              metric="Seguimiento"
            />
          )}

          {isInventoryModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/inventario"
              icon={<PackageCheck size={24} />}
              eyebrow="Inventario"
              title="Inventario básico"
              description="Controla existencias, entradas, salidas y alertas de stock bajo sin afectar pedidos."
              metric="Stock"
            />
          )}

          {isMenuProductsModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/menu"
              icon={<Store size={24} />}
              eyebrow="Menú editable"
              title="Productos del menú"
              description="Crea productos, cambia precios, categorías, fotos, disponibilidad y destacados de la página pública."
              metric="Editar"
            />
          )}

          {isAdvancedMenuModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/menu-avanzado"
              icon={<Store size={24} />}
              eyebrow="Menú premium"
              title="Menú avanzado"
              description="Configura variaciones, adicionales, ingredientes, canales y productos armables."
              metric="Opciones"
            />
          )}

          {isTablesModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/mesas"
              icon={<MapPin size={24} />}
              eyebrow="Mesas y QR"
              title="Mesas del local"
              description="Gestiona ubicaciones, enlaces QR imprimibles y estados de las mesas del negocio."
              metric="QR"
            />
          )}

          {isKitchenItemsModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/cocina-productos"
              icon={<CookingPot size={24} />}
              eyebrow="Cocina"
              title="Por producto"
              description="Agrupa productos activos por cantidad, mesa, notas, adicionales e ingredientes."
              metric="Detalle"
            />
          )}

          {isTicketsModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/tickets"
              icon={<Clock size={24} />}
              eyebrow="Impresión"
              title="Tickets"
              description="Imprime tickets de cocina, caja, delivery y cuentas abiertas desde el navegador."
              metric="Tickets"
            />
          )}

          {isReportsModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/reportes"
              icon={<PackageCheck size={24} />}
              eyebrow="Reportes"
              title="Análisis"
              description="Revisa reportes operativos, ventas, cobros, productos y sucursales cuando aplique."
              metric="Datos"
            />
          )}

          {isRolesModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/usuarios"
              icon={<CheckCircle2 size={24} />}
              eyebrow="Equipo"
              title="Usuarios"
              description="Administra accesos del personal por rol para dueño, caja, cocina, delivery y soporte."
              metric="Roles"
            />
          )}

          {isReservationsModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/reservas"
              icon={<CalendarClock size={24} />}
              eyebrow="Reservas"
              title="Reservas"
              description="Reservas por mesa y franja horaria, con bloqueo de la mesa en el pedido del cliente."
              metric="Mesas"
            />
          )}

          {isBranchesModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/sucursales"
              icon={<MapPin size={24} />}
              eyebrow="Sedes"
              title="Sucursales"
              description="Gestiona sedes del negocio y separa pedidos, menú, inventario, caja y reportes por sucursal."
              metric="Sedes"
            />
          )}

          {canEditSensitiveSettings && (
            <ModuleAccessCard
              href="/local-santo/configuracion"
              icon={<MapPin size={24} />}
              eyebrow="Configuración"
              title="Negocio"
              description="Datos del local, módulos visibles, tasa, sonidos y reglas operativas."
              metric="Ajustes"
            />
          )}

          {isAuditLogModuleVisible && (
            <ModuleAccessCard
              href="/local-santo/auditoria"
              icon={<ShieldCheck size={24} />}
              eyebrow="Auditoría"
              title="Auditoría"
              description="Registro de quién hizo qué, cuándo y desde dónde: cobros, cambios de estado, cierres, configuración y usuarios."
              metric="Bitácora"
            />
          )}
        </section>

        {isPaymentProofsModuleVisible && (pendingPaymentProofsCount > 0 || paymentProofsMessage) && (
          <section className={`mt-4 rounded-[1.4rem] border-2 p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)] ${pendingPaymentProofsCount > 0 ? "border-[var(--brand-primary)] bg-[rgba(var(--brand-primary-rgb),0.12)]" : "border-orange-400 bg-orange-100"}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  <BellRing size={18} />
                  Comprobantes de pago
                </p>
                {pendingPaymentProofsCount > 0 ? (
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                    Hay {pendingPaymentProofsCount} comprobante(s) por revisar.
                    {latestPendingPaymentProof
                      ? ` Último: ${latestPendingPaymentProof.customerName || "Cliente"} · Pedido ${latestPendingPaymentProof.orderId} · ${formatPaymentProofDate(latestPendingPaymentProof.createdAt)}.`
                      : ""}
                    Esto solo avisa que el cliente reportó pago; caja todavía debe registrar el cobro real aparte.
                  </p>
                ) : (
                  <p className="mt-2 text-sm font-bold leading-6 text-orange-900">
                    {paymentProofsMessage}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => loadPaymentProofs(adminPassword)} className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.08)]">
                  <RefreshCw size={16} />
                  Actualizar
                </button>
                <a href="/local-santo/comprobantes" className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)]">
                  Abrir revisión
                </a>
              </div>
            </div>
          </section>
        )}

        {staffConfirmationPendingOrders.length > 0 && (
          <section className="mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-[rgba(var(--brand-primary-rgb),0.12)] p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  <AlertTriangle size={18} />
                  Productos por revisar
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Hay {staffConfirmationPendingOrders.length} pedido(s) con productos que requieren confirmación del personal.
                  {latestStaffConfirmationOrder
                    ? ` Próximo: ${getDisplayOrderNumber(latestStaffConfirmationOrder)} · ${latestStaffConfirmationOrder.customerName || "Cliente"} · ${getDisplayTableNumber(latestStaffConfirmationOrder)}.`
                    : ""}
                  La confirmación no registra cobro ni cambia el estado de cocina.
                </p>
              </div>

              <a
                href="/local-santo/mesonero"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)]"
              >
                Abrir mesonero
              </a>
            </div>
          </section>
        )}

        {visibleOperationalModules === 0 && (
          <section className="mt-4 rounded-[1.4rem] border-2 border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)] p-4">
            <p className="text-sm font-black uppercase text-[var(--brand-amber)]">
              No hay módulos operativos visibles
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
              Revisa los módulos incluidos en el plan y los interruptores disponibles en Configuración del negocio. Los módulos no incluidos en el plan se muestran bloqueados en configuración para que el dueño pueda solicitar una mejora.
            </p>
          </section>
        )}

        <section className="sticky top-0 z-30 mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] p-3 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Filtros operativos
              </p>
              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                {filteredOrders.length} pedido(s) en pantalla · Total {formatUSD(filteredPanelTotal)}{isCashierModuleVisible ? ` · Pendiente ${formatUSD(filteredPanelPending)}` : ""}
              </p>
              {!arePanelFiltersVisible && (
                <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]/70">
                  {activeFilter} · {panelPaymentFilter} · {panelOrderScopeFilter}
                  {filteredStaffConfirmationPendingCount > 0 ? ` · ${filteredStaffConfirmationPendingCount} por revisar` : ""}
                  {panelSearchText.trim() ? ` · ${panelSearchText.trim()}` : ""}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setArePanelFiltersVisible((value) => !value)}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.2)]"
              >
                {arePanelFiltersVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                {arePanelFiltersVisible ? "Ocultar filtros" : "Mostrar filtros"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveFilter("Activos")
                  setPanelPaymentFilter("Todos los cobros")
                  setPanelOrderScopeFilter("Todos los tipos")
                  setPanelSearchText("")
                }}
                className="rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
              >
                Limpiar filtros
              </button>

              <button
                type="button"
                onClick={() => loadOrders()}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase text-[var(--brand-ink)] transition hover:scale-105"
              >
                {isLoading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <RefreshCw size={17} />
                )}
                Actualizar
              </button>
            </div>
          </div>

          {arePanelFiltersVisible && (
            <>
              <div className="mt-3 grid gap-3">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]"
                  />
                  <input
                    value={panelSearchText}
                    onChange={(event) => setPanelSearchText(event.target.value)}
                    placeholder="Buscar por cliente, teléfono, mesa, zona, producto, número, variación, adicional o revisión"
                    className="w-full rounded-full border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-11 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {filterOptions.map((status) => {
                    const isActive = activeFilter === status

                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setActiveFilter(status)}
                        className={`shrink-0 rounded-full border-2 px-4 py-2.5 text-xs font-black uppercase transition ${
                          isActive
                            ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                            : "border-[var(--brand-primary)] bg-[var(--brand-surface-2)] text-[var(--brand-primary)] hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                        }`}
                      >
                        {status}
                      </button>
                    )
                  })}
                </div>

                {isCashierModuleVisible && (
                  <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {panelPaymentFilterOptions.map((filter) => {
                      const isActive = panelPaymentFilter === filter

                      return (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setPanelPaymentFilter(filter)}
                          className={`shrink-0 rounded-full border-2 px-4 py-2.5 text-xs font-black uppercase transition ${
                            isActive
                              ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                              : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-primary)] hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                          }`}
                        >
                          {filter}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {panelOrderScopeFilterOptions.map((filter) => {
                    const isActive = panelOrderScopeFilter === filter

                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setPanelOrderScopeFilter(filter)}
                        className={`shrink-0 rounded-full border-2 px-4 py-2.5 text-xs font-black uppercase transition ${
                          isActive
                            ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                            : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-primary)] hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                        }`}
                      >
                        {filter}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <PanelMiniMetric label="En pantalla" value={filteredOrders.length} />
                <PanelMiniMetric label="Por revisar" value={filteredStaffConfirmationPendingCount} />
                <PanelMiniMetric label="Confirmados" value={filteredStaffConfirmationConfirmedCount} />
                {isCashierModuleVisible && (
                  <PanelMiniMetric label="Pendientes de cobro" value={filteredPanelPaymentPendingCount} />
                )}
                {isDeliveryModuleVisible && (
                  <PanelMiniMetric label="Delivery en pantalla" value={filteredPanelDeliveryCount} />
                )}
                {isCashierModuleVisible && (
                  <PanelMiniMetric label="Pendiente USD" value={formatUSD(filteredPanelPending)} />
                )}
              </div>
            </>
          )}

          {errorMessage && (
            <div className="mt-3 rounded-2xl border-2 border-red-500/35 bg-red-500/100/15 px-4 py-3">
              <p className="text-sm font-bold leading-6 text-red-300">
                {errorMessage}
              </p>
            </div>
          )}
        </section>

        {filteredOrders.length === 0 ? (
          <section className="mt-5 rounded-[2rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-6 py-14 text-center shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]">
            <Image
              src={BRAND.logoUrl || "/logoremovebg.png"}
              alt={BRAND.name}
              width={112}
              height={112}
              unoptimized
              className="mx-auto h-28 w-28 object-contain"
            />

            <h2 className="mt-5 text-3xl font-black uppercase text-[var(--brand-primary)]">
              Sin pedidos pendientes
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
              Los pedidos nuevos aparecerán automáticamente en esta pantalla.
            </p>
          </section>
        ) : (
          <section className="mt-5 grid gap-4 xl:grid-cols-2">
            {filteredOrders.map((order) => {
              const primaryAction = getPrimaryAction(order.status)
              const isHighlighted = highlightedIds.includes(order.id)
              const orderTotals = getOrderTotals(order)
              const comboItems = order.items.filter(isComboItem)
              const regularItems = order.items.filter((item) => !isComboItem(item))
              const isDelivery = isDeliveryOrder(order)
              const displayOrderType = getDisplayOrderType(order)
              const displayTableNumber = getDisplayTableNumber(order)
              const orderPayment = getOrderPayment(order)
              const staffConfirmationSummary = getOrderStaffConfirmationSummary(order)
              const hasPendingStaffConfirmation = staffConfirmationSummary.pendingCount > 0
              const hasConfirmedStaffConfirmation =
                staffConfirmationSummary.requiredCount > 0 &&
                staffConfirmationSummary.pendingCount === 0
              const hasAnyConfirmedStaffConfirmation =
                staffConfirmationSummary.confirmedCount > 0
              const isUpdatingStaffConfirmation =
                updatingStaffConfirmationOrderId === order.id

              return (
                <article
                  key={order.id}
                  className={`overflow-hidden rounded-[1.6rem] border-2 bg-[var(--brand-surface-2)] shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)] transition ${
                    isHighlighted
                      ? "border-red-500 ring-4 ring-red-300"
                      : "border-[var(--brand-primary)]"
                  }`}
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

                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-black uppercase ${getPaymentStatusStyle(
                              orderPayment.status
                            )}`}
                          >
                            {orderPayment.status}
                          </span>

                          {isDelivery && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-black uppercase text-white">
                              <Truck size={15} />
                              Delivery
                            </span>
                          )}

                          {hasPendingStaffConfirmation && (
                            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500 bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-black uppercase text-[var(--brand-ink)]">
                              <AlertTriangle size={15} />
                              Por revisar
                            </span>
                          )}

                          {hasConfirmedStaffConfirmation && (
                            <span className="inline-flex items-center gap-2 rounded-full border border-green-600 bg-green-500/100 px-3 py-1.5 text-xs font-black uppercase text-white">
                              <CheckCircle2 size={15} />
                              Revisión confirmada
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-xs font-bold text-[var(--brand-ink-2)]/70">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-3xl font-black leading-none text-[var(--brand-ink-3)]">
                          {formatUSD(orderTotals.totalUSD)}
                        </p>
                        {orderTotals.totalRegularVES > 0 && (
                          <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/60">
                            Ref. normales Bs {formatVES(orderTotals.totalRegularVES)}
                          </p>
                        )}
                        {orderTotals.deliveryCostUSD > 0 && (
                          <p className="mt-1 text-xs font-black text-[var(--brand-primary)]">
                            Incluye delivery {formatUSD(orderTotals.deliveryCostUSD)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoBox label="Cliente" value={order.customerName || "Cliente"} />
                      <InfoBox label={isDelivery ? "Zona" : "Mesa / ubicación"} value={displayTableNumber} />
                      <InfoBox label="Tipo" value={displayOrderType} />
                      <InfoBox label="Tasa" value={`Bs ${formatVES(order.exchangeRate)}`} />
                      {staffConfirmationSummary.requiredCount > 0 && (
                        <InfoBox
                          label="Revisión del personal"
                          value={`${getStaffConfirmationStatusLabel(staffConfirmationSummary.status)} · ${staffConfirmationSummary.confirmedCount}/${staffConfirmationSummary.requiredCount}`}
                        />
                      )}
                    </div>

                    {staffConfirmationSummary.requiredCount > 0 && (
                      <div className={`rounded-[1.4rem] border-2 p-4 ${
                        hasPendingStaffConfirmation
                          ? "border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)]"
                          : "border-green-500/45 bg-green-500/10"
                      }`}>
                        <p className={`flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] ${
                          hasPendingStaffConfirmation ? "text-[var(--brand-amber)]" : "text-green-300"
                        }`}>
                          {hasPendingStaffConfirmation ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                          {getStaffConfirmationStatusLabel(staffConfirmationSummary.status)}
                        </p>
                        <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                          {hasPendingStaffConfirmation
                            ? `Pendiente: ${staffConfirmationSummary.pendingText || "productos por revisar"}.`
                            : `Revisión confirmada en ${staffConfirmationSummary.confirmedCount} producto(s).`}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {hasPendingStaffConfirmation && (
                            <button
                              type="button"
                              onClick={() =>
                                updateStaffConfirmation(order, "confirmStaffItems")
                              }
                              disabled={isUpdatingStaffConfirmation}
                              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isUpdatingStaffConfirmation ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={15} />
                              )}
                              Confirmar revisión
                            </button>
                          )}

                          {hasAnyConfirmedStaffConfirmation && (
                            <button
                              type="button"
                              onClick={() =>
                                updateStaffConfirmation(order, "resetStaffItems")
                              }
                              disabled={isUpdatingStaffConfirmation}
                              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isUpdatingStaffConfirmation ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <RefreshCw size={15} />
                              )}
                              Reabrir revisión
                            </button>
                          )}

                          {hasPendingStaffConfirmation && (
                            <a
                              href="/local-santo/mesonero"
                              className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                            >
                              Abrir mesonero
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {isDelivery && (
                      <div className="space-y-3 rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] p-4">
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          <Truck size={16} />
                          Datos de delivery
                        </p>

                        {/* Un toque copia teléfono + link de dirección + resumen
                            del pedido, listo para pegárselo al repartidor. */}
                        <button
                          type="button"
                          onClick={() => copyCourierHandoff(order)}
                          className={`flex w-full items-center justify-center gap-2 rounded-full border-2 px-4 py-3 text-xs font-black uppercase tracking-[0.1em] transition ${
                            copiedCourierOrderId === order.id
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white hover:opacity-90"
                          }`}
                        >
                          {copiedCourierOrderId === order.id ? (
                            <>
                              <CheckCircle2 size={16} />
                              ¡Copiado! Pégaselo al repartidor
                            </>
                          ) : (
                            <>
                              <ClipboardCopy size={16} />
                              Copiar datos para el repartidor
                            </>
                          )}
                        </button>

                        <div className="grid gap-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/80">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <p className="rounded-2xl bg-[var(--brand-surface-2)] px-3 py-2"><strong>Teléfono:</strong> {order.customerPhone || "Sin teléfono"}</p>
                            <p className="rounded-2xl bg-[var(--brand-surface-2)] px-3 py-2"><strong>Método de pago:</strong> {order.paymentMethod || "Sin método"}</p>
                          </div>
                          <p className="rounded-2xl bg-[var(--brand-surface-2)] px-3 py-2"><strong>Dirección:</strong> {order.deliveryAddress || "Sin dirección"}</p>
                          <p className="rounded-2xl bg-[var(--brand-surface-2)] px-3 py-2"><strong>Referencia:</strong> {order.deliveryReference || "Sin referencia"}</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <p className="rounded-2xl bg-[var(--brand-surface-2)] px-3 py-2"><strong>Zona:</strong> {displayTableNumber}</p>
                            <p className="rounded-2xl bg-[var(--brand-surface-2)] px-3 py-2"><strong>Costo delivery:</strong> {formatUSD(orderTotals.deliveryCostUSD)} / Bs {formatVES(orderTotals.deliveryCostUSD * Number(order.exchangeRate || 0))}</p>
                          </div>
                        </div>

                        {isDeliveryModuleVisible &&
                        businessConfig.orderWhatsappStageButtonsEnabled &&
                        normalizePhoneForWhatsApp(order.customerPhone || "") ? (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <a
                              href={buildDeliveryWhatsAppUrl(order, "confirm")}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-center text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.2)]"
                            >
                              <MessageCircle size={16} />
                              Confirmar
                            </a>

                            <a
                              href={buildDeliveryWhatsAppUrl(order, "preparing")}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-3 text-center text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                            >
                              <CookingPot size={16} />
                              Preparación
                            </a>

                            <a
                              href={buildDeliveryWhatsAppUrl(order, "onTheWay")}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-3 text-center text-[0.68rem] font-black uppercase tracking-[0.1em] text-white transition hover:bg-[var(--brand-primary-dark)]"
                            >
                              <Truck size={16} />
                              Avisar salida
                            </a>

                            <a
                              href={buildDeliveryWhatsAppUrl(order, "arrived")}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-green-600 bg-green-500/100 px-4 py-3 text-center text-[0.68rem] font-black uppercase tracking-[0.1em] text-white transition hover:bg-green-400"
                            >
                              <CheckCircle2 size={16} />
                              Llegué
                            </a>
                          </div>
                        ) : isDeliveryModuleVisible &&
                          businessConfig.orderWhatsappStageButtonsEnabled ? (
                          <div className="rounded-2xl border-2 border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)] px-3 py-2 text-xs font-black text-[var(--brand-amber)]">
                            Este delivery no tiene teléfono válido para abrir WhatsApp.
                          </div>
                        ) : null}
                      </div>
                    )}

                    {!isDelivery &&
                    businessConfig.orderWhatsappStageButtonsEnabled &&
                    order.status === "Listo" &&
                    normalizePhoneForWhatsApp(order.customerPhone || "") ? (
                      <a
                        href={buildDeliveryWhatsAppUrl(order, "ready")}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-green-600 bg-green-500 px-4 py-3 text-center text-[0.68rem] font-black uppercase tracking-[0.1em] text-white transition hover:bg-green-400"
                      >
                        <MessageCircle size={16} />
                        Avisar por WhatsApp que está listo
                      </a>
                    ) : null}

                    <div className="rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        Productos
                      </p>

                      <div className="mt-3 space-y-2">
                        {comboItems.length > 0 && (
                          <ProductGroup
                            title="Combos — solo divisas"
                            items={comboItems}
                            exchangeRate={order.exchangeRate}
                            onlyCurrency
                          />
                        )}

                        {regularItems.length > 0 && (
                          <ProductGroup
                            title="Productos normales"
                            items={regularItems}
                            exchangeRate={order.exchangeRate}
                          />
                        )}

                        {order.fiscal && <FiscalSnapshotView fiscal={order.fiscal} />}
                      </div>
                    </div>

                    {isCashierModuleVisible && (
                      <div className="rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                              Cobro
                            </p>
                            <span
                              className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-xs font-black uppercase ${getPaymentStatusStyle(
                                orderPayment.status
                              )}`}
                            >
                              {orderPayment.status}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => openPaymentModal(order)}
                            className="rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.2)]"
                          >
                            Registrar cobro
                          </button>
                        </div>

                        <div className="mt-3 space-y-1 text-sm font-black text-[var(--brand-ink-3)]">
                          {orderTotals.totalCombosUSD > 0 && (
                            <p>Combos solo divisas: {formatUSD(orderTotals.totalCombosUSD)}</p>
                          )}
                          {orderTotals.totalRegularUSD > 0 && (
                            <p>
                              Productos normales: {formatUSD(orderTotals.totalRegularUSD)} / Bs {formatVES(orderTotals.totalRegularVES)}
                            </p>
                          )}
                          {isDelivery && (
                            <p>Delivery: {formatUSD(orderTotals.deliveryCostUSD)}</p>
                          )}
                          <p className="text-[var(--brand-primary)]">
                            Total final: {formatUSD(orderTotals.totalUSD)}
                          </p>
                        </div>

                        <div className={`mt-3 grid gap-2 ${isDelivery ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                          <InfoBox
                            label="Recibido equiv."
                            value={formatUSD(orderPayment.receivedEquivalentUSD)}
                          />
                          <InfoBox
                            label="Pendiente"
                            value={formatUSD(orderPayment.pendingUSD)}
                          />
                          {isDelivery && (
                            <InfoBox
                              label="Delivery pago"
                              value={orderPayment.deliveryPaymentIn}
                            />
                          )}
                        </div>

                        {(orderPayment.amountReceivedUSD > 0 ||
                          orderPayment.amountReceivedVES > 0) && (
                          <div className="mt-3 rounded-2xl bg-[var(--brand-surface-2)] px-3 py-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                            {orderPayment.amountReceivedUSD > 0 && (
                              <p>
                                Divisas recibidas: {formatUSD(orderPayment.amountReceivedUSD)}
                                {orderPayment.paymentMethodUSD
                                  ? ` · ${orderPayment.paymentMethodUSD}`
                                  : ""}
                              </p>
                            )}
                            {orderPayment.amountReceivedVES > 0 && (
                              <p>
                                Bolívares recibidos: Bs {formatVES(orderPayment.amountReceivedVES)}
                                {orderPayment.paymentMethodVES
                                  ? ` · ${orderPayment.paymentMethodVES}`
                                  : ""}
                              </p>
                            )}
                            {orderPayment.paymentNote && (
                              <p>Nota: {orderPayment.paymentNote}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {order.customerNote && (
                      <div className="rounded-[1.4rem] border-2 border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)] p-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-amber)]">
                          Nota general
                        </p>
                        <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]">
                          {order.customerNote}
                        </p>
                      </div>
                    )}

                    {order.attachmentImageUrl && (
                      <a
                        href={order.attachmentImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-3 transition hover:bg-[rgba(var(--brand-primary-rgb),0.08)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={order.attachmentImageUrl}
                          alt="Imagen del pedido"
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                        <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                          Imagen adjunta · toca para ampliar
                        </span>
                      </a>
                    )}

                    <OrderPaymentProofsList
                      proofs={paymentProofs.filter(
                        (proof) => proof.orderId === order.id,
                      )}
                    />

                    <div className="grid gap-2 sm:grid-cols-2">
                      {primaryAction && (
                        <button
                          type="button"
                          onClick={() => updateStatus(order.id, primaryAction.nextStatus)}
                          className={`rounded-full px-5 py-3 text-xs font-black uppercase tracking-[0.12em] transition ${primaryAction.className}`}
                        >
                          {primaryAction.label}
                        </button>
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

      {isCloseModalOpen && (
        <ModalShell onClose={() => setIsCloseModalOpen(false)} title="Cierre del día">
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Resumen principal
                  </p>
                  <h2 className="mt-1 text-3xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_2px_0_rgba(var(--brand-accent-rgb),0.75)]">
                    Cierre operativo
                  </h2>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    Revisa primero los números generales. Los detalles quedan organizados abajo en secciones desplegables para no sobrecargar la pantalla.
                  </p>
                </div>

                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                    hasCloseReviewWarnings
                      ? "border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)] text-[var(--brand-amber)]"
                      : "border-green-600 bg-green-500/10 text-green-300"
                  }`}
                >
                  {hasCloseReviewWarnings ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
                  {hasCloseReviewWarnings ? "Revisar antes de cerrar" : "Cierre limpio"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoBox label="Fecha" value={dayStats.dateLabel} />
                <InfoBox
                  label="Total vendido"
                  value={formatUSD(dayStats.realPaymentTotals.totalSoldUSD)}
                />
                <InfoBox
                  label="Cobrado real"
                  value={formatUSD(dayStats.realPaymentTotals.realCollectedUSD)}
                />
                <InfoBox
                  label="Pendiente"
                  value={formatUSD(dayStats.realPaymentTotals.realPendingUSD)}
                />
                <InfoBox
                  label="Gastos"
                  value={formatUSD(dayExpenseTotals.equivalentUSD)}
                />
                <InfoBox
                  label="Neto estimado"
                  value={formatUSD(
                    roundMoney(
                      dayStats.realPaymentTotals.realCollectedUSD -
                        dayExpenseTotals.equivalentUSD
                    )
                  )}
                />
                <InfoBox
                  label="Pedidos hoy"
                  value={String(dayStats.ordersToday.length)}
                />
                <InfoBox
                  label="Activos"
                  value={String(dayStats.activeToday.length)}
                />
              </div>
            </div>

            <div
              className={`rounded-[1.4rem] border-2 p-4 ${
                hasCloseReviewWarnings
                  ? "border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)]"
                  : "border-green-500/35 bg-green-500/10"
              }`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p
                    className={`text-xs font-black uppercase tracking-[0.18em] ${
                      hasCloseReviewWarnings ? "text-[var(--brand-amber)]" : "text-green-300"
                    }`}
                  >
                    Alertas antes de cerrar
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                    Estos puntos no bloquean el cierre, pero ayudan a evitar errores de caja, delivery o inventario.
                  </p>
                </div>

                <span className="rounded-full bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]">
                  {closeReviewItems.length} punto(s)
                </span>
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {closeReviewItems.slice(0, 4).map((item) => {
                  const classes = getCloseReviewItemClasses(item.tone)

                  return (
                    <div
                      key={`${item.title}-${item.value}`}
                      className={`rounded-2xl border-2 px-4 py-3 ${classes.wrapper}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-sm font-black uppercase ${classes.title}`}>
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                            {item.description}
                          </p>
                        </div>
                        <p className={`shrink-0 text-sm font-black ${classes.value}`}>
                          {item.value}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {closeReviewItems.length > 4 && (
                <p className="mt-3 rounded-2xl bg-[var(--brand-surface-2)] px-4 py-3 text-xs font-black text-[var(--brand-ink-2)]/70">
                  Hay {closeReviewItems.length - 4} punto(s) adicional(es). Abre “Alertas completas” para revisarlos todos.
                </p>
              )}
            </div>

            <CloseDetailSection
              title="Detalle de cobros"
              description="Divisas, bolívares, métodos de pago y estado de los cobros reales."
              defaultOpen
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoBox
                  label="Divisas recibidas"
                  value={formatUSD(dayStats.realPaymentTotals.realCashUSD)}
                />
                <InfoBox
                  label="Bolívares recibidos"
                  value={`Bs ${formatVES(dayStats.realPaymentTotals.realVES)}`}
                />
                <InfoBox
                  label="Equiv. Bs en USD"
                  value={formatUSD(dayStats.realPaymentTotals.realVESEquivalentUSD)}
                />
                <InfoBox
                  label="Pedidos pagados"
                  value={String(dayStats.realPaymentTotals.paidOrders)}
                />
                <InfoBox
                  label="Pago parcial"
                  value={String(dayStats.realPaymentTotals.partialPaymentOrders)}
                />
                <InfoBox
                  label="Pendientes"
                  value={String(dayStats.realPaymentTotals.pendingPaymentOrders)}
                />
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <PaymentSummaryList
                  title="Ventas por vendedor"
                  emptyText="Todavía no hay cobros con vendedor."
                  items={dayStats.salesBySeller}
                />

                <PaymentSummaryList
                  title="Cobros por estado"
                  emptyText="Todavía no hay cobros registrados."
                  items={dayStats.paymentByStatus}
                />

                <PaymentSummaryList
                  title="Cobros en divisas"
                  emptyText="Todavía no hay divisas registradas."
                  items={dayStats.paymentByUSDMethod}
                />

                <PaymentSummaryList
                  title="Cobros en bolívares"
                  emptyText="Todavía no hay bolívares registrados."
                  items={dayStats.paymentByVESMethod}
                  showVES
                />
              </div>
            </CloseDetailSection>

            <CloseDetailSection
              title="Detalle de pedidos"
              description="Estado operativo de los pedidos del día y ventas confirmadas por entrega."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoBox label="Registrados" value={String(dayStats.ordersToday.length)} />
                <InfoBox label="Entregados" value={String(dayStats.deliveredToday.length)} />
                <InfoBox label="Activos" value={String(dayStats.activeToday.length)} />
                <InfoBox label="Cancelados" value={String(dayStats.canceledToday.length)} />
                <InfoBox
                  label="Total entregado"
                  value={formatUSD(dayStats.deliveredTotals.totalUSD)}
                />
                <InfoBox
                  label="Venta de productos"
                  value={formatUSD(
                    dayStats.deliveredTotals.totalUSD -
                      dayStats.deliveredTotals.deliveryCostUSD
                  )}
                />
                <InfoBox
                  label="Combos"
                  value={formatUSD(dayStats.deliveredTotals.totalCombosUSD)}
                />
                <InfoBox
                  label="Productos normales"
                  value={formatUSD(dayStats.deliveredTotals.totalRegularUSD)}
                />
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <SummaryList
                  title="Ventas por tipo"
                  emptyText="Todavía no hay ventas entregadas."
                  items={dayStats.deliveredByType}
                />

                <div className="rounded-[1.4rem] border-2 border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-amber)]">
                    Pendiente por entregar
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <InfoBox
                      label="Total pendiente"
                      value={formatUSD(dayStats.activeTotals.totalUSD)}
                    />
                    <InfoBox
                      label="Delivery pendiente"
                      value={formatUSD(dayStats.activeTotals.deliveryCostUSD)}
                    />
                  </div>
                </div>
              </div>
            </CloseDetailSection>

            <CloseDetailSection
              title="Delivery"
              description="Pedidos a domicilio, zonas, métodos indicados y forma real de cobro del delivery."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoBox label="Delivery registrados" value={String(dayStats.deliveryToday.length)} />
                <InfoBox label="Delivery entregados" value={String(dayStats.deliveredDeliveryToday.length)} />
                <InfoBox label="Delivery activos" value={String(dayStats.activeDeliveryToday.length)} />
                <InfoBox
                  label="Delivery total"
                  value={formatUSD(dayStats.realPaymentTotals.deliveryTotalRegisteredUSD)}
                />
                <InfoBox
                  label="Forma registrada"
                  value={formatUSD(dayStats.realPaymentTotals.deliveryWithPaymentMethodUSD)}
                />
                <InfoBox
                  label="Sin forma registrada"
                  value={formatUSD(dayStats.realPaymentTotals.deliveryWithoutPaymentMethodUSD)}
                />
              </div>

              {dayStats.realPaymentTotals.deliveryWithoutPaymentMethodUSD > 0 && (
                <p className="mt-3 rounded-2xl border-2 border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)] px-4 py-3 text-xs font-black leading-5 text-[var(--brand-amber)]">
                  Hay delivery con costo registrado, pero todavía sin forma de cobro marcada. Revisa los pedidos pendientes o parciales antes de cerrar caja.
                </p>
              )}

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <PaymentSummaryList
                  title="Forma real de cobro"
                  emptyText="Todavía no hay delivery marcado como cobrado."
                  items={dayStats.deliveryByPaymentIn}
                  showDelivery
                  showVES
                />

                <SummaryList
                  title="Método indicado en pedido"
                  emptyText="Todavía no hay deliveries entregados."
                  items={dayStats.deliveredByPayment}
                  showDelivery
                />

                <SummaryList
                  title="Delivery por zona"
                  emptyText="Todavía no hay deliveries entregados."
                  items={dayStats.deliveredByZone}
                  showDelivery
                />
              </div>
            </CloseDetailSection>

            <CloseDetailSection
              title="Gastos y proveedores"
              description="Salidas de caja, compras de inventario, proveedores, categorías y métodos de gasto."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoBox label="Gastos registrados" value={String(dayExpenseTotals.count)} />
                <InfoBox
                  label="Total gastos"
                  value={formatUSD(dayExpenseTotals.equivalentUSD)}
                />
                <InfoBox
                  label="En divisas"
                  value={formatUSD(dayExpenseTotals.amountUSD)}
                />
                <InfoBox
                  label="En bolívares"
                  value={`Bs ${formatVES(dayExpenseTotals.amountVES)}`}
                />
              </div>

              {expenseCloseBreakdown.expensesWithoutProvider.length > 0 && (
                <p className="mt-3 rounded-2xl border-2 border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)] px-4 py-3 text-xs font-black leading-5 text-[var(--brand-amber)]">
                  Hay {expenseCloseBreakdown.expensesWithoutProvider.length} gasto(s) sin proveedor. No bloquea el cierre, pero conviene completarlo para que el historial sea más útil.
                </p>
              )}

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <ExpenseSummaryList
                  title="Gastos por proveedor"
                  emptyText="Todavía no hay gastos por proveedor para mostrar."
                  items={expenseCloseBreakdown.byProvider}
                />
                <ExpenseSummaryList
                  title="Gastos por tipo"
                  emptyText="Todavía no hay tipos de gasto para mostrar."
                  items={expenseCloseBreakdown.byType}
                />
                <ExpenseSummaryList
                  title="Gastos por categoría"
                  emptyText="Todavía no hay categorías de gasto para mostrar."
                  items={expenseCloseBreakdown.byCategory}
                />
                <ExpenseSummaryList
                  title="Gastos por método"
                  emptyText="Todavía no hay métodos de gasto para mostrar."
                  items={expenseCloseBreakdown.byMethod}
                />
              </div>

              <div className="mt-3 rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Gastos registrados hoy
                </p>
                {dayExpenses.length === 0 ? (
                  <p className="mt-3 rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                    Todavía no hay gastos registrados.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {dayExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                              {expense.concept || "Gasto"}
                            </p>
                            <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                              {expense.expenseType || "Gasto operativo"} · {expense.category || "Otros"} · {expense.method || "Sin registrar"}
                              {expense.provider ? ` · ${expense.provider}` : " · Sin proveedor"}
                            </p>
                            {expense.inventoryLinked && expense.inventoryItemName && (
                              <p className="mt-1 text-xs font-black text-green-300">
                                Inventario: {expense.inventoryItemName} +{expense.inventoryQuantity || 0} {expense.inventoryUnit || "unidades"}
                              </p>
                            )}
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-base font-black text-[var(--brand-primary)]">
                              {formatUSD(expense.equivalentUSD)}
                            </p>
                            {expense.amountVES > 0 && (
                              <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                                Bs {formatVES(expense.amountVES)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CloseDetailSection>

            <CloseDetailSection
              title="Inventario y recetas"
              description="Compras que sumaron inventario y revisión rápida de movimientos relacionados con el cierre."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoBox
                  label="Compras con inventario"
                  value={String(expenseCloseBreakdown.inventoryLinkedExpenses.length)}
                />
                <InfoBox
                  label="Compras sin inventario"
                  value={String(
                    Math.max(
                      dayExpenseTotals.count -
                        expenseCloseBreakdown.inventoryLinkedExpenses.length,
                      0
                    )
                  )}
                />
                <InfoBox
                  label="Productos vendidos"
                  value={String(dayStats.productsSold.length)}
                />
              </div>

              <p className="mt-3 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                Los descuentos por receta se ejecutan cuando los pedidos se marcan como entregados. Esta sección resume las compras que sumaron inventario desde gastos y los productos vendidos que conviene revisar contra recetas.
              </p>

              {expenseCloseBreakdown.inventoryLinkedExpenses.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                  Hoy no hay compras marcadas como entrada de inventario.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {expenseCloseBreakdown.inventoryLinkedExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-black uppercase text-green-300">
                            {expense.inventoryItemName}
                          </p>
                          <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                            {expense.concept || "Compra"} · {expense.provider || "Sin proveedor"}
                          </p>
                        </div>
                        <p className="text-sm font-black text-green-300">
                          +{expense.inventoryQuantity || 0} {expense.inventoryUnit || "unidades"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CloseDetailSection>

            <CloseDetailSection
              title="Productos vendidos"
              description="Ranking del día para revisar qué se movió antes de guardar el cierre."
            >
              {dayStats.productsSold.length === 0 ? (
                <p className="rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                  Todavía no hay productos entregados para mostrar.
                </p>
              ) : (
                <div className="space-y-2">
                  {dayStats.productsSold.map((product, index) => (
                    <div
                      key={product.name}
                      className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                            {index + 1}. {product.name}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                            {product.quantity} unidad(es){product.onlyCurrency ? " · Solo divisas" : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black text-[var(--brand-primary)]">
                            {formatUSD(product.totalUSD)}
                          </p>
                          {!product.onlyCurrency && product.totalVES > 0 && (
                            <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                              Bs {formatVES(product.totalVES)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CloseDetailSection>

            <CloseDetailSection
              title="Alertas completas"
              description="Lista completa de puntos detectados antes del cierre."
            >
              <div className="space-y-2">
                {closeReviewItems.map((item) => {
                  const classes = getCloseReviewItemClasses(item.tone)

                  return (
                    <div
                      key={`${item.title}-${item.value}`}
                      className={`rounded-2xl border-2 px-4 py-3 ${classes.wrapper}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${classes.icon}`}>
                          {item.tone === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <p className={`text-sm font-black uppercase ${classes.title}`}>
                              {item.title}
                            </p>
                            <p className={`text-sm font-black ${classes.value}`}>
                              {item.value}
                            </p>
                          </div>
                          <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CloseDetailSection>

            <CloseDetailSection
              title="Resumen para copiar"
              description="Texto completo para enviar o guardar fuera del sistema."
            >
              <pre className="max-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[var(--brand-surface-2)] p-4 text-sm font-bold leading-6 text-[var(--brand-ink-2)]">
                {closeSummaryText}
              </pre>
            </CloseDetailSection>

            {closeSummaryMessage && (
              <div className="rounded-2xl border-2 border-green-500/30 bg-green-500/10 px-4 py-3">
                <p className="text-sm font-black text-green-300">
                  {closeSummaryMessage}
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyCloseSummary}
                className="w-full rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
              >
                Copiar resumen
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsResetReviewVisible(true)
                  setIsResetModalOpen(true)
                }}
                className="w-full rounded-full bg-red-700 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Guardar cierre y reiniciar pedidos
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {isResetModalOpen && (
        <ModalShell onClose={() => setIsResetModalOpen(false)} title="Revisión antes de cerrar">
          <div className="space-y-4">
            <div
              className={`rounded-[1.4rem] border-2 p-4 ${
                hasCloseReviewWarnings
                  ? "border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)]"
                  : "border-green-500/35 bg-green-500/10"
              }`}
            >
              <div className="flex gap-3">
                {hasCloseReviewWarnings ? (
                  <AlertTriangle className="mt-1 shrink-0 text-[var(--brand-amber)]" size={26} />
                ) : (
                  <CheckCircle2 className="mt-1 shrink-0 text-green-300" size={26} />
                )}
                <div>
                  <p
                    className={`text-sm font-black uppercase ${
                      hasCloseReviewWarnings ? "text-[var(--brand-amber)]" : "text-green-300"
                    }`}
                  >
                    {hasCloseReviewWarnings
                      ? "Hay puntos que conviene revisar antes de reiniciar."
                      : "El cierre parece listo para reiniciar."}
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                    Al confirmar, el sistema guardará el cierre del día en el historial y después borrará los pedidos actuales de la pantalla operativa.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoBox
                label="Pedidos de hoy"
                value={String(dayStats.ordersToday.length)}
              />
              <InfoBox
                label="Cobrado real"
                value={formatUSD(dayStats.realPaymentTotals.realCollectedUSD)}
              />
              <InfoBox
                label="Pendiente"
                value={formatUSD(dayStats.realPaymentTotals.realPendingUSD)}
              />
            </div>

            <CloseReviewPanel
              items={closeReviewItems}
              isVisible={isResetReviewVisible}
              onToggle={() =>
                setIsResetReviewVisible((currentValue) => !currentValue)
              }
            />

            <div className="rounded-[1.4rem] border-2 border-red-500/35 bg-red-500/10 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="mt-1 shrink-0 text-red-600" size={26} />
                <div>
                  <p className="text-sm font-black uppercase text-red-300">
                    Esta acción reinicia el día operativo.
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-red-300/80">
                    Si continúas, primero se intentará guardar el cierre. Si el cierre no se guarda, el sistema no debería borrar los pedidos.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Escribe REINICIAR para confirmar
              </label>
              <input
                value={resetConfirmationText}
                onChange={(event) => setResetConfirmationText(event.target.value)}
                placeholder="REINICIAR"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
              />
              <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                Esta palabra evita reinicios accidentales. Puedes volver al panel para corregir pedidos antes de cerrar.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setIsResetModalOpen(false)
                  setIsCloseModalOpen(false)
                  setResetConfirmationText("")
                }}
                disabled={isResettingDay}
                className="rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
              >
                Volver a revisar pedidos
              </button>

              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResettingDay}
                className="rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
              >
                Seguir viendo cierre
              </button>

              <button
                type="button"
                onClick={resetDayOrders}
                disabled={isResettingDay}
                className="flex items-center justify-center gap-3 rounded-full bg-red-700 px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
              >
                {isResettingDay && <Loader2 size={18} className="animate-spin" />}
                Cerrar de todos modos
              </button>
            </div>
          </div>
        </ModalShell>
      )}


      {isExpensesModalOpen && (
        <ModalShell
          onClose={() => {
            if (!isSavingExpense && !deletingExpenseId) {
              setIsExpensesModalOpen(false)
              setExpenseMessage(null)
            }
          }}
          title="Gastos del día"
        >
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Control de salidas de caja
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                Registra gastos de hoy como compras, pagos, motorizado o servicios. Estos gastos se integran al cierre del día para mostrar el neto estimado.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoBox
                label="Gastos registrados"
                value={String(dayExpenseTotals.count)}
              />
              <InfoBox
                label="Total equiv. USD"
                value={formatUSD(dayExpenseTotals.equivalentUSD)}
              />
              <InfoBox
                label="Bolívares gastados"
                value={`Bs ${formatVES(dayExpenseTotals.amountVES)}`}
              />
            </div>

            <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Nuevo gasto
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Concepto frecuente o insumo del inventario
                  </label>
                  <select
                    value={selectedExpenseQuickConceptId}
                    onChange={(event) =>
                      selectExpenseQuickConcept(event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                  >
                    <option value="">Selecciona un gasto rápido o insumo guardado</option>
                    {expenseQuickConcepts.map((concept) => (
                      <option key={concept.id} value={concept.id}>
                        {concept.name}
                        {concept.relatedInventory ? " · puede sumar inventario" : ""}
                      </option>
                    ))}
                    <option value={CUSTOM_EXPENSE_CONCEPT_ID}>
                      Escribir otro
                    </option>
                  </select>
                  <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                    Al seleccionar un concepto frecuente o un insumo ya guardado, se completa la categoría y se conecta con inventario para evitar nombres duplicados.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Concepto
                  </label>
                  <input
                    value={expenseForm.concept}
                    onChange={(event) => {
                      updateExpenseForm("concept", event.target.value)
                      if (selectedExpenseQuickConceptId !== CUSTOM_EXPENSE_CONCEPT_ID) {
                        setSelectedExpenseQuickConceptId(CUSTOM_EXPENSE_CONCEPT_ID)
                      }
                    }}
                    placeholder="Ej: compra de pan, pago motorizado, salsas"
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Proveedor
                  </label>
                  <input
                    value={expenseForm.provider}
                    onChange={(event) =>
                      updateExpenseForm("provider", event.target.value)
                    }
                    placeholder="Ej: Distribuidora, mercado, motorizado"
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Tipo
                  </label>
                  <select
                    value={expenseForm.expenseType}
                    onChange={(event) =>
                      updateExpenseForm("expenseType", event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                  >
                    {EXPENSE_TYPES.map((expenseType) => (
                      <option key={expenseType} value={expenseType}>
                        {expenseType}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Categoría
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={(event) =>
                      updateExpenseForm("category", event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Método
                  </label>
                  <select
                    value={expenseForm.method}
                    onChange={(event) =>
                      updateExpenseForm("method", event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                  >
                    {EXPENSE_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Monto en divisas
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={expenseForm.amountUSD}
                    onChange={(event) =>
                      updateExpenseForm("amountUSD", event.target.value)
                    }
                    placeholder="Ej: 10.00"
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Monto en bolívares
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={expenseForm.amountVES}
                    onChange={(event) =>
                      updateExpenseForm("amountVES", event.target.value)
                    }
                    placeholder="Ej: 650.00 o 650,00"
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Equivalente USD manual
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={expenseForm.equivalentUSD}
                    onChange={(event) =>
                      updateExpenseForm("equivalentUSD", event.target.value)
                    }
                    placeholder="Opcional. Útil si no hay tasa del día."
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                  />
                  <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                    Estimado actual: {formatUSD(expenseDraftEquivalentUSD)}
                    {latestExpenseExchangeRate > 0
                      ? ` usando tasa Bs ${formatVES(latestExpenseExchangeRate)}`
                      : " · escribe equivalente manual si el gasto fue en bolívares"}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Nota
                  </label>
                  <textarea
                    value={expenseForm.note}
                    onChange={(event) =>
                      updateExpenseForm("note", event.target.value)
                    }
                    placeholder="Detalle opcional del gasto."
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>

                <div className="sm:col-span-2 rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        <PackageCheck size={16} />
                        Relación con inventario
                      </p>
                      <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                        Si este gasto fue una compra de materia prima o productos, también puedes sumar la entrada al inventario.
                      </p>
                    </div>

                    <label className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-3 text-xs font-black uppercase tracking-[0.1em] ${
                      isInventoryModuleVisible
                        ? "cursor-pointer border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                        : "cursor-not-allowed border-[var(--brand-border)] bg-[var(--brand-cream)] text-[var(--brand-primary)]/55"
                    }`}>
                      <input
                        type="checkbox"
                        checked={linkExpenseToInventory && isInventoryModuleVisible}
                        onChange={(event) => {
                          setLinkExpenseToInventory(event.target.checked)
                          if (event.target.checked) {
                            loadExpenseInventory(true)
                          }
                        }}
                        disabled={!isInventoryModuleVisible}
                        className="h-4 w-4 accent-[var(--brand-primary)]"
                      />
                      Sumar al inventario
                    </label>
                  </div>

                  {!isInventoryModuleVisible && (
                    <p className="mt-3 rounded-2xl border-2 border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)] px-4 py-3 text-xs font-black leading-5 text-[var(--brand-amber)]">
                      Inventario no está activo en este plan. El gasto puede guardarse normalmente, pero no se sumará mercancía.
                    </p>
                  )}

                  {linkExpenseToInventory && isInventoryModuleVisible && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updateExpenseInventoryForm("mode", "existing")}
                          className={`rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                            expenseInventoryForm.mode === "existing"
                              ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                              : "border-[var(--brand-primary)] bg-[var(--brand-surface-2)] text-[var(--brand-primary)]"
                          }`}
                        >
                          Producto existente
                        </button>
                        <button
                          type="button"
                          onClick={() => updateExpenseInventoryForm("mode", "new")}
                          className={`rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                            expenseInventoryForm.mode === "new"
                              ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                              : "border-[var(--brand-primary)] bg-[var(--brand-surface-2)] text-[var(--brand-primary)]"
                          }`}
                        >
                          Nuevo producto
                        </button>
                        <button
                          type="button"
                          onClick={() => loadExpenseInventory()}
                          disabled={isLoadingExpenseInventory}
                          className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                        >
                          {isLoadingExpenseInventory ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                          Inventario
                        </button>
                      </div>

                      {expenseInventoryForm.mode === "existing" ? (
                        <div className="sm:col-span-2">
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Producto existente
                          </label>
                          <select
                            value={expenseInventoryForm.itemId}
                            onChange={(event) => updateExpenseInventoryForm("itemId", event.target.value)}
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          >
                            <option value="">Selecciona un producto</option>
                            {expenseInventory.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} · {item.quantity} {item.unit}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                              Nombre en inventario
                            </label>
                            <input
                              value={expenseInventoryForm.name}
                              onChange={(event) => updateExpenseInventoryForm("name", event.target.value)}
                              placeholder="Ej: Pan, salchichas, papas"
                              className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                              Categoría inventario
                            </label>
                            <select
                              value={expenseInventoryForm.category}
                              onChange={(event) => updateExpenseInventoryForm("category", event.target.value)}
                              className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                            >
                              {EXPENSE_CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

                      <div>
                        <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Cantidad que entra
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={expenseInventoryForm.quantity}
                          onChange={(event) => updateExpenseInventoryForm("quantity", event.target.value)}
                          placeholder="Ej: 24"
                          className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Unidad
                        </label>
                        <select
                          value={expenseInventoryForm.unit}
                          onChange={(event) => updateExpenseInventoryForm("unit", event.target.value)}
                          disabled={expenseInventoryForm.mode === "existing"}
                          className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)] disabled:opacity-60"
                        >
                          {EXPENSE_INVENTORY_UNIT_OPTIONS.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </div>

                      {expenseInventoryForm.mode === "new" && (
                        <div className="sm:col-span-2">
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Stock mínimo
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={expenseInventoryForm.minimumStock}
                            onChange={(event) => updateExpenseInventoryForm("minimumStock", event.target.value)}
                            placeholder="Opcional"
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          />
                        </div>
                      )}

                      <div className="sm:col-span-2">
                        <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Nota para inventario
                        </label>
                        <input
                          value={expenseInventoryForm.note}
                          onChange={(event) => updateExpenseInventoryForm("note", event.target.value)}
                          placeholder="Opcional. Ej: compra de la mañana"
                          className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

                <details className="sm:col-span-2 rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Editar conceptos frecuentes
                  </summary>

                  <div className="mt-4 space-y-4">
                    <p className="text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                      Agrega o quita opciones rápidas para no escribir siempre los mismos gastos. Esta lista queda guardada en este dispositivo.
                    </p>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {expenseQuickConcepts.map((concept) => (
                        <div
                          key={concept.id}
                          className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                                {concept.name}
                              </p>
                              <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                                {concept.category} · {concept.unit}
                              </p>
                              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                                {concept.relatedInventory
                                  ? "Puede sugerir entrada de inventario"
                                  : "Solo gasto, sin inventario"}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeExpenseQuickConcept(concept.id)}
                              className="rounded-full bg-red-500/100/15 p-2 text-red-300"
                              aria-label={`Eliminar ${concept.name}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-[1.2rem] border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        Agregar concepto
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Nombre
                          </label>
                          <input
                            value={newExpenseQuickConceptName}
                            onChange={(event) =>
                              setNewExpenseQuickConceptName(event.target.value)
                            }
                            placeholder="Ej: Carbón, aceite, gas, hielo"
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Categoría sugerida
                          </label>
                          <select
                            value={newExpenseQuickConceptCategory}
                            onChange={(event) =>
                              setNewExpenseQuickConceptCategory(event.target.value)
                            }
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          >
                            {EXPENSE_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Unidad sugerida
                          </label>
                          <select
                            value={newExpenseQuickConceptUnit}
                            onChange={(event) =>
                              setNewExpenseQuickConceptUnit(event.target.value)
                            }
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          >
                            {EXPENSE_INVENTORY_UNIT_OPTIONS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </div>

                        <label className="sm:col-span-2 inline-flex items-center gap-2 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-sm font-black text-[var(--brand-ink)]">
                          <input
                            type="checkbox"
                            checked={newExpenseQuickConceptRelatedInventory}
                            onChange={(event) =>
                              setNewExpenseQuickConceptRelatedInventory(event.target.checked)
                            }
                            className="h-4 w-4 accent-[var(--brand-primary)]"
                          />
                          Puede relacionarse con inventario
                        </label>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={addExpenseQuickConcept}
                          className="rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
                        >
                          Agregar concepto
                        </button>

                        <button
                          type="button"
                          onClick={resetExpenseQuickConcepts}
                          className="rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                        >
                          Restaurar lista base
                        </button>
                      </div>
                    </div>
                  </div>
                </details>


              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={saveDayExpense}
                  disabled={isSavingExpense}
                  className="flex items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
                >
                  {isSavingExpense && <Loader2 size={18} className="animate-spin" />}
                  Guardar gasto
                </button>

                <button
                  type="button"
                  onClick={resetExpenseForm}
                  disabled={isSavingExpense}
                  className="rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                >
                  Limpiar formulario
                </button>
              </div>
            </div>

            {expenseMessage && (
              <p className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-sm font-black text-[var(--brand-ink-2)]">
                {expenseMessage}
              </p>
            )}

            <div className="rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Gastos registrados hoy
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    {dayExpenseTotals.count} gasto(s) · {formatUSD(dayExpenseTotals.equivalentUSD)} estimado(s)
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAreExpensesVisible((value) => !value)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
                  >
                    {areExpensesVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    {areExpensesVisible ? "Ocultar lista" : "Mostrar lista"}
                  </button>

                  <button
                    type="button"
                    onClick={() => loadDayExpenses(adminPassword)}
                    disabled={isLoadingExpenses}
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                  >
                    {isLoadingExpenses ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Actualizar
                  </button>
                </div>
              </div>

              {areExpensesVisible ? (
                dayExpenses.length === 0 ? (
                  <p className="mt-4 rounded-2xl bg-[var(--brand-cream)] px-4 py-4 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    Todavía no hay gastos registrados para hoy.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {dayExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-base font-black uppercase text-[var(--brand-ink-3)]">
                              {expense.concept || "Gasto"}
                            </p>
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                              {expense.expenseType || "Gasto operativo"} · {expense.category || "Otros"} · {expense.method || "Sin registrar"}
                            </p>
                            {expense.provider && (
                              <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60">
                                Proveedor: {expense.provider}
                              </p>
                            )}
                            {expense.inventoryLinked && expense.inventoryItemName && (
                              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                                Inventario: {expense.inventoryItemName} +{expense.inventoryQuantity || 0} {expense.inventoryUnit || "unidades"}
                              </p>
                            )}
                            {expense.note && (
                              <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                                {expense.note}
                              </p>
                            )}
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-lg font-black text-[var(--brand-primary)]">
                              {formatUSD(expense.equivalentUSD)}
                            </p>
                            {expense.amountUSD > 0 && (
                              <p className="text-xs font-black text-[var(--brand-ink-2)]/65">
                                Divisas {formatUSD(expense.amountUSD)}
                              </p>
                            )}
                            {expense.amountVES > 0 && (
                              <p className="text-xs font-black text-[var(--brand-ink-2)]/65">
                                Bs {formatVES(expense.amountVES)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold text-[var(--brand-ink-2)]/55">
                            {expense.dateLabel || expense.dateValue || "Hoy"}
                          </p>

                          {canDeleteExpenses && (
                            <button
                              type="button"
                              onClick={() => deleteDayExpense(expense.id)}
                              disabled={deletingExpenseId === expense.id}
                              className="inline-flex items-center gap-2 rounded-full bg-red-500/100/15 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-300 disabled:opacity-50"
                            >
                              {deletingExpenseId === expense.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <p className="mt-4 rounded-2xl border-2 border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)] px-4 py-3 text-sm font-bold leading-6 text-[var(--brand-amber)]">
                  Lista oculta. Hay {dayExpenseTotals.count} gasto(s) por {formatUSD(dayExpenseTotals.equivalentUSD)}.
                </p>
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {isLocationsModalOpen && (
        <ModalShell onClose={() => setIsLocationsModalOpen(false)} title="Mesas y ubicaciones">
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Mapa operativo del local
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    Estas mesas se guardan en la configuración real del negocio. El estado se calcula con pedidos activos, cuentas abiertas y cobros pendientes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    loadOrders(adminPassword, true)
                    loadOpenAccounts(adminPassword, false)
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.2)]"
                >
                  <RefreshCw size={16} />
                  Actualizar
                </button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <span className="rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-xs font-black uppercase tracking-[0.10em] text-[var(--brand-ink)]">
                  Mesas activas: {orderLocations.length}
                </span>
                <span className="rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-xs font-black uppercase tracking-[0.10em] text-[var(--brand-ink)]">
                  Cuentas abiertas: {activeOpenAccounts.length}
                </span>
                <span className="rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-xs font-black uppercase tracking-[0.10em] text-[var(--brand-ink)]">
                  Por cobrar: {pendingOpenAccountsCount}
                </span>
              </div>
              {openAccountsMessage && (
                <p className="mt-3 rounded-2xl border-2 border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)] px-4 py-3 text-sm font-bold text-[var(--brand-amber)]">
                  {openAccountsMessage}
                </p>
              )}
            </div>

            <LocalTableQrLinksPanel
              tables={businessConfig.localTables}
              compact
              title="Enlaces QR para mesas"
              description="Copia el enlace de cada mesa para imprimirlo como QR o enviarlo al cliente. Al abrirlo, el menú público queda con la mesa preseleccionada."
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {orderLocations.map((location) => {
                const tableSummary = getLocalTableOperationalSummary(location, orders, activeOpenAccounts)
                const statusClass = getLocalTableStatusClass(tableSummary.status)

                return (
                  <div
                    key={location}
                    className={`rounded-2xl border-2 p-4 ${statusClass}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black uppercase text-[var(--brand-ink-3)]">{location}</p>
                        <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.12em] opacity-75">
                          {getLocalTableStatusLabel(tableSummary.status)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOrderLocation(location)}
                        disabled={isSavingLocations}
                        className="rounded-full bg-red-500/100/15 p-2 text-red-300 disabled:opacity-50"
                        aria-label={`Eliminar ${location}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
                      <span className="rounded-xl bg-[var(--brand-surface)]/85 px-3 py-2">
                        Activos: {tableSummary.activeOrders.length}
                      </span>
                      <span className="rounded-xl bg-[var(--brand-surface)]/85 px-3 py-2">
                        Pedidos: {Math.max(tableSummary.tableOrders.length, tableSummary.accountOrdersCount)}
                      </span>
                      <span className="rounded-xl bg-[var(--brand-surface)]/85 px-3 py-2">
                        Total: {formatUSD(tableSummary.totalUSD)}
                      </span>
                      <span className="rounded-xl bg-[var(--brand-surface)]/85 px-3 py-2">
                        Pendiente: {formatUSD(tableSummary.pendingUSD)}
                      </span>
                    </div>

                    {tableSummary.activeOpenAccounts.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        {tableSummary.activeOpenAccounts.slice(0, 2).map((account) => (
                          <p key={account.id} className="rounded-xl bg-[var(--brand-surface)]/90 px-3 py-2 text-[0.68rem] font-bold text-[var(--brand-ink-2)]">
                            Cuenta abierta · {account.customerName || account.tableNumber || "Mesa"} · Pendiente {formatUSD(getOpenAccountPendingUSD(account))}
                          </p>
                        ))}
                      </div>
                    ) : tableSummary.hasOpenAccount ? (
                      <p className="mt-3 rounded-xl bg-[var(--brand-surface)]/90 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em]">
                        Cuenta abierta asociada
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={newLocationName}
                onChange={(event) => setNewLocationName(event.target.value)}
                placeholder="Nueva mesa o ubicación"
                className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
              />
              <button
                type="button"
                onClick={addOrderLocation}
                disabled={isSavingLocations}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase text-[var(--brand-ink)] disabled:opacity-50"
              >
                {isSavingLocations ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Agregar
              </button>
            </div>

            {locationsMessage && (
              <p className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]">
                {locationsMessage}
              </p>
            )}

            <button
              type="button"
              onClick={restoreDefaultOrderLocations}
              disabled={isSavingLocations}
              className="w-full rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
            >
              Restaurar mesas base
            </button>
          </div>
        </ModalShell>
      )}


      {paymentModalOrder && paymentDraft && (
        <ModalShell
          onClose={() => {
            if (!isSavingPayment) {
              setSelectedPaymentOrder(null)
              setPaymentForm(EMPTY_PAYMENT_FORM)
              setPaymentMessage(null)
            }
          }}
          title="Registrar cobro"
        >
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                {getDisplayOrderNumber(paymentModalOrder)} · {paymentModalOrder.customerName || "Cliente"}
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                Registra aquí el dinero recibido por caja. El sistema calcula automáticamente si el pedido queda pagado, parcial o pendiente.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoBox
                label="Total pedido"
                value={formatUSD(paymentDraft.totalOrderUSD)}
              />
              <InfoBox
                label="Recibido equiv."
                value={formatUSD(paymentDraft.receivedEquivalentUSD)}
              />
              <InfoBox
                label="Pendiente"
                value={formatUSD(paymentDraft.pendingUSD)}
              />
            </div>

            <div className="rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Estado estimado
                </p>
                <span
                  className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-black uppercase ${getPaymentStatusStyle(
                    paymentDraft.status
                  )}`}
                >
                  {paymentDraft.status}
                </span>
              </div>

              <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                Tasa del pedido: Bs {formatVES(paymentModalOrder.exchangeRate)} por USD.
              </p>
            </div>

            {paymentDraft.status !== "Pagado" && (
              <div className="rounded-[1.4rem] border-2 border-yellow-400 bg-[rgba(var(--brand-primary-rgb),0.12)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-amber)]">
                  Ayuda rápida para completar el pendiente
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Pendiente actual: {formatUSD(paymentDraft.pendingUSD)}. En bolívares serían Bs {formatVES(pendingVESForPayment)} según la tasa del pedido.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={completePaymentPendingInVES}
                    disabled={paymentDraft.pendingUSD <= 0 || paymentExchangeRate <= 0}
                    className="rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                  >
                    Completar pendiente en Bs
                  </button>
                  <button
                    type="button"
                    onClick={completePaymentPendingInUSD}
                    disabled={paymentDraft.pendingUSD <= 0}
                    className="rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                  >
                    Completar pendiente en divisas
                  </button>
                </div>
              </div>
            )}

            {showLowVESWarning && (
              <div className="rounded-[1.4rem] border-2 border-red-500/35 bg-red-500/10 p-4">
                <p className="text-sm font-black leading-6 text-red-300">
                  Revisa el monto en bolívares: lo escrito equivale a menos de $0.20. Si querías cubrir el pendiente en Bs, usa el botón “Completar pendiente en Bs” o escribe el monto completo sin separador de miles.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Monto recibido en divisas
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={paymentForm.amountReceivedUSD}
                  onChange={(event) =>
                    updatePaymentForm("amountReceivedUSD", event.target.value)
                  }
                  placeholder="Ej: 35.00"
                  className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Método en divisas
                </label>
                <select
                  value={paymentForm.paymentMethodUSD}
                  onChange={(event) =>
                    updatePaymentForm("paymentMethodUSD", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                >
                  {paymentForm.paymentMethodUSD &&
                    !PAYMENT_METHOD_USD_OPTIONS.includes(paymentForm.paymentMethodUSD) && (
                      <option value={paymentForm.paymentMethodUSD}>
                        {paymentForm.paymentMethodUSD}
                      </option>
                    )}
                  {PAYMENT_METHOD_USD_OPTIONS.map((option) => (
                    <option key={option || "sin-metodo-divisas"} value={option}>
                      {option || "Sin registrar"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Monto recibido en bolívares reales
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={paymentForm.amountReceivedVES}
                  onChange={(event) =>
                    updatePaymentForm("amountReceivedVES", event.target.value)
                  }
                  placeholder="Ej: 1569.25 o 1569,25"
                  className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                />
                <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                  Escribe el monto real en bolívares, no el equivalente en dólares. Evita separador de miles: usa 1569.25 o 1569,25.
                </p>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Método en bolívares
                </label>
                <select
                  value={paymentForm.paymentMethodVES}
                  onChange={(event) =>
                    updatePaymentForm("paymentMethodVES", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                >
                  {paymentForm.paymentMethodVES &&
                    !PAYMENT_METHOD_VES_OPTIONS.includes(paymentForm.paymentMethodVES) && (
                      <option value={paymentForm.paymentMethodVES}>
                        {paymentForm.paymentMethodVES}
                      </option>
                    )}
                  {PAYMENT_METHOD_VES_OPTIONS.map((option) => (
                    <option key={option || "sin-metodo-bolivares"} value={option}>
                      {option || "Sin registrar"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {paymentModalIsDelivery && (
              <div>
                <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Delivery pagado en
                </label>
                <select
                  value={paymentForm.deliveryPaymentIn}
                  onChange={(event) =>
                    updatePaymentForm(
                      "deliveryPaymentIn",
                      event.target.value as DeliveryPaymentIn
                    )
                  }
                  className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                >
                  {DELIVERY_PAYMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                  Usa este campo solo para indicar cómo se cobró el costo de delivery.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Nota de pago
              </label>
              <textarea
                value={paymentForm.paymentNote}
                onChange={(event) =>
                  updatePaymentForm("paymentNote", event.target.value)
                }
                placeholder="Ejemplo: Cliente pagó productos mixto y delivery por pago móvil."
                rows={4}
                className="mt-2 w-full resize-none rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
              />
            </div>

            {paymentMessage && (
              <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3">
                <p className="text-sm font-black text-[var(--brand-ink-2)]">
                  {paymentMessage}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={savePayment}
              disabled={isSavingPayment}
              className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
            >
              {isSavingPayment && <Loader2 size={18} className="animate-spin" />}
              Guardar cobro
            </button>
          </div>
        </ModalShell>
      )}

    </main>
  )
}

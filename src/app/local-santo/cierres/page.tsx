"use client"

import Image from "next/image"
import { BRAND } from "@/lib/brand"
import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  LogIn,
  Printer,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { formatUSD, formatVES } from "@/utils/formatCurrency"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import {
  PAYMENT_FILTERS,
  REPORT_VIEW_MODES,
  buildDayClosesCsv,
  buildSingleCloseDetailedCsv,
  combineExpensesByField,
  createSafeFileName,
  formatDate,
  getCloseNetEstimatedUSD,
  getCloseNetAfterPurchasesUSD,
  getClosePaymentState,
  getCloseTitle,
  getDateInputValueDaysAgo,
  getDayCloseTotals,
  getInventoryExpenseTotals,
  getRangeAlerts,
  getRangeReport,
  getSingleCloseAlerts,
  getTodayDateInputValue,
  isCloseInsideDateRange,
  isReportViewMode,
  matchesPaymentFilter,
  normalizeDayCloses,
  readApiResponse,
  type DayCloseExpense,
  type LoginBoxProps,
  type PaymentFilter,
  type ProductSold,
  type ReportViewMode,
  type SavedDayClose,
  type SmartAlert,
  type SummaryItem,
} from "./domain"
import { downloadExcelFriendlyCsv, downloadTextFile } from "./downloads"

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"
const VIEW_MODE_STORAGE_KEY = "santo_perrito_closes_view_mode"

function downloadDayClosesCsv(dayCloses: SavedDayClose[], fileNameBase: string) {
  const csv = buildDayClosesCsv(dayCloses)
  const fileName = `${createSafeFileName(fileNameBase)}.csv`

  downloadExcelFriendlyCsv(fileName, csv)
}

function downloadCloseSummary(close: SavedDayClose) {
  const title = createSafeFileName(`${close.id}-${getCloseTitle(close)}`)

  downloadTextFile(
    `${title}.txt`,
    close.summaryText || "Sin resumen guardado.",
    "text/plain;charset=utf-8"
  )
}

function downloadSingleCloseCsv(close: SavedDayClose) {
  downloadDayClosesCsv([close], `${close.id}-${getCloseTitle(close)}`)
}

// Excel con TODO el detalle del cierre (vendedores, cobros, productos,
// gastos), listo para abrir sin transcribir nada a mano.
function downloadSingleCloseDetailedCsv(close: SavedDayClose) {
  const csv = buildSingleCloseDetailedCsv(close)
  const fileName = `${createSafeFileName(`${close.id}-${getCloseTitle(close)}-detallado`)}.csv`

  downloadExcelFriendlyCsv(fileName, csv)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function printCloseSummary(close: SavedDayClose) {
  const printWindow = window.open("", "_blank", "width=900,height=700")

  if (!printWindow) {
    window.alert("No se pudo abrir la ventana de impresión. Revisa si el navegador bloqueó ventanas emergentes.")
    return
  }

  const title = `Cierre ${BRAND.name} - ${getCloseTitle(close)}`
  const summary = close.summaryText || "Sin resumen guardado."

  printWindow.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 32px;
      color: var(--brand-ink-3);
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.45;
    }
    h1 {
      margin: 0 0 8px;
      color: var(--brand-primary);
      font-size: 28px;
      text-transform: uppercase;
    }
    p {
      margin: 0 0 20px;
      font-weight: 700;
      color: #5a2525;
    }
    pre {
      white-space: pre-wrap;
      border: 2px solid var(--brand-primary);
      border-radius: 18px;
      padding: 18px;
      background: var(--brand-cream);
      font: 700 14px/1.55 Arial, Helvetica, sans-serif;
    }
    @media print {
      body { margin: 18mm; }
      pre { border-color: #999; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>ID: ${escapeHtml(close.id)} · Guardado: ${escapeHtml(formatDate(close.createdAt))}</p>
  <pre>${escapeHtml(summary)}</pre>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`)
  printWindow.document.close()
}

export default function DayClosesPage() {
  return (
    <ModuleAccessGuard moduleKey="history" moduleName="Historial de cierres">
      <DayClosesPageContent />
    </ModuleAccessGuard>
  )
}

function DayClosesPageContent() {
  const [adminPassword, setAdminPassword] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [dayCloses, setDayCloses] = useState<SavedDayClose[]>([])
  const [selectedClose, setSelectedClose] = useState<SavedDayClose | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false)
  const [clearHistoryConfirmation, setClearHistoryConfirmation] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [searchText, setSearchText] = useState("")
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("Todos")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [areFiltersVisible, setAreFiltersVisible] = useState(true)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  // Consolidado: el dueño puede ver el historial de TODAS las sedes juntas
  // (scope=all). El API clampa a la sede propia para el resto de roles.
  const [showAllBranches, setShowAllBranches] = useState(false)
  // Nombres de las sedes (incluye inactivas/eventos): etiqueta cada cierre
  // en el consolidado para saber de qué sede es.
  const [branchNames, setBranchNames] = useState<Record<string, string>>({})
  const [reportViewMode, setReportViewMode] =
    useState<ReportViewMode>("Simple")

  const isLoggedIn = adminPassword.length > 0

  async function loadDayCloses(password = adminPassword, allBranches = showAllBranches) {
    if (!password) return

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const response = await fetch(
        allBranches ? "/api/day-closes?scope=all" : "/api/day-closes",
        {
        method: "GET",
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
        },
      )

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar los cierres")
      }

      setDayCloses(normalizeDayCloses(data.dayCloses))
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los cierres"
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Nombres de sede para etiquetar el consolidado. No-fatal: sin nombres el
  // historial funciona igual (solo se pierde la etiqueta).
  async function loadBranchNames(password = adminPassword) {
    if (!password) return

    try {
      const response = await fetch("/api/branches", {
        headers: { "x-admin-password": password },
        cache: "no-store",
      })
      const data = await readApiResponse(response)
      if (!response.ok || !Array.isArray(data.branches)) return

      const names: Record<string, string> = {}
      for (const branch of data.branches) {
        const id = String(branch?.id || "").trim()
        if (id) names[id] = String(branch?.name || "").trim() || "Sucursal"
      }
      setBranchNames(names)
    } catch {
      /* sin etiquetas de sede */
    }
  }

  async function clearDayClosesHistory() {
    if (!adminPassword || clearHistoryConfirmation.trim() !== "BORRAR HISTORIAL") {
      return
    }

    try {
      setIsClearingHistory(true)
      setErrorMessage(null)
      setCopyMessage(null)

      const response = await fetch("/api/day-closes", {
        method: "DELETE",
        headers: {
          "x-admin-password": adminPassword,
        },
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo borrar el historial")
      }

      setDayCloses([])
      setSelectedClose(null)
      setIsClearHistoryModalOpen(false)
      setClearHistoryConfirmation("")
      setCopyMessage(data.message || "Historial de cierres borrado correctamente.")

      window.setTimeout(() => {
        setCopyMessage(null)
      }, 3500)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo borrar el historial de cierres"
      )
    } finally {
      setIsClearingHistory(false)
    }
  }

  function handleLogin() {
    const password = passwordInput.trim()

    if (!password) return

    window.localStorage.setItem(ADMIN_STORAGE_KEY, password)
    setAdminPassword(password)
    loadDayCloses(password)
  }

  async function copySummary(close: SavedDayClose) {
    try {
      await navigator.clipboard.writeText(close.summaryText || "")
      setCopyMessage("Resumen copiado correctamente.")
    } catch {
      setCopyMessage("No se pudo copiar automáticamente.")
    }

    window.setTimeout(() => {
      setCopyMessage(null)
    }, 3000)
  }

  const restoreSession = useEffectEvent(() => {
    const savedPassword = window.localStorage.getItem(ADMIN_STORAGE_KEY)

    if (savedPassword) {
      setAdminPassword(savedPassword)
      setPasswordInput(savedPassword)
      loadDayCloses(savedPassword)
    }
  })

  useEffect(() => {
    // Difiere la restauración de sesión un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(restoreSession, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedMode = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)

        if (isReportViewMode(savedMode)) {
          setReportViewMode(savedMode)
        }
      } catch {
        setReportViewMode("Simple")
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const filteredDayCloses = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    return dayCloses.filter((close) => {
      if (!matchesPaymentFilter(close, paymentFilter)) return false
      if (!isCloseInsideDateRange(close, startDate, endDate)) return false

      if (!query) return true

      const searchableText = [
        close.id,
        close.createdAt,
        close.dateLabel,
        close.summaryText,
        getClosePaymentState(close).label,
      ]
        .join(" ")
        .toLowerCase()

      return searchableText.includes(query)
    })
  }, [dayCloses, endDate, paymentFilter, searchText, startDate])

  const totals = useMemo(() => getDayCloseTotals(dayCloses), [dayCloses])
  const filteredTotals = useMemo(
    () => getDayCloseTotals(filteredDayCloses),
    [filteredDayCloses]
  )
  const rangeReport = useMemo(
    () => getRangeReport(filteredDayCloses),
    [filteredDayCloses]
  )

  const todayRangeValue = getTodayDateInputValue()
  const lastSevenDaysStartValue = getDateInputValueDaysAgo(6)
  const isTodayRangeActive =
    startDate === todayRangeValue && endDate === todayRangeValue
  const isLastSevenDaysRangeActive =
    startDate === lastSevenDaysStartValue && endDate === todayRangeValue
  const isAllRangeActive = !startDate && !endDate

  function exportFilteredDayCloses() {
    if (!filteredDayCloses.length) return

    const rangeLabel = startDate || endDate ? `${startDate || "inicio"}-${endDate || "hoy"}` : "todos"
    const fileLabel = searchText.trim()
      ? `cierres-santo-perrito-filtrados-${searchText.trim()}-${rangeLabel}`
      : `cierres-santo-perrito-${paymentFilter}-${rangeLabel}`

    downloadDayClosesCsv(filteredDayCloses, fileLabel)
  }

  function applyTodayRange() {
    const today = getTodayDateInputValue()

    setStartDate(today)
    setEndDate(today)
  }

  function applyLastSevenDaysRange() {
    setStartDate(getDateInputValueDaysAgo(6))
    setEndDate(getTodayDateInputValue())
  }

  function clearRangeFilters() {
    setStartDate("")
    setEndDate("")
  }

  function changeReportViewMode(mode: ReportViewMode) {
    setReportViewMode(mode)

    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
    } catch {
      // Si el navegador bloquea localStorage, el modo funciona solo durante la sesión.
    }
  }

  if (!isLoggedIn) {
    return (
      <LoginBox
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
                    Volver al panel
                  </a>

                  <button
                    type="button"
                    onClick={() => loadDayCloses()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
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
                    onClick={exportFilteredDayCloses}
                    disabled={!filteredDayCloses.length}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-50"
                  >
                    <Download size={16} />
                    Exportar CSV
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsGuideOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <FileText size={16} />
                    Cómo leer
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setClearHistoryConfirmation("")
                      setIsClearHistoryModalOpen(true)
                    }}
                    disabled={!dayCloses.length || isLoading || isClearingHistory}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-red-600 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    <AlertTriangle size={16} />
                    Borrar historial
                  </button>
                </div>

                <p className="mt-4 text-xs font-black uppercase tracking-[0.32em] text-[var(--brand-primary)]">
                  {BRAND.name}
                </p>

                <h1 className="mt-1 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  Historial de cierres
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Consulta los cierres guardados del local sin abrir hojas de cálculo externas. Cada cierre conserva su resumen completo, cobros reales, pendientes, delivery y productos vendidos.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:w-[620px]">
                <MetricCard label="Cierres" value={totals.cierres} />
                <MetricCard
                  label="Cobrado total"
                  value={formatUSD(totals.realCollectedUSD)}
                />
                <MetricCard
                  label="Gastos total"
                  value={formatUSD(totals.expensesTotalUSD)}
                  tone="yellow"
                />
                <MetricCard
                  label="Neto estimado"
                  value={formatUSD(totals.netEstimatedUSD)}
                  tone={totals.netEstimatedUSD < 0 ? "yellow" : "soft"}
                />
                <MetricCard
                  label="Pendiente total"
                  value={formatUSD(totals.realPendingUSD)}
                  tone="yellow"
                />
                <MetricCard
                  label="Bolívares recibidos"
                  value={`Bs ${formatVES(totals.realVES)}`}
                  tone="soft"
                />
              </div>
            </div>
          </div>
        </header>

        <section className="sticky top-0 z-30 mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-3 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Controles del historial
              </p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-1.5 text-[0.66rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                <input
                  type="checkbox"
                  checked={showAllBranches}
                  onChange={(event) => {
                    setShowAllBranches(event.target.checked)
                    loadDayCloses(adminPassword, event.target.checked)
                    if (event.target.checked) loadBranchNames(adminPassword)
                  }}
                  className="h-4 w-4 accent-[var(--brand-primary)]"
                />
                Ver todas las sedes (solo dueño)
              </label>
              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                {filteredDayCloses.length} cierre(s) en pantalla · Cobrado {formatUSD(filteredTotals.realCollectedUSD)} · Gastos {formatUSD(filteredTotals.expensesTotalUSD)} · Neto {formatUSD(filteredTotals.netEstimatedUSD)} · Pendiente {formatUSD(filteredTotals.realPendingUSD)} · Modo {reportViewMode}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAreFiltersVisible((currentValue) => !currentValue)}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
            >
              {areFiltersVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              {areFiltersVisible ? "Ocultar controles" : "Mostrar controles"}
            </button>
          </div>

          {areFiltersVisible && (
            <>
              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]"
                  />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Buscar por fecha, ID, estado o texto del cierre"
                    className="w-full rounded-full border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-11 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {PAYMENT_FILTERS.map((filter) => {
                    const isActive = paymentFilter === filter

                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setPaymentFilter(filter)}
                        className={`shrink-0 rounded-full border-2 px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.1em] transition ${
                          isActive
                            ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                            : "border-[var(--brand-primary)]/35 bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                        }`}
                      >
                        {filter}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-3 grid gap-3 rounded-[1.2rem] border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                <DateFilterInput
                  label="Desde"
                  value={startDate}
                  onChange={setStartDate}
                />
                <DateFilterInput
                  label="Hasta"
                  value={endDate}
                  onChange={setEndDate}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyTodayRange}
                    className={`rounded-full border-2 px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.1em] transition ${
                      isTodayRangeActive
                        ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] hover:bg-[var(--brand-accent-200)]"
                        : "border-[var(--brand-primary)]/35 bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={applyLastSevenDaysRange}
                    className={`rounded-full border-2 px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.1em] transition ${
                      isLastSevenDaysRangeActive
                        ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] hover:bg-[var(--brand-accent-200)]"
                        : "border-[var(--brand-primary)]/35 bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                    }`}
                  >
                    7 días
                  </button>
                  <button
                    type="button"
                    onClick={clearRangeFilters}
                    className={`rounded-full border-2 px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.1em] transition ${
                      isAllRangeActive
                        ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] hover:bg-[var(--brand-accent-200)]"
                        : "border-[var(--brand-primary)]/35 bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                    }`}
                  >
                    Todo
                  </button>
                </div>
              </div>

              <ModeSelector
                value={reportViewMode}
                onChange={changeReportViewMode}
              />

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <MiniMetric label="Mostrando" value={filteredDayCloses.length} />
                <MiniMetric
                  label="Cobrado mostrado"
                  value={formatUSD(filteredTotals.realCollectedUSD)}
                />
                <MiniMetric
                  label="Pendiente mostrado"
                  value={formatUSD(filteredTotals.realPendingUSD)}
                />
                <MiniMetric
                  label="Divisas mostradas"
                  value={formatUSD(filteredTotals.realCashUSD)}
                />
                <MiniMetric
                  label="Delivery mostrado"
                  value={formatUSD(filteredTotals.deliveryCollectedUSD)}
                />
                <MiniMetric
                  label="Gastos mostrados"
                  value={formatUSD(filteredTotals.expensesTotalUSD)}
                />
                <MiniMetric
                  label="Neto mostrado"
                  value={formatUSD(filteredTotals.netEstimatedUSD)}
                />
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

          {copyMessage && (
            <div className="mt-3 rounded-2xl border-2 border-green-500/35 bg-green-50 px-4 py-3">
              <p className="text-sm font-black text-green-700">
                {copyMessage}
              </p>
            </div>
          )}
        </section>

        {filteredDayCloses.length > 0 && (
          <RangeReport
            dayCloses={filteredDayCloses}
            totals={filteredTotals}
            report={rangeReport}
            startDate={startDate}
            endDate={endDate}
            viewMode={reportViewMode}
          />
        )}

        {isLoading && dayCloses.length === 0 ? (
          <section className="mt-5 rounded-[2rem] border-2 border-[var(--brand-primary)] bg-white px-6 py-14 text-center shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]">
            <Loader2 className="mx-auto animate-spin text-[var(--brand-primary)]" size={42} />
            <h2 className="mt-5 text-3xl font-black uppercase text-[var(--brand-primary)]">
              Cargando cierres
            </h2>
          </section>
        ) : filteredDayCloses.length === 0 ? (
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
              Sin cierres para mostrar
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
              Ajusta la búsqueda o cambia el filtro de cobro. Si todavía no hay cierres guardados, aparecerán aquí cuando cierres y reinicies el día desde el panel.
            </p>
          </section>
        ) : (
          <section className="mt-5 grid gap-4 xl:grid-cols-2">
            {filteredDayCloses.map((close) => (
              <CloseCard
                key={close.id}
                close={close}
                branchLabel={
                  showAllBranches && close.branchId
                    ? branchNames[close.branchId] || "Sede sin nombre"
                    : ""
                }
                onOpen={() => setSelectedClose(close)}
                onCopy={() => copySummary(close)}
              />
            ))}
          </section>
        )}
      </div>

      {selectedClose && (
        <CloseDetailModal
          close={selectedClose}
          onClose={() => setSelectedClose(null)}
          onCopy={() => copySummary(selectedClose)}
          viewMode={reportViewMode}
        />
      )}

      {isGuideOpen && (
        <ReportGuideModal
          viewMode={reportViewMode}
          onClose={() => setIsGuideOpen(false)}
        />
      )}

      {isClearHistoryModalOpen && (
        <ClearHistoryModal
          confirmationText={clearHistoryConfirmation}
          isClearing={isClearingHistory}
          closesCount={dayCloses.length}
          onChangeConfirmation={setClearHistoryConfirmation}
          onConfirm={clearDayClosesHistory}
          onClose={() => {
            if (isClearingHistory) return
            setIsClearHistoryModalOpen(false)
            setClearHistoryConfirmation("")
          }}
        />
      )}
    </main>
  )
}

function ClearHistoryModal({
  confirmationText,
  isClearing,
  closesCount,
  onChangeConfirmation,
  onConfirm,
  onClose,
}: {
  confirmationText: string
  isClearing: boolean
  closesCount: number
  onChangeConfirmation: (value: string) => void
  onConfirm: () => void
  onClose: () => void
}) {
  const canConfirm = confirmationText.trim() === "BORRAR HISTORIAL" && !isClearing

  return (
    <ModalShell
      title="Borrar historial"
      onClose={onClose}
      footer={
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isClearing}
            className="flex items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
          >
            <X size={17} />
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="flex items-center justify-center gap-3 rounded-full border-2 border-red-700 bg-red-600 px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isClearing ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <AlertTriangle size={17} />
            )}
            Borrar definitivamente
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-[1.4rem] border-2 border-red-500 bg-red-50 p-4 text-red-800">
          <p className="text-sm font-black uppercase tracking-[0.16em]">
            Acción delicada
          </p>
          <p className="mt-2 text-sm font-bold leading-6">
            Esto borrará todos los cierres guardados del historial. No borra pedidos activos, gastos, configuración, zonas delivery ni productos. Usa esta acción solo cuando necesites reiniciar el historial operativo del negocio.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoBox label="Cierres actuales" value={String(closesCount)} />
          <InfoBox label="Se borrará" value="Solo historial de cierres" />
        </div>

        <label className="block rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Escribe BORRAR HISTORIAL para confirmar
          </span>
          <input
            value={confirmationText}
            onChange={(event) => onChangeConfirmation(event.target.value)}
            disabled={isClearing}
            placeholder="BORRAR HISTORIAL"
            className="mt-3 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-black uppercase text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/35 focus:border-[var(--brand-primary)] disabled:opacity-50"
          />
        </label>
      </div>
    </ModalShell>
  )
}

function LoginBox({
  passwordInput,
  setPasswordInput,
  showPassword,
  setShowPassword,
  handleLogin,
  errorMessage,
}: LoginBoxProps) {
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
            Volver
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
            Acceso privado
          </p>

          <h1 className="mt-2 text-center text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
            Historial de cierres
          </h1>

          <p className="mt-3 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
            Ingresa la clave autorizada para consultar los cierres guardados del local.
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
                className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 pr-12 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-ink)]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-2xl border-2 border-red-500/35 bg-red-100 px-4 py-3">
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
            Entrar al historial
          </button>
        </div>
      </div>
    </main>
  )
}

function CloseCard({
  close,
  branchLabel = "",
  onOpen,
  onCopy,
}: {
  close: SavedDayClose
  branchLabel?: string
  onOpen: () => void
  onCopy: () => void
}) {
  const paymentState = getClosePaymentState(close)

  return (
    <article className="overflow-hidden rounded-[1.6rem] border-2 border-[var(--brand-primary)] bg-white shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]">
      <div className="border-b-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                <CalendarDays size={16} />
                {formatDate(close.createdAt)}
              </p>

              <span
                className={`inline-flex rounded-full border-2 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] ${paymentState.className}`}
              >
                {paymentState.label}
              </span>

              {branchLabel && (
                <span className="inline-flex rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white">
                  {branchLabel}
                </span>
              )}
            </div>

            <h2 className="mt-2 text-3xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
              {getCloseTitle(close)}
            </h2>
            <p className="mt-2 text-xs font-bold text-[var(--brand-ink-2)]/60">
              ID: {close.id}
            </p>
          </div>

          <div className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-right">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              Cobrado real
            </p>
            <p className="mt-1 text-2xl font-black text-[var(--brand-ink-3)]">
              {formatUSD(close.realCollectedUSD)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <InfoBox label="Registrados" value={String(close.ordersRegistered)} />
          <InfoBox label="Entregados" value={String(close.deliveredOrders)} />
          <InfoBox label="Activos" value={String(close.activeOrders)} />
          <InfoBox label="Cancelados" value={String(close.canceledOrders)} />
          <InfoBox label="Total vendido" value={formatUSD(close.totalSoldUSD)} />
          <InfoBox label="Pendiente" value={formatUSD(close.realPendingUSD)} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <InfoBox label="Divisas" value={formatUSD(close.realCashUSD)} />
          <InfoBox label="Bolívares" value={`Bs ${formatVES(close.realVES)}`} />
          <InfoBox label="Delivery cobrado" value={formatUSD(close.deliveryCollectedUSD)} />
          <InfoBox label="Gastos" value={formatUSD(close.expensesTotalUSD)} />
          <InfoBox label="Neto estimado" value={formatUSD(getCloseNetEstimatedUSD(close))} />
          <InfoBox label="Pagados" value={String(close.paidOrders)} />
          {close.supplierPaymentsEquivalentUSD > 0 && (
            <>
              <InfoBox
                label="Salidas a proveedores"
                value={formatUSD(close.supplierPaymentsEquivalentUSD)}
              />
              <InfoBox
                label="Neto después de compras"
                value={formatUSD(getCloseNetAfterPurchasesUSD(close))}
              />
            </>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
          >
            <FileText size={17} />
            Ver detalle
          </button>

          <button
            type="button"
            onClick={onCopy}
            disabled={!close.summaryText}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-50"
          >
            <Clipboard size={17} />
            Copiar resumen
          </button>
        </div>
      </div>
    </article>
  )
}

function CloseDetailModal({
  close,
  onClose,
  onCopy,
  viewMode,
}: {
  close: SavedDayClose
  onClose: () => void
  onCopy: () => void
  viewMode: ReportViewMode
}) {
  const paymentState = getClosePaymentState(close)
  const closeAlerts = getSingleCloseAlerts(close)
  const closeInventoryExpenses = getInventoryExpenseTotals(close.expenses)
  const closeExpensesByProvider = combineExpensesByField(close.expenses, "provider")
  const closeExpensesByType = combineExpensesByField(close.expenses, "expenseType")
  const closeExpensesByCategory = combineExpensesByField(close.expenses, "category")
  const closeExpensesByMethod = combineExpensesByField(close.expenses, "method")
  const hasRiskAlert = closeAlerts.some(
    (alert) => alert.tone === "danger" || alert.tone === "warning"
  )
  const showBusinessSections = viewMode !== "Simple"
  const showAdvancedSections = viewMode === "Avanzado"

  return (
    <ModalShell
      onClose={onClose}
      title="Detalle del cierre"
      footer={
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <button
            type="button"
            onClick={onCopy}
            disabled={!close.summaryText}
            className="flex items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] outline-none transition hover:bg-[var(--brand-accent-200)] focus-visible:ring-4 focus-visible:ring-[var(--brand-accent)]/70 disabled:opacity-50"
          >
            <Clipboard size={17} />
            Copiar
          </button>

          <button
            type="button"
            onClick={() => downloadCloseSummary(close)}
            disabled={!close.summaryText}
            className="flex items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] outline-none transition hover:bg-[var(--brand-accent-100)] focus-visible:ring-4 focus-visible:ring-[var(--brand-accent)]/70 disabled:opacity-50"
          >
            <Download size={17} />
            TXT
          </button>

          <button
            type="button"
            onClick={() => downloadSingleCloseCsv(close)}
            className="flex items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] outline-none transition hover:bg-[var(--brand-accent-100)] focus-visible:ring-4 focus-visible:ring-[var(--brand-accent)]/70"
          >
            <FileText size={17} />
            CSV
          </button>

          <button
            type="button"
            onClick={() => downloadSingleCloseDetailedCsv(close)}
            className="flex items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] outline-none transition hover:bg-[var(--brand-accent-100)] focus-visible:ring-4 focus-visible:ring-[var(--brand-accent)]/70"
          >
            <FileText size={17} />
            Excel completo
          </button>

          <button
            type="button"
            onClick={() => printCloseSummary(close)}
            disabled={!close.summaryText}
            className="flex items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] outline-none transition hover:bg-[var(--brand-accent-100)] focus-visible:ring-4 focus-visible:ring-[var(--brand-accent)]/70 disabled:opacity-50"
          >
            <Printer size={17} />
            Imprimir
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] outline-none transition hover:bg-[var(--brand-accent-100)] focus-visible:ring-4 focus-visible:ring-[var(--brand-accent)]/70 xl:col-auto"
          >
            <X size={17} />
            Cerrar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                {close.id}
              </p>
              <h3 className="mt-2 text-2xl font-black uppercase text-[var(--brand-ink-3)]">
                {getCloseTitle(close)}
              </h3>
              <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/65">
                Guardado: {formatDate(close.createdAt)}
              </p>
            </div>

            <span
              className={`inline-flex w-fit rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${paymentState.className}`}
            >
              {paymentState.label}
            </span>
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-[var(--brand-primary)]/20 bg-white px-4 py-3 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
          Vista actual: <strong>{viewMode}</strong>. El historial ahora muestra cada cierre con secciones desplegables para revisar solo lo que haga falta.
        </div>

        {showBusinessSections && (
          <DetailToggleSection
            title="Alertas del cierre"
            description="Revisión rápida de pendientes, pagos parciales, gastos, delivery o métodos faltantes."
            defaultOpen={hasRiskAlert}
            badge={`${closeAlerts.length} alerta(s)`}
          >
            <SmartAlerts
              title="Alertas del cierre"
              description="Revisión rápida de este cierre guardado."
              alerts={closeAlerts}
              compact
            />
          </DetailToggleSection>
        )}

        <DetailToggleSection
          title="Resumen general"
          description="Pedidos, estado operativo y fecha del cierre guardado."
          defaultOpen
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoBox label="Pedidos registrados" value={String(close.ordersRegistered)} />
            <InfoBox label="Pedidos activos" value={String(close.activeOrders)} />
            <InfoBox label="Pedidos entregados" value={String(close.deliveredOrders)} />
            <InfoBox label="Pedidos cancelados" value={String(close.canceledOrders)} />
            <InfoBox label="Delivery registrados" value={String(close.deliveryRegistered)} />
            <InfoBox label="Delivery entregados" value={String(close.deliveryDelivered)} />
          </div>
        </DetailToggleSection>

        {close.orders.length > 0 && (
          <DetailToggleSection
            title="Pedidos del día (uno por uno)"
            description="Cada pedido con sus productos, estado y cobro, tal como quedaron al cerrar."
            badge={`${close.orders.length} pedido(s)`}
          >
            <div className="space-y-2">
              {close.orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-black leading-none text-[var(--brand-primary)]">
                      {order.displayNumber || order.id}
                    </p>
                    <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[0.6rem] font-black uppercase text-[var(--brand-ink-2)]/70">
                      {order.status}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[0.6rem] font-black uppercase ${
                        order.paymentStatus === "Pagado"
                          ? "bg-green-100 text-green-700"
                          : order.paymentStatus === "Pago parcial"
                            ? "bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {order.paymentStatus || "Sin pago"}
                    </span>
                    <p className="ml-auto text-base font-black text-[var(--brand-ink-3)]">
                      {formatUSD(order.totalUSD)}
                    </p>
                  </div>

                  <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/70">
                    {order.customerName}
                    {order.location ? ` · ${order.location}` : ""}
                    {order.orderType ? ` · ${order.orderType}` : ""}
                    {order.createdAt ? ` · ${formatDate(order.createdAt)}` : ""}
                    {order.registeredBy ? ` · Registró: ${order.registeredBy}` : ""}
                  </p>

                  {order.items.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {order.items.map((item, itemIndex) => (
                        <div
                          key={`${order.id}-item-${itemIndex}`}
                          className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[var(--brand-ink-3)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span>
                              {item.quantity}x {item.name}
                            </span>
                            <span className="shrink-0 font-black text-[var(--brand-primary)]">
                              {formatUSD(item.priceUSD * item.quantity)}
                            </span>
                          </div>
                          {item.selectionSummary && (
                            <p className="mt-0.5 text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/60">
                              {item.selectionSummary}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </DetailToggleSection>
        )}

        {close.paymentProofs.length > 0 && (
          <DetailToggleSection
            title="Comprobantes archivados"
            description="Pagos reportados por clientes ese día, con su pedido asociado."
            badge={`${close.paymentProofs.length} comprobante(s)`}
          >
            <div className="space-y-2">
              {close.paymentProofs.map((proof, proofIndex) => (
                <div
                  key={`proof-${proofIndex}-${proof.orderId}`}
                  className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--brand-ink-2)]/80">
                    <span className="font-black text-[var(--brand-primary)]">
                      Pedido {proof.orderDisplayNumber || proof.orderId || "—"}
                    </span>
                    <span>{proof.customerName || "Cliente"}</span>
                    <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[0.6rem] font-black uppercase">
                      {proof.status}
                    </span>
                    <span className="ml-auto font-black text-[var(--brand-ink-3)]">
                      {proof.amountReportedUSD > 0 && formatUSD(proof.amountReportedUSD)}
                      {proof.amountReportedUSD > 0 && proof.amountReportedVES > 0 ? " + " : ""}
                      {proof.amountReportedVES > 0 && `Bs ${formatVES(proof.amountReportedVES)}`}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/60">
                    {proof.reportedMethod || "Sin método"}
                    {proof.paymentReference ? ` · Ref: ${proof.paymentReference}` : ""}
                    {proof.createdAt ? ` · ${formatDate(proof.createdAt)}` : ""}
                    {proof.proofImageUrl ? (
                      <>
                        {" · "}
                        <a
                          href={proof.proofImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-black text-[var(--brand-primary)] underline"
                        >
                          Ver captura
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          </DetailToggleSection>
        )}

        <DetailToggleSection
          title="Cobros reales"
          description="Divisas, bolívares, equivalentes, pendientes y métodos de pago guardados."
          defaultOpen={close.realPendingUSD > 0 || close.partialPaymentOrders > 0}
          badge={formatUSD(close.realCollectedUSD)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox label="Total vendido registrado" value={formatUSD(close.totalSoldUSD)} />
            <InfoBox label="Total cobrado real" value={formatUSD(close.realCollectedUSD)} />
            <InfoBox label="Divisas recibidas" value={formatUSD(close.realCashUSD)} />
            <InfoBox label="Bolívares recibidos" value={`Bs ${formatVES(close.realVES)}`} />
            <InfoBox label="Equiv. Bs en USD" value={formatUSD(close.realVESEquivalentUSD)} />
            <InfoBox label="Pendiente de cobro" value={formatUSD(close.realPendingUSD)} />
          </div>

          {close.fiscalOrders > 0 && (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">
                Desglose fiscal del cierre
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoBox label="Pedidos con fiscal" value={String(close.fiscalOrders)} />
                <InfoBox label="Base imponible" value={formatUSD(close.fiscalSubtotalUSD)} />
                <InfoBox label="IVA total" value={formatUSD(close.fiscalIvaTotalUSD)} />
                <InfoBox label="Base IGTF divisas" value={formatUSD(close.fiscalIgtfBaseUSD)} />
                <InfoBox label="IGTF cobrado" value={formatUSD(close.fiscalIgtfUSD)} />
                <InfoBox label="Total fiscal" value={formatUSD(close.fiscalTotalUSD)} />
              </div>
              {close.fiscalIvaByRate.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {close.fiscalIvaByRate.map((bucket) => (
                    <div key={bucket.rate} className="rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-emerald-950">
                      {bucket.rate === 0 ? "Exento 0%" : `IVA ${bucket.rate}%`} · base {formatUSD(bucket.baseUSD)} · impuesto {formatUSD(bucket.ivaUSD)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <InfoBox label="Pagados" value={String(close.paidOrders)} />
            <InfoBox label="Pago parcial" value={String(close.partialPaymentOrders)} />
            <InfoBox label="Pendientes" value={String(close.pendingPaymentOrders)} />
          </div>

          {showBusinessSections && (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <SummaryList
                title="Ventas por vendedor (cobrado por)"
                emptyText="Sin cobros con vendedor guardados."
                items={close.salesBySeller}
                showVES
              />
              <SummaryList
                title="Pedidos por registrador"
                emptyText="Sin registradores guardados."
                items={close.ordersByRegistrar}
              />
              <SummaryList
                title="Cobros por estado"
                emptyText="Sin cobros por estado guardados."
                items={close.paymentByStatus}
              />
              <SummaryList
                title="Cobros por método en divisas"
                emptyText="Sin cobros en divisas guardados."
                items={close.paymentByUSDMethod}
              />
              <SummaryList
                title="Cobros por método en bolívares"
                emptyText="Sin cobros en bolívares guardados."
                items={close.paymentByVESMethod}
                showVES
              />
            </div>
          )}
        </DetailToggleSection>

        <DetailToggleSection
          title="Pedidos y productos vendidos"
          description="Venta confirmada por entrega, productos normales, combos y ranking de productos."
          defaultOpen={close.productsSold.length > 0}
          badge={`${close.productsSold.length} producto(s)`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox label="Total confirmado" value={formatUSD(close.totalConfirmedUSD)} />
            <InfoBox label="Venta de productos" value={formatUSD(close.productSalesUSD)} />
            <InfoBox label="Combos solo divisas" value={formatUSD(close.combosUSD)} />
            <InfoBox label="Productos normales" value={formatUSD(close.regularUSD)} />
            <InfoBox label="Referencia normales Bs" value={`Bs ${formatVES(close.regularVES)}`} />
            <InfoBox label="Delivery cobrado" value={formatUSD(close.deliveryCollectedUSD)} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <SummaryList
              title="Ventas por tipo"
              emptyText="Sin ventas por tipo guardadas."
              items={close.salesByType}
            />
            <ProductsSoldList products={close.productsSold} />
          </div>
        </DetailToggleSection>

        <DetailToggleSection
          title="Delivery"
          description="Pedidos a domicilio, zonas, métodos indicados y forma real de cobro del delivery."
          defaultOpen={close.deliveryRegistered > 0 || close.pendingDeliveryUSD > 0}
          badge={`${close.deliveryRegistered} delivery`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox label="Delivery registrado" value={String(close.deliveryRegistered)} />
            <InfoBox label="Delivery entregado" value={String(close.deliveryDelivered)} />
            <InfoBox label="Delivery activo" value={String(close.deliveryActive)} />
            <InfoBox label="Delivery cobrado por entrega" value={formatUSD(close.deliveryCollectedUSD)} />
            <InfoBox label="Delivery en divisas" value={formatUSD(close.deliveryPaidInUSD)} />
            <InfoBox label="Delivery en bolívares" value={`Bs ${formatVES(close.deliveryPaidInVES)}`} />
            <InfoBox label="Equiv. Bs en USD" value={formatUSD(close.deliveryPaidInVESEquivalentUSD)} />
            <InfoBox label="Delivery mixto" value={formatUSD(close.deliveryPaidMixedUSD)} />
            <InfoBox label="Delivery pendiente" value={formatUSD(close.pendingDeliveryUSD)} />
          </div>

          {showBusinessSections && (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <SummaryList
                title="Delivery por forma de cobro real"
                emptyText="Sin delivery por forma de cobro real guardado."
                items={close.deliveryByPaymentIn}
                showVES
                showDelivery
              />
              <SummaryList
                title="Delivery por método indicado"
                emptyText="Sin delivery por método indicado guardado."
                items={close.deliveryByPayment}
                showDelivery
              />
              <SummaryList
                title="Delivery por zona"
                emptyText="Sin delivery por zona guardado."
                items={close.deliveryByZone}
                showDelivery
              />
            </div>
          )}
        </DetailToggleSection>

        <DetailToggleSection
          title="Gastos, proveedores y neto"
          description="Salidas de caja, compras de inventario, proveedores, categorías y métodos de gasto."
          defaultOpen={close.expensesTotalUSD > 0}
          badge={formatUSD(close.expensesTotalUSD)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox label="Gastos registrados" value={String(close.expensesCount)} />
            <InfoBox label="Total gastos" value={formatUSD(close.expensesTotalUSD)} />
            <InfoBox label="Gastos en divisas" value={formatUSD(close.expensesCashUSD)} />
            <InfoBox label="Gastos en bolívares" value={`Bs ${formatVES(close.expensesVES)}`} />
            <InfoBox label="Equiv. Bs en USD" value={formatUSD(close.expensesVESEquivalentUSD)} />
            <InfoBox label="Neto estimado" value={formatUSD(getCloseNetEstimatedUSD(close))} />
            <InfoBox
              label="Compras inventario"
              value={`${closeInventoryExpenses.count} registro(s) · ${formatUSD(closeInventoryExpenses.totalUSD)}`}
            />
          </div>

          {showBusinessSections && (
            <div className="mt-4 space-y-4">
              <ExpensesList expenses={close.expenses} />
              <div className="grid gap-4 xl:grid-cols-2">
                <SummaryList
                  title="Gastos por proveedor"
                  emptyText="Sin proveedores guardados en este cierre."
                  items={closeExpensesByProvider}
                  showVES
                />
                <SummaryList
                  title="Gastos por tipo"
                  emptyText="Sin tipos de gasto guardados en este cierre."
                  items={closeExpensesByType}
                  showVES
                />
                <SummaryList
                  title="Gastos por categoría"
                  emptyText="Sin categorías de gasto guardadas en este cierre."
                  items={closeExpensesByCategory}
                  showVES
                />
                <SummaryList
                  title="Gastos por método"
                  emptyText="Sin métodos de gasto guardados en este cierre."
                  items={closeExpensesByMethod}
                  showVES
                />
              </div>
            </div>
          )}
        </DetailToggleSection>

        <DetailToggleSection
          title="Inventario y recetas"
          description="Compras que sumaron inventario y revisión de movimientos relacionados con este cierre."
          defaultOpen={closeInventoryExpenses.count > 0}
          badge={`${closeInventoryExpenses.count} compra(s)`}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoBox
              label="Compras con inventario"
              value={String(closeInventoryExpenses.count)}
            />
            <InfoBox
              label="Total inventario USD"
              value={formatUSD(closeInventoryExpenses.totalUSD)}
            />
            <InfoBox
              label="Total inventario Bs"
              value={`Bs ${formatVES(closeInventoryExpenses.totalVES)}`}
            />
          </div>

          <p className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white px-4 py-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
            Este bloque resume las compras relacionadas con inventario que quedaron dentro del cierre. Los descuentos por receta se ejecutan cuando los pedidos se marcan como entregados y se revisan mejor desde el módulo de inventario.
          </p>
        </DetailToggleSection>

        <DetailToggleSection
          title="Resumen para copiar"
          description="Texto completo guardado con el cierre para enviar, imprimir o revisar fuera del sistema."
          defaultOpen={showAdvancedSections}
        >
          <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 text-sm font-bold leading-6 text-[var(--brand-ink-2)]">
            {close.summaryText || "Sin resumen guardado."}
          </pre>
        </DetailToggleSection>
      </div>
    </ModalShell>
  )
}

function DetailToggleSection({
  title,
  description,
  badge,
  defaultOpen,
  children,
}: {
  title: string
  description: string
  badge?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(Boolean(defaultOpen))

  return (
    <section className="overflow-hidden rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white">
      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="flex w-full flex-col gap-3 px-4 py-4 text-left outline-none transition hover:bg-yellow-50 focus-visible:ring-4 focus-visible:ring-[var(--brand-accent)]/70 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            {title}
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
            {description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {badge && (
            <span className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink)]">
              {badge}
            </span>
          )}
          <span className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
            {isOpen ? "Ocultar" : "Mostrar"}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4">
          {children}
        </div>
      )}
    </section>
  )
}

function SmartAlerts({
  title,
  description,
  alerts,
  compact,
}: {
  title: string
  description: string
  alerts: SmartAlert[]
  compact?: boolean
}) {
  return (
    <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            {title}
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
            {description}
          </p>
        </div>
        <span className="w-fit rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]">
          {alerts.length} alerta(s)
        </span>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
        {alerts.map((alert, index) => (
          <SmartAlertCard key={`${alert.title}-${index}`} alert={alert} />
        ))}
      </div>
    </div>
  )
}

function SmartAlertCard({ alert }: { alert: SmartAlert }) {
  const toneStyle =
    alert.tone === "danger"
      ? "border-red-500 bg-red-50 text-red-800"
      : alert.tone === "warning"
        ? "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
        : alert.tone === "good"
          ? "border-green-500 bg-green-50 text-green-700"
          : "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-ink-2)]"

  const iconStyle =
    alert.tone === "good"
      ? "bg-green-500 text-white"
      : alert.tone === "danger"
        ? "bg-red-600 text-white"
        : alert.tone === "warning"
          ? "bg-[var(--brand-accent)] text-[var(--brand-ink)]"
          : "bg-white text-[var(--brand-primary)]"

  return (
    <div className={`rounded-2xl border-2 p-4 ${toneStyle}`}>
      <div className="flex gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-current ${iconStyle}`}>
          {alert.tone === "good" ? (
            <CheckCircle2 size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm font-black uppercase leading-5">
              {alert.title}
            </p>
            {alert.value && (
              <p className="shrink-0 text-sm font-black text-[var(--brand-primary)]">
                {alert.value}
              </p>
            )}
          </div>
          <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
            {alert.description}
          </p>
        </div>
      </div>
    </div>
  )
}

function ModeSelector({
  value,
  onChange,
}: {
  value: ReportViewMode
  onChange: (value: ReportViewMode) => void
}) {
  const activeMode =
    REPORT_VIEW_MODES.find((item) => item.mode === value) ||
    REPORT_VIEW_MODES[0]

  return (
    <div className="mt-3 rounded-[1.2rem] border border-[var(--brand-primary)]/20 bg-white p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
            Modo de vista
          </p>
          <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
            {activeMode.description}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {REPORT_VIEW_MODES.map((item) => {
            const isActive = value === item.mode

            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => onChange(item.mode)}
                className={`shrink-0 rounded-full border-2 px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.1em] transition ${
                  isActive
                    ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] hover:bg-[var(--brand-accent-200)]"
                    : "border-[var(--brand-primary)]/35 bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ReportGuideModal({
  viewMode,
  onClose,
}: {
  viewMode: ReportViewMode
  onClose: () => void
}) {
  const activeMode =
    REPORT_VIEW_MODES.find((item) => item.mode === viewMode) ||
    REPORT_VIEW_MODES[0]

  return (
    <ModalShell
      onClose={onClose}
      title="Cómo leer el reporte"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
        >
          <X size={17} />
          Cerrar guía
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Vista actual: {activeMode.label}
          </p>
          <h3 className="mt-2 text-2xl font-black uppercase text-[var(--brand-ink-3)]">
            Lee primero lo simple y abre lo avanzado solo cuando haga falta
          </h3>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
            El historial está pensado para que el dueño vea rápido cuánto vendió,
            cuánto cobró, qué queda pendiente y qué productos o zonas se movieron más.
          </p>
        </div>

        <SectionTitle>Modos de vista</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-3">
          <GuideCard
            title="Simple"
            text="Para revisar rápido: números principales, líderes del rango y lista de cierres. Ideal para un dueño que solo quiere saber cómo va el negocio."
          />
          <GuideCard
            title="Negocio"
            text="Agrega alertas y gráficas. Sirve para detectar pendientes, productos fuertes, zonas con movimiento y métodos de cobro importantes."
          />
          <GuideCard
            title="Avanzado"
            text="Muestra auditoría completa: métodos, productos, zonas, gráficos, alertas y texto completo. Útil para revisar caja con más detalle."
          />
        </div>

        <SectionTitle>Qué mirar primero</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <GuideCard
            title="Total vendido"
            text="Es todo lo que el sistema registró como venta dentro del rango filtrado. No significa necesariamente que ya todo fue cobrado."
          />
          <GuideCard
            title="Total cobrado"
            text="Es el dinero real registrado en caja, sumando divisas y bolívares convertidos a su equivalente."
          />
          <GuideCard
            title="Pendiente total"
            text="Es lo que falta por cobrar o terminar de marcar como cobrado. Si está alto, hay que revisar pedidos pendientes o parciales."
          />
          <GuideCard
            title="Efectividad de cobro"
            text="Compara lo cobrado contra lo vendido. Mientras más cerca de 100%, más limpia está la caja."
          />
          <GuideCard
            title="Gastos del día"
            text="Son las salidas de caja guardadas antes de cerrar: compras, pagos, servicios o materia prima. Se restan del cobro real para calcular el neto."
          />
          <GuideCard
            title="Neto estimado"
            text="Es el cobro real menos los gastos guardados en el cierre. Si sale negativo, ese cierre tuvo más gastos que cobros registrados."
          />
        </div>

        <SectionTitle>Cómo entender las barras</SectionTitle>
        <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
          <p className="text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
            Las barras amarillas son comparación visual: mientras más larga está la barra,
            más peso tiene ese dato dentro del rango. El monto exacto siempre aparece escrito
            al lado. Úsalas para comparar rápido vendido contra cobrado, productos entre sí,
            zonas de delivery y métodos de pago.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <GuideCard
            title="Cobro contra pendiente"
            text="Compara vendido, cobrado, pendiente, divisas, bolívares equivalentes y delivery. Si pendiente se ve grande, hay dinero por revisar."
          />
          <GuideCard
            title="Evolución por cierre"
            text="Muestra los últimos cierres del rango. Ayuda a ver qué cierre vendió más y cuál dejó más pendiente."
          />
          <GuideCard
            title="Productos más vendidos"
            text="Ordena por unidades vendidas. Sirve para saber qué productos conviene destacar o convertir en promoción."
          />
          <GuideCard
            title="Delivery por zona"
            text="Muestra las zonas con más movimiento. Ayuda a planificar rutas, costos y promociones por zona."
          />
        </div>

        <SectionTitle>Alertas inteligentes</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <GuideCard
            title="Amarillo"
            text="Atención operativa: pendiente, pagos parciales, delivery pendiente o cobros sin método. Conviene revisar, pero no siempre es un error."
          />
          <GuideCard
            title="Rojo"
            text="Revisión importante: ventas registradas sin entregas, pendientes fuertes o datos que pueden confundir caja."
          />
          <GuideCard
            title="Verde"
            text="Dato positivo: producto fuerte, buen cierre o algo que ayuda al dueño a tomar decisiones comerciales."
          />
          <GuideCard
            title="Sin método"
            text="Significa que hubo dinero registrado, pero no quedó claro si fue efectivo, Zelle, pago móvil, punto u otro. Es útil para auditoría."
          />
        </div>
      </div>
    </ModalShell>
  )
}

function GuideCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4">
      <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">{title}</p>
      <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
        {text}
      </p>
    </div>
  )
}


function DateFilterInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-black text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
      />
    </label>
  )
}

function RangeReport({
  dayCloses,
  totals,
  report,
  startDate,
  endDate,
  viewMode,
}: {
  dayCloses: SavedDayClose[]
  totals: ReturnType<typeof getDayCloseTotals>
  report: ReturnType<typeof getRangeReport>
  startDate: string
  endDate: string
  viewMode: ReportViewMode
}) {
  const rangeLabel =
    startDate || endDate
      ? `${startDate || "primer cierre"} → ${endDate || "último cierre"}`
      : "Todos los cierres cargados"

  const averageCollected =
    dayCloses.length > 0 ? totals.realCollectedUSD / dayCloses.length : 0
  const collectionRate =
    totals.totalSoldUSD > 0
      ? Math.round((totals.realCollectedUSD / totals.totalSoldUSD) * 100)
      : 0
  const deliveryShare =
    totals.realCollectedUSD > 0
      ? Math.round((totals.deliveryCollectedUSD / totals.realCollectedUSD) * 100)
      : 0
  const smartAlerts = getRangeAlerts(dayCloses, totals, report)
  const showBusinessSections = viewMode !== "Simple"
  const showAdvancedSections = viewMode === "Avanzado"

  return (
    <section className="mt-5 overflow-hidden rounded-[1.6rem] border-2 border-[var(--brand-primary)] bg-white shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]">
      <div className="border-b-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--brand-primary)]">
              Reporte del rango filtrado
            </p>
            <h2 className="mt-1 text-3xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
              Resumen del negocio
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
              {rangeLabel}. Vista {viewMode}. Este reporte se calcula solo con los cierres que estás viendo en pantalla.
            </p>
          </div>

          <div className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-right">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              Promedio cobrado
            </p>
            <p className="mt-1 text-2xl font-black text-[var(--brand-ink-3)]">
              {formatUSD(averageCollected)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoBox label="Total vendido" value={formatUSD(totals.totalSoldUSD)} />
          <InfoBox label="Total cobrado" value={formatUSD(totals.realCollectedUSD)} />
          <InfoBox label="Total gastos" value={formatUSD(totals.expensesTotalUSD)} />
          <InfoBox label="Neto estimado" value={formatUSD(totals.netEstimatedUSD)} />
          <InfoBox label="Pendiente total" value={formatUSD(totals.realPendingUSD)} />
          <InfoBox label="Efectividad de cobro" value={`${collectionRate}%`} />
          <InfoBox label="Divisas recibidas" value={formatUSD(totals.realCashUSD)} />
          <InfoBox label="Bolívares recibidos" value={`Bs ${formatVES(totals.realVES)}`} />
          <InfoBox label="Delivery cobrado" value={formatUSD(totals.deliveryCollectedUSD)} />
          <InfoBox label="Peso del delivery" value={`${deliveryShare}%`} />
          <InfoBox label="Gastos en divisas" value={formatUSD(totals.expensesCashUSD)} />
          <InfoBox label="Gastos en Bs" value={`Bs ${formatVES(totals.expensesVES)}`} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <InfoBox label="Pedidos registrados" value={String(report.operationalTotals.ordersRegistered)} />
          <InfoBox label="Pedidos entregados" value={String(report.operationalTotals.deliveredOrders)} />
          <InfoBox label="Pedidos activos" value={String(report.operationalTotals.activeOrders)} />
          <InfoBox label="Pedidos cancelados" value={String(report.operationalTotals.canceledOrders)} />
          <InfoBox label="Pedidos pagados" value={String(totals.paidOrders)} />
          <InfoBox label="Pedidos pendientes" value={String(totals.pendingPaymentOrders)} />
        </div>

        <div className="grid gap-3 xl:grid-cols-4">
          <HighlightBox
            title="Producto más vendido"
            main={report.topProduct?.name || "Sin productos"}
            detail={
              report.topProduct
                ? `${report.topProduct.quantity} unidad(es) · ${formatUSD(report.topProduct.totalUSD)}`
                : "Todavía no hay productos entregados en este rango."
            }
          />
          <HighlightBox
            title="Zona delivery líder"
            main={report.topDeliveryZone?.label || "Sin delivery"}
            detail={
              report.topDeliveryZone
                ? `${report.topDeliveryZone.count} registro(s) · ${formatUSD(report.topDeliveryZone.totalUSD)}`
                : "Todavía no hay delivery entregado en este rango."
            }
          />
          <HighlightBox
            title="Método divisas líder"
            main={report.topUSDMethod?.label || "Sin divisas"}
            detail={
              report.topUSDMethod
                ? `${report.topUSDMethod.count} pago(s) · ${formatUSD(report.topUSDMethod.totalUSD)}`
                : "Todavía no hay cobros en divisas."
            }
          />
          <HighlightBox
            title="Método Bs líder"
            main={report.topVESMethod?.label || "Sin bolívares"}
            detail={
              report.topVESMethod
                ? `${report.topVESMethod.count} pago(s) · Bs ${formatVES(report.topVESMethod.totalVES || 0)}`
                : "Todavía no hay cobros en bolívares."
            }
          />
          <HighlightBox
            title="Categoría de gasto líder"
            main={report.topExpenseCategory?.label || "Sin gastos"}
            detail={
              report.topExpenseCategory
                ? `${report.topExpenseCategory.count} gasto(s) · ${formatUSD(report.topExpenseCategory.totalUSD)}`
                : "Todavía no hay gastos guardados en este rango."
            }
          />
          <HighlightBox
            title="Método de gasto líder"
            main={report.topExpenseMethod?.label || "Sin método"}
            detail={
              report.topExpenseMethod
                ? `${report.topExpenseMethod.count} gasto(s) · ${formatUSD(report.topExpenseMethod.totalUSD)}`
                : "Todavía no hay métodos de gasto guardados."
            }
          />
          <HighlightBox
            title="Proveedor principal"
            main={report.topExpenseProvider?.label || "Sin proveedor"}
            detail={
              report.topExpenseProvider
                ? `${report.topExpenseProvider.count} gasto(s) · ${formatUSD(report.topExpenseProvider.totalUSD)}`
                : "Todavía no hay proveedor guardado en este rango."
            }
          />
          <HighlightBox
            title="Tipo de gasto líder"
            main={report.topExpenseType?.label || "Sin tipo"}
            detail={
              report.topExpenseType
                ? `${report.topExpenseType.count} gasto(s) · ${formatUSD(report.topExpenseType.totalUSD)}`
                : "Todavía no hay tipos de gasto guardados."
            }
          />
          <HighlightBox
            title="Compras de inventario"
            main={formatUSD(report.inventoryExpenses.totalUSD)}
            detail={`${report.inventoryExpenses.count} registro(s) relacionados con inventario.`}
          />
        </div>

        {showBusinessSections && (
          <>
            <SmartAlerts
              title="Alertas inteligentes del rango"
              description="El sistema revisa los cierres filtrados y marca puntos que conviene revisar antes de tomar decisiones."
              alerts={smartAlerts}
            />

            <RangeCharts dayCloses={dayCloses} totals={totals} report={report} />
          </>
        )}

        {showAdvancedSections && (
          <div className="grid gap-4 xl:grid-cols-2">
            <SummaryList
              title="Ventas por vendedor en el rango"
              emptyText="Sin cobros con vendedor en este rango."
              items={report.salesBySeller}
              showVES
            />
            <SummaryList
              title="Pedidos por registrador en el rango"
              emptyText="Sin registradores en este rango."
              items={report.ordersByRegistrar}
            />
            <SummaryList
              title="Cobros acumulados por estado"
              emptyText="Sin cobros por estado en este rango."
              items={report.paymentByStatus}
            />
            <SummaryList
              title="Cobros acumulados en divisas"
              emptyText="Sin cobros en divisas en este rango."
              items={report.paymentByUSDMethod}
            />
            <SummaryList
              title="Cobros acumulados en bolívares"
              emptyText="Sin cobros en bolívares en este rango."
              items={report.paymentByVESMethod}
              showVES
            />
            <SummaryList
              title="Delivery por forma de cobro"
              emptyText="Sin delivery cobrado en este rango."
              items={report.deliveryByPaymentIn}
              showDelivery
              showVES
            />
            <SummaryList
              title="Delivery acumulado por zona"
              emptyText="Sin delivery por zona en este rango."
              items={report.deliveryByZone}
              showDelivery
            />
            <SummaryList
              title="Gastos por categoría"
              emptyText="Sin gastos por categoría en este rango."
              items={report.expensesByCategory}
              showVES
            />
            <SummaryList
              title="Gastos por método"
              emptyText="Sin gastos por método en este rango."
              items={report.expensesByMethod}
              showVES
            />
            <SummaryList
              title="Gastos por proveedor"
              emptyText="Sin proveedores guardados en este rango."
              items={report.expensesByProvider}
              showVES
            />
            <SummaryList
              title="Gastos por tipo"
              emptyText="Sin tipos de gasto guardados en este rango."
              items={report.expensesByType}
              showVES
            />
            <ProductsSoldList products={report.allProducts.slice(0, 8)} />
          </div>
        )}
      </div>
    </section>
  )
}

function getChartPercent(value: number, maxValue: number) {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) {
    return "0%"
  }

  const percent = Math.max(0, Math.min(100, (value / maxValue) * 100))

  return `${percent}%`
}

function RangeCharts({
  dayCloses,
  totals,
  report,
}: {
  dayCloses: SavedDayClose[]
  totals: ReturnType<typeof getDayCloseTotals>
  report: ReturnType<typeof getRangeReport>
}) {
  const chronologicalCloses = [...dayCloses]
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()

      return dateA - dateB
    })
    .slice(-8)

  const maxCloseValue = Math.max(
    1,
    ...chronologicalCloses.map((close) =>
      Math.max(close.realCollectedUSD, close.realPendingUSD, close.totalSoldUSD)
    )
  )

  const topProducts = report.allProducts.slice(0, 6)
  const topZones = report.deliveryByZone.slice(0, 6)
  const topUSDMethods = report.paymentByUSDMethod.slice(0, 6)
  const topVESMethods = report.paymentByVESMethod.slice(0, 6)

  const maxProductQuantity = Math.max(
    1,
    ...topProducts.map((product) => product.quantity)
  )
  const maxZoneValue = Math.max(
    1,
    ...topZones.map((item) => Math.max(item.totalUSD, item.deliveryCostUSD || 0))
  )
  const maxUSDMethodValue = Math.max(
    1,
    ...topUSDMethods.map((item) => item.totalUSD)
  )
  const maxVESMethodValue = Math.max(
    1,
    ...topVESMethods.map((item) => Math.max(item.totalVES || 0, item.totalUSD))
  )
  const maxMoneySummaryValue = Math.max(
    1,
    totals.totalSoldUSD,
    totals.realCollectedUSD,
    totals.realPendingUSD,
    totals.realCashUSD,
    totals.realVESEquivalentUSD,
    totals.deliveryCollectedUSD
  )

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartPanel
        title="Cobro contra pendiente"
        description="Compara lo vendido, lo cobrado y lo pendiente dentro del rango filtrado."
      >
        <MoneyChartBar
          label="Total vendido"
          value={totals.totalSoldUSD}
          maxValue={maxMoneySummaryValue}
        />
        <MoneyChartBar
          label="Total cobrado"
          value={totals.realCollectedUSD}
          maxValue={maxMoneySummaryValue}
        />
        <MoneyChartBar
          label="Pendiente"
          value={totals.realPendingUSD}
          maxValue={maxMoneySummaryValue}
        />
        <MoneyChartBar
          label="Divisas"
          value={totals.realCashUSD}
          maxValue={maxMoneySummaryValue}
        />
        <MoneyChartBar
          label="Bs equiv. USD"
          value={totals.realVESEquivalentUSD}
          maxValue={maxMoneySummaryValue}
        />
        <MoneyChartBar
          label="Delivery"
          value={totals.deliveryCollectedUSD}
          maxValue={maxMoneySummaryValue}
        />
      </ChartPanel>

      <ChartPanel
        title="Evolución por cierre"
        description="Últimos cierres del rango, ordenados del más antiguo al más reciente."
      >
        {chronologicalCloses.length === 0 ? (
          <EmptyChartText text="Sin cierres para graficar." />
        ) : (
          chronologicalCloses.map((close) => (
            <MoneyChartBar
              key={close.id}
              label={getCloseTitle(close)}
              value={close.realCollectedUSD}
              maxValue={maxCloseValue}
              detail={`Pendiente ${formatUSD(close.realPendingUSD)} · Vendido ${formatUSD(close.totalSoldUSD)}`}
            />
          ))
        )}
      </ChartPanel>

      <ChartPanel
        title="Productos más vendidos"
        description="Ranking por unidades vendidas dentro de los cierres entregados."
      >
        {topProducts.length === 0 ? (
          <EmptyChartText text="Sin productos vendidos en este rango." />
        ) : (
          topProducts.map((product) => (
            <QuantityChartBar
              key={product.name}
              label={product.name}
              quantity={product.quantity}
              maxQuantity={maxProductQuantity}
              detail={`${formatUSD(product.totalUSD)}${
                product.onlyCurrency ? " · Solo divisas" : ` · Bs ${formatVES(product.totalVES)}`
              }`}
            />
          ))
        )}
      </ChartPanel>

      <ChartPanel
        title="Delivery por zona"
        description="Zonas con más movimiento dentro del rango filtrado."
      >
        {topZones.length === 0 ? (
          <EmptyChartText text="Sin zonas delivery en este rango." />
        ) : (
          topZones.map((item) => (
            <MoneyChartBar
              key={item.label}
              label={item.label}
              value={item.totalUSD}
              maxValue={maxZoneValue}
              detail={`${item.count} registro(s) · Delivery ${formatUSD(item.deliveryCostUSD || 0)}`}
            />
          ))
        )}
      </ChartPanel>

      <ChartPanel
        title="Métodos en divisas"
        description="Distribución de cobros reales recibidos en divisas."
      >
        {topUSDMethods.length === 0 ? (
          <EmptyChartText text="Sin cobros en divisas." />
        ) : (
          topUSDMethods.map((item) => (
            <MoneyChartBar
              key={item.label}
              label={item.label}
              value={item.totalUSD}
              maxValue={maxUSDMethodValue}
              detail={`${item.count} pago(s)`}
            />
          ))
        )}
      </ChartPanel>

      <ChartPanel
        title="Métodos en bolívares"
        description="Distribución de cobros reales recibidos en bolívares."
      >
        {topVESMethods.length === 0 ? (
          <EmptyChartText text="Sin cobros en bolívares." />
        ) : (
          topVESMethods.map((item) => (
            <VESChartBar
              key={item.label}
              label={item.label}
              valueVES={item.totalVES || 0}
              valueUSD={item.totalUSD}
              maxValue={maxVESMethodValue}
              detail={`${item.count} pago(s) · Equiv. ${formatUSD(item.totalUSD)}`}
            />
          ))
        )}
      </ChartPanel>

      <ChartPanel
        title="Gastos por categoría"
        description="Salidas de caja agrupadas por categoría dentro del rango filtrado."
      >
        {report.expensesByCategory.length === 0 ? (
          <EmptyChartText text="Sin gastos por categoría en este rango." />
        ) : (
          report.expensesByCategory.slice(0, 6).map((item) => (
            <MoneyChartBar
              key={item.label}
              label={item.label}
              value={item.totalUSD}
              maxValue={Math.max(1, ...report.expensesByCategory.map((expense) => expense.totalUSD))}
              detail={`${item.count} gasto(s) · Bs ${formatVES(item.totalVES || 0)}`}
            />
          ))
        )}
      </ChartPanel>

      <ChartPanel
        title="Gastos por método"
        description="Cómo salieron los gastos: divisas, bolívares, Binance/USDT, Zelle u otros métodos."
      >
        {report.expensesByMethod.length === 0 ? (
          <EmptyChartText text="Sin gastos por método en este rango." />
        ) : (
          report.expensesByMethod.slice(0, 6).map((item) => (
            <MoneyChartBar
              key={item.label}
              label={item.label}
              value={item.totalUSD}
              maxValue={Math.max(1, ...report.expensesByMethod.map((expense) => expense.totalUSD))}
              detail={`${item.count} gasto(s) · Bs ${formatVES(item.totalVES || 0)}`}
            />
          ))
        )}
      </ChartPanel>

      <ChartPanel
        title="Gastos por proveedor"
        description="Proveedores o comercios que más peso tienen en las compras y gastos."
      >
        {report.expensesByProvider.length === 0 ? (
          <EmptyChartText text="Sin proveedores guardados en este rango." />
        ) : (
          report.expensesByProvider.slice(0, 6).map((item) => (
            <MoneyChartBar
              key={item.label}
              label={item.label}
              value={item.totalUSD}
              maxValue={Math.max(1, ...report.expensesByProvider.map((expense) => expense.totalUSD))}
              detail={`${item.count} gasto(s) · Bs ${formatVES(item.totalVES || 0)}`}
            />
          ))
        )}
      </ChartPanel>

      <ChartPanel
        title="Gastos por tipo"
        description="Diferencia compras de inventario, pagos, servicios, mantenimiento y otros gastos."
      >
        {report.expensesByType.length === 0 ? (
          <EmptyChartText text="Sin tipos de gasto guardados en este rango." />
        ) : (
          report.expensesByType.slice(0, 6).map((item) => (
            <MoneyChartBar
              key={item.label}
              label={item.label}
              value={item.totalUSD}
              maxValue={Math.max(1, ...report.expensesByType.map((expense) => expense.totalUSD))}
              detail={`${item.count} gasto(s) · Bs ${formatVES(item.totalVES || 0)}`}
            />
          ))
        )}
      </ChartPanel>
    </div>
  )
}

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {title}
      </p>
      <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
        {description}
      </p>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  )
}

function MoneyChartBar({
  label,
  value,
  maxValue,
  detail,
}: {
  label: string
  value: number
  maxValue: number
  detail?: string
}) {
  return (
    <ChartBar
      label={label}
      value={formatUSD(value)}
      percent={getChartPercent(value, maxValue)}
      detail={detail}
    />
  )
}

function VESChartBar({
  label,
  valueVES,
  valueUSD,
  maxValue,
  detail,
}: {
  label: string
  valueVES: number
  valueUSD: number
  maxValue: number
  detail?: string
}) {
  return (
    <ChartBar
      label={label}
      value={`Bs ${formatVES(valueVES)}`}
      percent={getChartPercent(Math.max(valueVES, valueUSD), maxValue)}
      detail={detail}
    />
  )
}

function QuantityChartBar({
  label,
  quantity,
  maxQuantity,
  detail,
}: {
  label: string
  quantity: number
  maxQuantity: number
  detail?: string
}) {
  return (
    <ChartBar
      label={label}
      value={`${quantity} unidad(es)`}
      percent={getChartPercent(quantity, maxQuantity)}
      detail={detail}
    />
  )
}

function ChartBar({
  label,
  value,
  percent,
  detail,
}: {
  label: string
  value: string
  percent: string
  detail?: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black uppercase text-[var(--brand-ink-3)]">
            {label}
          </p>
          {detail && (
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
              {detail}
            </p>
          )}
        </div>
        <p className="shrink-0 text-sm font-black text-[var(--brand-primary)]">{value}</p>
      </div>

      <div className="mt-3 h-3 overflow-hidden rounded-full border border-[var(--brand-primary)]/20 bg-white">
        <div
          className="h-full rounded-full bg-[var(--brand-accent)] shadow-[inset_0_0_0_1px_rgba(var(--brand-primary-rgb),0.2)]"
          style={{ width: percent }}
        />
      </div>
    </div>
  )
}

function EmptyChartText({ text }: { text: string }) {
  return (
    <p className="rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
      {text}
    </p>
  )
}

function HighlightBox({
  title,
  main,
  detail,
}: {
  title: string
  main: string
  detail: string
}) {
  return (
    <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {title}
      </p>
      <p className="mt-2 text-xl font-black uppercase leading-tight text-[var(--brand-ink-3)]">
        {main}
      </p>
      <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
        {detail}
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone = "red",
}: {
  label: string
  value: string | number
  tone?: "red" | "yellow" | "soft"
}) {
  const style =
    tone === "yellow"
      ? "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
      : tone === "soft"
        ? "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]"
        : "border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-primary)]"

  return (
    <div className={`rounded-[1.2rem] border-2 p-3 ${style}`}>
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-1 break-words text-2xl font-black">{value}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-2">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-[var(--brand-ink-3)]">
        {value}
      </p>
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

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
      {children}
    </p>
  )
}

function SummaryList({
  title,
  emptyText,
  items,
  showVES,
  showDelivery,
}: {
  title: string
  emptyText: string
  items: SummaryItem[]
  showVES?: boolean
  showDelivery?: boolean
}) {
  return (
    <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {title}
      </p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
          {emptyText}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                    {item.count} registro(s)
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-base font-black text-[var(--brand-primary)]">
                    {formatUSD(item.totalUSD)}
                  </p>
                  {showVES && item.totalVES && item.totalVES > 0 && (
                    <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                      Bs {formatVES(item.totalVES)}
                    </p>
                  )}
                  {showDelivery && item.deliveryCostUSD && item.deliveryCostUSD > 0 && (
                    <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                      Delivery {formatUSD(item.deliveryCostUSD)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExpensesList({ expenses }: { expenses: DayCloseExpense[] }) {
  return (
    <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        Gastos del cierre
      </p>

      {expenses.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
          Sin gastos guardados en este cierre.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {expenses.map((expense, index) => (
            <div
              key={`${expense.id || expense.concept}-${index}`}
              className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                    {expense.concept}
                  </p>
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]">
                    {expense.expenseType || "Gasto operativo"} · {expense.category} · {expense.method}
                  </p>
                  {expense.provider && (
                    <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                      Proveedor: {expense.provider}
                    </p>
                  )}
                  {(expense.inventoryLinked || expense.inventoryItemName) && (
                    <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                      Inventario: {expense.inventoryItemName || "Insumo"} +{expense.inventoryQuantity || 0} {expense.inventoryUnit || "unidades"}
                    </p>
                  )}
                  {expense.note && (
                    <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                      {expense.note}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-base font-black text-[var(--brand-primary)]">
                    {formatUSD(expense.equivalentUSD)}
                  </p>
                  {expense.amountUSD > 0 && (
                    <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                      Divisas {formatUSD(expense.amountUSD)}
                    </p>
                  )}
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
  )
}

function ProductsSoldList({ products }: { products: ProductSold[] }) {
  return (
    <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        Productos vendidos
      </p>

      {products.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
          Sin productos vendidos guardados.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {products.map((product, index) => (
            <div
              key={`${product.name}-${index}`}
              className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                    {product.name}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                    {product.quantity} unidad(es)
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-base font-black text-[var(--brand-primary)]">
                    {formatUSD(product.totalUSD)}
                  </p>
                  {product.totalVES > 0 && (
                    <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                      Bs {formatVES(product.totalVES)}
                    </p>
                  )}
                  {product.onlyCurrency && (
                    <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                      Solo divisas
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalShell({
  title,
  children,
  onClose,
  footer,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--brand-ink-3)]/60 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-4">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-ink-3)] shadow-2xl shadow-black/45">
        <div className="h-5 shrink-0 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

        <div className="flex shrink-0 items-start justify-between gap-4 border-b-2 border-[var(--brand-primary)] bg-white px-4 py-4 sm:px-6 sm:py-5">
          <h2 className="text-2xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-3xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
          >
            <X size={24} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t-2 border-[var(--brand-primary)] bg-white px-4 py-3 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { BRAND } from "@/lib/brand"
import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Save,
  Wrench,
  XCircle,
} from "lucide-react"
import {
  LOCAL_PLAN_DEFINITIONS,
  getIncludedModulesForPlan,
  getLocalPlanDefinition,
  type LocalModuleKey,
  type LocalModulePlanAccess,
  type LocalPlanKey,
  type LocalPlanMode,
} from "@/lib/localPlans"

const SUPPORT_STORAGE_KEY = "santo_perrito_support_session"

type SupportCheck = {
  key: string
  label: string
  ok: boolean
  error: string
  detail: string
}

type SupportPlanSettings = {
  membershipPlan: LocalPlanKey
  membershipPlanMode: LocalPlanMode
  customIncludedModules: LocalModuleKey[]
  customBlockedModules: LocalModuleKey[]
  activePlan: {
    key: LocalPlanKey
    label: string
    shortLabel: string
    description: string
    commercialFocus: string
  }
  availablePlans: typeof LOCAL_PLAN_DEFINITIONS
  modules: LocalModulePlanAccess[]
  includedCount: number
  totalCount: number
}

type SupportStatus = {
  ok: boolean
  checkedAt: string
  access: {
    role: string
    roleLabel: string
  }
  environment: {
    ownerPasswordConfigured: boolean
    managerPasswordConfigured: boolean
    cashierPasswordConfigured: boolean
    kitchenPasswordConfigured: boolean
    deliveryPasswordConfigured: boolean
    supportPasswordConfigured: boolean
  }
  business: {
    name: string
    description: string
    deliveryEnabled: boolean
    exchangeRateMode: string
    defaultViewMode: string
  }
  planSettings: SupportPlanSettings
  checks: SupportCheck[]
  counts: {
    orders: number
    activeOrders: number
    deliveryZones: number
    activeDeliveryZones: number
    dayCloses: number
    dayExpenses: number
  }
}

type PlanDraft = {
  membershipPlan: LocalPlanKey
  membershipPlanMode: LocalPlanMode
  customIncludedModules: LocalModuleKey[]
  customBlockedModules: LocalModuleKey[]
}

type AuthStatus =
  | "idle"
  | "checking"
  | "authorized"
  | "unauthorized"
  | "error"

const DEFAULT_PLAN_DRAFT: PlanDraft = {
  membershipPlan: "complete",
  membershipPlanMode: "plan",
  customIncludedModules: [],
  customBlockedModules: [],
}

async function readApiResponse(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      "El servidor respondió con una página en vez de datos. Revisa la ruta de soporte."
    )
  }
}

function formatDate(value: string) {
  if (!value) return "Sin revisión"

  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function uniqueModules(values: LocalModuleKey[]) {
  return Array.from(new Set(values))
}

function removeModule(values: LocalModuleKey[], moduleKey: LocalModuleKey) {
  return values.filter((value) => value !== moduleKey)
}

function getDraftBaseIncludedModules(draft: PlanDraft) {
  return getIncludedModulesForPlan(draft.membershipPlan)
}

function isModuleIncludedInDraft(
  draft: PlanDraft,
  moduleItem: LocalModulePlanAccess
) {
  const baseIncluded = getDraftBaseIncludedModules(draft).includes(
    moduleItem.moduleKey
  )

  if (draft.membershipPlanMode !== "custom") {
    return baseIncluded
  }

  if (draft.customBlockedModules.includes(moduleItem.moduleKey)) {
    return false
  }

  if (draft.customIncludedModules.includes(moduleItem.moduleKey)) {
    return true
  }

  return baseIncluded
}

export default function SupportPage() {
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [authStatus, setAuthStatus] = useState<AuthStatus>("idle")
  const [status, setStatus] = useState<SupportStatus | null>(null)
  const [planDraft, setPlanDraft] = useState<PlanDraft>(DEFAULT_PLAN_DRAFT)
  const [message, setMessage] = useState<string | null>(null)
  const [isSavingPlan, setIsSavingPlan] = useState(false)

  const isAuthorized = authStatus === "authorized"

  async function validateSupportAccess(password: string, shouldLoadStatus = true) {
    const cleanPassword = password.trim()

    if (!cleanPassword) return

    try {
      setAuthStatus("checking")
      setMessage(null)

      const response = await fetch("/api/local-auth?moduleKey=support", {
        headers: {
          "x-admin-password": cleanPassword,
        },
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok || !data.ok || !data.access?.allowed) {
        throw new Error(data.error || "Clave no autorizada para soporte")
      }

      if (data.access?.role !== "support") {
        throw new Error(
          "Esta área solo permite la clave de soporte. Cierra sesión e ingresa la clave definida en ORDERS_SUPPORT_PASSWORD."
        )
      }

      window.sessionStorage.setItem(SUPPORT_STORAGE_KEY, cleanPassword)
      setPasswordInput(cleanPassword)
      setAuthStatus("authorized")

      if (shouldLoadStatus) {
        await loadSupportStatus(cleanPassword)
      }
    } catch (error) {
      setAuthStatus("unauthorized")
      setStatus(null)
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo validar el acceso de soporte"
      )
    }
  }

  function syncPlanDraft(nextStatus: SupportStatus) {
    setPlanDraft({
      membershipPlan: nextStatus.planSettings.membershipPlan,
      membershipPlanMode: nextStatus.planSettings.membershipPlanMode,
      customIncludedModules: nextStatus.planSettings.customIncludedModules || [],
      customBlockedModules: nextStatus.planSettings.customBlockedModules || [],
    })
  }

  async function loadSupportStatus(password = passwordInput) {
    const cleanPassword = password.trim()

    if (!cleanPassword) return

    try {
      setMessage(null)

      const response = await fetch("/api/local-support/status", {
        headers: {
          "x-admin-password": cleanPassword,
        },
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar el estado de soporte")
      }

      setStatus(data as SupportStatus)
      syncPlanDraft(data as SupportStatus)
      setAuthStatus("authorized")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el estado de soporte"
      )
    }
  }

  async function savePlanDraft() {
    const cleanPassword = passwordInput.trim()

    if (!cleanPassword) {
      setMessage("No hay clave de soporte activa.")
      return
    }

    try {
      setIsSavingPlan(true)
      setMessage(null)

      const businessConfigPayload = {
        membershipPlan: planDraft.membershipPlan,
        membershipPlanMode: planDraft.membershipPlanMode,
        customIncludedModules:
          planDraft.membershipPlanMode === "custom"
            ? planDraft.customIncludedModules
            : [],
        customBlockedModules:
          planDraft.membershipPlanMode === "custom"
            ? planDraft.customBlockedModules
            : [],
      }

      const response = await fetch("/api/business-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": cleanPassword,
        },
        body: JSON.stringify({
          businessConfig: businessConfigPayload,
        }),
      })

      const data = await readApiResponse(response)

      if (!response.ok || data.error) {
        throw new Error(data.error || "No se pudo guardar el plan")
      }

      setMessage("Plan y módulos guardados correctamente.")
      await loadSupportStatus(cleanPassword)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el plan del cliente"
      )
    } finally {
      setIsSavingPlan(false)
    }
  }

  function handleLogin() {
    validateSupportAccess(passwordInput)
  }

  function handleLogout() {
    window.sessionStorage.removeItem(SUPPORT_STORAGE_KEY)
    setPasswordInput("")
    setStatus(null)
    setPlanDraft(DEFAULT_PLAN_DRAFT)
    setMessage(null)
    setAuthStatus("idle")
  }

  function updatePlan(plan: LocalPlanKey) {
    setPlanDraft((current) => ({
      ...current,
      membershipPlan: plan,
      customIncludedModules:
        current.membershipPlanMode === "plan" ? [] : current.customIncludedModules,
      customBlockedModules:
        current.membershipPlanMode === "plan" ? [] : current.customBlockedModules,
    }))
  }

  function updatePlanMode(mode: LocalPlanMode) {
    setPlanDraft((current) => ({
      ...current,
      membershipPlanMode: mode,
      customIncludedModules: mode === "plan" ? [] : current.customIncludedModules,
      customBlockedModules: mode === "plan" ? [] : current.customBlockedModules,
    }))
  }

  function setDraftModuleIncluded(
    moduleItem: LocalModulePlanAccess,
    shouldInclude: boolean
  ) {
    setPlanDraft((current) => {
      const moduleKey = moduleItem.moduleKey
      const baseIncluded = getDraftBaseIncludedModules(current).includes(moduleKey)
      let customIncludedModules = removeModule(current.customIncludedModules, moduleKey)
      let customBlockedModules = removeModule(current.customBlockedModules, moduleKey)

      if (shouldInclude && !baseIncluded) {
        customIncludedModules = uniqueModules([...customIncludedModules, moduleKey])
      }

      if (!shouldInclude && baseIncluded) {
        customBlockedModules = uniqueModules([...customBlockedModules, moduleKey])
      }

      return {
        ...current,
        customIncludedModules,
        customBlockedModules,
      }
    })
  }

  const restoreSession = useEffectEvent(() => {
    const savedPassword = window.sessionStorage.getItem(SUPPORT_STORAGE_KEY)

    if (savedPassword) {
      validateSupportAccess(savedPassword)
    }
  })

  useEffect(() => {
    // Difiere la restauración de sesión un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(restoreSession, 0)
    return () => clearTimeout(timer)
  }, [])

  const checksOk = useMemo(() => {
    if (!status) return 0

    return status.checks.filter((check) => check.ok).length
  }, [status])

  const totalChecks = status?.checks.length || 0
  const activePlanDefinition = getLocalPlanDefinition(planDraft.membershipPlan)
  const visibleModules = status?.planSettings.modules || []
  const includedDraftCount = visibleModules.filter((moduleItem) =>
    isModuleIncludedInDraft(planDraft, moduleItem)
  ).length

  if (!isAuthorized) {
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

            <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-[1.8rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.14)]">
              <Wrench size={42} />
            </div>

            <p className="mt-5 text-center text-xs font-black uppercase tracking-[0.28em] text-[var(--brand-primary)]">
              Acceso privado
            </p>

            <h1 className="mt-2 text-center text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
              Soporte
            </h1>

            <p className="mt-3 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
              Ingresa la clave autorizada para revisar el estado del sistema, el plan activo y los módulos disponibles.
            </p>
          </div>

          <div className="space-y-4 px-6 pb-6">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Clave de soporte
              </label>

              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleLogin()
                  }}
                  placeholder="Ingresa la clave de soporte"
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

            {message && (
              <div className="rounded-2xl border-2 border-red-500/35 bg-red-100 px-4 py-3">
                <p className="text-sm font-bold leading-6 text-red-800">
                  {message}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={authStatus === "checking"}
              className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:scale-[1.02] disabled:opacity-60"
            >
              {authStatus === "checking" ? (
                <Loader2 size={21} className="animate-spin" />
              ) : (
                <LockKeyhole size={21} />
              )}
              Entrar a soporte
            </button>
          </div>
        </div>
      </main>
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
                    onClick={() => loadSupportStatus()}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                  >
                    <RefreshCw size={16} />
                    Revisar estado
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    Cerrar sesión
                  </button>
                </div>

                <p className="mt-4 text-xs font-black uppercase tracking-[0.32em] text-[var(--brand-primary)]">
                  {status?.business.name || BRAND.name}
                </p>

                <h1 className="mt-1 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  Soporte privado
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Centro de control para revisar conexión, variables, checklist de entrega y módulos incluidos según el plan del cliente.
                </p>

                {status && (
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-ink)]/70">
                    Acceso: {status.access.roleLabel} · Última revisión: {formatDate(status.checkedAt)}
                  </p>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:w-[620px]">
                <MetricCard label="Plan seleccionado" value={activePlanDefinition.shortLabel} />
                <MetricCard label="Módulos incluidos" value={`${includedDraftCount}/${visibleModules.length || "—"}`} tone="good" />
                <MetricCard label="Chequeos correctos" value={`${checksOk}/${totalChecks}`} tone={checksOk === totalChecks ? "good" : "warning"} />
                <MetricCard label="Pedidos activos" value={status?.counts.activeOrders ?? "—"} />
              </div>
            </div>
          </div>
        </header>

        {message && (
          <section className="mt-4 rounded-[1.4rem] border-2 border-yellow-400 bg-[var(--brand-accent-100)] p-4">
            <p className="text-sm font-black leading-6 text-[var(--brand-amber)]">
              {message}
            </p>
          </section>
        )}

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <PanelCard
            title="Plan y membresía"
            description="Soporte decide qué está incluido. El dueño solo podrá activar o desactivar módulos que estén dentro de su plan."
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {LOCAL_PLAN_DEFINITIONS.map((plan) => {
                const active = planDraft.membershipPlan === plan.key

                return (
                  <button
                    key={plan.key}
                    type="button"
                    onClick={() => updatePlan(plan.key)}
                    className={`rounded-[1.2rem] border-2 p-4 text-left transition ${
                      active
                        ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                        : "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-ink-3)] hover:border-[var(--brand-primary)]"
                    }`}
                  >
                    <p className="text-sm font-black uppercase">
                      {plan.label}
                    </p>
                    <p className="mt-2 text-xs font-bold leading-5">
                      {plan.description}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ModeButton
                label="Usar plan fijo"
                description="Los módulos dependen únicamente del plan seleccionado."
                active={planDraft.membershipPlanMode === "plan"}
                onClick={() => updatePlanMode("plan")}
              />
              <ModeButton
                label="Modo personalizado"
                description="Permite activar o bloquear módulos uno por uno para casos especiales."
                active={planDraft.membershipPlanMode === "custom"}
                onClick={() => updatePlanMode("custom")}
              />
            </div>

            <div className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
              <p className="text-sm font-black uppercase text-[var(--brand-primary)]">
                {activePlanDefinition.label}
                {planDraft.membershipPlanMode === "custom" ? " · Personalizado" : ""}
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                {activePlanDefinition.commercialFocus}
              </p>
            </div>

            <button
              type="button"
              onClick={savePlanDraft}
              disabled={isSavingPlan}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
            >
              {isSavingPlan ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Guardar plan y módulos
            </button>
          </PanelCard>

          <PanelCard
            title="Estado de conexión"
            description="Revisión rápida de las áreas principales conectadas al sistema."
          >
            <div className="grid gap-3">
              {(status?.checks || []).map((check) => (
                <CheckRow key={check.key} check={check} />
              ))}
            </div>
          </PanelCard>
        </section>

        <section className="mt-4">
          <PanelCard
            title="Módulos del cliente"
            description="En modo plan se muestran como lectura. En modo personalizado puedes incluir o bloquear módulos específicos."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleModules.map((moduleItem) => {
                const included = isModuleIncludedInDraft(planDraft, moduleItem)
                const canToggle =
                  planDraft.membershipPlanMode === "custom" &&
                  moduleItem.moduleKey !== "support" &&
                  moduleItem.moduleKey !== "settings" &&
                  moduleItem.moduleKey !== "businessBasicConfig"

                return (
                  <ModulePlanCard
                    key={moduleItem.moduleKey}
                    moduleItem={moduleItem}
                    included={included}
                    canToggle={canToggle}
                    onChange={(nextValue) => setDraftModuleIncluded(moduleItem, nextValue)}
                  />
                )
              })}
            </div>
          </PanelCard>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <PanelCard
            title="Claves configuradas"
            description="No se muestran claves, solo si existe o falta cada acceso."
          >
            <div className="grid gap-2">
              <ConfigRow label="Dueño" ok={Boolean(status?.environment.ownerPasswordConfigured)} />
              <ConfigRow label="Encargado" ok={Boolean(status?.environment.managerPasswordConfigured)} />
              <ConfigRow label="Caja" ok={Boolean(status?.environment.cashierPasswordConfigured)} />
              <ConfigRow label="Cocina" ok={Boolean(status?.environment.kitchenPasswordConfigured)} />
              <ConfigRow label="Delivery" ok={Boolean(status?.environment.deliveryPasswordConfigured)} />
              <ConfigRow label="Soporte" ok={Boolean(status?.environment.supportPasswordConfigured)} />
            </div>
          </PanelCard>

          <PanelCard
            title="Datos del negocio"
            description="Información base leída desde la configuración actual."
          >
            <div className="grid gap-2">
              <InfoBox label="Nombre" value={status?.business.name || "—"} />
              <InfoBox label="Descripción" value={status?.business.description || "—"} />
              <InfoBox label="Delivery" value={status?.business.deliveryEnabled ? "Activo" : "Inactivo"} />
              <InfoBox label="Tasa" value={status?.business.exchangeRateMode || "—"} />
              <InfoBox label="Vista" value={status?.business.defaultViewMode || "—"} />
            </div>
          </PanelCard>

          <PanelCard
            title="Datos operativos"
            description="Conteos rápidos sin modificar información."
          >
            <div className="grid gap-2">
              <InfoBox label="Pedidos cargados" value={String(status?.counts.orders ?? "—")} />
              <InfoBox label="Pedidos activos" value={String(status?.counts.activeOrders ?? "—")} />
              <InfoBox label="Zonas delivery" value={String(status?.counts.deliveryZones ?? "—")} />
              <InfoBox label="Zonas activas" value={String(status?.counts.activeDeliveryZones ?? "—")} />
              <InfoBox label="Cierres guardados" value={String(status?.counts.dayCloses ?? "—")} />
              <InfoBox label="Gastos hoy" value={String(status?.counts.dayExpenses ?? "—")} />
            </div>
          </PanelCard>
        </section>

        <section className="mt-4">
          <PanelCard
            title="Checklist de entrega"
            description="Puntos mínimos para revisar antes de entregar o publicar una copia del sistema."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <ChecklistItem text="Variables de entorno cargadas en local y Vercel." />
              <ChecklistItem text="Claves de dueño, encargado, caja, cocina, delivery y soporte definidas según el plan." />
              <ChecklistItem text="Supabase conectado y respondiendo." />
              <ChecklistItem text="Plan del cliente configurado desde soporte." />
              <ChecklistItem text="Módulos no incluidos visibles con candado en configuración del dueño." />
              <ChecklistItem text="Panel operativo oculta módulos no incluidos o apagados." />
              <ChecklistItem text="La página pública muestra información final y clara para los clientes." />
              <ChecklistItem text="El soporte privado no aparece como tarjeta en el panel del negocio." />
            </div>
          </PanelCard>
        </section>
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
  tone?: "soft" | "good" | "warning"
}) {
  const toneClass =
    tone === "good"
      ? "border-green-500/40 bg-green-50"
      : tone === "warning"
        ? "border-yellow-400 bg-[var(--brand-accent-100)]"
        : "border-[var(--brand-primary)]/20 bg-[var(--brand-cream)]"

  return (
    <div className={`rounded-[1.2rem] border-2 px-4 py-3 ${toneClass}`}>
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </p>
      <p className="mt-1 break-words text-xl font-black text-[var(--brand-ink-3)]">
        {value}
      </p>
    </div>
  )
}

function PanelCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[1.6rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          {title}
        </p>
        <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
          {description}
        </p>
      </div>

      {children}
    </section>
  )
}

function ModeButton({
  label,
  description,
  active,
  onClick,
}: {
  label: string
  description: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.2rem] border-2 p-4 text-left transition ${
        active
          ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
          : "border-[var(--brand-primary)]/25 bg-white text-[#1a1a1a] hover:border-[var(--brand-primary)]"
      }`}
    >
      <p className="text-sm font-black uppercase">{label}</p>
      <p className="mt-2 text-xs font-bold leading-5">{description}</p>
    </button>
  )
}


function getSupportModuleLabel(moduleItem: LocalModulePlanAccess) {
  if (moduleItem.moduleKey === "menuProducts") {
    return "Productos del menú"
  }

  return moduleItem.label
}

function getSupportModuleDescription(moduleItem: LocalModulePlanAccess) {
  if (moduleItem.moduleKey === "menuProducts") {
    return "Permite al dueño crear y editar productos visibles en la página pública, subir fotos, cambiar precios, categorías, disponibilidad y destacados."
  }

  return moduleItem.description
}

function ModulePlanCard({
  moduleItem,
  included,
  canToggle,
  onChange,
}: {
  moduleItem: LocalModulePlanAccess
  included: boolean
  canToggle: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div
      className={`rounded-[1.25rem] border-2 p-4 ${
        included
          ? "border-green-500/45 bg-green-50"
          : "border-[var(--brand-primary)]/20 bg-[var(--brand-cream)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
            {getSupportModuleLabel(moduleItem)}
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
            {getSupportModuleDescription(moduleItem)}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[0.62rem] font-black uppercase ${
            included ? "bg-green-500 text-white" : "bg-[var(--brand-ink-3)] text-white"
          }`}
        >
          {included ? "Incluido" : "Bloqueado"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-[var(--brand-primary)]/20 bg-white px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
          Desde {moduleItem.minimumPlanLabel}
        </span>
        {moduleItem.comingSoon && (
          <span className="rounded-full border border-yellow-500/50 bg-[var(--brand-accent-100)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-amber)]">
            Próximamente
          </span>
        )}
      </div>

      {moduleItem.moduleKey === "menuProducts" && (
        <p className="mt-3 rounded-2xl border border-[var(--brand-primary)]/15 bg-white px-3 py-2 text-xs font-bold leading-5 text-[#1a1a1a]/65">
          Este módulo controla el editor de productos del menú. Si está bloqueado, el cliente no debe poder crear ni modificar productos desde el panel, pero el menú público ya guardado se mantiene funcionando.
        </p>
      )}

      {canToggle ? (
        <button
          type="button"
          onClick={() => onChange(!included)}
          className={`mt-4 w-full rounded-full border-2 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition ${
            included
              ? "border-red-600 bg-white text-red-700 hover:bg-red-50"
              : "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] hover:bg-[var(--brand-accent-200)]"
          }`}
        >
          {included ? "Bloquear en este cliente" : "Incluir en este cliente"}
        </button>
      ) : (
        <p className="mt-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white px-3 py-2 text-xs font-bold leading-5 text-[#1a1a1a]/65">
          {moduleItem.moduleKey === "support"
            ? "Acceso interno de soporte. No se vende como módulo del negocio."
            : "Activa el modo personalizado para cambiar este módulo manualmente."}
        </p>
      )}
    </div>
  )
}

function CheckRow({ check }: { check: SupportCheck }) {
  return (
    <div
      className={`rounded-2xl border-2 p-4 ${
        check.ok ? "border-green-500/45 bg-green-50" : "border-red-500/45 bg-red-50"
      }`}
    >
      <div className="flex gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
            check.ok
              ? "border-green-700 bg-green-500 text-white"
              : "border-red-700 bg-red-600 text-white"
          }`}
        >
          {check.ok ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
            {check.label}
          </p>
          <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
            {check.ok ? check.detail : check.error || check.detail}
          </p>
        </div>
      </div>
    </div>
  )
}

function ConfigRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-[var(--brand-primary)]" />
        <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
          {label}
        </p>
      </div>

      <span
        className={`rounded-full px-3 py-1 text-[0.68rem] font-black uppercase ${
          ok ? "bg-green-500 text-white" : "bg-red-100 text-red-700"
        }`}
      >
        {ok ? "Lista" : "Falta"}
      </span>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-[var(--brand-ink-3)]">
        {value || "—"}
      </p>
    </div>
  )
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4">
      <AlertTriangle className="mt-0.5 shrink-0 text-[var(--brand-primary)]" size={18} />
      <p className="text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
        {text}
      </p>
    </div>
  )
}

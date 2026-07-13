"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import {
  ArrowLeft,
  Loader2,
  LockKeyhole,
  LogIn,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"
import { BRAND } from "@/lib/brand"
import { getSupabaseBrowser } from "@/lib/supabaseBrowser"
import { resolveStaffLoginEmail } from "@/lib/staffIdentity"
import LocalStaffShell from "@/components/LocalStaffShell"

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"

type ModuleKey =
  | "publicMenu"
  | "publicCart"
  | "publicWhatsapp"
  | "businessBasicConfig"
  | "settings"
  | "mainPanel"
  | "kitchen"
  | "sounds"
  | "cashier"
  | "delivery"
  | "history"
  | "ownerDashboard"
  | "expenses"
  | "reports"
  | "roles"
  | "advancedPublicConfig"
  | "promotions"
  | "featuredProducts"
  | "menuProducts"
  | "customers"
  | "inventory"
  | "inventoryAlerts"
  | "advancedMenu"
  | "productVariations"
  | "productAddons"
  | "productBuilder"
  | "productCombos"
  | "productAvailability"
  | "salesChannels"
  | "paymentProofs"
  | "openAccounts"
  | "tables"
  | "qrTables"
  | "reservations"
  | "rooms"
  | "hotelReservations"
  | "waiterConfirmation"
  | "kitchenItems"
  | "tickets"
  | "splitBill"
  | "serviceChargeTips"
  | "suppliers"
  | "supplierPurchases"
  | "accountsPayable"
  | "subrecipes"
  | "auditLog"
  | "visualEditor"
  | "trainingMode"
  | "advancedReports"
  | "futureModules"
  | "branches"
  | "support"

type GuardState =
  | "loading"
  | "available"
  | "blocked"
  | "needs-login"
  | "role-blocked"
  | "plan-blocked"
  | "error"

type AccessApiResponse = {
  ok?: boolean
  error?: string
  access?: {
    role?: string | null
    roleLabel?: string
    moduleKey?: ModuleKey
    displayName?: string
    navModules?: string[]
    canAccessRole?: boolean
    moduleEnabled?: boolean
    enabledByOwner?: boolean
    effectiveEnabled?: boolean
    includedInPlan?: boolean
    lockedByPlan?: boolean
    allowed?: boolean
    plan?: string
    planLabel?: string
    planMode?: string
    minimumPlan?: string
    minimumPlanLabel?: string
  }
  businessConfig?: {
    businessName?: string
  }
}

function getModuleStatusText(
  moduleKey: ModuleKey,
  state: GuardState,
  access?: AccessApiResponse["access"]
) {
  if (state === "plan-blocked") {
    const minimumPlanText = access?.minimumPlanLabel
      ? ` Disponible desde ${access.minimumPlanLabel}.`
      : " Disponible en un plan superior."

    if (moduleKey === "delivery") {
      return `Delivery no está incluido en el plan activo.${minimumPlanText} El dueño puede verlo como función disponible, pero soporte debe activarlo desde el plan.`
    }

    if (moduleKey === "cashier") {
      return `Caja no está incluida en el plan activo.${minimumPlanText} El negocio puede seguir usando un flujo simple sin caja avanzada.`
    }

    if (moduleKey === "paymentProofs") {
      return `Comprobantes de pago no está incluido en el plan activo.${minimumPlanText} El cliente no podrá reportar capturas hasta que soporte lo incluya en el plan.`
    }

    if (moduleKey === "openAccounts") {
      return `Cuentas abiertas no está incluido en el plan activo.${minimumPlanText} El dueño puede verla como función disponible, pero soporte debe incluirla antes de usarla en caja o mesonero.`
    }

    if (moduleKey === "ownerDashboard") {
      return `El resumen del dueño no está incluido en el plan activo.${minimumPlanText}`
    }

    if (moduleKey === "expenses") {
      return `Gastos no está incluido en el plan activo.${minimumPlanText}`
    }

    if (moduleKey === "history") {
      return `El historial de cierres no está incluido en el plan activo.${minimumPlanText}`
    }

    return `Este módulo no está incluido en el plan activo.${minimumPlanText}`
  }

  if (state === "role-blocked") {
    if (moduleKey === "support") {
      return "Esta clave no tiene acceso al soporte privado."
    }

    if (moduleKey === "delivery") {
      return "Esta clave no tiene acceso a Delivery. Delivery solo debe ver pedidos a domicilio y reportar entregas."
    }

    if (moduleKey === "cashier") {
      return "Esta clave no tiene acceso a Caja. Caja queda reservada para el dueño, encargado o personal de caja."
    }

    if (moduleKey === "paymentProofs") {
      return "Esta clave no tiene acceso a comprobantes. Solo dueño, encargado o caja pueden revisar pagos reportados."
    }

    if (moduleKey === "openAccounts") {
      return "Esta clave no tiene acceso a cuentas abiertas. Mesonero puede abrir y asociar pedidos; caja, encargado o dueño pueden cerrar cuentas."
    }

    if (moduleKey === "kitchen") {
      return "Esta clave no tiene acceso a Cocina. Cocina queda reservada para el dueño, encargado o personal de cocina."
    }

    if (moduleKey === "history") {
      return "Esta clave no tiene acceso al historial. Los cierres quedan reservados para dueño o encargado."
    }

    if (moduleKey === "expenses") {
      return "Esta clave no tiene acceso a gastos. Los gastos quedan reservados para dueño o encargado."
    }

    if (moduleKey === "ownerDashboard") {
      return "Esta clave no tiene acceso al resumen del dueño."
    }

    if (moduleKey === "settings") {
      return "Esta clave no tiene acceso a configuración. La configuración queda reservada para el dueño."
    }

    return "Esta clave no tiene acceso a este módulo."
  }

  if (moduleKey === "delivery") {
    return "Este módulo está desactivado o el delivery general está apagado desde la configuración del negocio."
  }

  if (moduleKey === "paymentProofs") {
    return "Comprobantes de pago está desactivado desde Configuración del negocio."
  }

  if (moduleKey === "openAccounts") {
    return "Cuentas abiertas está desactivado desde Configuración del negocio."
  }

  if (moduleKey === "tickets") {
    return "Tickets e impresión está desactivado desde Configuración del negocio."
  }

  if (moduleKey === "kitchenItems") {
    return "Cocina por producto está desactivado desde Configuración del negocio."
  }

  return "Este módulo está desactivado desde la configuración del negocio."
}

function clearStoredAccess() {
  try {
    window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
  } catch {
    // Si el navegador bloquea sessionStorage, no hace falta hacer nada.
  }

  window.location.href = "/local-santo"
}

// Login directo en la pantalla del módulo: el empleado entra a su enlace
// (ej. /local-santo/caja), pone usuario y contraseña y queda dentro del módulo
// al que iba, sin pasar por otra página. La clave privada del negocio (modo
// .env) sigue funcionando si ya está guardada en la sesión, pero no se ofrece
// aquí: los empleados entran con su usuario.
function InlineLoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [loginUser, setLoginUser] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const supabase = getSupabaseBrowser()
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: resolveStaffLoginEmail(loginUser),
        password,
      })

      if (loginError) {
        setError("Usuario o contraseña incorrectos.")
        return
      }

      onLoggedIn()
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const inputClassName =
    "mt-1 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
  const labelClassName =
    "text-left text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
      <div>
        <label className={labelClassName}>Usuario</label>
        <input
          type="text"
          autoComplete="username"
          value={loginUser}
          onChange={(event) => setLoginUser(event.target.value)}
          required
          placeholder="maria, jose o correo"
          className={inputClassName}
        />
      </div>
      <div>
        <label className={labelClassName}>Contraseña</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className={inputClassName}
        />
      </div>

      {error ? (
        <p className="text-sm font-bold text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-60"
      >
        {loading ? <Loader2 className="animate-spin" size={17} /> : <LogIn size={17} />}
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  )
}

function AccessScreen({
  moduleName,
  businessName,
  state,
  moduleKey,
  roleLabel,
  errorMessage,
  access,
  onRetry,
  onLoggedIn,
}: {
  moduleName: string
  businessName: string
  state: Exclude<GuardState, "available">
  moduleKey: ModuleKey
  roleLabel: string
  errorMessage: string | null
  access?: AccessApiResponse["access"]
  onRetry?: () => void
  onLoggedIn?: () => void
}) {
  const isLoading = state === "loading"
  const needsLogin = state === "needs-login"
  const hasError = state === "error"
  const isRoleBlocked = state === "role-blocked"
  const isPlanBlocked = state === "plan-blocked"

  // "Volver" solo tiene sentido si se llegó navegando desde el panel general;
  // un empleado que entra directo a su enlace no tiene a dónde "volver".
  const [cameFromPanel] = useState(() => {
    if (typeof document === "undefined") return false
    try {
      const referrer = document.referrer
      if (!referrer || !referrer.startsWith(window.location.origin)) return false
      const referrerPath = new URL(referrer).pathname.replace(/\/$/, "")
      return referrerPath === "/local-santo"
    } catch {
      return false
    }
  })
  const showBack = cameFromPanel

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)]">
      <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]">
        <div className="h-6 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

        <div className="px-6 py-7 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]">
            {isLoading ? (
              <Loader2 className="animate-spin" size={30} />
            ) : needsLogin ? (
              <LockKeyhole size={30} />
            ) : (
              <ShieldAlert size={30} />
            )}
          </div>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">
            {isLoading
              ? "Revisando acceso"
              : needsLogin
                ? "Validación requerida"
                : hasError
                  ? "No se pudo revisar el acceso"
                  : isPlanBlocked
                    ? "No incluido en el plan"
                    : isRoleBlocked
                      ? "Acceso no permitido"
                      : "Módulo no disponible"}
          </p>

          <h1 className="mt-2 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
            {moduleName}
          </h1>

          {roleLabel && !needsLogin && !isLoading ? (
            <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-ink)]/70">
              Clave detectada: {roleLabel}
            </p>
          ) : null}

          {access?.planLabel && !needsLogin && !isLoading ? (
            <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-ink)]/70">
              Plan activo: {access.planLabel}
              {access.planMode === "custom" ? " · Personalizado" : ""}
            </p>
          ) : null}

          <p className="mx-auto mt-4 max-w-sm text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
            {isLoading
              ? `Estamos verificando el acceso privado para ${businessName}.`
              : needsLogin
                ? "Pon tu usuario y contraseña para entrar directo a este módulo."
                : hasError
                  ? errorMessage || "No se pudo validar el acceso. Revisa la conexión y vuelve a intentarlo."
                  : getModuleStatusText(moduleKey, state, access)}
          </p>

          {needsLogin && onLoggedIn ? (
            <InlineLoginForm onLoggedIn={onLoggedIn} />
          ) : null}

          <div className={`${needsLogin ? "mt-4" : "mt-6"} grid gap-3 ${needsLogin || !showBack ? "" : "sm:grid-cols-2"}`}>
            {showBack ? (
              <a
                href="/local-santo"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
              >
                <ArrowLeft size={17} />
                Volver
              </a>
            ) : null}

            {needsLogin ? null : (
              <button
                type="button"
                onClick={clearStoredAccess}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
              >
                <LockKeyhole size={17} />
                Cambiar clave
              </button>
            )}
          </div>

          {hasError && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
            >
              <RefreshCw size={17} />
              Intentar de nuevo
            </button>
          ) : null}
        </div>
      </div>
    </main>
  )
}

export default function ModuleAccessGuard({
  moduleKey,
  moduleName,
  children,
  chromeless = false,
}: {
  moduleKey: ModuleKey
  moduleName: string
  children: ReactNode
  // Pantallas de cara al cliente (ej. /local-santo/pantalla en el TV del
  // stand): valida el acceso igual pero no envuelve con la barra del staff.
  chromeless?: boolean
}) {
  const [state, setState] = useState<GuardState>("loading")
  const [businessName, setBusinessName] = useState<string>(BRAND.name)
  const [roleLabel, setRoleLabel] = useState("")
  const [access, setAccess] = useState<AccessApiResponse["access"]>(undefined)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function validateAccess() {
      setState("loading")
      setErrorMessage(null)

      try {
        // Puede autenticar por contraseña (modo .env) o por sesión de Supabase
        // (el AuthBridge adjunta el token). Si no hay ninguna, el backend
        // responde 401 y caemos a "needs-login".
        const storedPassword = window.sessionStorage.getItem(ADMIN_STORAGE_KEY) || ""

        const response = await fetch(
          `/api/local-auth?moduleKey=${encodeURIComponent(moduleKey)}`,
          {
            method: "GET",
            headers: {
              "x-admin-password": storedPassword,
            },
            cache: "no-store",
          }
        )

        const data = (await response.json()) as AccessApiResponse

        if (!isMounted) return

        const nextBusinessName = String(
          data.businessConfig?.businessName || BRAND.name
        ).trim()

        setBusinessName(nextBusinessName || BRAND.name)
        setRoleLabel(String(data.access?.roleLabel || ""))
        setAccess(data.access)

        if (response.ok && data.ok && data.access?.allowed) {
          setState("available")
          return
        }

        if (response.status === 401) {
          setState("needs-login")
          return
        }

        if (data.access?.includedInPlan === false) {
          setState("plan-blocked")
          return
        }

        if (data.access?.moduleEnabled === false) {
          setState("blocked")
          return
        }

        if (data.access?.canAccessRole === false) {
          setState("role-blocked")
          return
        }

        throw new Error(data.error || "No se pudo validar el acceso")
      } catch (error) {
        if (!isMounted) return

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo validar el acceso"
        )
        setState("error")
      }
    }

    validateAccess()

    return () => {
      isMounted = false
    }
  }, [moduleKey, retryKey])

  if (state === "available") {
    if (chromeless) return <>{children}</>

    return (
      <LocalStaffShell
        moduleKey={moduleKey}
        allowedModules={access?.navModules || []}
        roleLabel={roleLabel}
        displayName={access?.displayName || ""}
      >
        {children}
      </LocalStaffShell>
    )
  }

  return (
    <AccessScreen
      moduleName={moduleName}
      businessName={businessName}
      moduleKey={moduleKey}
      state={state}
      roleLabel={roleLabel}
      errorMessage={errorMessage}
      access={access}
      onRetry={() => setRetryKey((current) => current + 1)}
      onLoggedIn={() => setRetryKey((current) => current + 1)}
    />
  )
}

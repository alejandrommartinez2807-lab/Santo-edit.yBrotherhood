import {
  LOCAL_MODULE_KEYS,
  isKnownLocalModuleKey as isKnownPlanModuleKey,
  type LocalModuleKey,
} from "./localPlans"

export type { LocalModuleKey, LocalPlanKey, LocalPlanMode } from "./localPlans"

export type LocalRole =
  | "owner"
  | "manager"
  | "cashier"
  | "waiter"
  | "kitchen"
  | "delivery"
  // Vendedor de eventos/ferias: registra pedidos y cobra en su carrito;
  // sus ventas quedan atribuidas para el reporte por vendedor del cierre.
  | "promoter"
  | "support"

export type StaffPermissionsMode = "role" | "custom"

export type LocalAccessResult =
  | {
      ok: true
      role: LocalRole
      roleLabel: string
      passwordSource: string
      staffId?: string
      username?: string
      displayName?: string
      permissionsMode?: StaffPermissionsMode
      allowedModules?: LocalModuleKey[]
      allBranches?: boolean
      allowedBranchIds?: string[]
    }
  | {
      ok: false
      role: null
      roleLabel: ""
      passwordSource: ""
    }

const ROLE_LABELS: Record<LocalRole, string> = {
  owner: "Dueño",
  manager: "Encargado",
  cashier: "Caja",
  waiter: "Mesonero",
  kitchen: "Cocina",
  delivery: "Delivery",
  promoter: "Promotor",
  support: "Soporte",
}

const OWNER_ALLOWED_MODULES = LOCAL_MODULE_KEYS

const ROLE_ACCESS: Record<LocalRole, LocalModuleKey[]> = {
  owner: OWNER_ALLOWED_MODULES,
  manager: [
    "mainPanel",
    "cashier",
    "kitchen",
    "delivery",
    "history",
    "expenses",
    "reports",
    "paymentProofs",
    "openAccounts",
    "tables",
    "qrTables",
    "reservations",
    "rooms",
    "hotelReservations",
    "folio",
    "housekeeping",
    "rateSeasons",
    "hotelReports",
    // Gerencia de hotel: opera todo el PMS (calendario, motor de reservas,
    // tarifas avanzadas, resort, huéspedes, cierre de día y facturación).
    "tapeChart",
    "bookingEngine",
    "guestPortal",
    "groupBookings",
    "advancedRates",
    "onlinePayments",
    "fiscalInvoicing",
    "guestMemberships",
    "webhooks",
    "staffShifts",
    "nightAudit",
    "resortServices",
    "resortCharges",
    "hotelPackages",
    "guestReviews",
    "guestCrm",
    "channelManager",
    "guestNotifications",
    "hotelLanding",
    "waiterConfirmation",
    "kitchenItems",
    "tickets",
    "customers",
    "inventory",
    "inventoryAlerts",
    "suppliers",
    "supplierPurchases",
    "accountsPayable",
    "sounds",
  ],
  cashier: ["mainPanel", "cashier", "paymentProofs", "openAccounts", "tickets", "staffShifts"],
  waiter: [
    "mainPanel",
    "openAccounts",
    "tables",
    "qrTables",
    "reservations",
    "waiterConfirmation",
    "kitchenItems",
    "tickets",
    "staffShifts",
  ],
  kitchen: ["kitchen", "kitchenItems", "tickets", "staffShifts"],
  delivery: ["delivery", "staffShifts"],
  promoter: ["mainPanel", "cashier", "paymentProofs", "tickets", "staffShifts"],
  support: OWNER_ALLOWED_MODULES,
}

function cleanPassword(value: unknown) {
  return String(value || "").trim()
}

function readEnvPassword(name: string) {
  return cleanPassword(process.env[name])
}

function uniquePasswordEntries(
  entries: Array<{
    role: LocalRole
    password: string
    passwordSource: string
  }>
) {
  const seen = new Set<string>()
  const result: Array<{
    role: LocalRole
    password: string
    passwordSource: string
  }> = []

  entries.forEach((entry) => {
    if (!entry.password) return

    const key = `${entry.role}:${entry.password}`

    if (seen.has(key)) return

    seen.add(key)
    result.push(entry)
  })

  return result
}

export function getLocalAccessPasswordEntries() {
  return uniquePasswordEntries([
    {
      role: "owner",
      password: readEnvPassword("ORDERS_OWNER_PASSWORD"),
      passwordSource: "ORDERS_OWNER_PASSWORD",
    },
    {
      role: "owner",
      password: readEnvPassword("ORDERS_ADMIN_PASSWORD"),
      passwordSource: "ORDERS_ADMIN_PASSWORD",
    },
    {
      role: "owner",
      password: readEnvPassword("ADMIN_PASSWORD"),
      passwordSource: "ADMIN_PASSWORD",
    },
    {
      role: "manager",
      password: readEnvPassword("ORDERS_MANAGER_PASSWORD"),
      passwordSource: "ORDERS_MANAGER_PASSWORD",
    },
    {
      role: "cashier",
      password: readEnvPassword("ORDERS_CASHIER_PASSWORD"),
      passwordSource: "ORDERS_CASHIER_PASSWORD",
    },
    {
      role: "waiter",
      password: readEnvPassword("ORDERS_WAITER_PASSWORD"),
      passwordSource: "ORDERS_WAITER_PASSWORD",
    },
    {
      role: "kitchen",
      password: readEnvPassword("ORDERS_KITCHEN_PASSWORD"),
      passwordSource: "ORDERS_KITCHEN_PASSWORD",
    },
    {
      role: "delivery",
      password: readEnvPassword("ORDERS_DELIVERY_PASSWORD"),
      passwordSource: "ORDERS_DELIVERY_PASSWORD",
    },
    {
      role: "promoter",
      password: readEnvPassword("ORDERS_PROMOTER_PASSWORD"),
      passwordSource: "ORDERS_PROMOTER_PASSWORD",
    },
    {
      role: "support",
      password: readEnvPassword("ORDERS_SUPPORT_PASSWORD"),
      passwordSource: "ORDERS_SUPPORT_PASSWORD",
    },
    {
      role: "support",
      password: readEnvPassword("ORDERS_PROVIDER_PASSWORD"),
      passwordSource: "ORDERS_PROVIDER_PASSWORD",
    },
  ])
}

export function getLocalAccessFromPassword(password: unknown): LocalAccessResult {
  const cleanInput = cleanPassword(password)

  if (!cleanInput) {
    return {
      ok: false,
      role: null,
      roleLabel: "",
      passwordSource: "",
    }
  }

  const match = getLocalAccessPasswordEntries().find(
    (entry) => entry.password === cleanInput
  )

  if (!match) {
    return {
      ok: false,
      role: null,
      roleLabel: "",
      passwordSource: "",
    }
  }

  return {
    ok: true,
    role: match.role,
    roleLabel: ROLE_LABELS[match.role],
    passwordSource: match.passwordSource,
  }
}

export function canLocalRoleAccessModule(
  role: LocalRole,
  moduleKey: LocalModuleKey
) {
  return ROLE_ACCESS[role]?.includes(moduleKey) || false
}

export function getLocalRoleLabel(role: LocalRole) {
  return ROLE_LABELS[role]
}

// Actor para la bitácora de auditoría: prioriza a la persona (nombre visible o
// usuario) sobre el rol, para que la auditoría registre quién exactamente hizo
// la acción. Con claves por rol (.env) no hay identidad y cae al rol legible.
export function getLocalAccessAuditActor(access: LocalAccessResult) {
  if (!access.ok) {
    return { role: null, label: null, source: null, id: null }
  }

  const person =
    String(access.displayName || "").trim() || String(access.username || "").trim()

  return {
    role: access.role,
    label: person || access.roleLabel || ROLE_LABELS[access.role],
    source: access.passwordSource || null,
    id: access.staffId || null,
  }
}

export function getAllowedModulesForLocalRole(role: LocalRole) {
  return ROLE_ACCESS[role] || []
}

export function isKnownLocalModuleKey(value: unknown): value is LocalModuleKey {
  return isKnownPlanModuleKey(value)
}

const STAFF_ROLES: LocalRole[] = [
  "owner",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
  "delivery",
  "promoter",
  "support",
]

function isLocalRole(value: unknown): value is LocalRole {
  return typeof value === "string" && (STAFF_ROLES as string[]).includes(value)
}

type RequestHeaders = { headers: { get(name: string): string | null } }

function readForwardedList(request: RequestHeaders, name: string): string[] {
  const value = request.headers.get(name) || ""
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function readForwardedModules(request: RequestHeaders): LocalModuleKey[] {
  return readForwardedList(request, "x-staff-modules").filter(isKnownLocalModuleKey)
}

function decodeForwardedText(value: string | null) {
  if (!value) return ""
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function canLocalAccessUseModule(
  access: LocalAccessResult,
  moduleKey: LocalModuleKey,
) {
  if (!access.ok) return false
  if (access.allowedModules) return access.allowedModules.includes(moduleKey)
  return canLocalRoleAccessModule(access.role, moduleKey)
}

// Lista efectiva de módulos que esta clave puede usar (permisos custom del
// usuario si existen; si no, los del rol). La usa la barra de navegación para
// mostrar solo los módulos disponibles.
export function getLocalAccessAllowedModules(
  access: LocalAccessResult,
): LocalModuleKey[] {
  if (!access.ok) return []
  if (access.permissionsMode === "custom" && access.allowedModules) {
    return access.allowedModules
  }
  if (access.allowedModules && access.allowedModules.length > 0) {
    return access.allowedModules
  }
  return getAllowedModulesForLocalRole(access.role)
}

export function canLocalAccessUseBranch(
  access: LocalAccessResult,
  branchId: string | null | undefined,
) {
  if (!access.ok || !branchId) return true
  if (access.allBranches !== false) return true
  return (access.allowedBranchIds || []).includes(branchId)
}

// Acceso unificado para las rutas API. Confía en el rol reenviado por el
// middleware (header x-staff-role, YA verificado contra Supabase Auth y que el
// middleware limpia de cualquier valor enviado por el cliente). Si no hay token
// válido, cae a la contraseña por rol (modo .env, compatible hacia atrás).
export function getRequestAccess(
  request: RequestHeaders,
  password: unknown,
): LocalAccessResult {
  const forwardedRole = request.headers.get("x-staff-role")
  if (isLocalRole(forwardedRole)) {
    return {
      ok: true,
      role: forwardedRole,
      roleLabel: ROLE_LABELS[forwardedRole],
      passwordSource: request.headers.get("x-staff-source") || "supabase-auth",
      staffId: request.headers.get("x-staff-id") || undefined,
      username: request.headers.get("x-staff-username") || undefined,
      displayName: decodeForwardedText(request.headers.get("x-staff-display-name")) || undefined,
      permissionsMode:
        request.headers.get("x-staff-permissions-mode") === "custom" ? "custom" : "role",
      allowedModules: readForwardedModules(request),
      allBranches: request.headers.get("x-staff-all-branches") !== "false",
      allowedBranchIds: readForwardedList(request, "x-staff-branch-ids"),
    }
  }
  return getLocalAccessFromPassword(password)
}

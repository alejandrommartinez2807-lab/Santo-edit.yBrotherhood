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
  | "support"

export type LocalAccessResult =
  | {
      ok: true
      role: LocalRole
      roleLabel: string
      passwordSource: string
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
  support: "Soporte",
}

const OWNER_ALLOWED_MODULES = LOCAL_MODULE_KEYS.filter(
  (moduleKey) => moduleKey !== "support"
)

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
    "waiterConfirmation",
    "kitchenItems",
    "tickets",
    "sounds",
  ],
  cashier: ["cashier", "paymentProofs", "openAccounts", "tickets"],
  waiter: [
    "mainPanel",
    "openAccounts",
    "tables",
    "waiterConfirmation",
    "kitchenItems",
    "tickets",
  ],
  kitchen: ["kitchen", "kitchenItems", "tickets"],
  delivery: ["delivery"],
  support: ["support"],
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
  "support",
]

function isLocalRole(value: unknown): value is LocalRole {
  return typeof value === "string" && (STAFF_ROLES as string[]).includes(value)
}

type RequestHeaders = { headers: { get(name: string): string | null } }

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
    }
  }
  return getLocalAccessFromPassword(password)
}

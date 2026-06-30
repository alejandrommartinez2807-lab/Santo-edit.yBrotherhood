import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import {
  getLocalAccessFromPassword,
  type LocalAccessResult,
  type LocalRole,
} from "@/lib/localAccess"

// ============================================================
// Autenticación unificada (Fase A de "auth real").
// Acepta DOS formas, en este orden:
//   1. Token de Supabase Auth (header Authorization: Bearer <jwt>) →
//      se verifica y se busca el rol en la tabla staff_users.
//   2. Contraseña por rol en header x-local-password (modo .env, compatible).
// Devuelve siempre LocalAccessResult, así las rutas no cambian su lógica de
// roles. Cuando todo el panel use Supabase Auth, se puede quitar el modo (2).
// ============================================================

const VALID_ROLES: LocalRole[] = [
  "owner",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
  "delivery",
  "support",
]

const ROLE_LABELS: Record<LocalRole, string> = {
  owner: "Dueño",
  manager: "Encargado",
  cashier: "Caja",
  waiter: "Mesonero",
  kitchen: "Cocina",
  delivery: "Delivery",
  support: "Soporte",
}

const FAIL: LocalAccessResult = {
  ok: false,
  role: null,
  roleLabel: "",
  passwordSource: "",
}

function isValidRole(value: unknown): value is LocalRole {
  return typeof value === "string" && (VALID_ROLES as string[]).includes(value)
}

export async function getStaffAccessFromToken(
  token: string,
): Promise<LocalAccessResult> {
  const clean = String(token || "").trim()
  if (!clean) return FAIL

  const supabase = getSupabaseAdmin()

  const { data: userData, error: userError } = await supabase.auth.getUser(clean)
  if (userError || !userData?.user) return FAIL

  const { data: staff } = await supabase
    .from("staff_users")
    .select("role, is_active")
    .eq("id", userData.user.id)
    .maybeSingle()

  if (!staff || staff.is_active === false) return FAIL

  const role = (staff as { role?: unknown }).role
  if (!isValidRole(role)) return FAIL

  return {
    ok: true,
    role,
    roleLabel: ROLE_LABELS[role] || role,
    passwordSource: "supabase-auth",
  }
}

function getBearerToken(request: NextRequest): string {
  const header = request.headers.get("authorization") || ""
  return header.startsWith("Bearer ") ? header.slice(7).trim() : ""
}

function getRequestPassword(request: NextRequest): string {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

// Resolución unificada para usar en las rutas API.
export async function resolveAccess(request: NextRequest): Promise<LocalAccessResult> {
  const token = getBearerToken(request)
  if (token) {
    const byToken = await getStaffAccessFromToken(token)
    if (byToken.ok) return byToken
  }

  return getLocalAccessFromPassword(getRequestPassword(request))
}

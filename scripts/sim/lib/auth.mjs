// Actores de la simulación: cada empleado inicia sesión REAL contra Supabase
// Auth del proyecto de prueba (username@santo.local) y opera con su Bearer
// token — así la auditoría registra al autor de verdad, no a un genérico.
// Cada actor/dispositivo tiene su propia IP simulada (x-forwarded-for), que es
// además la clave del rate limiter, exactamente como en la vida real.
import { createClient } from "@supabase/supabase-js"
import { simEnv } from "./simulation-guard.mjs"

const sessions = new Map()

function authClient() {
  return createClient(simEnv.NEXT_PUBLIC_SUPABASE_URL, simEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function loginStaff(username, password) {
  const client = authClient()
  const { data, error } = await client.auth.signInWithPassword({
    email: `${username}@santo.local`,
    password,
  })
  if (error) return { ok: false, error: error.message }
  sessions.set(username, data.session.access_token)
  return { ok: true, token: data.session.access_token }
}

export function tokenOf(username) {
  return sessions.get(username) || null
}

export function forgetSession(username) {
  sessions.delete(username)
}

// Headers de un actor staff autenticado (Bearer + sede + IP de su dispositivo).
export function actorHeaders(actor, extra = {}) {
  const headers = {
    "Content-Type": "application/json",
    "x-forwarded-for": actor.ip,
    ...extra,
  }
  if (actor.branchId) headers["x-branch-id"] = actor.branchId
  const token = sessions.get(actor.username)
  if (token) headers.Authorization = `Bearer ${token}`
  else if (actor.rolePassword) headers["x-local-password"] = actor.rolePassword
  return headers
}

// Headers del dueño por clave de rol (mecanismo .env, para bootstrap del Día 0
// antes de que existan usuarios reales).
export function ownerBootstrapHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "x-local-password": simEnv.ORDERS_OWNER_PASSWORD,
    "x-forwarded-for": "10.90.0.2",
    ...extra,
  }
}

// Cliente público anónimo (QR / checkout): sin credenciales, IP propia.
export function publicHeaders(ip, branchId, extra = {}) {
  const headers = { "Content-Type": "application/json", "x-forwarded-for": ip, ...extra }
  if (branchId) headers["x-branch-id"] = branchId
  return headers
}

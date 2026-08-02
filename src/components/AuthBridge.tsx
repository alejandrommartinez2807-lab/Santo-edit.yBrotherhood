"use client"

import { useEffect } from "react"
import { getSupabaseBrowser } from "@/lib/supabaseBrowser"
import { getSelectedBranchId } from "@/lib/branchClient"
import { getPublicApiCacheKey, withPublicApiCache } from "@/lib/publicApiCache"

// Adjunta automáticamente el token de Supabase Auth (Authorization: Bearer) a
// todas las llamadas a /api/* del navegador, cuando hay sesión iniciada. Así
// los paneles existentes se autentican con el usuario real SIN cambiar sus
// llamadas. El backend acepta token o contraseña, por lo que es compatible.
//
// El parche se instala al IMPORTAR el módulo (antes de los efectos de los
// componentes hijos), evitando carreras con la primera validación de acceso.

declare global {
  var __authBridgeInstalled: boolean | undefined
}

function isApiRequest(url: string): boolean {
  if (url.startsWith("/api/")) return true
  if (typeof window !== "undefined" && url.startsWith(window.location.origin + "/api/")) {
    return true
  }
  return false
}

function isPublicApiRequest(url: string): boolean {
  if (url.startsWith("/api/public/")) return true
  if (
    typeof window !== "undefined" &&
    url.startsWith(window.location.origin + "/api/public/")
  ) {
    return true
  }
  return false
}

// Sede del QR: /mesa/<mesa>?branch=<sede> y /?mesa=…&branch=<sede>.
function getBranchIdFromUrl(): string {
  if (typeof window === "undefined") return ""
  try {
    return String(new URLSearchParams(window.location.search).get("branch") || "").trim()
  } catch {
    return ""
  }
}

function installAuthFetchBridge() {
  if (typeof window === "undefined") return
  if (window.__authBridgeInstalled) return
  window.__authBridgeInstalled = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

      if (url && isApiRequest(url)) {
        const headers = new Headers(
          init?.headers ||
            (typeof input !== "string" && !(input instanceof URL)
              ? input.headers
              : undefined),
        )

        let touched = false

        if (!headers.has("authorization")) {
          const { data } = await getSupabaseBrowser().auth.getSession()
          const token = data.session?.access_token
          if (token) {
            headers.set("Authorization", `Bearer ${token}`)
            touched = true
          }
        }

        // Sucursal elegida por el staff → scopea toda la operación.
        //
        // En el flujo PÚBLICO manda el ?branch= del QR (2026-07-25): el cliente
        // que ya había pedido en otra sede tenía esa sede guardada en su
        // teléfono, y este puente la adjuntaba a las primeras llamadas del QR
        // nuevo — menú, mesas y estado de la mesa se resolvían contra la sede
        // EQUIVOCADA hasta que el selector terminaba de cargar y la corregía.
        // Se limita a /api/public/* a propósito: en los paneles autenticados la
        // sede sigue mandándola el selector, nunca un enlace de fuera
        // (blindaje A7).
        if (!headers.has("x-branch-id")) {
          const branchId =
            (isPublicApiRequest(url) ? getBranchIdFromUrl() : "") || getSelectedBranchId()
          if (branchId) {
            headers.set("x-branch-id", branchId)
            touched = true
          }
        }

        if (touched) init = { ...init, headers }

        // Una carga de la carta montaba ~25 componentes y cada uno pedía por su
        // cuenta la configuración pública: 13 llamadas idénticas a
        // business-config, 5 a branches y 3 a products (130 KB cada una) en el
        // mismo instante. Aquí se colapsan en una sola petición real por sede y
        // por ventana de 5 s; pasada la ventana todo vuelve a pedirse fresco.
        // Se hace en el puente para no tocar los 25 componentes, que leen la
        // respuesta cada uno a su manera (auditoría 2026-08-02).
        const method = String(
          init?.method ||
            (typeof input !== "string" && !(input instanceof URL)
              ? input.method
              : "GET") ||
            "GET",
        )
        const branchForCache =
          headers.get("x-branch-id") ||
          (isPublicApiRequest(url) ? getBranchIdFromUrl() : "") ||
          getSelectedBranchId() ||
          ""
        const cacheKey = getPublicApiCacheKey(method, url, branchForCache)

        if (cacheKey) {
          const nextInit = init
          return withPublicApiCache(cacheKey, () => originalFetch(input, nextInit))
        }
      }
    } catch {
      // Si algo falla, no rompemos la petición: sigue sin token.
    }

    return originalFetch(input, init)
  }
}

// ------------------------------------------------------------
// Sentinela de sesión: cuando hay sesión de Supabase, escribimos un valor en la
// clave de sesión que usan los paneles privados, para que su pantalla de login
// se desbloquee igual que con contraseña. El token real lo adjunta el bridge de
// arriba; este sentinela NO es una contraseña válida (el backend usa el token).
// Se escribe en tiempo de import (antes de que monten los paneles) para evitar
// carreras. NO toca una contraseña real ya guardada.

const OWNER_SESSION_KEY = "santo_perrito_owner_session"
const SUPABASE_SENTINEL = "__supabase_session__"

function hasSupabaseSessionSync(): boolean {
  if (typeof window === "undefined") return false
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const raw = window.localStorage.getItem(key)
        if (raw && raw.length > 20) return true
      }
    }
  } catch {
    /* sin acceso a storage */
  }
  return false
}

function syncSupabaseSentinel() {
  if (typeof window === "undefined") return
  try {
    const current = window.localStorage.getItem(OWNER_SESSION_KEY)
    if (hasSupabaseSessionSync()) {
      if (!current) window.localStorage.setItem(OWNER_SESSION_KEY, SUPABASE_SENTINEL)
    } else if (current === SUPABASE_SENTINEL) {
      window.localStorage.removeItem(OWNER_SESSION_KEY)
    }
  } catch {
    /* sin acceso a storage */
  }
}

installAuthFetchBridge()
syncSupabaseSentinel()

export default function AuthBridge() {
  useEffect(() => {
    installAuthFetchBridge()
    syncSupabaseSentinel()

    // Mantener el sentinela al día con login/logout de Supabase.
    const supabase = getSupabaseBrowser()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      syncSupabaseSentinel()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return null
}

import { getSupabaseBrowser } from "@/lib/supabaseBrowser"

// Clave donde los paneles guardan el "sello" de sesión del personal (la misma
// que usa AuthBridge para desbloquear los paneles con sesión de Supabase).
export const STAFF_SESSION_KEY = "santo_perrito_owner_session"

// Borra los tokens de sesión que deja Supabase Auth en el navegador
// (sb-<ref>-auth-token). Si estos quedan, AuthBridge detecta "hay sesión",
// reescribe el sello y te re-loguea con el mismo usuario al volver al panel.
function purgeSupabaseTokens() {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith("sb-") && key.includes("-auth-token")) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    /* sin acceso a storage */
  }
}

// Cierra la sesión del personal DE VERDAD y lleva al login para poder entrar
// como otro usuario. Antes "Salir" solo borraba la clave local: si el ingreso
// fue con un usuario propio (sesión de Supabase), AuthBridge volvía a escribir
// el sello y re-logueaba al mismo usuario. Ahora cerramos la sesión de Supabase
// Y borramos sus tokens del navegador. Es "mejor esfuerzo": si algo falla, igual
// redirige al login.
export async function signOutLocalStaff(redirectTo = "/admin") {
  try {
    await getSupabaseBrowser().auth.signOut()
  } catch {
    /* sin sesión de Supabase o sin red: igual limpiamos y redirigimos */
  }

  purgeSupabaseTokens()

  try {
    window.localStorage.removeItem(STAFF_SESSION_KEY)
    window.sessionStorage.removeItem(STAFF_SESSION_KEY)
  } catch {
    /* sin acceso a storage */
  }

  window.location.assign(redirectTo)
}

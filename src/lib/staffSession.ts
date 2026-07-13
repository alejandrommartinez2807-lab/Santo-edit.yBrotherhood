import { getSupabaseBrowser } from "@/lib/supabaseBrowser"

// Clave donde los paneles guardan el "sello" de sesión del personal (la misma
// que usa AuthBridge para desbloquear los paneles con sesión de Supabase).
export const STAFF_SESSION_KEY = "santo_perrito_owner_session"

// Cierra la sesión del personal DE VERDAD y lleva al login para poder entrar
// como otro usuario. Antes "Salir" solo borraba la clave local: si el ingreso
// fue con un usuario propio (sesión de Supabase), AuthBridge volvía a escribir
// el sello y re-logueaba al mismo usuario. Por eso ahora también cerramos la
// sesión de Supabase. Es "mejor esfuerzo": si algo falla, igual redirige.
export async function signOutLocalStaff(redirectTo = "/pedidos") {
  try {
    window.localStorage.removeItem(STAFF_SESSION_KEY)
  } catch {
    /* sin acceso a storage */
  }
  try {
    window.sessionStorage.removeItem(STAFF_SESSION_KEY)
  } catch {
    /* sin acceso a storage */
  }
  try {
    await getSupabaseBrowser().auth.signOut()
  } catch {
    /* sin sesión de Supabase o sin red: igual redirigimos */
  }

  window.location.assign(redirectTo)
}

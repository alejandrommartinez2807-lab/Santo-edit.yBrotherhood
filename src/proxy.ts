import { NextResponse, type NextRequest } from "next/server"
import { getStaffAccessFromToken } from "@/lib/authServer"
import { applyPrivateApiHeaders } from "@/lib/securityHeaders"

// Middleware de autenticación (Fase B de "auth real").
// Para cada request a /api/*:
//   1. ELIMINA cualquier header x-staff-* que venga del cliente (anti-spoofing).
//   2. Si trae Authorization: Bearer <token>, lo verifica contra Supabase Auth
//      y, si es válido, reenvía el rol en x-staff-role para que la ruta confíe.
// No bloquea nada por sí mismo: la autorización por rol sigue en cada ruta.
// Las rutas públicas (crear pedido, menú público, etc.) simplemente ignoran
// estos headers.

export const config = {
  matcher: "/api/:path*",
}

export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)

  // Anti-spoofing: el cliente NUNCA puede fijar estos headers.
  headers.delete("x-staff-role")
  headers.delete("x-staff-label")
  headers.delete("x-staff-source")

  const authorization = request.headers.get("authorization") || ""
  if (authorization.startsWith("Bearer ")) {
    try {
      const access = await getStaffAccessFromToken(authorization.slice(7))
      if (access.ok) {
        headers.set("x-staff-role", access.role)
        headers.set("x-staff-label", access.roleLabel)
        headers.set("x-staff-source", "supabase-auth")
      }
    } catch {
      // Si la verificación falla, no se reenvía rol; la ruta caerá a la
      // contraseña o devolverá no autorizado. No rompemos el request.
    }
  }

  const response = NextResponse.next({ request: { headers } })
  applyPrivateApiHeaders(response.headers)

  return response
}

import { NextRequest, NextResponse } from "next/server"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"

// Guard común del panel de condominio. Reutiliza el auth por rol/clave del
// template (getRequestAccess): en modo .env la clave llega por header
// x-local-password y se mapea a un rol. Aceptamos los roles administrativos.
const ADMIN_ROLES: LocalRole[] = ["owner", "manager", "support"]

function getPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

export type PanelAccess =
  | { ok: true; role: LocalRole }
  | { ok: false; response: NextResponse }

export function checkPanelAccess(request: NextRequest): PanelAccess {
  const access = getRequestAccess(request, getPassword(request))
  if (!access.ok) {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
  }
  if (!ADMIN_ROLES.includes(access.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Esta clave no tiene permiso para el panel" }, { status: 403 }),
    }
  }
  return { ok: true, role: access.role }
}

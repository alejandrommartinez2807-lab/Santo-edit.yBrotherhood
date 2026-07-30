import type { LocalRole } from "@/lib/localAccess"

// Validación compartida por crear (POST /api/staff) y editar (PATCH
// /api/staff/[id]).
//
// Hallazgo del QA 2026-07-30: un usuario guardado con "todas las sedes"
// DESMARCADO y NINGUNA sucursal tildada se aceptaba igual. En el panel su
// selector de sedes salía vacío (parecía no tener acceso a nada), pero cada
// pedido, cobro y gasto que registraba caía en la sede por DEFECTO — o sea, sus
// ventas se atribuían a una sucursal que nadie le asignó, sin ningún aviso.
//
// Dueño y soporte quedan fuera: su acceso es a todas las sedes por definición.
export function getMissingBranchError(
  role: LocalRole,
  body: Record<string, unknown>,
): string | null {
  if (role === "owner" || role === "support") return null

  // Si la petición no toca el alcance de sedes, no hay nada que validar.
  if (body.allBranches === undefined) return null

  const restricted = body.allBranches === false || body.allBranches === "false"
  if (!restricted) return null

  const raw = body.allowedBranchIds
  const list = Array.isArray(raw)
    ? raw.map((item) => String(item || "").trim()).filter(Boolean)
    : []

  if (list.length > 0) return null

  return "Marca al menos una sucursal para este usuario (o dale acceso a todas)"
}

// Anulaciones: reglas y textos compartidos entre servidor y pantallas.
//
// Política del dueño (2026-07-29): el pedido anulado se explica solo en
// notificación, caja, cierre e historial — origen, motivo, quién, insumos y
// qué pasó con el dinero. Este módulo es puro (sin Supabase) para que lo
// importen tanto las rutas como los componentes de cliente.

export type CancelOrigin = "automatico" | "personal" | "cliente"

export type CancelRefund = "devuelto" | "se_quedo"

// ⚠️ SUPUESTO, no confirmación (instrucción del usuario 2026-07-29: "por lo
// menos por el momento ellos devuelven el dinero"). Si la anulación de un
// pedido cobrado llega SIN respuesta (API, script, cliente con caché vieja),
// se asume que el dinero se devolvió: sale del cierre y de los reportes.
// Riesgo conocido: si en la práctica el efectivo a veces se queda, el cierre
// reportará menos de lo que hay en la gaveta. Cuando el dueño confirme lo
// contrario, invertir el default es SOLO esta línea.
export const CANCEL_REFUND_DEFAULT: CancelRefund = "devuelto"

// Respuesta del cajero a "¿Le devolviste el dinero?" → destino del dinero.
// null/undefined = no respondió → aplica el default de arriba.
export function resolveCancelRefund(
  moneyReturned: boolean | null | undefined,
): CancelRefund {
  if (moneyReturned === false) return "se_quedo"
  if (moneyReturned === true) return "devuelto"
  return CANCEL_REFUND_DEFAULT
}

// origin/refund llegan como string suelto desde cierres viejos (JSON
// guardado): se comparan contra los literales y cualquier valor raro cae al
// texto genérico.
export type CancellationInfo = {
  origin?: string
  reason?: string
  cancelledByName?: string
  cancelledByRole?: string
}

// Roles del sistema → etiqueta humana (subset local para no arrastrar
// localAccess, que es de servidor, a los componentes).
const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  manager: "Encargado",
  cashier: "Cajero",
  waiter: "Mesonero",
  kitchen: "Cocina",
  delivery: "Delivery",
  promoter: "Promotor",
  support: "Soporte",
  system: "Sistema",
  public: "Cliente",
}

function roleLabel(role: string | undefined): string {
  const clean = String(role || "").trim()
  if (!clean) return ""
  return ROLE_LABELS[clean.toLowerCase()] || clean
}

// "Anulado automáticamente" / "Anulado por Génesis (Encargada)" /
// "Cancelado por el cliente". El recorrido del dueño exige distinguir el
// origen de un vistazo, sin parsear el motivo.
export function getCancellationHeadline(info: CancellationInfo): string {
  if (info.origin === "automatico") return "Anulado automáticamente"
  if (info.origin === "cliente") return "Cancelado por el cliente"

  const name = String(info.cancelledByName || "").trim()
  const role = roleLabel(info.cancelledByRole)
  if (name && role && name.toLowerCase() !== role.toLowerCase()) {
    return `Anulado por ${name} (${role})`
  }
  if (name || role) return `Anulado por ${name || role}`
  return "Anulado"
}

// El motivo SIEMPRE dice algo: "no dejó motivo" ES la información en el caso
// del cliente — un hueco en blanco parecería que el sistema perdió el dato.
export function getCancellationReasonText(info: CancellationInfo): string {
  const reason = String(info.reason || "").trim()
  if (reason) return reason
  if (info.origin === "cliente") return "no dejó motivo"
  return "sin motivo registrado"
}

export function getCancelRefundLabel(
  refund: string | null | undefined,
): string {
  if (refund === "se_quedo") return "el dinero se quedó en caja (no es venta)"
  if (refund === "devuelto") return "dinero devuelto al cliente"
  return ""
}

export function getCancelInventoryLabel(
  inventoryUsed: boolean | null | undefined,
): string {
  if (inventoryUsed === true) return "insumos consumidos"
  if (inventoryUsed === false) return "insumos devueltos al stock"
  return ""
}

// Línea completa "Anulado por X — motivo · $Y · insumos… · dinero…" para las
// vistas del recorrido del dueño. receivedUSD ya viene formateado por el
// caller (cada pantalla tiene su formateador de moneda).
export function formatCancellationLine(
  info: CancellationInfo & {
    inventoryUsed?: boolean | null
    refund?: string | null
    receivedLabel?: string
  },
): string {
  const parts = [
    `${getCancellationHeadline(info)} — ${getCancellationReasonText(info)}`,
    String(info.receivedLabel || "").trim(),
    getCancelInventoryLabel(info.inventoryUsed),
    getCancelRefundLabel(info.refund),
  ]
  return parts.filter(Boolean).join(" · ")
}

// ---------- Compatibilidad con anulaciones viejas (sin columnas 0036) ----------

// La nota concatenada "ANULADO: motivo | Por: quién | …" fue el único
// registro hasta 0036 y sigue escribiéndose (la página pública de
// seguimiento la lee). Estos parsers son SOLO fallback para pedidos y
// cierres anteriores a la migración.
export function parseCancelNote(customerNote: string | undefined): {
  reason: string
  cancelledBy: string
} {
  const note = String(customerNote || "")
  const reasonMatch = note.match(/ANULADO:\s*([^|]+)/)
  const byMatch = note.match(/\bPor:\s*([^|]+)/)
  return {
    reason: reasonMatch ? reasonMatch[1].trim() : "",
    cancelledBy: byMatch ? byMatch[1].trim() : "",
  }
}

export function inferCancelOriginFromNote(
  customerNote: string | undefined,
): CancelOrigin | "" {
  const note = String(customerNote || "")
  if (/anulaci[oó]n autom[aá]tica/i.test(note)) return "automatico"
  if (/Cancelado por el cliente/i.test(note)) return "cliente"
  if (/\bPor:\s*/.test(note)) return "personal"
  return ""
}

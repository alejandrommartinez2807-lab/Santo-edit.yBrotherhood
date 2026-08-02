import { createHmac, timingSafeEqual } from "crypto"

// Token de mesa para la consulta pública de cuentas (auditoría 2026-08-02).
//
// /api/public/table-account-status es público a propósito: el comensal escanea
// el QR de su mesa y ve lo que lleva consumido sin instalar nada ni tener clave.
// El problema es que la única "credencial" era el NOMBRE de la mesa, y esos se
// adivinan solos ("Mesa 1", "Mesa 2", "Barra"). Desde fuera del local se podían
// recorrer todas las mesas de las dos sedes y leer en vivo cuánto lleva cada
// una y qué pidió: ticket medio, ocupación real y horas pico servidos en bandeja
// a cualquiera, incluida la competencia.
//
// El token va en el QR y NO se guarda en ninguna parte: se deriva del nombre de
// la mesa, la sede y el secreto del negocio. Así no hace falta migración ni
// mantener una tabla de tokens, y los QR se pueden reimprimir cuando sea.
//
// COMPATIBILIDAD: los QR ya impresos no lo llevan. Por eso el endpoint no
// rechaza a quien no lo trae — le responde SIN los montos ni el detalle de
// consumo, que es justo lo que se estaba filtrando. El comensal con un QR viejo
// sigue pudiendo unirse a la cuenta de su mesa; el que barre desde fuera ya no
// saca nada aprovechable.

const TOKEN_LENGTH = 12

function getSecret() {
  return String(process.env.ORDERS_API_SECRET || "").trim()
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
}

// Firma de una mesa concreta. Devuelve "" si el negocio no tiene secreto
// configurado: sin secreto no hay firma posible y el endpoint se comporta como
// antes (ver isTableTokenEnabled).
export function signTableToken(tableName: string, branchId?: string | null) {
  const secret = getSecret()
  const table = normalize(tableName)

  if (!secret || !table) return ""

  return createHmac("sha256", secret)
    .update(`mesa:${table}|sede:${normalize(branchId)}`)
    .digest("hex")
    .slice(0, TOKEN_LENGTH)
}

// ¿Está el mecanismo activo? Sin ORDERS_API_SECRET no se puede firmar nada, así
// que exigir token dejaría a TODOS los comensales sin ver su cuenta. En ese caso
// se conserva el comportamiento anterior y el diagnóstico de producción lo avisa.
export function isTableTokenEnabled() {
  return Boolean(getSecret())
}

export function isValidTableToken(
  token: unknown,
  tableName: string,
  branchId?: string | null,
) {
  const expected = signTableToken(tableName, branchId)
  const received = String(token ?? "").trim()

  if (!expected || !received || expected.length !== received.length) return false

  // Comparación en tiempo constante: el token es corto y se puede sondear.
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  } catch {
    return false
  }
}

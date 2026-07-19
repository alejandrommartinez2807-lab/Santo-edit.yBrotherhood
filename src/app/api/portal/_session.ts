import crypto from "node:crypto"

// Sesión del portal del residente: token firmado (HMAC) sin dependencias.
// El secreto es la service role key (solo servidor); si faltara, usa un
// fallback para no romper el build (pero en prod siempre existe).
function secret() {
  return (
    process.env.PORTAL_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "palulu-dev-secret"
  )
}

const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30

export function signToken(residentId: string, ttlMs = THIRTY_DAYS): string {
  const payload = `${residentId}.${Date.now() + ttlMs}`
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url")
  return Buffer.from(`${payload}.${sig}`).toString("base64url")
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8")
    const idx = decoded.lastIndexOf(".")
    if (idx < 0) return null
    const payload = decoded.slice(0, idx)
    const sig = decoded.slice(idx + 1)
    const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url")
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const [residentId, exp] = payload.split(".")
    if (!residentId || Number(exp) < Date.now()) return null
    return residentId
  } catch {
    return null
  }
}

// Hash del código de acceso del residente (se guarda en portal_access.otp_hash).
export function hashCode(code: string): string {
  return crypto.createHmac("sha256", secret()).update(`code:${code}`).digest("hex")
}

// Código numérico de 6 dígitos.
export function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")
}

export function bearerToken(request: { headers: { get(n: string): string | null } }): string {
  const h = request.headers.get("authorization") || ""
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : ""
}

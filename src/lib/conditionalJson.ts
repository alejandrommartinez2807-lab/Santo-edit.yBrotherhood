import { createHash } from "crypto"
import { NextResponse } from "next/server"

// Los paneles sondean /api/orders, /api/open-accounts y /api/payment-proofs
// cada pocos segundos, y el 99 % de las veces NADA cambió: la misma respuesta
// de cientos de KB viajaba entera una y otra vez (medido 2026-08-03: 264 KB
// cada 2,5 s ≈ 380 MB/hora por pantalla abierta, solo en egreso de Vercel).
//
// Esto responde 304 (sin cuerpo) cuando el cliente demuestra, vía
// If-None-Match, que ya tiene exactamente este contenido. El ETag es el hash
// del JSON final YA serializado: así captura de una vez todas las dimensiones
// que hacen variar la respuesta (sede resuelta, rol, modo entrenamiento,
// filtros) sin tener que enumerarlas, y dos contextos distintos jamás
// comparten un 304 por accidente.
//
// Importante: el middleware pone `Cache-Control: no-store` a todo /api/* y eso
// NO cambia aquí — el navegador nunca revalida solo ni guarda nada en su caché
// HTTP (mezclaría sedes/roles). El If-None-Match lo manda a mano el sondeo del
// panel (src/lib/panelPolling.ts) guardando el ETag en memoria JS.

export function hashSerializedJson(serialized: string) {
  return createHash("sha1").update(serialized).digest("base64url")
}

export function buildJsonEtag(serialized: string) {
  return `"${hashSerializedJson(serialized)}"`
}

// Comparación tolerante: acepta listas ("a", "b"), el comodín * y el prefijo
// débil W/ por si algún proxy intermedio reescribe el validador.
export function ifNoneMatchSatisfied(headerValue: string | null, etag: string) {
  if (!headerValue) return false

  const trimmed = headerValue.trim()
  if (trimmed === "*") return true

  return trimmed
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === etag || value === `W/${etag}`)
}

type RequestWithHeaders = {
  headers: { get(name: string): string | null }
}

// Núcleo puro (testeable sin next/server): serializa, calcula el validador y
// decide si el cliente ya tiene exactamente este contenido.
export function evaluateConditionalJson(
  ifNoneMatch: string | null,
  payload: unknown,
) {
  const serialized = JSON.stringify(payload)
  const etag = buildJsonEtag(serialized)

  return {
    serialized,
    etag,
    notModified: ifNoneMatchSatisfied(ifNoneMatch, etag),
  }
}

export function conditionalJsonResponse(
  request: RequestWithHeaders,
  payload: unknown,
) {
  const { serialized, etag, notModified } = evaluateConditionalJson(
    request.headers.get("if-none-match"),
    payload,
  )

  if (notModified) {
    // 304: sin cuerpo por definición, repitiendo el validador.
    return new NextResponse(null, { status: 304, headers: { etag } })
  }

  return new NextResponse(serialized, {
    status: 200,
    headers: { etag, "content-type": "application/json" },
  })
}

// ---------------------------------------------------------------------------
// ETag compuesto "huella.contenido" (consumo de Supabase, 2026-08-04)
//
// El validador de arriba exige leer las filas en CADA sondeo para hashearlas.
// El compuesto tiene dos mitades separadas por un punto (los hashes son
// base64url, que jamás contiene puntos):
//
//   · la huella (src/lib/ordersFingerprint.ts) se calcula con dos agregados
//     baratos: si coincide con la del cliente, se responde 304 sin tocar las
//     filas (el camino que corta el egress de Supabase);
//   · el hash del contenido decide, cuando la huella NO coincide (rotó la
//     cubeta de tiempo, o algo se movió), si al menos el cuerpo puede
//     ahorrarse: mismo contenido = 304 con el validador NUEVO, que el sondeo
//     del panel adopta para volver al camino barato.
//
// Un validador viejo sin punto (panel desplegado antes de la huella) sigue
// contando como mitad de contenido: ese cliente no ahorra lecturas, pero
// tampoco pierde el ahorro de bytes que ya tenía.
// ---------------------------------------------------------------------------

export function parseIfNoneMatchValues(headerValue: string | null): string[] {
  if (!headerValue) return []

  return headerValue
    .split(",")
    .map((value) => value.trim())
    .map((value) => (value.startsWith("W/") ? value.slice(2) : value))
    .filter((value) => value.length > 2 && value.startsWith('"') && value.endsWith('"'))
    .map((value) => value.slice(1, -1))
}

function contentHashOf(candidate: string) {
  const dot = candidate.indexOf(".")
  return dot >= 0 ? candidate.slice(dot + 1) : candidate
}

// Camino rápido: ¿el cliente ya demostró tener ESTA huella? Devuelve el
// validador a repetir en el 304 (el suyo, entero) o null si hay que leer.
export function findEtagForFingerprint(
  headerValue: string | null,
  fingerprint: string,
): string | null {
  for (const candidate of parseIfNoneMatchValues(headerValue)) {
    const dot = candidate.indexOf(".")
    if (dot > 0 && candidate.slice(0, dot) === fingerprint) {
      return `"${candidate}"`
    }
  }

  return null
}

// Núcleo puro del camino lento (testeable sin next/server).
export function evaluateFingerprintedJson(
  ifNoneMatch: string | null,
  payload: unknown,
  fingerprint: string,
) {
  const serialized = JSON.stringify(payload)
  const contentHash = hashSerializedJson(serialized)
  const etag = `"${fingerprint}.${contentHash}"`
  const notModified = parseIfNoneMatchValues(ifNoneMatch).some(
    (candidate) => contentHashOf(candidate) === contentHash,
  )

  return { serialized, etag, notModified }
}

export function fingerprintedJsonResponse(
  request: RequestWithHeaders,
  payload: unknown,
  fingerprint: string,
) {
  const { serialized, etag, notModified } = evaluateFingerprintedJson(
    request.headers.get("if-none-match"),
    payload,
    fingerprint,
  )

  if (notModified) {
    // Mismo contenido con huella nueva: el 304 lleva el validador NUEVO y el
    // cliente lo adopta (fetchWithPollEtag), o quedaría leyendo filas por
    // siempre tras la primera rotación de la cubeta.
    return new NextResponse(null, { status: 304, headers: { etag } })
  }

  return new NextResponse(serialized, {
    status: 200,
    headers: { etag, "content-type": "application/json" },
  })
}

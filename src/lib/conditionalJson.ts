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

export function buildJsonEtag(serialized: string) {
  return `"${createHash("sha1").update(serialized).digest("base64url")}"`
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

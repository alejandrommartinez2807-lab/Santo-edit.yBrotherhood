import { createHash } from "crypto"

// La huella barata de /api/orders (consumo de Supabase, 2026-08-04).
//
// El ETag por hash del JSON final ahorra los bytes que van al navegador, pero
// obliga a leer TODAS las filas en cada sondeo para calcularlo (626 KB
// medidos). La huella invierte el orden: primero dos agregados de ~54 bytes
// (cuántos pedidos y el updated_at más reciente) y, solo si NO coinciden con
// lo que el cliente ya tiene, se leen las filas.
//
// En la huella entran POR SU VALOR todas las dimensiones que cambian la
// respuesta sin pasar por la tabla orders (audit de 3 agentes, 2026-08-04):
// los flags de entrenamiento viven en business_config (con los dos conjuntos
// vacíos la huella colisionaría), y sede/rol/módulo/ventana no cambian la URL
// (el cliente guarda el ETag por URL: "Cambiar de usuario" o cambiar de sede
// devolvería un 304 ajeno). El id de deploy evita que una tablet abierta se
// quede con la FORMA vieja del payload tras publicar.
//
// La comparación es por IGUALDAD, nunca por "es más nuevo": borrar el pedido
// más reciente BAJA el max(updated_at) y también tiene que notarse.

// Techo de seguridad: now() en Postgres es la hora de INICIO de transacción,
// así que existe un residuo teórico de milisegundos donde un commit queda por
// debajo de un max ya observado y la huella no lo ve. Metiendo la cubeta de
// tiempo en el hash, el ETag rota solo y fuerza una lectura completa como
// mucho cada 90 s (el audit pedía 60-120): un congelamiento silencioso se
// convierte en un retraso corto.
export const ORDERS_FULL_READ_INTERVAL_MS = 90_000

export function getFullReadBucket(now = Date.now()) {
  return Math.floor(now / ORDERS_FULL_READ_INTERVAL_MS)
}

// Identifica el deploy que está respondiendo. En Vercel siempre hay al menos
// uno de los dos primeros; "dev" solo aparece en local y en los tests.
export function getOrdersDeployId(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.VERCEL_DEPLOYMENT_ID ||
    env.VERCEL_URL ||
    env.VERCEL_GIT_COMMIT_SHA ||
    "dev"
  )
}

export type OrdersFingerprintParts = {
  count: number
  maxUpdatedAt: string | null
  branchId: string | null
  createdFrom: string | null
  trainingModeActive: boolean
  trainingModeAvailable: boolean
  role: string
  moduleKey: string
  deployId: string
  fullReadBucket: number
}

export function buildOrdersFingerprint(parts: OrdersFingerprintParts) {
  // Arreglo de posiciones fijas (no un objeto): el orden de las claves no
  // puede variar entre serializaciones y cada parte entra siempre.
  const serialized = JSON.stringify([
    parts.count,
    parts.maxUpdatedAt,
    parts.branchId,
    parts.createdFrom,
    parts.trainingModeActive,
    parts.trainingModeAvailable,
    parts.role,
    parts.moduleKey,
    parts.deployId,
    parts.fullReadBucket,
  ])

  return createHash("sha1").update(serialized).digest("base64url")
}

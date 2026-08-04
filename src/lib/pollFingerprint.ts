import { createHash } from "crypto"

// La huella barata de los sondeos (consumo de Supabase, 2026-08-04).
//
// El ETag por hash del JSON final ahorra los bytes que van al navegador, pero
// obliga a leer TODAS las filas en cada sondeo para calcularlo (626 KB
// medidos en /api/orders). La huella invierte el orden: primero agregados de
// ~54 bytes (conteos y máximos de timestamps) y, solo si NO coinciden con lo
// que el cliente ya tiene, se leen las filas.
//
// En cada huella entran POR SU VALOR todas las dimensiones que cambian la
// respuesta sin pasar por sus tablas (audit de 3 agentes, 2026-08-04): flags
// de configuración, sede, rol y filtros no cambian la URL (el cliente guarda
// el ETag por URL: "Cambiar de usuario" o cambiar de sede devolvería un 304
// ajeno). El id de deploy evita que una tablet abierta se quede con la FORMA
// vieja del payload tras publicar. Y cada ruta lleva su discriminador, para
// que dos huellas de rutas distintas jamás puedan coincidir.
//
// La comparación es por IGUALDAD, nunca por "es más nuevo": borrar la fila
// más reciente BAJA el máximo y también tiene que notarse.

// Techo de seguridad: now() en Postgres es la hora de INICIO de transacción,
// así que existe un residuo teórico de milisegundos donde un commit queda por
// debajo de un max ya observado y la huella no lo ve. Metiendo la cubeta de
// tiempo en el hash, el ETag rota solo y fuerza una lectura completa como
// mucho cada 90 s (el audit pedía 60-120): un congelamiento silencioso se
// convierte en un retraso corto.
export const POLL_FULL_READ_INTERVAL_MS = 90_000

export function getFullReadBucket(now = Date.now()) {
  return Math.floor(now / POLL_FULL_READ_INTERVAL_MS)
}

// Identifica el deploy que está respondiendo. En Vercel siempre hay al menos
// uno de los dos primeros; "dev" solo aparece en local y en los tests.
export function getPollDeployId(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.VERCEL_DEPLOYMENT_ID ||
    env.VERCEL_URL ||
    env.VERCEL_GIT_COMMIT_SHA ||
    "dev"
  )
}

// Arreglos de posiciones fijas (no objetos): el orden de las claves no puede
// variar entre serializaciones y cada parte entra siempre.
function hashParts(parts: unknown[]) {
  return createHash("sha1").update(JSON.stringify(parts)).digest("base64url")
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
  return hashParts([
    "orders",
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
}

// El payload de /api/open-accounts incluye los PEDIDOS de cada cuenta (y sus
// líneas): cambia con escrituras que no tocan open_accounts. Por eso lleva
// DOS pares de agregados — las cuentas filtradas y el superconjunto de
// pedidos anclados a alguna cuenta (más ancho solo cuesta una lectura de
// más; más angosto congelaría el panel).
export type OpenAccountsFingerprintParts = {
  accountsCount: number
  accountsMaxUpdatedAt: string | null
  attachedOrdersCount: number
  attachedOrdersMaxUpdatedAt: string | null
  branchId: string | null
  status: string | null
  role: string
  roleLabel: string
  deployId: string
  fullReadBucket: number
}

export function buildOpenAccountsFingerprint(parts: OpenAccountsFingerprintParts) {
  return hashParts([
    "open-accounts",
    parts.accountsCount,
    parts.accountsMaxUpdatedAt,
    parts.attachedOrdersCount,
    parts.attachedOrdersMaxUpdatedAt,
    parts.branchId,
    parts.status,
    parts.role,
    parts.roleLabel,
    parts.deployId,
    parts.fullReadBucket,
  ])
}

// payment_proofs no tiene updated_at ni trigger, y no hace falta: sus únicas
// escrituras son INSERT (mueve count y max created_at), DELETE del cierre
// (mueve count) y la revisión, que SIEMPRE estampa reviewed_at = now(). Los
// tres agregados cubren todo sin migración.
export type PaymentProofsFingerprintParts = {
  count: number
  maxCreatedAt: string | null
  maxReviewedAt: string | null
  branchId: string | null
  orderId: string | null
  status: string | null
  role: string
  roleLabel: string
  deployId: string
  fullReadBucket: number
}

export function buildPaymentProofsFingerprint(parts: PaymentProofsFingerprintParts) {
  return hashParts([
    "payment-proofs",
    parts.count,
    parts.maxCreatedAt,
    parts.maxReviewedAt,
    parts.branchId,
    parts.orderId,
    parts.status,
    parts.role,
    parts.roleLabel,
    parts.deployId,
    parts.fullReadBucket,
  ])
}

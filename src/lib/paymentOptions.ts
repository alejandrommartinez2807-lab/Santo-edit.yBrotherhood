import type { DeliveryPaymentIn } from "@/types/localOrders"

// Catálogos únicos de métodos de pago para caja, pedidos y cuentas abiertas.
// Antes había tres copias que ya habían divergido (pedidos ofrecía
// "Binance / USDT" junto mientras caja los separaba). Si agregas un método,
// hazlo solo aquí.

export const PAYMENT_METHOD_USD_OPTIONS = [
  "",
  "Efectivo divisas",
  "Zelle",
  "Binance",
  "USDT",
  "Transferencia internacional",
  "Otro",
]

export const PAYMENT_METHOD_VES_OPTIONS = [
  "",
  "Pago móvil",
  "Punto",
  "Transferencia",
  "Efectivo Bs",
  "Biopago",
  "Otro",
]

export const DELIVERY_PAYMENT_OPTIONS: DeliveryPaymentIn[] = [
  "Sin registrar",
  "Divisas",
  "Bolívares",
  "Mixto",
]

// Palabras clave que delatan un método en bolívares (Pago móvil, Punto,
// Transferencia, Efectivo Bs, Biopago…). Se usa para decidir en qué moneda se
// pide/muestra el monto en el flujo público, tolerando nombres personalizados
// que el negocio configure en `publicPaymentMethods`.
const VES_METHOD_KEYWORDS = [
  "pago movil",
  "movil",
  "punto",
  "biopago",
  "efectivo bs",
  "bolivar",
  "bolivares",
  "transferencia",
]

// Indicadores de divisa: si aparecen, mandan (p. ej. "Transferencia
// internacional" es en $, aunque contenga "transferencia").
const USD_METHOD_KEYWORDS = [
  "internacional",
  "divisa",
  "dolar",
  "zelle",
  "binance",
  "usdt",
  "paypal",
  "wire",
  "usd",
]

function normalizePaymentMethodText(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

// True si el método de pago es en bolívares. Los indicadores de divisa mandan
// (una "transferencia internacional" es en $). Por defecto (no coincide con
// ninguna palabra clave) se asume divisas ($), el comportamiento previo.
export function isVesPaymentMethod(name: unknown): boolean {
  const normalized = normalizePaymentMethodText(name)
  if (!normalized) return false
  if (USD_METHOD_KEYWORDS.some((keyword) => normalized.includes(keyword))) return false
  // "efectivo bs" / "… bs" pero sin confundir con "efectivo divisas".
  if (/\bbs\b/.test(normalized)) return true
  return VES_METHOD_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

// Métodos ELECTRÓNICOS (dejan captura/referencia verificable): pago móvil,
// transferencias, Zelle, Binance, Zinli, PayPal, biopago… Lo usan el gating
// "comprobante antes de registrar" del checkout y la anulación automática
// por falta de pago (que NUNCA debe tocar pedidos en efectivo: el cliente
// paga al retirar/recibir y no tiene nada que reportar). Un método "Mixto:"
// cuenta como electrónico si ALGUNA de sus partes lo es.
const ELECTRONIC_METHOD_KEYWORDS = [
  "pago movil",
  "pagomovil",
  "transferencia",
  "transf",
  "zelle",
  "binance",
  "zinli",
  "paypal",
  "biopago",
  "banco",
  "banesco",
  "mercantil",
  "provincial",
  "bdv",
  "usdt",
  "wire",
]

export function isElectronicPaymentMethod(name: unknown): boolean {
  const normalized = normalizePaymentMethodText(name)
  if (!normalized) return false
  return ELECTRONIC_METHOD_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

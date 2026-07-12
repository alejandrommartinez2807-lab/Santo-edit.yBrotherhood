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

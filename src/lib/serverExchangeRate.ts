// Tasa AUTORITATIVA del servidor para el pedido público (BH-SIM-002, 2ª parte).
//
// El cobro convierte los bolívares recibidos con la tasa GUARDADA EN EL PEDIDO
// (`ordersStorePayments.ts`). Si esa tasa la elige el navegador, un cliente
// puede pedir con tasa 4, reportar Bs 50 por una burger de $12,50 y que el
// sistema la dé por pagada. El primer blindaje solo cubría el modo MANUAL;
// Brotherhood usa tasa automática (dólar BCV, o EURO si el dueño lo activa en
// Configuración), así que el hueco seguía abierto en producción.
//
// Regla: en cualquier modo, la tasa la pone el servidor. Si su fuente falla se
// devuelve 0 — y quien llama conserva la del cliente antes que dejar al
// negocio sin poder cobrar en bolívares.

export type ExchangeMode = "automatic" | "automaticEur" | "manual"

type RateResponse = { rate: number; currency: "USD" | "EUR" }

function cleanRate(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return parsed
}

export async function resolveServerExchangeRate(input: {
  mode: ExchangeMode
  manualRate: unknown
  getUsd: () => Promise<RateResponse>
  getEur: () => Promise<RateResponse>
}): Promise<number> {
  const manual = cleanRate(input.manualRate)

  // Manual con una tasa válida: manda el negocio.
  if (input.mode === "manual" && manual > 0) return manual

  // Manual sin tasa válida cae al automático (mismo criterio que
  // /api/exchange-rate: mejor la del BCV que ninguna).
  const source = input.mode === "automaticEur" ? input.getEur : input.getUsd

  try {
    const response = await source()
    return cleanRate(response?.rate)
  } catch {
    // Fuente caída: 0 = "no tengo tasa propia". Quien llama decide.
    return 0
  }
}

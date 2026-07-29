// Lectura del modo de tasa que llega desde Configuración (BH-SIM-007).
//
// Regla única para los tres modos que ofrece la pantalla. Antes vivía inline
// en `POST /api/business-config` y solo conocía "manual" y "automatic", así
// que elegir "Tasa BCV (euro)" se guardaba como dólar sin decir nada. La
// config POR SEDE (`normalizeBranchScopedConfig`) sí lo hacía bien: ahora las
// dos siguen el mismo criterio.

export type ExchangeRateModeValue = "automatic" | "automaticEur" | "manual"

export function readExchangeRateModeValue(value: unknown): ExchangeRateModeValue {
  const normalized = String(value ?? "").trim().toLowerCase()

  if (normalized === "manual") return "manual"
  if (normalized === "automaticeur" || normalized === "euro") return "automaticEur"

  return "automatic"
}

export function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

// Símbolo de moneda del SITIO PÚBLICO: solo "$" o "€", elegible por el dueño
// en Configuración. Cambio SOLO estético: los cálculos no cambian (por dentro
// sigue siendo USD), los bolívares (formatVES) no se tocan, y el panel interno
// del staff siempre muestra "$". Guardado en un store simple con suscripción
// para que las pantallas del cliente se re-rendericen al cargar la config.
let publicCurrencySymbol = "$"
const currencySymbolListeners = new Set<() => void>()

export function setPublicCurrencySymbol(symbol: unknown) {
  const next = symbol === "€" ? "€" : "$"
  if (next === publicCurrencySymbol) return
  publicCurrencySymbol = next
  currencySymbolListeners.forEach((listener) => listener())
}

export function getPublicCurrencySymbol() {
  return publicCurrencySymbol
}

export function subscribePublicCurrencySymbol(listener: () => void) {
  currencySymbolListeners.add(listener)
  return () => {
    currencySymbolListeners.delete(listener)
  }
}

// Mismo formato que formatUSD pero con el símbolo público. Las pantallas del
// cliente la importan como `formatPublicUSD as formatUSD`.
export function formatPublicUSD(value: number) {
  return formatUSD(value).replace("$", publicCurrencySymbol)
}

export function formatVES(value: number) {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

"use client"

import { useSyncExternalStore } from "react"
import {
  getPublicCurrencySymbol,
  subscribePublicCurrencySymbol,
} from "@/utils/formatCurrency"

// Suscribe el componente al símbolo público ($/€). El snapshot de servidor es
// "$" para que SSR e hidratación coincidan; el sync de la config lo ajusta
// después y re-renderiza los precios. El valor de retorno suele ignorarse: la
// llamada existe para que el componente vuelva a pintar al cambiar el símbolo.
export function usePublicCurrencySymbol() {
  return useSyncExternalStore(
    subscribePublicCurrencySymbol,
    getPublicCurrencySymbol,
    () => "$",
  )
}

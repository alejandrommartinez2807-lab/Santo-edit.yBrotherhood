"use client"

import { useEffect, useEffectEvent, useState } from "react"

// Toggle de UI recordado por equipo vía localStorage (p. ej. los paneles de
// caja: mapa de mesas, QR, filtros, cuentas plegadas). El primer render usa
// el default para no romper la hidratación; el valor guardado se restaura en
// un tick posterior.
export function usePersistedToggle(key: string, initialValue: boolean) {
  const [value, setValue] = useState(initialValue)

  const restoreStoredValue = useEffectEvent(() => {
    try {
      const stored = window.localStorage.getItem(key)

      if (stored === "1" || stored === "0") {
        setValue(stored === "1")
      }
    } catch {
      // localStorage puede fallar (modo privado); se mantiene el default.
    }
  })

  useEffect(() => {
    // Difiere la restauración un tick para no hacer setState síncrono en el
    // efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(restoreStoredValue, 0)
    return () => clearTimeout(timer)
  }, [key])

  function setAndPersist(next: boolean | ((current: boolean) => boolean)) {
    setValue((current) => {
      const resolved = typeof next === "function" ? next(current) : next

      try {
        window.localStorage.setItem(key, resolved ? "1" : "0")
      } catch {
        // Sin almacenamiento disponible el toggle sigue funcionando en memoria.
      }

      return resolved
    })
  }

  return [value, setAndPersist] as const
}

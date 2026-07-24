"use client"

import { useEffect } from "react"

// Registra el service worker (PWA + caché de estáticos). Silencioso si falla.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return

    // En desarrollo los chunks de Next no llevan hash en el nombre, así que la
    // caché cache-first del SW serviría código viejo tras cada edición. Solo
    // registramos en producción; en dev además limpiamos registros previos.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch(() => {})
      return
    }

    // Auto-actualización: cuando un SW NUEVO toma el control (tras publicar una
    // versión), recargamos UNA vez para que el dispositivo cargue los assets
    // nuevos. Sin esto, los teléfonos con la PWA instalada seguían viendo la
    // versión vieja y "las features nuevas no aparecían". La guarda evita bucles
    // y el reload solo ocurre si ya había un SW controlando (no en la primera
    // instalación).
    let refreshing = false
    const hadController = Boolean(navigator.serviceWorker.controller)
    const reloadNow = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing || !hadController) return
      // NO recargar en plena cara del cliente si está pagando o escribiendo
      // (la pantalla "hacía un extraño" justo tras registrar el pedido —
      // dueño 2026-07-23): si la confirmación/reporte está a la vista o hay
      // un campo enfocado, la recarga espera a que suelte la pestaña.
      const activeTag = document.activeElement?.tagName || ""
      const isBusy =
        Boolean(document.getElementById("reporte-pago-seccion")) ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)
      if (!isBusy) return reloadNow()

      const onHide = () => {
        if (document.visibilityState !== "hidden") return
        document.removeEventListener("visibilitychange", onHide)
        reloadNow()
      }
      document.addEventListener("visibilitychange", onHide)
    })

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Busca actualizaciones al cargar (además del chequeo del navegador):
          // si hay un SW en espera, lo activa para que tome control y dispare
          // la recarga de arriba.
          registration.update?.().catch(() => {})
          registration.addEventListener?.("updatefound", () => {
            const installing = registration.installing
            if (!installing) return
            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // Hay una versión nueva instalada y ya había un SW controlando:
                // el nuevo SW (con skipWaiting) tomará control y recargaremos.
                registration.waiting?.postMessage?.({ type: "SKIP_WAITING" })
              }
            })
          })
        })
        .catch(() => {
          /* sin SW: la app sigue funcionando normal */
        })
    }
    if (document.readyState === "complete") onLoad()
    else window.addEventListener("load", onLoad, { once: true })
  }, [])

  return null
}

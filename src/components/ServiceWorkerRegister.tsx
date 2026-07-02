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

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sin SW: la app sigue funcionando normal */
      })
    }
    if (document.readyState === "complete") onLoad()
    else window.addEventListener("load", onLoad, { once: true })
  }, [])

  return null
}

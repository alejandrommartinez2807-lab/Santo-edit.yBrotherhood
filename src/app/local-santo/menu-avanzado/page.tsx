"use client"

// Menú avanzado FUSIONADO con el editor de menú (lote v6 fase B): esta página
// ya no es un editor aparte, solo redirige a /local-santo/menu conservando el
// deep-link ?producto=<id> (que abre ese producto con su sección "Opciones
// avanzadas" desplegada). La lógica sigue viviendo en ./domain, ./components y
// ./burgerTemplate, ahora consumida por menu/AdvancedOptionsSection.

import { useEffect } from "react"
import { Loader2 } from "lucide-react"

export default function AdvancedMenuRedirectPage() {
  useEffect(() => {
    let producto = ""
    try {
      producto = new URLSearchParams(window.location.search).get("producto") || ""
    } catch {
      producto = ""
    }

    window.location.replace(
      `/local-santo/menu${producto ? `?producto=${encodeURIComponent(producto)}` : ""}`,
    )
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 text-[var(--brand-ink-3)]">
      <p className="inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-ink-2)]/70">
        <Loader2 size={17} className="animate-spin text-[var(--brand-primary)]" />
        El menú avanzado ahora vive dentro del editor de menú. Redirigiendo…
      </p>
    </main>
  )
}

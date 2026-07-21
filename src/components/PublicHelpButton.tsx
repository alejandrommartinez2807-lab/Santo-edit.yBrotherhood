"use client"

import { useEffect, useState } from "react"
import { LifeBuoy } from "lucide-react"
import { BRAND } from "@/lib/brand"

// Botón de ayuda flotante del menú público (pedido del dueño 2026-07-21):
// abre WhatsApp con un mensaje ya armado para pedir ayuda con la página o el
// pedido. Va abajo a la izquierda para no chocar con "volver arriba".

export default function PublicHelpButton() {
  const [whatsapp, setWhatsapp] = useState("")
  const [businessName, setBusinessName] = useState("")

  useEffect(() => {
    let cancelled = false

    fetch("/api/public/business-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        const config = data?.businessConfig || data?.config || {}
        const phone = String(
          config.mainWhatsapp || config.deliveryWhatsapp || BRAND.whatsapp || "",
        ).replace(/[^0-9]/g, "")
        setWhatsapp(phone)
        setBusinessName(String(config.businessName || "").trim())
      })
      .catch(() => {
        if (!cancelled) {
          setWhatsapp(String(BRAND.whatsapp || "").replace(/[^0-9]/g, ""))
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!whatsapp) return null

  const helpHref = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    `Hola ${businessName || BRAND.name}! Necesito ayuda con la página / mi pedido.`,
  )}`

  return (
    <a
      href={helpHref}
      target="_blank"
      rel="noreferrer"
      aria-label="Pedir ayuda por WhatsApp"
      className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-[var(--brand-border)] bg-black/80 px-4 py-3 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink)] shadow-lg shadow-black/40 backdrop-blur transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95"
    >
      <LifeBuoy size={16} className="text-[var(--brand-primary)]" />
      Ayuda
    </a>
  )
}

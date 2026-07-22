"use client"

import { useEffect, useState } from "react"
import {
  Bike,
  ClipboardList,
  CreditCard,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Search,
  ShoppingCart,
  Star,
  X,
} from "lucide-react"
import { BRAND } from "@/lib/brand"

// Botón de ayuda flotante del menú público (pedido del dueño 2026-07-21):
// abre una ventana con la GUÍA COMPLETA de cómo pedir y cómo funciona cada
// sección, con el botón "Escríbenos" arriba para preguntar por WhatsApp.

const HELP_SECTIONS = [
  {
    icon: ShoppingCart,
    title: "Cómo hacer tu pedido",
    lines: [
      "Toca «Descubre el menú» y agrega lo que quieras con el botón amarillo de cada producto.",
      "Si el producto tiene opciones (proteína, extras…), elígelas tocando «Elige tus ingredientes».",
      "Abre el carrito (arriba a la derecha) y toca «Hacer pedido»: solo escribes tu nombre y tu teléfono, lo demás son botones.",
    ],
  },
  {
    icon: Bike,
    title: "Delivery, pick up o mesa",
    lines: [
      "Delivery: toca «Usar mi ubicación actual» y el sistema calcula el costo del envío solo; confirma el punto en el mapa.",
      "Para llevar (pick up): pides, cancelas (pagas) y te avisamos cuando esté listo para retirar.",
      "En el local: elige tu mesa con los botones y el personal te atiende ahí.",
    ],
  },
  {
    icon: CreditCard,
    title: "Cómo pagar",
    lines: [
      "Elige el método con botones: pago móvil, efectivo, transferencia o mixto (parte en Bs y parte en divisas).",
      "Con pago móvil o transferencia: cancela con los datos que te muestra la página y toca «Reportar mi pago» adjuntando la captura o la referencia completa.",
      "Con efectivo: dinos con cuánto vas a pagar (botones de billete) y tendremos tu vuelto listo.",
      "Tu pedido entra a preparación cuando caja confirma tu abono.",
    ],
  },
  {
    icon: ClipboardList,
    title: "Seguir tu pedido",
    lines: [
      "Al registrar tu pedido recibes un número grande y un link de seguimiento: guárdalo.",
      "Ahí ves tu pedido avanzar en vivo (recibido → preparando → listo) y puedes reportar tu pago si te faltó.",
      "También puedes cancelarlo tú mismo mientras no haya entrado a cocina.",
    ],
  },
  {
    icon: Search,
    title: "Buscar y filtrar",
    lines: [
      "Usa el buscador del menú o los botones de categorías (Promos, Antojos, Hamburguesas, Menú Kids, Bebidas).",
      "Toca la foto o el nombre de un producto para ver su ficha completa con la descripción.",
      "Guarda tus favoritos con el corazón y repite tu último pedido desde el carrito.",
    ],
  },
  {
    icon: MapPin,
    title: "Sedes y ubicación",
    lines: [
      "En «Nuestros locales» ves el mapa de cada sede con el botón «Cómo llegar».",
      "La sede a la que pides se elige dentro del carrito al hacer el pedido.",
    ],
  },
  {
    icon: Star,
    title: "Reseñas",
    lines: [
      "Cuando tu pedido llegue, te invitamos a dejar tu reseña: nos ayuda muchísimo.",
    ],
  },
]

export default function PublicHelpButton() {
  const [whatsapp, setWhatsapp] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [isOpen, setIsOpen] = useState(false)

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

  const helpHref = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(
        `Hola ${businessName || BRAND.name}! No entendí algo de la página, ¿me ayudan?`,
      )}`
    : ""

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir la guía de ayuda"
        className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-[var(--brand-border)] bg-black/80 px-4 py-3 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink)] shadow-lg shadow-black/40 backdrop-blur transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95"
      >
        <LifeBuoy size={16} className="text-[var(--brand-primary)]" />
        Ayuda
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 px-3 py-4 backdrop-blur-sm sm:items-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.8rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Encabezado: título + Escríbenos (arriba, como pidió el dueño). */}
            <div className="border-b border-[var(--brand-border)] bg-black/40 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">
                    Guía rápida
                  </p>
                  <h3 className="font-display mt-1 text-2xl uppercase leading-none text-[var(--brand-ink-3)]">
                    ¿Cómo se pide aquí?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Cerrar la ayuda"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                >
                  <X size={20} />
                </button>
              </div>

              {helpHref ? (
                <a
                  href={helpHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-black transition hover:bg-[var(--brand-accent)] active:scale-[0.98]"
                >
                  <MessageCircle size={16} />
                  ¿No entendiste algo? Escríbenos
                </a>
              ) : null}
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              {HELP_SECTIONS.map((section) => (
                <div
                  key={section.title}
                  className="rounded-2xl border border-[var(--brand-border)] bg-black/30 p-4"
                >
                  <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                    <section.icon size={16} />
                    {section.title}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {section.lines.map((line) => (
                      <li
                        key={line}
                        className="flex items-start gap-2 text-[0.85rem] font-medium leading-5 text-[var(--brand-ink-2)]"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

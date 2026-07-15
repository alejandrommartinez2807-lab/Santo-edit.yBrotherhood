"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

export type LightboxPhoto = { url: string; caption: string }

// Visor de fotos a pantalla completa compartido por la landing y el motor de
// reservas. Flechas y Escape funcionan con teclado; en móvil, con los botones.
export default function PhotoLightbox({
  photos,
  initialIndex = 0,
  onClose,
}: {
  photos: LightboxPhoto[]
  initialIndex?: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0)),
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % photos.length)
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + photos.length) % photos.length)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [photos.length, onClose])

  if (photos.length === 0) return null
  const photo = photos[index]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Galería de fotos"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 rounded-full border border-white/30 p-2 text-white transition-colors hover:border-white"
      >
        <X size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || "Foto del hotel"}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[78vh] max-w-full rounded-xl object-contain shadow-2xl"
      />
      <div className="mt-4 flex items-center gap-5 text-white" onClick={(e) => e.stopPropagation()}>
        {photos.length > 1 && (
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
            className="rounded-full border border-white/30 p-2.5 transition-colors hover:border-[#e6cf9a] hover:text-[#e6cf9a]"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <span className="min-w-40 text-center text-sm text-white/85">
          {photo.caption || `Foto ${index + 1}`}
          <span className="ml-2 text-white/50">
            {index + 1} / {photos.length}
          </span>
        </span>
        {photos.length > 1 && (
          <button
            type="button"
            aria-label="Foto siguiente"
            onClick={() => setIndex((i) => (i + 1) % photos.length)}
            className="rounded-full border border-white/30 p-2.5 transition-colors hover:border-[#e6cf9a] hover:text-[#e6cf9a]"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

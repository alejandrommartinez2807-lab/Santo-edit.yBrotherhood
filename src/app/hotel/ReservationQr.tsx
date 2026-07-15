"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"

// QR del código de reserva para escanear en recepción (mismo generador que los
// QR de mesas) + botón para bajarlo como imagen y no perder el código.
function buildQrImageUrl(data: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&ecc=H&data=${encodeURIComponent(data)}`
}

export default function ReservationQr({ code }: { code: string }) {
  const [downloading, setDownloading] = useState(false)

  async function download() {
    setDownloading(true)
    try {
      // Descarga real (blob → <a download>); el QR queda en la galería/descargas.
      const res = await fetch(buildQrImageUrl(code, 440))
      if (!res.ok) throw new Error("QR no disponible")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement("a")
      a.href = url
      a.download = `reserva-${code}.png`
      window.document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      // Si el generador no permite la descarga directa, al menos abrir la
      // imagen en una pestaña para guardarla manualmente.
      window.open(buildQrImageUrl(code, 440), "_blank", "noopener")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-3 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={buildQrImageUrl(code)}
        alt={`QR de la reserva ${code}`}
        width={180}
        height={180}
        className="mx-auto h-44 w-44"
      />
      <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]">Muestra este QR en recepción</p>
      <button
        type="button"
        onClick={download}
        disabled={downloading}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-[var(--brand-primary)] bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-[var(--brand-primary-dark)] disabled:opacity-50"
      >
        {downloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
        Descargar QR
      </button>
    </div>
  )
}

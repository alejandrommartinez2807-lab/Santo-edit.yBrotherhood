"use client"

import { useEffect, useState } from "react"

// Póster tamaño carta para imprimir y pegar en la entrada: QR grande que abre
// /estacionamiento?new=1 (el visitante genera su propio ticket al llegar).
export default function PosterQr({ brandName, logo }: { brandName: string; logo: string }) {
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    // Diferido un tick para no hacer setState síncrono dentro del efecto
    // (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => setOrigin(window.location.origin), 0)
    return () => clearTimeout(timer)
  }, [])

  const link = `${origin}/estacionamiento?new=1`
  const qr = origin
    ? `https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=16&ecc=H&data=${encodeURIComponent(link)}`
    : ""

  return (
    <div style={{ minHeight: "100vh", background: "#eef4f8", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif", color: "#163243", padding: 20 }}>
      <style>{`@media print { .no-print { display: none !important } body { background: #fff } .poster { box-shadow: none !important; margin: 0 auto !important } }`}</style>

      <div className="no-print" style={{ maxWidth: 720, margin: "0 auto 14px", display: "flex", gap: 10, alignItems: "center" }}>
        <a href="/panel" style={{ color: "#0a6f9c", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>← Volver al panel</a>
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ border: 0, background: "#0f9bd7", color: "#fff", borderRadius: 12, padding: "11px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          🖨️ Imprimir póster
        </button>
      </div>

      <div className="poster" style={{ maxWidth: 720, margin: "0 auto", background: "#fff", borderRadius: 24, padding: "42px 40px", boxShadow: "0 20px 60px rgba(12,36,50,.15)", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={52} height={52} style={{ borderRadius: 12 }} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{brandName}</div>
            <div style={{ fontSize: 14, color: "#5b6b82" }}>Estacionamiento</div>
          </div>
        </div>

        <h1 style={{ fontSize: 34, fontWeight: 800, margin: "26px 0 6px", lineHeight: 1.15 }}>🅿️ Genera tu ticket aquí</h1>
        <p style={{ fontSize: 17, color: "#3f5a6b", margin: "0 0 24px" }}>Escanea el código con la cámara de tu teléfono</p>

        <div style={{ display: "inline-block", padding: 18, borderRadius: 24, border: "4px solid #0f9bd7", background: "#fff" }}>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR para generar ticket de estacionamiento en ${link}`} width={340} height={340} style={{ display: "block", width: 340, height: 340 }} />
          ) : (
            <div style={{ width: 340, height: 340, display: "grid", placeItems: "center", color: "#8494a8" }}>Generando QR…</div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 30, textAlign: "center" }}>
          <Step n="1" icon="📷" text="Escanea al entrar y genera tu ticket" />
          <Step n="2" icon="🎟️" text="Guarda el código o toma captura" />
          <Step n="3" icon="💳" text="Antes de salir, paga desde tu teléfono" />
        </div>

        <p style={{ fontSize: 13, color: "#8494a8", marginTop: 26 }}>
          ¿Ya tienes un ticket? Entra a <b>{origin ? origin.replace(/^https?:\/\//, "") : ""}/estacionamiento</b> y consúltalo con tu código.
        </p>
      </div>
    </div>
  )
}

function Step({ n, icon, text }: { n: string; icon: string; text: string }) {
  return (
    <div style={{ background: "#f6fbfe", borderRadius: 16, padding: "16px 12px", border: "1px solid #eaf3f8" }}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div style={{ fontWeight: 800, color: "#0a6f9c", fontSize: 13, margin: "6px 0 2px" }}>Paso {n}</div>
      <div style={{ fontSize: 13, color: "#3f5a6b", lineHeight: 1.4 }}>{text}</div>
    </div>
  )
}

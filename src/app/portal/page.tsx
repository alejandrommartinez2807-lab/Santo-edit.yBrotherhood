import type { Metadata } from "next"
import { BRAND } from "@/lib/brand"

export const metadata: Metadata = {
  title: "Apartamentos Palulu · Portal de residentes",
  description:
    "Portal de residentes de Apartamentos Palulu: paga tu condominio, reserva áreas comunes, reporta incidencias y mantente al día con los comunicados.",
}

const FEATURES = [
  { icon: "💳", title: "Tu estado de cuenta", text: "Consulta tu recibo del mes, tu saldo y paga o reporta tu pago en segundos." },
  { icon: "🏊", title: "Reserva áreas comunes", text: "Salón de fiestas, parrillera, cancha: mira la disponibilidad y reserva sin pisar a nadie." },
  { icon: "🛠️", title: "Reporta una incidencia", text: "Una fuga, una luz dañada, ruido: repórtalo con foto y sigue el avance hasta que se resuelva." },
  { icon: "📣", title: "Comunicados", text: "Entérate de asambleas, mantenimientos y avisos importantes, sin depender del grupo de WhatsApp." },
  { icon: "🚪", title: "Autoriza tus visitas", text: "Pre-autoriza visitas y proveedores con un código para que entren sin llamarte a cada rato." },
  { icon: "🗳️", title: "Vota en asambleas", text: "Participa en las decisiones del condominio con voto ponderado por tu alícuota." },
]

export default function PortalPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f4f7fb", color: "#0a1a30", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      {/* Top nav */}
      <header style={{ maxWidth: 1120, margin: "0 auto", padding: "18px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/palulu-mark.svg" alt="" width={40} height={40} />
        <strong style={{ fontSize: 18 }}>Apartamentos Palulu</strong>
        <nav style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <a href="/panel" style={{ textDecoration: "none", color: "#16324f", fontWeight: 600, padding: "8px 14px", borderRadius: 10, fontSize: 14 }}>Administración</a>
          <a href="#acceso" style={{ textDecoration: "none", background: "#1f6feb", color: "#fff", fontWeight: 700, padding: "8px 16px", borderRadius: 10, fontSize: 14 }}>Entrar</a>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 40px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 32, alignItems: "center" }}>
        <div>
          <span style={{ display: "inline-block", background: "#e7effd", color: "#1554b8", fontWeight: 700, fontSize: 13, padding: "6px 12px", borderRadius: 999 }}>{BRAND.tagline}</span>
          <h1 style={{ fontSize: 40, lineHeight: 1.1, fontWeight: 800, margin: "16px 0 12px" }}>
            Tu condominio, <span style={{ color: "#1f6feb" }}>claro y al día</span>.
          </h1>
          <p style={{ fontSize: 17, color: "#4a5b73", lineHeight: 1.6, maxWidth: 480 }}>
            Un solo lugar para pagar, reservar, reportar y enterarte de todo lo de {BRAND.name}. Transparencia real,
            cuentas que cuadran y comunicación directa con la administración.
          </p>
          <div id="acceso" style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <a href="#acceso" style={{ textDecoration: "none", background: "#1f6feb", color: "#fff", fontWeight: 700, padding: "13px 22px", borderRadius: 12, fontSize: 15 }}>Acceder como residente</a>
            <a href="/panel" style={{ textDecoration: "none", background: "#fff", color: "#16324f", fontWeight: 700, padding: "13px 22px", borderRadius: 12, fontSize: 15, border: "1px solid #d5deeb" }}>Soy de la administración</a>
          </div>
          <p style={{ fontSize: 13, color: "#8494a8", marginTop: 12 }}>El acceso de residentes por código llega en la próxima fase.</p>
        </div>
        <Hero />
      </section>

      {/* Features */}
      <section style={{ background: "#fff", padding: "48px 0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>Todo lo del condominio, en tu teléfono</h2>
          <p style={{ textAlign: "center", color: "#5b6b82", margin: "0 0 32px" }}>Pensado desde las quejas de siempre, para que no se repitan.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: "#f7f9fc", borderRadius: 16, padding: 22, border: "1px solid #eef1f6" }}>
                <div style={{ fontSize: 30 }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: "10px 0 6px" }}>{f.title}</h3>
                <p style={{ color: "#5b6b82", fontSize: 14, lineHeight: 1.55, margin: 0 }}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px", color: "#8494a8", fontSize: 13, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/palulu-mark.svg" alt="" width={24} height={24} />
        <span>© {new Date().getFullYear()} {BRAND.name}</span>
        <span style={{ marginLeft: "auto" }}>{BRAND.location}</span>
      </footer>
    </div>
  )
}

// Ilustración de portada (SVG propio, sin dependencias externas).
function Hero() {
  return (
    <svg viewBox="0 0 460 360" width="100%" role="img" aria-label="Ilustración de edificios" style={{ display: "block", filter: "drop-shadow(0 20px 40px rgba(21,84,184,.18))" }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dbeafe" />
          <stop offset="1" stopColor="#f4f7fb" />
        </linearGradient>
        <linearGradient id="b1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f80ed" />
          <stop offset="1" stopColor="#1554b8" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="460" height="360" rx="24" fill="url(#sky)" />
      <circle cx="360" cy="80" r="34" fill="#ffd23c" opacity="0.85" />
      {/* edificio grande */}
      <rect x="70" y="90" width="120" height="230" rx="8" fill="url(#b1)" />
      {/* edificio mediano */}
      <rect x="205" y="140" width="95" height="180" rx="8" fill="#3b82f6" />
      {/* edificio bajo */}
      <rect x="315" y="180" width="80" height="140" rx="8" fill="#60a5fa" />
      {/* ventanas edificio grande */}
      <g fill="#ffffff" opacity="0.9">
        {[0, 1, 2, 3, 4].map((r) => [0, 1, 2].map((c) => (
          <rect key={`a${r}-${c}`} x={86 + c * 34} y={110 + r * 40} width="18" height="24" rx="3" />
        )))}
      </g>
      <g fill="#dbeafe">
        {[0, 1, 2, 3].map((r) => [0, 1].map((c) => (
          <rect key={`b${r}-${c}`} x={222 + c * 40} y={160 + r * 38} width="18" height="22" rx="3" />
        )))}
      </g>
      <g fill="#eff6ff">
        {[0, 1, 2].map((r) => [0, 1].map((c) => (
          <rect key={`c${r}-${c}`} x={330 + c * 30} y={200 + r * 38} width="16" height="20" rx="3" />
        )))}
      </g>
      {/* suelo / jardín */}
      <rect x="30" y="315" width="400" height="14" rx="7" fill="#1e874b" opacity="0.85" />
      {/* arbolitos */}
      <circle cx="45" cy="308" r="14" fill="#1e874b" />
      <circle cx="415" cy="308" r="14" fill="#1e874b" />
    </svg>
  )
}

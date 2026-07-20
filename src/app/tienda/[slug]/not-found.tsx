import { BRAND } from "@/lib/brand"

// 404 con marca para /tienda/<slug> cuando el local no existe o su micrositio no
// está publicado (p. ej. un link viejo compartido por WhatsApp).
export default function TiendaNotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg,#0a6f9c,#0f9bd7)",
        color: "#fff",
        fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
        display: "grid",
        placeItems: "center",
        padding: 20,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 440 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/concepto-logo.png" alt="" width={56} height={56} style={{ borderRadius: 14, marginBottom: 16 }} />
        <div style={{ fontSize: 64, lineHeight: 1 }}>🏬</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "14px 0 8px" }}>Esta tienda no está disponible</h1>
        <p style={{ opacity: 0.9, margin: "0 0 22px", lineHeight: 1.6 }}>
          El local que buscas no existe o aún no publicó su página. Explora el directorio completo del {BRAND.name}.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/portal#directorio" style={btn("#fff", "#0a6f9c")}>Ver el directorio</a>
          <a href="/portal" style={btn("rgba(255,255,255,.15)", "#fff")}>Ir al inicio</a>
        </div>
      </div>
    </div>
  )
}

function btn(bg: string, color: string): React.CSSProperties {
  return { textDecoration: "none", background: bg, color, fontWeight: 700, padding: "13px 22px", borderRadius: 12, fontSize: 15 }
}

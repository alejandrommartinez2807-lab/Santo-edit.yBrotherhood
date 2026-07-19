import type { Metadata } from "next"
import { BRAND } from "@/lib/brand"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import PortalGallery from "./PortalGallery"

type GalleryItem = { id: string; url: string; caption: string }
type Store = { id: string; code: string; commercial_name: string; activity: string; floor: string; logo_url: string }

// Directorio de ejemplo (locales reales conocidos del C.C. Concepto La Granja)
// mientras el cliente no cargue los suyos desde el panel → Locales. Se reemplaza
// en cuanto agrega el primer local con "nombre comercial".
const DEFAULT_STORES: Store[] = [
  { id: "s1", code: "Supermercado", commercial_name: "Supermercados Kalea", activity: "supermercado", floor: "PB", logo_url: "" },
  { id: "s2", code: "Ancla", commercial_name: "Beco", activity: "moda", floor: "PB", logo_url: "" },
  { id: "s3", code: "Cine", commercial_name: "SuperCines", activity: "entretenimiento", floor: "Mezz.", logo_url: "" },
  { id: "s4", code: "Feria", commercial_name: "Capitán Grill Burger", activity: "comida", floor: "Feria", logo_url: "" },
  { id: "s5", code: "Feria", commercial_name: "María Paleta", activity: "comida", floor: "Feria", logo_url: "" },
  { id: "s6", code: "Belleza", commercial_name: "Fígaro Barbiere", activity: "belleza", floor: "PB", logo_url: "" },
  { id: "s7", code: "Salud", commercial_name: "Farmacia", activity: "salud", floor: "PB", logo_url: "" },
  { id: "s8", code: "Salud", commercial_name: "Consultorios médicos", activity: "consultorio", floor: "Torre médica", logo_url: "" },
]

const RUBRO: Record<string, { label: string; icon: string; color: string }> = {
  comida: { label: "Gastronomía", icon: "🍔", color: "#e5007e" },
  moda: { label: "Moda", icon: "👗", color: "#0f9bd7" },
  salud: { label: "Salud", icon: "➕", color: "#1e874b" },
  belleza: { label: "Belleza", icon: "💈", color: "#b26fd0" },
  electronica: { label: "Electrónica", icon: "📱", color: "#3f5a6b" },
  hogar: { label: "Hogar", icon: "🛋️", color: "#f9a800" },
  servicios: { label: "Servicios", icon: "🔧", color: "#3f5a6b" },
  banco: { label: "Banca", icon: "🏦", color: "#0a6f9c" },
  consultorio: { label: "Consultorios", icon: "🩺", color: "#1e874b" },
  oficina: { label: "Oficinas", icon: "🏢", color: "#3f5a6b" },
  kiosco: { label: "Kioscos", icon: "🛍️", color: "#f9a800" },
  entretenimiento: { label: "Entretenimiento", icon: "🎬", color: "#e5007e" },
  supermercado: { label: "Supermercado", icon: "🛒", color: "#f9a800" },
  otro: { label: "Otros", icon: "🏬", color: "#0f9bd7" },
}
function rubroOf(a: string) {
  return RUBRO[a] || RUBRO.otro
}

export const metadata: Metadata = {
  title: `${BRAND.name} · Centro comercial en Naguanagua`,
  description:
    "Directorio de tiendas, restaurantes, servicios y consultorios del C.C. Concepto La Granja. Estacionamiento, feria de comida y todo en un solo lugar.",
}

export const dynamic = "force-dynamic"

async function loadData(): Promise<{ stores: Store[]; availableCount: number; mallName: string; gallery: GalleryItem[] }> {
  try {
    const supabase = getSupabaseAdmin()
    const [storesRes, availRes, cfg] = await Promise.all([
      supabase.from("units").select("id, code, commercial_name, activity, floor, logo_url").neq("commercial_name", "").order("commercial_name").limit(120),
      supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "disponible"),
      supabase.from("business_config").select("config").eq("id", 1).maybeSingle(),
    ])
    const config = (cfg.data?.config as Record<string, unknown> | undefined) || {}
    const brandName = (config.brand as Record<string, unknown> | undefined)?.name
    const gallery = Array.isArray(config.gallery) ? (config.gallery as GalleryItem[]) : []
    return {
      stores: (storesRes.data as Store[]) ?? [],
      availableCount: availRes.count ?? 0,
      mallName: (typeof brandName === "string" && brandName) || BRAND.name,
      gallery,
    }
  } catch {
    return { stores: [], availableCount: 0, mallName: BRAND.name, gallery: [] }
  }
}

export default async function PortalPage() {
  const data = await loadData()
  const stores = data.stores.length ? data.stores : DEFAULT_STORES
  const mallName = data.mallName
  const galleryItems = data.gallery
  const wa = (msg: string) => `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(msg)}`
  // Conteos por rubro para los chips
  const rubros = Array.from(new Set(stores.map((s) => s.activity || "otro")))
  const foodCount = stores.filter((s) => s.activity === "comida").length

  return (
    <div style={{ background: "var(--brand-cream, #f6fbfe)", color: "#163243", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" }}>
      {/* NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(246,251,254,.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid #dcecf5" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/concepto-logo.png" alt="" width={38} height={38} style={{ borderRadius: 10 }} />
          <strong style={{ fontSize: 17 }}>{mallName}</strong>
          <nav style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            <a href="#directorio" style={navLink}>Tiendas</a>
            <a href="/mapa" style={navLink}>Mapa</a>
            <a href="#servicios" style={navLink}>Servicios</a>
            <a href="/consultorios" style={navLink}>Consultorios</a>
            <a href="/estacionamiento" style={navLink}>Estacionamiento</a>
            <a href="#alquiler" style={navLink}>Alquila tu local</a>
            <a href="/mi-cuenta" style={{ ...navLink, fontWeight: 700, color: "#0a6f9c" }}>Soy comerciante</a>
            <a href={wa(`Hola, quiero información del ${mallName}.`)} target="_blank" rel="noopener" style={{ ...ctaBtn, padding: "8px 16px" }}>Contactar</a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 20px 26px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 32, alignItems: "center" }}>
        <div>
          <span style={pill}>Naguanagua · Carabobo</span>
          <h1 style={{ fontSize: 46, lineHeight: 1.06, fontWeight: 800, margin: "16px 0 14px" }}>
            Tus tiendas favoritas en <span style={{ color: "#0f9bd7" }}>un solo lugar</span>
          </h1>
          <p style={{ fontSize: 17, color: "#3f5a6b", lineHeight: 1.6, maxWidth: 500 }}>
            {mallName}: moda, gastronomía, salud, consultorios, banca y entretenimiento, con estacionamiento amplio y
            planta eléctrica propia. {BRAND.location}.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <a href="#directorio" style={ctaBtn}>Ver directorio</a>
            <a href="#servicios" style={ctaGhost}>Servicios y horarios</a>
          </div>
          <div style={{ display: "flex", gap: 26, marginTop: 26, flexWrap: "wrap" }}>
            <Metric big={String(stores.length)} small="tiendas y locales" />
            <Metric big="500" small="puestos de estacionamiento" />
            <Metric big="100%" small="respaldo eléctrico" />
          </div>
        </div>
        <HeroArt />
      </section>

      {/* DIRECTORIO */}
      <section id="directorio" style={{ background: "#fff", padding: "48px 0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
          <h2 style={h2}>Directorio de tiendas</h2>
          <p style={sub}>Encuentra la tienda, el restaurante o el servicio que buscas.</p>
          {/* chips de rubro */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 26 }}>
            {rubros.map((r) => {
              const info = rubroOf(r)
              return <span key={r} style={{ display: "inline-flex", gap: 6, alignItems: "center", background: "#f2f9fd", border: "1px solid #dcecf5", borderRadius: 999, padding: "6px 12px", fontSize: 13, fontWeight: 600 }}>
                <span>{info.icon}</span>{info.label}
              </span>
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
            {stores.map((s) => {
              const info = rubroOf(s.activity)
              return (
                <div key={s.id} style={{ ...card, display: "flex", gap: 12, alignItems: "center" }}>
                  {s.logo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.logo_url} alt="" width={48} height={48} style={{ borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
                    : <div style={{ width: 48, height: 48, borderRadius: 12, background: info.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 22, flexShrink: 0 }}>{info.icon}</div>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.commercial_name}</div>
                    <div style={{ fontSize: 13, color: "#5b6b82" }}>{info.label}{s.floor ? ` · ${s.floor}` : ""}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
      <section id="servicios" style={{ padding: "48px 0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
          <h2 style={h2}>Servicios del centro comercial</h2>
          <p style={sub}>Todo lo que hace tu visita más cómoda.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
            {SERVICES.map((sv) => (
              <div key={sv.title} style={{ ...card }}>
                <div style={{ fontSize: 30 }}>{sv.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: "8px 0 4px" }}>{sv.title}</h3>
                <p style={{ color: "#5b6b82", fontSize: 14, margin: 0 }}>{sv.desc}</p>
              </div>
            ))}
          </div>
          {foodCount > 0 && (
            <p style={{ textAlign: "center", color: "#5b6b82", marginTop: 20, fontSize: 14 }}>🍔 {foodCount} opción(es) en la feria de comida.</p>
          )}
        </div>
      </section>

      {/* GALERÍA */}
      {galleryItems.length > 0 && <PortalGallery items={galleryItems} />}

      {/* ALQUILER DE LOCALES */}
      <section id="alquiler" style={{ background: "linear-gradient(120deg,#0a6f9c,#0f9bd7)", color: "#fff", padding: "44px 0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2 style={{ fontSize: 27, fontWeight: 800, margin: "0 0 6px" }}>¿Quieres un local en {mallName}?</h2>
            <p style={{ opacity: 0.9, margin: 0, maxWidth: 560 }}>
              {data.availableCount > 0
                ? `Tenemos ${data.availableCount} espacio(s) disponible(s). Escríbenos y te enviamos la información de alquiler.`
                : "Escríbenos para conocer disponibilidad de locales, kioscos y espacios publicitarios."}
            </p>
          </div>
          <a href={wa(`Hola, me interesa alquilar un local en ${mallName}.`)} target="_blank" rel="noopener" style={{ ...ctaBtn, background: "#fff", color: "#0a6f9c", padding: "14px 26px", fontSize: 16 }}>Consultar alquiler</a>
        </div>
      </section>

      {/* COMERCIANTES */}
      <section style={{ padding: "40px 0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>¿Tienes un local aquí?</h2>
            <p style={{ color: "#5b6b82", margin: 0, maxWidth: 560 }}>Entra a tu cuenta de comerciante para ver tu estado de cuenta, pagar canon y condominio, reportar tu pago, solicitar mantenimiento y ver los comunicados de la administración.</p>
          </div>
          <a href="/mi-cuenta" style={{ ...ctaBtn, padding: "14px 26px", fontSize: 16 }}>Entrar a mi cuenta</a>
        </div>
      </section>

      <footer style={{ maxWidth: 1120, margin: "0 auto", padding: "26px 20px", color: "#7c93a6", fontSize: 13, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid #e6eef5" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/concepto-logo.png" alt="" width={22} height={22} style={{ borderRadius: 6 }} />
        <span>© {new Date().getFullYear()} {mallName}</span>
        <span style={{ marginLeft: "auto" }}>{BRAND.location}</span>
        <a href="/contacto" style={{ color: "#7c93a6" }}>Atención al cliente</a>
        <a href="/panel" style={{ color: "#7c93a6" }}>Administración</a>
      </footer>
    </div>
  )
}

const SERVICES = [
  { icon: "🅿️", title: "Estacionamiento", desc: "500 puestos entre sótano y planta baja." },
  { icon: "⚡", title: "Planta eléctrica", desc: "Respaldo al 100% de los locales." },
  { icon: "🍽️", title: "Feria de comida", desc: "Variedad gastronómica para toda la familia." },
  { icon: "🏦", title: "Banca y cajeros", desc: "Servicios financieros dentro del centro." },
  { icon: "🩺", title: "Torre médica", desc: "Consultorios y especialidades de salud." },
  { icon: "🛡️", title: "Seguridad", desc: "Vigilancia y control de acceso." },
]

function Metric({ big, small }: { big: string; small: string }) {
  return <div><div style={{ fontSize: 26, fontWeight: 800, color: "#0c2432" }}>{big}</div><div style={{ fontSize: 12, color: "#7c93a6", maxWidth: 120 }}>{small}</div></div>
}

function HeroArt() {
  return (
    <svg viewBox="0 0 460 360" width="100%" role="img" aria-label={`Centro comercial ${BRAND.shortName}`} style={{ display: "block", filter: "drop-shadow(0 24px 44px rgba(15,155,215,.22))" }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d6f0fb" /><stop offset="1" stopColor="#f6fbfe" /></linearGradient>
        <linearGradient id="b1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#37b6e6" /><stop offset="1" stopColor="#0f9bd7" /></linearGradient>
      </defs>
      <rect width="460" height="360" rx="24" fill="url(#sky)" />
      <circle cx="372" cy="72" r="30" fill="#f9a800" opacity="0.9" />
      {/* edificio principal */}
      <rect x="60" y="120" width="200" height="200" rx="10" fill="url(#b1)" />
      <rect x="276" y="168" width="120" height="152" rx="10" fill="#e5007e" opacity="0.9" />
      {/* vitrinas */}
      <g fill="#fff" opacity="0.92">{[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => <rect key={`a${r}-${c}`} x={76 + c * 36} y={140 + r * 40} width="24" height="26" rx="4" />))}</g>
      <g fill="#ffe1f0">{[0, 1, 2, 3].map((r) => [0, 1].map((c) => <rect key={`b${r}-${c}`} x={292 + c * 46} y={188 + r * 32} width="26" height="22" rx="4" />))}</g>
      {/* toldo amarillo */}
      <rect x="52" y="112" width="216" height="14" rx="7" fill="#f9a800" />
      {/* piso */}
      <rect x="26" y="315" width="408" height="14" rx="7" fill="#0a6f9c" opacity="0.85" />
    </svg>
  )
}

const navLink: React.CSSProperties = { textDecoration: "none", color: "#163243", fontWeight: 600, padding: "8px 12px", borderRadius: 10, fontSize: 14 }
const ctaBtn: React.CSSProperties = { textDecoration: "none", background: "#0f9bd7", color: "#fff", fontWeight: 700, padding: "13px 22px", borderRadius: 12, fontSize: 15 }
const ctaGhost: React.CSSProperties = { textDecoration: "none", background: "#fff", color: "#163243", fontWeight: 700, padding: "13px 22px", borderRadius: 12, fontSize: 15, border: "1px solid #cfe6f2" }
const pill: React.CSSProperties = { display: "inline-block", background: "#e5f4fb", color: "#0a6f9c", fontWeight: 700, fontSize: 13, padding: "6px 12px", borderRadius: 999 }
const h2: React.CSSProperties = { fontSize: 27, fontWeight: 800, textAlign: "center", margin: "0 0 6px" }
const sub: React.CSSProperties = { textAlign: "center", color: "#5b6b82", margin: "0 0 28px" }
const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 6px 20px rgba(12,36,50,.06)", border: "1px solid #eaf3f8" }

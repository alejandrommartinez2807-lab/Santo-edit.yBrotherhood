import type { Metadata } from "next"
import { BRAND } from "@/lib/brand"
import { getSupabaseAdmin } from "@/lib/supabaseServer"

export const metadata: Metadata = {
  title: "Apartamentos Palulu · Vive aquí",
  description:
    "Apartamentos Palulu: apartamentos con áreas comunes, seguridad y una administración transparente. Conoce la disponibilidad y agenda tu visita.",
}

export const dynamic = "force-dynamic"

type Amenity = { id: string; name: string; description: string; photo_url: string }
type AvailUnit = { id: string; code: string; tower: string; floor: string; area_m2: number; parking_slots: number; unit_types?: { name?: string } | null }

async function loadData(): Promise<{ amenities: Amenity[]; available: AvailUnit[]; buildingName: string }> {
  try {
    const supabase = getSupabaseAdmin()
    const [amen, units, cfg] = await Promise.all([
      supabase.from("amenities").select("id, name, description, photo_url").eq("active", true).order("sort_order"),
      supabase.from("units").select("id, code, tower, floor, area_m2, parking_slots, unit_types(name)").eq("status", "desocupada").order("code").limit(9),
      supabase.from("business_config").select("config").eq("id", 1).maybeSingle(),
    ])
    const brandName = ((cfg.data?.config as Record<string, unknown> | undefined)?.brand as Record<string, unknown> | undefined)?.name
    return {
      amenities: (amen.data as Amenity[]) ?? [],
      available: (units.data as unknown as AvailUnit[]) ?? [],
      buildingName: (typeof brandName === "string" && brandName) || BRAND.name,
    }
  } catch {
    return { amenities: [], available: [], buildingName: BRAND.name }
  }
}

const AMENITY_ICON: Record<string, string> = { salón: "🎉", salon: "🎉", fiesta: "🎉", bbq: "🔥", parrillera: "🔥", parrilla: "🔥", cancha: "⚽", piscina: "🏊", gimnasio: "🏋️", coworking: "💻", parque: "🌳", juegos: "🎠" }
function iconFor(name: string) {
  const n = name.toLowerCase()
  for (const k of Object.keys(AMENITY_ICON)) if (n.includes(k)) return AMENITY_ICON[k]
  return "🏠"
}

export default async function PortalPage() {
  const { amenities, available, buildingName } = await loadData()
  const wa = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(`Hola, quiero información sobre apartamentos en ${buildingName}.`)}`

  return (
    <div style={{ background: "#f4f7fb", color: "#0a1a30", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" }}>
      {/* NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(244,247,251,.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid #e6ebf3" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/palulu-mark.svg" alt="" width={38} height={38} />
          <strong style={{ fontSize: 17 }}>{buildingName}</strong>
          <nav style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            <a href="#disponibilidad" style={navLink}>Disponibilidad</a>
            <a href="#amenidades" style={navLink}>Amenidades</a>
            <a href="/mi-cuenta" style={{ ...navLink, fontWeight: 700, color: "#1554b8" }}>Soy residente</a>
            <a href={wa} target="_blank" rel="noopener" style={{ ...ctaBtn, padding: "8px 16px" }}>Contactar</a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "36px 20px 24px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 32, alignItems: "center" }}>
        <div>
          <span style={pill}>Vive · Invierte · Disfruta</span>
          <h1 style={{ fontSize: 44, lineHeight: 1.08, fontWeight: 800, margin: "16px 0 14px" }}>
            Tu próximo hogar en <span style={{ color: "#1f6feb" }}>{buildingName}</span>
          </h1>
          <p style={{ fontSize: 17, color: "#4a5b73", lineHeight: 1.6, maxWidth: 500 }}>
            Apartamentos cómodos, áreas comunes de primera y una administración <b>transparente y digital</b>:
            paga, reserva y resuelve todo desde tu teléfono. {BRAND.location}.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <a href="#disponibilidad" style={ctaBtn}>Ver disponibilidad</a>
            <a href={wa} target="_blank" rel="noopener" style={ctaGhost}>Agendar visita por WhatsApp</a>
          </div>
          <div style={{ display: "flex", gap: 26, marginTop: 26 }}>
            <Metric big={String(available.length || "—")} small="disponibles" />
            <Metric big={String(amenities.length || "—")} small="amenidades" />
            <Metric big="24/7" small="seguridad" />
          </div>
        </div>
        <HeroArt />
      </section>

      {/* DISPONIBILIDAD */}
      <section id="disponibilidad" style={{ background: "#fff", padding: "48px 0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
          <h2 style={h2}>Apartamentos disponibles</h2>
          <p style={sub}>Consulta la disponibilidad actual del edificio.</p>
          {available.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "#5b6b82" }}>
              En este momento no hay unidades publicadas como disponibles.{" "}
              <a href={wa} target="_blank" rel="noopener" style={{ color: "#1554b8", fontWeight: 700 }}>Escríbenos</a> y te avisamos.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
              {available.map((u) => (
                <div key={u.id} style={{ ...card, padding: 0, overflow: "hidden" }}>
                  <UnitArt />
                  <div style={{ padding: 18 }}>
                    <div style={{ fontSize: 12, color: "#1554b8", fontWeight: 700 }}>{u.unit_types?.name || "Apartamento"}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, margin: "2px 0 6px" }}>{u.code}{u.tower ? ` · Torre ${u.tower}` : ""}</div>
                    <div style={{ fontSize: 14, color: "#5b6b82" }}>
                      {u.area_m2 ? `${u.area_m2} m²` : "—"} · Piso {u.floor || "—"} · {u.parking_slots || 0} puesto(s)
                    </div>
                    <a href={`${wa}`} target="_blank" rel="noopener" style={{ ...ctaBtn, display: "block", textAlign: "center", marginTop: 14, padding: "10px" }}>Consultar</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* AMENIDADES */}
      <section id="amenidades" style={{ padding: "48px 0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
          <h2 style={h2}>Áreas comunes</h2>
          <p style={sub}>Todo lo que hace la diferencia del día a día.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
            {(amenities.length ? amenities : DEFAULT_AMENITIES).map((a) => (
              <div key={a.id} style={{ ...card }}>
                <div style={{ fontSize: 30 }}>{iconFor(a.name)}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: "8px 0 4px" }}>{a.name}</h3>
                <p style={{ color: "#5b6b82", fontSize: 14, margin: 0 }}>{a.description || "Disponible para residentes."}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESIDENTES */}
      <section style={{ background: "linear-gradient(120deg,#0a1a30,#1554b8)", color: "#fff", padding: "40px 0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px" }}>¿Ya vives en {buildingName}?</h2>
            <p style={{ opacity: 0.85, margin: 0, maxWidth: 520 }}>Entra a tu cuenta para ver tu estado de cuenta, pagar, reservar áreas comunes, reportar incidencias y enterarte de los comunicados.</p>
          </div>
          <a href="/mi-cuenta" style={{ ...ctaBtn, background: "#fff", color: "#1554b8", padding: "14px 26px", fontSize: 16 }}>Entrar a mi cuenta</a>
        </div>
      </section>

      <footer style={{ maxWidth: 1120, margin: "0 auto", padding: "26px 20px", color: "#8494a8", fontSize: 13, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/palulu-mark.svg" alt="" width={22} height={22} />
        <span>© {new Date().getFullYear()} {buildingName}</span>
        <span style={{ marginLeft: "auto" }}>{BRAND.location}</span>
        <a href="/panel" style={{ color: "#8494a8" }}>Administración</a>
      </footer>
    </div>
  )
}

const DEFAULT_AMENITIES: Amenity[] = [
  { id: "d1", name: "Salón de fiestas", description: "Para tus celebraciones.", photo_url: "" },
  { id: "d2", name: "Parrillera / BBQ", description: "Fines de semana en familia.", photo_url: "" },
  { id: "d3", name: "Cancha múltiple", description: "Deporte a un paso de casa.", photo_url: "" },
]

function Metric({ big, small }: { big: string; small: string }) {
  return <div><div style={{ fontSize: 26, fontWeight: 800, color: "#0a1a30" }}>{big}</div><div style={{ fontSize: 12, color: "#8494a8" }}>{small}</div></div>
}

function HeroArt() {
  return (
    <svg viewBox="0 0 460 360" width="100%" role="img" aria-label="Edificio Apartamentos Palulu" style={{ display: "block", filter: "drop-shadow(0 24px 44px rgba(21,84,184,.2))" }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dbeafe" /><stop offset="1" stopColor="#f4f7fb" /></linearGradient>
        <linearGradient id="b1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2f80ed" /><stop offset="1" stopColor="#1554b8" /></linearGradient>
      </defs>
      <rect width="460" height="360" rx="24" fill="url(#sky)" />
      <circle cx="368" cy="74" r="32" fill="#ffd23c" opacity="0.85" />
      <rect x="66" y="80" width="128" height="240" rx="9" fill="url(#b1)" />
      <rect x="208" y="132" width="98" height="188" rx="9" fill="#3b82f6" />
      <rect x="320" y="176" width="82" height="144" rx="9" fill="#60a5fa" />
      <g fill="#fff" opacity="0.92">{[0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2].map((c) => <rect key={`a${r}-${c}`} x={82 + c * 36} y={100 + r * 36} width="18" height="22" rx="3" />))}</g>
      <g fill="#dbeafe">{[0, 1, 2, 3, 4].map((r) => [0, 1].map((c) => <rect key={`b${r}-${c}`} x={224 + c * 42} y={150 + r * 34} width="18" height="20" rx="3" />))}</g>
      <g fill="#eff6ff">{[0, 1, 2, 3].map((r) => [0, 1].map((c) => <rect key={`c${r}-${c}`} x={334 + c * 32} y={194 + r * 32} width="16" height="18" rx="3" />))}</g>
      <rect x="26" y="315" width="408" height="14" rx="7" fill="#1e874b" opacity="0.9" />
      <circle cx="42" cy="308" r="14" fill="#1e874b" /><circle cx="418" cy="308" r="14" fill="#1e874b" />
    </svg>
  )
}

function UnitArt() {
  return (
    <svg viewBox="0 0 400 160" width="100%" role="img" aria-label="" style={{ display: "block" }}>
      <defs><linearGradient id="ug" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#1554b8" /></linearGradient></defs>
      <rect width="400" height="160" fill="url(#ug)" />
      <g fill="#fff" opacity="0.9">{[0, 1, 2].map((r) => [0, 1, 2, 3, 4].map((c) => <rect key={`${r}-${c}`} x={40 + c * 66} y={34 + r * 38} width="34" height="26" rx="4" />))}</g>
    </svg>
  )
}

const navLink: React.CSSProperties = { textDecoration: "none", color: "#16324f", fontWeight: 600, padding: "8px 12px", borderRadius: 10, fontSize: 14 }
const ctaBtn: React.CSSProperties = { textDecoration: "none", background: "#1f6feb", color: "#fff", fontWeight: 700, padding: "13px 22px", borderRadius: 12, fontSize: 15 }
const ctaGhost: React.CSSProperties = { textDecoration: "none", background: "#fff", color: "#16324f", fontWeight: 700, padding: "13px 22px", borderRadius: 12, fontSize: 15, border: "1px solid #d5deeb" }
const pill: React.CSSProperties = { display: "inline-block", background: "#e7effd", color: "#1554b8", fontWeight: 700, fontSize: 13, padding: "6px 12px", borderRadius: 999 }
const h2: React.CSSProperties = { fontSize: 27, fontWeight: 800, textAlign: "center", margin: "0 0 6px" }
const sub: React.CSSProperties = { textAlign: "center", color: "#5b6b82", margin: "0 0 28px" }
const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 6px 20px rgba(10,26,48,.06)", border: "1px solid #eef1f6" }

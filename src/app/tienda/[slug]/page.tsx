import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BRAND } from "@/lib/brand"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { rubroOf } from "@/lib/mallRubros"

export const dynamic = "force-dynamic"

type GalleryItem = { url: string; caption?: string }
type Store = {
  commercial_name: string
  activity: string
  floor: string
  tower: string
  logo_url: string
  cover_url: string
  tagline: string
  description: string
  phone: string
  microsite_whatsapp: string
  instagram: string
  website_url: string
  hours: string
  promo: string
  gallery: GalleryItem[]
}

async function loadStore(slug: string): Promise<Store | null> {
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from("units")
      .select("commercial_name, activity, floor, tower, logo_url, cover_url, tagline, description, phone, microsite_whatsapp, instagram, website_url, hours, promo, gallery, microsite_enabled")
      .eq("microsite_slug", slug)
      .eq("microsite_enabled", true)
      .maybeSingle()
    if (!data) return null
    return { ...(data as Store), gallery: Array.isArray(data.gallery) ? (data.gallery as GalleryItem[]) : [] }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const store = await loadStore(slug)
  if (!store) return { title: `Tienda · ${BRAND.name}` }
  return {
    title: `${store.commercial_name} · ${BRAND.name}`,
    description: store.tagline || store.description?.slice(0, 150) || `${store.commercial_name} en ${BRAND.name}.`,
  }
}

function igUrl(ig: string) {
  const v = ig.trim()
  if (!v) return ""
  if (v.startsWith("http")) return v
  return `https://instagram.com/${v.replace(/^@/, "")}`
}
function normUrl(u: string) {
  const v = u.trim()
  if (!v) return ""
  return v.startsWith("http") ? v : `https://${v}`
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const s = await loadStore(slug)
  if (!s) notFound()
  const info = rubroOf(s.activity)
  const wa = s.microsite_whatsapp || BRAND.whatsapp
  const waHref = `https://wa.me/${wa.replace(/[^\d]/g, "")}?text=${encodeURIComponent(`Hola ${s.commercial_name}, los vi en el directorio de ${BRAND.name}.`)}`
  const location = [s.tower, s.floor].filter(Boolean).join(" · ")

  return (
    <div style={{ background: "#f6fbfe", color: "#163243", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif", minHeight: "100vh" }}>
      {/* NAV mínima de retorno */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(246,251,254,.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid #dcecf5" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/portal" style={{ textDecoration: "none", color: "#0a6f9c", fontWeight: 700, fontSize: 14 }}>← {BRAND.name}</a>
          <a href="/portal#directorio" style={{ marginLeft: "auto", textDecoration: "none", color: "#163243", fontWeight: 600, fontSize: 14 }}>Directorio</a>
        </div>
      </header>

      {/* HERO / PORTADA */}
      <div style={{ position: "relative", height: 220, background: s.cover_url ? "#0c2432" : `linear-gradient(120deg, ${info.color}, #0f9bd7)`, overflow: "hidden" }}>
        {s.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
        )}
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px 60px" }}>
        {/* Cabecera del local */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginTop: -44 }}>
          <div style={{ width: 96, height: 96, borderRadius: 20, background: "#fff", boxShadow: "0 10px 30px rgba(12,36,50,.18)", display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden", border: "3px solid #fff" }}>
            {s.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo_url} alt="" width={96} height={96} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ fontSize: 42, color: info.color }}>{info.icon}</div>
            )}
          </div>
          <div style={{ paddingBottom: 6 }}>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center", background: "#fff", border: "1px solid #dcecf5", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: info.color }}>
              <span>{info.icon}</span>{info.label}
            </span>
          </div>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "16px 0 4px" }}>{s.commercial_name}</h1>
        {s.tagline && <p style={{ fontSize: 17, color: "#3f5a6b", margin: "0 0 4px" }}>{s.tagline}</p>}
        {location && <p style={{ fontSize: 14, color: "#7c93a6", margin: 0 }}>📍 {location} · {BRAND.name}</p>}

        {/* Promo activa */}
        {s.promo && (
          <div style={{ marginTop: 18, background: "linear-gradient(120deg,#f9a800,#e5007e)", color: "#fff", borderRadius: 14, padding: "14px 18px", fontWeight: 700, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>🎉</span>
            <span>{s.promo}</span>
          </div>
        )}

        {/* Acciones de contacto */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <a href={waHref} target="_blank" rel="noopener" style={btn("#25D366")}>💬 WhatsApp</a>
          {s.phone && <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} style={btn("#0f9bd7")}>📞 Llamar</a>}
          {s.instagram && <a href={igUrl(s.instagram)} target="_blank" rel="noopener" style={btn("#b26fd0")}>📷 Instagram</a>}
          {s.website_url && <a href={normUrl(s.website_url)} target="_blank" rel="noopener" style={btn("#3f5a6b")}>🌐 Sitio web</a>}
        </div>

        {/* Sobre / descripción */}
        {s.description && (
          <section style={{ marginTop: 26, background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #eaf3f8" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>Sobre {s.commercial_name}</h2>
            <p style={{ color: "#3f5a6b", lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>{s.description}</p>
          </section>
        )}

        {/* Horario */}
        {s.hours && (
          <section style={{ marginTop: 16, background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #eaf3f8" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>🕒 Horario</h2>
            <p style={{ color: "#3f5a6b", margin: 0, whiteSpace: "pre-line" }}>{s.hours}</p>
          </section>
        )}

        {/* Galería */}
        {s.gallery.length > 0 && (
          <section style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px" }}>Galería</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
              {s.gallery.map((g, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={g.url} alt={g.caption || ""} loading="lazy" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 12, background: "#eef1f6" }} />
              ))}
            </div>
          </section>
        )}

        <div style={{ marginTop: 30, textAlign: "center" }}>
          <a href="/portal#directorio" style={{ color: "#0a6f9c", fontWeight: 700, textDecoration: "none" }}>← Volver al directorio</a>
        </div>
      </div>
    </div>
  )
}

function btn(bg: string): React.CSSProperties {
  return { textDecoration: "none", background: bg, color: "#fff", fontWeight: 700, padding: "11px 18px", borderRadius: 12, fontSize: 14 }
}

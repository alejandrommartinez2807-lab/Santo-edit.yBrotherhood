import type { Metadata } from "next"
import { BRAND } from "@/lib/brand"
import { getSupabaseAdmin } from "@/lib/supabaseServer"

export const metadata: Metadata = { title: `Mapa y directorio · ${BRAND.name}` }
export const dynamic = "force-dynamic"

type Store = { commercial_name: string; activity: string; floor: string }

const ICON: Record<string, string> = {
  comida: "🍔", moda: "👗", salud: "➕", belleza: "💈", electronica: "📱", hogar: "🛋️", servicios: "🔧",
  banco: "🏦", consultorio: "🩺", oficina: "🏢", kiosco: "🛍️", entretenimiento: "🎬", supermercado: "🛒", otro: "🏬",
}
const DEMO: Store[] = [
  { commercial_name: "Supermercados Kalea", activity: "supermercado", floor: "Planta baja" },
  { commercial_name: "Beco", activity: "moda", floor: "Planta baja" },
  { commercial_name: "Farmacia", activity: "salud", floor: "Planta baja" },
  { commercial_name: "Fígaro Barbiere", activity: "belleza", floor: "Planta baja" },
  { commercial_name: "SuperCines", activity: "entretenimiento", floor: "Mezzanina" },
  { commercial_name: "Capitán Grill Burger", activity: "comida", floor: "Feria de comida" },
  { commercial_name: "María Paleta", activity: "comida", floor: "Feria de comida" },
  { commercial_name: "Consultorios médicos", activity: "consultorio", floor: "Torre médica" },
]

async function load(): Promise<Store[]> {
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase.from("units").select("commercial_name, activity, floor").neq("commercial_name", "").order("floor").limit(300)
    return (data as Store[]) ?? []
  } catch { return [] }
}

export default async function MapaPage() {
  const rows = await load()
  const stores = rows.length ? rows : DEMO
  const byFloor = new Map<string, Store[]>()
  for (const s of stores) {
    const f = s.floor || "Otros"
    if (!byFloor.has(f)) byFloor.set(f, [])
    byFloor.get(f)!.push(s)
  }
  const floors = Array.from(byFloor.keys())

  return (
    <div style={{ minHeight: "100vh", background: "#f6fbfe", color: "#163243", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #dcecf5" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/concepto-logo.png" alt="" width={36} height={36} style={{ borderRadius: 8 }} />
          <strong>Mapa y directorio</strong>
          <a href="/portal" style={{ marginLeft: "auto", color: "#0a6f9c", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>← Volver</a>
        </div>
      </header>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 6px" }}>¿Dónde queda cada tienda?</h1>
        <p style={{ color: "#5b6b82", marginTop: 0 }}>Directorio organizado por nivel del centro comercial.</p>
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          {floors.map((f) => (
            <div key={f} style={{ background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #eaf3f8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ background: "#0f9bd7", color: "#fff", fontWeight: 800, borderRadius: 10, padding: "4px 12px", fontSize: 14 }}>{f}</span>
                <span style={{ color: "#8494a8", fontSize: 13 }}>{byFloor.get(f)!.length} local(es)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
                {byFloor.get(f)!.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", background: "#f6fbfe", borderRadius: 10, border: "1px solid #eaf3f8" }}>
                    <span style={{ fontSize: 20 }}>{ICON[s.activity] || "🏬"}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{s.commercial_name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

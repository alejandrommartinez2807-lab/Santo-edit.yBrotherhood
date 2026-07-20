import { normalizeSearch } from "@/lib/mallText"

// Rubros del centro comercial (etiqueta, ícono y color). Única fuente de verdad
// compartida por el directorio (/portal) y el micrositio (/tienda/[slug]).
export type Rubro = { label: string; icon: string; color: string }

export const RUBRO: Record<string, Rubro> = {
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

export function rubroOf(activity: string): Rubro {
  return RUBRO[activity] || RUBRO.otro
}

// ---- Directorio: filtrado puro (testeable) ----
export type StoreLike = {
  commercial_name: string
  activity: string
  floor: string
}

// Filtra por rubro ("todos" = sin filtro) y por texto (nombre, rubro, piso),
// ignorando acentos y mayúsculas. Devuelve los que cumplen ambos.
export function filterStores<T extends StoreLike>(stores: T[], query: string, rubro: string): T[] {
  const q = normalizeSearch(query)
  return stores.filter((s) => {
    if (rubro !== "todos" && (s.activity || "otro") !== rubro) return false
    if (!q) return true
    const hay = normalizeSearch(`${s.commercial_name} ${rubroOf(s.activity).label} ${s.floor}`)
    return hay.includes(q)
  })
}

// Rubros presentes con su conteo, ordenados por cantidad (desc).
export function rubroCounts<T extends StoreLike>(stores: T[]): { key: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of stores) {
    const key = s.activity || "otro"
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }))
}

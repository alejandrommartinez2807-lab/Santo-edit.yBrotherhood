"use client"

import { useMemo, useState } from "react"

export type Store = {
  id: string
  code: string
  commercial_name: string
  activity: string
  floor: string
  logo_url: string
  microsite_slug: string
  microsite_enabled: boolean
}

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

// Normaliza para buscar sin importar acentos ni mayúsculas.
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
}

export default function PortalDirectory({ stores }: { stores: Store[] }) {
  const [query, setQuery] = useState("")
  const [rubro, setRubro] = useState<string>("todos")

  // Rubros presentes, con su conteo, ordenados por cantidad (desc).
  const rubros = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of stores) {
      const key = s.activity || "otro"
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }))
  }, [stores])

  const filtered = useMemo(() => {
    const q = norm(query)
    return stores.filter((s) => {
      if (rubro !== "todos" && (s.activity || "otro") !== rubro) return false
      if (!q) return true
      const hay = norm(`${s.commercial_name} ${rubroOf(s.activity).label} ${s.floor}`)
      return hay.includes(q)
    })
  }, [stores, query, rubro])

  return (
    <div>
      {/* Buscador */}
      <div style={{ maxWidth: 520, margin: "0 auto 18px", position: "relative" }}>
        <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 18, pointerEvents: "none" }}>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca una tienda, restaurante o servicio…"
          aria-label="Buscar en el directorio"
          style={{
            width: "100%",
            padding: "13px 44px 13px 44px",
            borderRadius: 999,
            border: "1px solid #cfe6f2",
            fontSize: 15,
            outline: "none",
            background: "#f6fbfe",
          }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Limpiar búsqueda"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: 0, background: "#dcecf5", color: "#3f5a6b", borderRadius: 999, width: 26, height: 26, cursor: "pointer", fontSize: 14, lineHeight: 1 }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Chips de rubro (clicables) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 26 }}>
        <Chip active={rubro === "todos"} onClick={() => setRubro("todos")} icon="🏬" label="Todos" count={stores.length} color="#0a6f9c" />
        {rubros.map(({ key, count }) => {
          const info = rubroOf(key)
          return (
            <Chip
              key={key}
              active={rubro === key}
              onClick={() => setRubro(key)}
              icon={info.icon}
              label={info.label}
              count={count}
              color={info.color}
            />
          )
        })}
      </div>

      {/* Grid de resultados */}
      {filtered.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
          {filtered.map((s) => {
            const info = rubroOf(s.activity)
            const hasSite = s.microsite_enabled && !!s.microsite_slug
            const inner = (
              <>
                {s.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo_url} alt="" width={48} height={48} style={{ borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: info.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 22, flexShrink: 0 }}>{info.icon}</div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.commercial_name}</div>
                  <div style={{ fontSize: 13, color: "#5b6b82" }}>{info.label}{s.floor ? ` · ${s.floor}` : ""}</div>
                </div>
                {hasSite && <span style={{ color: "#0a6f9c", fontSize: 18, flexShrink: 0 }}>›</span>}
              </>
            )
            return hasSite ? (
              <a
                key={s.id}
                href={`/tienda/${s.microsite_slug}`}
                style={{ ...card, display: "flex", gap: 12, alignItems: "center", textDecoration: "none", color: "inherit", cursor: "pointer" }}
              >
                {inner}
              </a>
            ) : (
              <div key={s.id} style={{ ...card, display: "flex", gap: 12, alignItems: "center" }}>
                {inner}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "36px 0", color: "#5b6b82" }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <p style={{ margin: "8px 0 0", fontWeight: 600 }}>
            No encontramos resultados{query ? ` para «${query}»` : ""}.
          </p>
          <button
            onClick={() => {
              setQuery("")
              setRubro("todos")
            }}
            style={{ marginTop: 10, border: 0, background: "#0f9bd7", color: "#fff", borderRadius: 12, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}
          >
            Ver todo el directorio
          </button>
        </div>
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  icon,
  label,
  count,
  color,
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
  count: number
  color: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        background: active ? color : "#f2f9fd",
        color: active ? "#fff" : "#163243",
        border: `1px solid ${active ? color : "#dcecf5"}`,
        borderRadius: 999,
        padding: "6px 12px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background .15s, color .15s",
      }}
    >
      <span>{icon}</span>
      {label}
      <span
        style={{
          background: active ? "rgba(255,255,255,.25)" : "#dcecf5",
          color: active ? "#fff" : "#5b6b82",
          borderRadius: 999,
          padding: "1px 7px",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </button>
  )
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 6px 20px rgba(12,36,50,.06)",
  border: "1px solid #eaf3f8",
}

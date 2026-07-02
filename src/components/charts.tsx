"use client"

// Gráficas SVG ligeras (sin dependencias), temizadas con las variables de marca.

const PALETTE = [
  "var(--brand-primary)",
  "var(--brand-accent)",
  "var(--brand-primary-dark)",
  "var(--brand-amber)",
  "var(--brand-ink)",
  "var(--brand-accent-200)",
]

function fmtUSD(n: number) {
  return `$${(n || 0).toFixed(n >= 100 ? 0 : 2)}`
}

// ---- Dona con leyenda (proporciones) ----
export function DonutChart({
  data,
  unit = "",
}: {
  data: { label: string; value: number }[]
  unit?: string
}) {
  // Sin las categorías en 0: un segmento invisible con "0%" en la leyenda
  // parece una gráfica rota.
  const segments = data.filter((d) => d.value > 0)
  const total = segments.reduce((s, d) => s + d.value, 0)
  const size = 160
  const r = 60
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  let offset = 0

  if (total <= 0) {
    return <p className="text-sm font-bold text-[var(--brand-ink-2)]/55">Sin datos en el período.</p>
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {segments.map((d, i) => {
          const frac = d.value / total
          const dash = frac * circ
          const seg = (
            <circle
              key={d.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={22}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
            />
          )
          offset += dash
          return seg
        })}
        <circle cx={cx} cy={cy} r={r - 11} fill="white" />
      </svg>
      <div className="space-y-1.5">
        {segments.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="font-bold text-[var(--brand-ink)]">{d.label}</span>
            <span className="font-black text-[var(--brand-primary)]">
              {Math.round((d.value / total) * 100)}%{unit ? ` · ${unit === "$" ? fmtUSD(d.value) : d.value}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Barras horizontales (rankings) ----
export function HBarChart({
  data,
}: {
  data: { label: string; value: number; suffix?: string }[]
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (data.length === 0) {
    return <p className="text-sm font-bold text-[var(--brand-ink-2)]/55">Sin datos en el período.</p>
  }
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.label} className="text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-[var(--brand-ink)]">
              {i + 1}. {d.label}
            </span>
            <span className="shrink-0 font-black text-[var(--brand-primary)]">{d.suffix ?? d.value}</span>
          </div>
          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[var(--brand-cream)]">
            <div
              className="h-full rounded-full bg-[var(--brand-primary)]"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- Barras verticales (series temporales) ----
export function VBarChart({
  data,
  height = 140,
  highlightEvery = 1,
}: {
  data: { label: string; value: number; tip?: string }[]
  height?: number
  highlightEvery?: number
}) {
  const max = Math.max(...data.map((d) => d.value), 0)

  if (data.length === 0 || max <= 0) {
    return <p className="text-sm font-bold text-[var(--brand-ink-2)]/55">Sin datos en el período.</p>
  }

  // Con pocas barras los valores van siempre visibles (en táctil no hay
  // hover); con series largas solo al pasar el cursor para no encimarse.
  const alwaysShowValues = data.length <= 8
  // En series densas (30 días) las columnas son muy angostas: la etiqueta
  // visible (espaciada por highlightEvery) se desborda sin recorte; con pocas
  // barras anchas se trunca el nombre largo.
  const denseLabels = data.length > 12

  return (
    <div className="flex justify-center gap-1">
      {data.map((d, i) => (
        <div
          key={i}
          // max-w evita el efecto "bloque gigante" cuando hay 1-3 barras.
          className="group flex min-w-0 max-w-16 flex-1 flex-col"
          title={d.tip || `${d.label}: ${fmtUSD(d.value)}`}
        >
          <div className="flex flex-col items-center justify-end gap-1" style={{ height }}>
            <span
              className={`text-[0.55rem] font-black text-[var(--brand-primary)] ${
                alwaysShowValues ? "" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              {d.value > 0 ? fmtUSD(d.value) : ""}
            </span>
            <div
              className="w-full rounded-t bg-[var(--brand-primary)] transition group-hover:bg-[var(--brand-primary-dark)]"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 3 : 0 }}
            />
          </div>
          <span
            className={`border-t-2 border-[var(--brand-primary)]/15 pt-1 text-center text-[0.55rem] font-bold text-[var(--brand-ink-2)]/50 ${
              denseLabels ? "overflow-visible whitespace-nowrap" : "truncate"
            }`}
          >
            {i % highlightEvery === 0 ? d.label : " "}
          </span>
        </div>
      ))}
    </div>
  )
}

"use client"

// Gráficas SVG del módulo Reportes del hotel — sin dependencias.
// Specs: marcas finas (línea 2px, columnas ≤24px con tope redondeado 4px),
// grid hairline sólido y recesivo, hover con crosshair + tooltip único,
// etiquetas selectivas (nunca un número en cada punto) y texto SIEMPRE en
// tokens de tinta (el color de la serie vive solo en la marca).
// Paleta validada (validate_palette: 6 checks en verde sobre blanco):
//   serie única / acento  #a5762f   ·   segunda serie  #2f6bb0

import { useMemo, useRef, useState } from "react"

export const CHART_ACCENT = "#a5762f"
export const CHART_SECOND = "#2f6bb0"
const GRID = "#ece7dc"
const AXIS_TEXT = "var(--brand-ink-2)"

export function fmtMoney(n: number) {
  return `$${(Math.round((n || 0) * 100) / 100).toLocaleString("es-VE")}`
}

function fmtShortDate(iso: string) {
  const [, m, d] = iso.split("-")
  return `${Number(d)}/${Number(m)}`
}

/** Ticks "limpios" para el eje Y (0, 5, 10 / 0, 100, 200…). */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0]
  const rawStep = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const candidates = [1, 2, 2.5, 5, 10]
  const step = (candidates.find((c) => c * magnitude >= rawStep) || 10) * magnitude
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

type TooltipState = { x: number; y: number; title: string; rows: { label: string; value: string }[] }

function Tooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-28 rounded-lg border border-[var(--brand-primary)]/20 bg-white px-3 py-2 shadow-md"
      style={{ left: tip.x, top: tip.y, transform: "translate(-50%, calc(-100% - 10px))" }}
    >
      <p className="text-[11px] font-semibold text-[var(--brand-ink-2)]">{tip.title}</p>
      {tip.rows.map((row) => (
        <p key={row.label} className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] text-[var(--brand-ink-2)]/70">{row.label}</span>
          <span className="text-[13px] font-bold text-[var(--brand-ink-3)]">{row.value}</span>
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Línea (serie única) con área lavada, crosshair y tooltip.
// ---------------------------------------------------------------------------

export function HotelLineChart({
  data,
  valueLabel,
  formatValue,
  maxValue,
  height = 190,
}: {
  data: { date: string; value: number; extra?: string }[]
  valueLabel: string
  formatValue: (v: number) => string
  /** Tope fijo del eje (p. ej. 100 para %); si falta, usa el máximo de la serie. */
  maxValue?: number
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [tip, setTip] = useState<TooltipState | null>(null)

  const width = 640
  const pad = { top: 14, right: 14, bottom: 26, left: 44 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const max = maxValue ?? Math.max(1, ...data.map((d) => d.value))
  const ticks = useMemo(() => niceTicks(max), [max])
  const topTick = ticks[ticks.length - 1] || 1

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: pad.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2),
        y: pad.top + innerH - (Math.min(d.value, topTick) / topTick) * innerH,
        ...d,
      })),
    [data, innerW, innerH, pad.left, pad.top, topTick],
  )

  if (data.length === 0) {
    return <p className="text-sm font-semibold text-[var(--brand-ink-2)]/55">Sin datos en el período.</p>
  }

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${pad.top + innerH} L${points[0].x.toFixed(1)},${pad.top + innerH} Z`

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    let nearest = 0
    let best = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(p.x - px)
      if (d < best) { best = d; nearest = i }
    })
    setHover(nearest)
    const p = points[nearest]
    const wrap = wrapRef.current?.getBoundingClientRect()
    if (wrap) {
      setTip({
        x: (p.x / width) * wrap.width,
        y: (p.y / height) * wrap.height,
        title: p.date,
        rows: [
          { label: valueLabel, value: formatValue(p.value) },
          ...(p.extra ? [{ label: "", value: p.extra }] : []),
        ],
      })
    }
  }

  const hovered = hover !== null ? points[hover] : null
  // Etiquetas X selectivas: primera, última y ~4 intermedias.
  const xLabelStep = Math.max(1, Math.ceil(data.length / 6))

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={valueLabel}
        onPointerMove={onMove}
        onPointerLeave={() => { setHover(null); setTip(null) }}
      >
        {ticks.map((t) => {
          const y = pad.top + innerH - (t / topTick) * innerH
          return (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill={AXIS_TEXT} opacity={0.75}>
                {formatValue(t)}
              </text>
            </g>
          )
        })}
        {points.map((p, i) =>
          i % xLabelStep === 0 || i === points.length - 1 ? (
            <text key={p.date} x={p.x} y={height - 8} textAnchor="middle" fontSize={10} fill={AXIS_TEXT} opacity={0.75}>
              {fmtShortDate(p.date)}
            </text>
          ) : null,
        )}
        <path d={areaPath} fill={CHART_ACCENT} opacity={0.1} />
        <path d={linePath} fill="none" stroke={CHART_ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hovered && (
          <>
            <line x1={hovered.x} x2={hovered.x} y1={pad.top} y2={pad.top + innerH} stroke={CHART_ACCENT} strokeWidth={1} opacity={0.45} />
            {/* Marcador ≥8px con anillo de superficie de 2px */}
            <circle cx={hovered.x} cy={hovered.y} r={6} fill={CHART_ACCENT} stroke="#ffffff" strokeWidth={2} />
          </>
        )}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Columnas (serie única) con tooltip por barra y realce al pasar.
// ---------------------------------------------------------------------------

export function HotelColumnChart({
  data,
  valueLabel,
  formatValue,
  height = 190,
}: {
  data: { date: string; value: number }[]
  valueLabel: string
  formatValue: (v: number) => string
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [tip, setTip] = useState<TooltipState | null>(null)

  const width = 640
  const pad = { top: 14, right: 14, bottom: 26, left: 44 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const max = Math.max(1, ...data.map((d) => d.value))
  const ticks = useMemo(() => niceTicks(max), [max])
  const topTick = ticks[ticks.length - 1] || 1

  if (data.length === 0) {
    return <p className="text-sm font-semibold text-[var(--brand-ink-2)]/55">Sin datos en el período.</p>
  }

  const band = innerW / data.length
  // ≤24px de grosor y 2px de aire (el hueco separa, no un borde).
  const barW = Math.min(24, Math.max(3, band - 2))
  const xLabelStep = Math.max(1, Math.ceil(data.length / 6))

  function showTip(i: number) {
    setHover(i)
    const wrap = wrapRef.current?.getBoundingClientRect()
    if (!wrap) return
    const d = data[i]
    const x = pad.left + i * band + band / 2
    const h = (Math.min(d.value, topTick) / topTick) * innerH
    const y = pad.top + innerH - h
    setTip({
      x: (x / width) * wrap.width,
      y: (y / height) * wrap.height,
      title: d.date,
      rows: [{ label: valueLabel, value: formatValue(d.value) }],
    })
  }

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={valueLabel}
        onPointerLeave={() => { setHover(null); setTip(null) }}
      >
        {ticks.map((t) => {
          const y = pad.top + innerH - (t / topTick) * innerH
          return (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill={AXIS_TEXT} opacity={0.75}>
                {formatValue(t)}
              </text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 2 : 0, (Math.min(d.value, topTick) / topTick) * innerH)
          const x = pad.left + i * band + (band - barW) / 2
          const y = pad.top + innerH - h
          const r = Math.min(4, barW / 2, h)
          return (
            <g key={d.date}>
              {i % xLabelStep === 0 || i === data.length - 1 ? (
                <text x={pad.left + i * band + band / 2} y={height - 8} textAnchor="middle" fontSize={10} fill={AXIS_TEXT} opacity={0.75}>
                  {fmtShortDate(d.date)}
                </text>
              ) : null}
              {h > 0 && (
                // Tope redondeado 4px, base cuadrada (crece desde la línea base).
                <path
                  d={`M${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${pad.top + innerH} L${x},${pad.top + innerH} Z`}
                  fill={CHART_ACCENT}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {/* Zona de impacto más grande que la marca (toda la banda). */}
              <rect
                x={pad.left + i * band}
                y={pad.top}
                width={band}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.date}: ${formatValue(d.value)}`}
                onPointerMove={() => showTip(i)}
                onFocus={() => showTip(i)}
                onBlur={() => { setHover(null); setTip(null) }}
              />
            </g>
          )
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barras horizontales (ranking, serie única: un solo color para todas).
// ---------------------------------------------------------------------------

export function HotelBars({
  data,
  formatValue,
}: {
  data: { label: string; value: number; detail?: string }[]
  formatValue: (v: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (data.length === 0) {
    return <p className="text-sm font-semibold text-[var(--brand-ink-2)]/55">Sin datos en el período.</p>
  }
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="text-sm" title={d.detail ? `${d.label} · ${d.detail}` : d.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-semibold text-[var(--brand-ink)]">{d.label}</span>
            {/* Valor al final de la barra, en tinta (nunca en el color de la serie). */}
            <span className="shrink-0 font-bold text-[var(--brand-ink-3)]">{formatValue(d.value)}</span>
          </div>
          <div className="mt-1 h-3 w-full rounded-r-[4px] bg-[var(--brand-cream)]">
            <div
              className="h-full rounded-r-[4px]"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: CHART_ACCENT }}
            />
          </div>
          {d.detail && <p className="mt-0.5 text-xs text-[var(--brand-ink-2)]/60">{d.detail}</p>}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barra 100% apilada de DOS series (web vs recepción) + leyenda.
// ---------------------------------------------------------------------------

export function HotelSplitBar({
  a,
  b,
  formatValue,
}: {
  a: { label: string; value: number; detail?: string }
  b: { label: string; value: number; detail?: string }
  formatValue: (v: number) => string
}) {
  const total = a.value + b.value
  if (total <= 0) {
    return <p className="text-sm font-semibold text-[var(--brand-ink-2)]/55">Sin datos en el período.</p>
  }
  const pctA = (a.value / total) * 100
  const segments = [
    { ...a, color: CHART_ACCENT, pct: pctA },
    { ...b, color: CHART_SECOND, pct: 100 - pctA },
  ]
  return (
    <div>
      {/* Hueco de superficie de 2px entre segmentos (gap del flex). */}
      <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded-[6px]">
        {segments.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${formatValue(s.value)} (${Math.round(s.pct)}%)`}
            className="h-full transition-opacity hover:opacity-85"
            style={{ width: `${Math.max(1.5, s.pct)}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <p key={s.label} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: s.color }} />
            <span className="font-semibold text-[var(--brand-ink)]">{s.label}</span>
            <span className="font-bold text-[var(--brand-ink-3)]">
              {formatValue(s.value)} · {Math.round(s.pct)}%
            </span>
            {s.detail && <span className="text-xs text-[var(--brand-ink-2)]/60">{s.detail}</span>}
          </p>
        ))}
      </div>
    </div>
  )
}

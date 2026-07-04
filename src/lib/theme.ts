// Construye el CSS de tema de marca a partir de los colores elegidos por el
// dueño (guardados en business_config). Sobrescribe las variables --brand-*
// definidas por defecto en globals.css. Solo overridea lo que venga definido.

function normalizeHex(value: unknown): string {
  const v = String(value || "").trim()
  return /^#([0-9a-fA-F]{6})$/.test(v) ? v.toLowerCase() : ""
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x)))
  return `#${((c(r) << 16) | (c(g) << 8) | c(b)).toString(16).padStart(6, "0")}`
}

// Mezcla hacia negro (amount 0..1) — para tonos oscuros de texto.
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount))
}

// Mezcla hacia blanco (amount 0..1) — para tonos claros del acento.
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}

export type BrandThemeColors = {
  primary?: unknown
  cream?: unknown
  accent?: unknown
}

// Devuelve un bloque `:root{...}` con las variables que se deban sobrescribir,
// o "" si no hay ningún color personalizado válido.
export function buildBrandThemeCss(colors: BrandThemeColors): string {
  const primary = normalizeHex(colors.primary)
  const cream = normalizeHex(colors.cream)
  const accent = normalizeHex(colors.accent)

  const lines: string[] = []

  if (primary) {
    const [r, g, b] = hexToRgb(primary)
    lines.push(`--brand-primary:${primary};`)
    lines.push(`--brand-primary-rgb:${r}, ${g}, ${b};`)
    lines.push(`--brand-primary-dark:${darken(primary, 0.25)};`)
    // Tema oscuro: los --brand-ink* (texto) se quedan claros desde globals.css.
    // No los derivamos del primary para no volver el texto oscuro sobre el fondo negro.
  }

  if (cream) {
    lines.push(`--brand-cream:${cream};`)
  }

  if (accent) {
    const [r, g, b] = hexToRgb(accent)
    lines.push(`--brand-accent:${accent};`)
    lines.push(`--brand-accent-rgb:${r}, ${g}, ${b};`)
    lines.push(`--brand-accent-200:${lighten(accent, 0.25)};`)
    lines.push(`--brand-accent-100:${lighten(accent, 0.55)};`)
  }

  return lines.length ? `:root{${lines.join("")}}` : ""
}

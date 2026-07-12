export type PublicNavButtonKind = "section" | "whatsapp" | "instagram" | "url"

export type PublicNavButton = {
  id: string
  label: string
  kind: PublicNavButtonKind
  target: string
  isVisible: boolean
  sortOrder: number
}

export const DEFAULT_PUBLIC_CATEGORY_ORDER = [
  "Burgers",
  "Combos",
  "Papas",
  "Chicken",
  "Bebidas",
  "Postres",
]

export const DEFAULT_PUBLIC_NAV_BUTTONS: PublicNavButton[] = [
  {
    id: "inicio",
    label: "Inicio",
    kind: "section",
    target: "#inicio",
    isVisible: true,
    sortOrder: 1,
  },
  {
    id: "menu",
    label: "Menú",
    kind: "section",
    target: "#menu",
    isVisible: true,
    sortOrder: 2,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    kind: "whatsapp",
    target: "",
    isVisible: true,
    sortOrder: 3,
  },
  {
    id: "instagram",
    label: "Instagram",
    kind: "instagram",
    target: "",
    isVisible: true,
    sortOrder: 4,
  },
  {
    id: "ver-cuenta",
    label: "Ver cuenta",
    kind: "section",
    target: "#abrir-cuenta",
    isVisible: true,
    sortOrder: 5,
  },
]

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function normalizeComparableText(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function normalizeNavButtonKind(value: unknown): PublicNavButtonKind {
  const normalized = normalizeComparableText(value)

  if (normalized === "whatsapp") return "whatsapp"
  if (normalized === "instagram") return "instagram"
  if (normalized === "url" || normalized === "link" || normalized === "enlace") {
    return "url"
  }

  return "section"
}

function normalizeNavTarget(value: unknown, kind: PublicNavButtonKind, fallback = "#menu") {
  const cleanValue = cleanText(value)

  if (kind === "whatsapp" || kind === "instagram") return ""

  if (!cleanValue) return fallback

  if (
    cleanValue.startsWith("#") ||
    cleanValue.startsWith("/") ||
    cleanValue.startsWith("http://") ||
    cleanValue.startsWith("https://")
  ) {
    return cleanValue
  }

  return fallback
}

function createNavButtonId(value: unknown, fallback: string) {
  const cleanValue = normalizeComparableText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return cleanValue || fallback
}

export function normalizePublicCategoryList(value: unknown): string[] {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? (() => {
          try {
            const parsedValue = JSON.parse(value)
            return Array.isArray(parsedValue)
              ? parsedValue
              : value.split(/[;,|\n]/g)
          } catch {
            return value.split(/[;,|\n]/g)
          }
        })()
      : []
  const seen = new Set<string>()

  return rawList
    .map((item) => cleanText(item))
    .filter((item) => {
      const key = normalizeComparableText(item)
      if (!item || !key || key === "todos" || key === "favoritos") return false
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function normalizePublicHiddenCategoryList(value: unknown): string[] {
  return normalizePublicCategoryList(value)
}

// Métodos de pago que el carrito público ofrece al cliente. El dueño los edita
// en Configuración; una lista vacía cae a estos valores para que el select
// nunca quede sin opciones.
export const DEFAULT_PUBLIC_PAYMENT_METHODS = [
  "Pago móvil",
  "Efectivo en divisas",
  "Efectivo en Bs",
  "Punto de venta",
  "Transferencia",
  "Por confirmar",
]

export function normalizePublicPaymentMethods(value: unknown): string[] {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? (() => {
          try {
            const parsedValue = JSON.parse(value)
            return Array.isArray(parsedValue) ? parsedValue : value.split(/[;,|\n]/g)
          } catch {
            return value.split(/[;,|\n]/g)
          }
        })()
      : []
  const seen = new Set<string>()

  const methods = rawList
    .map((item) => cleanText(item).slice(0, 40))
    .filter((item) => {
      const key = normalizeComparableText(item)
      if (!item || !key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 12)

  return methods.length ? methods : [...DEFAULT_PUBLIC_PAYMENT_METHODS]
}

// Datos de cada método de pago (número de pago móvil, correo de Zelle, etc.),
// escritos por el dueño en Configuración. El carrito los muestra en botones
// desplegables ("Ver datos de Pago móvil") con copiado línea a línea, así el
// cliente paga sin preguntar por WhatsApp. Mapa método → líneas de datos.
export function normalizePublicPaymentMethodDetails(
  value: unknown,
): Record<string, string> {
  let raw: unknown = value

  if (typeof value === "string" && value.trim()) {
    try {
      raw = JSON.parse(value)
    } catch {
      raw = null
    }
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}

  const result: Record<string, string> = {}

  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(result).length >= 12) break

    const method = cleanText(key).slice(0, 40)
    if (!method || typeof entry !== "string") continue

    const details = entry
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => cleanText(line).slice(0, 90))
      .filter(Boolean)
      .slice(0, 8)
      .join("\n")

    if (details) result[method] = details
  }

  return result
}

// Cupones del carrito público. El dueño escribe uno por línea como
// "BROTHER10 10" (código + porcentaje de descuento). Se guardan normalizados
// ("CODIGO 10") y NUNCA viajan en la respuesta pública: el cliente valida su
// código contra /api/public/coupons y solo recibe el porcentaje del suyo.
export type PublicCoupon = {
  code: string
  percent: number
}

export function parsePublicCouponLine(value: unknown): PublicCoupon | null {
  const parts = cleanText(value).split(/\s+/)

  if (parts.length < 2) return null

  const code = parts[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 20)
  const percent = Math.round(Number(parts[1].replace(/%$/, "")))

  if (code.length < 3 || !Number.isFinite(percent) || percent < 1 || percent > 99) {
    return null
  }

  return { code, percent }
}

export function normalizePublicCoupons(value: unknown): string[] {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? value.split(/[;\n]/g)
      : []
  const seen = new Set<string>()

  return rawList
    .map(parsePublicCouponLine)
    .filter((coupon): coupon is PublicCoupon => {
      if (!coupon || seen.has(coupon.code)) return false
      seen.add(coupon.code)
      return true
    })
    .slice(0, 20)
    .map((coupon) => `${coupon.code} ${coupon.percent}`)
}

export function findPublicCoupon(lines: unknown, code: unknown): PublicCoupon | null {
  const wanted = cleanText(code)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")

  if (!wanted) return null

  return (
    normalizePublicCoupons(lines)
      .map(parsePublicCouponLine)
      .find((coupon) => coupon?.code === wanted) || null
  )
}

export function normalizePublicNavButtons(value: unknown): PublicNavButton[] {
  const rawList = Array.isArray(value) ? value : []
  const fallbackById = new Map(DEFAULT_PUBLIC_NAV_BUTTONS.map((item) => [item.id, item]))
  const normalizedButtons = rawList
    .map((item, index) => {
      const source = item && typeof item === "object" ? item as Record<string, unknown> : {}
      const fallback =
        fallbackById.get(cleanText(source.id)) ||
        DEFAULT_PUBLIC_NAV_BUTTONS[index] ||
        DEFAULT_PUBLIC_NAV_BUTTONS[DEFAULT_PUBLIC_NAV_BUTTONS.length - 1]
      const kind = normalizeNavButtonKind(source.kind || fallback.kind)
      const label = cleanText(source.label || fallback.label).slice(0, 24) || fallback.label
      const sortOrder = Number(source.sortOrder || fallback.sortOrder || index + 1)

      return {
        id: createNavButtonId(source.id || label, fallback.id),
        label,
        kind,
        target: normalizeNavTarget(source.target, kind, fallback.target || "#menu"),
        isVisible: source.isVisible !== false,
        sortOrder: Number.isFinite(sortOrder) ? Math.max(1, Math.round(sortOrder)) : index + 1,
      } satisfies PublicNavButton
    })
    .filter((item, index, list) => {
      const firstIndex = list.findIndex((candidate) => candidate.id === item.id)
      return firstIndex === index
    })

  const merged = DEFAULT_PUBLIC_NAV_BUTTONS.map((fallbackButton) => {
    const savedButton = normalizedButtons.find((item) => item.id === fallbackButton.id)
    return savedButton || fallbackButton
  })

  normalizedButtons.forEach((button) => {
    if (!merged.some((item) => item.id === button.id)) {
      merged.push(button)
    }
  })

  return merged
    .sort((first, second) => first.sortOrder - second.sortOrder || first.label.localeCompare(second.label))
    .slice(0, 8)
}

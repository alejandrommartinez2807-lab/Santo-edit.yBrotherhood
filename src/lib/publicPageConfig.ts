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

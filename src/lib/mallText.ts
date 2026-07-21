// Utilidades de texto del centro comercial (puras, compartidas por panel,
// portal del comerciante y directorio público). Única fuente de verdad para
// que el slug del micrositio sea idéntico en todos lados.

// "Capitán Grill" -> "capitan-grill". Sin acentos, minúsculas, guiones.
export function slugify(v: string): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

// Normaliza para búsqueda: minúsculas, sin acentos, sin espacios extremos.
export function normalizeSearch(v: string): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
}

// URL externa segura para un href: sólo http(s). Acepta con o sin protocolo;
// cualquier otro esquema (javascript:, data:, etc.) se neutraliza como https.
export function externalUrl(v: string): string {
  const s = String(v ?? "").trim()
  if (!s) return ""
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s.replace(/^\/+/, "")}`
}

// URL de Instagram a partir de "@usuario", "usuario" o una URL completa.
export function instagramUrl(v: string): string {
  const s = String(v ?? "").trim()
  if (!s) return ""
  if (/^https?:\/\//i.test(s)) return s
  return `https://instagram.com/${s.replace(/^@+/, "")}`
}

// Deja sólo dígitos (para wa.me / tel:).
export function digitsOnly(v: string): string {
  return String(v ?? "").replace(/[^\d]/g, "")
}

// Productos destacados del micrositio --------------------------------------
// Se guardan en units.featured_products como [{name, price, image, description}].
// price = 0 significa "sin precio publicado" (se muestra sólo el nombre).

export type MicrositeProduct = {
  name: string
  price: number
  image: string
  description: string
}

const MAX_PRODUCTS = 24

// Valida lo que venga de un formulario/API y lo deja en la forma canónica.
export function sanitizeProducts(v: unknown): MicrositeProduct[] {
  if (!Array.isArray(v)) return []
  return v
    .map((p) => {
      const o = (p || {}) as Record<string, unknown>
      const price = Number(o.price)
      return {
        name: String(o.name ?? "").trim().slice(0, 80),
        price: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : 0,
        image: String(o.image ?? "").trim().slice(0, 500),
        description: String(o.description ?? "").trim().slice(0, 200),
      }
    })
    .filter((p) => p.name)
    .slice(0, MAX_PRODUCTS)
}

// Editor de texto plano (panel / mi-cuenta): una línea por producto con el
// formato "Nombre | precio | url de imagen | descripción". Sólo el nombre es
// obligatorio; el precio acepta coma o punto decimal.
export function parseProductsInput(v: string): MicrositeProduct[] {
  return sanitizeProducts(
    String(v ?? "")
      .split("\n")
      .map((line) => {
        const [name = "", price = "", image = "", description = ""] = line.split("|").map((s) => s.trim())
        return { name, price: Number(price.replace(",", ".").replace(/[^\d.]/g, "")), image, description }
      })
  )
}

// Inverso de parseProductsInput, para precargar el editor.
export function productsToInput(products: MicrositeProduct[]): string {
  return sanitizeProducts(products)
    .map((p) => [p.name, p.price > 0 ? String(p.price) : "", p.image, p.description].join(" | ").replace(/( \| )+$/, ""))
    .join("\n")
}

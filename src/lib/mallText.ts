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

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

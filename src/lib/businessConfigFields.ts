// ============================================================
// Registro ÚNICO de los campos escalares "simples" de la configuración del
// negocio (identidad, apariencia y fiscal). Es la fuente de verdad para:
//   - la ruta de guardado (/api/business-config) que los acepta, y
//   - los valores por defecto (lib/orders DEFAULT_BUSINESS_CONFIG).
//
// Antes esto estaba duplicado a mano en varios sitios y se desincronizaba
// (campos que no se guardaban). Agregar un campo aquí lo propaga a ambos lados,
// y un test (businessConfigFields.test.ts) falla si falta el default.
//
// NO incluye campos con permisos por rol/plan ni estructuras complejas
// (módulos, mesas, promociones, etc.): esos siguen con su lógica dedicada.
// ============================================================

export type SimpleConfigFieldType = "string" | "number" | "boolean"

export type SimpleConfigField = {
  key: string
  type: SimpleConfigFieldType
  default: string | number | boolean
  /** Para números: rango permitido (se acota al guardar). */
  min?: number
  max?: number
}

export const SIMPLE_BUSINESS_CONFIG_FIELDS: readonly SimpleConfigField[] = [
  // Identidad
  { key: "businessName", type: "string", default: "" },
  { key: "businessShortDescription", type: "string", default: "Menú y pedidos" },
  { key: "businessType", type: "string", default: "" },
  { key: "locationLabel", type: "string", default: "Mesa" },
  { key: "mainWhatsapp", type: "string", default: "" },
  { key: "deliveryWhatsapp", type: "string", default: "" },
  // Botón público "¿Dudas con tu pedido? Escríbenos" (WhatsApp con mensaje
  // listo preguntando por los pedidos activos). El dueño lo prende o apaga.
  { key: "orderHelpWhatsappEnabled", type: "boolean", default: true },
  // Apariencia (tema)
  { key: "themePrimaryColor", type: "string", default: "#a00000" },
  { key: "themeAccentColor", type: "string", default: "#ffd23c" },
  { key: "themeCreamColor", type: "string", default: "#fff7e8" },
  { key: "productCardBackgroundColor", type: "string", default: "#ffffff" },
  { key: "productCardTextColor", type: "string", default: "#4a0000" },
  { key: "productCardBorderColor", type: "string", default: "#a00000" },
  { key: "productCardButtonColor", type: "string", default: "#ffd23c" },
  // Fiscal (Venezuela)
  { key: "fiscalEnabled", type: "boolean", default: false },
  { key: "rifNumber", type: "string", default: "" },
  { key: "razonSocial", type: "string", default: "" },
  { key: "fiscalAddress", type: "string", default: "" },
  { key: "ivaDefaultRate", type: "number", default: 16, min: 0, max: 100 },
  { key: "pricesIncludeIva", type: "boolean", default: true },
  { key: "igtfEnabled", type: "boolean", default: true },
  { key: "igtfRate", type: "number", default: 3, min: 0, max: 100 },
] as const

function coerceNumber(value: unknown, field: SimpleConfigField): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return field.default as number
  const min = field.min ?? -Infinity
  const max = field.max ?? Infinity
  return Math.min(max, Math.max(min, n))
}

/** Lee un valor crudo y lo normaliza según el tipo del campo (para guardar). */
export function coerceSimpleConfigValue(value: unknown, field: SimpleConfigField) {
  switch (field.type) {
    case "string":
      return String(value ?? "").trim()
    case "number":
      return coerceNumber(value, field)
    case "boolean":
      // Por defecto true → solo false explícito desactiva; default false → solo true activa.
      return field.default === true ? value !== false : value === true
  }
}

// ============================================================
// MARCA / WHITE-LABEL — ÚNICO ARCHIVO A EDITAR POR CLIENTE
// ------------------------------------------------------------
// Para re-marcar el sistema a un negocio nuevo, cambia SOLO los valores de
// aquí (y, si quieres, sube el logo a /public). El nombre que ve el cliente
// final también se puede ajustar en vivo desde "Configuración del negocio"
// (eso vive en la base de datos y sobreescribe el default `BRAND.name`).
//
// Los colores del tema se ajustan en src/app/globals.css (variables
// --brand-*). Aquí va todo lo demás: nombre, contacto, moneda, idioma y zona.
// ============================================================

export const BRAND = {
  /** Nombre del negocio (default si la config en BD viene vacía). */
  name: "Lidotel Valencia",
  /** Nombre corto para títulos/QR. */
  shortName: "Lidotel",
  /** Frase corta de marca. */
  tagline: "Hotel 5 estrellas · Valencia",
  /** Descripción para el menú/landing. */
  description:
    "Confort, gastronomía y atención de primera en el corazón de Valencia. Habitaciones, suites y salones para negocios y placer.",
  /** Logo en /public (déjalo vacío para usar solo texto). */
  logoUrl: "/demo/lidotel/lidotel-logo.png",

  /** Contacto / redes (defaults; la config en BD puede sobreescribir). */
  whatsapp: "582417000399",
  instagram: "lidotel",
  location: "Valencia, Carabobo, Venezuela",

  /** Moneda e idioma. */
  currency: {
    base: "USD",
    secondary: "VES",
    baseSymbol: "$",
    secondarySymbol: "Bs",
    fallbackRate: 500,
    apiUrl: "https://ve.dolarapi.com/v1/dolares/oficial",
    cacheHours: 24,
  },
  locale: "es-VE",
  timezone: "America/Caracas",
}

// Compatibilidad con el código antiguo que importaba `siteConfig`.
export const siteConfig = {
  business: {
    name: BRAND.name,
    tagline: BRAND.tagline,
    whatsapp: BRAND.whatsapp,
    instagram: BRAND.instagram,
    location: BRAND.location,
  },
  currency: BRAND.currency,
}

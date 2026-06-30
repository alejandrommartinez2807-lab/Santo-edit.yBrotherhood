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
  name: "Santo Perrito",
  /** Nombre corto para títulos/QR. */
  shortName: "Santo Perrito",
  /** Frase corta de marca. */
  tagline: "Los Mejores Perros De Valencia",
  /** Descripción para el menú/landing. */
  description:
    "Perros calientes cargados, salchipapas, raciones y bebidas frías.",
  /** Logo en /public (déjalo vacío para usar solo texto). */
  logoUrl: "",

  /** Contacto / redes (defaults; la config en BD puede sobreescribir). */
  whatsapp: "584145827432",
  instagram: "burgerclub.val",
  location: "Valencia, Venezuela",

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

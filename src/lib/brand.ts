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
  name: "Concepto La Granja",
  /** Nombre corto para títulos/QR. */
  shortName: "Concepto",
  /** Frase corta de marca. */
  tagline: "Centro comercial",
  /** Descripción para el menú/landing. */
  description:
    "Portal de comerciantes y panel administrativo del C.C. Concepto La Granja: locales y contratos, canon y condominio, estado de cuenta, mantenimiento, áreas comunes, comunicados y control de acceso en una sola plataforma.",
  /** Logo en /public (déjalo vacío para usar solo texto). */
  logoUrl: "/concepto-logo.png",

  /**
   * Demo estática sin backend (patrón demo-express): las APIs públicas del
   * hotel responden con el contenido de src/lib/hotelDemoSite.ts y la reserva
   * termina en una confirmación simulada. SOLO true en instancias demo por
   * prospecto publicadas con env dummy; en la plantilla base SIEMPRE false.
   */
  demoMode: false,

  /** Contacto / redes (defaults; la config en BD puede sobreescribir). */
  whatsapp: "584120000000",
  instagram: "conceptolg",
  location: "Av. Salvador Feo La Cruz, Naguanagua, Carabobo",

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

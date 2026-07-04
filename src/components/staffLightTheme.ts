import type { CSSProperties } from "react"

// Tema claro del área del staff (/local-santo/** y /acceso).
//
// El sitio público de Brotherhood usa el tema OSCURO global (globals.css:
// --brand-cream ≈ negro, --brand-ink* claros), pero el panel privado está
// escrito completo con la semántica CLARA original (tarjetas bg-white +
// texto var(--brand-ink) oscuro). Sin este override, el panel queda con
// texto claro sobre tarjetas blancas: ilegible.
//
// Estas variables restauran la paleta clara de la marca (naranja + crema +
// tinta) solo dentro del panel. Van inline en el layout anidado, así que
// ganan tanto sobre :root de globals.css como sobre el tema que inyecta
// business_config (<style id="brand-theme">, también a nivel :root).
export const STAFF_LIGHT_THEME_STYLE = {
  "--brand-primary": "#f5a623",
  "--brand-primary-dark": "#d4820a",
  "--brand-primary-rgb": "245, 166, 35",
  "--brand-cream": "#fff7ec",
  "--brand-ink": "#1a1a1a",
  "--brand-ink-2": "#121212",
  "--brand-ink-3": "#0a0a0a",
  "--brand-amber": "#b3730a",
  "--brand-accent": "#ffb340",
  "--brand-accent-200": "#ffc766",
  "--brand-accent-100": "#ffe1b0",
  "--brand-accent-rgb": "255, 179, 64",
  // Equivalentes claros de las superficies oscuras del sitio público, por si
  // algún componente compartido las usa dentro del panel.
  "--brand-surface": "#ffffff",
  "--brand-surface-2": "#fff1d9",
  "--brand-border": "#f0dfc2",
  // El body global es oscuro con texto blanco; el área del staff se cubre
  // completa con su propio fondo y color de texto.
  background: "#fff7ec",
  color: "#1a1a1a",
  minHeight: "100vh",
} as CSSProperties

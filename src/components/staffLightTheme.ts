import type { CSSProperties } from "react"

// Tema claro del área del staff (/local-santo/** y /acceso).
//
// El panel privado está escrito con semántica CLARA (tarjetas bg-white +
// texto var(--brand-ink) oscuro). Este override fija la paleta champán del
// hotel dentro del panel, por encima de :root de globals.css y del tema que
// inyecta business_config (<style id="brand-theme">, también a nivel :root):
// así el staff SIEMPRE ve el panel 5★ del hotel aunque el dueño personalice
// los colores del menú público.
export const STAFF_LIGHT_THEME_STYLE = {
  // Primary del panel: oro champán PROFUNDO (#7d6230 ≈ 5.7:1 sobre blanco)
  // porque el panel lo usa como color de TEXTO y bordes sobre fondos claros;
  // el champán medio del sitio público (#b08d4c) no llega a 4.5:1 para texto
  // pequeño. El champán claro vive en --brand-accent (fondos de botones/chips
  // con texto oscuro encima).
  "--brand-primary": "#7d6230",
  "--brand-primary-dark": "#5c481f",
  "--brand-primary-rgb": "125, 98, 48",
  "--brand-cream": "#faf8f3",
  "--brand-ink": "#2a2620",
  "--brand-ink-2": "#4d4433",
  "--brand-ink-3": "#171410",
  "--brand-amber": "#8a6a2a",
  "--brand-accent": "#e6cf9a",
  "--brand-accent-200": "#efe0ba",
  "--brand-accent-100": "#f7efdb",
  "--brand-accent-rgb": "230, 207, 154",
  // Superficies del panel: blanco + marfil suave, mismos tonos que el sitio
  // público del hotel para que todo sea una sola familia visual.
  "--brand-surface": "#ffffff",
  "--brand-surface-2": "#f7f2e7",
  "--brand-border": "#e3dac4",
  // El área del staff se cubre completa con su propio fondo y color de texto.
  background: "#faf8f3",
  color: "#2a2620",
  minHeight: "100vh",
} as CSSProperties

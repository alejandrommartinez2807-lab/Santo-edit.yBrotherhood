import type { CSSProperties } from "react"

// Paleta editorial FIJA del sitio público del hotel (/hotel/**): marfil cálido
// + oro champán, igual que :root de globals.css. Va inline en el layout del
// hotel para que gane sobre el tema que inyecta business_config a :root
// (<style id="brand-theme">): la "Personalización" del dueño re-pinta el menú
// de room service (/carta), nunca la landing 5★ del hotel.
export const HOTEL_PUBLIC_THEME_STYLE = {
  "--brand-primary": "#b08d4c",
  "--brand-primary-dark": "#7d6230",
  "--brand-primary-rgb": "176, 141, 76",
  "--brand-cream": "#faf8f3",
  "--brand-ink": "#2a2620",
  "--brand-ink-2": "#4d4433",
  "--brand-ink-3": "#171410",
  "--brand-amber": "#c8a35f",
  "--brand-accent": "#b08d4c",
  "--brand-accent-200": "#c8a35f",
  "--brand-accent-100": "#eadfc3",
  "--brand-accent-rgb": "176, 141, 76",
  "--brand-surface": "#ffffff",
  "--brand-surface-2": "#f1e9d7",
  "--brand-border": "#ddd0b6",
  background: "#faf8f3",
  color: "#2a2620",
  minHeight: "100vh",
} as CSSProperties

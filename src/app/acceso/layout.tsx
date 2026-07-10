import type { ReactNode } from "react"
import { STAFF_LIGHT_THEME_STYLE } from "@/components/staffLightTheme"

// La pantalla de acceso del personal usa el mismo tema claro que el panel
// (/local-santo): ver src/components/staffLightTheme.ts.
export default function AccesoLayout({ children }: { children: ReactNode }) {
  return <div style={STAFF_LIGHT_THEME_STYLE}>{children}</div>
}

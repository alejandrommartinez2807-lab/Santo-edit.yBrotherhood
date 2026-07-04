import type { ReactNode } from "react"
import { STAFF_LIGHT_THEME_STYLE } from "@/components/staffLightTheme"

// El panel del staff conserva su tema claro original aunque el sitio público
// sea oscuro: ver src/components/staffLightTheme.ts.
export default function LocalSantoLayout({ children }: { children: ReactNode }) {
  return <div style={STAFF_LIGHT_THEME_STYLE}>{children}</div>
}

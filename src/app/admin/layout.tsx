import { STAFF_LIGHT_THEME_STYLE } from "@/components/staffLightTheme"

// El panel privado SIEMPRE usa la paleta champán del hotel, aunque el dueño
// personalice los colores del menú público (tema de business_config a :root).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div style={STAFF_LIGHT_THEME_STYLE}>{children}</div>
}

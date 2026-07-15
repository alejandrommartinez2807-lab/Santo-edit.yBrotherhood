import { STAFF_LIGHT_THEME_STYLE } from "@/components/staffLightTheme"

// /pedidos es el mismo panel que /admin (redirige allá): misma paleta fija.
export default function PedidosLayout({ children }: { children: React.ReactNode }) {
  return <div style={STAFF_LIGHT_THEME_STYLE}>{children}</div>
}

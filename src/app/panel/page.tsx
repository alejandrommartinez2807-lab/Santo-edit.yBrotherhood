import type { Metadata } from "next"
import PanelApp from "./PanelApp"

export const metadata: Metadata = {
  title: "Panel · Concepto La Granja",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default function PanelPage() {
  return <PanelApp />
}

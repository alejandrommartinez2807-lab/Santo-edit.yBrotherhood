import type { Metadata } from "next"
import MiCuenta from "./MiCuenta"

export const metadata: Metadata = {
  title: "Mi cuenta · Concepto La Granja",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default function MiCuentaPage() {
  return <MiCuenta />
}

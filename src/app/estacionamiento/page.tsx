import type { Metadata } from "next"
import { BRAND } from "@/lib/brand"
import ParkingApp from "./ParkingApp"

export const metadata: Metadata = { title: `Estacionamiento · ${BRAND.name}` }
export const dynamic = "force-dynamic"

// El cliente maneja todo desde el teléfono, sin caja y sin cuenta:
//   · "Acabo de llegar" → genera su propio ticket/QR (POST checkin).
//   · "Ya tengo un ticket" → consulta el monto y registra su pago (POST pay).
// El QR de entrada del centro comercial apunta a /estacionamiento?new=1.
export default async function ParkingPage({ searchParams }: { searchParams: Promise<{ code?: string; new?: string }> }) {
  const sp = await searchParams
  const code = String(sp.code ?? "").trim().toUpperCase()
  const startNew = String(sp.new ?? "") === "1"

  return (
    <ParkingApp
      initialCode={code}
      startNew={startNew}
      whatsapp={BRAND.whatsapp}
      brandName={BRAND.name}
      logo="/concepto-logo.png"
    />
  )
}

import type { Metadata } from "next"
import { BRAND } from "@/lib/brand"
import PosterQr from "./PosterQr"

export const metadata: Metadata = {
  title: `Póster QR del estacionamiento · ${BRAND.name}`,
  robots: { index: false, follow: false },
}

// Póster imprimible para pegar en la entrada del estacionamiento: el visitante
// escanea el QR y genera su propio ticket (/estacionamiento?new=1).
export default function ParkingQrPage() {
  return <PosterQr brandName={BRAND.name} logo="/concepto-logo.png" />
}

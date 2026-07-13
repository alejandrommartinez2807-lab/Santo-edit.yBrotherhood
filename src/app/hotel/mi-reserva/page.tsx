import PublicComingSoon from "@/components/PublicComingSoon"

// Portal del huésped (Fase 10 · ver docs/ROADMAP-HOTEL-COMPLETO.md).
export default function HotelMiReservaPage() {
  return (
    <PublicComingSoon
      title="Mi reserva"
      description="Consulta, modifica o cancela tu reserva y haz tu check-in en línea con tu código de reserva. Muy pronto disponible."
      backHref="/hotel"
      backLabel="Volver al hotel"
    />
  )
}

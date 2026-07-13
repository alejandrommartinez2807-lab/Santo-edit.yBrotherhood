import PublicComingSoon from "@/components/PublicComingSoon"

// Motor de reservas público (Fase 8 · ver docs/ROADMAP-HOTEL-COMPLETO.md).
export default function HotelReservarPage() {
  return (
    <PublicComingSoon
      title="Reservar en línea"
      description="Elige tus fechas, mira las habitaciones disponibles con su precio y confirma tu reserva. Esta función estará disponible muy pronto."
      backHref="/hotel"
      backLabel="Volver al hotel"
    />
  )
}

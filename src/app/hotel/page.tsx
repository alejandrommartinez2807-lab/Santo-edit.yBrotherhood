import PublicComingSoon from "@/components/PublicComingSoon"

// Landing pública del hotel (Fase 11 · ver docs/ROADMAP-HOTEL-COMPLETO.md).
export default function HotelLandingPage() {
  return (
    <PublicComingSoon
      title="Nuestro hotel"
      description="Muy pronto podrás ver las habitaciones, amenidades y políticas, y reservar tu estadía en línea."
      backHref="/hotel/reservar"
      backLabel="Reservar"
    />
  )
}

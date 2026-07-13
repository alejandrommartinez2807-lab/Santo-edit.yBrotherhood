import ModuleComingSoon from "@/components/ModuleComingSoon"

export default function Page() {
  return (
    <ModuleComingSoon
      title="Reservas online"
      phase="Fase 8"
      description="Motor de reservas publico: el huesped elige fechas, ve disponibilidad y precio por temporada, y reserva."
      bullets={[
    "Reutiliza quoteStay (precio) y la logica de solapes (disponibilidad)",
    "API publica de disponibilidad y reserva",
    "Se gestiona desde aqui; la pagina publica vivira en /hotel/reservar",
      ]}
    />
  )
}

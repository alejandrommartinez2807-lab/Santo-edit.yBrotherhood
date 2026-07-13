import ModuleComingSoon from "@/components/ModuleComingSoon"

export default function Page() {
  return (
    <ModuleComingSoon
      title="Canales / OTAs"
      phase="Fase 17"
      description="Sincroniza disponibilidad y tarifas con Booking, Expedia y Airbnb."
      bullets={[
    "Mapeo de tipos de habitacion por canal",
    "iCal de ida y vuelta para el MVP",
      ]}
    />
  )
}

import ModuleComingSoon from "@/components/ModuleComingSoon"

export default function Page() {
  return (
    <ModuleComingSoon
      title="Calendario (tape chart)"
      phase="Fase 14"
      description="Grilla habitaciones x dias con arrastrar y soltar para ver la ocupacion de un vistazo."
      bullets={[
    "Sin tablas nuevas: deriva de reservas + habitaciones",
    "Reutiliza la logica de solapes",
      ]}
    />
  )
}

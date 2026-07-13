import ModuleComingSoon from "@/components/ModuleComingSoon"

export default function Page() {
  return (
    <ModuleComingSoon
      title="Paquetes / todo incluido"
      phase="Fase 23"
      description="Habitacion + comidas + actividades vendidas como un solo producto."
      bullets={[
    "Genera los cargos/servicios asociados al reservar",
    "Base para all-inclusive",
      ]}
    />
  )
}

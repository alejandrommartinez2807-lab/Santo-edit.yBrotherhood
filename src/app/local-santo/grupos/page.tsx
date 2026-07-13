import ModuleComingSoon from "@/components/ModuleComingSoon"

export default function Page() {
  return (
    <ModuleComingSoon
      title="Grupos y bloqueos"
      phase="Fase 20"
      description="Reservas de grupo (varias habitaciones, un titular) y bloqueo por eventos."
      bullets={[
    "Titular y notas del grupo",
    "Bloqueo de habitaciones por rango",
      ]}
    />
  )
}

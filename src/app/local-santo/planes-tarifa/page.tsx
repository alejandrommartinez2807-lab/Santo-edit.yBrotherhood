import ModuleComingSoon from "@/components/ModuleComingSoon"

export default function Page() {
  return (
    <ModuleComingSoon
      title="Planes de tarifa"
      phase="Fase 18"
      description="Planes (con desayuno, no reembolsable) y restricciones (estancia minima, cerrado a llegada)."
      bullets={[
    "Extiende las tarifas por temporada",
    "Precios dinamicos",
      ]}
    />
  )
}

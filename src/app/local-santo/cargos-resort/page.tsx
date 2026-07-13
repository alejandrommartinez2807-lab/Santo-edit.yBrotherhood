import ModuleComingSoon from "@/components/ModuleComingSoon"

export default function Page() {
  return (
    <ModuleComingSoon
      title="Cargo resort a habitacion"
      phase="Fase 22"
      description="Cargar consumo desde cualquier punto del resort (bar, spa, tienda) a la habitacion."
      bullets={[
    "Reutiliza el patron POS a folio en varios outlets",
    "Identificacion por pulsera/QR de la estadia",
      ]}
    />
  )
}

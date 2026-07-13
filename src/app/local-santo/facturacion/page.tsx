import ModuleComingSoon from "@/components/ModuleComingSoon"

export default function Page() {
  return (
    <ModuleComingSoon
      title="Facturacion fiscal"
      phase="Fase 16"
      description="Factura legal (SENIAT/impuestos), notas de credito y series sobre el folio."
      bullets={[
    "Genera PDF de la factura",
    "Series y numeracion fiscal",
      ]}
    />
  )
}

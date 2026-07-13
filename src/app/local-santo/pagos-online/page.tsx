import ModuleComingSoon from "@/components/ModuleComingSoon"

export default function Page() {
  return (
    <ModuleComingSoon
      title="Pagos online"
      phase="Fase 9"
      description="Cobro de deposito o total al reservar, conciliado con el folio."
      bullets={[
    "Pago movil, Zelle, transferencia o Stripe",
    "Credenciales de pasarela solo en el servidor",
      ]}
    />
  )
}

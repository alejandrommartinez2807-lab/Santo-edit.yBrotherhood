import ModuleComingSoon from "@/components/ModuleComingSoon"

export default function Page() {
  return (
    <ModuleComingSoon
      title="Portal del huesped"
      phase="Fase 10"
      description="El huesped ve, modifica o cancela su reserva, hace check-in online y consulta su cuenta."
      bullets={[
    "Acceso por codigo de reserva + email/telefono (sin contrasena)",
    "Folio en solo-lectura para el huesped",
      ]}
    />
  )
}

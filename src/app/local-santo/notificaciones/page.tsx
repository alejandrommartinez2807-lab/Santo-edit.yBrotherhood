import ModuleComingSoon from "@/components/ModuleComingSoon"

export default function Page() {
  return (
    <ModuleComingSoon
      title="Notificaciones"
      phase="Fase 12"
      description="Confirmacion, recordatorio y post-estadia automaticos por email/WhatsApp."
      bullets={[
    "Registro para no duplicar envios",
    "Infraestructura reutilizada por portal y resenas",
      ]}
    />
  )
}

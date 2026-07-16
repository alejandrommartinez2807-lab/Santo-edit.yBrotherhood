# Respaldo y restauración (P3-I)

Qué se respalda en el PMS hotelero, cada cuánto, y cómo se restaura.

## Qué se respalda

Toda la operación vive en la base PostgreSQL gestionada por Supabase
(proyecto propio del hotel):

- Reservas, folios y cargos/pagos (`hotel_reservations`, `folios`, `folio_items`)
- Huéspedes y CRM (`guests`, `guest_profiles`, `memberships`, `guest_memberships`)
- Facturas y cierres (`invoices`, `business_days`)
- Habitaciones, tipos, bloqueos, tarifas (`rooms`, `room_types`, `room_blocks`,
  `rate_seasons`, `rate_restrictions`)
- POS: pedidos, menú, inventario, gastos, proveedores
- Configuración del negocio (`business_config`), usuarios del staff, webhooks,
  turnos (`staff_shifts`)
- **Storage**: fotos de habitaciones y comprobantes de pago (buckets de
  Supabase Storage)

No hay datos que vivan solo en el dispositivo: la cola offline del staff se
sincroniza contra la base al recuperar conexión.

## Cada cuánto

- **Supabase genera respaldos automáticos diarios** de la base (retención
  según el plan del proyecto; ver Dashboard → Database → Backups).
- El **export total** (CSV por secciones) lo puede descargar el dueño cuando
  quiera desde **Configuración → Respaldo y datos** (o
  `GET /api/accounting-exports?type=full&from=&to=`). Recomendado: uno al
  cierre de cada mes, guardado con los documentos contables.

## Cómo se restaura

1. Entrar al Dashboard de Supabase del proyecto del hotel → **Database →
   Backups**.
2. Elegir el respaldo diario más reciente anterior al incidente y ejecutar
   **Restore**. (En planes con PITR se puede elegir el minuto exacto.)
3. Verificar tras la restauración: abrir `/admin`, revisar "El hotel hoy",
   Caja recepción y las reservas de la semana.
4. Si el incidente fue de Storage (fotos/comprobantes), esos archivos se
   restauran por separado desde el respaldo de Storage o re-subiendo los
   archivos; la base guarda las URLs.

## Qué NO cubre el respaldo automático

- Los secretos del proyecto (`.env.local` / variables de Vercel): guardarlos
  en un gestor de contraseñas.
- El código: vive en el repositorio git (rama `demo-lidotel` para la
  plantilla hotel).

## Simulacro recomendado (cada 6 meses)

1. Descargar el export total y abrirlo en Excel: ¿están las reservas y
   facturas del mes?
2. En un proyecto Supabase de prueba, restaurar el último respaldo y apuntar
   un deploy de prueba a ese proyecto.
3. Confirmar login del staff + una reserva de prueba end-to-end.

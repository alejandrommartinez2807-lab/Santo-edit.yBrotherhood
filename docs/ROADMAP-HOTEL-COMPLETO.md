# Roadmap del Hotel/Resort — de PMS interno a plataforma completa

Estado a 2026-07-13: **Fases 1–7 completas** (núcleo, reservas, folio, POS↔folio,
housekeeping, tarifas por temporada, reportes). Este documento estructura lo que
falta para que sea un **sistema tanto público (cara al huésped) como interno**
para hoteles y resorts. Cada bloque es una fase futura con: objetivo, tablas
nuevas propuestas, ruta/módulo, qué reutiliza y dependencias.

> El esqueleto de estos módulos ya está en la app como **"Próximamente"**
> (comingSoon) — aparecen reservados en el registro y su página muestra un
> placeholder. Construir una fase = cambiar `comingSoon: false`, agregar
> `ownerConfigKey` + cableado de config, y reemplazar el placeholder por la
> pantalla real (ver checklist en [[santo-edit-hotel-pms-build]]).

## Principios (no romper)
- **Producto separado**: Supabase (`edxbuggbqcrsaynxysuj`) + Vercel propios. No
  toca Santo/Brotherhood.
- **Migraciones aditivas**: nunca alteran tablas del restaurante; el usuario las
  aplica (yo escribo el `.sql`).
- **Aislamiento por `branch_id`** (= propiedad) en toda tabla y query.
- **Lógica pura y testeable** para todo cálculo (como `rateSeasons.ts`,
  `hotelReports.ts`, `hotelReservationConflicts.ts`).
- Orden sugerido: primero lo PÚBLICO (desbloquea venta), luego calidad interna,
  luego resort.

---

## BLOQUE A — Público (cara al huésped)

### Fase 8 · Motor de reservas online (booking engine) 🔑
**Objetivo:** el huésped elige fechas → ve tipos disponibles + precio con
temporada → reserva (con o sin pago).
**Reutiliza:** `quoteStay` (precio), `findRoomStayConflict`/`stayRangesOverlap`
(disponibilidad), y el patrón de checkout público del restaurante (`/reservar`,
`/pago`).
**Rutas:** pública `/hotel/reservar` (+ `/hotel` landing) · gestión staff
`/local-santo/reservas-online` (módulo `bookingEngine`).
**Tablas nuevas:** ninguna imprescindible (usa `hotel_reservations` con
`source='web'`). Opcional `booking_policies` (política de cancelación, depósito
%, ventana). **API pública** sin clave: `GET /api/public/hotel/availability` y
`POST /api/public/hotel/book` (rate-limit + captcha suave).
**Dependencias:** conviene junto a Fase 9 (pago) y 12 (notificaciones).

### Fase 9 · Pagos / depósito online
**Objetivo:** cobrar depósito o total al reservar; conciliar con el folio.
**Tablas:** `payment_intents` (id, reservation_id, provider, amount, currency,
status, external_ref, created_at). **Integración:** pago móvil / Zelle /
transferencia (comprobante) y/o Stripe para turistas. Webhook →
`folio_items` (pago).
**Rutas:** `/local-santo/pagos-online` (módulo `onlinePayments`) para conciliar.
**Nota de seguridad:** las credenciales de la pasarela son server-only; el
cliente nunca ve llaves. Reusa el patrón "reportar mi pago" (Bs/tasa) que ya
existe.

### Fase 10 · Portal del huésped
**Objetivo:** el huésped ve/modifica/cancela su reserva, hace **check-in online**
y consulta su cuenta (folio en solo-lectura).
**Acceso:** enlace mágico por código de reserva + email/teléfono (sin cuenta con
contraseña — respeta la regla de no crear cuentas). Tabla opcional
`guest_portal_tokens` (token, reservation_id, expires_at).
**Rutas:** pública `/hotel/mi-reserva` · módulo staff `guestPortal`.

### Fase 11 · Página del hotel (landing)
**Objetivo:** landing pública: fotos, amenidades, mapa, políticas (check-in 3pm /
out 12pm), galería por tipo de habitación, CTA a reservar.
**Tablas:** `hotel_profile` (branch_id, descripción, amenidades, políticas,
coords, galería[]) — o reusar campos de `branches` + storage de imágenes.
**Rutas:** pública `/hotel` · módulo staff `hotelLanding` (editor de contenido).

### Fase 12 · Notificaciones (confirmación / recordatorio / post-estadía)
**Objetivo:** email/WhatsApp automáticos en confirmación, recordatorio y tras el
check-out.
**Infra:** proveedor de email (Resend/SMTP) y WhatsApp (Meta/Twilio). Tabla
`notification_log` (channel, reservation_id, template, status, sent_at) para no
duplicar. **Cola** ligera (cron o al vuelo). Módulo `guestNotifications`.

### Fase 13 · Reseñas post-checkout
**Objetivo:** valoración 1–5 + comentario tras la estadía; promedio por hotel.
**Tablas:** `guest_reviews` (reservation_id, rating, comment, created_at,
published). Módulo `guestReviews`. **Multi-idioma/multi-moneda** se aborda aquí y
en Fase 8/11 (clave para resort internacional).

---

## BLOQUE B — Interno de "hotel serio"

### Fase 14 · Calendario visual (tape chart)
**Objetivo:** grilla habitaciones × días con arrastrar-y-soltar; lo que recepción
más pide. **Sin tablas nuevas** (deriva de `hotel_reservations` + `rooms`).
Reutiliza la lógica de solapes. Módulo `tapeChart` → `/local-santo/calendario`.

### Fase 15 · Cierre de día (night audit)
**Objetivo:** proceso que cierra la jornada: consolida cargos del día, rueda la
fecha de negocio, publica el cargo de habitación por noche a los in-house.
**Tablas:** `business_days` (branch_id, date, closed_at, totals). Módulo
`nightAudit`.

### Fase 16 · Facturación fiscal
**Objetivo:** factura legal (SENIAT/impuestos), notas de crédito, series.
**Tablas:** `invoices` (folio_id, serie, número, rif, subtotal, iva, total,
status, pdf_url), `invoice_items`. Módulo `fiscalInvoicing`. Genera PDF (skill
`pdf` disponible).

### Fase 17 · Channel manager / OTAs
**Objetivo:** sincronizar disponibilidad y tarifas con Booking/Expedia/Airbnb.
**Tablas:** `channel_mappings` (channel, room_type_id, external_id),
`channel_sync_log`. **Integración** vía API del canal o un iCal de ida y vuelta
para el MVP. Módulo `channelManager`. (Se dejó fuera al inicio a propósito.)

### Fase 18 · Tarifas avanzadas (planes y restricciones)
**Objetivo:** planes de tarifa (con desayuno, no reembolsable), restricciones
(estancia mínima, cerrado a llegada/salida), precios dinámicos.
**Tablas:** `rate_plans` (name, room_type_id, incluye_desayuno, reembolsable,
deriva_de, ajuste), `rate_restrictions` (room_type_id, date, min_stay, cta, ctd).
Extiende `rate_seasons`. Módulo `advancedRates`.

### Fase 19 · CRM / fidelización
**Objetivo:** histórico y preferencias del huésped, puntos, segmentación,
campañas. **Tablas:** `guest_profiles` (extiende `guests`: preferencias, notas,
puntos, tags), `loyalty_ledger`, `campaigns`. Módulo `guestCrm`.

### Fase 20 · Grupos y bloqueos
**Objetivo:** reservas de grupo (varias habitaciones, un titular) y bloqueo de
habitaciones por eventos/mantenimiento largo. **Tablas:** `reservation_groups`
(titular, notas), `room_blocks` (room_id, from, to, motivo). Módulo
`groupBookings`.

---

## BLOQUE C — Específico de resort

### Fase 21 · Servicios y actividades reservables
**Objetivo:** spa, tours, restaurante con reserva, alquiler, clases — con cupo y
horario. **Tablas:** `resort_services` (name, tipo, precio, cupo, duración),
`service_bookings` (service_id, guest_id/reservation_id, fecha, estado). Módulo
`resortServices`.

### Fase 22 · Cargo a habitación en todo el resort
**Objetivo:** cargar consumo desde cualquier punto (bar, spa, tienda) a la
habitación con firma o **pulsera/QR** del huésped. **Reutiliza** el patrón
`chargeOrder` (POS→folio) extendido a varios outlets. **Tablas:** `outlets`
(name, tipo) + `folio_items.outlet_id`. Identificación por QR de la estadía.
Módulo `resortCharges`.

### Fase 23 · Paquetes / todo incluido
**Objetivo:** vender habitación + comidas + actividades como un producto.
**Tablas:** `packages` (name, incluye[], precio), `package_components`. Al
reservar un paquete se generan los cargos/servicios asociados. Módulo
`hotelPackages`.

---

## Transversal (aplica a varias fases)
- **Pagos reales + conciliación** (Fase 9) y **facturación** (Fase 16) son la
  columna financiera.
- **Notificaciones** (Fase 12) son infraestructura reutilizada por portal,
  reservas y reseñas.
- **Seguridad/datos:** RLS ya cerrado; falta backups programados y política de
  retención de datos del huésped.
- **Roles:** hoy owner/manager/support ven los módulos; al construir cada fase,
  decidir si recepción/ama de llaves la usan (ver `localAccess.ts`).

## Orden recomendado
1. **8 + 9 + 12** (reservas online + pago + notificaciones) → convierte el PMS en
   producto "público + interno" vendible.
2. **14** (tape chart) → percepción de sistema profesional para recepción.
3. **10 + 11** (portal + landing) → experiencia completa del huésped.
4. **16, 18, 19** (facturación, tarifas avanzadas, CRM) → robustez interna.
5. **17** (channel manager) y **BLOQUE C** (resort) → escalar a resort/cadena.

Antes de todo esto: **configurar el demo Lidotel** y el **deploy propio** para
poder mostrarlo/venderlo.

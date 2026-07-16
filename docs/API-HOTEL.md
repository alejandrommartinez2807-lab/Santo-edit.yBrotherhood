# API del PMS hotelero (P2-E)

Referencia práctica de los endpoints del hotel para integradores. Base URL:
la del deploy (ej. `https://hotel-valencia.vercel.app`) o `http://localhost:3000`
en desarrollo.

## Autenticación

- **Endpoints públicos** (`/api/public/hotel*`): sin clave. Tienen rate-limit
  por IP; úsalos con moderación.
- **Endpoints privados** (todo lo demás): header `x-admin-password` con la
  clave del rol (dueño, gerente, caja…). Cada endpoint valida rol + módulo
  activo; una clave sin permiso recibe `401/403`.
- Las mutaciones privadas exigen un `Origin` coherente con el sitio.

```bash
# Ejemplo privado: listar habitaciones
curl -s "$BASE/api/rooms" \
  -H "x-admin-password: $CLAVE" \
  -H "Origin: $BASE"
```

## Endpoints públicos (huésped)

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/public/hotel?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD` | Disponibilidad por tipo (cupo, fotos, tarifa cotizada, extras ofrecidos) |
| POST | `/api/public/hotel` | Crear reserva (ver campos abajo) |
| POST | `/api/public/hotel/lookup` | Consultar reserva por `{ code, phone }` (últimos 4 dígitos) |
| POST | `/api/public/hotel/pay` | Reportar un abono de la reserva `{ code, phone, method, amount, reference, proofUrl? }` |
| POST | `/api/public/hotel/review` | Dejar reseña `{ code, phone, stars, comment }` |
| GET | `/api/public/hotel/profile` | Ficha pública del hotel (landing) |
| GET | `/api/public/hotel/ical` | Feed iCal (text/calendar) de fechas ocupadas |
| POST | `/api/public/hotel/services` | Reservar un servicio/actividad del resort |

### Crear reserva (POST `/api/public/hotel`)

```bash
curl -s -X POST "$BASE/api/public/hotel" \
  -H "Content-Type: application/json" \
  -d '{
    "checkIn": "2026-09-21",
    "checkOut": "2026-09-23",
    "roomTypeId": "<uuid del GET de disponibilidad>",
    "guestName": "Ana Pérez",
    "guestPhone": "04141234567",
    "termsAccepted": true,
    "membershipCode": "PASE-XXXXX"
  }'
```

- `termsAccepted: true` es **obligatorio** (400 si falta).
- Campos extra (`documentNumber`, `email`, `address`, `arrivalTime`,
  `requests`) según lo que el dueño configuró como visible/obligatorio.
- `membershipCode` (opcional): código de membresía o pase de invitado; aplica
  el descuento **sugerido** y registra el referido.
- Respuestas: `201` con `{ reservation: { code, … } }` · `409` sin
  disponibilidad o restricción de venta · `400` validación.

## Endpoints privados principales (staff)

| Método | Ruta | Qué hace |
|---|---|---|
| GET/POST | `/api/rooms` · `/api/rooms/[id]` | Tipos y habitaciones |
| GET/POST | `/api/hotel-reservations` · PATCH/DELETE `/api/hotel-reservations/[id]` | Reservas por rango; PATCH cambia estado (`confirmada`, `checkin`, `checkout`, `cancelada`, `no_show`) |
| GET/POST | `/api/folios` (acciones `open`, `charge`, `payment`, `chargeOrder`, `chargeService`, `deleteItem`, `close`) | Folio del huésped; `open` hace check-in, `close` hace check-out |
| GET | `/api/folios/summary` | Vista de caja recepción (en casa, llegadas, salidas, depósitos) |
| GET/POST | `/api/reservation-payments` (acciones `create`, `status`) | Depósitos reportados → confirmar/rechazar |
| GET/POST | `/api/housekeeping` | Tablero de limpieza |
| GET/POST | `/api/rate-seasons` · `/api/rate-restrictions` | Tarifas por temporada y restricciones de venta |
| GET | `/api/hotel-reports?from=&to=` | KPIs (ocupación, ADR, RevPAR, ingresos) |
| GET/POST | `/api/memberships` (acciones `saveMembership`, `deleteMembership`, `assign`, `deleteGuestMembership`) | Membresías y pases |
| GET/POST | `/api/guest-profiles` (+ `?view=campaigns`, acción `saveCampaignTemplates`) | CRM y campañas segmentadas |
| GET/POST | `/api/webhooks` (acciones `save`, `delete`, `test`) | Webhooks salientes (este documento, abajo) |
| GET/POST | `/api/resort-services` · `/api/packages` · `/api/reviews` · `/api/invoices` · `/api/night-audit` | Resort, paquetes, reseñas, facturación, cierre de día |
| GET | `/api/accounting-exports?type=sales|closures|full&from=&to=` | CSV contables (libro de ventas, cierres, export total) |
| GET/POST | `/api/odoo` (acciones `saveConfig`, `testConnection`, `sync` con `dryRun`) | Conector Odoo: conexión + sincronización de un botón (huéspedes, productos, reservas, facturas, pagos) |
| GET/POST | `/api/provider-integrations` (`providerId`, `status`, `notes`) | Estado de las conexiones con proveedores externos (fiscal/OTA/C2P/email; sin secretos) |

## Webhooks salientes

Regístralos en **Panel → Integraciones** (o `POST /api/webhooks`). El hotel
enviará un `POST` JSON a tu URL en cada evento seleccionado (lista vacía =
todos los eventos).

**Eventos:** `reserva_creada` · `reserva_confirmada` · `pago_confirmado` ·
`checkin` · `checkout` (y `prueba` desde el botón "Probar").

**Headers de cada entrega:**

- `x-hotel-event`: nombre del evento.
- `x-hotel-signature`: HMAC-SHA256 en hexadecimal del cuerpo crudo, calculado
  con el secreto del webhook. Verifícalo antes de confiar en el payload.

**Cuerpo:**

```json
{
  "event": "reserva_creada",
  "firedAt": "2026-07-16T14:03:22.101Z",
  "data": {
    "code": "AB3K9",
    "guestName": "Ana Pérez",
    "checkIn": "2026-09-21",
    "checkOut": "2026-09-23",
    "nights": 2,
    "roomType": "Doble",
    "totalAmount": 150,
    "source": "web"
  }
}
```

**Verificación de firma (Node):**

```js
const crypto = require("crypto")
const expected = crypto.createHmac("sha256", SECRETO).update(rawBody, "utf8").digest("hex")
const valid = expected === req.headers["x-hotel-signature"]
```

**Semántica de entrega:** *at-least-once, best-effort*. No hay reintentos
automáticos; un evento puede repetirse si la misma transición ocurre por dos
caminos (ej. check-in por PATCH y por apertura de folio). Deduplica por
`event + data.code`. Timeout de entrega: 5 s. El último resultado por webhook
queda visible en el panel (`last_status`).

**Prueba rápida:** crea un endpoint en <https://webhook.site>, regístralo en
Integraciones y pulsa "Probar".

**Campos extra por evento:** `pago_confirmado` incluye además `paymentId`,
`reservationId`, `reservationCode`, `amount`, `method` y `reference` (los ids
permiten deduplicar y conciliar contra `/api/reservation-payments`).

**Odoo como destino (V8-D):** además de los webhooks HTTP, si el módulo Odoo
tiene encendido "Sincronizar en vivo", estos mismos eventos se empujan
directamente a Odoo (reservas → `sale.order`, pagos → `account.payment`),
best-effort con tope de 8 s. No requiere registrar ningún webhook.

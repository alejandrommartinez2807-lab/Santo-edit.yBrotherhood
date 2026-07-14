# Guía del hotelero — autogestión total del PMS

> Todo lo de esta guía se hace **desde el panel** (`/pedidos` → login con tu clave),
> sin programadores. Probado con 25 habitaciones; soporta cientos.

## 1. Cargar habitaciones (aunque sean 60 de una vez)

**Panel → Habitaciones.**

1. Crea los **tipos** primero (Individual, Doble, Suite…): nombre, tarifa por
   noche y capacidad. La tarifa del tipo es la que cotiza la página pública.
2. Usa **"Crear en serie (piso completo)"**: elige el tipo, escribe el rango
   (ej. `501` a `520`), piso y capacidad → un clic crea las 20. Repite por piso.
   Las que ya existan se saltan solas (puedes repetir sin miedo).
3. Una habitación puntual con tarifa distinta: créala individual y ponle
   "Tarifa propia" (vacío = usa la del tipo).
4. En cada habitación puedes: marcar **fuera de servicio** (deja de venderse),
   cambiar estado de limpieza, escribir **notas internas**, y ver quién está
   alojado con su **saldo de folio** y la próxima llegada.

## 2. Galería de fotos por tipo (portada + galería pública)

**Panel → Habitaciones → "Fotos por tipo".**

- Elige el tipo → **"Subir foto"** (desde el teléfono o PC, jpeg/png/webp hasta
  ~5MB) o pega un enlace directo. La **primera** foto es la portada de la
  tarjeta en la página pública; reordena con las flechas.
- Las fotos salen en: tarjeta del tipo (landing), sección "Un vistazo al hotel"
  (galería con visor grande) y miniaturas del motor de reservas.

## 3. Tarifas por temporada y reglas de venta

- **Panel → Tarifas**: crea temporadas (ej. "Carnaval", del X al Y) en modo
  **factor** (×1.30 = +30%) o **tarifa fija**. Se aplican solas al cotizar,
  también en la página pública. Usa "probar una estadía" para verificar.
- **Panel → Planes de tarifa**: estadía mínima y fechas cerradas a llegada o
  salida, por tipo o para todo el hotel. El motor público las respeta (no
  ofrece el tipo y rechaza el intento con el motivo).

## 4. Servicios del resort, paquetes y cargos

- **Panel → Servicios**: catálogo (spa, tours, salón…) con precio y cupo por
  franja. Se muestran en la página pública automáticamente.
- **Panel → Paquetes**: combos estadía+servicios que se aplican a una reserva
  en un clic (cargan al folio).
- **Panel → Cargo resort**: cargar consumos de bar/spa/tienda al folio del
  huésped en casa. El restaurante (POS) también puede cargar pedidos al folio.

## 5. Operación diaria (recepción)

1. **Reservas hotel**: crea/confirma reservas; el buscador acepta el **código
   escaneado del QR** que el huésped recibe al reservar en línea.
2. **Folio**: al hacer check-in se abre el folio con el cargo de habitación;
   agrega consumos y pagos. El **check-out exige saldo $0** (o confirmación
   explícita) y encola la limpieza de salida solo.
3. **Limpieza**: tablero por habitación con tareas y estados.
4. **Bloqueos** (Panel → Grupos): aparta habitaciones por mantenimiento o
   eventos; dejan de venderse en la página pública ese rango.
5. **Cierre de día** y **Reportes hotel** (ocupación, ADR, RevPAR) para el dueño.
6. **Facturación**: factura desde el folio con número correlativo e IVA.

## 6. La página pública (lo que ve el cliente)

- **Panel → Página hotel**: edita titular, descripción, amenidades, contacto y
  horarios. Cambios visibles al instante.
- El cliente: consulta disponibilidad → reserva → recibe **código + QR** → puede
  volver a **Mi reserva** (se recuerda solo en su teléfono) → deja reseña al
  salir. Las reseñas se moderan en **Panel → Reseñas** antes de publicarse.
- Protecciones ya probadas: fechas inválidas/pasadas rechazadas, doble reserva
  imposible (si dos clientes pelean la última habitación, solo uno gana), tipos
  agotados dejan de ofrecerse, límite de reservas por minuto contra abuso.

## 7. Antes de entregar / después de cambios grandes

Corre las dos rondas de QA (73 verificaciones de vida real; limpian sus
datos solas y dejan el hotel exactamente como estaba):

```bash
node scripts/qa-hotel-completo.mjs   # ronda 1: 53 checks (cliente + operación)
node scripts/qa-hotel-ronda2.mjs     # ronda 2: 20 checks de blindaje fino
```

Ambas deben terminar en `🟢`. Requieren el servidor corriendo (`npm run dev`)
y el `.env.local` del hotel en la raíz. Se pueden encadenar (los scripts
respetan solos el límite de reservas públicas por minuto).

## 8. Claves y accesos

Cada rol tiene su clave (recepción/caja, limpieza, gerente, dueño) y solo ve
sus módulos — se administran en **Panel → Usuarios**. El QR de cada reserva y
los QR por mesa/habitación se imprimen desde **Sucursales → Mesas y QR**.

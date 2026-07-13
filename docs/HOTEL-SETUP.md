# Plantilla Hotel (PMS) — Separación total y puesta en marcha

Esta plantilla convierte el sistema (POS restaurante) en un **PMS hotelero**
reutilizando el mismo motor (auth, sedes, caja/dinero, inventario, roles,
white-label) y agregando el módulo hotelero encima (habitaciones, reservas por
noches, folio del huésped, housekeeping, tarifas).

> **Regla de oro:** el hotel es un PRODUCTO SEPARADO. No debe compartir base de
> datos, proyecto de Vercel ni dominio con Santo Perrito ni con Brotherhood.
> Mientras se desarrolla vive en la rama `claude/hotel-template-brotherhood-*`;
> la entrega final es **repo propio + Supabase propio + Vercel propio**.

---

## Por qué esto NO daña a Brotherhood ni a Santo

1. **Rama aislada.** Todo el trabajo del hotel vive en esta rama. `main`
   (Santo Perrito) y `brotherhood-publico` (Brotherhood) no se tocan.
2. **Base de datos nueva y vacía.** Igual que en el rebrand de Brotherhood: en
   una base recién creada, `business_config` arranca vacío `{}`, así que **ganan
   los defaults del código** (la marca/plan del hotel). No se comparte ninguna
   fila con las otras apps.
3. **Migración aditiva.** `0026_hotel_core.sql` solo AGREGA tablas nuevas
   (room_types, rooms, guests, hotel_reservations, folios, folio_items,
   rate_seasons, housekeeping_tasks). No altera ni borra ninguna tabla del
   restaurante, así que aplicarla no rompe una base existente.

---

## Paso a paso para levantar el hotel (lo hace el usuario)

### 1. Crear el proyecto Supabase del hotel
- Nuevo proyecto en supabase.com (nombre sugerido: `hotel-pms`).
- Guardar: `Project URL`, `anon key` y `service_role key`.

### 2. Aplicar el esquema
En el **SQL Editor** de ese proyecto, aplicar en orden las migraciones de
`supabase/migrations/` (de `0001` a la última). Las de restaurante se reutilizan
para el POS interno del hotel (folio ↔ consumo); la del hotel es `0026`.

> Cuando esté estable armo un bundle `supabase/HOTEL-SETUP.sql` (todas las
> migraciones en un solo pegado), igual que se hizo `BROTHERHOOD-SETUP.sql`.

### 3. Variables de entorno del worktree
Copiar `.env.example` a `.env.local` en esta rama y poner las claves del
**Supabase del hotel** (no mezclar con las de Santo/Brotherhood):

```
NEXT_PUBLIC_SUPABASE_URL=...        # URL del proyecto hotel
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # anon key del hotel
SUPABASE_SERVICE_ROLE_KEY=...       # service_role del hotel
```
(+ las contraseñas `ORDERS_*_PASSWORD` para el login del staff, como en las otras apps.)

### 4. Ver la app
`npm run dev` en el worktree. Al ser base nueva, la app arranca como el hotel.

### 5. Deploy final (cuando el producto esté listo)
- Repo propio (o rama protegida) + proyecto Vercel propio del hotel.
- Variables de entorno del hotel en Vercel.
- Dominio propio.
- Mismo patrón que `brotherhood-deploy-manual`: `npx vercel --prod` desde el
  árbol del hotel; nunca desde el de Santo/Brotherhood.

---

## Modelo de datos (migración 0026)

| Tabla | Rol |
|---|---|
| `room_types` | Tipos (Individual/Doble/Suite) + tarifa base por noche |
| `rooms` | Habitaciones; estado de limpieza + fuera de servicio; ocupación derivada de reservas |
| `guests` | Huéspedes / ficha legal (documento, nacionalidad, contacto) |
| `hotel_reservations` | Reservas por **rango de noches**; estados pendiente→checkin→checkout |
| `folios` | Cuenta de la estadía (una por reserva) |
| `folio_items` | Cargos (habitación/restaurante/extras) y pagos; `source_order_id` enlaza el POS |
| `rate_seasons` | Temporadas que sobreescriben la tarifa base por fechas |
| `housekeeping_tasks` | Bitácora de limpieza/mantenimiento por habitación |

Todo con `branch_id` (= propiedad/hotel) y RLS cerrado (solo el servidor).

---

## Roadmap de módulos (orden de construcción)

1. **Habitaciones** — CRUD + tipos + estado de limpieza (base del tape chart).
2. **Reservas por noches** — calendario/tape chart + validación de solape por rango.
3. **Check-in / Check-out** — ficha del huésped + apertura/cierre de folio.
4. **Folio ↔ POS** — el consumo del restaurante carga a la habitación.
5. **Housekeeping** — estados y tareas de limpieza.
6. **Tarifas por temporada** — resolución de precio por fecha/tipo.
7. **Reportes hoteleros** — ocupación, ADR, RevPAR.

Diferenciador de venta: **POS de restaurante integrado al folio** + manejo real
de bolívares / tasa paralela.

# Continuar el demo Lidotel — prompt + backlog (v3 · 2026-07-15)

> **Cómo usar:** copia el bloque "PROMPT" en una sesión nueva de Claude Code
> (abierta en `D:\Santo edit`). El contexto fino vive en las memorias
> `santo-edit-hotel-deploy` y `santo-edit-hotel-pms-build`.

---

## PROMPT (copiar/pegar)

```
Continúo el demo Lidotel del PMS hotelero. Lee primero la memoria
santo-edit-hotel-deploy y santo-edit-hotel-pms-build, y el archivo
docs/CONTINUAR-LIDOTEL.md del worktree del hotel.

Datos clave:
- Worktree: D:/Santo edit/.claude/worktrees/nice-visvesvaraya-5726a1 (rama demo-lidotel).
  NUNCA deployar desde D:\Santo edit (apunta a Brotherhood).
- En vivo: https://hotel-valencia.vercel.app (dominio del proyecto, se actualiza
  solo con cada deploy). Deploy: npx vercel --prod --scope carlos-projects8 desde
  el worktree (autorizado a correrlo Claude; a veces el CLI da ECONNRESET pero el
  build sigue en la nube — verificar con vercel ls + curl, no re-deployar a ciegas).
- Supabase del hotel: edxbuggbqcrsaynxysuj (migraciones 0026-0039 aplicadas).
- Dev: el usuario suele correr npm run dev en 3000; verificar con curl. NUNCA
  correr npm run build con el dev server vivo (comparten .next y se envenena).
- Ver la página: extensión Claude in Chrome (funciona). Claves staff en
  .env.local (ORDERS_*); Claude las usa en headers x-admin-password para QA de
  API, pero NO las teclea en formularios (el login lo prueba el usuario).
- QA: node scripts/qa-hotel-completo.mjs (53 checks) + node scripts/qa-hotel-ronda2.mjs
  (20 checks). Ambos limpian sus datos y deben terminar en verde.

Trabaja el backlog de docs/CONTINUAR-LIDOTEL.md en orden, por fases pequeñas con
commit + verificación por fase, y deploy al final.
```

---

## BACKLOG (en orden) — ✅ TODO HECHO el 2026-07-15 (ver "Estado" abajo)

### 1. Reservar: las habitaciones deben LUCIR (imágenes grandes)
Hoy `/hotel/reservar` muestra una miniatura de 96×64. Rediseñar la tarjeta de
cada tipo: foto grande (h-40+, object-cover, esquina con badge "N fotos"),
galería clicable (reusar el patrón lightbox de la landing), nombre serif,
descripción y precio como en la landing. Móvil primero (la gente reserva del
teléfono).

### 2. Disponibilidad visible: "Quedan X"
El "6 disponibles" está en gris pequeño. Mostrar el cupo claro en la tarjeta:
chip "Quedan 2" (ámbar si ≤3, verde si hay holgura). El dato ya viene
(`freeCount` en `/api/public/hotel`).

### 3. Campos del formulario EDITABLES por el dueño (p. ej. cédula)
El dueño decide qué se pide al reservar:
- Config editable (en `hotel_profile` o `business_config`, editor en
  `/local-santo/pagina-hotel`): activar/desactivar campos extra y si son
  obligatorios: **cédula/documento de identidad**, email obligatorio (hoy es
  opcional), dirección, hora estimada de llegada, solicitudes especiales.
- El booking público (`/hotel/reservar`) renderiza los campos activos y el
  SERVIDOR valida los obligatorios (no solo el cliente).
- Guardar: documento en `guests`/nota de la reserva (campo `note` ya viaja);
  ideal: crear el guest con documentNumber al reservar.

### 4. QR descargable tras reservar
En la confirmación (y en /hotel/mi-reserva) botón **"Descargar QR"**: bajar la
imagen del QR como archivo (fetch → blob → <a download="reserva-CODIGO.png">).
Así el huésped no pierde su código.

### 5. Términos y condiciones con checkbox obligatorio
- Checkbox "He leído y acepto los términos y condiciones" ANTES de confirmar
  la reserva; sin marcar no se envía. El SERVIDOR también exige
  `termsAccepted: true` (400 si falta).
- El texto es EDITABLE por el dueño (campo largo en hotel_profile +
  editor en /local-santo/pagina-hotel; modal o página /hotel/terminos para
  leerlo completo).
- DEFAULT (basado en las políticas estándar de las grandes cadenas — Marriott/
  Hilton/IHG): check-in 15:00 / check-out 12:00; cancelación gratis hasta 48h
  antes de la llegada, después se cobra 1 noche; no-show = cargo de 1 noche;
  edad mínima 18 años para registrarse; documento de identidad obligatorio en
  el check-in; el huésped responde por daños a la habitación; no fumar en
  habitaciones (cargo de limpieza); mascotas solo con autorización previa;
  datos personales usados solo para gestionar la reserva.

### 6. Hotel-ificar los módulos heredados (arrancado, falta terminar)
HECHO: preset "Hotel / Resort" en Configuración (enciende PMS, apaga mesas/
delivery, ubicación="Habitación") + contador de módulos corregido (daba 65/63).
FALTA: pasada por los TEXTOS visibles de Caja, Cocina, Delivery, Menú,
Análisis/Reportes y Clientes para que hablen de hotel/room service cuando
`isHotelFrontDeskVisible` (p. ej. "Delivery" → "Room service / a domicilio",
subtítulos "pedidos del local" → "consumos"); revisar la página de Configuración
logueado (la prueba el usuario) y los QR por habitación (Sucursales → Mesas y QR
sirve, pero el rótulo dice "mesas").

---

## Estado al cierre de la sesión 2026-07-15 (backlog v3 completado)

- **1-2 Reservar**: tarjetas con foto grande (h-44/52) + badge "N fotos · ver
  galería" + lightbox compartido (`src/app/hotel/PhotoLightbox.tsx`), nombre
  serif, descripción, chip "Quedan X" (ámbar ≤3 / verde).
- **3 Campos configurables**: `hotelBookingFields` en business_config (SIN
  migración; el normalizador canónico de ordersBusinessConfig ya lo contempla).
  Editor en Página del hotel (No pedir / Opcional / Obligatorio para cédula,
  email, dirección, hora de llegada, solicitudes). El SERVIDOR valida los
  obligatorios (400) y guarda todo en la nota de la reserva
  (`Documento: … · Dirección: … · Llegada: …`). Lib: `src/lib/hotelBooking.ts`.
- **4 QR descargable**: `src/app/hotel/ReservationQr.tsx` (blob → descarga
  `reserva-CODIGO.png`, fallback abre pestaña) en la confirmación y mi-reserva.
- **5 Términos**: `hotelTermsText` en business_config (vacío ⇒ default estándar
  Marriott/Hilton/IHG en `DEFAULT_HOTEL_TERMS`); checkbox obligatorio en el
  formulario + `termsAccepted: true` exigido por el POST público (400);
  página /hotel/terminos; editor con botón "Usar texto estándar". Los QA
  scripts ya envían termsAccepted (nuevo check B6).
- **6 Hotel-ificación**: `useHotelMode()` exportado por ModuleAccessGuard
  (navModules trae rooms/hotelReservations). Nav: Delivery→"Room service",
  Mesas y QR→"QR habitaciones". Textos de caja, cocina, delivery, reportes,
  clientes, menú y mesas hablan de hotel/room service.

## Estado al cierre de la sesión 2026-07-14/15

- **En vivo** (deploy `7ve14au7f`): panel privado rediseñado 5★ ("El hotel hoy"
  con llegadas/salidas por nombre, fichas compactas, POS plegado, Administración
  aparte, tarjetas serif), header público transparente→marfil, galерías con
  lightbox, editar reservas desde recepción, alta en serie (25 habitaciones
  demo), subida de fotos a Storage, preset Hotel/Resort.
- **QA**: 73 checks automatizados en verde (rondas 1 y 2). Escala probada con
  200 habitaciones (<550ms por pantalla).
- **Bug raíz documentado**: hay TRES copias de BusinessConfig/normalize
  (ordersBusinessConfig, configuracion/page, pedidos/domain) — el fitness
  businessConfigModuleKeys ya vigila las tres.

## Reglas permanentes

- Producto SEPARADO: nada va al main de Santo ni al proyecto Vercel brotherhood.
- Migraciones: Claude las escribe; el usuario las aplica en Supabase.
- Fases pequeñas: commit + tsc/tests (+ build solo si el dev server está
  apagado) por fase; QA rondas antes de entregar.
- El texto público SIEMPRE en español neutro y con contraste AA.

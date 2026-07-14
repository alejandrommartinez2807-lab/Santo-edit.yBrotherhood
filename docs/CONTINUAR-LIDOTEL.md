# Continuar el demo Lidotel — estado y pendientes

> **Backlog 2026-07-14: LAS 6 TAREAS COMPLETADAS** (commits `3b82799` → `f382e2f`
> en `demo-lidotel`). Este doc queda como registro + pendientes del usuario.
> Contexto fino en las memorias `santo-edit-hotel-deploy` y `santo-edit-hotel-pms-build`.

## Hecho (2026-07-14)

1. **Contraste/legibilidad** (`3b82799`): ink-2 `#4d4433`, primary-dark `#7d6230`
   (AA sobre marfil y surface-2), hero con velo más fuerte + subtítulo con sombra,
   etiquetas 11px semibold, fuera opacidades /55-/70, botones sólidos texto `#171410`.
2. **Panel con cara de hotel** (`aa1e699`): `HotelPanelSection` (franja "Hotel · hoy"
   con llegadas/salidas/en casa/ocupación/por limpiar + 22 tarjetas agrupadas
   Recepción→Dinero→Resort), título "Panel del hotel", POS rotulado "Restaurante y
   room service", nav flotante reordenada hotel-primero.
3. **Integración 23 fases**: flujo dorado verificado END-TO-END por API contra el
   Supabase real (reserva→check-in+cargo hab→cargo bar→facturable→pago→check-out→
   housekeeping encolado→night audit→reporte). Datos QA borrados.
4. **Galería de fotos por tipo** (`2274079`): migración `0039_room_type_photos.sql`
   (columna `photos jsonb` en `room_types`), editor en Habitaciones (URL+caption,
   portada, reordenar), portada en tarjetas de landing/reservar + sección Galería.
5. **Mi reserva sin fricción** (`25cf335`): QR del código al confirmar, localStorage
   `hotel_guest_reservation_v1` autocompleta y consulta solo, se limpia al terminar
   la estadía (verificado en vivo); buscador por código/nombre/teléfono en staff.
6. **Ficha de habitación enriquecida** (`f382e2f`): estadía actual + saldo del folio
   en vivo + próxima llegada + historial 90 días, toggle fuera de servicio, notas
   editables en sitio.

## Segunda tanda (2026-07-14 tarde, migración 0039 YA aplicada)

7. **Galerías sembradas**: 10 fotos premium (Unsplash hotlink) en los 3 tipos
   (Individual 3, Doble Superior 3, Suite Ejecutiva 4) vía API staff.
8. **Fix payload parcial** (`054c25f`): `saveRoomType` ya no pisa con defaults
   los campos que el payload no trae (la siembra borró descripciones/orden y
   se restauraron; el editor de fotos tenía el mismo bug latente).
9. **Subir fotos como archivo** (`ba43ab4`): POST `/api/rooms/upload-photo`
   (guard rooms, ~5MB, jpeg/png/webp) sube a Storage — bucket `menu-images`
   prefijo `room-types/`, **se crea público al vuelo si no existe** — y botón
   "Subir foto" en Habitaciones. Verificado en vivo contra el Supabase real.
10. **Lightbox en la landing** (`8aba456`): clic en portada de tipo (badge
    "N fotos") o en la galería abre visor grande con caption, contador,
    flechas + teclado. Verificado en vivo.

## Pendientes del USUARIO antes del próximo deploy

1. **Re-subir env vars**: `bash deploy-hotel-env.sh` (el bug de comillas ya está
   corregido; el admin `1234` no entra en prod hasta esto).
2. **Deploy**: `npx vercel --prod --scope carlos-projects8` DESDE el worktree
   `D:/Santo edit/.claude/worktrees/nice-visvesvaraya-5726a1` (NUNCA desde
   `D:\Santo edit`). URL canónica: https://hotel-valencia.vercel.app
3. **QA con clave** (Claude no teclea claves): login al panel → ver "Panel del
   hotel" + franja "Hotel · hoy" → probar "Subir foto" en Habitaciones →
   buscador de reservas por código.

## Ideas siguientes (no comprometidas)

- Folio visible dentro de la ficha de habitación (hoy muestra saldo + enlace).
- Reemplazar las fotos Unsplash por fotos reales de Lidotel cuando el usuario
  las tenga (con "Subir foto" ya se puede sin tocar código).
- Lightbox también en /hotel/reservar (hoy solo miniatura).

## Reglas permanentes

- Producto SEPARADO: nada va al main de Santo ni al proyecto Vercel brotherhood.
- Migraciones: Claude las escribe; el usuario las aplica en Supabase.
- Fases pequeñas: commit + `npm run build` (y tests si tocan lógica) por fase.
- Deploy a producción: SIEMPRE lo corre el usuario.
- Ver la página desde Claude: extensión Claude in Chrome (funciona, 2026-07-14) —
  el Browser pane no captura en esta máquina. OJO: si el dev server sirve colores
  viejos o 404s raros, borrar `.next` y reiniciar (caché envenenado; pasó hoy).
  No correr `npm run build` con el dev server corriendo (comparten `.next`).

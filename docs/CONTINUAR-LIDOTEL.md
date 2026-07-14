# Continuar el demo Lidotel — prompt + backlog

> **Cómo usar:** copia el bloque "PROMPT" en una sesión nueva de Claude Code
> (abierta en `D:\Santo edit`). Todo el contexto fino vive en la memoria
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
- En vivo: https://hotel-valencia.vercel.app (proyecto Vercel hotel-valencia,
  scope carlos-projects8). Deploy: npx vercel --prod --scope carlos-projects8 (lo corro yo, el usuario).
- Supabase del hotel: edxbuggbqcrsaynxysuj (migraciones 0026-0038 aplicadas).
- Verificación: npm run build en el worktree + dev server vía launch.json config "hotel"
  (localhost:3000). Los screenshots del Browser pane SE CUELGAN en esta máquina:
  verificar con get_page_text / javascript_tool / read_console_messages, o pedirme capturas.
- Claves staff (local y prod tras re-subir env): admin=1234, dueno1234, manager1234,
  caja1234, coci1234, del1234, soporte=2807. Si 1234 no entra en prod, falta correr
  bash deploy-hotel-env.sh + redeploy (bug de comillas ya corregido en el script).

Trabaja el backlog de docs/CONTINUAR-LIDOTEL.md en orden, por fases pequeñas con
commit y build por fase. Las migraciones nuevas las escribo en supabase/migrations/
y las aplica el usuario en Supabase antes de probar.
```

---

## BACKLOG (en orden)

### 1. Contraste / legibilidad de la página pública
Problema reportado: con el tema claro, muchas secciones tienen textos tan claros
que "no destacan y es soso de leer". Auditar TODA la página pública (`/hotel`,
`/hotel/reservar`, `/hotel/mi-reserva`) y subir contraste:
- `--brand-ink-2` y textos secundarios más profundos donde se pierdan.
- Descripciones de tarjetas, etiquetas pequeñas, footer, franja de sellos.
- Regla: cuerpo de texto mínimo contraste AA (4.5:1) sobre marfil `#faf8f3` y
  sobre blanco. El oro solo para acentos grandes (precios/títulos), nunca para
  texto pequeño largo.

### 2. Panel privado con cara de HOTEL (hoy parece de comida)
Rediseñar la experiencia interna (`/local-santo/*`) para que se sienta un PMS:
- El panel principal (`/pedidos` o el dashboard de entrada) debe hablar de
  ocupación, llegadas/salidas de hoy, habitaciones sucias, saldo de folios —
  no de pedidos de comida como portada.
- Renombrar/reordenar el nav interno: primero Recepción (Reservas, Calendario,
  Folio, Habitaciones, Housekeeping), después Dinero (Caja, Facturación,
  Pagos online, Cierre de día, Reportes hotel), después Resort (Servicios,
  Cargos, Paquetes, Reseñas, CRM, Canales, Notificaciones), y el POS de
  restaurante como una sección más ("Room service / Restaurante"), no la portada.
- Revisar terminología visible: "pedido/mesa/cocina" → solo dentro del POS.
- OJO fitness tests: localModuleNavWiring y businessConfigModuleKeys vigilan el
  cableado; el checklist de módulos está en la memoria santo-edit-hotel-pms-build.

### 3. Conectar de verdad los módulos de las 23 fases
Pasada end-to-end: que cada módulo hotelero esté enlazado desde el panel y los
flujos crucen bien (reserva→check-in→folio→cargos de POS/resort→check-out→
housekeeping→factura→cierre de día→reporte). Arreglar huecos de integración que
aparezcan (enlaces faltantes en nav/dashboard, estados que no se refrescan, etc.).

### 4. Galería de fotos por habitación/tipo — editable por el dueño
- Migración aditiva (p. ej. `0039_room_photos.sql`): fotos por `room_type_id`
  (url, caption, sort_order) — o columna `photos jsonb` en `room_types`.
- El dueño las administra desde Habitaciones (agregar por URL como MVP; subir
  archivo a Supabase Storage como fase 2).
- La landing y `/hotel/reservar` muestran la foto del tipo en las tarjetas
  (hoy son tarjetas sin imagen) + una galería en la landing.

### 5. "Mi reserva" sin fricción: QR + memoria del navegador + limpieza
- Al confirmar una reserva pública: mostrar QR del código (patrón existente
  `buildQrImageUrl` con api.qrserver.com, ver sucursales/page.tsx) para
  escanear en recepción.
- Guardar `code` + `phone` en localStorage al crear la reserva; al abrir
  `/hotel/mi-reserva`, autocompletar y consultar solo (sin teclear).
- Limpieza: cuando el personal marca la estadía completada (status checkout,
  cancelada o no_show), la próxima consulta desde ese navegador borra el
  localStorage y vuelve al formulario vacío.
- Staff: en reservas-hotel/portal, poder buscar por código escaneado.

### 6. Creación de habitaciones enriquecida
La ficha de habitación/tipo debe capturar lo que ya existe en el código
(amenities texto libre, piso, capacidad, tarifa propia vs del tipo, fuera de
servicio, notas) con una UI clara de hotel + su relación con folios/cuentas
visible desde la habitación (estadía actual, saldo del folio, historial).

---

## Reglas permanentes
- Producto SEPARADO: nada va al main de Santo ni al proyecto Vercel brotherhood.
- Migraciones: yo (Claude) las escribo; el usuario las aplica en Supabase.
- Fases pequeñas: commit + `npm run build` (y tests si tocan lógica) por fase.
- Deploy a producción: SIEMPRE lo corre el usuario.
- Para que Claude "vea" la página: capturas pegadas por el usuario, o conectar
  la extensión Claude in Chrome (el Browser pane no captura en esta máquina).
```

# Continuar el demo Lidotel — prompt + backlog (v6 · 2026-07-15)

## PROMPT v6 (copiar/pegar) — AUDITORÍA MÓDULO POR MÓDULO

> Pedido por el dueño: "se están mezclando muchas cosas". Este prompt obliga a
> ir UN módulo a la vez, verificarlo de verdad (no solo que responda 200),
> arreglarlo, commitear y recién ahí pasar al siguiente.

```
Continúo el demo Lidotel (PMS hotelero). Lee las memorias santo-edit-hotel-deploy
y santo-edit-hotel-pms-build y docs/CONTINUAR-LIDOTEL.md del worktree.

Reglas fijas:
- Worktree: D:/Santo edit/.claude/worktrees/nice-visvesvaraya-5726a1 (rama
  demo-lidotel). NUNCA desde D:\Santo edit. Deploy autorizado al terminar:
  npx vercel --prod --scope carlos-projects8 DESDE el worktree.
- Dev: el usuario corre npm run dev en 3000 (verificar con curl). NUNCA npm run
  build con el dev vivo. Verificar con tsc + eslint + vitest --dir ./src + curl;
  vistas con Edge headless + CDP (script shots.mjs del scratchpad; Claude in
  Chrome no alcanza localhost). Claves staff en .env.local (header
  x-admin-password + Origin http://localhost:3000; la clave lleva comillas en
  el .env: quitarlas).
- QA: node scripts/qa-hotel-completo.mjs (54) + qa-hotel-ronda2.mjs (20). NO
  editar archivos mientras corren. OJO E2/E3: jamás meter un await entre
  pickFreeRoomOfType y saveHotelReservation en /api/public/hotel.
- Fases pequeñas: UN módulo por fase → commit → siguiente. Nada de tocar cinco
  módulos a la vez.

MÉTODO por módulo (checklist obligatoria, en este orden):
1. ABRIR: captura con Edge/CDP logueado (sessionStorage
   santo_perrito_owner_session) y mirarla de verdad.
2. TEXTOS: ¿habla de hotel (huésped, habitación, room service) o quedó texto
   de burger/restaurante? ¿Título, subtítulo, vacíos y errores en español neutro?
3. FUNCIONALIDAD: ejercitar el flujo COMPLETO por API (crear → ver → editar →
   borrar, con limpieza de datos de prueba). Si algo depende de otro módulo
   (caja↔cierre, folio↔reservas, QR↔habitaciones), probar la CONEXIÓN.
4. COHERENCIA: los números que muestra deben cuadrar con los de los módulos
   hermanos (caja de hoy = cierre de hoy = reportes del día).
5. ARREGLAR lo que falle/chirríe (estética champán fina incluida), tsc +
   eslint + tests, commit con nombre del módulo.
6. Marcar el módulo en la tabla de abajo (docs/CONTINUAR-LIDOTEL.md) con ✔ y
   una línea de qué se arregló.

ORDEN sugerido (los de dinero primero, luego operación, luego catálogo/público):
1. Caja (recepción + restaurante)   2. Cierre de día   3. Reportes hotel
4. Pagos y depósitos                5. Folio           6. Reservas hotel
7. Reservas online                  8. Calendario      9. Habitaciones
10. QR de habitaciones (mesas)     11. Housekeeping   12. Cocina (3 pestañas)
13. Room service (delivery)        14. Tickets        15. Menú + Menú avanzado
16. Servicios                      17. Paquetes       18. Cargo resort
19. Reseñas                        20. CRM huéspedes  21. Portal huésped
22. Notificaciones                 23. Página hotel   24. Tarifas/Temporadas/
    Planes/Grupos/Canales          25. Facturación    26. Cierres/Historial
27. Inventario/Alertas/Subrecetas/Proveedores/Compras/Cuentas por pagar
28. Control de gastos              29. Clientes       30. Usuarios/Auditoría/
    Sucursales/Configuración/Soporte/Dueño            31. Público: /hotel,
    /hotel/reservar, /hotel/mi-reserva, /carta (QR), landing y checkout.

Al terminar TODOS: vitest + QA 54/54 y 20/20 + capturas finales + deploy
(npx vercel --prod) + verificación en vivo con curl. Actualizar esta tabla
y las memorias.
```

### Tabla de auditoría (marcar al pasar cada módulo)

| # | Módulo | Estado | Nota |
|---|--------|--------|------|
| 1 | Caja recepción/restaurante | ✔ 15 jul | cobros con detalle + cierre conectado |
| 2 | Cierre de día | ✔ 15 jul | bloque caja recepción + nota en snapshot |
| 3 | Reportes hotel | ✔ 15 jul | KPIs, gráficas, CSV |
| 4 | Pagos y depósitos | ✔ 15 jul | métricas/filtros/contexto reserva |
| 12 | Cocina (Restaurante/Habitaciones/Por producto) | ✔ 15 jul | fusionada, sin módulo duplicado |
| 10 | QR de habitaciones | ✔ 15 jul | auto-generados desde Habitaciones |
| 15 | Menú | ✔ 15 jul | 17 productos demo + promo + destacados |
| — | resto | pendiente | usar el MÉTODO de arriba |


## Estado 2026-07-15 (tarde) — upsell, POS por áreas, reportes con gráficas

Hecho en esta sesión (commits 143200e…5c045a8, TODO verificado con tsc +
eslint + 403 tests + QA 54/54 y 20/20 + capturas Edge/CDP):

- **Extras al reservar**: el motor público ofrece SERVICIOS y PAQUETES del
  hotel (config `hotelUpsell` en business_config, sin migración): foto
  editable por ítem o modo "solo texto"; editor en Página del hotel. Los
  servicios elegidos se crean como `service_bookings` VINCULADOS a la reserva
  (aparecen en el folio al check-in); el paquete va en la nota. Totales de
  extras separados ("se pagan en el hotel").
- **Incluido con la habitación**: campo `includes` por tipo
  (hotelRoomTypeDetails) → lista verde en cada tarjeta del motor.
- **Reservar servicios desde la landing**: formulario inline por servicio
  (fecha/hora/personas); con código de reserva + teléfono queda asociado a la
  cuenta del huésped (valida últimos 4 dígitos y cupo por franja); sin código,
  a nombre y teléfono. POST público nuevo en /api/public/hotel/services.
  Mi reserva muestra los servicios de la estadía y permite agregar más.
- **Reseñas estilo Google**: googleReviewsCount/Rating/Url en hotelSiteExtras
  (editor en Página del hotel); la landing muestra el total de la ficha con
  "Ver en Google" y deja solo 5 visibles. Demo: 4.6 · 2.350 (corregible).
- **Pagos y depósitos**: métricas, filtros (estado/método/búsqueda), contexto
  por reserva (abonado X de Y, atajos 50%/restante), fechas y referencias.
- **Reportes del hotel**: KPIs con delta vs periodo anterior, línea de
  ocupación por noche + columnas de ingreso (SVG propio con crosshair y
  tooltip; paleta validada #a5762f/#2f6bb0), canales web/recepción, facturado
  en folios por categoría, tipos más vendidos, cobros por método, estancia
  media/huéspedes/cancelaciones, tabla diaria y CSV. Lib pura en
  hotelReports.ts con tests. API ampliada (periodo previo, folio en rango).
- **Caja del hotel**: submódulos con pestañas — CAJA RECEPCIÓN (nuevo
  /api/folios/summary: en casa con saldo de folio, salidas de hoy, llegadas,
  depósitos por confirmar, cobrado hoy por método; cobro en modal con
  check-out opcional; "Abrir folio" si falta) y CAJA RESTAURANTE (POS igual).
  Roles: "cashier" añadido a folios y reservation-payments (recepcion tenía
  el módulo folio pero el rol lo bloqueaba — bug latente corregido).
- **Cocina del hotel**: submódulos RESTAURANTE y HABITACIONES por ubicación
  del pedido (helper puro hotelPos.isRoomServiceLocation, testeado); contador
  de pedidos vivos por pestaña; mesas demo "Habitación 101/102" agregadas.
- **Notificaciones integradas**: botonera WhatsApp (confirmación/recordatorio/
  post) en cada tarjeta de Reservas del hotel y Reservas online, con aviso
  sugerido por estado y check de enviado (mismo log del módulo).
- **Fix carrera reservas**: el catálogo de extras había ensanchado la ventana
  del doble-booking (QA E2/E3) → catálogo al Promise.all inicial + doble
  chequeo optimista post-insert (gana created_at más antiguo; el rival se
  revierte con 409). NO meter awaits entre pickFreeRoomOfType y el insert.

Pendiente sugerido: subir fotos propias para servicios/paquetes (hoy sin
foto usan icono), corregir el conteo real de Google Maps, y DEPLOY a
hotel-valencia.vercel.app cuando el dueño lo pida (npx vercel --prod --scope
carlos-projects8 desde el worktree).


## PROMPT v4 (copiar/pegar en la otra cuenta) — rediseño 5★ del panel /admin

```
Continúo el demo Lidotel del PMS hotelero. Lee la memoria santo-edit-hotel-deploy
y santo-edit-hotel-pms-build si existen, y docs/CONTINUAR-LIDOTEL.md del worktree.

Datos clave:
- Worktree: D:/Santo edit/.claude/worktrees/nice-visvesvaraya-5726a1 (rama demo-lidotel).
  NUNCA deployar desde D:\Santo edit (su .vercel apunta a Brotherhood).
- En vivo: https://hotel-valencia.vercel.app · deploy: npx vercel --prod --scope
  carlos-projects8 DESDE el worktree (autorizado; si el CLI da ECONNRESET el build
  sigue en la nube: verificar con vercel ls + curl).
- Dev: el usuario corre npm run dev en 3000 (verificar con curl). NUNCA correr
  npm run build con el dev server vivo (comparten .next y se envenena).
- Verificar con tsc + eslint + vitest + curl (nada de preview/browser pane).
- QA: node scripts/qa-hotel-completo.mjs (54 checks) + qa-hotel-ronda2.mjs (20).
  NO editar archivos mientras corren (el dev server se reinicia y el script
  muere en su propia limpieza dejando reservas QA huérfanas que hacen fallar
  la siguiente corrida). Si quedan huérfanas: borrarlas por ID exacto con los
  nombres hardcodeados del script (QA Relleno N, Corredor Uno/Dos QA, etc.).
- El panel privado es /admin (=/pedidos con redirect). Fases pequeñas: commit
  + verificación por fase, QA + deploy al final.

TAREA — rediseño visual 5★ del panel /admin (hoy la cabecera y las tarjetas
inferiores siguen con el estilo grueso del template de restaurante y chocan
con las fichas finas de "El hotel hoy"):

1. CABECERA del panel (src/app/pedidos/page.tsx, bloque <header> ~línea 3318):
   en modo hotel (isHotelFrontDeskVisible) quitar el marco border-4 + franja
   degradada + sombras duras → tarjeta blanca con filete fino
   (border border-[var(--brand-border)], shadow-sm). Los ~9 chips de acceso
   rápido (Sitio público, Cierre del día, Historial, Gastos, Clientes,
   Inventario, Carta, Ubicaciones, Config, Sonido, Cerrar sesión) pasan de
   pastillas border-2 uppercase a botones fantasma finos (border
   border-[var(--brand-primary)]/30, texto brand-primary-dark, sin negrita
   black). "Cerrar sesión" puede quedar sólido champán como acción principal.
2. BANNER DE SEDE (src/components/local/CurrentBranchBanner.tsx): la barra
   marrón "ESTÁS VIENDO LA SEDE PRINCIPAL" es pesada → versión fina champán
   (fondo primary/10, filete primary/25, texto primary-dark) al menos en hotel.
3. TARJETAS (src/app/pedidos/components.tsx): ModuleAccessCard, MetricCard,
   InfoBox y PanelMiniMetric siguen con border-2 + títulos uppercase black +
   pill "ENTRAR" + drop-shadow. Rediseñarlas al estilo de ModuleTile de
   src/components/local/HotelPanelSection.tsx (~línea 85): filete 1px, fondo
   blanco, icono en círculo champán suave, título font-serif semibold sin
   uppercase, métrica pequeña en versalitas, footer "Entrar →" discreto,
   hover -translate-y-0.5 + borde champán. Esto arregla de una vez la sección
   Administración y las tarjetas del POS ("Restaurante y room service").
   OJO: caja importa MetricCard de pedidos/components (src/app/local-santo/
   caja/page.tsx línea ~79) y pasa tone="soft" — revisar TODOS los usos y
   tonos (red/yellow/soft) para no romper caja/cocina/delivery.
4. Revisar visual final coherente: "El hotel hoy" (ya fino) + cabecera +
   Administración + POS deben verse de la misma familia. Contraste AA.

Al terminar: vitest + las 2 rondas de QA en verde + npx vercel --prod y
verificación en vivo con curl.
```

---

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

## Estado 2026-07-15 (madrugada 2) — hotel de verdad en TODO el sistema

- **Causa raíz del "veo Brotherhood" arreglada**: `staffLightTheme.ts` forzaba
  la paleta naranja del template en TODOS los módulos /local-santo; ahora es
  champán AA. /admin y /pedidos ganaron layout con esa paleta fija y /hotel/**
  fija la suya editorial: la Personalización del dueño re-pinta SOLO el menú
  público (/carta). Defaults de fábrica (2 copias + 4 fallbacks) ya no son
  burger: tema claro champán + textos de hotel. La BD del demo se corrigió por
  API (tema, textos "buenas burgers"/"frater", locationLabel→Habitación).
- **Chrome 5★ en los 53 módulos + /admin**: serif sin uppercase, hairlines,
  sin sombras duras, font-bold (script masivo; pantalla de cocina sigue oscura
  con acentos champán). "Volver al panel" → /admin en los 52 módulos.
- **Panel /admin ordenado**: cabecera hotel mínima (Sitio público, Cierre del
  día, Config, Sonido, Salir); métricas POS y botón Ubicaciones viven en la
  sección "Restaurante y room service".
- **Landing 100% editable** (Panel → Página del hotel): portada, frase,
  estrellas, sellos, cita, mapa, WhatsApp (botón flotante), Instagram/Facebook/
  TikTok — `hotelSiteExtras` en business_config, sin migración. **Detalle
  comercial por tipo** (camas, m², vista, amenidades con iconos) en landing y
  motor de reservas — `hotelRoomTypeDetails`. Demo poblada (3 tipos).
- Fix react-hooks (canales, portal-huesped, reservas-online). APIs: barrido
  completo sin 5xx.

## Estado 2026-07-15 (noche) — rediseño 5★ del panel /admin HECHO

- **Cabecera** de /admin en modo hotel: tarjeta blanca hairline + shadow-sm
  (sin border-4 ni franja degradada), chips fantasma finos, "Cerrar sesión"
  sólido champán; rótulo/subtítulo en versalitas finas AA. Restaurante intacto.
- **Banner de sede** fino champán (primary/10 + hairline + serif).
- **Tarjetas unificadas**: `pedidos/components.tsx` re-exporta
  ModuleAccessCard/MetricCard/InfoBox/PanelMiniMetric desde
  `PanelPrimitiveCards` (única fuente de verdad, estilo ModuleTile);
  Administración y POS quedan de la familia de "El hotel hoy". Caja/cocina/
  delivery usan sus propias copias locales — sin impacto.
- **Verificado**: tsc + eslint + 397 tests + QA 54/54 y 20/20 en verde.
  Deploy `dpl_CkMa5kuxtAxBJDqYwP1QYVxRypG7` en vivo; /?mesa=5 → 200 (QR ok),
  /admin → 200.

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

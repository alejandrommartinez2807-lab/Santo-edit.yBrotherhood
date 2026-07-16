# Continuar el demo Lidotel — prompt + backlog (v8 · 2026-07-16)

## 🧭 GIRO ESTRATÉGICO v8 (2026-07-16) — COMPLEMENTAR ODOO, NO COMPETIR

Decisión del dueño: **igualar a Odoo (contabilidad/ERP completo) es demasiado
complicado y no vale la pena.** El nuevo rumbo:

- **No competimos con Odoo. Lo complementamos.** El cliente que ya usa Odoo nos
  suma y las fallas hoteleras de Odoo (PMS débil: tape chart, housekeeping, room
  service ligado al folio, channel manager, portal huésped) desaparecen porque
  las cubrimos nosotros. **Un solo sistema, no dos separados.**
- **Lo más importante: fácil de incorporar → con UN BOTÓN se sincronizan todos
  los datos** (huéspedes, productos, facturas, pagos) hacia Odoo, vía su API
  externa (JSON-RPC en `/jsonrpc`).
- Si algún día el cliente quiere migrar del todo a nuestro sistema, ya nos eligió.
- Las brechas que dependen de terceros (fiscal SENIAT, OTAs, banco C2P, email) se
  dejan **con interfaz lista y provider "manual"**, igual que el cobro online del
  v7. La guía de trámites está en **docs/CONEXIONES-PROVEEDORES.md**.

El **PROMPT v8** (más abajo) reencuadra el trabajo alrededor del conector Odoo.
El v7 (competir cerrando brechas) queda como historia cumplida.

### Estado v8 (avance)

| Fase | Qué | Estado | Migración |
|---|---|---|---|
| V8-A | Conector Odoo: lib pura + conexión + API + pantalla "Probar conexión" | ✅ `df5f820`+`f3aada1` | 0045 ✅ aplicada |
| V8-B | El botón "Sincronizar ahora": huéspedes→res.partner, productos→product.product (idempotente, con dry-run) | ✅ `b0b896e` + **probado contra Odoo real** | — |
| V8-C | Dinero a Odoo: reservas→sale.order, facturas→account.move (borrador), pagos confirmados→account.payment | ✅ `5bbce5b` (2026-07-16) | — (0045 ya lo preveía) |
| V8-D | Tiempo real: interruptor "Sincronizar en vivo" — Odoo es un destino más de los eventos P2-E | ✅ `e4e7791` (2026-07-16) | — |
| V8-E | Proveedores con interfaz lista (fiscal/OTA/C2P/email, provider manual) | ✅ `b889048` (2026-07-16) | — (sin secretos; estado en business_config) |

> **✅ V8-C y V8-D VERIFICADAS CONTRA EL ODOO REAL (trial, 2026-07-16 tarde):**
> 12 reservas → sale.order en borrador con ref=código y total EXACTO (sin el
> impuesto default de Odoo) · factura demo A-1 (Maria Gonzalez, 225+IVA 36=261)
> → account.move en borrador cuadrado con línea "IVA 16%" de respaldo ·
> idempotencia (2ª pasada 0 creados) · EN VIVO: pago confirmado → account.payment
> apareció solo (memo con código de reserva) sin duplicarse al re-confirmar, y
> confirmar una reserva actualizó la nota del sale.order existente. Fixes de la
> prueba en `ad8b89e` (Odoo 18: tax_ids en la línea de venta, memo en el pago,
> tasa fracción→porcentaje). Datos QA limpiados (pago borrado en ambos lados,
> reserva devuelta a pendiente, liveSync APAGADO — el demo queda dormido).
> QA post-cambios: 54/54 + 25/25 en verde.
>
> **Notas V8-C/D/E (2026-07-16):**
> - V8-C: el "Sincronizar ahora" ahora también empuja el dinero. Los clientes se
>   resuelven en Odoo por huésped ya sincronizado (mapa `guest`) o buscando por
>   RIF/nombre (crea si falta). El IVA usa el impuesto de venta de Odoo con la
>   misma tasa si existe (asiento cuadrado); si no, va como línea aparte. La
>   línea del sale.order usa un producto genérico "Estadía de hotel"
>   (default_code HOTEL-STAY) creado al vuelo. Si falta la app Ventas o
>   Contabilidad en ese Odoo, la entidad lo reporta claro y no revienta.
>   Idempotencia por fingerprint local (los values con partner_id no entran al
>   hash); los write quitan *_line_ids para no duplicar líneas.
> - V8-D: `pushOdooLiveEvent` vive dentro de `dispatchHotelWebhooks` (todos los
>   puntos de disparo lo ganan gratis). Gate: conexión activa + API key +
>   interruptor liveSync. Best-effort con tope duro de 8s; si Odoo no responde,
>   el dato queda para la próxima sincronización manual (mismo mapa). El evento
>   pago_confirmado ahora incluye paymentId/reservationId en el payload.
> - V8-E: tarjeta `ProviderConnectionCard` montada en Facturación (fiscal),
>   Canales (channel), Pagos online (gateway) y CRM (email); catálogo puro en
>   `src/lib/providerIntegrations.ts` + API `/api/provider-integrations`.
>   Estado/notas en business_config clave `providerIntegrations` (SIN
>   credenciales; las reales irán en tabla service-role al enchufarse).

> **✅ VERIFICADO CONTRA UN ODOO REAL (2026-07-16, trial jhfbffbbffb.odoo.com):**
> Probar conexión → uid 2 · dry-run correcto (17 productos por crear) ·
> 1ª escritura real: 17 productos creados · 2ª pasada: 0 creados / 17 sin
> cambios (idempotencia) · huésped del CRM → res.partner con teléfono y email
> correctos · todo confirmado consultando Odoo DIRECTO por JSON-RPC
> (search_count/search_read). Datos de prueba limpiados en ambos lados.
>
> **FIX descubierto durante la prueba (`f900a9b`, deployado):** el POST de
> business-config solo aceptaba los interruptores de la era restaurante — los
> 26 módulos hoteleros (incl. odooSync) se descartaban EN SILENCIO al guardar
> desde Configuración (apagar un módulo hotelero era imposible y encender Odoo
> también). Ahora el mapa se construye desde LOCAL_MODULE_DEFINITIONS: un
> módulo nuevo con ownerConfigKey queda cubierto automáticamente.
>
> OJO: tras la prueba, el módulo Odoo quedó ENCENDIDO y la conexión al trial
> guardada en el demo (base compartida local/vivo). Para volverlo a dormir:
> Configuración → Módulos → apagar "Odoo" (ya funciona gracias al fix).
>
> **PUBLICADO DORMIDO (2026-07-16):** el módulo `odooSync` nace con el interruptor
> APAGADO (`odooSyncModuleEnabled: false` en las 4 copias de default/preset). El
> código está desplegado pero invisible/inactivo en el demo hasta que el dueño lo
> encienda en Configuración → Módulos cuando aparezca un cliente con Odoo. Así el
> deploy no cambió nada de lo que ya funciona.

## ⚡ ESTADO 2026-07-16 (tarde) — TANDA v7 COMPLETA, MIGRADA Y **EN VIVO**

Migraciones 0042/0043/0044 **APLICADAS** por el usuario. Los 3 flujos que
esperaban tabla quedaron probados EN VIVO contra el dev server:
- **Webhooks**: listener local recibió `prueba`, `reserva_creada` y
  `reserva_confirmada` con firma HMAC **válida** verificada.
- **iCal import**: .ics de prueba → 2 bloqueos creados, cupo público bajó
  8→7, re-sync idempotente (0/0), el feed de la habitación NO re-exporta los
  bloqueos ical (anti-eco), calendario vacío los borró (2) y el cupo volvió a 8.
- **Turnos**: planificar → salida sin entrada rechazada (409) → entrada y
  salida selladas con hora real → eliminado.

QA post-migraciones: **54/54 y 25/25 en verde**. **DEPLOY HECHO**
(`hotel-valencia-ejmbknnu1`, Ready): /admin 200, /hotel/reservar 200, feed
iCal 200, disponibilidad pública OK en https://hotel-valencia.vercel.app.

Capturas Edge/CDP hechas y AUDITORÍA v6 COMPLETA (31/31) el 2026-07-16 —
ver la tabla de auditoría más abajo. Sin hallazgos bloqueantes.

Las NUEVE brechas del PROMPT v7 están construidas, verificadas y commiteadas
en `demo-lidotel` (tsc + eslint 0/0 + 442 tests + QA 54/54 y 25/25 en verde):

| Fase | Qué | Commit | Migración |
|---|---|---|---|
| P1-A | Cobro online (abonar desde el teléfono) | `55fe91f` | 0040 ✅ aplicada |
| P1-B | Exportes contables CSV | `355320f` | — |
| P2-C | Membresías + pase de invitado | `427e622` | 0041 ✅ aplicada |
| P2-D | Campañas/listas desde el CRM | `ca81366` | — |
| P2-E | Webhooks firmados + docs/API-HOTEL.md | `1a61a57` | 0042 ✅ aplicada |
| P2-F | Dueño consolidado multi-propiedad | `26cce98` | — |
| P3-G | iCal import por habitación (Canales) | `9264d8f` | 0043 ✅ aplicada |
| P3-H | Turnos/asistencia del personal | `d5ecb25` | 0044 ✅ aplicada |
| P3-I | Respaldo y datos + RESPALDO.md | `d8b4aa7` | — |

(Los pasos "al volver" de la versión anterior ya se ejecutaron: migraciones aplicadas, flujos probados, QA en verde y deploy verificado en vivo.)

## PROMPT v8 (copiar/pegar) — CONECTOR ODOO: SINCRONIZAR CON UN BOTÓN

> Lidotel es la PLANTILLA BASE. Objetivo de esta tanda: dejar de competir con
> Odoo y convertirnos en su COMPLEMENTO hotelero, con sincronización de UN BOTÓN.
> El cliente que ya usa Odoo nos enchufa y no maneja dos sistemas separados.

```
Continúo el demo Lidotel (PMS hotelero, plantilla base). Lee las memorias
santo-edit-hotel-deploy, santo-edit-hotel-pms-build y lidotel-estrategia-odoo,
y docs/CONTINUAR-LIDOTEL.md + docs/CONEXIONES-PROVEEDORES.md del worktree ANTES
de tocar código.

Reglas fijas (idénticas al v7, no negociables):
- Worktree: D:/Santo edit/.claude/worktrees/nice-visvesvaraya-5726a1 (rama
  demo-lidotel). NUNCA desde D:\Santo edit. Deploy al final: npx vercel --prod
  --scope carlos-projects8 DESDE el worktree.
- Dev: el usuario corre npm run dev en 3000 (verificar con curl). NUNCA npm run
  build con el dev vivo. Verificación: tsc + eslint + vitest --dir ./src + curl
  con x-admin-password (quitar las comillas del .env.local) + Origin
  http://localhost:3000. Capturas: Edge headless + CDP (Claude in Chrome NO
  alcanza localhost).
- QA: node scripts/qa-hotel-completo.mjs (54) + qa-hotel-ronda2.mjs (30; la
  sección 10 cubre el conector Odoo y las conexiones de proveedores). NO
  editar archivos mientras corren. JAMÁS meter un await entre pickFreeRoomOfType
  y saveHotelReservation en /api/public/hotel (carrera E2/E3).
- Migraciones: Claude escribe el .sql (numeración siguiente; la 0044 fue la
  última) y SE DETIENE para que el usuario la aplique antes de seguir esa fase.
- Módulos nuevos = interruptor + plan: registrar en localPlans
  (LOCAL_MODULE_DEFINITIONS con ownerConfigKey) y cablear el default en las TRES
  copias de BusinessConfig (ordersBusinessConfig.ts, configuracion/page.tsx,
  pedidos/domain.tsx) — el test businessConfigModuleKeys lo vigila.
- Método: UNA fase → migración (si aplica) → lib pura con tests → API con guard
  por rol+módulo → UI champán fina (AA, español neutro) → commit → siguiente.

PRINCIPIO CLAVE: NO construir contabilidad. Somos la capa hotelera que se
ENCHUFA a Odoo y le manda los datos. Odoo sigue siendo el ERP; nosotros el PMS.

Odoo API: usar JSON-RPC (POST a {url}/jsonrpc), NO XML-RPC.
- Auth: service "common", method "authenticate", args [db, login, apikey, {}] → uid.
- Datos: service "object", method "execute_kw", args [db, uid, apikey, model,
  method, [args], {kwargs}]. Modelos: res.partner (huésped/cliente),
  product.product (producto), account.move (factura), account.payment (pago),
  sale.order (reserva). Idempotencia: guardar el id de Odoo por registro local en
  una tabla de mapeo y saltar lo que no cambió (hash del registro).
- El secreto (API key) NO va en business_config (se sirve público): va en tabla
  dedicada solo service-role.

FASES (en orden):

V8-A · CONECTOR ODOO (fundación)  ← EMPEZAR AQUÍ
  Migración 0045: odoo_integration (branch_id, base_url, db_name, login,
  api_key, active, last_sync_at, last_uid) + odoo_sync_map (branch_id,
  local_type, local_id, odoo_model, odoo_id, record_hash, synced_at). RLS on.
  Lib pura src/lib/odooSync.ts + tests: normalizeOdooBaseUrl, buildAuthCall,
  buildExecuteCall, parseJsonRpcResult (detecta el error de Odoo), recordHash
  estable, mapGuestToPartner/mapProductToOdoo, planSync (toCreate/toUpdate/
  unchanged contra el sync_map). Transporte server-only src/lib/odooClient.ts
  (fetch a /jsonrpc, best-effort con captureError). Módulo nuevo "odooSync"
  (label "Odoo / ERP") en localPlans + 3 copias. API /api/odoo (guard
  owner/manager): action "testConnection" (auth y devuelve uid) y "saveConfig".
  UI /local-santo/odoo: form (URL, base de datos, usuario, API key) + botón
  "Probar conexión" (muestra "Conectado como uid N" o el error).
  Aceptación: guardar config y probar conexión contra una instancia Odoo
  (odoo.com de prueba) → uid válido.

V8-B · SINCRONIZACIÓN MAESTRA (el botón)
  Botón "Sincronizar ahora": empuja huéspedes (guest_profiles → res.partner) y
  productos (menú → product.product) a Odoo, idempotente vía odoo_sync_map
  (crea los nuevos, actualiza los cambiados por hash, salta los iguales). Barra
  de progreso + log del resultado (N creados, M actualizados, K sin cambios,
  errores). Modo "dry-run" (simular sin escribir). Aceptación: sincronizar el
  demo dos veces seguidas; la segunda no crea duplicados.

V8-C · EL DINERO A ODOO
  Facturas del hotel → account.move (borrador), pagos → account.payment,
  reserva → sale.order, para que la contabilidad de Odoo vea el ingreso
  hotelero sin doble captura. Respetar impuestos/tasas ya existentes (fiscal.ts).
  Aceptación: una factura demo aparece en Odoo como asiento en borrador cuadrado.

V8-D · TIEMPO REAL (reusar webhooks P2-E)
  Nuevo destino de webhook con provider "odoo": al confirmar reserva, pago,
  check-in/out, empujar el cambio a Odoo al vuelo (best-effort, con la misma
  infra firmada de hotelWebhookDispatch). Un interruptor "sincronizar en vivo".
  Aceptación: hacer check-in en el demo y ver el partner/sale actualizarse solo.

V8-E · PROVEEDORES CON INTERFAZ LISTA (provider "manual")
  Siguiendo docs/CONEXIONES-PROVEEDORES.md, dejar config + hook listos (sin
  credenciales todavía) para: facturación electrónica SENIAT (The Factory HKA),
  channel manager push (OTAs), pasarela C2P bancaria, email marketing (Resend).
  Cada uno con provider "manual" hasta que el dueño traiga las credenciales.
  Aceptación: cada pantalla explica qué credencial falta y enlaza la guía.

Al terminar TODO: vitest + QA 54/54 y 25/25 + capturas Edge/CDP + deploy +
verificación en vivo + actualizar GUIA-HOTELERO.md, esta tabla y las memorias.
```

## PROMPT v7 (copiar/pegar) — CERRAR LAS BRECHAS CONTRA ODOO (plantilla base)

> Lidotel es la PLANTILLA BASE del producto hotelero: todo lo que se construya
> aquí se replica luego en cada cliente (el próximo es Koral Suits / Koral OHS
> Hoteles Morrocoy, Tucacas — su personalización va en OTRA instancia, NO
> mezclar su marca aquí). Objetivo de esta tanda: cerrar las brechas reales
> frente a Odoo/ERPs para vender sin objeciones.

```
Continúo el demo Lidotel (PMS hotelero, plantilla base del producto). Lee las
memorias santo-edit-hotel-deploy y santo-edit-hotel-pms-build y el archivo
docs/CONTINUAR-LIDOTEL.md del worktree ANTES de tocar código.

Reglas fijas (no negociables):
- Worktree: D:/Santo edit/.claude/worktrees/nice-visvesvaraya-5726a1 (rama
  demo-lidotel). NUNCA desde D:\Santo edit. Deploy autorizado al final:
  npx vercel --prod --scope carlos-projects8 DESDE el worktree.
- Dev: el usuario corre npm run dev en 3000 (verificar con curl). NUNCA npm
  run build con el dev vivo. Verificación: tsc + eslint + vitest --dir ./src
  + curl con x-admin-password (la clave del .env.local lleva comillas:
  quitarlas) + Origin http://localhost:3000. Capturas: Edge headless + CDP
  (scripts shots*.mjs del scratchpad; Claude in Chrome NO alcanza localhost).
- QA: node scripts/qa-hotel-completo.mjs (54) + qa-hotel-ronda2.mjs (20). NO
  editar archivos mientras corren. JAMÁS meter un await entre
  pickFreeRoomOfType y saveHotelReservation en /api/public/hotel (carrera
  E2/E3; existe doble chequeo optimista post-insert como red).
- Migraciones: Claude escribe el .sql (numeración siguiente a las existentes
  en Supabase, la 0039 fue la última conocida) y SE DETIENE para que el
  usuario la aplique en Supabase antes de seguir esa fase.
- Módulos nuevos = interruptor + plan: registrar en localPlans
  (LOCAL_MODULE_DEFINITIONS con ownerConfigKey), y cablear el default en las
  TRES copias de BusinessConfig (ordersBusinessConfig.ts, configuracion/
  page.tsx, pedidos/domain.tsx) — el test businessConfigModuleKeys lo vigila.
  Claves de contenido (no-módulo) solo necesitan el normalizador canónico
  (saveBusinessConfig hace merge parcial).
- Método: UNA brecha por fase → migración (si aplica) → lib pura con tests →
  API con guard por rol+módulo → UI champán fina (AA, español neutro) →
  commit → siguiente. Al final: QA completo + capturas + deploy + actualizar
  GUIA-HOTELERO.md, esta tabla y las memorias.

BRECHAS A CERRAR (en este orden):

P1-A · COBRO ONLINE REAL (la objeción #1)
  Hoy los depósitos se reportan y confirman a mano (reservation-payments +
  payment-proofs). Construir el "botón de pago" venezolano:
  1. En la confirmación de reserva pública y en Mi reserva: sección "Abona tu
     reserva" con los métodos que el dueño active (pago móvil C2P, Zelle,
     transferencia, Binance/USDT) — datos de cobro por método editables en
     business_config (patrón publicPaymentMethodDetails ya existe en /carta).
  2. El huésped reporta el pago con referencia + monto + captura (bucket
     payment-proofs ya existe) SIN estar logueado, atado a su código de
     reserva; cae como "reportado" en Pagos y depósitos y en Caja recepción
     (depósitos por confirmar) — ese circuito ya existe, solo falta la
     entrada pública.
  3. Conciliación semiautomática: al confirmar, el staff ve monto reportado
     vs restante de la reserva y el sistema marca diferencias. (API bancaria
     C2P real queda para cuando un banco dé acceso; dejar la interfaz lista
     con provider "manual".)
  Aceptación: reservar → abonar desde el teléfono → verlo caer en Caja
  recepción y Cierre del día sin tocar el panel. QA nuevo: reporte público de
  pago + confirmación + aparece en /api/folios/summary.

P1-B · SALIDA CONTABLE (coexistir con el contador, no competir)
  No construir contabilidad. Construir EXPORTES que el contador importe:
  1. Libro de ventas estilo SENIAT (por rango): fecha, factura/correlativo,
     cliente, RIF, base por tasa de IVA, IVA, IGTF, total — desde las
     facturas ya existentes (facturación + invoiceTotals + fiscal.ts).
  2. Resumen mensual de cierres (business_days + ventas POS + folio) en CSV.
  3. Export TOTAL de datos del hotel (reservas, folios, facturas, clientes)
     en CSV por sección — "sus datos son suyos" como argumento de venta.
  Ubicación: módulo Facturación (pestaña "Exportes contables") + Cierres.
  Aceptación: descargar los 3 CSV con datos reales del demo y abrirlos sin
  mojibake en Excel (BOM UTF-8 ya resuelto en lib/csv.ts).

P2-C · MEMBRESÍAS / FIDELIZACIÓN (el "Koral Circle" genérico)
  Migración: tablas memberships (id, nombre, nivel, beneficios texto,
  descuento %, activo) y guest_memberships (huésped CRM ↔ membresía, código,
  pase_invitado_codigo, vence). Módulo panel "Membresías" (alta, asignar a
  huésped del CRM, ver estado) + en el folio/reserva: si el huésped tiene
  membresía activa, mostrar chip y aplicar el descuento % a la tarifa como
  sugerencia (el staff confirma). Pase de invitado: código QR transferible
  que en la reserva pública aplica el beneficio y registra quién refirió.
  Gate: módulo nuevo guestMemberships (cablear en 3 copias + localPlans).
  Aceptación: crear membresía → asignarla → reservar con pase → ver el
  descuento sugerido y el referido en el CRM.

P2-D · CAMPAÑAS / LISTAS DESDE EL CRM
  Sin email masivo todavía: listas segmentadas exportables + plantillas.
  En CRM huéspedes: filtros (estuvo entre fechas, gastó más de X, cumple
  años este mes, miembro/no miembro) → exportar CSV y "copiar teléfonos"
  para WhatsApp + plantillas de mensaje editables (business_config) con
  variables {nombre}, {hotel}. Aceptación: segmentar el demo y copiar la
  lista con un clic.

P2-E · API PÚBLICA DOCUMENTADA + WEBHOOKS
  1. docs/API-HOTEL.md: los endpoints públicos y privados que ya existen
     (auth por header, ejemplos curl).
  2. Webhooks salientes: tabla webhooks (url, evento, secreto, activo) +
     disparos en reserva creada/confirmada, pago confirmado, check-in/out
     (POST JSON firmado HMAC, best-effort con captureError). Módulo simple
     en Configuración → Integraciones. Gate: módulo webhooks.
  Aceptación: registrar un webhook de prueba (webhook.site) y ver llegar
  los eventos del QA.

P2-F · DASHBOARD MULTI-PROPIEDAD (dueño consolidado)
  Ya existen sucursales/branches. Falta la vista consolidada del dueño:
  en Dueño (o Reportes hotel con selector "Todas"): ocupación, ingresos,
  llegadas de HOY por propiedad, en una sola pantalla (agregación server en
  una API nueva /api/hotel-reports/consolidado que itere branches accesibles
  al rol owner). Aceptación: crear una 2ª sede demo con 2 habitaciones y ver
  el consolidado sumar bien.

P3-G · CHANNEL MANAGER FASE 1 (iCal bidireccional)
  Ya existe icalFeed (export). Falta: importar iCal externo por habitación
  (URL de Airbnb/Booking por room, cron o botón "Sincronizar ahora") creando
  bloqueos room_blocks con fuente "ical" (no reservas), y publicar la URL
  iCal por habitación en el módulo Habitaciones para pegarla en Airbnb.
  Regla: NUNCA borrar bloqueos manuales; solo gestionar los de fuente ical.
  Aceptación: importar un .ics de prueba y ver el cupo público bajar.

P3-H · TURNOS / ASISTENCIA DEL PERSONAL (sin nómina)
  Migración: staff_shifts (usuario staff, fecha, turno, entrada real, salida
  real, nota). Módulo "Turnos": calendario semanal simple por usuario (los
  usuarios ya existen en staff/), marcar entrada/salida desde el panel del
  empleado, y el gerente ve la semana. NADA de sueldos. Gate: módulo
  staffShifts. Aceptación: planificar una semana y marcar una asistencia.

P3-I · CONFIANZA OPERATIVA
  1. Página "Respaldo y datos" en Configuración: cuándo fue el último backup
     de Supabase (texto informativo), botón del export total (reusa P1-B.3).
  2. docs/RESPALDO.md: qué se respalda y cómo se restaura.
  3. Revisar que TODO módulo nuevo de esta tanda quede en GUIA-HOTELERO.md.

Al terminar TODO: vitest + QA 54/54 y 20/20 (ampliados con los checks
nuevos) + capturas Edge/CDP de cada módulo nuevo + deploy + verificación en
vivo con curl + actualizar memorias y la tabla de auditoría v6.
```

### Nota para la instancia Koral (NO hacer en la plantilla)
Cuando el usuario lo pida, la personalización Koral Suits / Koral OHS
Hoteles Morrocoy va aparte: fork/instancia con su Supabase propio, nombre,
fotos de Morrocoy, paquetes "Escape Náutico Full Day" y "Koral Weekend
Retreat", servicios de catamarán/embarcaciones, y membresía "Koral Circle"
(usa P2-C). La plantilla Lidotel queda intacta como base.


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
| 5 | Folio | ✔ 16 jul | captura + flujo cubierto por QA (open/charge/close) |
| 6 | Reservas hotel | ✔ 16 jul | disponibilidad viva en cabecera; avisos WhatsApp integrados |
| 7 | Reservas online | ✔ 16 jul | enlace público + 2 pendientes con botonera de avisos |
| 8 | Calendario | ✔ 16 jul | tape chart renderiza reservas reales + ocupación por día |
| 9 | Habitaciones | ✔ 16 jul | tipos, fotos por tipo, alta en serie |
| 11 | Housekeeping | ✔ 16 jul | 25 limpias, estados y tareas por habitación |
| 13 | Room service (delivery) | ✔ 16 jul | título hotel-ificado; jerga "delivery" solo interna |
| 14 | Tickets | ✔ 16 jul | impresión operativa, textos con room service |
| 15b | Menú avanzado | ✔ 16 jul | constructor carga bien; hamburguesas = productos demo válidos |
| 16 | Servicios | ✔ 16 jul | 5 servicios demo con cupo; QA cubre reservas de servicio |
| 17 | Paquetes | ✔ 16 jul | Paquete Romántico demo + cargar al folio |
| 18 | Cargo resort | ✔ 16 jul | cargar a la habitación (huésped en casa) |
| 19 | Reseñas | ✔ 16 jul | 4.8 con 5 reseñas demo, moderación visible |
| 20 | CRM + campañas | ✔ 16 jul | probado con 11 filas reales (P2-D) |
| 21 | Portal huésped | ✔ 16 jul | enlace + explicación clara |
| 22 | Notificaciones | ✔ 16 jul | plantillas WhatsApp por estado |
| 23 | Página hotel | ✔ 16 jul | editor completo con datos reales del demo |
| 24 | Tarifas/Planes/Grupos/Canales | ✔ 16 jul | canales ahora con import iCal por habitación (P3-G) |
| 25 | Facturación | ✔ 16 jul | + exportes contables (P1-B) |
| 26 | Cierres/Historial | ✔ 16 jul | historial con CSV |
| 27 | Inventario/Alertas | ✔ 16 jul | subrecetas/proveedores/compras/CxP OFF por preset (mensaje claro; se activan en Configuración) |
| 28 | Control de gastos | ✔ 16 jul | carga bien por sede |
| 29 | Clientes | ✔ 16 jul | "huéspedes y clientes"; vacío correcto (consumos del POS) |
| 30 | Usuarios/Auditoría/Sucursales/Config/Soporte/Dueño | ✔ 16 jul | Dueño = métricas POS (el dinero hotelero vive en Caja recepción/Reportes; consolidado P2-F) |
| 31 | Público (/hotel, /reservar, /mi-reserva, /carta) | ✔ 16 jul | landing 5★, motor con "Quedan X" + incluidos, carta habla de room service |

**AUDITORÍA v6 COMPLETA (31/31) el 2026-07-16.** Capturas en el scratchpad de
la sesión (shots/). Hallazgos: ninguno bloqueante; los módulos de proveedores
están apagados por el preset Hotel/Resort a propósito.


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

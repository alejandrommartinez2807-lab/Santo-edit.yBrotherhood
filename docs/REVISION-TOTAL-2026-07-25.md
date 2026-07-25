# Revisión total — 25 jul 2026 (rama `revision-total`)

Ejecución del `SUPER-PROMPT-REVISION-TOTAL.md`. Auditoría completa con 5 auditores
en paralelo (Caja/Cierres, Inventario/Proveedores/Gastos, Mesonero/Pedidos/Cocina/
Delivery, Config/Auth/Sedes, Menú/Reservas/Encuestas/Reportes/Eventos/Pagos) y
16 commits de fixes por fases. **Cada fase pasó `tsc` + vitest (452 tests, 5
archivos de test nuevos) + `next build` antes de commitear.**

## ⚠️ REQUIERE TU ACCIÓN (migraciones .sql para aplicar en Supabase)

1. `supabase/migrations/0034_supplier_purchase_payments_rls.sql` — RLS para la
   ÚNICA tabla que quedaba sin Row Level Security (abonos a proveedores).
2. `supabase/migrations/0035_open_account_index_normalized.sql` — índice único
   de cuenta por mesa normalizado ("Mesa 1"/"mesa 1" duplicaban cuenta). Si
   falla por duplicados existentes, cierra una de las dos cuentas y reintenta.

## Resumen por módulo — (E) errores, (S) blindaje, (M) mejoras

### A1 · Caja / Cobros — commits 7aea8bb, 2af3de7
- (E) **P0**: `refreshAccountsAfterAction` se llamaba a sí misma (recursión
  infinita). En la pestaña Historial, el cobro SÍ se aplicaba pero el panel
  mostraba error → el cajero recobraba = **doble cobro**. Corregido.
- (E) El cobro agrupado de cuenta estampaba el método de pago en la moneda que
  NO se tocó (cobro 100% Bs escribía también un método USD falso). Corregido.
- (E) Botón "Registrar cobro" ya no aparece en pedidos anulados.
- (S) Cerrar / marcar entrega / cobrar una cuenta exigen que siga **Abierta**
  (completa el R4; un "close" repetido pisaba `closed_at`/`closed_by`).
- (S) `/api/open-accounts` respeta los permisos por usuario (era la única
  superficie mutable sin `canLocalAccessUseModule`).

### A2 · Cierres e historiales — commits ba51e95, fc30997
- (E) **P0**: los gastos nunca se marcaban `close_status=Cerrado` → un segundo
  cierre del mismo día los **restaba otra vez**. Ahora el cierre los marca.
- (E) **P0**: el gasto de compra desde Inventario iba sin fecha (`date_value`
  vacío) → invisible para el cierre y control de gastos PARA SIEMPRE; y una
  compra solo en Bs se registraba como $0. Corregidos ambos.
- (E) Guardar cierre con modo entrenamiento activo → 409 claro (antes mezclaba
  totales de práctica con pedidos reales).
- (E) La fotografía del cierre y la limpieza de comprobantes ya no fallan en
  silencio (catch vacíos → `captureError` + warning en la respuesta).
- (S) **Los borrados masivos son fail-closed**: sin sede resuelta,
  `clearDayCloses`/`clearOrders`/`clearPaymentProofs` ya NO arrasan TODAS las
  sedes; rechazan con error claro.
- (S) El modal "Borrar historial" dice que borra SOLO la sede activa (+aviso
  extra en modo consolidado).
- (M) **Cancelados con motivo también en la vista GENERAL/rango** (antes solo
  en la diaria) — sin alterar el resto del historial.
- (M) CSV general con columna **Sede**; PDF/XLSX con el mismo fallback de neto
  que la UI (cierres viejos exportaban "Neto $0.00") y "Neto después de
  compras" en el PDF; cabecera del historial respeta los filtros.

### A3 · Inventario + insumos — commits 3c9ccf8, 7b58b33
- (E) **Crítico**: el descuento de stock NO era idempotente — un reintento de
  `createOrder` (mismo `client_order_id` o carrera) **descontaba dos veces**.
  Ahora hay guardia por pedido (mismo patrón que la reversión).
- (E) Los errores de Supabase en el descuento se tragaban (venta sin descontar,
  sin log). Ahora se propagan; lock optimista contra lost updates; el faltante
  queda registrado en el motivo del movimiento; insumo inexistente en la sede
  ya no se ignora en silencio.
- (E) La reversión por anulación es idempotente POR INSUMO (una reversión a
  medias quedaba permanente).
- (S) `saveInventoryItem`/`saveInventoryRecipe` validan la sede antes del
  upsert (se podía "robar" insumos/recetas de otra sucursal por id).
- (M) La pantalla abre en la **vista rápida "Solo cantidades"** (qué hay/qué
  falta de un vistazo); la vista ya existía, ahora es la puerta de entrada.
- Conexión con gastos: la compra desde Inventario ahora sí entra al cierre (ver A2).

### A4 · Proveedores — commits 809e013, 7b58b33
- (E) **Deuda en Bs invisible**: una compra mixta $50+Bs1.000 quedaba "Pagado"
  al abonar solo los $50 y los Bs desaparecían de Cuentas por pagar. Ahora
  "Pagado" exige AMBAS monedas saldadas; totales muestran USD **y** Bs.
- (E) Compra sin monto o con vencimiento anterior a la compra → 400.
- (M) Ficha nivel empresa: **buscador**, saldo por proveedor ("Le debes $X"),
  vencidos, nº de compras, total histórico, última compra, enlace "Ver sus
  compras" (compras acepta `?supplierId=`), email y nota editables, y el
  borrado avisa si hay deuda/compras.

### A5 · Gastos / egresos — commit ba51e95
- (E) Ver A2 (close_status + compra de inventario). `GET /api/day-expenses`
  acepta `includeClosed=1` para vistas de historial.

### A6 · Mesonero — commit 7aea8bb
- (E) **Máquina de estados en el servidor** (antes cualquier transición valía):
  Cancelado es TERMINAL (un pedido anulado, con inventario ya devuelto, podía
  "revivir" y cobrarse); Entregado solo reabre a Listo o se anula.
- (E) El botón "Marcar entregado" solo aparece en pedidos **Listo** y pide
  confirmación (antes un toque "entregaba" algo aún en cocina).
- (E) Reabrir limpia también `delivered_by`; anular tras entregar conserva el
  rastro de quién entregó.
- (S) Mesonero con permisos custom de `openAccounts` ya puede leer/actualizar
  pedidos (antes 403 y pantalla vacía).

### A7 · Configuración — commit 6dfe656 (Parte B)
- (M) Índice "Ir directo a…" agrupado por temas (Tu negocio / Sedes y operación
  / Página pública / Sistema): cada enlace expande la sección y hace scroll.
  16 secciones, cero opciones perdidas ni movidas.
- (S) La regla de los 4 sitios de `business_config` se verificó: **SANA**
  (159/159/114/58 claves, diferencias todas justificadas).

### A8 · Resto de módulos
- **Menú** (2ea8d31 — crítico): el normalizador duplicado de `menu/page.tsx` no
  copiaba `comboItems` ni `ivaRate` → **abrir y guardar un combo BORRABA sus
  artículos y reseteaba el IVA**. Además el modo simple reconstruía todo desde
  texto plano destruyendo precios de variación y vínculos de inventario, y el
  upsert permitía robar productos de otra sede. Los 3 corregidos (+preservación
  server-side de claves no enviadas, + gate de módulo en la API).
- **Reportes** (264289a): "Por método de pago" **doble-contaba** los pagos
  mixtos (sumaba el total a ambos métodos); ahora reparte lo realmente cobrado
  por moneda. Compras respetan el rango; fechas inválidas → 400; top de
  productos troceado (rangos grandes quedaban vacíos en silencio);
  `lowStockCount` sin tope de 10 y contando agotados sin mínimo.
- **Delivery** (d94bfc2): el bug P3 había REVIVIDO — 3 pantallas (delivery,
  panel de pedidos, dueño) tenían su copia con la tabla fija de zonas de
  Valencia y mostraban un envío inventado distinto al de caja. Eliminadas las
  3 copias → fuente única `lib/localOrderMoney` + fitness test que caza el
  antipatrón si reaparece. "Entrega reportada" exige pedido Listo (server).
- **Pagos/Stripe** (2af3de7): checkout sin rate-limit/origen/validación (se
  podía pagar un pedido anulado y sondear pedidos) → blindado; el webhook
  registraba como cobrado el TOTAL aunque el cobro fuera parcial, sin
  idempotencia, sin sede y sin bitácora → ahora pasa por `updateOrderPayment`.
- **Reservas + QR de mesa** (3d5b0a7): validaban contra las mesas GLOBALES en
  vez de las de la sede (el QR de "Mesa 5" de San Diego podía fallar o
  reservarse una mesa inexistente) → helper compartido por sede.
- **Privacidad** (3d5b0a7): `/api/public/open-accounts` devolvía la cuenta
  completa (teléfono y consumo del comensal anterior a cualquiera que
  escaneara el QR) → proyección mínima.
- **Auditoría** (3d5b0a7): la bitácora mezclaba las 2 sedes sin distinción →
  filtra por sede activa con toggle "Todas las sedes"; fechas en hora Caracas
  (el preset "Hoy" perdía las últimas 4 horas); fallos de escritura visibles.
- **Encuestas** (673965f): el auto-envío reclama la marca ANTES de mandar el
  WhatsApp — dos instancias serverless podían escribirle dos veces al cliente.
- **Eventos/Sucursales** (3d5b0a7): copiar configuración ya no arrastra
  `isEvent`/`eventEndDate` (la sede destino se auto-desactivaba); eliminado el
  módulo muerto `branchConfig.ts` (esquema incompatible sobre la misma clave).
- **Comprobantes** (3d5b0a7): se muestra la 2ª captura de los pagos mixtos.

## Seguridad transversal (base de todo) — commits f9804c2, 2af3de7
- **R3b**: `filterBranchesForAccess` fail-closed (un usuario `allBranches:false`
  sin sedes veía TODAS las sucursales — el mismo patrón que R3 cerró, en la
  función que usa `/api/branches` de verdad; el test anterior probaba una
  función gemela muerta).
- **H10**: se honra `x-staff-all-branches` del middleware — un encargado con
  "todas las sedes" quedaba clavado a la sede por defecto **operando la sede
  equivocada en silencio** mientras el selector le mostraba ambas.
- **H12**: `getDefaultBranchId` propaga el error de Supabase (antes null
  silencioso = todas las queries perdían el filtro de sede).
- **A7**: la sede por `Referer` queda solo para el flujo público (QR); un
  enlace externo ya no puede cambiar la sede de un panel autenticado.
- **RLS**: 26/26 tablas con RLS (0034) + fitness test que exige RLS a toda
  tabla nueva. `/api/local-auth` a 20 intentos/min (antes 60).
- Fitness de aislamiento ampliado: `supplier_purchase_payments`, `subrecipes`,
  `survey_responses`.

## Parte D — Vistas previas del rediseño público (2c84407)
- **`/previa`** = comparador de las 5 opciones (las 2 ideas en imagen + 3 vivas).
- **`/previa/idea-3` · Street Heat**: póster callejero en ámbar, marquees en
  movimiento, titulares gigantes, menú en carruseles con snap.
- **`/previa/idea-4` · Midnight Glass**: app premium de vidrio esmerilado,
  resplandor ámbar, burger en levitación, pills de categorías con resorte.
- **`/previa/idea-5` · El Ritual**: historia cinematográfica por capítulos a
  pantalla completa con scroll-snap y revelados.
- Todas usan el **logo script real**, fondo oscuro + acento ámbar, mobile-first,
  barra inferior, "Abierto ahora" y el **menú real** (APIs públicas, solo
  lectura). Rutas aisladas y `noindex`: **la página pública real quedó intacta**
  (cero cambios en `src/app/page.tsx` ni en componentes públicos).

## Turno nocturno (migraciones ya aplicadas por el dueño) — commits 31622e3..664e3b0
- **Tasa BCV**: el parser dejaba de reconocer tasas de 6+ dígitos (>99.999 Bs,
  escenario realista) y con separador de miles el match quedaba truncado — el
  sistema caía para siempre al fallback sin avisar. Corregido + test.
- **H9**: la herencia del origen de envío entre sedes ya no es muda — la API
  reporta `inherited` y Configuración muestra el aviso ("esta sede cotiza
  desde otra sucursal").
- **H6**: el auto-avance a Entregado (último producto entregado) deja
  bitácora y push al cliente como las demás puertas.
- **H7**: si la cuenta se cierra en la ventana del attach, el pedido queda
  suelto con nota visible para caja (antes 500 → el cliente reintentaba y
  DUPLICABA el pedido).
- **H15/H22**: el flujo público valida que la sede pedida exista y esté
  activa (id viejo en el navegador creaba pedidos invisibles); cachés de sede
  con TTL de 60 s (desactivar la sede principal ya no exige redeploy).
- **B5/B6/B4**: borrar una compra borra sus abonos (quedaban huérfanos
  restando en cierres); no se puede bajar el total por debajo de lo abonado;
  las columnas payables de `supplier_purchases` se sincronizan al abonar.
- **Alertas de inventario**: botones "Registrar compra" y "Copiar faltantes"
  (lista con cantidades sugeridas lista para WhatsApp al proveedor).
- **A8**: eliminado `canLocalAccessUseBranch` (código muerto); fechas de
  Comprobantes en hora Caracas.
- Rama respaldada en origin y fusionada a `brotherhood-publico` (SIN tocar
  `main`: producción no se despliega hasta que revises).

## PENDIENTE (justificado — no se ocultó nada)
1. **A1-auth**: la contraseña de rol sigue en `localStorage` viajando por
   header (estructural; migrar el panel 100% a Supabase Auth requiere
   coordinación contigo y con el dueño — R2/R3 lo mitigan, no lo cierran).
2. **H11**: en modo contraseña por rol, la sede 2 opera contra la sede 1 por
   diseño del blindaje R2. Decisión de producto pendiente: permitir
   `x-branch-id` validado o responder 409. (Los usuarios reales con Supabase
   Auth NO tienen este problema.)
3. **H20**: `GET /api/orders` sin ventana de fechas con polling de 2,5 s —
   optimización grande (paginación + mover despachos a cron), no un bug.
4. **A2-inventario**: variaciones/adicionales aún no descuentan inventario
   propio (falta el campo de vínculo en el editor; cambio de esquema+UI grande).
5. **B3/B7**: compra de proveedor no genera gasto automático (riesgo de doble
   conteo con el gasto manual — requiere decidir el flujo contigo); tipos
   text vs uuid en `supplier_purchase_payments` (migración de datos).
6. Rate limiting distribuido (Upstash/Redis) — hoy es por instancia.
7. Subrecetas siguen sin "producir" (decorativas); reportes `deliveryRevenue`
   suma el total del pedido, no solo el envío.

## Checklist del prompt
- Fases de bajo riesgo + tsc/tests/build por fase ✅ (16 commits, todos verdes)
- Migraciones en .sql sin asumir aplicación ✅ (0034, 0035)
- Aislamiento por sede reforzado + tests que fallan si una sede filtra ✅
- Apps hermanas intactas ✅ (solo archivos de este sistema)
- A1–A8 con (E)(S)(M) ✅ · Parte B ✅ · Parte C (este documento) ✅ · Parte D ✅

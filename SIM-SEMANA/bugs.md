# Bugs encontrados durante la semana

## BH-SIM-001 · CRÍTICO · El cliente público fabricaba su propio precio

- **E (Error)**: `POST /api/orders` (endpoint público del QR/checkout) confiaba en
  `items[].price` tal como llegaba del navegador. Un cliente hostil pidió una
  "Burger Doble Brutal" de $9.50 enviando `price: 0.01` y el pedido se guardó
  con `total_usd = 0.01`.
- **Evidencia**: Día 1, pedido `ord-ms5k7igt-uz0ogl9bl0` ("SIM Manipulador dia-1"),
  status 200, total guardado $0.01 (bitácora `SIM-SEMANA/dia-1.md`, check D1-ADV-5
  FALLA). El pedido quedó cancelado con motivo "SIM bug BH-SIM-001" como evidencia.
- **Impacto**: pérdida directa de dinero en cualquier pedido público; también
  permitía pedir productos con ids inexistentes o variaciones/adicionales con
  deltas inventados.
- **C (Causa raíz)**: `src/app/api/orders/route.ts` usaba `normalizeItems(body.items)`
  sin recalcular precios; `normalizeItems` (localOrderHelpers) limpia tipos pero
  conserva el precio del cliente. Los tests previos cubrían flujos de staff
  (donde el precio libre es una función, no un bug) y ningún test adversarial
  público existía.
- **F (Fix)**: nueva lib `src/lib/publicOrderGuards.ts` — para peticiones SIN
  identidad de staff (`getRequestAccess` no-ok), `repricePublicOrderItems()`
  recalcula el precio unitario desde el menú real de la sede (base + delta real
  de la variación + adicionales por cantidad, aceptando id o nombre) y rechaza
  con 400 productos/opciones que no existen o están inactivos. El staff conserva
  ítems manuales. Menú resuelto con `getPublicMenuProductsForBranch` (la misma
  herencia de sede que ve el cliente).
- **S (Blindaje)**: `src/lib/__tests__/publicOrderGuards.test.ts` (12 tests:
  precio fabricado, variación mentirosa, adicional inventado, producto fantasma,
  producto inactivo, carritos viejos por nombre).
- **V (Verificación)**: test rojo antes (módulo inexistente) → verde después;
  reintento empírico contra el server vivo: precio fabricado ahora se guarda en
  $9.50; producto fantasma → 400; cliente honesto y staff intactos. `tsc` OK,
  vitest 568/568.
- **Riesgo residual**: productos "armables" (buildable) con reglas de precio
  fuera de variaciones/adicionales/ingredientes deben revisarse antes de llevar
  este fix a producción (el menú real de Brotherhood usa plantilla armable v2 —
  probar en staging el carrito armable completo).

## BH-SIM-002 · CRÍTICO · La tasa de cambio del pedido la decidía el cliente

- **E (Error)**: el pedido público guardaba `exchangeRate` del cliente y el cobro
  (`updateOrderPaymentInStore`) convierte los Bs recibidos con LA TASA DEL
  PEDIDO. Con tasa fabricada baja (p. ej. 4 en vez de 40), Bs 64 se convertían
  en $16 "recibidos": pedido Pagado con ~10% del dinero real.
- **C (Causa raíz)**: misma confianza en el payload público; la tasa viaja desde
  el cliente porque el checkout la muestra, pero nunca se re-validaba.
- **F (Fix)**: `resolvePublicExchangeRate()` — si el negocio tiene tasa manual
  configurada (global o por sede), esa tasa PISA la del cliente en pedidos
  públicos; sin tasa del servidor sobrevive la del cliente solo si es positiva
  (modo automático BCV documentado como riesgo residual menor).
- **S (Blindaje)**: 3 tests en `publicOrderGuards.test.ts`.
- **V (Verificación)**: pedido público con `exchangeRate: 4` quedó guardado con
  tasa 40 (verificado contra el server vivo). La simulación fijó
  `exchangeRateMode=manual, manualExchangeRate=40`.
- **Nota para producción**: Brotherhood usa tasa BCV automática — evaluar
  extender el clamp al último valor cacheado de BCV antes del deploy.

## BH-SIM-003 · ALTO · El cobro directo ignoraba el candado optimista que caja le enviaba

- **E (Error)**: `PATCH /api/orders/:id/payment` nunca propagaba
  `expectedPrevious` al store. Reproducción real del Día 5: María Fernanda
  cobró $10 en efectivo (primera pata de un pedido de $19); Kelvin, con la
  tarjeta de caja desactualizada, cobró $19 por Zelle **enviando
  `expectedPrevious: {amountReceivedUSD: 0}`**. El servidor respondió 200 y
  el pedido quedó en "$19 Zelle": **los $10 en efectivo desaparecieron del
  registro**. El cliente pedía protección y se le ignoraba en silencio.
- **Evidencia**: check D5-CONC-1 (dos cajeros cobrando el mismo pedido:
  `ganadores=2`) + reproducción dirigida sobre el pedido
  `ord-ms5o13ee-pcwx8plyvq`.
- **Impacto**: el arqueo no cuadra — la gaveta tiene $10 en efectivo que
  ningún registro respalda, y el cierre reporta un método que no se cobró.
  Afecta a cualquier local con dos cajas abiertas sobre los mismos pedidos.
- **C (Causa raíz)**: el candado SÍ existe en
  `src/lib/ordersStorePayments.ts` (`expectedPrevious` → UPDATE condicional) y
  lo usan `/api/open-accounts/[accountId]` y la revisión de comprobantes; el
  endpoint de cobro directo se quedó fuera al añadirse el candado. `getPaymentInput`
  no leía el campo y el spread lo perdía. Ningún test cubría el cobro directo
  concurrente (los de concurrencia existentes iban por cuentas abiertas).
- **F (Fix)**: nueva lib `src/lib/orderPaymentInput.ts` con
  `readExpectedPrevious()` (acepta el candado en la raíz o dentro de
  `body.payment`, normaliza montos sucios) y su propagación en la ruta de
  cobro. Además, `OrderPaymentConflictError` ahora responde **409** en vez de
  un 500 opaco, para que la tarjeta de caja se refresque y quien pierde la
  carrera vea los montos frescos.
- **S (Blindaje)**: `src/lib/__tests__/orderPaymentOptimisticLock.test.ts`
  (5 casos: candado presente, candado en cero, dentro de `payment`, ausente
  —compatibilidad—, y montos sucios).
- **V (Verificación)**: tras el fix, el mismo escenario da **409** y el
  efectivo de María sobrevive; la segunda pata legítima (candado con montos
  frescos) pasa con 200; el cobro normal sin candado sigue funcionando.
  `tsc` OK, vitest 573/573.
- **Nota**: el fix es **compatible hacia atrás** — un cobro sin candado se
  comporta igual que antes. El siguiente paso (fuera del alcance de esta
  semana) es que la UI de caja envíe siempre el candado; hoy lo envían las
  cuentas abiertas y la revisión de comprobantes.

---

## Falsos positivos de la simulación (corregidos en el guion, NO son bugs del sistema)

Se documentan para que nadie los persiga como si fueran defectos.

### D5-EVT-4 — "el reporte por vendedor está vacío"

**No es un bug.** La atribución de ventas por vendedor y por registrador vive
en el **cierre de caja** (`salesBySeller` / `ordersByRegistrar` en
`/api/day-close`), no en `/api/reports`. Mi check buscaba la clave en el
endpoint equivocado.

Verificado correctamente después: un cierre con
`salesBySeller: [{Vanessa, 2 ventas, $26}, {Anthony, 1 venta, $14}]` se guarda
y se relee **intacto** (incluido el desglose de combos y delivery). La
atribución individual del pedido también está: `charged_by_name = "Vanessa"`
en las ventas que ella cobró (check D5-EVT-3 en verde).

Lo que sí queda como observación para el dueño: el motor de la simulación arma
sus cierres con métodos y totales, sin enviar `salesBySeller`. Por eso los 14
cierres de la semana lo tienen vacío. En la app real ese arreglo lo compone la
pantalla de cierre, que sí lo llena.

### D1-CX-1 — "el mesonero no pudo cancelar"

**No es un bug, es el diseño correcto.** `canRoleUpdateStatus` reserva la
anulación a dueño, encargado y cajero; el mesonero solo entrega. Mi guion del
Día 1 hacía cancelar a Anthony (mesonero). Corregido: cancela la encargada, y
el intento del mesonero quedó documentado como prueba negativa de permisos.

### D1-ADV-7 — "el comprobante con 9.648,99 fue rechazado"

**No es un bug, es el escudo P-1 funcionando.** La referencia que envié
(`SIM-D1-9648`) tenía menos de 6 dígitos y el servidor la rechaza — esa regla
se blindó en la ronda del 2026-07-28 precisamente para que no viviera solo en
el navegador. Con una referencia válida (`004521998877`) el comprobante entra
a revisión con el monto `9.648,99` correcto (check D1R-ADV-7 en verde).

---

## BH-SIM-004 · MEDIO-ALTO · La venta con el stock ya en cero desaparecía del historial de inventario

- **E (Error)**: cuando el stock de un insumo llega a 0 y se siguen vendiendo
  productos que lo consumen, el sistema **no registraba ningún movimiento**: la
  venta era invisible en el historial de inventario. El faltante PARCIAL sí se
  registraba ("faltaron 2 unidades"), pero el TOTAL no.
- **Evidencia**: check `dia-6-NOCHE-inventario` (Refresco 1.5L en San Diego:
  libro esperado −15, sistema 0) + repro aislada con un insumo de prueba:
  vender 5 unidades con stock 0 dejó **0 movimientos**, y el pedido se creó y
  se pudo cobrar igual ($25).
- **Impacto**: el dueño no puede reconciliar. Salieron 15 refrescos de la
  nevera y el historial no lo menciona; un conteo físico no cuadra con nada y
  no hay rastro de cuánto se vendió sin stock. No pierde dinero (la venta se
  cobra), pero corrompe la trazabilidad del inventario, que es justo lo que
  §24 del Prompt Maestro exige buscar ("inventario sin historial").
- **C (Causa raíz)**: `src/lib/ordersInventory.ts`, bucle de consumo:
  `const moved = Math.min(previousQuantity, line.quantity); if (moved <= 0) break`
  — con `previousQuantity = 0` el `break` salía ANTES de insertar el
  movimiento. La corrección anterior del faltante (el comentario decía "antes
  se clampaba a 0 sin rastro") solo cubrió el caso parcial: quedó a medias.
- **F (Fix)**: nueva lib `src/lib/inventoryShortage.ts` con
  `buildConsumptionMovement()`, que decide por caso: consumo normal, faltante
  parcial y faltante total. Con stock 0 se registra igual un movimiento de
  cantidad 0 con "(faltaron N unidades)" y **sin** tocar la fila del insumo
  (no hace falta). El stock sigue sin irse a negativo — esa decisión de
  negocio se respeta.
- **S (Blindaje)**: `src/lib/__tests__/inventoryShortageTrace.test.ts`
  (5 casos: normal, parcial, total, fraccionado con precisión, pedir 0).
- **V (Verificación)**: repro tras el fix — vender 3 con stock 1 deja
  "faltaron 2"; vender 4 más con stock 0 deja **"faltaron 4"** con
  `0→0 mov=0`; el stock sigue en 0, nunca negativo. `tsc` OK, vitest 578/578.
- **Mejora que NO hice (decisión tuya)**: el sistema permite vender con stock
  en cero. Bloquearlo sería un cambio de política de negocio — hay locales que
  quieren seguir vendiendo y ajustar después. Ahora al menos queda registrado.
  Si quieres que se bloquee o que avise a caja, dímelo.

---

## BH-SIM-005 · MEDIO · Anular un pedido YA COBRADO deja el dinero fuera del reporte del dueño

- **E (Observación con impacto contable)**: el pedido `SIM Elena Salazar dia-6#1`
  se vendió, se cobró ($12,50 en la gaveta) y luego se anuló. Resultado:
  - la fila conserva `payment_status = "Pagado"` y
    `payment_received_equiv_usd = 12,50` (el dinero está registrado);
  - el **cierre de caja** lo cuenta como dinero recibido (correcto: está en la
    gaveta);
  - pero el **reporte del dueño** lo excluye por completo — ni en ventas ni en
    cobrado. Consolidado del reporte: $6.632,50; libro y cierres: $7.063,50.
- **Impacto**: el dueño que compara "lo que dice el reporte" con "lo que hay en
  la gaveta" encuentra una diferencia que ningún módulo explica. En la semana
  hubo **$12,50 de operación real** en esta situación (los otros $47,50 de
  dinero atrapado en anulados son mis pedidos de diagnóstico, no operación).
- **C (Causa)**: los reportes filtran `status != "Cancelado"` para TODO,
  incluido el dinero ya recibido. No existe el concepto de "venta anulada con
  devolución pendiente" ni una línea de devoluciones.
- **F (Fix NO aplicado — es una decisión de negocio tuya)**: hay tres caminos
  y no me corresponde elegirlo:
  1. **Bloquear** la anulación de un pedido ya cobrado (obligar a un reembolso
     explícito primero);
  2. **Mostrarlo como devolución**: el reporte resta el monto en una línea
     "Devoluciones" en vez de hacerlo desaparecer;
  3. **Dejarlo como está** y que el cierre mande (hoy el cierre sí lo cuenta).
  Mi recomendación es la 2: no pierde el rastro y el arqueo cuadra.
- **S (Blindaje)**: pendiente hasta que elijas la política. El escenario ya
  está cubierto por el guion (`D6-CX-PAGADO`) y se detecta en la
  reconciliación semanal.
- **Nota**: NO es pérdida de dinero — el dinero está registrado y el cierre lo
  cuenta. Es una **inconsistencia entre reporte y cierre** que confunde al
  dueño.

---

## BH-SIM-006 · CRÍTICO (atrapado ANTES de producción) · El fix del precio rompía TODAS las burgers armables

- **E (Error)**: el guard de BH-SIM-001 rechazaba con 400 cualquier pedido de un
  producto **armable** (buildable) en el que el cliente eligiera **más de una
  sección**. Como las 68 burgers de Brotherhood son armables con 3 grupos
  obligatorios (Tipo / Proteína / Custom fries), fusionar el fix tal cual
  **habría tumbado el producto principal del negocio**.
- **Evidencia**: `scripts/sim/probar-armable.mjs` reproduce la estructura real
  de `scripts/brotherhood-burger-armable-v2.mjs` y pide como pide el carrito
  real. Antes del fix: 3 de 4 armados legítimos daban 400 con "El menú cambió
  mientras armabas tu pedido".
- **C (Causa raíz)**: `src/components/ProductCard.tsx` colapsa todas las
  secciones elegidas en **una sola** variación con el nombre unido por `" · "`
  y **sin id** (`"Smash · Mixta · Cheddar"`). Mi guard buscaba ese nombre
  compuesto entero en el índice de opciones, donde solo estaban las partes
  sueltas. Mi primera batería de tests solo cubría productos de una sección.
- **F (Fix)**: `lookupOption()` ahora, si no encuentra el nombre entero y este
  contiene el separador, lo parte y **suma los deltas reales de cada parte**.
  Si una sola parte no existe en el menú, el pedido se rechaza igual que antes
  — la protección no se debilita.
- **Segundo defecto que destapó la misma prueba**: variaciones y adicionales
  compartían un solo espacio de nombres. Una opción de Custom Fries llamada
  "Tocineta" ($2,50) y el adicional "Tocineta" ($1,50) se pisaban, y el total
  salía $1 más barato. Ahora son dos mapas separados
  (`variationDeltas` / `addonDeltas`). En el menú real de hoy no colisionan por
  poco, pero el dueño edita el menú y la plantilla es aditiva.
- **Tercer detalle**: los nombres de los GRUPOS ya no se indexan como opciones
  elegibles — antes `"Proteína · Carne"` habría pasado como armado válido.
- **S (Blindaje)**: 8 casos nuevos en `publicOrderGuards.test.ts` (una
  sección, dos, tres con recargos, el armado más cargado con adicionales por
  cantidad, deltas mentirosos, parte inexistente, nombre de grupo, separadores
  con espaciado irregular). Total del archivo: 20 tests.
- **V (Verificación)**: `probar-armable.mjs` 8/8 contra el servidor —
  el cliente honesto paga exacto en los 4 armados, el atacante que manda
  deltas negativos paga $14,50 en vez de $0,50, y una opción inventada dentro
  del armado sigue dando 400. Además `regresion-precios.mjs` 6/6: normal,
  variación, adicionales con cantidad, combo, carrito de 3 líneas y el ítem
  manual del staff.
- **Lección**: el riesgo estaba anotado en `TE-TOCA-A-TI.md` como "probar antes
  de fusionar". Probarlo costó una hora; no probarlo habría costado un día de
  ventas.

---

## BH-SIM-002 (2ª parte) · CRÍTICO · La tasa solo se blindaba en modo manual — y en producción estaba en automático

- **E (Error)**: el primer fix imponía la tasa del servidor **solo** cuando el
  negocio la tenía en MANUAL. Brotherhood usa tasa automática, así que en
  producción el hueco seguía abierto. **Verificado en el sitio en vivo** tras el
  primer deploy: un pedido público con `exchangeRate: 4` se guardó con tasa 4.
- **Impacto**: el cobro convierte `Bs recibidos / tasa_del_pedido`. Con tasa 4,
  reportar Bs 32 por una burger de $8 la daba por **PAGADA**. Lo único que lo
  frenaba era que la cajera notara el monto raro.
- **F (Fix)**: `src/lib/serverExchangeRate.ts` — la tasa la pone el servidor en
  los **tres** modos (manual, dólar BCV y **euro BCV**), reutilizando la misma
  caché que sirve `/api/exchange-rate` (no añade una llamada al BCV por
  pedido). Si la fuente falla devuelve 0 y sobrevive la del cliente: nunca deja
  al negocio sin poder cobrar en bolívares.
- **S (Blindaje)**: `serverExchangeRate.test.ts` (7 casos: los tres modos,
  manual inválido, fuente caída en dólar y en euro, tasa absurda).
- **V (Verificación)**: `probar-tasa.mjs` 7/7 — con la tasa impuesta, pagar los
  Bs que bastaban con tasa 4 deja el pedido en "Pago parcial" ($0,04 de $8) en
  vez de Pagado. El staff conserva su tasa propia.

## BH-SIM-007 · ALTO · La opción "Tasa BCV (euro)" de Configuración no se guardaba

- **E (Error)**: la pantalla de Configuración ofrece los tres modos, pero
  `POST /api/business-config` solo reconocía `manual` y `automatic`: elegir
  **euro** se guardaba como **dólar** sin avisar. El dueño veía la opción
  marcada en su navegador y el negocio seguía cobrando con la tasa del dólar.
- **Evidencia**: se envió `exchangeRateMode: "automaticEur"` y la base quedó en
  `"automatic"`. `/api/exchange-rate` devolvía `currency: "USD"`.
- **Impacto directo en Brotherhood**: cobra con la tasa EURO. Con el euro a
  846,07 y el dólar a 744,23, cobrar con la tasa equivocada es un **12% menos
  de bolívares por cada venta**.
- **C (Causa raíz)**: `readExchangeRateMode()` en la ruta hacía
  `normalized === "manual" ? "manual" : "automatic"`. La config **por sede**
  (`normalizeBranchScopedConfig`) sí manejaba el euro — la global se quedó
  atrás, y nadie lo notó porque el guardado responde 200.
- **F (Fix)**: `src/lib/exchangeRateModeInput.ts` con la regla única de los tres
  modos, usada por la ruta.
- **S (Blindaje)**: `exchangeRateModeInput.test.ts` (6 casos, incluidas las
  variantes de escritura y la basura que debe caer al dólar).
- **V (Verificación)**: `probar-tasa.mjs` TASA-3/TASA-4 — el modo euro guarda,
  `/api/exchange-rate` devuelve `currency: "EUR"` con 846,07 (≠ 744,23 del
  dólar) y el pedido público se guarda con esa tasa.
- **TE TOCA A TI**: el modo sigue en **dólar** en la configuración de
  Brotherhood. Ahora que el guardado funciona, entra en Configuración →
  "Tasa BCV (euro)" y actívalo.

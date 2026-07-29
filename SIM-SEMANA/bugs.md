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

# Barrido punto por punto de lo que quedó a medias (§26 → encargo 2026-07-29)

Cierre del barrido de `PROXIMA-SESION.md` §4-bis, en el formato del §25.
Cada punto: Estado · Evidencia · Comando · Archivo · Test · Pendiente.

---

## §9 · Reloj de negocio

**Objetivo**: bordes de medianoche y zonas horarias que la semana no ejercitó
(los timestamps reales no se falsean, regla §9).

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Antes de medianoche (23:59:59.999 Caracas) | **PASS** | `businessClockCaracas.test.ts` — "un instante ANTES de medianoche sigue siendo el día anterior" |
| Exactamente al cambio de día (00:00:00.000) | **PASS** | mismo archivo — "EXACTAMENTE a medianoche ya es el día siguiente" |
| Después de medianoche (00:00:00.001) | **PASS** | mismo archivo |
| Cruce de mes y de año | **PASS** | mismo archivo (31-ago→1-sep, 31-dic→1-ene) |
| Zona del SERVIDOR | **PASS** | `getDateKeyInCaracas` usa `Intl` con `timeZone: "America/Caracas"` explícito ([domain.tsx:1468](src/app/pedidos/domain.tsx)): el TZ del proceso no participa |
| Zona de la BASE | **PASS** | Supabase devuelve timestamps con offset explícito; test del formato Postgres (`"2026-08-04 03:59:59+00"`) en verde |
| Zona del NAVEGADOR | **PASS** | misma razón (Intl con zona fija); las DOS copias del reloj (pedidos y cierres) se comparan entre sí en el test para que no diverjan |
| Cierre iniciado antes y completado después de medianoche | **PASS con OBSERVACIÓN** | el filtro por fechas del historial usa `createdAt` (cuándo se GUARDÓ), no el día que el cierre resume: un cierre del sábado guardado el domingo 00:05 no aparece filtrando "solo sábado" (sí en el rango completo, y su `dateLabel` muestra el día correcto). Documentado en el test — cambiarlo es decisión de producto, no fix silencioso. |

- **Comando**: `npx vitest run src/lib/__tests__/businessClockCaracas.test.ts` → 10/10.
- **Test (S)**: `src/lib/__tests__/businessClockCaracas.test.ts` (nuevo).

## §15 · Pruebas de dinero (formatos que faltaban)

**Objetivo**: completar la lista del guion sobre el parser canónico
(`src/lib/publicMoneyInput.ts`), añadiendo al test existente — no a uno nuevo.

| Formato | Estado | Resultado |
| --- | --- | --- |
| `0,00` / `0.01` / `0,01` | **PASS** | 0 · 0.01 · 0.01 |
| `1` / `1,5` / `1,50` | **PASS** | 1 · 1.5 · 1.5 |
| `3.632` sin decimales | **PASS (ambigüedad documentada)** | 3.63 — indecidible sin contexto, resuelto IGUAL en todo el sistema |
| Símbolos de moneda (`Bs 9.648,99`, `$10`, `250 Bs`) | **PASS tras FIX** | ver (E) abajo |
| Texto inválido (`12abc`, `1.2.3`, `Bs`) | **PASS** | 0 (basura nunca es un monto a medias) |
| Más de dos decimales | **PASS** | redondeo a céntimos (10.123→10.12) |
| Números muy grandes | **PASS** | `999.999.999,99` y 12 dígitos sin perder céntimos |

- **(E)** El monto se MUESTRA "Bs 9.648,99"; el cliente que lo copiaba CON el
  "Bs" reportaba **0** — la misma clase de bug que motivó el parser, por el
  símbolo en vez del punto de miles.
- **(C)** Ninguna de las tres copias de la regla limpiaba prefijos/sufijos de
  moneda antes de parsear.
- **(F)** Limpieza `Bs/bs./$/€` al borde en las TRES copias a la vez
  ([publicMoneyInput.ts](src/lib/publicMoneyInput.ts), `parseMoneyInput` de
  [localOrderMoney.ts](src/lib/localOrderMoney.ts), `cleanMoney` de
  [payment-proofs/route.ts](src/app/api/payment-proofs/route.ts)) — la regla
  es UNA y debe seguir siéndolo.
- **(S)** 7 casos nuevos en `publicMoneyInput.test.ts` (15/15).
- **Comando**: `npx vitest run src/lib/__tests__/publicMoneyInput.test.ts`.

## §18 · Fallos parciales — familia "operación a medias"

**Objetivo**: qué pasa cuando una operación de dos pasos muere en el medio.
Analizado en el código y blindado donde hacía falta:

| Escenario del guion | Estado | Qué se encontró |
| --- | --- | --- |
| Compra guarda factura pero falla el stock | **PASS tras FIX (el orden real es el inverso)** | el flujo real aplica stock ANTES y la factura DESPUÉS ([ordersStoreSupplierPurchases.ts](src/lib/ordersStoreSupplierPurchases.ts)). Los dos huecos reales: (a) factura falla → stock inflado + movimiento "Compra" apuntando a factura inexistente; (b) movimiento falla → stock cambiado SIN rastro (BH-SIM-004 al revés). **(F)** compensación con lock optimista: reversa del stock + borrado del movimiento huérfano, propagando el error original. **(S)** `supplierPurchasePartialFailure.test.ts` (3 casos, incluido camino feliz sin cambios). |
| Pago guarda cabecera pero falla la pata | **PASS por construcción** | cabecera y patas viven en la MISMA fila de `orders` (las patas van codificadas en `payment_method`; `orderPaymentLegs.ts` las parsea de esa única columna). El cobro es UN `UPDATE` ([ordersStorePayments.ts:86-92](src/lib/ordersStorePayments.ts)): no existe estado intermedio posible. |
| Pedido se crea pero falla la auditoría | **PASS por diseño** | `writeAuditLog` JAMÁS lanza ([audit.ts:128-158](src/lib/audit.ts)): try/catch interno + `captureError` a monitoreo. El pedido sobrevive y la falla de bitácora queda reportada, no silenciada (regla de la auditoría 2026-07-24). |
| Cierre calcula pero falla la confirmación | **PASS tras FIX** | el reinicio hace 2 pasos: POST del cierre → DELETE de pedidos. Si el 2º fallaba, el REINTENTO volvía a guardar OTRO cierre con el mismo dinero (duplicado en el historial). **(F)** la pantalla recuerda el día ya cerrado (`dayCloseSavedForRef`) y el reintento salta el POST; el flag se limpia al completar el reinicio (el doble turno del mismo día sigue funcionando). **Residual documentado**: si el navegador se RECARGA entre los dos pasos, el flag se pierde y el duplicado vuelve a ser posible — protegerlo del lado servidor exige una política de deduplicación que hoy chocaría con los cierres múltiples legítimos por turno. |

- **Comando**: `npx vitest run src/lib/__tests__/supplierPurchasePartialFailure.test.ts` → 3/3.

## §11.5 / §20 · Rendimiento y accesibilidad

- **Rendimiento**: comparación explícita medido-vs-umbral en
  [rendimiento-vs-umbrales.md](SIM-SEMANA/rendimiento-vs-umbrales.md).
  Resumen: contra el dev server local (disco lento, ráfagas intencionales),
  **6 de 8 operaciones NO cumplen** el umbral del guion; los p50 sí están
  cerca. El propio guion exige documentar que Vercel producción tiene otro
  perfil — medirlo allá queda **PENDIENTE**, no se marca PASS por fe. Señal
  real a vigilar: `PATCH open-account pay` es siempre lo más pesado.
- **Accesibilidad (§20)**: ~~BLOCKED~~ → **PASS (2026-07-29 tarde)** con
  Playwright + axe instalados por orden del usuario: suite `e2e/` 15/15
  contra el build de producción local (base de PRUEBA). Cubre PWA, SW,
  offline real, multipestaña, sesión expirada, rol, axe WCAG A/AA (0
  críticas tras arreglar las etiquetas del login), teclado, responsive y
  doble-envío. Pendiente de decisión del dueño: 2 nodos de contraste
  ("serious") — es la paleta de la marca, no se cambia desde un test.

## Estado de los bloqueos que dependen del usuario

- ~~Playwright~~ → **RESUELTO** (ver arriba).
- ~~VAPID (push real)~~ → **RESUELTO** (2026-07-29 noche): claves de
  simulación generadas + `probar-push.mjs` 7/7 (firma VAPID, cifrado RFC
  8291, payload real descifrado); producción YA tenía VAPID (comprobado
  enabled:true). Última milla (pantalla del dispositivo) = teléfono real.
- WhatsApp/Meta de prueba (envíos) · Impresora física (80mm) · caída real de
  la base gestionada: siguen **BLOCKED**.

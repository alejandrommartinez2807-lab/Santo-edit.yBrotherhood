# Encargo para la próxima sesión

Todo lo que quedó pendiente de `PROMPT-MAESTRO-CERTIFICACION-TOTAL.md` y
`PROMPT-SEMANA-REAL.md`, más la decisión de negocio que el dueño ya tomó.

**Cómo arrancar**: leer este archivo, `bugs.md`, `pendientes.md` y
`estado.json`. El entorno de simulación ya existe y está verificado
(proyecto de prueba `gnyvdlxlrjwbsdctincy`, `.env.simulacion` en la raíz).
Receta completa en `resumen-final.md`.

---

## 1. DECISIÓN TOMADA: qué pasa al anular un pedido (cierra BH-SIM-005)

El dueño decidió esto y hay que implementarlo. **No es negociable ni hay que
volver a preguntarlo.**

### La regla

1. **Anular un pedido quita TODO su dinero — también del cierre de caja.**
   Hoy el dinero de un pedido anulado ya cobrado desaparece del reporte pero
   SIGUE contando en el cierre. Eso se acaba: sale de los dos.
2. **El dueño tiene que poder ver los pedidos anulados y cancelados EN TODO
   MOMENTO.** No es un dato que se consulta con esfuerzo: tiene que estar a la
   vista.
3. **Tiene que verse si se descontaron del inventario los insumos que lo
   componen**, para cada pedido anulado.
4. **Jamás se pierde la información de un pedido anulado.** Nada de borrarlo,
   nada de vaciarle campos.
5. **Siempre se sabe el motivo.** El motivo ya es obligatorio al anular
   (mínimo 5 caracteres); hay que garantizar que se muestra siempre junto al
   pedido, no solo en Auditoría.

### Lo que hay que tocar (verificar antes, no asumir)

- **Cierre de caja** (`/api/day-close`, `lib/ordersDayClose.ts`): el dinero de
  los pedidos anulados debe salir de `realCollectedUSD`, del desglose por
  método y del efectivo. Hoy no sale.
- **Reportes** (`/api/reports`): ya los excluye — comprobar que quedan
  coherentes con el cierre después del cambio.
- **Vista de anulados**: comprobar qué existe hoy en Historial/Auditoría y qué
  falta para cumplir los puntos 2, 3 y 5.
- **Inventario**: el pedido ya guarda `inventoryWasUsed` (si los insumos se
  consumieron o volvieron al stock). Hay que exponerlo en la vista de anulados.

### Cómo se resuelve el dinero ya cobrado (decidido 2026-07-29)

Anular ya le hace UNA pregunta al cajero (`window.confirm` en
`src/app/pedidos/page.tsx:2504` y `src/app/local-santo/caja/page.tsx:374`):
*"¿Ya se usaron o prepararon los ingredientes?"*. Se añade una **segunda
pregunta con la misma forma**, y solo cuando el pedido tenga dinero cobrado:

> Este pedido tiene $X cobrados. ¿Le devolviste el dinero al cliente?
> Aceptar = SÍ, se lo devolví (sale de la caja del día)
> Cancelar = NO, el dinero se quedó (sigue en la caja del día)

- **Devuelto** → sale del cierre y de los reportes (la regla del dueño).
  Queda registrado como devolución con monto, autor y fecha.
- **Se quedó** → sigue contando en el cierre porque está en la gaveta y el
  arqueo tiene que cuadrar, pero **nunca como venta**: en una línea aparte,
  "cobrado de pedidos anulados".

### ⚠️ El default es un SUPUESTO, no una confirmación

**El dueño todavía NO ha confirmado** qué hacen en la práctica. Instrucción
del usuario (2026-07-29): *"por lo menos por el momento ellos devuelven el
dinero"*. Así que:

- **Por defecto se asume DEVUELTO**: es la opción primaria del diálogo y
  también lo que se aplica si la anulación llega sin respuesta (API, script,
  cliente con caché vieja).
- **Riesgo conocido de ese supuesto**: si en la práctica a veces el cliente se
  va y el efectivo se queda, el cierre reportará **menos** de lo que hay en la
  gaveta y la cajera aparecerá con un faltante que parece un descuadre suyo.
- **Cuando el dueño confirme**, invertir el default es un cambio de una línea.
  Dejarlo aislado en una constante bien nombrada para que se pueda voltear sin
  tocar la lógica.

---

## 2. Los 3 scripts que el §4 del guion pedía y no se escribieron

Van en `scripts/sim/`:

- **`run-week.mjs`** — corre la semana completa de un tirón (Día 0 → Día 7 →
  reconciliación), respetando que **nunca haya dos días a la vez**
  (`estado.json` es único y dos procesos lo corromperían).
- **`resume-week.mjs`** — reanuda desde el checkpoint real de `estado.json`,
  no desde memoria. Hoy se hace a mano con `--day=N`; hay que empaquetarlo.
- **`reset-simulation.mjs`** — limpia la base de PRUEBA. **Solo puede borrar
  si el guard está en verde y el `SIMULATION_RUN_ID` coincide**; jamás debe
  poder apuntarse a producción.

## 3. `plan-semanal.json` (§5 y §10)

El calendario determinista de rotación de personal existe **en código** (el
objeto `SHIFTS` de `scripts/sim/dias-2-7.mjs`) pero el guion lo pedía como
archivo en `SIM-SEMANA/`. Volcarlo, incluyendo turno, caja, mesas,
responsabilidad y sede de cada persona por día.

## 4. Los 3 módulos sin probar

Marcados `NOT_APPLICABLE` en `informe-por-modulo.md` porque el guion de la
semana no definía escenarios — pero eso es una explicación, no una prueba.
Hay que ejercitarlos de verdad:

- **Reservas** (§16.16): crear, editar, cancelar, confirmar, no-show, horario
  inválido, mesa ocupada, doble reserva, capacidad, aislamiento por sede,
  notificación, y la conversión en cuenta o pedido si existe.
- **Encuestas** (§16.17): crear, responder, evitar duplicado, asociar pedido,
  sede, privacidad. Ojo: el envío por WhatsApp depende de Meta y queda
  `BLOCKED`; lo interno sí se puede probar.
- **Soporte** (§16.17): ticket, estado, asignación, historial, permisos y
  datos sensibles.

## 5. Bloqueos que dependen del usuario (no de la sesión)

Siguen abiertos y **no se pueden marcar PASS** sin resolverlos:

- **Playwright** no instalado → PWA, Service Worker, offline real y
  multipestaña de navegador quedan `BLOCKED` (regla §11.4).
- **VAPID** sin configurar → entrega real de push `BLOCKED`.
- **WhatsApp/Meta de prueba** sin credenciales (las de producción están
  prohibidas) → envíos `BLOCKED`.
- **Impresora física** → impresión de comanda y recibo 80mm `BLOCKED`.

## 6. `main` / Santo Perrito

Tiene el **mismo agujero de precio** que tenía Brotherhood (BH-SIM-001) y
**no está fusionado**. Antes de llevarlo hay que probar la forma de SU menú,
igual que se hizo con el armable de Brotherhood — ahí es donde el fix casi
rompe el producto principal.

---

## Estado de Brotherhood al cerrar esta sesión

- 7 fixes desplegados y verificados en vivo (`brotherhood-xi.vercel.app`).
- **Tasa EURO activada** en producción: 846,07 (antes 744,23 en dólar, +13,7%
  de bolívares por venta). Respaldo del valor anterior en el scratchpad de la
  sesión.
- Reconciliación semanal 17/17 con $0,00 de diferencia.
- `tsc` limpio · 599 tests · build OK · árbol de git limpio.

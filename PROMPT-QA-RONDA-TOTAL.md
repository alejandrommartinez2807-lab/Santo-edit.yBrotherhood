# Prompt — Ronda de pruebas REALES: inventario, proveedores, cuentas por pagar, sedes, mesoneros, reportes, cierre y aislamiento por sede

> Pega este archivo completo como primer mensaje de la sesión nueva.
> Escrito el 2026-07-26. Objetivo: **probar el sistema usándolo**, no leyéndolo.

---

## 0. Contexto

Repo `D:\Santo edit`, rama **`brotherhood-publico`**. Next.js 16 + Supabase. Es el menú público + POS de **Brotherhood**, una hamburguesería con **2 sedes**.

**El dueño del proyecto ya autorizó probar sobre el sistema real y crear datos de prueba**: la app todavía está en desarrollo, así que pedidos, insumos, proveedores, mesas, QR y sedes de prueba se pueden crear sin pedir permiso (ver punto 1).

Sedes actuales (verifícalas en `branches` antes de usarlas, están tomadas de `AUTO-VERIF-MULTISEDE.md`):
- San Diego `3d8a8527-4b0b-4c81-aeb7-0c69454c63f6`
- Viñedo `04fb974d-bd2d-4086-ae9e-c74653309b04`

Módulos que entran en esta ronda (todos existen ya):
`inventario`, `inventario-alertas`, `subrecetas`, `proveedores`, `compras`, `cuentas-por-pagar`, `control-gastos`, `sucursales`, `mesas`, `mesonero`, `usuarios`, `caja`, `cierres`, `reportes`, `dueno`, `auditoria`, `comprobantes`, `menu-avanzado` y el menú público (QR).

---

## 1. Dónde se prueba: **sobre el sistema real, y sí puedes crear datos**

`.env.local` apunta al Supabase real de Brotherhood (el mismo que sirve la página en vivo, `brotherhood-xi.vercel.app`). **El dueño ya dijo que adelante**: la app sigue en desarrollo, así que **no pares a pedir permiso** para crear pedidos, insumos, productos, proveedores, facturas, mesas, QR ni sedes de prueba. Crear datos es justamente el encargo.

No hace falta montar un Supabase aparte. Higiene mínima, no burocracia:

- **`npm run backup` antes de la primera escritura** (guarda la ruta del JSON en el informe). Es la red por si algo sale mal; `scripts/restore.mjs` revierte.
- **Prefijo `ZZTEST-`** en el nombre de todo lo que crees (insumos, proveedores, productos, sedes, mesas). No es para pedir permiso: es para poder **listarlo y borrarlo de un solo golpe** al final.
- **Modo entrenamiento** (`orders.is_training`, migración `0021`) para los pedidos que no quieras ver en reportes. Pero **úsalo con criterio**: buena parte de esta ronda es justamente comprobar que los pedidos **sí** muevan inventario, cierre y reportes, y los de entrenamiento **no** lo hacen. Regla práctica: pedidos de relleno → entrenamiento; pedidos que estás midiendo → reales, y se limpian después.
  ⚠️ `is_training` **solo cubre pedidos**. Insumos, proveedores, compras, facturas, gastos, mesas, QR y sedes no tienen marca de entrenamiento: esos se borran a mano.
- **Lo ÚNICO intocable: los productos del menú.** No los borres, no los desactives, no les cambies precio, nombre, foto ni receta — es el menú real de Brotherhood, 62 productos cargados desde `brotherhoodvzla.com`. Si necesitas un producto para probar, **crea uno nuevo** con prefijo `ZZTEST-` y bórralo al final.
- **Todo lo demás es dato de demo y puedes usarlo a fondo**, incluidos **los pedidos viejos, los comprobantes, las cuentas abiertas, los cierres y los movimientos de inventario que ya están en la base**: puedes cobrarlos, cancelarlos, editarlos, confirmarlos o borrarlos si la prueba lo pide. No frenes por miedo a "romper algo real": lo único real es el menú.
- **Al final**: script de limpieza + verificación de que quedan **0 filas** con `ZZTEST-` y ningún pedido de prueba suelto. Lo que decidas dejar, déjalo listado en el informe con el motivo.

---

## 2. Reglas que no se negocian

1. **Las migraciones las aplica el usuario.** Tú escribes el `.sql` en `supabase/migrations/`, él lo corre. **Nunca asumas que una migración está aplicada** — y en esta ronda importa mucho: verifica en la BD el estado real de `0032` (RLS + comprobantes privados), `0033`/`0035` (índice de cuenta abierta por sede) y `0034` (RLS de pagos a proveedores). Varias pruebas de aislamiento dependen de ellas.
2. **No borres ni vacíes `.vercelignore`.** Sin él, `npx vercel --prod` sube `.claude/worktrees/` (18 GB con código de otros clientes) y las llaves de producción.
3. **No dañes las apps hermanas** (Santo Perrito, hotel, clínica, demos). Trabaja solo en esta rama.
4. **Trabaja por fases y commitea cada fase** (hay un incidente previo de sobrescritura: no dejes trabajo sin commitear). Los scripts de prueba nuevos también se commitean.
5. **Verificación de código:** `npx tsc --noEmit`, `npx vitest run`, `npm run lint` (debe quedar en **0 problemas**) y `npm run build`.
6. **El navegador in-app se cuelga** y con el pane cerrado `window.innerHeight` es 0. Las pruebas de flujo se hacen con **scripts Node contra la API real**, que es el patrón que ya existe en el repo (ver punto 3). Si necesitas el server: el primer request tarda ~5 min (filesystem lento en `D:`), fuérzalo con `Invoke-WebRequest -TimeoutSec 480` antes de navegar.

---

## 3. Qué cuenta como "prueba real" (y qué NO)

**NO cuenta como evidencia:** "revisé el código y se ve bien", "el helper filtra por `branch_id`", "hay un test unitario que lo cubre". Eso ya se hizo y aun así se colaron fallas.

**Cuenta como evidencia** un ciclo cerrado, por cada caso:
1. **Montar** el dato por la vía real (API o UI), no con un INSERT a mano — salvo que estés simulando un dato viejo a propósito.
2. **Ejercitar** el flujo por la API real, con los headers de verdad: `x-branch-id`, `x-staff-role`, `x-staff-branch-ids`.
3. **Medir el efecto**: antes y después, en la BD **y** en la pantalla/endpoint de lectura que ve el humano (reporte, cierre, historial, panel de alertas).
4. **Limpiar** y confirmar que quedó limpio.
5. **Registrar la evidencia**: ids, números de pedido, montos antes → después, respuesta del endpoint. Sin números, es opinión.

**Reutiliza la infraestructura que ya existe** en `scripts/` — es el patrón probado (carga `.env.local`, service key, crea → asserta → borra, sale con código ≠ 0):
`smoke.mjs`, `purchase-inventory-e2e.mjs`, `supplier-payables-e2e.mjs`, `reports-2e-e2e.mjs`, `business-complexity-e2e.mjs`, `order-idempotency-e2e.mjs`.
Corre primero **todos** esos (`npm run smoke`, `npm run e2e:*`) y reporta su resultado tal cual: es la línea base. Los scripts nuevos de esta ronda siguen el mismo molde y se agregan a `package.json`.

⚠️ **Ojo con los headers en producción:** `src/proxy.ts` borra/reemite `x-branch-id` y `x-staff-*` a partir del Bearer. Para probar suplantación de sede hay que hacerlo **como lo haría un atacante real** (a través del proxy, con la sesión de un staff de la sede A) y no solo inyectando headers server-side.

---

## 4. Fase 0 — Montar el terreno de pruebas

Deja constancia de cada id creado; la limpieza depende de eso.

1. **Tercera sede `ZZTEST-Sede Prueba`** creada **por el módulo** `local-santo/sucursales` (no por SQL): así se prueba de verdad `src/lib/branchProvisioning.ts` — qué se copia, qué queda vacío, si nace con menú propio o hereda el de la principal (`publicBranchMenu.ts`), si aparece en el selector público y en el selector del dueño.
2. **Mesas y QR por sede**: mesas nuevas en cada una de las 3 sedes (`local-santo/mesas`, `branchLocalTables.ts`), con **números repetidos a propósito** (Mesa 1 existe en las 3). Descarga/genera el QR de cada una.
3. **Usuarios por rol** (`local-santo/usuarios` / `api/staff`): mesonero de A, mesonero de B, cajero de A, dueño con acceso a todo, promotor. Guarda credenciales en el informe (no en git).
4. **Productos de prueba** (`menu-avanzado`): al menos uno con variaciones/adicionales y **receta ligada a inventario**, y una **subreceta** (`subrecetas`), en cada sede.
5. **Insumos** (`inventario`) con stock inicial y **mínimo de reposición** cercano, para poder dispararlo.
6. **Proveedor + compra a crédito** (`proveedores`, `compras`) con fecha de vencimiento dentro de la ventana de aviso (`payablesReminderDaysBefore`).

---

## 5. Fases de prueba

Cada punto: **montar → ejercitar → esperado → cómo lo compruebo**. Marca cada uno PASA / FALLA / NO PROBADO.

### F1 · Lo último que se tocó (26 y 27 de julio) — **empieza por aquí**

Son **16 commits en dos días**, casi todos sobre **dinero** y sobre **cuentas abiertas**. Es lo más fresco y lo menos ejercitado del sistema: pruébalo **primero**, con pedidos reales creados por ti, **en las dos sedes**.

**Antes de nada: ¿qué está realmente en vivo?** Brotherhood se publica a mano (`npx vercel --prod` desde `D:\Santo edit`), así que la página suele ir detrás de la rama. Truco rápido y fiable: el service worker lleva la versión. Compara `grep santo-static-v public/sw.js` (hoy **v22**, la puso `30a3aa7`) contra `https://brotherhood-xi.vercel.app/sw.js`. Si el vivo trae una versión menor, lo desplegado es código viejo: dilo antes de empezar y hay que decidir si se publica primero.

#### F1-A · Lote de pagos (13 commits del 26)

| Commit | Qué prometió arreglar | Cómo lo pruebas de verdad |
|---|---|---|
| `33bebbe` | confirmar **dos comprobantes a la vez** ya no borra el dinero de uno | pedido con 2 comprobantes; confírmalos casi simultáneos desde caja (dos pestañas); el cobro debe quedar con la **suma**, no con uno solo |
| `8b3524f` | la **2ª pata** del mixto ya no obliga a cuadrar a mano | mixto de 2 patas electrónicas; confirma la 2ª y mira si suma al cobro existente sin duplicar (`paymentProofRegistration.ts`) |
| `cbc0122` | el **billete** del efectivo en divisas es obligatorio + "En revisión" se apaga al cobrar caja | intenta registrar efectivo en divisas **sin** foto (debe bloquear); luego cobra en caja y comprueba que "En revisión" desaparece solo |
| `ad0e0bb` | en efectivo, la pantalla **seguía pidiendo comprobante para siempre** | pick up y delivery 100% efectivo con foto: la sección no puede volver a pedir reporte |
| `3b8702f` | el aviso "no transfieras el efectivo" **nunca se ejecutaba** | mixto efectivo + electrónico: el monto grande debe ser el de la pata electrónica, no el total |
| `5a8b9ed` `d4ba28f` `5f139d6` `98b4990` | evidencia **por pata**, una tarjeta por pago, y las fallas que destapó la revisión | mixto con captura de una sola pata → no envía y **nombra** la que falta; captura de una + referencia (≥6 dígitos) de la otra → envía; envío parcial → sigue pidiendo solo la que falta |
| `c3f40fe` | el "Listo" del **delivery** ya no manda a retirar + los listos duran 1 h a la vista | marca Listo un delivery y un pick up; compara los textos que ve el cliente y que el listo siga visible ~1 h |
| `918e326` | el seguimiento mostraba el número y el "cancelado" del pedido **viejo** | dos pedidos seguidos desde el mismo teléfono, uno cancelado: el seguimiento del nuevo debe estar limpio |
| `15428f0` | SW **v17** para que los teléfonos recarguen solos | en móvil real: entra con la app ya abierta antes del deploy y confirma que se actualiza sola (si no, es la trampa de caché, no un bug del lote) |
| `7f3194c` | rediseño de "Reportar mi pago" | recorre la pantalla completa en pick up, delivery y mesa, con método único y con mixto |

**Regresiones que este lote pudo romper y hay que revisar sí o sí:**
- **Método único** (solo Pago móvil, solo Zelle): no debe haberse endurecido — sigue bastando captura **o** referencia.
- **Caja**: que los pedidos con 1 y con 2 comprobantes cuadren en el **cierre del día** y en reportes (`ordersDayClose.ts`, `local-santo/cierres`) — el modelo de "una fila de comprobante por pata" es nuevo y el cierre no se escribió pensando en él.
- Que nada de esto haya movido el **aislamiento por sede**: los comprobantes de A no se ven ni se confirman desde B.
- ¿Quedó alguna **migración pendiente** de este lote? Según el historial fue todo sin migración: confírmalo y confirma también `0030` (segunda imagen) y `0031` (`orders.payment_method`), de las que dependen varios de estos arreglos.

#### F1-B · Paquete de CUENTAS ABIERTAS (27 de julio) — `e7878e6`, `af05259`, `30a3aa7`

Esto se dio por **hecho, probado en vivo 14/14 y publicado** (SW v22). Tu trabajo **no** es repetir esas 14 pruebas: es **atacarlo por donde no se probó** y comprobar que quedó **bien conectado con el resto del sistema** (caja, cierre, reportes, cocina, tickets, aislamiento por sede). Lee `git show 30a3aa7` completo antes de empezar — el resumen que me pasaron llegó cortado en el tercer arreglo de fondo.

Qué entró, y qué le tienes que hacer:

| Lo nuevo | Cómo lo atacas |
|---|---|
| **"Pedir la cuenta"** desde el teléfono (`api/public/open-accounts/request-bill`, `OpenAccountInfo.tsx`) con push a caja y mesonero | pídela desde el QR de una mesa real; comprueba el push, el badge rojo pulsante en el panel, y que esa mesa **salte al primer puesto** de la lista |
| **Idempotencia** (pedirla 2 veces conserva la hora) | pídela dos veces, y además **desde dos teléfonos a la vez** en la misma mesa |
| **Se apaga solo** al cobrar, al cerrar o al marcar "Atendida" | prueba los **tres** caminos por separado, y "Atendida" **con el rol mesonero**, no solo con el de dueño |
| **Marcador `[CUENTA_PEDIDA:iso]` dentro de la nota** (sin migración) | ver el bloque de abajo — es lo más frágil del paquete |
| **Refresco automático** de la vista pública cada 15 s | ¿sigue sondeando con la cuenta ya cerrada o con la pestaña en segundo plano? ¿cuántas consultas por minuto genera una mesa abierta? |
| **Tarjeta liviana** (Pendiente como único número grande, línea compacta, una sola caja de tono, verde para éxito) | que el **Pendiente** coincida al centavo con lo que dice caja y con el cierre del día; que ningún dato de los que se quitaron haga falta para decidir |
| **Guardado por cuenta** (se fue el `isSaving` global) | cobra la Mesa 2 y, **mientras gira**, toca la Mesa 3: la 3 tiene que responder |
| **Cobrar dos veces a la vez ya no pisa dinero** (`e7878e6`, candado optimista) | dos POST de cobro **concurrentes** sobre la MISMA cuenta (dispáralos en paralelo desde un script, no a mano): el resultado tiene que ser la **suma**, sin perder ni duplicar |
| **Cerrar con pendiente exige decidir** (`e7878e6`) | cierra una cuenta con saldo: recorre cada opción y comprueba a dónde va ese dinero en el **cierre del día** y en reportes |
| **"Agregar pedido"** desde la cuenta (`af05259`) | el pedido tiene que nacer en la **sede correcta**, con la **mesa correcta** y ya asociado; intenta asociarlo a una cuenta de **otra sede** |
| **Sondeo sin N+1** (2 queries totales con `.in()`) | abre **10-15 cuentas** con varios pedidos cada una: totales exactos, y ojo con el **límite de filas de Supabase** (mil por defecto) — un `.in()` que trunque da totales bajos y silenciosos |
| **Refresco parcial** tras cobrar/entregar (trae solo esa cuenta) | comprueba que las **otras** tarjetas no queden con datos viejos en pantalla |
| **Cancelar recalcula los totales** al instante | cancela desde staff **y** desde la cancelación pública del cliente; el total de la cuenta y el pendiente tienen que moverse solos |
| **`table_id` al abrir cuenta** (staff y QR) + fallback si la FK falla | abre cuentas por los dos caminos y verifica la columna; luego provoca la **config divergida** (mesa en config que no existe en la tabla) y confirma que la cuenta abre igual, sin vínculo, sin romperse |

**El marcador en la nota es lo más frágil — pruébalo con saña:**
- ¿Se **escapa** a algún sitio donde lo lea un humano o una máquina? Revisa **ticket 80mm, comanda de cocina, WhatsApp, CSV/Excel de reportes, panel de comprobantes, historial de cierres y auditoría**. La nota debe verse limpia en **todos**.
- ¿Qué pasa si el **staff edita la nota a mano** mientras el marcador está puesto? ¿Se pierde el aviso, se duplica, queda basura?
- **Inyección desde el cliente:** que un cliente escriba `[CUENTA_PEDIDA:2026-01-01T00:00:00Z]` en la nota de su pedido desde el menú público. Si eso enciende el aviso en el panel, es un bug real.
- Nota que ya traía corchetes, nota vacía, nota larguísima: que ninguna rompa el parseo.

**Seguridad y aislamiento del endpoint público nuevo** (`/api/public/open-accounts/request-bill`):
- ¿Tiene **freno**? Un cliente martillando el botón no puede convertirse en una lluvia de push al teléfono del staff.
- Pedir la cuenta de una mesa **cerrada**, **inexistente** o **de otra sede** debe rechazarse. El QR de la sede A no puede encender el aviso de la sede B.
- El badge de la mesa de A **no** aparece ni suena en el panel de B (esto entra también en la matriz de F10).

**"Todo bien conectado" — el cableado, que es lo que más se rompe:**
- Las piezas nuevas tienen que estar en **los dos paneles** (caja y mesonero) y en **las dos sedes**, con los permisos por rol correctos.
- Prueba las **dos navegaciones** (nav flotante y panel `/pedidos`): en este repo un módulo puede aparecer por una y no por la otra.
- Lo de siempre: `tsc`, `npm run lint` en 0, y la suite completa (la línea base tras `30a3aa7` es **535 tests**). Si tu ronda deja tests nuevos, súbelos a esa cuenta.

**Y el encargo es probar, no reescribir.** No refactorices lo que acaba de entrar ni "mejores de paso": si encuentras algo, va al informe primero. Lo único que se arregla sobre la marcha es fuga de datos entre sedes o pérdida de dinero, avisando antes.

### F2 · Sedes, mesas y QR
- El QR de la Mesa 1 de la sede A abre el menú de A, con los productos, precios, WhatsApp y textos de A. El QR de la Mesa 1 de B, los de B. Un QR de A **no** puede abrir cuenta en B.
- Pedido creado desde el QR de la mesa: cae en la sede correcta y con la mesa correcta.
- Correlativo por sede (`0025`, `order_branch_counters`): numeración independiente por sede, `branch_code` correcto.
- Cuenta abierta con el **mismo número de mesa** en las 3 sedes a la vez (índice `0033`/`0035`): las tres conviven.
- Sede nueva: config propia vs heredada (`config.branchConfigs[branchId]`) — cambiar un override en A no mueve nada en B.

### F3 · Productos, recetas e inventario por sede
- Entregar un pedido con producto que tiene receta **descuenta el insumo de esa sede y solo de esa sede** (`inventoryConsumption.ts`, `ordersInventory.ts`). Mide stock antes/después en las 3.
- Subreceta anidada descuenta bien sus componentes.
- Pedido en **modo entrenamiento** NO descuenta inventario.
- **Cancelar** un pedido ya entregado: ¿devuelve el stock? Anota el comportamiento real, sea cual sea.
- Transferencia entre sedes (`inventoryTransfer.ts`): resta en origen y suma en destino, misma cantidad, y queda en auditoría. Es la **única** vía legítima de que un insumo cruce de sede: si encuentras otra, es un bug.

### F4 · Alertas de inventario (reposición)
- Bajar el stock por debajo del mínimo y comprobar que la alerta **llega**: panel `inventario-alertas`, push al staff suscrito, marca en `audit_logs` con `action = inventory.restock.notified`.
- ⚠️ **Trampa doble**, no reportes un falso FALLO:
  1. El disparo es **oportunista dentro de `/api/orders`** (`maybeDispatchRestockAlerts`, ver `src/app/api/orders/route.ts:38`). Si no hay tráfico de pedidos, no se dispara. Provoca el latido.
  2. Hay **anti-spam**: un aviso cada 24 h por sede, con dedupe en `audit_logs`. Para volver a probar, borra la marca `inventory.restock.notified` de esa sede.
  3. El **push** necesita VAPID configurado y una suscripción viva; si no hay, prueba el panel y la marca de auditoría, y di explícitamente que el push quedó NO PROBADO por falta de VAPID.
- **Aislamiento:** la alerta de un insumo de A no aparece en el panel de B ni le llega al staff de B.

### F5 · Proveedores, compras y cuentas por pagar
- Compra a crédito → aparece en `cuentas-por-pagar` con saldo, vencimiento y estado correctos (`supplierPayables.ts`).
- Pago parcial y pago total: el saldo baja bien, el estado cambia, y **el gasto no se duplica** en el cierre (recuerda: el cierre resta gastos, no compras).
- **Recordatorio de vencimiento** (`payablesReminderAlerts.ts`): llega al dueño/encargado suscrito. Mismo anti-spam de 24 h con marca en `audit_logs` y mismo disparo oportunista desde `/api/orders`.
- Proveedor y factura de A **no** se ven ni se pagan desde B (y `0034` de RLS: verifica si está aplicada).

### F6 · Pedidos, mesoneros y cuentas abiertas
- Los 3 canales: QR en mesa, pick up y delivery, en cada sede.
- Mesonero de A: ve solo pedidos y mesas de A; no puede tomar ni editar un pedido de B ni con el id en la mano (prueba el PATCH directo).
- Cuenta abierta: asociar varios pedidos, cobrar repartiendo por pedido, cerrar. (Lo **nuevo** de cuentas abiertas — pedir la cuenta, tarjeta liviana, cobros simultáneos, `table_id` — ya va en **F1-B**; aquí solo comprueba que el flujo de siempre siga entero.)
- Atribución (quién registró / quién cobró, `0022`) correcta por sede y por vendedor.
- Cambio de estado por rol (`orderStatusPermissions.ts`): quien no debe, no puede.

### F7 · Cancelaciones y sus avisos
- Solicitud de cancelación (`api/cancellation-requests`, `0029`): le llega a quien tiene que aprobarla, **solo de su sede**; aprobar/rechazar hace lo que dice; queda en auditoría; el dinero y el inventario quedan coherentes.
- Auto-cancelación por impago (`unpaidAutoCancel.ts`): dispárala y comprueba efecto y aviso.

### F8 · Caja, cierre e historial
- Cobro en efectivo, electrónico y **mixto**; comprobantes en revisión → confirmados.
- Gastos del día (`day-expenses`) restan en el cierre; las compras a proveedor **no** se restan dos veces.
- **Cierre del día por sede**: cerrar A no cierra B, y lo cerrado en A no aparece en el historial de B (`day_closes` con su `branch_id`).
- Historial de cierres: cada fila conserva su etiqueta de sede; el consolidado del dueño las distingue.
- Reabrir/recalcular (si existe): no duplica ni pierde dinero.
- ⚠️ Hallazgo abierto del QA del 2026-07-12: **toggles de cierre que parecían decorativos**. Confírmalo o descártalo con números.

### F9 · Reportes y resumen del dueño
- `GET /api/reports` con `x-branch-id=A` suma **solo** A; lo mismo con B.
- `?scope=all` (solo dueño) = consolidado. Comprueba la identidad **A + B (+ sede de prueba) == all**, peso por peso.
- **Blind spot conocido (R1):** el consolidado hoy **no trae desglose por sede** (`byBranch`). Confirma si sigue así y déjalo como recomendación con nombre y sitio.
- Coherencia entre las 3 pantallas que ve el dueño: **dashboard vs reportes vs cierre** para el mismo día y la misma sede deben dar el **mismo número**. (Es un hallazgo abierto del QA 2026-07-12: si discrepan, muestra los tres números y de dónde sale cada uno.)
- Los pedidos de **entrenamiento** y los **cancelados** no cuentan en ningún reporte.
- Ventas por vendedor / por evento: por sede, sin mezclar.

### F10 · Aislamiento total por sede (la parte crítica)
Regla del negocio: **nada se mezcla, salvo que el dueño pida ver ambas.**

Arma una **matriz** y llénala con evidencia, no con opinión. Filas = cada módulo de F1–F9. Columnas:

| Módulo | A ve solo A | B ve solo B | Dueño ve consolidado correcto | Cruce forzado RECHAZADO |
|---|---|---|---|---|

(Los módulos de F1 — pagos, comprobantes y caja — entran también en esta matriz: son los que más dinero mueven.)

"Cruce forzado" son intentos reales de romperlo:
- Staff de A pidiendo datos con `x-branch-id` de B (a través del proxy, no solo server-side).
- PATCH/DELETE con **id de un registro de B** desde contexto de A: pedidos, insumos, gastos (`deleteDayExpense` ya tuvo este bug — el fix R4), proveedores, facturas, mesas, cuentas abiertas, comprobantes.
- Endpoints **nuevos o poco usados**: `api/audit-logs`, `api/comprobantes`, `api/open-accounts`, `api/reservations`, `api/surveys`, `api/staff`.
- `order_items` **no tiene `branch_id`** (depende de que los `order_id` lleguen ya filtrados): revisa cualquier consulta que lo toque directo.
- `menu_products.id` es **PK global**, no compuesta con `branch_id`: comprueba que no haya ids repetidos entre sedes y que un upsert no pueda reasignar el producto de otra sede.
- Menú público por sede: sede sin menú propio **hereda el de la principal** (comportamiento correcto y esperado, no lo reportes como fuga). Prueba con header `x-branch-id`, **no** con `?branch=`.
- Por cada fuga que encuentres, **escribe un fitness test que falle sin el fix** — el repo ya tiene el molde: `branchIsolation.fitness.test.ts`, `branchMutationScope.test.ts`, `dbColumnsExist.fitness.test.ts`, `rlsEnabled.fitness.test.ts`.

### F11 · Avisos en general
Inventario, cuentas por pagar, cancelaciones, pedido listo, pago reportado, comprobante en revisión. Por cada uno: **quién lo recibe, en qué sede, por qué canal (panel / push / sonido / WhatsApp), y qué lo dispara**. Un aviso de A que suene en B es una falla de aislamiento, no un detalle.

---

## 6. Trampas conocidas (para no reportar falsos OK ni falsos FALLO)

- **Caché del PWA / service worker**: si no ves lo nuevo, puede ser el SW y no un bug. Súbele la versión o prueba en ventana limpia.
- **Anti-spam de alertas** (24 h + marca en `audit_logs`): la segunda prueba "no llega" por diseño.
- **Disparo oportunista** de alertas dentro de `/api/orders`: sin tráfico, no hay aviso.
- **Push sin VAPID** no llega: eso es configuración pendiente, no un bug del módulo. Decláralo NO PROBADO.
- **`is_training` solo aplica a pedidos.**
- **Sesión de staff**: Brotherhood usa `localStorage` (Santo usa `sessionStorage`), y hay **doble navegación** (nav flotante vs panel `/pedidos`) para llegar al mismo módulo — prueba las dos.
- **Migraciones no aplicadas** dan 500 silenciosos o inserts que se reintentan sin la columna (le pasó a `orders.payment_method`). Ante un comportamiento raro, revisa primero si la columna existe.

---

## 7. Lo que ya se sabe — no lo redescubras, verifícalo

Lee antes de empezar: `AUTO-VERIF-MULTISEDE.md`, `AUTO-VERIF-CUENTAS-ABIERTAS.md`, `AUTO-VERIF-MESEROS-FLUJOS.md`, `AUTO-REVISION-FLUJOS.md`, `SEGURIDAD-RLS-Y-COMPROBANTES.md`, `GUIA-MULTISEDE.md`.
De ahí salen los blind spots R1 (consolidado sin `byBranch`), R2 (`menu_products` PK global), el de `order_items` sin `branch_id` y el fix R4 (`deleteDayExpense`). Tu trabajo no es repetir esa lista: es **ejercitarla con datos reales** y decir cuáles siguen vivos.

---

## 8. Entregable

Un informe **`QA-RONDA-2026-07-XX.md`** en la raíz del repo con:

1. **Tabla resumen**: cada caso de F1–F11 con PASA / FALLA / NO PROBADO y **por qué**. "NO PROBADO" es una respuesta legítima y honesta; "todo bien" sin números, no.
2. **La matriz de aislamiento** de F9 completa.
3. **Bugs encontrados**, priorizados: (1) fuga entre sedes, (2) dinero equivocado, (3) aviso que no llega, (4) UI/texto. Cada uno con: qué pasó, archivo:línea de la causa probable, cómo reproducirlo y qué tan seguro estás.
4. **Evidencia**: ids, números de pedido, montos antes → después, salidas de los scripts.
5. **Scripts nuevos** commiteados en `scripts/` y enganchados en `package.json`.
6. **Fitness tests nuevos** por cada fuga real encontrada.
7. **Confirmación de limpieza**: 0 filas `ZZTEST-`, 0 pedidos de entrenamiento sueltos, sedes/mesas/QR de prueba eliminados (o la lista exacta de lo que quedó y por qué).

**Primero el informe completo, después los arreglos.** No arregles sobre la marcha salvo que sea una fuga de datos entre sedes o una pérdida de dinero: en ese caso, párate, avísale al usuario y arréglalo antes de seguir. Cualquier cosa que exija **migración** o una **decisión de dinero**, se pregunta — no se decide solo.

## 9. Lección que aplica aquí

El lote anterior pasó `tsc`, 471 tests y `build` **con 4 fallas dentro**, incluida una rama de código que nunca se ejecutaba. Las encontró una revisión adversarial por lentes distintos, no la suite. Así que: **desconfía de lo que no puedas ejercitar**, y si un caso no lo pudiste ejercitar de verdad, dilo — no lo des por bueno.

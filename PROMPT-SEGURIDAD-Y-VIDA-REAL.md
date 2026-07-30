# Prompt — SEGURIDAD Y VIDA REAL: 2 semanas operando Brotherhood con todo en contra

> Pega este archivo completo como PRIMER mensaje de una sesión nueva.
> Escrito el 2026-07-30. Es el hermano duro de `PROMPT-ENTREGA-FINAL.md`:
> aquel comprueba que **todo funciona**; este comprueba que **nada se rompe
> cuando el mundo real se le viene encima**.
>
> **Objetivo:** que al terminar podamos decirle al dueño, con números en la
> mano: *"tu sistema aguantó dos semanas de todo lo que le puede pasar a un
> restaurante — incluido gente tratando de robarte — y el dinero cuadró al
> centavo todos los días"*. Y si no aguantó, saber exactamente dónde.

---

## 0 · La regla que no se rompe nunca

**TODO se ejecuta contra la base de datos de SIMULACIÓN, jamás contra
producción.** Esto no es una recomendación: es la línea que separa una
auditoría de un desastre. Vas a crear cientos de pedidos, vas a intentar
fraudes, vas a anular ventas y vas a desactivar usuarios. Nada de eso puede
tocar el negocio real.

```bash
# 1. Respaldar el apuntador a producción ANTES de tocar nada
cp .env.local .env.local.produccion.bak
# 2. Cambiar a la base de prueba
cp .env.simulacion .env.local
# 3. CONFIRMAR en qué base estás parado (obligatorio, no lo saltes)
node -e "console.log(require('fs').readFileSync('.env.local','utf8').match(/SUPABASE_URL=(.*)/)[1])"
```

- Producción es `fpujezdaauedjvnhjzws` → **si ves esto, PARA**.
- Simulación es `gnyvdlxlrjwbsdctincy` → correcto, sigue.

El motor de simulación ya trae candados propios en
`scripts/sim/lib/simulation-guard.mjs`: **no los desactives ni los rodees**. Si
un candado te frena, el candado tiene razón.

**Al terminar la sesión, restaura producción:**
`cp .env.local.produccion.bak .env.local` y vuelve a confirmar la URL.

⚠️ **Nunca cambies el `.env.local` mientras haya suites corriendo**: cada script
lee el archivo al arrancar, así que el siguiente del lote leería la base
equivocada y te daría resultados que no significan nada.

---

## 1 · Con qué cuentas (no lo construyas de nuevo)

Ya existe un motor de simulación que corrió 7 días y destapó 7 bugs reales —
entre ellos que el cliente podía **fijar el precio de su hamburguesa** y
**fabricar la tasa de cambio**. Reúsalo:

| Herramienta | Para qué |
|---|---|
| `scripts/sim/run-week.mjs` / `resume-week.mjs` | correr y retomar días de operación |
| `scripts/sim/reset-simulation.mjs` | dejar la base de prueba en cero |
| `scripts/sim/lib/day-engine.mjs` | el motor que fabrica un día de negocio |
| `scripts/sim/lib/expected-ledger.mjs` | el libro mayor esperado (lo que DEBERÍA haber en caja) |
| `scripts/sim/lib/expected-inventory.mjs` | el inventario esperado insumo por insumo |
| `scripts/sim/lib/db-verifier.mjs` | consultas verificadas **con paginación** (`fetchAll`) |
| `scripts/sim/reconciliacion-final.mjs` | el cuadre de todo contra todo |
| `scripts/sim/probar-*.mjs` | anulaciones, armables, módulos, push, tasa |

Y las suites de siempre (`npm run qa:*`, `npm run e2e:*`) siguen valiendo: aquí
se usan como **red de seguridad al final de cada semana**, no como la prueba
principal.

### Trampas de verificación que ya costaron tiempo

Están documentadas porque volvieron a aparecer varias veces:

- **PostgREST corta en 1000 filas.** Cualquier conteo sin paginar da falsos
  positivos ("pedidos sin detalle" que sí lo tienen). Usa `fetchAll()`.
- La columna es **`registered_by_name`**, no `created_by_name`.
- **`salesBySeller` vive en el cierre de caja**, no en `/api/reports`.
- El freno de pedidos es **10 por minuto y por IP**: para volumen hay que rotar
  dispositivos, como ya hace el motor.
- Crear insumos, proveedores y menú es de **dueño/soporte**, no de encargado.
- **Cerrar el día** es de dueño/**encargado**, no de cajero.
- **Anular** es de dueño/encargado/cajero: el **mesonero no puede**.
- Delivery exige `paymentMethod` en el cuerpo o responde 400.
- En una base fresca los módulos de **proveedores, compras y cuentas por pagar
  vienen apagados**: hay que encenderlos en `business-config` antes de probarlos.
- Un `next dev` viejo responde **500 con cuerpo vacío** y fabrica fallas
  fantasma. **Reinícialo antes de empezar.** Un 500 con `json: null` es el
  servidor; un 500 con `{error: …}` sí es del código.

---

## 2 · Lo que quedó pendiente y hay que absorber aquí

Esta sesión hereda lo que la del 2026-07-30 no alcanzó a hacer:

- [ ] **Playwright** (15 checks de navegador): PWA, offline, accesibilidad,
      formularios responsive y sesión/roles. Aquí sí se puede correr, porque ya
      estamos en la base de simulación:
      `npx next build && npx next start -p 3181 && npx playwright test`.
- [ ] **La revisión de rutas de mutación sin guard**: recorrer `src/app/api/**`
      y listar TODO endpoint POST/PATCH/DELETE que no valide rol o sede. Se
      intentó dos veces y se cayó por sobrecarga del servicio; es de lo más
      valioso que queda por hacer y está incluido en la Parte A.
- [ ] **Decidir `/previa`, `/previa/idea-3`, `idea-4`, `idea-5`**: borradores
      internos de diseño, públicos en el dominio del cliente.
- [ ] **Revisar `public/` completo** buscando archivos que no sean de este
      cliente (ya se encontraron y quitaron 5 logos de otros negocios que se
      servían con HTTP 200 desde el dominio de Brotherhood).
- [ ] **Los 7 puntos de endurecimiento** listados en el §6 de
      `PROMPT-ENTREGA-FINAL.md` (sesión que no caduca, revocación en Auth,
      `is_active !== true`, config que falla abierta, carrera al reescribir
      permisos, permisos custom de un segundo dueño, y bajar de rol
      conservando módulos viejos).

### Cuatro hallazgos ya CONFIRMADOS el 2026-07-30 que esta ronda debe cerrar

No son sospechas: se comprobaron ejecutándolos. Están al principio a propósito.

> **El H-4 ya tiene decisión tomada del dueño y es trabajo de esta sesión:
> implementar el "camino B" (que el personal confirme antes de sumar un pedido a
> la cuenta de una mesa), con su prueba automática, y dejarlo verificado dentro
> de la simulación.** Los otros tres se miden y se llevan a decisión.

**H-1 🔴 · Cualquiera en internet ve quién está sentado en cada mesa y cuánto
debe.** `GET /api/public/table-account-status?mesa=Mesa%201` no pide clave y
devuelve el **nombre del cliente**, lo que consumió y lo que debe. Comprobado
contra producción: la Mesa 1 devolvió `"customerName":"Carlos"` con
`pendingUSD: 485.96`. Los nombres de mesa son triviales de adivinar (Mesa 1,
Mesa 2, Barra…), así que se puede barrer el local completo desde afuera.
*El detalle que lo hace una decisión y no un bug obvio:* la pantalla del
cliente **usa esos montos de verdad**, porque es como la mesa ve su propia
cuenta al pedirla desde el teléfono. Y la única prueba de "yo estoy en esta
mesa" es el QR, que es público y estático.
**Qué hacer en la ronda:** medir el alcance real (¿cuántas mesas se pueden
barrer?, ¿aparecen teléfonos?) y llevarle al dueño las tres salidas: quitar el
nombre del cliente y dejar solo los montos; exigir algo más que el nombre de la
mesa (un código en el QR); o dejarlo como está sabiendo lo que expone.
Ojo: `POST /api/public/open-accounts` **sí** recorta los datos por privacidad,
así que este endpoint es el que quedó fuera de ese blindaje.

**H-2 🟠 · Pasados unos cientos de pedidos vivos, el sistema lee un pedazo de la
realidad.** Las consultas de Supabase se cortan en 1000 filas y en todo
`src/app/api` y `src/lib` hay **una sola** llamada con paginación. La función que
lista pedidos (`getOrdersFromStore`, `ordersStoreQueries.ts:61`) hace
`select("*")` sin límite, y después pide sus líneas con un `.in(...)` que también
se corta. El número concreto medido en producción el 2026-07-30: **105 pedidos
vivos y 287 líneas**, o sea margen para unos **240 pedidos más** antes de que
empiecen a faltar líneas en silencio. En operación normal el cierre del día
reinicia los pedidos y eso lo mantiene a raya — pero un fin de semana fuerte sin
cerrar, o unos días acumulados, entra en zona de corte **sin ningún aviso**.
**Qué hacer en la ronda:** el día 5 (rush) y el 8 (sin internet) son los que más
acumulan; al pasar de 400 pedidos vivos, comprobar que el panel, el cierre y los
reportes siguen viendo TODO. Si no, hay que paginar del lado del servidor.

**H-4 🔴 · Se le puede cargar comida a la cuenta de OTRA mesa — y ya está
decidido cómo se arregla.** Al adjuntar un pedido público a la cuenta de una
mesa, el servidor solo valida dos cosas: que el módulo de cuentas abiertas esté
activo y que el pedido sea "Comer aquí" (`src/app/api/orders/route.ts:366-381`).
**Nunca comprueba que quien pide esté en esa mesa.** Y el cliente elige la mesa
de una lista: el QR solo la preselecciona, no es obligatorio. La marca de "vine
del QR" es el parámetro `mesa_qr=1` (`src/app/mesa/[mesa]/page.tsx:29`), que
cualquiera escribe a mano: **no es un secreto**.

Encadenado con H-1 sale el fraude completo: preguntar qué mesas tienen cuenta
abierta y cuánto deben → elegir una → pedir comida cargándosela a esa cuenta,
desde cualquier lado. No es robo silencioso (al pagar, el cliente reclama que no
pidió eso), pero te deja el problema en la mesa, delante del comensal, y en un
local lleno alguien se sale con la suya.

**DECISIÓN DEL DUEÑO (2026-07-30): se implementa el "camino B" — que el
personal confirme.** Se descartó a propósito la alternativa de meter un código
secreto en el QR, porque **el QR es un papel pegado en una mesa pública: se
fotografía y el secreto deja de serlo**, y además obligaría a reimprimir todas
las mesas y a que cada comensal escanee para cada ronda.

Cómo debe quedar:

1. Un pedido público con `attachToTableOpenAccount` / `attachToOpenAccountByTable`
   **ya no se suma solo a la cuenta**: entra como pedido normal de esa mesa,
   marcado como *"pide sumarse a la cuenta de Mesa X"*.
2. **La cocina lo ve de una vez**: la comida NO espera la confirmación. Esto no
   se negocia — atrasar el servicio para tapar un fraude poco frecuente es peor
   que el fraude.
3. En el panel (caja, mesonero o cuentas abiertas) aparece *"¿Sumar este pedido
   a la cuenta de Mesa 1?"* con **Sumar / Dejarlo aparte**. Confirmar es la
   acción `attachOrder` que **ya existe**
   (`src/app/api/open-accounts/[accountId]/route.ts:342`, roles dueño, encargado,
   caja y mesonero): hay que invertir el flujo, no construirlo.
4. Si nadie confirma, el pedido se cobra por su cuenta, como cualquier pedido de
   mesa. Nunca se pierde una venta.
5. El cliente ve algo honesto en su confirmación: *"tu pedido va a la mesa; el
   mesonero lo suma a la cuenta"*.

⚠️ **Trampa conocida al implementarlo:** este sistema ya usa marcadores dentro de
notas (`[CUENTA_PEDIDA:…]`) y eso destapó un bug — el cliente podía **escribir el
marcador a mano en su nota** y fingir la petición. Si la marca de "pide sumarse"
se guarda en un campo de texto que el cliente controla, hay que **limpiarla de
todo lo que venga del cliente**, igual que se hizo en
`stripBillRequestMarker`. Si en cambio se prefiere una columna nueva, la
migración la aplica el dueño.

**Además hay que revisarlo en esta ronda** (Parte A, ataques 1.6 y 1.7, y el Día
9 de la simulación): primero comprobando que el fraude funciona HOY, y después
que con el cambio ya no.

**H-3 🟡 · El total del cierre lo manda el navegador, no lo calcula el
servidor.** `realCollectedUSD` y el desglose por método entran desde el cuerpo de
la petición (`day-close/route.ts:301`). El servidor normaliza la forma pero no
recalcula. **Consecuencia para esta ronda: un cierre que "cuadra consigo mismo"
no prueba nada.** Todo cuadre de dinero tiene que cruzarse contra la tabla
`orders` o contra el libro mayor esperado del motor de simulación, nunca contra
los números que el propio cierre guardó.

---

## 3 · Parte A — Revisión de SEGURIDAD módulo por módulo

**Método:** cada ataque se **ejecuta**, no se razona. Se lanza la petición, se
mira la respuesta Y se mira la base de datos (porque un 200 que no escribió y un
403 que sí escribió son dos mentiras distintas). De cada ataque se anota:

```
[ID] módulo · quién ataca · qué intentó
  → respuesta HTTP y cuerpo
  → qué quedó en la base (la consulta y su resultado)
  → veredicto: BLOQUEADO / PASÓ / PASÓ A MEDIAS
```

Un ataque **BLOQUEADO** también se anota: es la evidencia de que la defensa
existe, y el día que alguien la rompa sin querer, este informe lo delata.

### Los cinco atacantes

Ponte en cada piel, porque cada una tiene un acceso distinto:

1. **El cliente cualquiera** — solo tiene el link del menú y su teléfono. Puede
   ver todo el HTML y el JavaScript, y puede repetir cualquier petición cambiando
   lo que quiera.
2. **El empleado con sesión** — entró con su usuario, tiene un rol. Quiere hacer
   más de lo que le toca (o tapar algo que hizo mal).
3. **El ex-empleado** — lo desactivaron ayer. Conserva su teléfono con la sesión
   abierta y **se sabe la clave compartida de su rol**.
4. **El de la otra sede** — trabaja en San Diego y quiere ver (o tocar) el dinero
   de Viñedo.
5. **El desconocido de internet** — no tiene nada, solo la dirección del sitio.
   Prueba direcciones a ver qué encuentra.

### 1 · Público / cliente

Superficie anónima: cualquiera con el link del sitio o del QR. Todo `POST` público pasa por `enforceSameOriginRequest` + `enforceRateLimit`, pero OJO: `checkSameOriginRequest` devuelve `allowed:true` cuando NO hay `Origin` ni `Referer` (`src/lib/requestGuards.ts:226-233`) — con `curl` sin esos headers el guardia no frena nada. Es anti-CSRF de navegador, no anti-bot.

**1.1 🔴 Precio manipulado al crear pedido**
- Quién: cliente cualquiera con el link.
- Ataque: `POST /api/orders` con `items[0].id` de una burger real pero `items[0].price = 0.01` (o `selectedVariation.name` inventado).
- Qué debe pasar: como la petición NO trae sesión de staff, el servidor RE-PRECIA cada línea desde el menú real de la sede y descarta el precio del cliente (`src/app/api/orders/route.ts:544-558` → `repricePublicOrderItems` en `src/lib/publicOrderGuards.ts:136-171`). Un id que no existe o una opción que no está en el menú devuelve 400 "El menú cambió…".
- Cómo saber que falló: el pedido queda guardado con `total_usd` = 0,01 (o el precio inventado). En la respuesta, `order.items[].price` distinto del precio del menú.

**1.2 🔴 Tasa de cambio baja para pagar menos Bs**
- Quién: cliente cualquiera.
- Ataque: `POST /api/orders` con `exchangeRate: 1` (o cualquier valor bajo) para que el equivalente en Bs sea irrisorio.
- Qué debe pasar: para peticiones sin staff, la tasa la fija el servidor (`resolvePublicExchangeRate`, `src/lib/publicOrderGuards.ts:176-181`): si el negocio tiene tasa propia (>0), la del cliente se ignora. En modo BCV siempre hay tasa (caché o fallback 667,05, `src/app/api/exchange-rate/route.ts:33`).
- Cómo saber que falló: el pedido guarda `exchange_rate` = 1. Sub-caso a probar: negocio en modo **manual con `manualExchangeRate` sin configurar (=0)** — ahí `serverRate` puede quedar 0 y la tasa del cliente sobrevive; verificar `getServerExchangeRateForBranch` (`src/app/api/orders/route.ts:503-537`).

**1.3 🔴 Espiar la cuenta de otra mesa (fuga de datos)**
- Quién: comensal en otra mesa, o un desconocido con el link del sitio.
- Ataque: `GET /api/public/table-account-status?mesa=Mesa 1` y barrer `Mesa 2`, `Mesa 3`… (los nombres son triviales).
- Qué debe pasar: debería devolver solo si la mesa está ocupada, sin datos personales. Pero HOY devuelve `openAccount.customerName`, `totalEstimatedUSD`, `totalCollectedUSD`, `pendingUSD` y el arreglo `orders` completo (`src/app/api/public/table-account-status/route.ts:151-166`). Compárese con `POST /api/public/open-accounts`, que sí aplica proyección mínima por privacidad (`toPublicAccount`, `src/app/api/public/open-accounts/route.ts:128-138`, blindaje H16).
- Cómo saber que falló: ya "falla" — la respuesta trae nombre del cliente, montos consumidos y pedidos de una mesa que no es la del que pregunta. Sin `same-origin` (solo rate-limit 90/min), se barre con `curl`. **Hallazgo abierto.**

**1.6 🔴 Cargarle la comida a la cuenta de otra mesa** *(ver H-4 en el §2)*
- Quién: cualquiera con el link, desde su casa. No necesita haber escaneado nada.
- Ataque: `POST /api/orders` con `orderType: "Comer aquí"`, `tableNumber: "Mesa 1"`
  (una mesa que tenga cuenta abierta, se averigua con el ataque 1.3) y
  `attachToTableOpenAccount: true`.
- Qué debe pasar **hoy**: el pedido se suma a la cuenta ajena. El servidor solo
  valida que el módulo esté activo y que sea "Comer aquí"
  (`src/app/api/orders/route.ts:366-381`); no comprueba que estés en la mesa.
  **Empieza confirmando que el ataque funciona**, con la prueba en la mano.
- Qué debe pasar **después del camino B**: el pedido entra como pedido de esa
  mesa y la cocina lo ve, pero el **pendiente de la cuenta NO se mueve** hasta
  que alguien del local lo confirme desde el panel.
- Cómo saber que falló: `open_accounts.pending_usd` de la Mesa 1 subió sin que
  nadie del local confirmara nada, y el pedido quedó con `open_account_id`
  apuntando a esa cuenta.

**1.7 🔴 Fingir que el local ya confirmó (después del camino B)**
- Quién: cliente cualquiera, una vez implementado el cambio.
- Ataque: intentar saltarse la confirmación por tres vías: (a) mandar
  `openAccountId` directo con el id de la cuenta (que se obtiene del ataque 1.3);
  (b) si la marca de "pide sumarse" se guarda en un campo de texto, **escribirla
  a mano en la nota del pedido**; (c) repetir la petición muchas veces a ver si
  alguna entra.
- Qué debe pasar: ninguna de las tres mueve el pendiente de la cuenta. La (b) es
  la más importante: este sistema **ya se comió ese bug** con el marcador
  `[CUENTA_PEDIDA:…]`, que el cliente podía escribir en su nota para fingir que
  había pedido la cuenta; se arregló limpiando el marcador de todo texto que
  venga del cliente (`stripBillRequestMarker`).
- Cómo saber que falló: la cuenta suma el pedido sin que exista un registro de
  quién lo confirmó.

**1.4 🟡 Cancelar pedidos ajenos recién creados**
- Quién: cliente cualquiera (necesita el `orderId`).
- Ataque: `POST /api/public/order-cancel` con `orderId` de otra persona.
- Qué debe pasar: solo cancela si el pedido sigue en estado "Nuevo" y sin cobro ni comprobante activo (`src/app/api/public/order-cancel/route.ts:67-98`), con lock optimista en el `UPDATE` (`...:127-131`). Y el `orderId` es imprevisible: `ord-<time>-<10 chars de randomBytes(9)>` = 72 bits (`src/lib/ordersStoreCreate.ts:29-36`), no se enumera.
- Cómo saber que falló: si un `orderId` secuencial/adivinable existiera, se podrían cancelar pedidos ajenos. Probar con ids inventados: deben dar 404, nunca cancelar.

**1.5 🟡 Enumerar seguimiento/pago de pedidos ajenos**
- Quién: desconocido de internet.
- Ataque: `GET /api/public/order-status?pedido=ord-xxxx` y `GET /api/public/order-payment?pedido=ord-xxxx` probando ids.
- Qué debe pasar: el modelo de confianza es el id imprevisible. `order-payment` devuelve un subconjunto seguro sin teléfono ni imagen del comprobante (`src/app/api/public/order-payment/route.ts:142-151`); `order-status` no expone teléfono ni dirección (`src/app/api/public/order-status/route.ts:216-236`).
- Cómo saber que falló: un id corto/secuencial acertaría. Con ids reales de 72 bits, la fuerza bruta es inviable (rate-limit 60-90/min además).

**1.6 🟡 Reventar reservas / abrir cuentas en masa**
- Quién: desconocido de internet.
- Ataque: `POST /api/public/reservations` en bucle para agotar mesas, o `POST /api/public/open-accounts` con nombres de mesa inventados.
- Qué debe pasar: rate-limit 10/min (`src/app/api/public/reservations/route.ts:100-107`), tope de 60 días, validación de fecha futura y teléfono ≥7 dígitos (`...:129-174`); abrir cuenta valida contra las mesas reales de la sede y es idempotente (`src/app/api/public/open-accounts/route.ts:110-147`).
- Cómo saber que falló: reservas aceptadas en el pasado, con teléfono basura, o más de 10/min desde una IP.

**1.7 🟡 Fuerza bruta de cupones**
- Quién: cliente cualquiera.
- Ataque: `POST /api/public/coupons` probando códigos (`DESCUENTO10`, `PROMO20`…).
- Qué debe pasar: la lista de cupones NUNCA sale del servidor; se valida uno y se responde solo el % del suyo, con rate-limit 15/min (`src/app/api/public/coupons/route.ts:14-33`).
- Cómo saber que falló: que la respuesta traiga más de un cupón, o que no haya tope de intentos.

**1.8 🟡 Falsear encuesta / leer datos por el link de encuesta**
- Quién: cliente cualquiera con el link de su pedido.
- Ataque: `POST /api/public/survey` con `orderId` ajeno para meter una reseña falsa; o `GET` para leer el `customerName`.
- Qué debe pasar: una respuesta por pedido, id imprevisible, same-origin + tamaño (`src/app/api/public/survey/route.ts:89-130`). Expone el nombre del cliente solo a quien tenga el link del pedido (aceptado por diseño).
- Cómo saber que falló: dos respuestas guardadas para el mismo `orderId`, o poder puntuar pedidos que no existen.

---

### 2 · Caja y dinero

Toda ruta privada resuelve el rol con `getRequestAccess` (`src/lib/localAccess.ts:334-356`): si viene `x-staff-role` (que solo pone el middleware tras verificar el Bearer) lo usa; si no, cae a la clave por rol del `.env`. La sede sale de `resolveBranchId`, que "clampa" a los roles no-dueño a su sucursal (`src/lib/branch.ts:240-258`).

**2.1 🔴 Cobrar dos veces desde dos cajas (doble cobro / carrera)**
- Quién: empleado con sesión (caja) — dos cajeros a la vez, o un script.
- Ataque: dos `PATCH /api/orders/{orderId}/payment` simultáneos sobre el mismo pedido, cada uno con montos de una lectura vieja.
- Qué debe pasar: candado optimista `expectedPrevious`: el `UPDATE` exige que los montos sigan siendo los que se leyeron; si otro cobró entremedio → 0 filas → `OrderPaymentConflictError` 409 (`src/lib/ordersStorePayments.ts:84-138`). El reparto FIFO de una cuenta usa el mismo candado (`src/app/api/open-accounts/[accountId]/route.ts:538-599`).
- Cómo saber que falló: el segundo cobro pisa al primero y `amount_received_*` refleja solo uno de los dos (el pago del otro cajero "desaparece").

**2.2 🔴 Cobrar sobre un pedido ya anulado**
- Quién: empleado con sesión (caja) con la tarjeta desactualizada.
- Ataque: `PATCH /api/orders/{orderId}/payment` sobre un pedido que ya pasó a "Cancelado".
- Qué debe pasar: el `UPDATE` lleva `.neq("status","Cancelado")` (`src/lib/ordersStorePayments.ts:91`); 0 filas → error "Este pedido está ANULADO".
- Cómo saber que falló: queda registrado dinero (`amount_received_usd`) en un pedido con `status = Cancelado`.

**2.3 🔴 Tocar el pedido/cobro de OTRA sede forzando el header**
- Quién: empleado de una sede atacando pedidos de otra.
- Ataque: `PATCH /api/orders/{orderId}/payment` (o `/route` cambio de estado) con `x-branch-id: <sede-ajena>` y el `orderId` de esa sede.
- Qué debe pasar: `resolveBranchId` clampa al usuario restringido a SU sede (`src/lib/branch.ts:240-252`); además el `UPDATE` filtra `.eq("branch_id", branchId)` tanto en cobro (`ordersStorePayments.ts:92`) como en estado (`src/lib/ordersStoreLifecycle.ts:67-70`) → pedido de otra sede = 0 filas = 404/403 tipado.
- Cómo saber que falló: un cajero de la Sede A modifica el estado o el cobro de un pedido cuyo `branch_id` es la Sede B.

**2.4 🟡 Mesonero cobrando o cerrando cuentas**
- Quién: empleado con sesión de mesonero (`waiter`).
- Ataque: `PATCH /api/open-accounts/{id}` con `action:"payAccount"` o `action:"close"`.
- Qué debe pasar: el mesonero puede abrir/asociar, pero cobrar y cerrar es de caja → 403 explícito (`src/app/api/open-accounts/[accountId]/route.ts:445-449` y `:691-696`).
- Cómo saber que falló: la cuenta queda `Cerrada`/con cobro habiendo usado la clave de mesonero.

**2.5 🟡 Empleado sin el módulo "Caja/Gastos" operando por API**
- Quién: empleado con sesión al que el dueño le quitó el módulo (permisos custom).
- Ataque: llamar directo a `PATCH …/payment`, `POST /api/day-expenses` o `POST /api/day-close` aunque el módulo no aparezca en su menú.
- Qué debe pasar: además del rol se valida `canLocalAccessUseModule(access, "cashier"/"expenses")` (`src/app/api/orders/[orderId]/payment/route.ts:334`, `src/app/api/day-expenses/route.ts:74`, `src/app/api/day-close/route.ts:96`).
- Cómo saber que falló: la acción pasa (200) pese a tener el módulo desmarcado — el recorte sería solo cosmético.

**2.6 🟡 Borrar gastos siendo encargado**
- Quién: empleado con sesión de encargado (`manager`).
- Ataque: `DELETE /api/day-expenses?id=...`.
- Qué debe pasar: `DELETE` es solo `owner` (`src/app/api/day-expenses/route.ts:351`); el encargado crea y ve, pero no borra.
- Cómo saber que falló: el gasto desaparece con clave de encargado.

---

### 3 · Cocina, mesonero y delivery

Los estados de pedido los autoriza `canRoleUpdateStatus` (fuente única, `src/lib/orderStatusPermissions.ts`), y cada `action` del `PATCH /api/orders/{orderId}` valida su propio rol antes de tocar nada.

**3.1 🟡 Cocina "entregando" o cobrando**
- Quién: empleado con sesión de cocina (`kitchen`).
- Ataque: `PATCH /api/orders/{orderId}` con `status:"Entregado"`, o `PATCH …/payment`.
- Qué debe pasar: `canRoleUpdateStatus` limita a cocina a sus transiciones (Nuevo→Preparando→Listo); "Entregado"/"Cancelado" → 403 (`src/app/api/orders/[orderId]/route.ts:455-457`). El endpoint de cobro no admite `kitchen` en `checkRole` (`…/payment/route.ts:322`).
- Cómo saber que falló: un pedido pasa a "Entregado" o registra cobro con la clave de cocina.

**3.2 🟡 Delivery marcando entregas ajenas / reportando de otra sede**
- Quién: empleado con sesión de delivery.
- Ataque: `PATCH /api/orders/{orderId}` con `action:"reportDelivery"` sobre pedidos de otra sede o que no le tocan.
- Qué debe pasar: `reportDelivery` exige rol en `["owner","manager","delivery"]` + módulo `delivery` (`src/app/api/orders/[orderId]/route.ts:379-392`), y el `UPDATE` filtra por `branch_id`.
- Cómo saber que falló: reporte de entrega aplicado a un pedido de otra sucursal, o con un rol distinto a los tres permitidos.

**3.3 🟡 Mesonero/cocina anulando pedidos sin código del dueño**
- Quién: empleado con sesión (no dueño).
- Ataque: `PATCH /api/orders/{orderId}` con `status:"Cancelado"` cuando el negocio exige aprobación.
- Qué debe pasar: si `cancellationApprovalRequired` está activo, se exige un código de un solo uso que solo recibe el dueño; sin él responde 428 y crea la solicitud (`src/app/api/orders/[orderId]/route.ts:490-606`). El código es `randomInt` (cripto), 6 intentos máx., expira a los 120 min (`src/lib/cancellationRequests.ts:1,14-15`) → no se fuerza bruta. Anular exige motivo ≥5 caracteres (`…/route.ts:431-439`).
- Cómo saber que falló: un pedido queda "Cancelado" con clave de mesonero/cocina sin haber ingresado un código válido.

---

### 4 · Inventario, recetas y proveedores

**4.1 🟡 Cajero/mesonero ajustando stock**
- Quién: empleado con sesión de rol bajo.
- Ataque: `POST /api/inventory` (o `DELETE`) para inflar/vaciar existencias.
- Qué debe pasar: inventario es solo `owner`/`support` + módulo `inventory` + sede (`src/app/api/inventory/route.ts:148,194,252` vía `checkInventoryAccess`).
- Cómo saber que falló: `quantity` cambia o un ítem se borra con clave de caja/mesonero/cocina.

**4.2 🔴 Transferir inventario robando de otra sede**
- Quién: empleado con sesión (no dueño), o dueño intentando cruzar sedes indebidas.
- Ataque: `POST /api/inventory/transfer` con `targetBranchId` arbitrario para mover stock entre sucursales.
- Qué debe pasar: solo `owner`/`support` + módulo inventario; la sede origen sale de `resolveBranchId` (no del body), solo `targetBranchId` viene del body (`src/app/api/inventory/transfer/route.ts:51-92`).
- Cómo saber que falló: transferencia aceptada con clave que no es de dueño, o con sede origen distinta a la del header.

**4.3 🟡 Encargado registrando pagos a proveedor (dinero que sale)**
- Quién: empleado con sesión de encargado.
- Ataque: `POST /api/supplier-purchases/{id}/payments` con un abono.
- Qué debe pasar: registrar abonos es solo `owner` (`src/app/api/supplier-purchases/[id]/payments/route.ts:73`); el guard general de proveedores valida rol + módulo `suppliers` (`src/app/api/suppliers/guard.ts:25-57`). El monto se normaliza y debe ser >0 (`…/payments/route.ts:78-83`).
- Cómo saber que falló: aparece un pago a proveedor con clave de encargado, o con `amountUSD`/`amountVES` negativos.

---

### 5 · Configuración, menú y sedes

**5.1 🔴 Dueño auto-subiéndose el plan / activando módulos que no pagó**
- Quién: empleado con sesión de dueño (`owner`).
- Ataque: `POST /api/business-config` con `membershipPlan:"complete"` o `customIncludedModules:[...]`.
- Qué debe pasar: cambiar plan/módulos incluidos es SOLO `support`: `setPlanConfig` sale temprano si el rol no es soporte (`src/app/api/business-config/route.ts:261-291`). Además, al activar un módulo (`setBooleanConfig`) el dueño no puede encender lo que no está incluido en el plan (`…:249-256`).
- Cómo saber que falló: el `membershipPlan` cambia, o un módulo fuera del plan queda `enabled` tras un POST con clave de dueño.

**5.2 🔴 Manipular la tasa manual del negocio**
- Quién: empleado con sesión de rol bajo (caja/mesonero).
- Ataque: `POST /api/business-config` con `manualExchangeRate` o `exchangeRateMode` para bajar la tasa de todo el negocio.
- Qué debe pasar: la config solo la tocan `owner`/`support` + `canLocalAccessUseModule(access,"settings")` (`src/app/api/business-config/route.ts:125-142`). El endpoint público de tasa (`/api/exchange-rate`) es solo lectura.
- Cómo saber que falló: `manualExchangeRate` cambia con clave que no es de dueño/soporte.

**5.3 🔴 Cajero editando el menú (precios que alimentan el re-precio público)**
- Quién: empleado con sesión de rol bajo.
- Ataque: `POST /api/menu-products` cambiando el `price` de una burger (para que 1.1 quede "legal").
- Qué debe pasar: el menú es solo `owner`/`manager` + módulo `menuProducts` (`src/app/api/menu-products/route.ts:39-72,171`); precio debe ser >0.
- Cómo saber que falló: el precio de un producto cambia con clave de caja/cocina/mesonero.

**5.4 🟡 No-dueño creando/borrando sucursales o config por sede**
- Quién: empleado con sesión de encargado/soporte.
- Ataque: `POST /api/branches`, `DELETE /api/branches/{id}` (borra en cascada), o `PATCH /api/branches/{id}/config`.
- Qué debe pasar: crear/editar/borrar sede y su config es SOLO `owner` (`requireOwner`, `src/app/api/branches/route.ts:76`, `src/app/api/branches/[id]/route.ts:24-30`, `src/app/api/branches/[id]/config/route.ts:38-44`); no se puede quedar con <1 sucursal (`…/[id]/route.ts:85-88`).
- Cómo saber que falló: una sede se crea/borra, o su config cambia, con clave que no es de dueño (incluido soporte en estas rutas).

---

### 6 · Usuarios, acceso y auditoría

Piedra angular: el middleware `src/proxy.ts` (matcher `/api/:path*`, `:15`) BORRA todos los `x-staff-*` que mande el cliente (`:22-31`) y solo re-emite el rol tras verificar un `Bearer` contra Supabase Auth (`:33-50`). Blindado por `src/__tests__/proxy.security.test.ts`.

**6.1 🔴 Forjar `x-staff-role: owner` (escalada total)**
- Quién: desconocido de internet, o empleado de rol bajo.
- Ataque: cualquier ruta privada (ej. `POST /api/staff`) con header `x-staff-role: owner`, `x-staff-all-branches: true` y SIN `Authorization: Bearer`.
- Qué debe pasar: el middleware elimina esos headers antes de que la ruta los vea (`src/proxy.ts:22-31`); sin Bearer válido ni clave `.env`, `getRequestAccess` responde no autorizado (401/403).
- Cómo saber que falló: la ruta actúa como dueño (crea un usuario, lee la config) solo con el header inyectado. Si eso pasa, el middleware no está corriendo (archivo renombrado, Next <16, o matcher roto) — catastrófico.

**6.2 🔴 Fuerza bruta de las claves por rol del `.env`**
- Quién: desconocido de internet.
- Ataque: `POST /api/local-auth` (o mandar `x-local-password` a cualquier ruta) probando claves.
- Qué debe pasar: rate-limit 20/min por IP + same-origin (`src/app/api/local-auth/route.ts:56-67`). La resistencia real depende de la fuerza de la clave en el `.env` (`getLocalAccessFromPassword`, `src/lib/localAccess.ts:196-227`). Nota de riesgo: el contador vive en RAM por instancia serverless, así que se multiplica con varias instancias / IPs rotativas (`src/lib/rateLimit.ts:43-47`, `getClientIp` confía en `x-forwarded-for` `:129-136`).
- Cómo saber que falló: aceptar cientos de intentos/min desde una IP, o que una clave débil/por defecto entre.

**6.3 🔴 Ex-empleado desactivado que sigue entrando**
- Quién: ex-empleado con su token de Supabase o su usuario individual aún guardado.
- Ataque: reusar el `Bearer` o volver a loguearse tras ser dado de baja.
- Qué debe pasar: `getStaffAccessFromToken` devuelve `FAIL` si `staff_users.is_active === false` (`src/lib/authServer.ts:70-79`); el middleware entonces no re-emite rol.
- Cómo saber que falló: un usuario con `is_active=false` sigue autorizado en rutas privadas. (Riesgo residual: si el ACCESO era por clave compartida del `.env`, desactivar al usuario no la revoca — hay que rotar la clave.)

**6.4 🔴 Empleado auto-concediéndose permisos**
- Quién: empleado con sesión (encargado con módulo de personal, o cualquiera que llegue a la ruta).
- Ataque: `PATCH /api/staff/{suPropioId}` subiéndose a `role:"owner"` o `allowedModules` completos.
- Qué debe pasar: gestión de personal es solo `owner`/`support` (`requireStaffAdmin`, `src/app/api/staff/[id]/route.ts:42-49`); y explícitamente no puedes editar tus propios permisos salvo que ya seas dueño (`…:110-112`). No se puede quitar el último dueño (`…:71-80`).
- Cómo saber que falló: el `role`/`allowedModules` del propio usuario cambia con su propia clave no-dueño.

**6.5 🟡 Ver la bitácora o los códigos de anulación sin ser dueño**
- Quién: empleado con sesión de encargado/caja.
- Ataque: `GET /api/audit-logs` o `GET /api/cancellation-requests`.
- Qué debe pasar: la bitácora es `owner`/`support` (`src/app/api/audit-logs/route.ts:33-38`) y filtra por sede salvo `?scope=all`; los códigos de anulación son SOLO `owner` (`src/app/api/cancellation-requests/route.ts:39-44`).
- Cómo saber que falló: un encargado obtiene los logs, o cualquiera que no sea dueño ve los `code` de anulación (con los que anularía cualquier pedido).

---

### 7 · Integraciones y superficie externa

**7.1 🔴 Webhook de Stripe falsificado (marcar pedidos como pagados)**
- Quién: desconocido de internet.
- Ataque: `POST /api/payments/webhook` con un cuerpo `checkout.session.completed` inventado y `metadata.orderId` de un pedido real.
- Qué debe pasar: se valida la firma con `stripe.webhooks.constructEvent(rawBody, signature, secret)`; firma inválida → 400 (`src/app/api/payments/webhook/route.ts:20-31`). Además hay idempotencia y filtro por sede, y se ignora si el pedido está anulado (`…:62-100`).
- Cómo saber que falló: un pedido pasa a "Pagado" con un POST sin firma válida de Stripe.

**7.2 🟡 Webhook de WhatsApp sin App Secret (spam + encuestas falsas)**
- Quién: desconocido de internet.
- Ataque: `POST /api/whatsapp/webhook` con un evento fabricado: respuestas de encuesta con `orderId` arbitrarios y un `from` (número) elegido por el atacante.
- Qué debe pasar: se valida `X-Hub-Signature-256` (HMAC con `WHATSAPP_APP_SECRET`, `timingSafeEqual`). PERO si el secreto NO está configurado, `isValidSignature` hace `return true` y acepta cualquier cuerpo (`src/app/api/whatsapp/webhook/route.ts:52-70`). Con eso se falsifican respuestas (`savePublicSurveyResponse`) y se dispara `thankCustomer(reply.from)` → mensajes de WhatsApp desde la cuenta del negocio a números arbitrarios (`…:74-135`).
- Cómo saber que falló: sin `WHATSAPP_APP_SECRET`, un POST cualquiera devuelve 200 y sale un WhatsApp a un número que puso el atacante. **Verificar que el secreto esté seteado en producción** (el montaje Meta estaba a medias).

**7.3 🟡 Comprobante de pago con monto alterado o repetido**
- Quién: cliente cualquiera (endpoint público).
- Ataque: `POST /api/payment-proofs` reportando `amountReportedUSD` mayor al pagado, referencia corta, o reenviando el mismo comprobante muchas veces.
- Qué debe pasar: la referencia se valida en el SERVIDOR (mínimo de dígitos `MIN_REFERENCE_DIGITS`, `src/app/api/payment-proofs/route.ts:188-192`), hay anti-duplicado por pata (`…:325-376`), same-origin + tamaño + rate-limit. El comprobante es solo un REPORTE: el cobro real lo registra caja al confirmarlo (`src/app/api/payment-proofs/[proofId]/review/route.ts:210-236`, con candado optimista y filtro por sede).
- Cómo saber que falló: si caja confirma con `registerPayment:true` sin verificar el banco, el monto INVENTADO por el cliente se vuelve cobro real (`buildPaymentFromProof`). Riesgo de PROCESO: la defensa es que caja verifique la referencia/captura, no el código. Probar: reportar $100 sobre un pedido de $10 y ver si tras confirmar el pedido queda "Pagado".

**7.4 🟡 Manipular la tasa vía el endpoint público de tasa**
- Quién: desconocido de internet.
- Ataque: `GET /api/exchange-rate?branch=...` intentando escribir/forzar una tasa; o depender de que el negocio la lea de aquí.
- Qué debe pasar: es solo lectura; el modo/tasa salen de la config del negocio y del BCV con caché y fallback (`src/app/api/exchange-rate/route.ts:260-366`). El cliente no puede escribir nada.
- Cómo saber que falló: encadenar con 1.2 — el único camino para que una tasa baja "pegue" es el `POST /api/orders` en modo manual mal configurado (ver 1.2).

**7.5 🟡 Subir un archivo malicioso como "imagen" del menú/comprobante**
- Quién: cliente (comprobante) o empleado con menú (imagen de producto).
- Ataque: `POST /api/menu-products/upload-image` o `POST /api/payment-proofs` con un `dataUrl` que no es imagen (script, HTML, SVG con payload) o gigante.
- Qué debe pasar: `assertDataUrlImage` valida que sea imagen real y dentro del límite de bytes; el nombre se sanea con `sanitizeUploadedImageFileName` (`src/app/api/menu-products/upload-image/route.ts:97-119`; `src/app/api/payment-proofs/route.ts:199-238`). La subida de imagen del menú es `owner`/`manager` + same-origin + rate-limit.
- Cómo saber que falló: queda almacenado un archivo cuyo contenido no es una imagen válida, o un nombre con path/extensión peligrosa.

**7.6 🟡 Saltar el guardia same-origin con petición directa**
- Quién: bot / script (sin navegador).
- Ataque: cualquier `POST` público (crear pedido, comprobante, cuenta) con `curl` SIN `Origin` ni `Referer`.
- Qué debe pasar: entender que same-origin NO frena esto — `checkSameOriginRequest` devuelve `allowed:true` cuando falta la fuente (`src/lib/requestGuards.ts:226-233`). La contención real es rate-limit por IP + las validaciones de negocio (re-precio, tasa server, ids imprevisibles).
- Cómo saber que falló: no aplica como "bug"; sirve para calibrar que las defensas de contenido (grupo 1) aguanten tráfico directo, ya que el escudo de origen no está.

---

**Resumen de prioridades para la ronda**
- Hallazgo abierto que filtra datos de clientes: **1.3** (`table-account-status`).
- Condicional a configuración de producción: **7.2** (WhatsApp sin App Secret).
- Debilidad estructural a tener presente: **6.2 / 7.6** (rate-limit en RAM por instancia; same-origin no frena `curl`).
- Los ataques clásicos de dinero (**1.1, 1.2, 2.1, 2.2, 2.3, 6.1, 7.1**) están blindados en el código citado: el objetivo al ejecutarlos es CONFIRMAR que siguen fallando tras cada cambio, no encontrarlos abiertos.

### A.99 · Barrido de rutas sin guard (el pendiente que más vale)

Aparte de los ataques de arriba, hay que hacer el inventario completo:

1. Lista **todos** los endpoints bajo `src/app/api/**` con handler POST, PATCH,
   PUT o DELETE.
2. Para cada uno, marca si llama a `getRequestAccess` / `checkRole` / algún
   guard, y si valida la **sede** (`resolveBranchId` / `resolveScopedBranchId`).
3. Separa a propósito los que son **públicos por diseño** (crear pedido, reportar
   pago, reservar, encuesta, cancelar el propio pedido) y **di cuáles
   consideraste públicos**, para que se pueda discutir la lista.
4. Todo endpoint de mutación que quede sin guard y sin justificación es un
   hallazgo, aunque no logres explotarlo en el momento.

---

## 4 · Parte B — Revisión de FUNCIONAMIENTO módulo por módulo

El guion detallado ya existe y **no hay que reescribirlo**:
**[`CHECKLIST-MODULOS-ENTREGA.md`](CHECKLIST-MODULOS-ENTREGA.md)** — 61 módulos
con 369 pruebas, más un anexo de 30 huecos con 149 pruebas (Stripe, cupones,
IVA/IGTF, propina marcada "comingSoon", exportes, integraciones y el hecho de
que **los trabajos de fondo no tienen cron: viven de que alguien tenga el panel
abierto**). Son 518 pruebas en total.

Aquí ese checklist se trabaja **dentro de la simulación**, no aparte: cuando el
día 5 haya un rush, ese es el momento de marcar las pruebas de cocina y caja;
cuando el día 13 llegue el proveedor, se marcan las de compras y cuentas por
pagar. Así cada prueba se hace con datos de verdad encima y no en una base
vacía, que es donde todo funciona.

**Orden sugerido:** primero el **anexo** (es corto y ahí están las promesas que
pueden explotar en la entrega), después los módulos del cliente, luego el
dinero, y de último configuración.

---

## 5 · Parte C — Las dos semanas de vida real

Catorce días. La primera semana es el negocio funcionando; la segunda es el
negocio **bajo ataque, con fallas y con gente cometiendo errores**. Cada día
tiene: qué pasa ese día, qué hay que ejecutar, y **qué tiene que cuadrar antes
de dormir**.

Al cierre de CADA día se corre la reconciliación: si el dinero no cuadra al
centavo, ese día no se da por bueno y el problema se anota antes de seguir.

### Semana 1 — el negocio de verdad

**Día 1 · Lunes de apertura.** Se abre con el menú real cargado, las mesas y los
QR impresos. Pedidos por los tres caminos: comer aquí desde el QR de la mesa,
para llevar, y delivery con ubicación por GPS. Cocina los prepara, caja los
cobra con métodos distintos (efectivo divisas, pago móvil, Zelle, punto).
*Cuadre:* el cierre del día = lo cobrado por método = lo vendido menos lo
pendiente.

**Día 2 · Martes flojo.** Poca venta, y lo que más pasa son cosas raras: dos
clientes cancelan desde su teléfono antes de que cocina empiece; uno pide y
nunca aparece; entran tres reservas para el fin de semana.
*Cuadre:* los cancelados no aparecen en el reporte del dueño, y los insumos de
esos pedidos volvieron al stock.

**Día 3 · Miércoles de promoción.** Se activa una promoción y un cupón. Llegan
pedidos con descuento por los tres canales, y varios delivery a distancias
distintas para probar el cobro por kilómetro.
*Cuadre:* el total que vio el cliente = el total que registró caja, con el
descuento y el envío incluidos. **Si aquí hay diferencia, el negocio pierde
plata en cada venta y hay que parar todo.**

**Día 4 · Jueves de mesas largas.** Una mesa de 8 personas abre cuenta, pide en
tres tandas a lo largo de la noche, pide la cuenta desde el teléfono, y al final
**la dividen entre 4 personas con métodos distintos**. En paralelo, otra mesa se
va sin pagar y hay que registrarlo.
*Cuadre:* el pendiente de la cuenta = la suma de sus pedidos en todo momento; al
cerrarla, la suma de las cuatro partes = el total exacto, sin centavos perdidos.

**Día 5 · Viernes de rush.** El triple de pedidos en dos horas, con cocina
saturada. Los pedidos se acumulan, el mesonero entrega tarde, y **se acaba un
insumo a mitad del servicio**: hay que seguir vendiendo igual.
*Cuadre:* ninguna venta se perdió ni se duplicó; el faltante de inventario quedó
registrado como movimiento (no puede haber ventas sin rastro); los tiempos de
respuesta siguen razonables con la cola llena.

**Día 6 · Sábado de evento.** Se abre una sede de evento con un promotor
vendiendo desde su carrito. Al mismo tiempo el local sigue operando.
*Cuadre:* las ventas del evento quedan atribuidas a su vendedor; el consolidado
= local + evento; ningún pedido se cruzó de sede.

**Día 7 · Domingo de cierre de semana.** Llegan dos proveedores: uno se cobra
completo, al otro se le abona la mitad y queda a crédito con vencimiento.
Reportes de la semana, comparativo entre sedes, y compras que suman al stock.
*Cuadre:* deuda a proveedores = total de compras − abonos; el stock subió
exactamente lo que entró; el reporte semanal = la suma de los siete cierres.

### Semana 2 — todo lo que puede salir mal

**Día 8 · El internet se cae a mitad del servicio.** Se corta la conexión con
pedidos en curso y con caja a medio cobrar. Los equipos siguen recibiendo
pedidos sin internet y, cuando vuelve, todo tiene que sincronizar.
*Prueba clave:* que al volver **no se dupliquen** los pedidos que estaban en
cola ni se pierda ninguno. Aquí se prueba de verdad la cola del POS y la
protección contra reenvíos.

**Día 9 · Intentos de fraude del cliente.** Un cliente reporta un pago que nunca
hizo con una captura cualquiera; otro manda la misma referencia dos veces para
dos pedidos; otro escribe un monto mayor al que transfirió; otro copia el monto
con formato raro (`Bs 9.648,99`) a ver si el sistema lo lee como cero. Y alguien
intenta pedir una hamburguesa de $12,50 mandando que cuesta $0,01, y otro
intenta pagar en bolívares a una tasa inventada.
Y el ataque nuevo del día: **alguien que no está en el local le carga su comida
a la cuenta de una mesa ocupada** (el H-4 del §2). Se ejecuta primero **contra el
sistema actual, para dejar probado que hoy funciona**, y después contra el
camino B ya implementado, para dejar probado que ya no.
*Prueba clave:* **ninguno de esos pedidos puede terminar cobrado por menos de lo
que vale, ni cargado a una mesa que no lo pidió.** Los ataques de precio y tasa
ya se corrigieron una vez; hay que confirmar que la corrección sigue viva.

**Día 10 · El personal se equivoca (o hace trampa).** Un cajero cobra dos veces
el mismo pedido desde dos pantallas distintas; otro cobra con el método
equivocado y hay que corregirlo; alguien anula una venta ya cobrada y hay que
ver qué pasa con el dinero y con los insumos; y un empleado intenta anular sin
permiso, con el código de autorización del dueño de por medio.
*Cuadre:* el doble cobro no puede quedar registrado dos veces; toda anulación
deja rastro de quién, por qué, y qué pasó con la plata y con los insumos.

**Día 11 · Se va un empleado.** Se desactiva a alguien que tiene la sesión
abierta en su teléfono. Intenta seguir operando, intenta volver a entrar, y
**intenta entrar con la clave compartida de su rol**. En paralelo, al encargado
se le recortan los módulos y hay que confirmar que el recorte vale también por
dentro y no solo en el menú.
*Prueba clave:* el desactivado no puede hacer nada con su sesión vieja; y hay
que **medir y reportar** qué logra con la clave compartida, porque esa es una
decisión pendiente del dueño.

**Día 12 · Falta plata en la caja.** El cierre no cuadra con el efectivo
contado. Hay que reconstruir el día: quién cobró cada pedido, con qué método, a
qué hora, y qué se anuló. Se usa la auditoría como se usaría de verdad.
*Prueba clave:* que la auditoría alcance para responder "¿quién agarró esta
plata?" sin adivinar. Si no alcanza, eso es el hallazgo.

**Día 13 · Se cae la cadena de suministro.** Un proveedor no entrega y hay que
transferir insumos de la otra sede; un insumo llega vencido y se descarta; el
conteo físico no coincide con el sistema y hay que ajustarlo; y una compra queda
a medias (se registró pero el pago falló).
*Cuadre:* los dos inventarios cuadran después de la transferencia; los ajustes
quedan registrados con motivo; una operación a medias no deja el sistema en un
estado imposible.

**Día 14 · Cierre de quincena y contabilidad.** Cierre del período, reportes
para el contador, exportes a Excel y PDF, revisión del desglose fiscal
(IVA/IGTF), y **un respaldo que se restaura de verdad** para comprobar que
sirve.
*Prueba clave:* los archivos que se le mandan al contador abren bien y los
números coinciden con el sistema. Y el respaldo restaurado devuelve el negocio
igualito: **un respaldo que nunca se restauró no es un respaldo.**

### Además, en cualquier momento de las dos semanas

Cosas que no son de un día en particular y hay que meter cuando menos se espere:

- La tablet de caja se queda abierta y alguien más la agarra.
- Un cliente entra con un QR viejo de una mesa que ya no existe.
- Alguien pide desde la sede equivocada.
- Se cambia la tasa de cambio a mitad del día con pedidos abiertos.
- Un teléfono se queda sin batería con un pedido a medio hacer.
- Dos personas editan la configuración del negocio al mismo tiempo.
- Se activa el modo entrenamiento y alguien vende "de mentira" por error.
- Un pedido queda 12 horas sin pagar (anulación automática).
- El dueño mira sus reportes desde el teléfono, fuera del local.

---

## 6 · Invariantes: lo que SIEMPRE tiene que cuadrar

Estas reglas se comprueban **al final de cada día**, no solo al final. Si una
falla, el día no se cierra hasta entender por qué.

### 1 · Dinero del día

**1.1 · El desglose por método suma el total del cierre.**
Lo que la caja reporta método por método tiene que dar exactamente lo que dice haber cobrado.
`Σ paymentByUSDMethod[].totalUSD + Σ paymentByVESMethod[].totalUSD == realCollectedUSD` (±0,01) y, en paralelo, `realCashUSD + realVESEquivalentUSD == realCollectedUSD`.
Dónde: `day_closes.data` (jsonb) — campos escritos en `src/app/api/day-close/route.ts:301,304,310,406,409`. Ya se comprueba en `scripts/qa-day-close.mjs:269-273` y en `scripts/sim/lib/day-engine.mjs:463-474`.
Si falla: un método de cobro quedó fuera del arqueo, o el cierre se armó con una lista incompleta. **Ojo: estos números los manda el cliente** (ver trampa T-8).

**1.2 · Cobrado + pendiente = vendido.**
Por pedido: `payment_received_equiv_usd + payment_pending_usd == total_usd`, con `payment_pending_usd = 0` cuando el estado es `Pagado` (`src/lib/localOrderMoney.ts:302-305`).
Por día: `summary.collectedUSD + summary.pendingUSD == summary.totalUSD` en `GET /api/reports?period=today` con `x-branch-id`.
Dónde: tabla `orders`, columnas `total_usd`, `payment_received_equiv_usd`, `payment_pending_usd`, `payment_status` (`supabase/migrations/0001_initial_schema.sql:147,180,188,189`).
Si falla: dinero que entró y no bajó el pendiente, o un pedido marcado `Pagado` sin cubrir su total (`REC-12` en `scripts/sim/reconciliacion-final.mjs:174-177`).

**1.3 · Los cobros por origen suman el total cobrado.**
Cuenta de mesa + cobro directo = todo lo cobrado, sin solaparse.
En el cierre: `Σ collectionByOrigin[].totalUSD == Σ payment_received_equiv_usd` de los pedidos vivos de la sede que no estén `Cancelado` y tengan recibido > 0 — lo calcula el **servidor** en `src/app/api/day-close/route.ts:500-535`, etiquetas literales `"Cobros de cuentas de mesa"` y `"Cobros directos (sin cuenta)"`.
En reportes: `collectionByOrigin.openAccounts.collectedUSD + collectionByOrigin.direct.collectedUSD == summary.collectedUSD` (`src/app/api/reports/route.ts:206-212,457-471`).
El discriminante siempre es `orders.open_account_id`. Ya probado en `scripts/qa-cobros-origen.mjs:143-206`.
Si falla: un cobro de cuenta se contó como directo (o al revés) y el dueño no puede saber cuánto entra por mesa.

**1.4 · Un pedido anulado no puede seguir contando como venta.**
`status = 'Cancelado'` queda fuera de: reportes (`src/app/api/reports/route.ts:148-151`), `collectionByOrigin` del cierre (`:509`), y totales de la cuenta abierta (`src/lib/ordersStoreOpenAccounts.ts:190-192`).
Pero su dinero **no se borra de la fila**: `payment_received_equiv_usd` y `payment_status` se conservan (`scripts/sim/probar-anulaciones.mjs:82-84`, ANU-3).
El único sitio donde el dinero anulado es legítimo: `cancelledKeptUSD` / `cancelledRefundedUSD` del cierre (`src/app/api/day-close/route.ts:267-270`), gobernados por `orders.cancel_refund` (`'se_quedo'` | `'devuelto'`, migración `0036`).
Comprobación: `Σ cancel_refund_usd where cancel_refund='se_quedo' == cancelledKeptUSD`, y `Σ total_usd where status='Cancelado'` no aparece en `totalSoldUSD` ni en `summary.totalUSD`.
Si falla: o una anulación sigue inflando la venta, o el dinero que se quedó en la gaveta desapareció del arqueo (hallazgo BH-SIM-005).

**1.5 · Los bolívares se convierten a la tasa DEL PEDIDO.**
`payment_received_equiv_usd == round2(amount_received_usd + amount_received_ves / exchange_rate)`.
Dónde: fórmula única en `src/lib/localOrderMoney.ts:296-300`; columnas `orders.amount_received_usd`, `orders.amount_received_ves`, `orders.exchange_rate` (`numeric(14,4)`, `0001_initial_schema.sql:153,181,182`).
Si falla: alguien cobró con otra tasa que la del pedido — exactamente el bug BH-SIM-002 (cliente fabricando su tasa), hoy blindado en `src/lib/publicOrderGuards.ts`.

---

### 2 · Inventario

**2.1 · La ecuación del stock.**
`quantity` del insumo = suma de todos sus movimientos, porque `quantity_moved` viene **con signo** (positivo entra, negativo sale).
`inventory_items.quantity == Σ inventory_movements.quantity_moved` filtrando por `item_id` **y** `branch_id`; y el `final_quantity` del movimiento más reciente tiene que ser ese mismo número.
Tipos que el servidor escribe de verdad (`movement_type`): `Carga inicial`, `Compra`, `Consumo`, `Ajuste`, `Transferencia enviada`, `Transferencia recibida`, `Traslado`. **No existen `Entrada`, `Salida` ni `Devolución`** (ver T-3).
Si falla: alguien tocó el stock sin dejar movimiento — p. ej. borrar un insumo no escribe nada (`src/lib/ordersInventory.ts:684-706`).

**2.2 · Una venta con stock insuficiente deja movimiento igual.**
El stock tiene suelo en cero, pero la venta nunca desaparece del historial: `moved = min(previo, pedido)`, `shouldRecord = pedido > 0` siempre (`src/lib/inventoryShortage.ts:28-49`).
No hay columna de faltante: el faltante va **dentro del texto** — `reason ilike '%faltaron%'`, formato exacto `"Consumo automático por pedido (faltaron 5 unidades)"`.
Dónde: `inventory_movements` con `movement_type='Consumo'`; casos fijados en `src/lib/__tests__/inventoryShortageTrace.test.ts:13-54`.
Si falla: vuelve BH-SIM-004 — vender con stock 0 no dejaba rastro y el faltante era invisible.

**2.3 · Anular declarando que no se usaron los insumos los devuelve.**
`inventoryWasUsed:false` ⇒ `orders.cancel_inventory_used = false` ⇒ reversión que escribe un movimiento **`Ajuste`** positivo por insumo, con `note = "Reversión pedido <id>"` y `reason = "Reversión por anulación de pedido (ingredientes sin usar)"` (`src/lib/ordersInventory.ts:487-503`).
`Σ quantity_moved de Ajuste note='Reversión pedido X' == Σ |quantity_moved| de Consumo note='Pedido X'`, **salvo las líneas con `quantity_moved = 0`** (faltante total), que se saltan a propósito (`:465-466`).
Es idempotente por insumo (`:427-442`): un reintento completa lo que falte sin duplicar.
Si falla: o el stock no volvió (se pierde inventario real), o volvió dos veces (inventario fantasma).

**2.4 · Una transferencia son dos movimientos que se anulan.**
No hay tabla de transferencias: viven como pares en `inventory_movements`.
Por cada transferencia: `Transferencia enviada` negativo en la sede origen (`src/lib/inventoryTransfer.ts:248-262`) + `Transferencia recibida` positivo en la destino (`:175-189` o `:218-232`), misma cantidad absoluta. La suma de ambos debe dar 0.
El destino se busca por **nombre normalizado + unidad**, no por id: si no existe, se crea un insumo nuevo (`:191-216`). La validación es todo-o-nada antes de escribir (`:106-117`), así que una transferencia nunca deja stock negativo.
Si falla: hay un `enviada` sin su `recibida` — la caída entre inserts deja el origen bajado y el movimiento de salida sin escribir (`:234-248`).

**2.5 · Ajustes manuales.**
Son **valor absoluto**, no delta: se guarda la cantidad nueva y el movimiento lleva `quantity_moved = final − previo` (con signo), `movement_type='Ajuste'`, `reason='Ajuste manual de inventario'` — todo fijo en `src/lib/ordersInventory.ts:650,660,665`.
Si falla (movimiento ausente): la cantidad cambió sin justificación auditable. Solo se escribe si la cantidad cambió (`:651`).

---

### 3 · Estados de los pedidos

**3.1 · Tabla de transiciones válidas (fuente única).**
`src/lib/orderStatusPermissions.ts:79-85`:
`Nuevo → Preparando|Listo|Entregado|Cancelado` · `Preparando → Listo|Entregado|Cancelado` · `Listo → Preparando|Entregado|Cancelado` · `Entregado → Listo|Cancelado` · `Cancelado → (nada)`.
Los saltos hacia adelante son intencionales (flujo sin cocina, `kitchenFlowMode` `direct`/`mixed`).
Estados exactos, sensibles a mayúsculas: `Nuevo`, `Preparando`, `Listo`, `Entregado`, `Cancelado` (enum en `supabase/migrations/0001_initial_schema.sql:19-20`). **`"En preparación"` no es un estado**, es solo la etiqueta que se pinta.

**3.2 · Cancelado es terminal.**
Se hace cumplir dentro del candado optimista, en el único sitio que comparten las dos puertas de API: `src/lib/ordersStoreLifecycle.ts:57-63` ("Este pedido está ANULADO y no puede cambiar de estado").
Además no admite cobro: `src/lib/ordersStorePayments.ts:91` filtra `.neq("status","Cancelado")`.
Comprobación: ninguna fila `Cancelado` puede tener `payment_updated_at` posterior a `cancelled_at`, y ningún PATCH de estado sobre ella puede devolver 200.
Excepción conocida y única: la compensación anti-carrera de la anulación automática reescribe `status='Nuevo'` directo por Supabase, sin pasar por la máquina (`src/lib/unpaidAutoCancel.ts:216-227`).

**3.3 · Un entregado no vuelve a Nuevo.**
`Entregado` solo admite `Listo` (des-entregar) o `Cancelado`. Cualquier 200 sobre `Entregado → Nuevo` o `Entregado → Preparando` es una violación.
Si falla: un pedido ya cobrado y entregado puede reabrirse y volver a cobrarse (era el hueco H1 de 2026-07-24).

**3.4 · Qué rol puede hacer cada salto.**
Roles en inglés (`owner, manager, cashier, waiter, kitchen, delivery, promoter, support`, `src/lib/localAccess.ts:9-19`).
`canRoleUpdateStatus` (`orderStatusPermissions.ts:9-48`): owner/manager todo · cashier todo incluido `Cancelado` · kitchen solo `Preparando`/`Listo` · promoter todo menos `Cancelado` · waiter solo `Listo`/`Entregado` · delivery y support nada.
`getRoleTransitionError` (`:55-71`), solo para mesonero: no puede `→Entregado` si el pedido no está `Listo`, y `→Listo` solo desde `Entregado` (des-entregar).
Anular exige motivo de mínimo 5 caracteres (`src/app/api/orders/[orderId]/route.ts:429-439`) y, si `cancellationApprovalRequired` está encendido, código de dueño de un solo uso: HTTP **428** con `requiresCancelCode` (`:490-606`).
Si falla: cocina cancelando o mesonero saltándose la cocina — el famoso falso positivo D1-CX-1 fue justo lo contrario (el mesonero **no** puede anular, y eso está bien).

---

### 4 · Cuentas abiertas

**4.0 · Nada entra a una cuenta sin que alguien del local lo haya aprobado.**
*(invariante nuevo del camino B, ver H-4 en el §2)*
Todo pedido con `open_account_id` tiene que tener detrás una confirmación hecha
por personal identificado: o lo asoció el panel, o alguien tocó "Sumar a la
cuenta". Se comprueba cruzando los pedidos de cada cuenta contra `audit_logs`
(`action = 'open_account.order.attached'`) — cada pedido adjuntado debe tener su
registro con actor. **Un pedido dentro de una cuenta sin ese registro significa
que entró solo, y eso es exactamente el fraude que el camino B viene a cerrar.**

**4.1 · El pendiente de la cuenta = suma del pendiente de sus pedidos.**
`total_estimated_usd = Σ total_usd`, `total_collected_usd = Σ payment_received_equiv_usd`, `pending_usd = max(total − cobrado, 0)` sobre los pedidos con `open_account_id = X` **y `status != 'Cancelado'`** (`src/lib/ordersStoreOpenAccounts.ts:183-207`).
Dónde: tabla `open_accounts`, columnas `total_estimated_usd`, `total_collected_usd`, `pending_usd`, `status` (`Abierta`|`Cerrada`|`Cancelada`) — `0001_initial_schema.sql:86-103`.
**Es una caché**, no un cálculo en vivo: se recalcula en 4 sitios (cobro, atar pedido, anular staff, anular cliente) y los dos de anulación **se tragan el error** con `.catch(() => {})` (`src/lib/ordersStoreLifecycle.ts:134-138`).
Si falla: la cuenta muestra un pendiente viejo y la mesa paga de menos o de más.

**4.2 · Lo cobrado en la cuenta cuadra con lo cobrado en sus pedidos.**
`Σ orders.amount_received_usd where open_account_id = X == open_accounts.total_collected_usd` (±0,02).
El cobro de cuenta completa se reparte FIFO entre los pedidos. Con dos cajeros a la vez, cada petición termina en 200 o en 409, nunca a medias, y el cobrado es la suma de los aceptados (`scripts/qa-open-accounts-attack.mjs:104-122`).
Si falla: un cobro se pisó a otro y hay dinero contado dos veces o perdido.

**4.3 · Cerrar una cuenta exige que esté paga — OJO: el servidor NO lo exige.**
Verificado: cerrar con $70 pendientes devuelve **200** (`scripts/qa-open-accounts-attack.mjs:414-415`). El servidor solo bloquea que la cierre un mesonero (`src/app/api/open-accounts/[accountId]/route.ts:692-696`) y que se cierre dos veces (409, `:318-340`). La fricción por deuda es **solo de pantalla** (`src/components/local/OpenAccountsPanel.tsx:1742-1783`).
Lo que sí es invariante: cobrar una cuenta ya `Cerrada` responde 409, cerrarla otra vez responde 409, y pedir la cuenta de una mesa cerrada responde 404.
El cierre automático solo ocurre con `closeIfPaid && pendingUSD <= 0.01` (`route.ts:628-643`).
Si se quiere la regla dura ("no se cierra con deuda"), hoy no existe en el servidor: es una decisión pendiente, no un bug encontrado.

**4.4 · Anular un pedido baja el pendiente de su cuenta al instante.**
Al cancelar, el pedido sale de la suma (`filter status !== 'Cancelado'`) y el recálculo se dispara desde staff (`ordersStoreLifecycle.ts:134-138`) y desde el seguimiento público (`src/app/api/public/order-cancel/route.ts:159-164`).
Comprobación: cuenta con $40 + $60 = $100; anular el de $60 deja `total_estimated_usd = 40` y `pending_usd = 40` (`scripts/qa-open-accounts-attack.mjs:377-386`).
Si falla: la mesa paga un pedido que se anuló.

**4.5 · Una mesa, una cuenta abierta.**
Índice único `(branch_id, lower(trim(table_number))) where status='Abierta'` (`supabase/migrations/0035_open_account_index_normalized.sql:11-13`). Un segundo intento devuelve 23505 traducido a español.
Si falla: dos cuentas vivas en la misma mesa y el cobro se parte solo.

---

### 5 · Aislamiento entre sedes

**5.1 · Ninguna fila sin sede, ninguna fila en la sede que no le toca.**
Tablas con `branch_id` obligatorio: `orders, menu_products, inventory_items, inventory_movements, inventory_recipes, day_closes, day_expenses, delivery_zones, payment_proofs, open_accounts, tables, suppliers, supplier_purchases, supplier_purchase_payments, subrecipes, survey_responses, reservations` (lista en `src/lib/__tests__/branchIsolation.fitness.test.ts:21-40`).
SQL de barrido: `count(*) where branch_id is null` debe ser 0 en todas (ya lo hace `integritySweep`, `scripts/sim/lib/db-verifier.mjs:59-97`).
Si falla: un registro huérfano que aparece en las dos sedes o en ninguna.

**5.2 · Nadie ve lo de la otra sede.**
Cabecera `x-branch-id` (alias aceptados: `x-santo-branch-id`, `x-current-branch-id`) — `src/lib/branch.ts:296-300`; el resolutor es `resolveBranchId` (`:202-259`), que **fuerza** a un empleado restringido a su propia sede aunque pida otra (`:244-251`).
Prueba de fuego: un manager de San Diego pidiendo `GET /api/orders` con `x-branch-id` de Principal no puede recibir **ni un solo** id de Principal (`scripts/sim/reconciliacion-final.mjs:181-185`, REC-14).
Las cabeceras `x-staff-*` del cliente se **borran** en el proxy antes de re-firmarlas (`src/proxy.ts:22-31,38-49`): no se puede suplantar rol.
Si falla: fuga de datos entre sucursales — el fallo más grave del sistema.

**5.3 · Cerrar una sede no toca la otra.**
Cerrar A borra los `payment_proofs` de A y deja intactos los de B; el cierre lleva `branch_id = A` y no aparece en el historial de B (`scripts/qa-day-close.mjs:210-241`).
Si falla: un cierre arrastra dinero o comprobantes ajenos.

**5.4 · El consolidado es la suma de las sedes.**
`GET /api/reports?scope=all` devuelve `byBranch[]` (`src/app/api/reports/route.ts:422-431`). Debe cumplirse `Σ byBranch[].collectedUSD == summary.collectedUSD` y lo mismo con `totalUSD`, `pendingUSD` y `orders`.
El consolidado es 403 para todo el que no sea `owner` o `support` (`:119-121`). En cierres, el consolidado es `GET /api/day-closes?scope=all`.
Si falla: el dueño ve un total que no es la suma de lo que ve en cada local.

---

### 6 · Auditoría y trazabilidad

**6.1 · Ninguna fila de auditoría sin actor.**
Tabla `audit_logs` (`supabase/migrations/0017_audit_logs.sql:16-29`): `branch_id, action, entity_type, entity_id, actor_role, actor_label, actor_source, ip_address, user_agent, metadata, created_at`.
Regla: toda fila tiene `actor_label` **o** `actor_role`. Ya barrido en `scripts/sim/lib/db-verifier.mjs:91-94`.
**No hay columna `actor_id`**: el id del empleado vive en `metadata.actorStaffId` (`src/lib/audit.ts:146`).
Si falla: hay una acción sensible que nadie puede atribuir.

**6.2 · El cierre guarda quién lo hizo — pero NO en `day_closes`.**
`day_closes` solo tiene `id`, `created_at`, `data` (jsonb) y `branch_id` (`0006_caja.sql:15-19` + `0009_branches.sql:34`). La columna `closed_by` del esquema original **se eliminó** en `0006_caja.sql:12`, y `data` tampoco lleva autor.
El único registro del autor: `audit_logs` con `action = 'day_close.saved'` y `entity_id = day_closes.id` (`src/app/api/day-close/route.ts:587-600`). Así se comprueba en `scripts/qa-day-close.mjs:251-256`.
Si falla (o si se busca el autor dentro del cierre): se concluye "el cierre no sabe quién lo hizo" cuando sí lo sabe, en otra tabla.

**6.3 · Los cobros guardan quién cobró.**
Columnas `orders.charged_by_id / charged_by_name / charged_by_role` (`0022_order_attribution.sql:22-24`), escritas al cobrar en `src/lib/ordersStorePayments.ts:70-76`. Espejo para quien registró: `registered_by_*` (`NULL` = pedido hecho por el cliente desde QR/web).
Comprobación: todo pedido con `payment_received_equiv_usd > 0` cobrado por caja debe tener `charged_by_name`. Acciones de auditoría: `order.payment.updated` (cobro directo) y `open_account.payment.updated` (cobro de cuenta).
Si falla: no hay ventas por vendedor ni responsabilidad sobre la caja. **Trampa:** si la migración 0022 no está aplicada, el cobro se reintenta **sin** atribución y devuelve 200 con los campos en NULL (`ordersStorePayments.ts:114-118`) — parece que nadie cobró, cuando lo que falta es la migración.

**6.4 · Huecos reales de la regla "toda acción con dinero deja registro con actor".**
Hoy **no** se cumple del todo, y conviene saberlo antes de reportarlo como bug nuevo:
- **Crear un pedido no escribe auditoría**: `src/app/api/orders/route.ts` no tiene ninguna llamada a `writeAuditLog`, y no existe la acción `order.created`.
- **Registrar un gasto tampoco**: `src/app/api/day-expenses/route.ts` no audita, y `day_expenses` **no tiene ninguna columna ni clave JSON de autor** (la forma completa está en `src/lib/ordersDayClose.ts:485-504`).
- Anular no tiene acción propia: viaja como `order.status.updated` con `metadata.status = "Cancelado"`.
Sí auditan: cobros, cierre, cuentas abiertas, comprobantes, compras y abonos a proveedor (`src/lib/auditActions.ts:4-29`).

---

### 7 · Proveedores y cuentas por pagar

**7.1 · Total de la compra = abonos + pendiente.**
`pendingUSD = max(0, total_usd − paid_usd)` y `pendingVES = max(0, total_ves − paid_ves)` — `src/lib/supplierPayables.ts:36-37`. **No existe columna de pendiente**: siempre es calculado.
Doble comprobación obligatoria: `supplier_purchases.paid_usd == Σ supplier_purchase_payments.amount_usd where purchase_id = X`. La fila de la compra es una **caché denormalizada** que se sincroniza best-effort (`src/lib/ordersSupplierPurchases.ts:235-255`); la verdad es la suma de los abonos.
Si falla: la deuda con el proveedor no es la que dice la pantalla.

**7.2 · El estado se corresponde con los números.**
`Pagado` ⟺ hay total **y** ambas monedas saldadas (`paid_usd >= total_usd − 0.01` **y** `paid_ves >= total_ves − 0.01`) · `Parcial` ⟺ hay algún abono pero no está saldada · `Pendiente` en cualquier otro caso — `src/lib/supplierPayables.ts:42-51`.
Valores exactos, con CHECK en base: `'Pendiente' | 'Parcial' | 'Pagado'` (`supabase/migrations/0014_supplier_payables.sql:71`).
Si falla: una compra mixta ($ + Bs) que se marca `Pagado` al abonar solo los dólares hace desaparecer la deuda en bolívares (era el bug B1 de 2026-07-24).

**7.3 · Ninguna factura sobreabonada.**
`paid_usd <= total_usd + 0.01` y `paid_ves <= total_ves + 0.01`. Rechazo en el momento del abono, con tolerancia de 1 centavo (`src/lib/ordersSupplierPurchases.ts:162,188-197`); barrido final en `scripts/sim/reconciliacion-final.mjs:167-168` (REC-10).
Si falla: se pagó de más y el dinero salió de caja sin respaldo.

**7.4 · Una compra con insumo vinculado sube el stock, una sola vez.**
Con `inventory_item_id` y `inventory_quantity > 0`: `+quantity` en `inventory_items.quantity` **y** un movimiento `movement_type='Compra'`, positivo, con `reason = "Entrada por compra a proveedor (<nombre>)"` (`src/lib/ordersStoreSupplierPurchases.ts:148-210`).
Comprobación: `stock_después == stock_antes + inventory_quantity` y existe exactamente 1 movimiento `Compra` por compra (`scripts/qa-dia-completo.mjs:370-382`).
**Es estrictamente aditivo**: editar o borrar la compra **no** devuelve el stock (`:358-406`, decidido así en `0013_supplier_purchase_inventory.sql:10-11`). Contarlo como reversión da un descuadre falso.

---

### 8 · Trampas de verificación (falsos positivos conocidos)

**T-1 · PostgREST corta en 1000 filas.**
Sin paginar, cualquier `select` sobre una tabla grande devuelve un trozo y el chequeo miente ("pedidos sin detalles" que sí los tienen — lección del Día 7). Usar siempre `fetchAll` (`scripts/sim/lib/db-verifier.mjs:39-55`).
Peor: **el propio servidor tampoco pagina**. `grep '.range('` sobre `src/app/api` no da ni un resultado, y `getOrdersFromStore` hace `.select("*")` sin rango y luego `order_items` con `.in(...)` también sin rango (`src/lib/ordersStoreQueries.ts:61-96`). Pasados ~1000 pedidos vivos o ~1000 líneas de pedido, **el cierre y `/api/reports` leen un pedazo de la realidad**. En una corrida de dos semanas esto se alcanza.

**T-2 · El cierre no filtra por fecha.**
`getOrders(branchId)` devuelve **todos los pedidos vivos de la sede**, de todos los días. Así que `collectionByOrigin` y la fotografía `orders[]` del cierre cubren lo acumulado, no el día. En una simulación de 14 días sin borrar pedidos, el cierre del día 14 recuenta los 13 anteriores.
Además la fotografía se corta en **500** pedidos y **500** comprobantes (`src/app/api/day-close/route.ts:440,537`). El "día comercial" real lo marca el cierre, no `created_at` (la base estampa `now()`).

**T-3 · Columnas que no se llaman como uno espera.**
`registered_by_name` / `charged_by_name` / `cancelled_by_name` (no "seller", no "user").
`inventory_movements.movement_type` (no `type`) y `quantity_moved` (no `quantity`).
`supplier_purchase_payments.method` y `.reference` (no `payment_method` / `payment_reference`) — advertido en el propio código, `src/lib/ordersSupplierPurchases.ts:200-201`.
`day_closes` **no tiene** `closed_by`; `day_expenses` solo tiene `id, created_at, date_value, close_status, data, branch_id` — concepto, monto, método y categoría viven **dentro del jsonb `data`** (`supabase/migrations/0006_caja.sql:23-31`).
`audit_logs` no tiene `actor_id` (está en `metadata.actorStaffId`).
`orders.payment_method` (0031) **no es** `payment_method_usd`: el primero es el método que el cliente **eligió al pedir**, el segundo el que la caja **registró al cobrar** (`src/lib/ordersStoreMappers.ts:141-145`).
`open_accounts` usa `total_estimated_usd`, `total_collected_usd`, `pending_usd`.

**T-4 · Las ventas por vendedor viven en el CIERRE, no en `/api/reports`.**
`/api/reports` ni siquiera selecciona `charged_by_name` (`src/app/api/reports/route.ts:124-125`). El dato está en `day_closes.data.salesBySeller` y `.ordersByRegistrar` (`src/app/api/day-close/route.ts:415-418`).
Y peor: **los calcula el navegador**, no el servidor (`src/app/pedidos/page.tsx:1669-1682`, enviados en `:2451-2452`). Un script que hace `POST /api/day-close` sin ese campo guarda `[]`, y luego "no hay ventas por vendedor" parece un bug del sistema. Es el falso positivo D5-EVT-4 (`scripts/sim/informes.mjs:121`).

**T-5 · `/api/reports` no cuenta anulados ni entrenamiento.**
Filtra `status !== 'Cancelado' && is_training !== true` (`src/app/api/reports/route.ts:148-151`). Comparar su "vendido" contra un `Σ total_usd` crudo de la tabla **siempre** dará diferencia.
Tampoco trae gastos, ni neto, ni fiscal: eso solo existe en el cierre.

**T-6 · "Cobros por origen" tiene dos definiciones distintas.**
Cierre: solo pedidos con recibido > 0, y solo `totalUSD` (`day-close/route.ts:509-519`).
Reportes: incluye pedidos con 0 cobrado y trae `totalUSD + collectedUSD + pendingUSD + accounts` (`reports/route.ts:206-212,457-471`).
Compararlos entre sí da una diferencia **legítima**. Cada uno se compara contra su propia definición.

**T-7 · Zona horaria: el rango y el agrupado no coinciden.**
`/api/reports` arma el rango con la medianoche del **servidor** (`start.setHours(0,0,0,0)`, `reports/route.ts:71-83`) pero agrupa por día en `America/Caracas` (`:154-159`). En Vercel (UTC) son 4 horas de corrimiento; en la máquina local, no. Un mismo pedido puede caer en días distintos según quién pregunte.

**T-8 · El total del cierre lo manda el cliente.**
El servidor re-normaliza la **forma** del payload (`day-close/route.ts:255-420`) pero **no recalcula** `realCollectedUSD`, `realCashUSD`, `realVES` ni el desglose por método: lo que mande el panel (o el script) es lo que queda guardado. Solo `collectionByOrigin`, `orders[]` y `paymentProofs[]` los calcula el servidor.
Consecuencia: **un cierre que "cuadra consigo mismo" no prueba nada**. Hay que cruzarlo contra la base (`orders`) o contra un libro esperado independiente, como hace `scripts/sim/lib/expected-ledger.mjs`.

**T-9 · 429 no es un fallo de negocio.**
`POST /api/orders` tiene freno de 10 pedidos/minuto por IP. Hay que reintentar esperando la ventana, no marcar FALLO (`scripts/qa-lib.mjs:140-150`, `postOrderThrottled`). El endpoint público de "pedir la cuenta" también frena, y el 429 puede **enmascarar** un 404 de aislamiento: probar el aislamiento **antes** de martillar (`scripts/qa-open-accounts-attack.mjs:238-239`).

**T-10 · El cierre es destructivo.**
Borra **todos** los `payment_proofs` de la sede y marca los gastos incluidos con `close_status='Cerrado'` (`scripts/qa-day-close.mjs:230-249`). Toda verificación de comprobantes tiene que correr **antes** del cierre, y toda prueba tiene que fotografiar y restaurar.

**T-11 · La reversión de inventario devuelve lo movido, no lo que pedía la receta.**
`quantityBack = Math.abs(quantity_moved)` del movimiento de consumo (`src/lib/ordersInventory.ts:465-466`). Si esa venta tuvo faltante, se devuelve menos que la receta completa. Un libro esperado que sume la receta entera al anular se descuadra sin que haya bug.
Y el movimiento de vuelta se llama **`Ajuste`**, no `Devolución`: filtrar por el nombre equivocado devuelve 0 filas.

**T-12 · Escrituras "best-effort" que devuelven 200 y no escriben.**
- El descuento de inventario al crear el pedido: `.catch(captureError)` — el pedido se crea igual sin descontar (`src/lib/ordersCore.ts:52`). Si la receta apunta a un insumo de otra sede, no queda ni movimiento (`ordersInventory.ts:317-322`).
- El recálculo de la cuenta abierta al anular: `.catch(() => {})` (`ordersStoreLifecycle.ts:134-138`).
- La atribución 0022 al cobrar: si la columna no existe, reintenta **sin** ella (`ordersStorePayments.ts:114-118`).
- La sincronía `paid_usd`/`payment_status` de la compra: best-effort (`ordersSupplierPurchases.ts:235-255`).
Todos responden "todo bien" por HTTP y dejan el dato faltante en la base. **Nunca dar por buena una escritura por el status 200: releerla de la base.**

**T-13 · La máquina de estados falla ABIERTA con estados desconocidos.**
`canTransitionOrderStatus` devuelve `true` si el estado de origen no está en la tabla (`orderStatusPermissions.ts:89-90`). Una fila con `status` vacío o legado puede ir a cualquier parte. No usarla como prueba de blindaje sin comprobar antes que el estado de partida es uno de los cinco.

**T-14 · El servidor equivocado.**
En esta máquina conviven dev servers de varios clientes; en el 3000 llegó a vivir la producción de otro. Antes de escribir hay que verificar identidad: `assertBrotherhood` compara el `<title>` (`scripts/qa-lib.mjs:47-68`), y el guard de simulación además **planta un centinela** en la base de prueba y comprueba que el server lo refleja (`scripts/sim/lib/simulation-guard.mjs:95-108`). Un dev server viejo fabrica 500 vacíos que parecen bugs.

**T-15 · Contar cierres sin separar los técnicos.**
Los cierres de fundación/puesta a punto se distinguen por `data.dateLabel` (`scripts/sim/reconciliacion-final.mjs:136-140`). Contarlos todos juntos hace fallar el conteo esperado sin que falte ni sobre ningún cierre real.

**T-16 · Pedidos de diagnóstico contados como operación.**
Los pedidos que crean los propios scripts de prueba de bugs se identifican por nombre y **se descuentan** antes de comparar (`scripts/sim/reconciliacion-final.mjs:30,94-102`). Sin ese descuento, el libro esperado nunca cuadra con la base.

---

## 7 · Qué hacer cuando algo falla

**No lo arregles en caliente.** En medio de una simulación de dos semanas, un
arreglo apurado contamina todo lo que viene después y ya no sabes qué estabas
probando.

1. **Anótalo** con: día, módulo, quién lo hizo, qué se esperaba, qué pasó, y la
   evidencia (respuesta + estado de la base).
2. **Clasifícalo**: 🔴 cuesta dinero o filtra datos de clientes · 🟠 rompe la
   operación · 🟡 molesta pero se puede vivir con eso · ⚪ cosmético.
3. **Sigue**. Los 🔴 se arreglan al terminar el día; el resto, al terminar la
   semana.
4. Cada arreglo lleva **su prueba automática** que lo blinda, y se vuelve a
   correr el día donde apareció.

Si un arreglo obliga a rehacer días anteriores, se usa
`scripts/sim/reset-simulation.mjs` y se corre de nuevo desde ahí: los resultados
de una simulación con parches a mitad de camino no significan nada.

---

## 8 · El informe final

Va dirigido al dueño, no a un técnico. Cinco bloques:

1. **Qué aguantó el sistema** — los 14 días en números: pedidos, dinero movido,
   cierres, y el resultado del cuadre diario. La frase que buscamos es "cuadró
   al centavo los 14 días" o, si no, exactamente dónde no.
2. **Qué intentamos romper y no pudimos** — los ataques bloqueados, agrupados
   por atacante. Esto es lo que le da tranquilidad al dueño.
3. **Qué sí se rompió** — cada hallazgo con su gravedad, qué le costaría al
   negocio en plata o en confianza, y si ya está arreglado.
4. **Qué depende de una decisión suya** — sin tecnicismos: las claves
   compartidas, el cierre de sesión por inactividad, qué hacer con las
   anulaciones de ventas ya cobradas.
5. **Qué queda para después** — con quién depende cada cosa.

Y al final, la comprobación que cierra la sesión:

```bash
cp .env.local.produccion.bak .env.local
node -e "console.log(require('fs').readFileSync('.env.local','utf8').match(/SUPABASE_URL=(.*)/)[1])"
```

**Tiene que decir `fpujezdaauedjvnhjzws`.** Si dice otra cosa, no termines la
sesión hasta arreglarlo.

---

## 9 · Reglas que no se negocian

- **Nunca contra producción.** Ni "solo para ver". Ni una consulta de lectura
  que se convierte en escritura por accidente.
- Las migraciones **las aplica el usuario**: tú escribes el `.sql` y avisas.
- Prefijo `ZZTEST-` en todo lo creado a mano fuera del motor de simulación.
- No borres ni vacíes `.vercelignore`.
- Un ataque no se da por bloqueado sin **mirar la base**: la respuesta HTTP sola
  no prueba nada.
- Un hallazgo no se da por arreglado sin **una prueba automática** que lo cubra.
- Al terminar: commit por fases, informe con números, y la memoria del proyecto
  actualizada con lo aprendido.

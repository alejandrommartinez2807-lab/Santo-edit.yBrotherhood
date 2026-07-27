# Prompt para la próxima sesión — Pagos: efectivo en divisas, mixto y la sección "Pago del pedido"

> Pega este archivo completo como primer mensaje de la sesión nueva.
> Escrito el 2026-07-26 tras el rediseño de "Reportar mi pago" (commits `7f3194c` y `918e326`, ya en producción).

---

## Contexto

Repo `D:\Santo edit`, rama **`brotherhood-publico`**. Next.js 16 + Supabase. Es el menú público + POS de **Brotherhood**, una hamburguesería real que **factura con esto todos los días**. Todo lo que se rompa lo pagan clientes de verdad.

Ayer se rediseñó la sección pública "Pago del pedido" (`PublicOrderPaymentSection.tsx`). Los tres problemas de abajo los encontró el dueño usándola.

### Reglas que no se negocian

1. **El símbolo `€` es intencional.** El cliente lo quiere así. No lo cambies a `$`. Vive en `publicCurrencySymbol` (`businessConfigFields.ts:118`).
2. **`.env.local` apunta al Supabase de PRODUCCIÓN del cliente.** Si levantas el server local, la app carga el menú REAL. **No crees pedidos de prueba ni abras pedidos reales de clientes.** Para revisar una pantalla, crea una página temporal en `src/app/` que parchee `window.fetch` con datos falsos y **bloquee con 400 los POST**; bórrala al terminar.
3. **No borres ni vacíes `.vercelignore`.** Sin él, `npx vercel --prod` sube `.claude/worktrees/` — 18 GB con el código de 14 proyectos de otros clientes. Y como reemplaza a `.gitignore`, si le quitas los `.env*` suben las llaves de producción.
4. **Las migraciones las aplica el usuario.** Tú escribes el `.sql` en `supabase/migrations/`, él lo corre en Supabase. Nunca asumas que una migración está aplicada.
5. **Verificación:** `npx tsc --noEmit`, `npx vitest run`, `npm run lint` (debe quedar en **0 problemas**) y `npm run build`. El navegador in-app se cuelga y **con el pane cerrado `window.innerHeight` es 0**, así que nada que dependa del viewport se puede medir; mide contenido (tamaños de fuente, `getBoundingClientRect` de altura, texto del DOM) y para eso el server tarda ~5 min en el primer request (filesystem lento en `D:`) — fuerza el compile con `Invoke-WebRequest -TimeoutSec 480` antes de navegar, y usa `tabs_create` porque la pestaña `seed` rechaza `navigate`.
6. **Deploy:** `npx vercel --prod` desde `D:\Santo edit` (alias automático a `brotherhood-xi.vercel.app`). Verifica después buscando alguna cadena nueva en los bundles servidos.

### Antes de escribir código: 3 cosas que hay que averiguar

- **¿Está aplicada la migración `0030`?** (`supabase/migrations/0030_payment_proof_second_image.sql`, columnas `proof_image_url_2` / `proof_file_id_2` / `proof_file_name_2`). `createPaymentProof()` **reintenta el insert sin esas columnas si fallan** (`ordersPaymentProofs.ts:265-272`), así que si no está aplicada **la segunda captura se está perdiendo en silencio en producción hoy**. Pregúntale al usuario o revísalo en Supabase.
- **¿Cuánto vale `publicMixedSecondProofEnabled`** en el negocio? Default `true` (`businessConfigFields.ts:96`), toggle en `local-santo/configuracion/page.tsx:3191`. Si el dueño lo apagó, hoy la segunda captura **ni se puede adjuntar** (el server borra `dataUrl2` en `api/payment-proofs/route.ts:268-274`).
- **Para el problema 1: qué tiene `orders.payment_method`** en un pedido de "Efectivo en divisas" recién hecho. Es la clave de la causa raíz (ver abajo). Pídele al usuario que mire un pedido real en Supabase, o que te diga qué método eligió exactamente.

---

## Problema 0 (MI ERROR — arreglar primero, es corto)

Ayer dije que había arreglado el riesgo de que un cliente **transfiriera el doble** en un pago mixto efectivo + electrónico. **No está arreglado: el código quedó inalcanzable.**

- En `PublicOrderPaymentSection.tsx:~1015` se calcula `cashLegs` filtrando `info.expectedPayments` con `isCashReportedMethod`.
- Pero el servidor **ya quitó las patas en efectivo** antes de mandarlas: `api/public/order-payment/route.ts:105` → `getOrderPaymentLegs(legsInput).filter((leg) => !leg.isCash)`.
- Por lo tanto `hasCashLeg` es **siempre `false`**, y la rama `mixtoConEfectivo` (líneas ~1123-1137) **nunca se ejecuta**.

**Consecuencia real:** en un pedido "Mixto: Efectivo en divisas $5 + Pago móvil Bs 1.820" con total $10, el monto grande dice **"TIENES QUE PAGAR $10.00"** (imperativo) mientras el formulario de abajo precarga solo Bs 1.820 (la pata electrónica). Quien le haga caso transfiere el doble y luego recibe "Estás reportando de MÁS".

**Cómo arreglarlo sin migración:** el servidor **sí** manda `requiredReportUSD` (que excluye el efectivo, `getRequiredReportUSD`). Si `requiredReportUSD > 0 && requiredReportUSD < totalUSD`, hay parte en efectivo: el monto grande tiene que ser el de las patas electrónicas y el texto secundario debe decir que el resto se entrega en efectivo. Alternativa más limpia: **añadir `isCash` a `expectedPayments`** en la respuesta del API (el tipo del cliente, líneas ~35-39, ni tiene ese campo) y dejar de filtrarlas, ajustando los consumidores.

Elige uno, pero **deja el caso cubierto con un test** para que no vuelva a quedar inalcanzable.

---

## Problema 1 — Efectivo en divisas: el formulario de reportar REAPARECE

**Lo que reportó el dueño, literal:** paga con "Efectivo en divisas" y adjunta la foto del dinero en el checkout. Al registrar dice "comprobante enviado" (bien). Baja a "Pago del pedido" y ve la imagen **en revisión** (perfecto). **Pero más abajo ve otra vez el método de pago, con un adjuntar captura y un botón "Enviar comprobante"** — le ofrece reportar de nuevo algo que ya reportó. Pasa en **Pick up y Delivery**.

### Causa raíz (confianza media — confírmala antes de tocar)

`getRequiredReportUSD()` en `src/lib/orderPaymentLegs.ts:148-160` devuelve **el TOTAL** cuando no logra identificar las patas:

```
if (legs.length === 0) return round2(Number(input.totalUSD) || 0)   // línea 154
```

Y `getOrderPaymentLegs()` devuelve `[]` en dos casos (`orderPaymentLegs.ts:58`):

```
if (!raw || /por confirmar/i.test(raw)) return []
```

O sea: si `orders.payment_method` llega **vacío** o dice **"Por confirmar"**, un pedido 100% efectivo pasa a exigir el total como si fuera electrónico. A partir de ahí es un callejón cerrado: la foto de los billetes viaja con método `"Efectivo en divisas ($X)"` (`CartDrawer.tsx:~2447`) y `isCashReportedMethod()` la excluye **a propósito** de la cobertura (`orderPaymentLegs.ts:117-142`), así que `pendingElectronicUSD` se queda en el total **para siempre** → `reportCovered` = false → se abren las compuertas del bloque y del botón.

Compuertas exactas:
- Bloque "Paso 1": `PublicOrderPaymentSection.tsx:~980` → `!hasConfirmedPayment && !awaitingProofSync && (!hasPendingProof || needsCorrection || !reportCovered)`
- Botón de reportar: `~1250` → dentro, `hasPendingProof && !needsCorrection && reportCovered ? (requiredElectronicUSD <= 0 ? null : enlace discreto) : BOTÓN GRANDE`
- `reportCovered`: `~439` → `requiredElectronicUSD <= 0 || pendingElectronicUSD <= 0`

**Ya descarté una hipótesis alternativa:** el proof siempre se crea con `status: "Comprobante enviado"` (`ordersPaymentProofs.ts:241`), que **sí** coincide con `hasPendingProof` (`~417`). Así que el problema no es el estado del comprobante.

**Sospecha de por qué `payment_method` llegaría vacío:** `ordersStoreCreate.ts:135` **borra `payment_method` del row y reintenta en silencio** si la columna no existe. La migración `0031` la agregó y, según el historial, está aplicada — pero verifícalo, y comprueba también si en el flujo de efectivo en divisas el método que se guarda es "Por confirmar".

### Criterios de aceptación

- Pick up con método único "Efectivo en divisas" + foto de billetes: tras registrar, la sección muestra el comprobante en revisión y "no hace falta enviarlo otra vez", y **NO** muestra bloque de datos/método, ni "Paso 1", ni "Paso 2", ni botón, ni formulario. Igual en Delivery.
- Se cumple **también** si el pedido no tiene `payment_method`: con un comprobante activo y sin patas electrónicas identificables, no se puede exigir el total. (Guarda defensiva: si no hay patas identificables pero **sí** hay un comprobante activo, no exijas el total.)
- El encabezado de la confirmación y la sección de abajo **nunca se contradicen**: si arriba dice "Comprobante recibido", abajo no puede haber "Reportar lo que falta del pago".
- Cuando caja marca el comprobante de efectivo como "Confirmado por caja", la sección no vuelve a pedir reporte.
- **Mixto efectivo + electrónico sigue igual que hoy:** con solo la foto del efectivo, la sección **sí** pide la captura/referencia de la pata electrónica, con su monto exacto.
- Pedido electrónico sin comprobante: sigue mostrando datos + "Reportar mi pago" (no lo silencies de más).
- Tests nuevos en `src/lib/__tests__/paymentReportCoverage.test.ts`: (a) método desconocido + comprobante de efectivo ⇒ cubierto; (b) método desconocido **sin** comprobantes ⇒ sigue exigiendo el total.

---

## Problema 2 — Pago MIXTO: las DOS evidencias deben ser obligatorias

**Lo que pide el dueño:** en "Pago móvil + Zelle" o "Zelle + Transferencia" (dos patas **electrónicas**), cada pata debe poder registrar **su** captura o **su** referencia, y **ambas son obligatorias** para enviar.

### Cómo está hoy

No existe ningún modelo de "evidencia por pata". Solo hay "monto por pata". El reporte es **una fila** en `payment_proofs` con:
- **UNA** `payment_reference` (columna única desde `0001_initial_schema.sql:248`)
- **hasta DOS** imágenes (`0030`, columnas `_2`), la segunda **opcional por diseño** y detrás de `publicMixedSecondProofEnabled`
- montos **sumados**: `amountReportedUSD` = suma de todos los `entries.usd`, `amountReportedVES` = suma de todos los `.ves` (`PublicOrderPaymentSection.tsx:~726-727`)

Validación de evidencia hoy (`~777`):
```
const sendsSecondProof = isMixedReport && allowSecondProof && Boolean(dataUrl2);
if (!dataUrl && !sendsSecondProof && !reference.trim()) → error
```
Una sola cosa alcanza para TODO el reporte. Y la validación de dinero (`~804-825`) compara la **suma** contra `requiredBaseUSD`, no pata por pata. Resultado: con una captura, `computePendingElectronicUSD` da 0 y el pago se considera reportado completo.

### Camino recomendado: UNA FILA DE COMPROBANTE POR PATA — **sin migración**

El modelo ya lo soporta: `payment_proofs` admite varias filas por pedido, cada una con **su** referencia y **su** imagen. Y el anti-duplicado de `api/payment-proofs/route.ts:287-319` **ya deja pasar** un segundo comprobante electrónico mientras `computePendingElectronicUSD > 0`.

1. Extender `PaymentEntry` a `{ method, amountUSD, amountVES, dataUrl, fileName, mimeType, reference }` y **mover los inputs de captura/referencia DENTRO de cada bloque de `payments`** (hoy viven fuera, `~1469-1527` y `~1531-1551`). Retirar `dataUrl2/fileName2/mimeType2` del flujo público (o dejarlos como legado).
2. **Validación nueva** (reemplaza el OR de `~777`): por cada entry con monto > 0 y método **no** efectivo, exigir `entry.dataUrl || entry.reference` con ≥ 6 dígitos. Si falta en alguna, error **nombrando la pata**: *"Falta la captura o la referencia de Pago móvil"*. Mantén la validación de cobertura por monto como está.
3. **`submitProof`:** un POST **por pata electrónica** (secuencial), cada uno con su `reportedMethod` (`"Pago móvil (Bs 1.660,20)"`), su monto **solo en su moneda**, su `paymentReference` y su `dataUrl`. Si el primero pasa y el segundo falla, di **cuál** quedó pendiente (el flujo "falta la pata X" ya existe y se reactiva solo).
4. **Checkout** (modo "comprobante antes de registrar"): `renderCheckoutProofSection` (`CartDrawer.tsx:1645`) hoy tiene **UN** file input y **UNA** referencia. Necesita un bloque por pata electrónica cuando `isMixedPayment`, y `hasCheckoutProof` pasa a ser "todas las patas tienen captura o referencia ≥ 6 dígitos". `submitCheckoutProofForOrder` (`~2354`) manda un POST por pata en vez de uno con las cifras sumadas.
5. ⚠️ **Decisión de dinero que necesita al dueño:** al confirmar la **segunda** fila, `buildPaymentFromProof` (`src/lib/paymentProofRegistration.ts:70`) la rechaza porque el pedido ya tiene cobro registrado. Hay dos salidas: (a) dejarlo y avisar en el panel que la segunda pata se ajusta a mano en Caja, o (b) permitir **sumar** al cobro existente cuando método/moneda no colisionan. (b) toca dinero: **pregúntale antes**, no lo decidas tú.
6. Resolver la bandera `publicMixedSecondProofEnabled`: que la exigencia de evidencia por pata **no** dependa de ella (la bandera pasa a significar solo "permitir 2 imágenes en un mismo comprobante", o se retira). Y ajustar los textos que hoy dicen "(opcional)" (`~1534`) y "Adjunta al menos una captura" (`~1473`).

**Antes de implementar**, revisa que nada dependa de que un pedido mixto tenga UNA sola fila de comprobante: pasa por `src/lib/ordersDayClose.ts` y `src/app/local-santo/cierres/`.

### Camino alternativo (solo si el dueño prefiere una sola fila): **SÍ necesita migración**

Migración aditiva `0036` con `payment_reference_2 text default ''` copiando el patrón de `0030` (insert tolerante), y propagarla por `PublicProofBody` → `CreatePaymentProofInput` → `PaymentProof` → `paymentProofRowToProof` → panel de comprobantes y `OrderPaymentProofsList`. Variante sin migración: meter la segunda referencia en `customer_note` — funciona y caja la ve, pero deja de ser un campo de primera clase. **El camino de las dos filas es mejor: no necesita migración y el anti-duplicado ya está preparado.**

### Criterios de aceptación

- Mixto de dos patas electrónicas, con captura de **solo una**: no envía, y el error **nombra la pata que falta**.
- Solo una referencia escrita: tampoco envía.
- Captura de la pata 1 + referencia (≥ 6 dígitos) de la pata 2: **envía OK**. Y al revés.
- Tras el envío completo: la sección muestra el pago reportado completo y no vuelve a pedir nada.
- Tras un envío incompleto (pata 1 sí, pata 2 no): sigue mostrando "falta registrar la parte de \<método 2\>" con el monto de **esa** pata.
- **Mixto efectivo + electrónico** (una sola pata electrónica): sigue exigiendo **una** evidencia. La foto de los billetes **no** cuenta como evidencia de la pata electrónica.
- **Método único** (Pago móvil, o Zelle): no se endurece, sigue bastando captura **o** referencia.
- Modo "comprobante antes de registrar" con mixto: el pedido **no** se registra hasta tener evidencia de las dos, y el aviso hace scroll a la pata que falta.
- En el panel de comprobantes, caja ve la evidencia de **cada** pata sin abrir la base de datos.
- Referencias siguen validando ≥ 6 dígitos, **por cada pata**.
- `src/lib/__tests__/paymentReportCoverage.test.ts` sigue en verde + casos nuevos de evidencia por pata.

---

## Problema 3 — La sección "Pago del pedido" se ve rara en mixto (Pick up y Delivery)

**Causa:** la sección no tiene un modelo de "una tarjeta por pago". Tiene UN bloque de datos con el **total**, UNA lista de patas dentro del formulario, UN bloque agrupador de captura/referencia, y **un parche suelto** para la segunda captura. En mixto eso produce:

- **El huérfano confirmado:** el `<div>` de la segunda captura (`~1531`) arranca **después** de que la tarjeta agrupadora cierra (`~1527`), así que queda fuera, sin borde ni fondo. Su etiqueta dice **"(opcional)"** cuando el dueño quiere que sea obligatoria.
- **Los dos desplegables "Ver datos de X" quedan cerrados**, porque `PaymentMethodDetailsList` solo se auto-abre con UNA entrada (`PaymentMethodDetailsList.tsx:27`).
- **Dos sistemas de numeración que chocan:** "Paso 1/Paso 2" de esta sección (`~1050` y `~1245`) vs "Paso 1/Paso 2" del checkout, que ahí significan *"¿cuánto pagas en bolívares?"* / *"¿cuánto en divisas?"* (`CartDrawer.tsx:1916` y `1955`).
- **El chip "Paso 2" está suelto**, sin frase propia encima del primer campo.
- El monto grande muestra el **total del pedido** (ver Problema 0).
- Textos que sobran: la ayuda de `~1546` pone "pago móvil" y "Zelle" como ejemplo aunque los nombres reales ya están arriba; el aviso de "puedes cambiar el método" (`~1296`); "+ Pagué con otro método también" (`~1449`) y "Quitar" (`~1329`) no deberían salir cuando el servidor mandó las patas.

### Propuesta: una tarjeta por pata

En mixto, **"Pago 1 de 2"** y **"Pago 2 de 2"**, y dentro de cada una: el nombre del método una sola vez, **el monto de esa pata**, **sus** datos para pagar **abiertos** (se logra pasando un solo entry a `PaymentMethodDetailsList`, sin tocar su regla de auto-abrir) y **su** adjuntar/referencia. Así el punto 2 y el punto 3 se resuelven con la misma estructura — hazlos juntos.

### Criterios de aceptación

- Dos tarjetas numeradas, cada una con su método una sola vez y **el monto de su pata** (Bs 1.820,00 en una, $5.00 en la otra).
- Los datos de cada método aparecen **abiertos** dentro de su tarjeta, sin que el cliente toque nada.
- **Ningún** bloque de adjuntar queda fuera de una tarjeta.
- Los chips "Paso 1"/"Paso 2" de la sección no se renderizan en mixto (para no chocar con los del checkout).
- Con el formulario auto-abierto no queda ninguna pastilla naranja sin frase encima del primer campo.
- En mixto no aparecen "+ Pagué con otro método también" ni "Quitar" cuando el servidor mandó dos patas.
- La etiqueta de la segunda captura ya no dice "(opcional)", y antes de tocar Enviar el cliente ve **cuál** falta.
- **Pago con un solo método no cambia en nada:** su tarjeta única, sus datos auto-abiertos y "Haz una de las dos para enviar".
- Hoy **no hay ningún test** de este componente ni de `/api/public/order-payment`: añade al menos uno de los helpers.

---

## Orden sugerido

1. **Problema 0** (corto, y desbloquea el monto correcto en las tarjetas del punto 3).
2. **Problema 1** (independiente, y es el que más molesta al dueño hoy).
3. **Problemas 2 y 3 juntos** — comparten la reestructuración "una tarjeta por pata".

Trabaja **por fases, commiteando cada una** (hay un incidente previo de sobrescritura: no dejes trabajo sin commitear). Si algo exige una decisión de dinero o una migración, **para y pregunta** en vez de decidirlo solo.

## Lección de la sesión anterior, que aplica aquí

El rediseño pasó `tsc`, 471 tests y `build` **con 4 fallas dentro**, incluida una que invitaba a transferir el doble. Las encontró una pasada de revisión por lentes distintos (dinero / React+CSS / regresiones / textos / seguridad del deploy) con refutación adversarial, **antes de desplegar**. Haz lo mismo antes de publicar esto. Y desconfía de los arreglos que no puedas ejercitar: el Problema 0 existe porque escribí una rama que nunca se ejecuta.

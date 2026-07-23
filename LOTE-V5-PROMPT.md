# Prompt para la próxima sesión — Lote v5 Brotherhood (feedback 2026-07-22, noche)

> Pega esto tal cual (o di: "lee LOTE-V5-PROMPT.md y ejecútalo por fases").

---

Trabaja el lote v5 de Brotherhood en la rama `brotherhood-publico` (repo D:/Santo edit).
Reglas fijas: verificar con `tsc + vitest + build` (NUNCA preview/navegador, se cuelgan),
un commit por fase, deploy al final con `npx vercel --prod --yes` (autenticado, lo corro yo),
migraciones solo las escribo yo y las aplica el usuario, la estética actual no se toca salvo
lo pedido, y TODO el flujo público debe poder usarlo una persona de tercera edad sin escribir
nada más que nombre, teléfono y con cuánto paga. Lee las memorias `brotherhood-feedback-julio21`,
`brotherhood-deploy-manual` y `santo-edit-qr-sedes` antes de empezar.

Contexto: sale de probar el lote v4 EN VIVO (brotherhood-xi.vercel.app) con capturas. El bug
de "Reportar pago" YA se intentó arreglar dos veces (evento y luego señal por prop) y SIGUE sin
funcionar en el teléfono del cliente — hay que reproducirlo y arreglarlo de raíz, no a ciegas.

---

## F1 — CRÍTICO: "Reportar pago" no deja reportar (ni en confirmación ni en /pedido/[id])

Síntoma real del cliente (con la PWA instalada en el teléfono):
- En la confirmación (pantalla "#27-s"), al tocar el botón grande **"REPORTAR PAGO"** no pasa
  nada / no lo deja hacer nada.
- Desde el carrito → "Pedidos recientes" → "Ver", lo manda a `/pedido/[id]` (se abre en la app)
  y **ahí tampoco puede reportar el pago** ni adjuntar nada.
- También el "comprobante ANTES de pedir" (modo `publicPaymentBeforeRegisterEnabled`) "no me deja
  hacer nada".

Esto ya se intentó con un evento `window` y luego con `forceOpenSignal` (prop) — y SIGUE mal.
NO parchear más a ciegas: **encontrar la causa raíz**. Hipótesis a descartar en orden:

1. **`PublicOrderPaymentSection` retorna null.** Retorna null si `isLoading || !info || !isProofsEnabled`
   o si `orderStatus === "Cancelado"` (`src/components/PublicOrderPaymentSection.tsx` ~línea 679).
   `isProofsEnabled` sale de un fetch propio a `/api/public/business-config` leyendo
   `businessConfig.paymentProofsEnabled` (que es el `effectiveEnabled` GATEADO POR PLAN en
   `src/lib/publicBusinessConfigResponse.ts:406`). Si el plan NO incluye `paymentProofs`,
   `effectiveEnabled=false` → la sección es null → el form nunca aparece, el scroll no lleva a
   nada y la señal abre un form que no existe. **Verificar el plan/módulo `paymentProofs` del
   negocio Brotherhood** (getModulePlanAccess). Si está apagado por plan, encenderlo (config o
   plan) es el arreglo real.
2. **Divergencia de banderas padre vs hijo.** El padre decide mostrar "Reportar pago" con
   `lastOrderPaymentPending` (usa `isPaymentProofPublicAvailable = publicConfig.paymentProofsEnabled`,
   que puede venir CACHEADO en localStorage del carrito). El hijo usa su fetch fresco. Si el padre
   dice "sí" (cache viejo) y el hijo "no", el botón aparece pero el form es null. **Arreglo robusto:
   pasar `paymentProofsEnabled` como PROP del padre al hijo (una sola fuente), en vez de que el hijo
   haga su propio fetch.** Así nunca divergen.
3. **El form abre pero el envío falla silenciosamente.** Revisar `/api/payment-proofs` POST:
   `checkPaymentProofsModule` da 403 si el módulo está apagado por plan/config; `enforceSameOriginRequest`
   o el rate-limit podrían rechazar. Revisar qué status devuelve en el teléfono del cliente.
4. **La página `/pedido/[id]`** (`src/app/pedido/[orderId]/page.tsx`) también monta
   `PublicOrderPaymentSection`. Si es null ahí, misma causa raíz. Arreglar una vez sirve para ambos.

Objetivo: reporte de pago 100% funcional en (a) la confirmación del carrito y (b) `/pedido/[id]`,
para tercera edad (adjuntar captura o escribir referencia y enviar, con el método precargado).
Si el módulo está gateado por plan, dejar el reporte de pago SIEMPRE disponible para Brotherhood.

## F2 — Barra superior en computadora (desktop) todavía se "mezcla"

En escritorio la navbar aún parece mezclar la barra completa con la compacta al hacer scroll.
El fix v3 (`src/components/Navbar.tsx`, transición secuenciada con `delay-200`/`duration-200`)
resolvió el móvil pero en desktop (breakpoint `lg:`) se sigue viendo raro. Revisar el caso desktop:
puede que la barra compacta y la fila de nav de escritorio se solapen, o que el `delay` no baste.
Que NUNCA se vean las dos a la vez tampoco en pantallas grandes.

## F3 — Envío por distancia POR SEDE + conectado a la página pública

Hoy la config "Envío por distancia (km)" en Configuración es UNA sola (link de Maps del local +
rangos de precio + factor de ruta); NO es por sede, y por eso el usuario no ve la de San Diego.
- Hacer la config de envío por distancia **por sede** (cada sucursal con su link de Maps, sus
  rangos y su factor de ruta), igual que el patrón de "Configuración por sede" que ya existe para
  otros campos (ver memoria `santo-edit-qr-sedes` y `BRANCH_SCOPED_TEXT_FIELDS` /
  `BranchConfigPanel`).
- **Conectar con la página pública**: la cotización del delivery (`/api/public/delivery-quote`)
  debe usar la config de la SEDE del pedido (origen = Maps de esa sede, rangos de esa sede), no la
  global. Revisar cómo resuelve hoy la sede y el origen.

## F4 — Mesas y QR por sede (crear cada una por separado en la privada)

Las mesas y sus QR deben gestionarse **por sede**: poder crear/editar/imprimir cada mesa y su QR
por sucursal desde las páginas privadas (no una lista global). Revisar el módulo de Mesas/QR
(`/local-santo/mesas`, generación de QR por mesa) y el patrón de aislamiento por sede
(`santo-edit-qr-sedes`, `santo-edit-fitness-guards`). Cada sede administra sus propias mesas.

## F5 — Pedido cancelado se marca Cancelado también en local-santo (privada)

Cuando un pedido se cancela (cliente desde el carrito, auto-cancelación por tiempo, o caja), debe
reflejarse como **Cancelado** en el panel privado (`/pedidos`, caja) — hoy parece que la anulación
del cliente/automática no se ve como cancelada en la privada. Verificar el cableo:
`/api/public/order-cancel` y `unpaidAutoCancel.ts` deben dejar el pedido en estado "Cancelado" que
la privada lea; y las vistas de caja/pedidos deben mostrarlo cancelado (y no cobrable). Ligado a F9.

## F6 — Contraste de "¿Con cuánto vas a pagar?" (se ve todo blanco)

En la sección de efectivo, los botones de billete (€5/€10/€20/€50/€100) y el input libre se ven
blancos/ilegibles sobre el fondo. Darles contraste con la marca (fondo, borde, texto oscuro
legible), que se entienda que son botones para tocar y un campo para escribir. Archivo:
`renderCashChangeSection` en `src/components/CartDrawer.tsx`.

## F7 — "Resumen de cobro" → "Tienes que pagar lo siguiente:" con texto claro

En el carrito (footer / `CartSummaryFooter`), la sección **"RESUMEN DE COBRO"**:
1. Cambiar el título a **"Tienes que pagar lo siguiente:"**.
2. Texto claro para tercera edad, por ejemplo:
   - **"Tienes que pagar esta cantidad en bolívares: Bs 45.748,66"**
   - **"O esta cantidad en dólares: $62.00"**
   En vez de "Productos normales / Total final en divisas / Total en bolívares (referencia)".
Mantener los montos correctos (mismo cálculo), solo cambiar redacción para que se entienda QUÉ
paga y en qué moneda.

## F8 — Foto obligatoria de divisas (configurable) + 2 capturas en pago mixto

Dos cosas nuevas, ambas **editables desde la página privada (Configuración)**:
1. **Foto obligatoria de las divisas en efectivo**: una opción (checkbox destildable) que, cuando
   el método es **efectivo en divisas**, exija subir una **foto de los billetes** antes de avanzar
   (para que el negocio vea que tiene el efectivo). Configurable (se puede apagar).
2. **Pago mixto con 2 capturas**: SOLO en pago **mixto**, permitir subir **2 comprobantes** (ej.
   una del pago móvil y otra de los dólares/Zelle), uno por cada pata del pago. Hoy el reporte
   admite una sola captura. Revisar `PublicOrderPaymentSection` / `submitCheckoutProofForOrder` /
   `/api/payment-proofs` para soportar 2 imágenes en mixto. Editable/apagable desde Configuración.

## F9 — Verificar que la auto-cancelación por tiempo de verdad borre el pedido

Revisar `publicUnpaidAutoCancelMinutes` + `src/lib/unpaidAutoCancel.ts`: cuando se cumplen los
minutos, el pedido debe anularse de verdad y **NO reaparecer entre los pedidos activos**:
- En la **privada** (para el staff): que salga como Cancelado / fuera de activos (ligado a F5).
- En el **carrito del cliente** ("Pedidos recientes"): que no siga apareciendo como activo.
Reproducir el ciclo completo (registrar sin pagar → esperar el tiempo → verificar que desaparece
de ambos lados) y arreglar lo que quede colgado.

## F10 — Verificación y cierre

`npx tsc --noEmit` + `npx vitest run` + `npm run build`; commit por fase; correr los scripts de
datos que hagan falta; `npx vercel --prod --yes`; actualizar la memoria `brotherhood-feedback-julio21`.

Pendientes que NO son de esta sesión (no tocar): cadena Meta/WhatsApp (César crea la app), claves
VAPID para push en vivo, precios finales de burgers (dueño), datos reales de Zelle/Transferencia
(los pone el dueño en Configuración), verificación del negocio.

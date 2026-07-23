# Prompt para la próxima sesión — Lote v6 Brotherhood

> Pega esto tal cual (o di: "lee LOTE-V6-PROMPT.md y ejecútalo por fases").

---

Trabaja el lote v6 de Brotherhood en la rama `brotherhood-publico` (repo D:/Santo edit).

**Reglas fijas** (iguales que v5):
- Verificar con `npx tsc --noEmit` + `npx vitest run` + `npm run build`. NUNCA usar preview/localhost ni el navegador para verificar (se cuelgan); verificar por código/tests. Puedes correr un servidor local si hace falta, pero NO crees pedidos de prueba en la base de datos real de Brotherhood.
- Un commit por fase. Deploy al final con `npx vercel --prod --yes` (autenticado; el deploy sale del directorio local, no de git push).
- Las migraciones solo las escribo yo (Claude) en `supabase/migrations/`; las aplica el usuario en Supabase. Degradar sin romper si aún no está aplicada.
- La estética actual no se toca salvo lo pedido. Todo el flujo público lo debe poder usar una persona de tercera edad sin escribir más que nombre, teléfono y con cuánto paga.
- **Caché PWA:** si tocas assets que deban forzar refresco, sube la versión de caché en `public/sw.js` (`santo-static-vN`/`santo-pages-vN`). Ver memoria `santo-edit-pwa-cache-busting`.
- Lee las memorias `brotherhood-feedback-julio21`, `brotherhood-deploy-manual`, `santo-edit-pwa-cache-busting` y `feedback-verify-without-browser` antes de empezar.

---

## Fase A — Foto obligatoria de divisas cuando es UNO de los métodos + aviso al elegir

**Contexto:** en el lote v5 se agregó la foto obligatoria de los billetes en efectivo en divisas (`publicCashDivisaPhotoRequired`, destildable en Configuración). PERO hoy solo se exige cuando el método ÚNICO del pedido es "efectivo en divisas": `isCashDivisaMethod = Boolean(cashMethodName) && !cashIsVes` en `src/components/CartDrawer.tsx` (~línea 1178), y `cashMethodName` es null en pago mixto. Además no hay aviso al elegir el método: el cliente se entera al final.

**Qué hacer (todo en `src/components/CartDrawer.tsx`, sin migración):**
1. Nuevo helper `divisaCashSelected` = true si (a) el método único es efectivo en divisas (`isCashDivisaMethod` actual), **o** (b) en pago mixto la pata de divisas (`mixedUsdMethod`) es efectivo en divisas (`isMixedPayment && mixedUsdMethod.toLowerCase().includes("efectivo")`). Hacer que `requiresCashDivisaPhoto` use `divisaCashSelected` en vez de solo `isCashDivisaMethod` (manteniendo la condición de destino Pick up/Delivery y el flag `publicConfig.publicCashDivisaPhotoRequired`).
2. **Aviso al elegir el método:** cuando `publicConfig.publicCashDivisaPhotoRequired` está activo y el cliente selecciona (o tiene seleccionado) efectivo en divisas, mostrar una nota clara junto al selector de método y en el Paso 2 del pago mixto (`renderMixedPaymentSection`): p.ej. "📸 Con efectivo en divisas tendrás que subir una foto de los billetes al registrar." Así lo sabe desde que elige, no al final.
3. La sección de subir la foto (`renderCashDivisaPhotoSection`) debe mostrarse también en el caso mixto (ya depende de `requiresCashDivisaPhoto`, así que con el punto 1 aplica solo).
4. El envío `submitCashDivisaPhotoForOrder` debe reportar el monto/método correcto: en mixto, la **pata de divisas** (`mixedUsdMethod` + `mixedUsdValue`), NO el total del pedido; en método único, como está hoy (total en la moneda del método).
5. Verificar la validación `missingOrderChecks` (que no deje registrar sin la foto cuando aplica) para ambos casos.

**Objetivo:** que la foto de los billetes se exija SIEMPRE que "efectivo en divisas" sea uno de los métodos (único o mixto), y que el cliente lo sepa desde que elige el método. Editable/apagable con el mismo interruptor `publicCashDivisaPhotoRequired`.

## Fase B — Fusión del menú, Fase 2 (retirar el editor avanzado como página aparte)

**Contexto:** en la sesión anterior se hizo la Fase 1 (un solo flujo: desde "Menú editable" cada producto tiene botón "Opciones avanzadas" que hace deep-link a `/local-santo/menu-avanzado?producto=<id>`, que selecciona ese producto; texto corregido). Falta la Fase 2: que sea UN SOLO editor.

**Qué hacer:**
1. Meter las capacidades del **Menú avanzado** (variaciones, adicionales con precio, ingredientes removibles/incluidos, combos, canales de venta, vínculo a inventario, plantilla de hamburguesa) DENTRO del editor básico (`src/app/local-santo/menu/page.tsx`) como una **sección desplegable "Opciones avanzadas"** dentro del formulario de edición de cada producto (el mismo form donde se edita nombre/precio/categoría/foto). Reusar la lógica de `src/app/local-santo/menu-avanzado/` (`domain.ts`, `components.tsx`, `burgerTemplate.ts`, `buildFormFromProduct`, `buildPremiumSummary`, reglas de selección) — extraer a componentes compartidos si hace falta, sin duplicar.
2. Respetar el gating por plan/módulo: las opciones avanzadas solo se muestran/editan si el módulo `advancedMenu` (y submódulos productVariations/productAddons/productBuilder/productCombos/etc.) está disponible para el negocio (`getModulePlanAccess`). Si no, la sección no aparece (como hoy la página avanzada está gated).
3. El guardado debe persistir tanto lo básico como lo avanzado en el producto (hoy el básico ya "conserva las reglas del avanzado" al guardar; ahora además debe poder editarlas). Cuidado con no pisar config de variaciones/addons existentes.
4. Retirar la página `/local-santo/menu-avanzado` como acceso independiente: quitarla de la navegación/menús y del gestor de módulos como entrada separada (o dejar una redirección a `/local-santo/menu`). Mantener el deep-link `?producto=<id>` funcionando (que abra el básico con ese producto y su sección avanzada desplegada).
5. Aislamiento por sede: el editor de menú ya respeta `resolveBranchId`; verificar que la fusión no rompa el filtro por sede (ver `santo-edit-fitness-guards`, `santo-edit-menu-editor`).

**Riesgo:** es un refactor grande (dos editores de ~2200 y ~1200 líneas, dos módulos, dos modelos de datos). Hacerlo por sub-fases con verificación (tsc+tests+build) entre cada una. El objetivo final: un solo editor de menú, sin la página avanzada aparte, sin perder ninguna capacidad (variaciones/adicionales/combos siguen llegando al carrito público).

## Fase C — Flujo del carrito / estado del pedido (público)

1. **Reabrir el carrito → "Ver" un pedido SIN pago reportado:** hoy lo primero que sale es el estado del pedido. Debe salir PRIMERO el aviso/CTA de reportar pago: "No has reportado el pago de tu pedido. Repórtalo y se empezará a procesar." (con el formulario de reporte). Solo si ya reportó/pagó, mostrar el estado. Archivos: `src/components/CartDrawer.tsx` (Pedidos recientes → "Ver"), `src/app/pedido/[orderId]/page.tsx`, `src/components/recentPublicOrders.ts`, `usePublicOrderStatus`.
2. **Paso "Esperando pago" en la línea de estado:** hoy `STEPS = ["Recibido", "Preparando", "Listo"]` (`src/app/pedido/[orderId]/page.tsx:29`). Agregar un paso ANTES: "Esperando pago". Mientras el pago no esté confirmado por caja, el pedido está en "Esperando pago"; cuando caja confirma el pago (o lo marca), pasa a "Recibido" → "Preparando" → "Listo". Reflejarlo igual en la tarjeta de confirmación del carrito. Cuidado: solo aplica cuando hay pago pendiente reportable (Pick up/Delivery electrónico); en mesa/efectivo no.

## Fase D — Mejoras de Caja (`src/app/local-santo/caja/page.tsx` + `components.tsx` + `domain.tsx`)

La sección de Comprobantes aparte se mantiene (buen manejo), pero en la tarjeta de caja hay varios problemas:

1. **Precargar el método del cliente al Cobrar:** hoy al tocar "Cobrar" (`openPaymentModal`, ~línea 551) los selects "Método en divisas"/"Método en bolívares" (~1227/1229) arrancan vacíos ("Sin registrar") y caja los pone a mano. Deben venir **preseleccionados** con el/los método(s) que el cliente eligió al pedir (viajan en el pedido / la nota / el comprobante). 
2. **Ver la captura del cliente DENTRO de la tarjeta de caja** (sin ir a Comprobantes): ya existe `OrderPaymentProofsList` en la tarjeta (lote v3), pero el cliente reporta que no aparece — VERIFICAR y arreglar que la imagen recién subida se vea en la tarjeta (miniatura ampliable), tanto la 1ª como la 2ª (pago mixto).
3. **Textos de estado:** el InfoBox "Pendiente" (payment.pendingUSD, `components.tsx:356`) debe decir **"Pendiente de cobro"**. Revisar también "Por confirmar" (status Nuevo) y "Delivery por confirmar" para que se entiendan.
4. **Costos de delivery por sucursal:** cuando el pedido es delivery, el costo del delivery NO se ve según la sede elegida. Conectar con el envío por sede (Fase F3 del lote v5) y la cotización guardada del pedido, para que caja vea el costo correcto de esa sucursal.
5. **Reducir tamaño** de la sub-tarjeta con datos del cliente (teléfono, ubicación de delivery) dentro de la tarjeta de caja.
6. **Reducir el tamaño de los botones** al desplegar la tarjeta completa: Registrar / Enviar / Cancelar pedido y Marcar como listo (ocupan mucho).
7. **Vuelto:** verificar que el vuelto funcione con método **divisas** y con **mixto** (incluyendo la pata de divisas). Hoy el vuelto del efectivo viaja en la nota; confirmar que se calcula/guarda bien en esos casos.
8. **Billete elegido visible en caja:** caja debe poder saber con qué **tipo de billete** indicó el cliente que iba a pagar en divisas (o en la pata de divisas del mixto). Los botones rápidos de billete (5/10/20/50/100) que el cliente toca deben viajar al pedido y verse en caja (en la nota o un campo), para cuadrar el vuelto.
9. **Revisar que TODOS los flujos lógicos funcionen** (cobro, mixto, divisas, delivery por sede, comprobantes, estados) tras estos cambios.

## Fase E — Barrido de contraste en pantallas de STAFF

Mismo bug del tema oscuro que se arregló en el público: inputs/casillas `bg-white` con texto claro del tema (`text-[var(--brand-ink)]` / `text-[var(--brand-ink-3)]`, casi blancos) = ilegibles. Quedan en pantallas privadas: caja (`components.tsx`), mesas (`LocalTablesMap`), cuentas abiertas (`openAccountsComponents`, `OpenAccountsPanel`, `SepararCuentaModal`), `PanelPrimitiveCards`, `ModuleAccessGuard`, `LocalModuleNav`, `FiscalBreakdown`, `LocalTableQrLinksPanel`. Barrer y poner texto oscuro fijo (`#1a1a1a`) en todas las casillas `bg-white` sólidas, sin cambiar la estética.

## Cierre

`npx tsc --noEmit` + `npx vitest run` + `npm run build`; un commit por fase; correr scripts de datos si hacen falta; subir la versión de caché del SW si aplica; `npx vercel --prod --yes`; actualizar las memorias `brotherhood-feedback-julio21` y `santo-edit-menu-editor`.

Pendientes de terceros (NO tocar): setup Meta/WhatsApp, VAPID, precios finales de burgers, datos reales de Zelle/Transferencia.

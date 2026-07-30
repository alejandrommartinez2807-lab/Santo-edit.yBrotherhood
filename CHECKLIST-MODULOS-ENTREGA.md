# Checklist de entrega — los 61 módulos, uno por uno

> Archivo de trabajo de `PROMPT-ENTREGA-FINAL.md` (§4). Levantado el 2026-07-30
> leyendo el código del sistema. **369 pruebas** concretas: cada una dice qué hacer
> y qué tiene que pasar. Marca la casilla cuando la compruebes de verdad.

Cómo trabajarlo: de arriba hacia abajo, primero todo lo que ve el CLIENTE
(los primeros módulos), después la operación del día, el dinero, el inventario,
el catálogo y por último seguridad. Si una prueba falla, anótala con el módulo y
lo que viste, y sigue: al final se arreglan por orden de gravedad.

Cada módulo trae, además de sus pruebas: dónde vive en el código, qué roles
entran, **qué script automático ya lo cubre** (para no repetir trabajo) y el
"ojo con" — lo que más probablemente esté flojo ahí.

---

### Menú público (carta digital)

**Qué hace:** Es la carta que ve el cliente cuando abre el link o escanea el QR: fotos, precios en $ y su referencia en Bs, categorías, buscador, favoritos y el personalizador de cada producto (variaciones, adicionales, ingredientes).

- **Dónde:** `Página / (src/app/page.tsx, src/components/Products.tsx, ProductCard.tsx, FeaturedProducts.tsx) · API GET /api/public/products, GET /api/public/business-config, GET /api/exchange-rate`
- **Quién entra:** Ninguno: es público sin login. GET /api/public/products no pide clave ni sesión (src/app/api/public/products/route.ts) y solo aplica un tope de 240 consultas por minuto por IP.
- **Ya cubierto por:** npm test cubre publicProductsResponse.test.ts, publicProductNormalization.test.ts, publicProductCategories.test.ts, publicBranchMenu.test.ts, productCardHelpers.test.ts y cartItemHelpers.test.ts. e2e/a11y.spec.ts y e2e/responsive-forms.spec.ts revisan la página / (accesibilidad crítica y sin desborde a 375/768/1280 px). No hay prueba automática de que las FOTOS y descripciones reales carguen.
- **Ojo con:** Si un producto queda sin imagen se muestra el logo de relleno y la carta se ve pobre. La página no cachea nada (force-dynamic + no-store): con internet lento del local el menú tarda. El tope de 240 consultas/min es POR IP y en un restaurante todos los teléfonos salen por la misma IP del WiFi: con mucha gente refrescando puede aparecer 'Demasiadas consultas del menú'.

**Pruebas:**

- [ ] Abre / en un teléfono y recorre TODO el menú: cada producto activo debe mostrar foto propia (no el logo de relleno), nombre, descripción y precio en $ con su equivalente en Bs debajo.
- [ ] Toca el buscador y escribe media palabra de una hamburguesa (ej. 'brut'): la lista tiene que filtrarse en vivo y mostrar solo lo que coincide; borra el texto y vuelven todos.
- [ ] Toca un producto con opciones (una burger armable), elige una variación y súmale un adicional: el precio del botón 'Agregar' debe subir exactamente lo que dice el adicional en el menú, no un monto redondeado distinto.
- [ ] Toca el corazón/favorito de 2 productos, recarga la página y entra al filtro 'Favoritos': los 2 productos siguen ahí.
- [ ] Desactiva un producto desde el panel (Menú) y recarga / en el teléfono: ese producto desaparece de la carta pública en menos de un minuto (la respuesta es no-store, no se cachea).
- [ ] Confirma que el precio en Bs de un producto = precio en $ x la tasa que muestra el carrito; si el dueño cambia la tasa en Configuración, recarga y el Bs cambia acorde.

### Sede del cliente y QR por sucursal

**Qué hace:** Hace que el cliente vea el menú, las mesas, los WhatsApp, la ubicación y las reseñas DE LA SEDE donde está. El QR de cada sucursal trae el ?branch= incrustado y deja la sede fijada en ese teléfono.

- **Dónde:** `Selector en / (src/components/PublicBranchSelector.tsx, BranchSwitcher.tsx, src/lib/branchClient.ts) · parámetro ?branch=<id> · API GET /api/public/branches y GET /api/public/business-config`
- **Quién entra:** Ninguno: público. El servidor resuelve la sede por el header x-branch-id o por ?branch= (src/app/api/public/business-config/route.ts, líneas 41-45); sin sede explícita usa la sede principal.
- **Ya cubierto por:** npm test: publicBranchSelection.test.ts, publicBranchMenu.test.ts (sede sin menú propio hereda el de la principal), publicBusinessConfigResponse.test.ts, branchIsolation.fitness.test.ts. npm run qa:branches (scripts/qa-branches-qr.mjs) verifica por API que cada sede sirve su propia configuración pública y sus WhatsApp. Ninguna prueba abre el selector en un navegador real.
- **Ojo con:** Es el punto donde más fácil se cruza el dinero de una sede con la otra: si el cliente llega por un QR viejo con un id de sede que ya no existe, el pedido cae en la sede por defecto. El precio del envío y el correlativo del pedido dependen de esta sede, así que un ?branch= equivocado ensucia caja y reportes.

**Pruebas:**

- [ ] Abre el link con ?branch= de San Diego y anota el WhatsApp, la dirección y el botón 'Abrir ubicación' del pie; abre después el ?branch= de la otra sede y confirma que los TRES datos cambian a los de esa sucursal.
- [ ] Con dos sedes activas, entra a / sin ?branch=: el sitio debe pedir/mostrar el selector de sede y, al elegir una, la URL queda con ?branch=<esa sede>.
- [ ] Elige una sede, cierra el navegador por completo y vuelve a entrar a /: la sede elegida sigue seleccionada (queda guardada en el dispositivo).
- [ ] Carga un producto SOLO en la sede principal y entra al menú de la otra sede: si esa sede no tiene menú propio debe heredar el de la principal (no puede quedar la carta vacía).
- [ ] Estando en la sede A, abre el carrito y mira la lista de mesas: solo pueden aparecer las mesas de la sede A, ninguna de la sede B.
- [ ] Cambia de sede con productos ya en el carrito: la mesa seleccionada se limpia y el sitio no deja enviar un pedido con una mesa de la otra sede.

### QR por mesa (pedido desde la mesa)

**Qué hace:** El cliente escanea el QR pegado en su mesa y llega al menú con SU mesa ya preseleccionada, para que el pedido entre identificado y el personal sepa a dónde llevarlo.

- **Dónde:** `/mesa/[mesa] (src/app/mesa/[mesa]/page.tsx) → redirige a /?mesa=X&mesa_qr=1&branch=Y · API GET /api/public/table-account-status · Los QR se generan en /local-santo/mesas (src/components/local/LocalTableQrLinksPanel.tsx)`
- **Quién entra:** Escanear y pedir: público, sin clave. Generar/imprimir los QR: personal con acceso al módulo Mesas y QR del panel.
- **Ya cubierto por:** npm test: publicLocalTableAccounts.test.ts, publicBusinessConfig.test.ts (lectura de ?mesa y ?mesa_qr=1), localTablesEditor.test.ts. npm run qa:branches (scripts/qa-branches-qr.mjs, bloque S1) prueba por API que el QR de una mesa abre la configuración de su sede. npm run qa:mesa-prefill cubre el pedido de mesa sin cuenta y su comprobante.
- **Ojo con:** Los QR impresos son estáticos: si el dueño renombra o borra una mesa, todos los QR pegados de esa mesa quedan apuntando a algo que ya no existe. El QR se arma con la URL del dominio en el momento de imprimir; si cambia el dominio, los QR viejos mueren. Verificar que los QR impresos llevan el ?branch= correcto es manual, no hay prueba automática.

**Pruebas:**

- [ ] Escanea con el teléfono el QR impreso de la Mesa 3: debe abrirse la pantalla 'Pedido desde la mesa' y llevarte al menú con el aviso verde 'Estás pidiendo para Mesa 3'.
- [ ] Con ese QR abierto, agrega 2 hamburguesas y envía el pedido: la confirmación muestra el número grande y en Caja el pedido aparece con la Mesa 3 (no 'Por confirmar' ni otra mesa).
- [ ] Desactiva la Mesa 3 desde el panel y vuelve a escanear su QR: el sitio debe avisar 'Este QR ya no coincide con una mesa activa' y obligarte a elegir otra mesa antes de pedir.
- [ ] Escanea el QR de una mesa de la sede A estando el teléfono con la sede B guardada: el menú y la mesa deben quedar en la sede A (la del QR manda).
- [ ] Desde /local-santo/mesas imprime la hoja de QR y comprueba que cada QR lleva el nombre correcto de su mesa y el ?branch= de la sede que seleccionaste arriba.
- [ ] Después de enviar un pedido desde el QR de la mesa, agrega otro producto: la mesa debe seguir preseleccionada (no hay que volver a elegirla).

### Carrito y checkout (Comer aquí / Pick up)

**Qué hace:** Es la caja registradora del cliente: arma su pedido, elige si come en el local o lo retira, deja sus datos y notas, aplica cupón, elige método de pago y envía. De aquí sale la venta.

- **Dónde:** `src/components/CartDrawer.tsx (4.895 líneas) + cartDrawerParts.tsx · API POST /api/orders y POST /api/public/coupons`
- **Quién entra:** Público sin sesión. Clave: cuando la petición NO trae identidad de staff, el servidor RECALCULA el precio de cada ítem contra el menú real de la sede y decide la tasa (src/app/api/orders/route.ts, líneas 544-558); un pedido hecho por staff con sesión conserva precios manuales.
- **Ya cubierto por:** npm test: publicOrderGuards.test.ts (blindaje de precio y tasa), cartSelection.test.ts, cartItemHelpers.test.ts, publicCoupons.test.ts, publicPaymentMethods.test.ts, publicOrderPaymentFlow.test.ts, localOrderMoney.test.ts. npm run e2e:order-idempotency prueba que un reenvío con el mismo clientOrderId no duplica el pedido. npm run qa:dia-completo y qa:cobros-origen recorren el día completo por API. Nadie prueba el carrito en un navegador real de punta a punta.
- **Ojo con:** El tope de 10 pedidos por minuto POR IP (línea 286-291 de src/app/api/orders/route.ts) es el mismo problema que ya se corrigió en 'pedir la cuenta': en un local todos los teléfonos salen por la misma IP y en hora pico puede bloquear pedidos legítimos. El cupón se descuenta en el navegador pero el servidor reprecia los ítems desde el menú (publicOrderGuards.ts): hay que confirmar en vivo si el descuento sobrevive. Es el archivo más grande del proyecto (4.895 líneas), lo más fácil de romper sin darse cuenta.

**Pruebas:**

- [ ] Pide 2 hamburguesas como 'Comer aquí' en Mesa 3 y envía: la pantalla de confirmación muestra el número de pedido en grande y el pedido aparece en Caja con esa mesa y ese total exacto.
- [ ] Repite el pedido como 'Pick up' con nombre y teléfono: el sitio debe EXIGIR el teléfono (en Comer aquí es opcional) y el pedido entra en Caja como 'Para llevar'.
- [ ] Aplica un cupón válido en el carrito y envía el pedido: compara el total que muestra la confirmación con el total que ve Caja — si Caja muestra el precio SIN descuento, el cupón no está bajando la venta y hay que reportarlo (el servidor reprecia los ítems desde el menú y borra el descuento del cliente).
- [ ] Toca 'Enviar pedido' dos veces seguidas rápido: solo puede crearse UN pedido en Caja, no dos.
- [ ] Escribe una nota en un producto ('sin cebolla') y una nota general, y confirma que ambas llegan tal cual a la comanda de Cocina.
- [ ] Agrega al carrito un producto marcado como no disponible para Delivery, cambia el tipo a Delivery y confirma que el carrito lo avisa por nombre y no deja enviar hasta quitarlo.
- [ ] Envía 11 pedidos seguidos desde la misma conexión WiFi en menos de un minuto: a partir del 11 debe salir 'Demasiados intentos de pedido' — verifica con el dueño si ese tope le sirve en hora pico.

### Delivery con mapa GPS y cobro por kilómetro

**Qué hace:** El cliente comparte su ubicación (GPS o link de Google Maps), el sistema calcula los km hasta el local y le cobra el envío según los rangos que puso el dueño, antes de enviar el pedido.

- **Dónde:** `src/components/DeliveryMapPicker.tsx y DeliveryPointPreviewMap.tsx dentro del carrito · API GET/POST /api/public/delivery-quote · POST /api/orders (recotiza)`
- **Quién entra:** Público. El precio del envío SIEMPRE lo decide el servidor: recotiza con la ubicación al crear el pedido y nunca acepta el monto que mande el cliente (src/app/api/orders/route.ts, líneas 395-431).
- **Ya cubierto por:** npm test: deliveryDistance.test.ts (cálculo de km y rangos), deliveryCostSingleSource.fitness.test.ts (impide que reaparezcan zonas con precio quemado en el código), publicOrderGuards.test.ts. No hay prueba automatizada del mapa ni del permiso de GPS en un navegador real.
- **Ojo con:** Si el dueño no configuró el envío por distancia ni las zonas, el pedido se registra igual con envío en $0 y queda 'por confirmar por WhatsApp' (líneas 424-431 y 662-671 de api/orders/route.ts): eso es plata que se pierde sin que nadie avise. Los links cortos de Maps (maps.app.goo.gl) se expanden desde el servidor: si ese servicio falla, el punto no se lee. En iPhone abriendo desde Instagram o WhatsApp el GPS suele quedar bloqueado y el cliente cae al modo 'pegar link'.

**Pruebas:**

- [ ] Elige 'Delivery' en el carrito y acepta el permiso de ubicación: el mapa debe abrirse centrado en tu punto y mostrar los km hasta el local y el costo del envío antes de enviar el pedido.
- [ ] Rechaza el permiso de ubicación y pega en su lugar un link de Google Maps de tu casa: el sistema debe leer las coordenadas y darte los mismos km y costo.
- [ ] Envía el pedido de Delivery y compara: el costo del envío que viste en el carrito tiene que ser IGUAL al que muestra Caja en el pedido creado.
- [ ] Prueba una dirección fuera del rango máximo configurado: debe salir el mensaje '~X km y el delivery llega hasta Y km. Escríbenos por WhatsApp' y no dejar cobrar un envío inventado.
- [ ] Intenta enviar un Delivery sin teléfono: tiene que rechazarlo con 'Falta el teléfono para delivery'.
- [ ] Abre el pedido en el panel de Delivery y toca el link de Maps que viajó en la dirección: debe abrir Google Maps justo en el punto que marcó el cliente.
- [ ] Pide un delivery desde la sede A y otro desde la sede B a la misma dirección: los km y el costo deben calcularse desde CADA local, no desde uno solo.

### Cuenta abierta de mesa desde el teléfono + 'Pedir la cuenta'

**Qué hace:** Permite que la mesa acumule varios pedidos en una sola cuenta y que el cliente pida la cuenta desde su teléfono, avisando al personal con un badge en Caja y un push.

- **Dónde:** `Carrito (aviso de mesa con cuenta) · API POST /api/public/open-accounts, GET /api/public/table-account-status, POST /api/public/open-accounts/request-bill`
- **Quién entra:** Público sin clave: solo valida que el módulo Cuentas abiertas esté activo y que la mesa exista y esté activa en ESA sede. El aviso llega al staff (Caja/mesonero).
- **Ya cubierto por:** npm test: publicLocalTableAccounts.test.ts, openAccountBillRequest.test.ts, requestBillRateLimit.test.ts (el freno es por mesa, no por local), openAccountsDomain.test.ts, billMarkerNeverLeaks.fitness.test.ts. npm run qa:open-accounts es una batería de ataque contra cuentas abiertas y npm run qa:cobros-origen separa el cobro por cuenta vs directo.
- **Ojo con:** Cualquiera con el link puede abrir cuenta en una mesa inventando el nombre de mesa (solo se valida que exista y esté activa); dos clientes abriendo a la vez pueden chocar contra el índice único. El pendiente de la cuenta es un total cacheado que se recalcula en varios lugares: si un pedido de la cuenta se cancela, hay que verificar en vivo que el pendiente baja.

**Pruebas:**

- [ ] Escanea el QR de una mesa SIN cuenta abierta, pide algo y marca 'abrir cuenta': en Caja debe aparecer una cuenta abierta de esa mesa abierta por 'Cliente (QR)'.
- [ ] Con esa cuenta ya abierta, haz un segundo pedido desde el mismo QR: el carrito debe avisar 'Esta mesa ya tiene una cuenta abierta' y, al marcar 'Agregar a la cuenta', el pendiente de la cuenta en Caja sube por el monto del segundo pedido.
- [ ] Haz el segundo pedido SIN marcar 'agregar a la cuenta': el pedido entra con la mesa pero la cuenta abierta NO cambia su pendiente.
- [ ] Toca 'Pedir la cuenta' desde el teléfono: en Caja debe aparecer al instante el aviso de que la Mesa X pidió la cuenta, con el monto pendiente.
- [ ] Toca 'Pedir la cuenta' 3 veces seguidas: el aviso al personal no se duplica (conserva la hora original) y desde otra mesa distinta el botón sigue funcionando (el freno es por mesa, no por local).
- [ ] Escanea el QR de una mesa que YA tiene cuenta abierta de otros comensales: la pantalla no puede mostrar el teléfono ni el consumo de esa gente, solo que la mesa tiene cuenta.
- [ ] Cierra la cuenta en Caja y vuelve a escanear el QR: la mesa debe salir como sin cuenta abierta.

### Seguimiento del pedido y 'Tus pedidos'

**Qué hace:** El cliente guarda el link y ve su pedido avanzar (Esperando pago → Recibido → Preparando → Listo), qué trae el pedido, y tiene el botón directo de WhatsApp si tiene dudas.

- **Dónde:** `/pedido/[orderId] (src/app/pedido/[orderId]/page.tsx) y /mis-pedidos (src/app/mis-pedidos/page.tsx) · API GET /api/public/order-status`
- **Quién entra:** Público, sin clave: el acceso es el id imprevisible del pedido (ord-...). La respuesta NO trae teléfono ni dirección, solo número visible, estado, ítems y el estado del pago.
- **Ya cubierto por:** npm test: publicOrderStatusState.test.ts, recentPublicOrders.test.ts (los Listos/Entregados duran 1 hora en la lista, los cancelados salen de una), orderPaymentLegs.test.ts, orderCancellationInfo.test.ts. Ninguna prueba automatizada abre la página de seguimiento en un navegador.
- **Ojo con:** La seguridad del seguimiento depende de que el id ord-... sea imprevisible: quien tenga el link ve el pedido. El estado se refresca por sondeo, no en tiempo real. La página consulta la configuración pública para saber si mostrar el reporte de pago; si esa consulta falla en el teléfono, el bloque de pago puede no aparecer.

**Pruebas:**

- [ ] Haz un pedido de mesa y abre el link de seguimiento: debe mostrar el número grande, los 3 pasos (Recibido/Preparando/Listo) y la lista con lo que pediste y su personalización.
- [ ] Haz un pedido Pick up con Pago móvil y abre el seguimiento: ahora la línea tiene 4 pasos empezando por 'Esperando pago' y arriba sale el recuadro ámbar 'No has reportado el pago' con el botón 'Reportar mi pago'.
- [ ] Con el seguimiento abierto en el teléfono, marca el pedido como 'Preparando' desde Cocina: en menos de un minuto la línea avanza sola en el teléfono del cliente, sin recargar.
- [ ] Márcalo como 'Listo': en un Pick up debe decir '¡Listo! Pasa a retirarlo indicando tu número' y en un Delivery '¡Listo! El delivery se comunicará con usted' (nunca mandar a retirar un delivery).
- [ ] Anula el pedido desde el panel con un motivo: el seguimiento del cliente debe mostrar 'Este pedido fue cancelado' y el motivo del negocio.
- [ ] Entra a /mis-pedidos desde el mismo teléfono: deben listarse los pedidos en curso con su número y avance; un pedido entregado sigue una hora y luego desaparece solo.
- [ ] Inventa un link con un id que no existe (/pedido/ord-999999): debe salir 'No encontramos este pedido', nunca un error feo ni datos de otro.

### Reportar mi pago (comprobantes del cliente)

**Qué hace:** El cliente que pagó por Pago móvil, transferencia o Zelle sube la captura o escribe la referencia y el monto; Caja lo ve y lo confirma. Es lo que evita que un pedido pagado quede como no pagado.

- **Dónde:** `src/components/PublicOrderPaymentSection.tsx (2.000 líneas) dentro de la confirmación del carrito y de /pedido/[orderId] · API GET /api/public/order-payment, POST /api/payment-proofs`
- **Quién entra:** Enviar el comprobante: público (mismo origen, id del pedido). Revisar/confirmar: owner, manager, cashier y promoter (GET /api/payment-proofs exige esos roles).
- **Ya cubierto por:** npm test: paymentProofRegistration.test.ts, paymentReportCoverage.test.ts, paymentReportEvidence.test.ts (mínimo 6 dígitos de referencia), publicMoneyInput.test.ts (el parser de 'Bs 9.648,99'), orderPaymentLegs.test.ts, publicOrderPaymentFlow.test.ts, paymentPrefill.test.ts. npm run qa:payments es la batería de ataque de pagos y npm run qa:mesa-prefill verifica el contrato que precarga 'Registrar cobro' en Caja.
- **Ojo con:** Es la parte que más se ha tocado en las últimas semanas (7f3194c, 3b8702f, 5a8b9ed, 98b4990, cbc0122, b57aeef) y donde más fallas ha destapado la revisión: el pago mixto por pata, el anti-duplicado y el 'monto que falta' son lógica delicada. El tope de 10 comprobantes por 2 minutos por IP puede frenar a un cliente que se equivoca varias veces. Si Caja no confirma el comprobante, el cliente queda viendo 'en revisión' indefinidamente.

**Pruebas:**

- [ ] Haz un Pick up de $10 con Pago móvil, y en la confirmación sube la captura con la referencia completa: en Caja el comprobante debe aparecer con ese monto y esa referencia atados a ese pedido.
- [ ] Repite el reporte escribiendo una referencia de solo 4 dígitos: el sistema debe rechazarlo pidiendo la referencia completa (la regla vive también en el servidor, no solo en la pantalla).
- [ ] Copia y pega el monto tal cual lo muestra la pantalla, con formato 'Bs 9.648,99': el comprobante debe registrar 9648,99 y no 0.
- [ ] Haz un pedido con pago MIXTO (parte efectivo + parte pago móvil) y reporta: la pata de efectivo debe decir 'esto lo entregas en mano' y solo la electrónica pedir captura/referencia; hasta que no llegue la electrónica, el seguimiento debe seguir diciendo que falta.
- [ ] Envía el mismo comprobante dos veces: la segunda debe avisar 'Ya reportaste un pago para este pedido' y pedir confirmación explícita antes de duplicar.
- [ ] Confirma el pago desde Caja y recarga el seguimiento del cliente: debe cambiar a '✅ Pedido pagado: el local confirmó tu pago'.
- [ ] Estando en un pedido de MESA, abre el seguimiento: el botón de reportar pago debe ser el secundario y en tono opcional ('¿Pagaste por transferencia o pago móvil?'), nunca exigiendo el pago por adelantado.
- [ ] Anula un pedido y luego intenta reportarle un pago: debe rechazarlo con 'Este pedido está cancelado y no puede recibir comprobantes'.

### Cancelar mi pedido (desde el cliente)

**Qué hace:** Deja que el cliente anule su propio pedido mientras todavía está en 'Nuevo' y sin pago, con motivo opcional; el insumo vuelve al inventario y le llega aviso al personal.

- **Dónde:** `Botón 'Cancelar mi pedido' en /pedido/[orderId] · API POST /api/public/order-cancel`
- **Quién entra:** Público (solo con el id del pedido). Queda registrado en Auditoría como 'Cliente (seguimiento público)' con rol public y el push llega al staff de la sede.
- **Ya cubierto por:** npm test: orderCancellationInfo.test.ts (origen, motivo, destino del dinero, CANCEL_REFUND_DEFAULT), inventoryConsumption.test.ts y inventoryShortageTrace.test.ts para la devolución de insumos. No hay script qa:* dedicado a la cancelación pública.
- **Ojo con:** El cliente cancela solo con tener el link, sin ninguna verificación adicional. Si la migración 0036 no está aplicada en la base que se use, el detalle estructurado (origen, quién, insumos, destino del dinero) se pierde y solo queda la nota de texto. La devolución de insumos y el recálculo de la cuenta se hacen 'con lo que se pueda' (si fallan no se avisa).

**Pruebas:**

- [ ] Haz un pedido, ábrelo en el seguimiento y toca 'Cancelar mi pedido' con el motivo 'me equivoqué': el pedido queda 'Cancelado' en el panel y el motivo del cliente se ve en el pedido y en Auditoría.
- [ ] Verifica el inventario antes y después de esa cancelación: los insumos que descontó el pedido tienen que volver a su cantidad original.
- [ ] Pon el pedido en 'Preparando' desde Cocina y vuelve a intentar cancelarlo desde el teléfono: debe rechazarlo con 'ya está en preparación… escríbenos por WhatsApp'.
- [ ] Reporta un pago del pedido y luego intenta cancelarlo: debe rechazarlo con 'Ya hay un pago asociado a este pedido'.
- [ ] Registra el cobro en Caja y luego intenta cancelar desde el cliente: también debe rechazarse (el cobro no cambia el estado, pero el servidor revalida los montos).
- [ ] Cancela un pedido que estaba sumado a una cuenta abierta: el pendiente de esa cuenta en Caja tiene que bajar por ese monto.
- [ ] Con las alertas de anulación activas, confirma que al personal le llega el push '❌ pedido cancelado' con el motivo que escribió el cliente.

### Reservas online

**Qué hace:** El cliente reserva mesa desde el sitio: pone fecha, hora, personas y su teléfono; el sistema le asigna sola una mesa libre de esa sede y la reserva cae en el módulo Reservas del panel marcada [Online].

- **Dónde:** `/reservar (src/app/reservar/page.tsx) · API GET/POST /api/public/reservations`
- **Quién entra:** Público. El servidor exige que el módulo Reservas esté activo en el plan y que la sede tenga mesas activas; el staff ve y cancela desde el panel.
- **Ya cubierto por:** npm test: reservationConflicts.test.ts (choques de franja, fecha/hora válidas, hora Caracas). La regla de 'mesa bloqueada por reserva' también se ve en publicLocalTableAccounts.test.ts. No hay e2e ni script qa:* de reservas.
- **Ojo con:** La reserva no se confirma por ningún canal automático: el cliente se queda con una pantalla y el negocio tiene que llamarlo. La franja es fija de 90 minutos, no configurable. Cualquiera puede reservar con datos falsos (solo se validan largo del nombre y dígitos del teléfono, con tope de 10 reservas por minuto por IP). La página /reservar no tiene selector de sede propio: depende del ?branch= de la URL.

**Pruebas:**

- [ ] Reserva para mañana a las 8:00 pm para 4 personas: la pantalla debe confirmar con fecha, hora de inicio y fin (90 minutos), personas y el nombre de la mesa asignada, y esa reserva aparece de una en el módulo Reservas con la nota [Online].
- [ ] Reserva otra vez a la misma hora hasta ocupar todas las mesas activas: la siguiente debe rechazarse con 'No queda mesa libre en ese horario', nunca asignar dos veces la misma mesa.
- [ ] Intenta reservar para una hora que ya pasó hoy: debe salir 'Elige una hora más adelante para hoy'.
- [ ] Intenta reservar a más de 2 meses: debe salir 'Solo aceptamos reservas dentro de los próximos 2 meses'.
- [ ] Escribe un teléfono de 4 dígitos: debe rechazarlo pidiendo un teléfono válido.
- [ ] Abre /reservar?branch=<sede B> y reserva: la mesa asignada tiene que ser una mesa de la sede B, y la reserva aparece bajo esa sede en el panel.
- [ ] Estando vigente una reserva de la Mesa 5, escanea el QR de esa mesa: el cliente debe ver que está reservada en esa franja (sin ver los datos de quien reservó).
- [ ] Apaga el módulo Reservas en Configuración y entra a /reservar: la página debe decir que no está disponible, no un formulario que falla al enviar.

### Encuesta post-venta

**Qué hace:** Después de la venta el cliente entra con el link de su pedido, califica con estrellas los aspectos que definió el dueño y deja una sugerencia. Una sola respuesta por pedido.

- **Dónde:** `/encuesta/[orderId] (src/app/encuesta/[orderId]/page.tsx) · API GET/POST /api/public/survey · resultados en /local-santo/encuestas`
- **Quién entra:** Público (con el id del pedido). El envío automático de la encuesta lo dispara el panel al sondear pedidos (maybeDispatchPostSaleSurveys en api/orders GET).
- **Ya cubierto por:** npm test: surveyFlow.test.ts y surveyButtons.test.ts (incluye la encuesta de botones dentro de WhatsApp). No hay prueba automatizada del formulario web ni del envío automático real.
- **Ojo con:** El disparo automático de encuestas depende de que alguien tenga el panel abierto (se ejecuta en el sondeo de pedidos): con el panel cerrado no salen. La encuesta de botones dentro de WhatsApp queda inerte hasta que el cliente complete la verificación del negocio en Meta.

**Pruebas:**

- [ ] Abre el link de encuesta de un pedido real: debe mostrar el nombre del negocio, el número del pedido, el nombre del cliente y los aspectos que configuró el dueño con sus 5 estrellas.
- [ ] Califica todos los aspectos, escribe una sugerencia y envía: la respuesta debe aparecer en /local-santo/encuestas atada a ese pedido.
- [ ] Vuelve a abrir el mismo link: debe decir que ya respondiste y no permitir una segunda respuesta.
- [ ] Cambia los aspectos de la encuesta en Configuración y abre un link nuevo: los aspectos mostrados deben ser los nuevos.
- [ ] Apaga la encuesta en Configuración y abre un link: debe decir 'La encuesta no está activa en este momento'.
- [ ] Abre un link con un pedido que no existe: debe salir 'No encontramos ese pedido', nunca el formulario en blanco.

### App instalable (PWA) y funcionamiento sin internet

**Qué hace:** Deja instalar el sitio como app en el teléfono, hace que abra rápido y que NO se muera si se cae el internet: los pedidos hechos sin señal se guardan y se envían solos al reconectar.

- **Dónde:** `public/sw.js (cachés santo-static-v30 / santo-pages-v30), public/manifest.webmanifest, public/offline.html · src/components/ServiceWorkerRegister.tsx y OfflineSync.tsx (montados en src/app/layout.tsx, líneas 141-142) · src/lib/offlineQueue.ts`
- **Quién entra:** Público (y también aplica al personal, que usa el mismo service worker).
- **Ya cubierto por:** e2e/pwa-offline.spec.ts (manifest instalable, service worker activo, la app sobrevive una recarga OFFLINE, la caché existe) — corre con Playwright contra un build local. npm test: offlineQueue.test.ts (cola, reintentos, tamaño) y deploymentReadiness.test.ts. Nadie prueba automáticamente que un pedido encolado offline llegue de verdad a Supabase.
- **Ojo con:** El historial del proyecto muestra que la caché fija fue la causa de 'no aparece lo nuevo': si en una publicación se olvida subir la versión de caché (v30 en public/sw.js), los clientes quedan viendo la versión vieja. El service worker no se registra en desarrollo, así que esto SOLO se puede probar contra el sitio publicado o un build de producción. La cola offline solo cubre la creación del pedido: reportar pago o abrir cuenta sin internet no se encolan.

**Pruebas:**

- [ ] Abre el sitio en Chrome de Android y usa 'Agregar a pantalla de inicio': debe instalarse con el nombre y el ícono de Brotherhood y abrir sin barra del navegador.
- [ ] Con la app abierta, pon el teléfono en modo avión y recarga: la app debe seguir abriendo (menú cacheado o la pantalla 'sin conexión'), NUNCA el dinosaurio de Chrome.
- [ ] En modo avión, arma un pedido y envíalo: debe aparecer el aviso 'Sin conexión · 1 pedido(s) en espera' y la confirmación 'Guardado sin conexión'.
- [ ] Quita el modo avión y espera hasta 15 segundos: el aviso cambia a 'Sincronizando' y el pedido aparece en Caja UNA sola vez.
- [ ] Repite la prueba anterior encolando 2 pedidos: al reconectar deben entrar los 2, sin duplicados (cada uno lleva su clave de idempotencia).
- [ ] Publica un cambio visible del menú y vuelve a abrir la app instalada: el cambio tiene que aparecer sin que el cliente tenga que borrar caché (la versión de caché se sube en cada publicación).
- [ ] En iPhone, instala desde Safari (no Chrome) y comprueba que abre en pantalla completa.

### Avisos al cliente cuando su pedido está listo

**Qué hace:** El cliente activa el aviso y recibe una notificación (y vibración) cuando su pedido pasa a Listo, aunque tenga la página cerrada o en segundo plano.

- **Dónde:** `src/components/PublicOrderStatusNotifier.tsx (botón 'Avisarme…', NOTIFY_READY_BUTTON_ENABLED = true) · API GET/POST /api/public/push · src/lib/orderPushNotifications.ts`
- **Quién entra:** Público: se suscribe el navegador de ese teléfono a ESE pedido; el aviso lo dispara el cambio de estado hecho por Cocina o Caja.
- **Ya cubierto por:** El push VAPID se probó de punta a punta con scripts/probar-push.mjs (commit 9e7c131, 7/7) y e2e/pwa-offline.spec.ts confirma el service worker activo. NO hay test de vitest ni script qa:* que cubra la suscripción del CLIENTE ni la entrega del aviso 'Listo'.
- **Ojo con:** Todo depende de que las claves VAPID estén cargadas en el entorno publicado: sin ellas el endpoint responde 503 y el botón queda decorativo, sin que el cliente lo note. En iPhone solo funciona instalado desde Safari (iOS 16.4+). Si el cliente borra los datos del navegador, la suscripción se pierde en silencio. Es el módulo con menos cobertura automática del grupo.

**Pruebas:**

- [ ] Haz un pedido, abre el seguimiento y toca 'Avisarme de los avances de mi pedido': el navegador debe pedir permiso y, al aceptar, mostrarse el sello verde 'Te avisaremos aquí mismo'.
- [ ] Con el permiso aceptado, cambia el pedido a 'Listo' desde Cocina: en el teléfono del cliente debe llegar la notificación con el número del pedido, incluso con la pantalla bloqueada.
- [ ] Repite dejando el seguimiento abierto en primer plano: además de la notificación, el teléfono debe vibrar al pasar a 'Listo'.
- [ ] Rechaza el permiso de notificaciones y confirma que el resto del seguimiento sigue funcionando normal (la línea de avance debe seguir actualizándose sola).
- [ ] En iPhone, instala primero desde Safari a la pantalla de inicio y luego activa el aviso: iOS solo entrega push si la app se agregó desde Safari (desde Chrome no llega).
- [ ] Consulta /api/public/push en el navegador: debe responder enabled true; si responde false, las claves VAPID no están cargadas en el entorno publicado y NINGÚN aviso va a llegar.

### Caja (confirmar y cobrar)

**Qué hace:** Es el mostrador: confirma los pedidos, los manda a cocina, registra el dinero que entra (divisas y bolívares), revisa comprobantes y cierra la entrega.

- **Dónde:** `Página: /local-santo/caja (src/app/local-santo/caja/page.tsx). API: GET /api/orders, PATCH /api/orders/[orderId] (estado y anulación), PATCH /api/orders/[orderId]/payment (cobro), GET /api/payment-proofs, PATCH /api/open-accounts/[accountId] (asociar pedido), GET /api/business-config.`
- **Quién entra:** Guard ModuleAccessGuard moduleKey="cashier" (page.tsx:91). Según ROLE_ACCESS (src/lib/localAccess.ts:57-95) entran: dueño, encargado, caja, promotor y soporte. Caja puede poner Nuevo/Preparando/Listo/Entregado/Cancelado (src/lib/orderStatusPermissions.ts:16-24).
- **Ya cubierto por:** npm run qa:dia-completo, npm run qa:metodos-cobro, npm run qa:cobros-origen, npm run qa:mesa-prefill, npm run qa:payments; vitest: src/app/local-santo/caja/__tests__/paymentPrefill.test.ts, src/lib/__tests__/localOrderMoney.test.ts, src/lib/__tests__/orderPaymentOptimisticLock.test.ts, src/lib/__tests__/orderStatusPermissions.test.ts, src/lib/__tests__/orderPaymentLegs.test.ts.
- **Ojo con:** 1) El cobro directo de Caja NO envía el candado optimista expectedPrevious (page.tsx:612-626) aunque el servidor sí lo soporta (src/app/api/orders/[orderId]/payment/route.ts:348): dos cajeros cobrando el mismo pedido a la vez pueden pisarse el monto — es exactamente el bug BH-SIM-003 documentado en src/lib/__tests__/orderPaymentOptimisticLock.test.ts. 2) El aviso de comprobantes de Caja dice "Confirmar un comprobante no registra el cobro real" (page.tsx ~línea 940) pero la revisión SÍ registra el cobro (payment-proofs/[proofId]/review/route.ts:194+): texto desactualizado que confunde. 3) La impresión automática abre pestaña nueva: un bloqueador de popups la mata sin avisar.

**Pruebas:**

- [ ] Con el flujo de cocina en modo "kitchen" (Configuración), entrar a Caja con filtro "Por confirmar": el pedido nuevo sale con chip rojo "Nuevo · sin confirmar". Pulsar "Pedido confirmado / enviar a cocina" y comprobar que pasa a "Preparando", sale del filtro "Por confirmar" y aparece en /local-santo/cocina.
- [ ] En un pedido de MESA cuyo cliente ya reportó su pago móvil, abrir "Registrar cobro": el formulario debe abrir PRECARGADO con el método "Pago móvil" y el monto en Bs que reportó el cliente (no en blanco). Guardar y verificar que el chip pasa a "Pagado" y el pendiente queda $0.00.
- [ ] Cobro MIXTO: en un pedido de $20 escribir $10 en divisas (Efectivo divisas) y el equivalente de $10 en bolívares (Pago móvil). Guardar y comprobar que "Cobrado" marca $20.00, "Pendiente" $0.00 y el estado de cobro dice "Pagado".
- [ ] Anular un pedido YA cobrado: pulsar "Cancelar pedido" y comprobar que exige motivo de mínimo 5 caracteres, después pregunta si se usaron los ingredientes y después si se devolvió el dinero. Responder "no se usaron" + "sí devolví" y verificar que queda "Cancelado" y que el movimiento sale en /local-santo/auditoria con quién lo anuló.
- [ ] Tocar "Mesa 3" en el mapa de mesas: la lista debe quedar solo con pedidos de "Comer aquí" de esa mesa. Pulsar "Ocultar mapa", recargar la página y comprobar que sigue oculto (la preferencia se guarda por equipo).
- [ ] Pulsar "Permitir avisos en este equipo" (debe quedar "Avisos permitidos") y hacer un pedido desde el menú público: Caja debe sonar y mostrar el pedido nuevo sola, sin recargar (refresca cada 2,5 s).

### Cocina

**Qué hace:** La pantalla del cocinero: ve solo lo que caja ya mandó a preparar, con cronómetro por pedido, y marca cuándo está listo.

- **Dónde:** `Página: /local-santo/cocina (src/app/local-santo/cocina/page.tsx). API: GET /api/orders, PATCH /api/orders/[orderId] con {status:"Listo"}.`
- **Quién entra:** Guard moduleKey="kitchen" (page.tsx:687). Entran cocina, dueño, encargado y soporte (ROLE_ACCESS, src/lib/localAccess.ts:88). El rol cocina solo puede poner "Preparando" o "Listo": nunca entrega ni cancela (src/lib/orderStatusPermissions.ts:26-29).
- **Ya cubierto por:** npm run qa:usuarios (bloque U4: cocina avanza pero no cancela ni entrega); vitest src/lib/__tests__/orderStatusPermissions.test.ts. npm run qa:dia-completo y npm run qa:metodos-cobro recorren Preparando→Listo por API (no la pantalla).
- **Ojo con:** El cronómetro cuenta desde kitchenStartedAt (migración 0026, page.tsx:204-207): si esa migración no está aplicada en la base del cliente, mide desde que se creó el pedido e infla todos los tiempos hasta pintar de rojo pedidos que acaban de entrar. Además la pantalla depende de la clave guardada en el localStorage de ese equipo: si se limpia, el cocinero queda fuera en medio del servicio.

**Pruebas:**

- [ ] Entrar con la clave de COCINA: debe llevar directo a /local-santo/cocina (no al panel del dueño) y NO debe mostrarse ningún pedido en estado "Nuevo" — solo aparecen los que caja ya envió (Preparando/Listo/Entregado).
- [ ] En un pedido "Preparando" pulsar "Marcar listo": debe pasar a "Listo", verse "Listo" en Caja y saltar a la columna "¡Listo!" de /local-santo/pantalla.
- [ ] Activar el sonido en cocina y pedir a Caja que envíe un pedido a cocina: cocina debe sonar sola y mostrar el pedido sin recargar (refresca cada 2,5 s).
- [ ] Cronómetro: un pedido recién enviado debe marcar "Menos de 1 min" en verde ("Reciente"); a los 8 min debe ponerse amarillo "En tiempo", a los 15 naranja "Atención" y a los 25 rojo "Urgente".
- [ ] Pedido con un producto que exige revisión del personal: cocina debe mostrar el recuadro "Productos por confirmar" y, en lugar del botón, el cartel "Revisión pendiente antes de marcar listo". Confirmar la revisión desde /local-santo/mesonero y verificar que el botón "Marcar listo" aparece.
- [ ] Comprobar que en NINGUNA tarjeta de cocina hay botón para cancelar ni para cobrar, y que el filtro "Listos" trae solo pedidos Listo y "Completos" solo Entregado.

### Cocina por producto

**Qué hace:** Agrupa todo lo que hay que preparar por PRODUCTO ("6 hamburguesas en total") en vez de pedido por pedido, para cocinar por tandas.

- **Dónde:** `Página: /local-santo/cocina-productos (src/app/local-santo/cocina-productos/page.tsx). API: GET /api/orders, PATCH /api/orders/[orderId] con {status:"Listo"}.`
- **Quién entra:** Guard moduleKey="kitchenItems" (page.tsx:789). Entran cocina, mesonero, dueño, encargado y soporte (ROLE_ACCESS, src/lib/localAccess.ts:83-90).
- **Ya cubierto por:** Ninguna directa: no hay test ni script que abra esta pantalla. Solo está cubierto el permiso de cambio de estado que usa por debajo (npm run qa:usuarios + src/lib/__tests__/orderStatusPermissions.test.ts).
- **Ojo con:** El botón marca LISTO el PEDIDO COMPLETO aunque solo se haya terminado ese producto (page.tsx:415-425): en un pedido de varios platos se puede cantar "listo" antes de tiempo. Tampoco tiene sonido ni cronómetro (esos solo están en /local-santo/cocina), así que si el cocinero trabaja solo con esta pantalla no se entera de los pedidos nuevos por audio.

**Pruebas:**

- [ ] Con 3 pedidos distintos que lleven hamburguesa, la pantalla debe mostrar UNA tarjeta "Hamburguesa" con el total de unidades y "3 pedidos asociados", no tres tarjetas de pedido.
- [ ] Dentro de esa tarjeta, cada línea debe mostrar el número de pedido, la mesa o tipo de pedido, la variación/adicionales/ingredientes quitados, la nota del producto y la nota general del pedido.
- [ ] Pulsar "Marcar pedido listo" en una línea de un pedido "Preparando": ese pedido debe quedar Listo también en /local-santo/cocina, en Caja y en la Pantalla, y el botón debe desaparecer de todas sus líneas.
- [ ] Probar los filtros "Preparando / Listos / Activos / Todos": con "Preparando" solo deben quedar productos de pedidos en preparación.
- [ ] Un producto que exige revisión debe mostrar "Revisar con el personal antes de preparar este producto"; tras confirmarlo desde Mesonero debe cambiar a "Revisión confirmada por el personal".
- [ ] Marcar un pedido como Listo desde /local-santo/cocina y comprobar que esta pantalla lo refleja sola en unos 3-4 segundos, sin recargar.

### Mesonero (mesas y cuentas)

**Qué hace:** La pantalla del mesonero: ve las mesas ocupadas, abre y sigue cuentas, confirma con el cliente los productos que hay que revisar y marca lo que ya entregó en la mesa.

- **Dónde:** `Página: /local-santo/mesonero (src/app/local-santo/mesonero/page.tsx). API: GET /api/orders, PATCH /api/orders/[orderId] ({status:"Entregado"}, action confirmStaffItems, action resetStaffItems), GET/POST /api/open-accounts, PATCH /api/open-accounts/[accountId] (attachOrder).`
- **Quién entra:** Guard moduleKey="openAccounts" (page.tsx:976). Entran mesonero, caja, dueño, encargado y soporte (ROLE_ACCESS, src/lib/localAccess.ts:81-87). El mesonero SOLO puede mover Listo↔Entregado y el servidor le bloquea el salto Nuevo→Entregado (src/lib/orderStatusPermissions.ts:41-70).
- **Ya cubierto por:** npm run qa:usuarios (U4: no entrega un Nuevo, sí entrega lo Listo, puede des-entregar, no cancela, no cobra), npm run qa:roles (R3: abre cuenta, no cobra, no cierra, no cancela), npm run qa:open-accounts; vitest src/lib/__tests__/orderStatusPermissions.test.ts, src/components/local/__tests__/openAccountsDomain.test.ts, src/lib/__tests__/openAccountBillRequest.test.ts.
- **Ojo con:** La confirmación de revisión y la reapertura se firman literalmente como "Mesonero" (page.tsx:309-310 y 410-411), no con el nombre del usuario: en un turno con dos mesoneros no se sabe quién fue. Además el mesonero puede des-entregar (Entregado→Listo) y eso solo queda en Auditoría, no a la vista de caja.

**Pruebas:**

- [ ] Entrar con la clave de MESONERO: debe caer en /local-santo/mesonero y, al intentar abrir /local-santo/caja a mano, no debe dejarlo entrar.
- [ ] Un pedido en "Nuevo" o "Preparando" NO debe mostrar el botón "Marcar entregado"; solo aparece cuando cocina o caja lo pusieron en "Listo". Pulsarlo debe pedir confirmación ("¿Marcar el pedido de X como ENTREGADO?") y dejar el pedido Entregado.
- [ ] Abrir una cuenta para "Mesa 3", pulsar "Asociar a cuenta" en un pedido de esa mesa y comprobar que la tarjeta pasa de "Sin cuenta" a "En cuenta" y que la métrica "Cuentas abiertas" sube a 1.
- [ ] Verificar que el mesonero NO tiene botón para cobrar ni para cerrar cuentas, y que el texto del panel dice que caja mantiene el control de pagos.
- [ ] Pedido con producto que exige revisión: debe salir con borde amarillo y chip "Revisar producto". Pulsar "Confirmar revisión" → pasa a "Revisado" y en Cocina desaparece el bloqueo "Revisión pendiente antes de marcar listo". Después pulsar "Reabrir revisión" y comprobar que vuelve a quedar pendiente.
- [ ] Tocar una mesa en "Mapa del mesonero": debe aparecer "Filtro de mesa activo: Mesa N" y la lista de abajo debe quedar solo con los pedidos de esa mesa. Copiar el enlace de esa mesa desde "QR y enlaces por mesa" y abrirlo en el teléfono: el menú público debe cargar con esa mesa preseleccionada.

### Delivery (ruta y WhatsApp)

**Qué hace:** La pantalla del repartidor: ve solo los domicilios, copia los datos para salir, avisa al cliente por WhatsApp y le reporta a caja que ya entregó.

- **Dónde:** `Página: /local-santo/delivery (src/app/local-santo/delivery/page.tsx). API: GET /api/orders, PATCH /api/orders/[orderId] con {action:"reportDelivery"}.`
- **Quién entra:** Guard moduleKey="delivery" (page.tsx:692). El rol delivery solo tiene ese módulo (ROLE_ACCESS: delivery: ["delivery"], src/lib/localAccess.ts:91) y NO puede cambiar el estado de ningún pedido (canRoleUpdateStatus devuelve false, src/lib/orderStatusPermissions.ts:47). También entran dueño, encargado y soporte.
- **Ya cubierto por:** npm run qa:usuarios (U4: "delivery NO cambia estados de mesa"). NINGÚN script cubre la acción reportDelivery ni los mensajes de WhatsApp; el guard del servidor sí está probado en src/lib/__tests__/orderStatusPermissions.test.ts.
- **Ojo con:** 1) La acción reportDelivery no la cubre ningún script automático (verificado: no aparece en scripts/). 2) El repartidor reporta, pero quien cierra el pedido en "Entregado" es Caja: si caja no lo hace, el pedido queda en "Listo" para siempre y ensucia los contadores del día. 3) Esta pantalla NO tiene sonido — el hook devuelve null para el contexto delivery (src/hooks/useOperationalSounds.ts:236-238): el aviso de "listo para salir" es solo visual y se pierde si el teléfono está en el bolsillo.

**Pruebas:**

- [ ] Entrar con la clave de DELIVERY: solo deben verse pedidos de domicilio, sin ninguna opción de caja ni de cocina y sin ningún botón que cambie el estado del pedido.
- [ ] Pedir a cocina que marque "Listo" un delivery: en unos 3 segundos debe salir el aviso "#NN está listo para coordinar salida" y la tarjeta debe quedar resaltada.
- [ ] Pulsar "Copiar datos para el repartidor" y pegarlo en WhatsApp: debe traer número de pedido, teléfono del cliente, el link o la dirección y el resumen de lo que lleva, SIN montos ni datos de pago.
- [ ] Probar los cuatro botones de WhatsApp ("Confirmar", "Preparación", "Avisar salida", "Llegué"): el mensaje debe abrirse con el nombre del cliente, el número de pedido, la dirección/zona y el total en dólares con su referencia en bolívares. Con un pedido sin teléfono válido debe salir el aviso "Este pedido no puede abrir WhatsApp…" en vez de los botones.
- [ ] En un pedido LISTO pulsar "Reportar entrega a caja": el botón debe cambiar a "Reportado a caja", el pedido debe SEGUIR en Listo y en Caja debe aparecer en el filtro "Delivery por confirmar" con el chip verde "Entrega reportada". Intentarlo en un pedido que no esté Listo debe fallar con el mensaje "Solo se puede reportar la entrega de un pedido LISTO".
- [ ] Un delivery Listo y sin cobrar debe mostrar el recuadro "Listo, pero falta pago"; si el envío no tiene forma de cobro registrada, debe mostrar además "Delivery sin forma de cobro".

### Pantalla de despacho (TV del mostrador)

**Qué hace:** El televisor o tablet del mostrador: muestra en números grandes qué pedidos se están preparando y cuáles ya están listos para retirar, para no gritar nombres.

- **Dónde:** `Página: /local-santo/pantalla (src/app/local-santo/pantalla/page.tsx), se fija a una sede con ?sede=<id>. API: GET /api/orders.`
- **Quién entra:** Guard moduleKey="tickets" en modo chromeless (page.tsx:268). Entran caja, mesonero, cocina, promotor, dueño, encargado y soporte (ROLE_ACCESS, src/lib/localAccess.ts:81-93). Es solo lectura: no cambia ningún estado.
- **Ya cubierto por:** Ninguna. No hay test de unidad ni script qa/e2e que abra esta pantalla.
- **Ojo con:** Solo muestra 12 pedidos por columna (page.tsx, .slice(0,12)): en un día fuerte los más viejos desaparecen del TV aunque sigan pendientes. Depende de la clave guardada en el localStorage de ESE equipo: si el TV pierde la sesión muestra un error y nadie lo está mirando para darse cuenta.

**Pruebas:**

- [ ] Abrir /local-santo/pantalla en el TV: deben verse dos columnas, "Preparando" y "¡Listo!", con el reloj de Caracas arriba. Pulsar el botón de expandir y comprobar que entra en pantalla completa.
- [ ] Marcar un pedido como Listo desde Cocina: en unos 5 segundos debe saltar solo de la columna izquierda a "¡Listo!" en amarillo (refresca cada 5 s).
- [ ] El número que muestra la pantalla debe ser EXACTAMENTE el mismo que ve el cliente en su confirmación y el que sale en Caja (por ejemplo #40-SD): compararlo en las tres pantallas con el mismo pedido.
- [ ] Hacer un pedido de DELIVERY y comprobar que NO aparece en la pantalla (no se retira en mostrador); un "Para llevar" y un "Comer aquí" sí deben aparecer.
- [ ] Comprobar que un pedido de AYER no aparece: la pantalla solo muestra los del día de hoy en hora de Caracas.
- [ ] Multi-sede: abrir /local-santo/pantalla?sede=<id de San Diego> y comprobar que solo salen pedidos de esa sede y ninguno de la otra.

### Tickets e impresión 80 mm

**Qué hace:** Imprime en papel de 80 mm la comanda para cocina, el ticket de caja, el de delivery, el de una cuenta abierta y el recibo simple para el cliente.

- **Dónde:** `Página: /local-santo/tickets (src/app/local-santo/tickets/page.tsx), con enlace directo ?pedido=<id>&tipo=caja|cocina|delivery|recibo&auto=1. API: GET /api/orders, GET /api/open-accounts, GET /api/branches, GET /api/public/business-config.`
- **Quién entra:** Guard moduleKey="tickets" (page.tsx:1160). Entran caja, mesonero, cocina, promotor, dueño, encargado y soporte (ROLE_ACCESS, src/lib/localAccess.ts:81-93).
- **Ya cubierto por:** Ninguna. Ningún test ni script imprime tickets. Lo único cubierto por rebote es el número de pedido que imprimen (src/lib/__tests__/localOrderHelpers.test.ts, getDisplayOrderNumber).
- **Ojo con:** 1) La impresión automática abre una pestaña nueva (caja/page.tsx:343-350): un bloqueador de popups la anula en silencio y nadie se entera de que no salió la comanda. 2) La pantalla de tickets NO se refresca sola (solo con el botón "Actualizar", no hay setInterval): un ticket impreso minutos después puede llevar datos viejos del pedido. 3) El recibo dice expresamente que no es factura legal — si el cliente pide factura fiscal, no la cubre.

**Pruebas:**

- [ ] Elegir un pedido y abrir "Ticket de cocina": la comanda NO debe traer precios, solo productos, cantidades, notas y adicionales. Imprimir a PDF y comprobar que el papel sale de 80 mm de ancho.
- [ ] Abrir el "Recibo" del mismo pedido: debe traer productos CON precio, el total, el nombre de la SEDE en el subtítulo y el número de pedido. Si en Configuración el símbolo público está en €, el recibo debe salir en € y no en $.
- [ ] Poner en Configuración > Impresión de tickets el modo "Automático: comanda al enviar a cocina + recibo al marcar Listo". Ir a Caja, enviar un pedido a cocina y comprobar que se abre una pestaña que imprime la comanda sola y se cierra; después marcar Listo y comprobar que hace lo mismo con el recibo.
- [ ] Abrir el "Ticket de delivery": debe traer teléfono, dirección, referencia, zona, método indicado y el estado del reporte de entrega, y los productos SIN precio por línea.
- [ ] Abrir una cuenta con 2 pedidos en una mesa y sacar el "Ticket de cuenta abierta": debe listar los dos pedidos y sumar el total de la mesa.
- [ ] Escribir a mano la dirección /local-santo/tickets?pedido=<número visible del pedido>&tipo=recibo&auto=1 y comprobar que encuentra el pedido por ese número y lo imprime solo.

### Comprobantes de pago

**Qué hace:** Aquí caja revisa las capturas de pago que mandan los clientes (pago móvil, Zelle, transferencia) y decide si el pago queda confirmado, rechazado o necesita corrección.

- **Dónde:** `Página: /local-santo/comprobantes (src/app/local-santo/comprobantes/page.tsx). API: GET /api/payment-proofs, PATCH /api/payment-proofs/[proofId]/review, GET /api/orders (para mostrar el número visible del pedido).`
- **Quién entra:** Guard moduleKey="paymentProofs" (page.tsx:334). Entran caja, promotor, dueño, encargado y soporte (ROLE_ACCESS, src/lib/localAccess.ts:81-93).
- **Ya cubierto por:** npm run qa:payments (confirmar dos comprobantes a la vez y la 2ª pata del mixto), npm run qa:mesa-prefill (M3), npm run qa:dia-completo (J3); vitest src/lib/__tests__/paymentProofRegistration.test.ts, src/lib/__tests__/paymentReportEvidence.test.ts, src/lib/__tests__/paymentReportCoverage.test.ts.
- **Ojo con:** 1) La pantalla NO se auto-refresca (solo carga al entrar y con el botón): un comprobante que llega mientras está abierta no aparece hasta refrescar. 2) Si el cliente reporta MENOS de lo que debe, confirmar registra un cobro PARCIAL — hay que comparar "Total pedido" contra "Reportó" antes de dar por bueno. 3) Una foto de efectivo nunca registra cobro por diseño (src/lib/paymentProofRegistration.ts:8-9): ese dinero hay que meterlo a mano en Caja.

**Pruebas:**

- [ ] Que un cliente reporte un pago móvil con captura: el comprobante debe aparecer con la imagen, el método, el monto en Bs, la referencia, el número visible del pedido (#NN) y la hora de Caracas correcta (no adelantada 4 horas).
- [ ] Pulsar "Confirmado por caja": el mensaje debe decir que el cobro quedó registrado en el pedido. Abrir Caja y verificar que ese pedido ya figura cobrado por ese monto exacto. Volver a pulsar "Confirmado por caja" sobre el mismo comprobante y comprobar que NO se duplica el dinero.
- [ ] Pago MIXTO (dos patas): comprobar que la tarjeta muestra LAS DOS capturas, la segunda etiquetada "2ª captura (pago mixto)", antes de dejar confirmar.
- [ ] Que el mismo cliente reporte dos veces el mismo pedido: debe salir el aviso naranja "⚠ Este pedido tiene 2 comprobantes".
- [ ] Escribir una nota interna ("captura borrosa") y pulsar "Rechazado": el estado debe cambiar, la nota debe quedar guardada con quién revisó y cuándo, y el pedido NO debe quedar cobrado en Caja.
- [ ] Filtrar por el estado "Comprobante enviado" y buscar por la referencia bancaria: debe traer solo ese comprobante.

### Panel general de pedidos

**Qué hace:** Es la portada del negocio para el dueño: la lista completa de pedidos del día con sus estados y cobros, más los accesos a todos los demás módulos.

- **Dónde:** `Páginas: /pedidos y /local-santo (la segunda re-exporta la primera, src/app/local-santo/page.tsx). API: GET /api/local-auth?moduleKey=mainPanel, GET /api/orders, PATCH /api/orders/[orderId], PATCH /api/orders/[orderId]/payment, GET /api/open-accounts, GET /api/payment-proofs, /api/day-expenses, /api/day-close.`
- **Quién entra:** En la práctica dueño y encargado: al entrar con clave de caja, mesonero, cocina, delivery, promotor o soporte, el panel redirige a la pantalla de ese rol (redirectWorkerRole + isWorkerOnlyRole, src/app/pedidos/domain.tsx:382-413 y page.tsx:973-976).
- **Ya cubierto por:** e2e/session-roles.spec.ts (la clave de cocina redirige a su pantalla, sesión compartida entre pestañas), npm run qa:roles, npm run qa:usuarios; vitest src/lib/__tests__/localModuleNavWiring.fitness.test.ts y src/lib/__tests__/localAccessNavModules.test.ts (que cada módulo activo tenga su tarjeta en el panel).
- **Ojo con:** 1) El cobro desde el panel tampoco manda el candado expectedPrevious (page.tsx:2792-2810): mismo riesgo de dos personas pisándose el monto que en Caja. 2) La rejilla de tarjetas depende del plan y de los módulos encendidos en Configuración: si el dueño apaga uno sin querer, el módulo desaparece del panel y parece que "se perdió" el sistema. 3) Es un archivo de ~281 KB (src/app/pedidos/page.tsx) con casi todo el panel dentro; cualquier error de render en una sección deja la portada entera en blanco.

**Pruebas:**

- [ ] Entrar a /local-santo con la clave del DUEÑO: debe aparecer la rejilla de tarjetas (Caja, Cocina, Delivery, Comprobantes, Cuentas, Tickets…). Salir, entrar con la clave de COCINA y comprobar que redirige a /local-santo/cocina sin mostrar nunca el panel.
- [ ] Pulsar "Activar sonido", hacer un pedido desde el menú público y comprobar que suena, sale el toast "Nuevo pedido #NN · $X" con el nombre y la mesa, y la tarjeta queda resaltada en rojo unos 12 segundos.
- [ ] Que un cliente reporte un pago: en menos de 10 segundos el panel debe mostrar la alerta de comprobante nuevo y la tarjeta "Pagos reportados" debe pasar de "Al día" a "N por revisar".
- [ ] Contar a mano los pedidos sin cobrar del día y comprobar que la tarjeta "Confirmar y cobrar" muestra ese mismo número; cobrar uno en Caja, volver al panel y verificar que el contador bajó en 1.
- [ ] Aplicar a la vez los filtros "Activos" + "Pendiente de pago" + "Local / llevar": la lista solo debe traer pedidos no entregados, sin cobro y que no sean delivery.
- [ ] Registrar un cobro desde el panel con el botón "Registrar cobro" y comprobar que ese mismo pedido aparece como "Pagado" en /local-santo/caja sin necesidad de recargar.

### Cuentas abiertas de mesa (abrir, asociar pedidos, pedir la cuenta, separar)

**Qué hace:** Cada mesa tiene una cuenta viva a la que se le van pegando los pedidos, para cobrar todo junto al final en vez de pedido por pedido.

- **Dónde:** `Pantallas: /local-santo/caja (bloque 'Cuentas abiertas de caja', page.tsx:1043) y /local-santo/mesonero (page.tsx:656). API: GET/POST /api/open-accounts; PATCH /api/open-accounts/[accountId] (attachOrder, updateOrderStatus, clearBillRequest). Publico: POST /api/public/open-accounts, POST /api/public/open-accounts/request-bill, GET /api/public/table-account-status.`
- **Quién entra:** owner, manager, cashier y waiter (api/open-accounts/route.ts:126 y [accountId]/route.ts:238,298). Ademas exige el modulo 'openAccounts' habilitado por usuario (canLocalAccessUseModule, route.ts:50 y [accountId]/route.ts:80) y activo en plan/config. El cliente abre la cuenta de su mesa SIN clave desde el QR (api/public/open-accounts/route.ts:28-33, idempotente).
- **Ya cubierto por:** npm run qa:open-accounts (scripts/qa-open-accounts-attack.mjs). Vitest: src/components/local/__tests__/openAccountsDomain.test.ts, src/lib/__tests__/openAccountBillRequest.test.ts, publicLocalTableAccounts.test.ts, billMarkerNeverLeaks.fitness.test.ts, requestBillRateLimit.test.ts.
- **Ojo con:** La cuenta se vincula a la mesa por texto y, si resuelve, tambien por id; una mesa escrita distinta a la configurada (mayusculas, espacios) crea una cuenta paralela. En Brotherhood queda pendiente una cuenta de 'Mesa 1' con +15 de saldo viejo que hay que limpiar antes de entregar.

**Pruebas:**

- [ ] Con la clave de mesonero abre una cuenta en 'Mesa 3' en /local-santo/mesonero y confirma que aparece ahi; luego entra a /local-santo/caja con la clave de caja y confirma que la MISMA cuenta de Mesa 3 se ve en 'Cuentas abiertas de caja'.
- [ ] Registra un pedido 'Comer aqui' de $10 en Mesa 3, pulsa 'Asociar pedido' en la tarjeta de esa cuenta y confirma que el pedido queda listado dentro de la cuenta y que el total de la cuenta pasa a $10.
- [ ] Desde el telefono, con el menu publico abierto en la Mesa 3, toca 'Pedir la cuenta': en Caja debe encenderse el aviso '🔔 Piden la cuenta' con la hora. Tocalo una segunda vez y comprueba que la hora NO cambia.
- [ ] Mirando la tarjeta de la cuenta en la pantalla del MESONERO, comprueba que no existen los botones 'Cobrar y cerrar' ni 'Cerrar cuenta' (solo estan en Caja).
- [ ] Con una cuenta de $30 abre 'Separar cuenta', elige 3 personas y comprueba que las 3 partes suman exactamente $30.00 (sin centavos perdidos) y que separar NO registra ningun cobro.
- [ ] Al abrir una cuenta escribe en la nota el texto [CUENTA_PEDIDA:2026-01-01T00:00:00Z] y guarda: la nota debe quedar guardada SIN ese texto y el aviso de 'Piden la cuenta' NO debe encenderse.

### Cobro de la cuenta completa y cierre / cancelacion de la cuenta

**Qué hace:** Cobrar de un solo golpe todo lo que consumio una mesa: el sistema reparte el dinero entre los pedidos de esa cuenta y la cierra sola si queda en cero.

- **Dónde:** `PATCH /api/open-accounts/[accountId] acciones payAccount (route.ts:444) y close (route.ts:691). UI: bloque 'Cobro agrupado de cuenta' y botones 'Cobrar y cerrar' / 'Cerrar cuenta' / 'Cerrar sin cobrar' en src/components/local/OpenAccountsPanel.tsx:1477-1514.`
- **Quién entra:** owner, manager y cashier. El mesonero recibe 403 con el mensaje 'El mesonero puede abrir o asociar cuentas, pero caja debe registrar los cobros' (route.ts:445-449) y 'caja debe cerrarlas' al cerrar (route.ts:692-696).
- **Ya cubierto por:** npm run qa:open-accounts (cobros simultaneos y candado optimista), npm run qa:metodos-cobro (bloque M2: ciclo completo abrir-asociar-cocina-cobro FIFO-cierre automatico) y npm run qa:cobros-origen. Vitest: src/lib/__tests__/orderPaymentOptimisticLock.test.ts.
- **Ojo con:** El reparto es FIFO por fecha de creacion: si dos cajeros cobran la misma cuenta a la vez, el candado optimista aplica solo parte y devuelve un aviso de conflicto (route.ts:589-592) que hay que leer, no ignorar. Cerrar sin cobrar deja plata pendiente registrada como no cobrada.

**Pruebas:**

- [ ] Cuenta con dos pedidos ($10 y $15, pendiente $25): pulsa 'Cobrar y cerrar', comprueba que el monto llega precargado en 25.00, elige 'Efectivo divisas', guarda; los DOS pedidos deben quedar Pagado y la cuenta 'Cerrada' con el mensaje 'La cuenta quedo pagada y CERRADA'.
- [ ] Repite con pendiente $25 pero cobra solo $10 y desmarca el auto-cierre: el pedido mas viejo debe quedar Pagado, el otro con $15 pendiente y la cuenta debe seguir Abierta.
- [ ] Sobre un pendiente de $25 registra $40: el mensaje debe decir que quedo un excedente no aplicado de $15.00 y ningun pedido puede quedar con mas dinero del que costaba.
- [ ] En una cuenta que aun debe dinero pulsa 'Cerrar sin cobrar' y luego 'No se va a cobrar: marcar Cancelada': la cuenta debe quedar en estado Cancelada y los pedidos NO deben aparecer como pagados.
- [ ] Con esa misma cuenta ya cerrada, intenta cobrarla otra vez: debe salir 'Esta cuenta ya esta cerrada' y no puede moverse ningun monto.
- [ ] Cobra la cuenta de una mesa que tenia encendido el aviso '🔔 Piden la cuenta' y comprueba que el aviso se apaga solo al registrar el cobro.

### Caja: cobro de un pedido (metodos, mixto, parcial)

**Qué hace:** Registrar el dinero que entra por cada pedido, en dolares, en bolivares o mezclado, y que el sistema diga solo si quedo pagado, parcial o pendiente.

- **Dónde:** `/local-santo/caja, modal 'Registrar cobro' (page.tsx:1186-1332). API: PATCH /api/orders/[orderId]/payment.`
- **Quién entra:** owner, manager, cashier y promoter (payment/route.ts:322), con el permiso 'cashier' del usuario (route.ts:334) y el modulo Caja activo en el plan/config (route.ts:96-128).
- **Ya cubierto por:** npm run qa:payments (scripts/qa-payments-attack.mjs: 2a pata del mixto, evidencia por pata), npm run qa:metodos-cobro (bloque M1: un pedido por CADA metodo del catalogo, incluidas variantes mal escritas) y npm run qa:mesa-prefill. Vitest: src/lib/__tests__/orderPaymentLegs.test.ts, localOrderMoney.test.ts, paymentOptions.test.ts, moneyPath.test.ts, src/app/local-santo/caja/__tests__/paymentPrefill.test.ts.
- **Ojo con:** El metodo se normaliza en el servidor (payment/route.ts:158-263): cualquier nombre raro cae en 'Otro' y se pierde el detalle. El campo 'Delivery pagado en' solo se muestra en pedidos de delivery y si el dueno no lo apago; en mesa/pick up no aparece a proposito.

**Pruebas:**

- [ ] Pedido de $20: registra $20 con metodo 'Efectivo divisas' y comprueba que la tarjeta queda 'Pagado' y el pendiente en $0.00.
- [ ] Pedido de $20 con tasa 40: registra $10 en divisas con Zelle y Bs 400 con Pago movil; el pedido debe quedar Pagado y en el cierre del dia Zelle debe aparecer con $10 y Pago movil con $10 (nunca $20 en cada uno).
- [ ] Pedido de $20: registra solo $5, comprueba que queda 'Pago parcial' con $15 pendiente; pulsa 'Completar pendiente en Bs' y verifica que el campo de bolivares se llena con Bs 600.00 (15 x 40); guarda y confirma que pasa a Pagado.
- [ ] Haz un pedido publico eligiendo Pago movil y sin subir captura; en el modal de cobro debe salir el aviso ambar que dice que el cliente indico Pago movil y aun no ha subido captura ni referencia.
- [ ] Abre el mismo pedido en dos pestanas de caja, cobra $20 en la primera y luego pulsa Guardar en la segunda: debe salir un mensaje de que otro cajero cobro primero y el dinero de la primera NO puede desaparecer.
- [ ] Estando parado en la sede San Diego, intenta cobrar un pedido de la otra sede: debe salir un error claro de pedido no encontrado / sin permiso, no una pantalla de error generico.

### Comprobantes de pago (revision en caja)

**Qué hace:** El cliente manda su captura de pago movil o Zelle y caja la aprueba; al aprobarla el cobro se registra solo en el pedido.

- **Dónde:** `/local-santo/comprobantes. API: PATCH /api/payment-proofs/[proofId]/review.`
- **Quién entra:** owner, manager, cashier y promoter (review/route.ts:157), con el modulo 'paymentProofs' incluido y encendido (route.ts:67-89).
- **Ya cubierto por:** npm run qa:payments (confirmar dos comprobantes a la vez, apagado de 'En revision' al cobrar en caja). Vitest: src/lib/__tests__/paymentProofRegistration.test.ts, paymentReportCoverage.test.ts, paymentReportEvidence.test.ts.
- **Ojo con:** Si el registro automatico no puede aplicarse sin pisar un cobro previo, la confirmacion igual se guarda y solo se devuelve el motivo para que caja lo registre a mano (review/route.ts:188-192): si nadie lee ese aviso, el pedido queda cobrado a medias.

**Pruebas:**

- [ ] Desde el telefono reporta un pago con captura y referencia sobre un pedido de $20: debe aparecer en /local-santo/comprobantes con monto, metodo y referencia visibles.
- [ ] Marca ese comprobante como 'Confirmado por caja' con la opcion de registrar el cobro: el pedido debe quedar Pagado por $20 con el metodo reportado, sin tener que escribirlo a mano.
- [ ] Sobre un pedido mixto que mando DOS comprobantes (uno en $ y otro en Bs), confirmalos uno detras del otro: el pedido debe sumar las dos patas y quedar Pagado, sin perder la primera.
- [ ] Rechaza un comprobante y comprueba que el pedido NO cambia su dinero ni su estado de pago.
- [ ] Guarda el cierre del dia y comprueba que el panel de Comprobantes queda vacio, pero el cierre guardado en /local-santo/cierres sigue listando esos comprobantes con su pedido.

### Cierre de caja del dia

**Qué hace:** La foto del dia: cuanto se vendio, cuanto se cobro de verdad, en que metodos entro, los gastos, el neto, los anulados; al guardarlo se reinicia el dia.

- **Dónde:** `/pedidos, boton 'Cierre del dia' (page.tsx:3538-3548) y modal en page.tsx:4770; se guarda con POST /api/day-close al escribir REINICIAR (page.tsx:2457-2548).`
- **Quién entra:** Solo owner y manager (day-close/route.ts:172).
- **Ya cubierto por:** npm run qa:day-close (cierre real punta a punta con restauracion), npm run qa:dia-completo (bloque J5 al centavo contra el libro mayor), npm run qa:metodos-cobro (bloque M3: el desglose por metodo sobrevive en day_closes) y npm run qa:training (modo entrenamiento).
- **Ojo con:** El cierre lo calcula el navegador y lo envia; si la pestana tiene datos viejos, guarda numeros viejos. La fotografia del dia se corta en 500 pedidos y 500 comprobantes (route.ts:424,521). Si la fotografia falla, el cierre se guarda igual con un aviso que hay que leer. El reinicio borra los pedidos vivos: no hay vuelta atras sin backup.

**Pruebas:**

- [ ] Con 3 pedidos del dia cobrados por metodos distintos, abre 'Cierre del dia' y comprueba que 'Cobrado real' coincide exactamente con la suma de lo que registro caja, y que 'Neto estimado' = cobrado real menos gastos del dia.
- [ ] Enciende el Modo entrenamiento en Configuracion e intenta guardar el cierre: debe negarse con el mensaje de que los totales serian de practica y hay que desactivarlo primero.
- [ ] Anula un pedido YA cobrado de $12 respondiendo que NO devolviste el dinero: en el cierre debe aparecer en la linea 'Cobrado de pedidos anulados que se quedo en caja' con $12.00 y NUNCA sumado como venta.
- [ ] Guarda el cierre escribiendo REINICIAR y comprueba que: aparece 'Cierre guardado', la pantalla de pedidos queda vacia y el panel de Comprobantes tambien.
- [ ] Abre el cierre recien guardado en /local-santo/cierres y comprueba que trae la lista pedido por pedido del dia (numero, cliente, mesa, total, cobrado) y el bloque 'Cobros por origen (cuenta de mesa vs directo)'.
- [ ] Vuelve a cerrar el mismo dia sin nuevos pedidos y comprueba que los gastos ya incluidos NO se vuelven a restar (quedaron marcados como cerrados).

### Historial de cierres

**Qué hace:** Ver y descargar los cierres de dias pasados, por sede o todas juntas, y sacarlos en Excel o PDF para el contador.

- **Dónde:** `/local-santo/cierres. API: GET /api/day-closes (scope=all para consolidado) y DELETE /api/day-closes.`
- **Quién entra:** Ver: owner y manager (day-closes/route.ts:121); el alcance se recorta por rol con resolveScopedBranchId (route.ts:133-135). Borrar todo el historial: solo owner (route.ts:178). Exige el modulo 'history' incluido y encendido.
- **Ya cubierto por:** npm run qa:day-close, npm run qa:cobros-origen (bloque O3: el desglose por origen llega intacto al historial) y npm run qa:dia-completo (bloque J6: aparece en la sede y en el consolidado).
- **Ojo con:** El borrado del historial es definitivo y solo lo frena el texto de confirmacion. El consolidado depende de que la lista de sedes cargue: si /api/branches falla, los cierres salen sin etiqueta de sede (page.tsx:279-301).

**Pruebas:**

- [ ] Entra con la clave de dueno, activa el consolidado de todas las sedes y comprueba que cada cierre listado trae la etiqueta de la sede a la que pertenece.
- [ ] Entra con la clave de encargado y comprueba que solo ve los cierres de SU sede (el consolidado no le devuelve las otras).
- [ ] Abre un cierre y descargalo en 'Excel (.xlsx)' y en 'PDF': el total cobrado del archivo debe coincidir con el que muestra la pantalla.
- [ ] Descarga 'Excel completo' de ese mismo cierre y comprueba que trae el detalle (ventas por vendedor, cobros por metodo, productos vendidos, gastos).
- [ ] Con clave de encargado intenta borrar el historial: no debe permitirlo; con clave de dueno el borrado exige escribir BORRAR HISTORIAL y solo entonces se ejecuta.

### Gastos del dia

**Qué hace:** Anotar lo que salio de la caja hoy (hielo, gas, delivery, sueldo suelto) para que el neto del cierre sea el dinero real.

- **Dónde:** `API: GET/POST/DELETE /api/day-expenses. Se registran desde /pedidos (bloque de gastos del cierre) y desde /local-santo/control-gastos.`
- **Quién entra:** Ver y registrar: owner y manager (day-expenses/route.ts:150,220). Eliminar: solo owner (route.ts:340).
- **Ya cubierto por:** npm run qa:dia-completo (bloques J4 y J6: gasto del dia en efectivo y verificacion de que queda Cerrado tras el cierre); tambien lo tocan qa:branch-isolation y qa:usuarios-permisos. No tiene test unitario propio.
- **Ojo con:** El gasto se guarda contra la sede activa: si el dueno esta parado en la sede equivocada, el gasto le baja el neto a la sede que no es. El formulario rapido de Control de gastos solo acepta USD (control-gastos/page.tsx:127-132); el flujo con Bs y tasa vive en Compras/cierre.

**Pruebas:**

- [ ] Registra un gasto de $8 con concepto 'Hielo' y comprueba que aparece en la lista del dia y que el 'Neto estimado' del cierre baja exactamente $8.00.
- [ ] Intenta guardar un gasto sin concepto y otro con monto 0: debe negarlos con 'Falta el concepto del gasto' y 'Debes registrar un monto de gasto'.
- [ ] Con la clave de encargado intenta eliminar un gasto: no debe permitirlo; con la de dueno si.
- [ ] Guarda el cierre del dia con ese gasto incluido y comprueba que al dia siguiente la lista de gastos arranca vacia (el gasto quedo archivado en el cierre, no borrado).
- [ ] Con la clave de cajero intenta abrir la lista de gastos: debe rechazarlo (no es un rol permitido).

### Control de gastos (tablero de egresos)

**Qué hace:** Una sola pantalla donde el dueno ve todo lo que sale de plata hoy: gastos sueltos, compras a proveedores, deudas por pagar y alertas.

- **Dónde:** `/local-santo/control-gastos. Consume GET /api/reports?period=today y /api/day-expenses; enlaza a Compras, Cuentas por pagar y Proveedores.`
- **Quién entra:** Requiere el modulo 'expenses' (control-gastos/page.tsx:143). Los datos vienen de /api/day-expenses (owner/manager) y /api/reports (owner, manager, cashier). El consolidado de todas las sedes solo lo puede pedir owner o support (control-gastos/page.tsx:135 y reports/route.ts:119-121).
- **Ya cubierto por:** Ninguna especifica; se cubre indirectamente por npm run e2e:reports-2e (bloque de proveedores/deudas) y npm run qa:dia-completo (gasto del dia + compra a mitad del dia).
- **Ojo con:** Mezcla dos fuentes distintas (gastos del dia y reportes de compras): si el modulo de proveedores o inventario esta apagado, esos bloques llegan vacios y parece que 'no hay nada' en vez de 'esta apagado'.

**Pruebas:**

- [ ] Registra un gasto de $8 desde esta pantalla y comprueba que el total de gastos del dia sube $8.00 sin recargar la pagina.
- [ ] Registra una compra a proveedor de $50 en /local-santo/compras y vuelve aqui: 'Compras del periodo' debe reflejarla y 'Deudas por pagar' debe mostrar el saldo si quedo a credito.
- [ ] Con clave de dueno activa el consolidado y comprueba que los numeros suben respecto a la vista de una sola sede; con clave de encargado el consolidado no debe estar disponible.
- [ ] Deja un insumo por debajo del minimo en Inventario y comprueba que aqui aparece la alerta de stock bajo.
- [ ] Elimina el gasto de prueba con clave de dueno y comprueba que el total vuelve al valor anterior.

### Reportes de ventas

**Qué hace:** Saber cuanto se vendio y se cobro por dia, por hora, por tipo de pedido, por metodo de pago y por sede, y compararlo con el periodo anterior.

- **Dónde:** `/local-santo/reportes. API: GET /api/reports (period=today|week|month, o from/to; scope=all para consolidado).`
- **Quién entra:** owner, manager y cashier, con el permiso 'reports' del usuario (reports/route.ts:23,100). El consolidado (scope=all) es solo owner o support: cualquier otro rol recibe 403 'Solo dueno o soporte pueden ver consolidado' (route.ts:119-121).
- **Ya cubierto por:** npm run e2e:reports-2e (scripts/reports-2e-e2e.mjs: proveedores, margenes, inventario, alertas), npm run qa:cobros-origen (bloque O1: collectionByOrigin) y npm run qa:isolation. Vitest: src/lib/__tests__/reportAnalytics.test.ts, reportSeries.test.ts, supplierPayables.test.ts.
- **Ojo con:** Los reportes usan la hora de Caracas para agrupar por dia y por hora (route.ts:154-167); un pedido de las 11:50 pm puede caer en el dia que no esperas si se compara contra el cierre. 'Vendido' incluye pedidos aun no cobrados: no es dinero en mano.

**Pruebas:**

- [ ] Con 3 pedidos de hoy cobrados, abre Hoy y comprueba que 'Vendido' es la suma de los totales y 'Cobrado' la suma de lo registrado en caja; un pedido anulado NO puede estar contado.
- [ ] Cobra un pedido de $20 mitad Zelle mitad Pago movil y comprueba que en 'Por metodo de pago' Zelle sale con $10 y Pago movil con $10, y que la suma de los metodos NO supera lo cobrado.
- [ ] Con clave de dueno activa el consolidado y comprueba que aparece el desglose por sede y que la suma de las sedes cuadra con el total consolidado; con clave de cajero comprueba que el consolidado se niega.
- [ ] Cambia a 'Ultimos 7 dias' y comprueba que aparece la comparacion con el periodo anterior (pedidos, total y ticket promedio con su variacion en %).
- [ ] Elige un rango personalizado con la fecha inicial POSTERIOR a la final y comprueba que sale el aviso de que la fecha inicial no puede ser posterior a la final, sin romper la pantalla.
- [ ] Comprueba el bloque de cobros por origen: lo cobrado via cuentas de mesa y lo cobrado directo deben sumar el total cobrado del periodo.

### Tablero del dueno

**Qué hace:** La pantalla de resumen del dueno: cuanto entro hoy o en los ultimos 7 dias, cuanto falta por cobrar, gastos, neto, delivery, deudas y alertas.

- **Dónde:** `/local-santo/dueno. Consume /api/orders, /api/day-expenses, /api/day-closes y /api/supplier-purchases (page.tsx:1466-1476), todos con ?scope=all cuando el dueno consolida.`
- **Quién entra:** Practicamente solo owner: /api/day-closes y /api/day-expenses son owner/manager y el consolidado es owner/support. La clave se guarda en localStorage con la llave 'santo_perrito_owner_session' (page.tsx:41).
- **Ya cubierto por:** Ninguna directa; las fuentes que consume estan cubiertas por npm run qa:day-close, qa:dia-completo y e2e:reports-2e.
- **Ojo con:** Es la pantalla mas pesada del panel (pide 4 APIs a la vez) y muestra numeros de HOY calculados en el navegador; si la pestana lleva horas abierta puede mostrar cifras desactualizadas hasta refrescar.

**Pruebas:**

- [ ] Entra con la clave de dueno y comprueba que 'Cobros reales' de hoy coincide con el 'Cobrado real' del modal de Cierre del dia en /pedidos.
- [ ] Deja un pedido de $15 sin cobrar y comprueba que 'Pendiente por cobrar' sube $15.00.
- [ ] Registra un gasto de $8 y comprueba que el bloque 'Gastos y neto' baja el neto en $8.00 sin recargar.
- [ ] Cambia el rango a 'Ultimos 7 dias' y luego a personalizado: los numeros deben cambiar y el consolidado debe sumar las dos sedes.
- [ ] Pide una anulacion desde caja y comprueba que el codigo de 6 digitos aparece en el bloque de codigos de anulacion de esta pantalla.

### Atribucion de ventas por vendedor / por quien registro

**Qué hace:** Saber quien cobro cada dolar y quien cargo cada pedido, para pagar comisiones o auditar al personal en ferias y eventos.

- **Dónde:** `Se calcula en /pedidos (page.tsx:1581-1584, 1671-1678) y se ve en el modal 'Cierre del dia' ('Ventas por vendedor', page.tsx:4995) y en /local-santo/cierres ('Ventas por vendedor (cobrado por)' page.tsx:1660 y 'Pedidos por registrador' page.tsx:1666). Se guarda en el cierre via /api/day-close (salesBySeller, ordersByRegistrar).`
- **Quién entra:** El nombre del cobrador lo estampa el servidor en cada cobro (chargedBy en payment/route.ts:354 y open-accounts/[accountId]/route.ts:557), asi que aplica a owner, manager, cashier y promoter. El desglose solo se guarda si el modulo Caja esta activo (day-close/route.ts:399-401).
- **Ya cubierto por:** Se ejercita dentro de npm run qa:metodos-cobro y npm run qa:dia-completo (cobros con actor real). No hay script dedicado; la simulacion de la semana lo verifica aparte (scripts/sim/informes.mjs:121 deja constancia de que vive en el cierre, no en /api/reports).
- **Ojo con:** Un cobro hecho con la clave compartida de rol (sin usuario nombrado) se atribuye a la etiqueta del rol, no a una persona: para comisiones reales hay que exigir usuarios individuales.

**Pruebas:**

- [ ] Cobra un pedido de $20 con el usuario 'Cajero 1' y otro de $30 con 'Cajero 2', abre 'Cierre del dia' y comprueba que 'Ventas por vendedor' muestra $20 para el primero y $30 para el segundo.
- [ ] Deja que un cliente haga un pedido desde el QR y comprueba que en 'Pedidos por registrador' aparece como 'Cliente (web/QR)' y no como personal.
- [ ] Guarda el cierre y abrelo en /local-santo/cierres: 'Ventas por vendedor (cobrado por)' debe traer exactamente los mismos nombres y montos.
- [ ] Cobra un pedido con el rol Promotor y comprueba que su nombre aparece como vendedor (no como 'Sin registrar').
- [ ] Descarga el 'Excel completo' de ese cierre y comprueba que la hoja incluye la tabla de ventas por vendedor.

### Modo evento y comparativo de eventos

**Qué hace:** Cada feria o pop-up es una sede temporal con su propio QR y su propia caja; al final se compara cuanto vendio y cuanto dejo neto cada evento.

- **Dónde:** `/local-santo/sucursales, bloque 'Modo evento' (page.tsx:558) y tabla 'Comparativo de eventos' (page.tsx:344-444). API: GET /api/branches/events-summary.`
- **Quién entra:** El comparativo es solo owner o support: cualquier otro recibe 403 'Solo el dueno puede ver el comparativo de eventos' (events-summary/route.ts:29-34).
- **Ya cubierto por:** Ninguna especifica para el comparativo; el aislamiento por sede que lo sostiene lo cubre npm run qa:isolation y npm run qa:branches. Vitest: src/lib/__tests__/branchProvisioning.test.ts y branchConfig.test.ts.
- **Ojo con:** El 'Neto' del comparativo es vendido menos gastos (no cobrado menos gastos, ver el pie de la tabla en page.tsx:440): si quedo plata por cobrar, el neto se ve mejor de lo que es. Los gastos solo cuentan si se registraron con la sede del evento seleccionada.

**Pruebas:**

- [ ] Crea un evento llamado 'Feria de prueba', descarga su QR y comprueba que al abrirlo el menu publico carga con esa sede.
- [ ] Registra y cobra un pedido de $25 en la sede del evento y un gasto de $5 con esa misma sede seleccionada: en 'Comparativo de eventos' el evento debe salir con Vendido $25.00, Gastos $5.00 y Neto $20.00.
- [ ] Comprueba que ese pedido del evento NO aparece en el cierre ni en los reportes de la sede Principal (cada sede cierra lo suyo).
- [ ] Ponle fecha de fin de ayer al evento y comprueba que queda como 'Finalizado', su QR deja de aplicar en el menu publico y sus ventas siguen visibles en el comparativo.
- [ ] Entra con clave de encargado y comprueba que la tabla 'Comparativo de eventos' no se muestra.

### Politica de anulaciones (que pasa con el dinero y los insumos)

**Qué hace:** Que anular un pedido deje constancia de por que, quien lo anulo, si los insumos se usaron y si el dinero se devolvio o se quedo en la caja.

- **Dónde:** `/pedidos, funcion updateStatus (page.tsx:2550-2659) contra PATCH /api/orders/[orderId]; reglas compartidas en src/lib/orderCancellationInfo.ts; codigos del dueno en GET /api/cancellation-requests y en /local-santo/dueno (OwnerCancellationCodes).`
- **Quién entra:** Anular exige el rol permitido en /api/orders y, cuando corresponde, el codigo de 6 digitos del dueno (respuestas 428/403 con requiresCancelCode, page.tsx:2637-2652). Los codigos solo los ve el owner (cancellation-requests/route.ts:39-44).
- **Ya cubierto por:** npm run qa:dia-completo (bloque J3: anulacion declarando que los insumos NO se usaron y el stock vuelve). Vitest: src/lib/__tests__/orderCancellationInfo.test.ts. Nota: la migracion 0036 (columnas de anulacion) debe estar aplicada; npm run qa:migraciones lo verifica.
- **Ojo con:** Riesgo conocido y escrito en el codigo (src/lib/orderCancellationInfo.ts:12-19): si una anulacion de pedido cobrado llega SIN respuesta (por API, script o pantalla con cache vieja) se ASUME que el dinero se devolvio, asi que el cierre reportaria menos de lo que hay en la gaveta. Ademas la pregunta del dinero se hace con ventanas del navegador (window.confirm): si el navegador las bloquea, se pierde el dato.

**Pruebas:**

- [ ] Anula un pedido escribiendo un motivo de 3 letras: el sistema debe negarse pidiendo minimo 5 caracteres.
- [ ] Anula un pedido NO cobrado respondiendo que los ingredientes NO se usaron: el consumo debe devolverse al inventario y en el cierre la linea debe decir 'insumos devueltos al stock'.
- [ ] Anula un pedido YA cobrado de $12 respondiendo que SI devolviste el dinero: el cierre debe mostrarlo en 'Dinero devuelto a clientes' con $12.00 y fuera del total del dia.
- [ ] Anula otro pedido cobrado de $9 respondiendo que NO devolviste el dinero: debe salir en 'se quedo en caja' con $9.00, contado en el arqueo pero NUNCA como venta.
- [ ] Con clave de cajero intenta anular un pedido que exige aprobacion: debe pedir el codigo de 6 digitos; pidelo desde /local-santo/dueno y comprueba que con ese codigo la anulacion pasa.
- [ ] Abre /local-santo/auditoria y comprueba que cada anulacion quedo registrada con motivo, quien la hizo y su rol.

### Inventario (insumos, movimientos y conteo físico)

**Qué hace:** Saber cuánto queda de cada insumo en cada sede, cargarlo, ajustarlo, contarlo físicamente y ver el historial de entradas y salidas.

- **Dónde:** `Página: /local-santo/inventario (pestañas Movimientos, Insumos, Nuevo/ajuste, Conteo físico, Solo cantidades). API: GET/POST/DELETE /api/inventory`
- **Quién entra:** Solo dueño y soporte: src/app/api/inventory/route.ts:148, :194 y :252 exigen ["owner","support"]. El encargado SÍ tiene el módulo listado en el panel (src/lib/localAccess.ts:76) pero la API le responde 403. Además exige plan Pro o superior e inventoryModuleEnabled (route.ts:118-136).
- **Ya cubierto por:** npm run qa:inventory (scripts/qa-inventory-alerts.mjs, checks I2 aislamiento por sede e I4 stock bajo) + vitest src/lib/__tests__/inventoryShortageTrace.test.ts y branchIsolation.fitness.test.ts. NO hay prueba de navegador: ningún archivo de e2e/ abre /local-santo/inventario.
- **Ojo con:** El historial miente sobre el TIPO de movimiento: src/lib/ordersInventory.ts:651-676 ignora movementType, movementReason, movementNote, relatedExpense y expenseId que la pantalla envía (src/app/local-santo/inventario/page.tsx:1759-1776) y escribe siempre "Ajuste"/"Ajuste manual de inventario" con related_expense=false; por eso las entradas, salidas, reinicios y compras-gasto salen todas como "Ajuste manual" y el filtro "Solo gastos" no las encuentra. Además, borrar un insumo NO deja movimiento (ordersInventory.ts:704 devuelve inventoryMovement: null) aunque la pantalla anuncia auditoría de eliminaciones. Y el encargado ve el módulo en el panel pero la API lo rechaza.

**Pruebas:**

- [ ] Entra con la clave del dueño en /local-santo/inventario, pestaña "Nuevo / ajuste": crea el insumo "Pan ZZ", 20 unidades, mínimo 5, costo $1 y guarda. Esperado: en "Insumos" aparece Pan ZZ con 20 unidades y en "Movimientos" hay una fila de carga inicial con cantidad 20 y cantidad final 20.
- [ ] Edita "Pan ZZ" y baja la cantidad a 12. Esperado: el stock queda en 12 y en "Movimientos" hay un movimiento nuevo con -8 y final 12. Ojo: el sistema lo va a rotular "Ajuste / Ajuste manual de inventario" aunque tú hayas registrado una salida.
- [ ] Pestaña "Conteo físico": pulsa "Preparar conteo", escribe 10 en Pan ZZ y dale "Aplicar conteo físico". Esperado: la tarjeta muestra "Diferencia: -2 unidades", el stock queda en 10 y se crea UN movimiento; los insumos que no tocaste no generan ningún movimiento.
- [ ] Abre /local-santo/inventario con la clave del ENCARGADO. Esperado: no debe mostrar ningún insumo y debe salir el aviso de que esa clave no tiene permiso para usar inventario (403).
- [ ] Cambia de sede en el selector del panel y vuelve a Inventario. Esperado: "Pan ZZ" NO aparece en la otra sede; cada sucursal tiene su propio inventario.
- [ ] Abre "Reiniciar cantidades a cero", escribe REINICIAR y confirma. Esperado: todos los insumos quedan en 0, siguen existiendo con sus costos, mínimos y recetas, y en Movimientos hay un ajuste por cada insumo que tenía stock.

### Recetas de inventario (qué insumo gasta cada producto)

**Qué hace:** Decirle al sistema cuántos insumos reales consume cada producto del menú, para que al vender se pueda descontar el stock solo.

- **Dónde:** `Página: pestaña "Recetas" dentro de /local-santo/inventario. API: GET/POST/DELETE /api/inventory-recipes`
- **Quién entra:** Solo dueño y soporte (src/app/api/inventory-recipes/route.ts:159, :200, :268 con ["owner","support"]); depende del mismo módulo inventory (plan Pro).
- **Ya cubierto por:** vitest src/lib/__tests__/inventoryConsumption.test.ts (9 casos: receta por cantidad, acumulación, respaldo por ingredientes del producto, receta inactiva, interruptor por producto). npm run qa:inventory crea producto+receta de 2 unidades (check "I2 setup"). Sin prueba de navegador.
- **Ojo con:** La receta se ata al productId del menú: si se recrea o renumera el producto, la receta queda huérfana y solo lo avisa la pantalla de alertas. La nota de la receta no descuenta nada (la propia pantalla lo advierte) y es fácil que el dueño escriba ahí "1 salchicha" creyendo que cuenta. Y aunque la receta esté perfecta, no descuenta nada si el descuento automático está apagado, que es como viene de fábrica.

**Pruebas:**

- [ ] En la pestaña Recetas selecciona una hamburguesa del menú, agrega el insumo "Pan ZZ" con cantidad 1 y guarda. Esperado: la receta queda listada con el nombre del producto y la línea "1 unidades · Pan ZZ".
- [ ] Intenta guardar una receta sin agregar ningún insumo. Esperado: el sistema la rechaza con el mensaje "Agrega al menos un insumo a la receta" y no crea nada.
- [ ] Crea un producto nuevo en Menú editable, vuelve a Recetas y pulsa "Actualizar menú". Esperado: el producto nuevo aparece en el selector "Producto del menú".
- [ ] Borra del inventario un insumo que esté usado en una receta y abre /local-santo/inventario-alertas. Esperado: sale la alerta amarilla "Receta con insumo no encontrado" nombrando el producto y el insumo.
- [ ] Cambia a la otra sede y abre Recetas. Esperado: las recetas de la primera sede NO aparecen (son por sucursal).

### Descuento automático de stock al vender

**Qué hace:** Que al vender un producto se le reste solo el stock de sus insumos, sin que nadie tenga que anotarlo a mano.

- **Dónde:** `Sin pantalla propia. Se dispara al crear el pedido en POST /api/orders → src/lib/ordersCore.ts:51-98 → src/lib/ordersInventory.ts:264 (applyInventoryConsumption). Reversión en src/lib/ordersInventory.ts:418.`
- **Quién entra:** Nadie lo opera: corre en el servidor cuando entra un pedido. Las banderas que lo prenden (inventoryAutoDeductEnabled / inventoryAutoDeductDryRun) solo se pueden cambiar por POST /api/business-config (src/app/api/business-config/route.ts:556); NINGUNA pantalla del panel las muestra. El interruptor por producto "Descontar inventario" sí está en /local-santo/menu (page.tsx:1885-1893).
- **Ya cubierto por:** npm run qa:inventory-deduct (scripts/qa-inventory-deduct.mjs: descuenta, aísla por sede, anula y devuelve, doble anulación, idempotencia del reintento; prende y devuelve las banderas). vitest src/lib/__tests__/inventoryConsumption.test.ts y inventoryShortageTrace.test.ts.
- **Ojo con:** Viene APAGADO de fábrica (src/lib/businessComplexity.ts:83-84: inventoryAutoDeductEnabled=false + inventoryAutoDeductDryRun=true) y no existe ninguna pantalla para prenderlo: si el cliente espera que el inventario baje solo, hoy no baja. Además el descuento es "mejor esfuerzo": si falla, el pedido se crea igual y el error solo se registra en el monitoreo (ordersCore.ts:52), el dueño no ve ninguna alerta.

**Pruebas:**

- [ ] Anota el stock de "Pan ZZ", manda un pedido de 2 hamburguesas cuya receta lleve 1 pan y vuelve a Inventario. Esperado si el descuento está encendido: el stock bajó exactamente 2 y en Movimientos hay un "Consumo" con la nota "Pedido <id>". Si el stock no se movió, la bandera está apagada (es el estado de fábrica) y hay que decidir antes de entregar.
- [ ] Manda el MISMO pedido dos veces seguidas (doble toque o reintento). Esperado: el stock baja UNA sola vez, no dos.
- [ ] Anula ese pedido antes de que cocina lo prepare y revisa Movimientos. Esperado: aparece un "Ajuste" con motivo "Reversión por anulación de pedido (ingredientes sin usar)" que devuelve la misma cantidad; anularlo dos veces no devuelve el doble.
- [ ] Deja "Pan ZZ" en 0 y vende igual el producto. Esperado: la venta pasa y queda registrado un movimiento con el faltante escrito en el motivo (nunca una venta sin rastro).
- [ ] Apaga el toggle "Descontar inventario" de ese producto en /local-santo/menu, véndelo y revisa el stock. Esperado: el insumo NO baja.
- [ ] Activa el modo práctica, manda un pedido y revisa el stock. Esperado: no se mueve nada.

### Transferencias de inventario entre sedes

**Qué hace:** Mandar insumos de una sede a otra (por ejemplo, surtir una feria o un evento desde la sede principal) sin descuadrar los dos inventarios.

- **Dónde:** `Página: pestaña "Transferir a sede" en /local-santo/inventario. API: POST /api/inventory/transfer → src/lib/inventoryTransfer.ts`
- **Quién entra:** Solo dueño y soporte (src/app/api/inventory/transfer/route.ts:52). Queda registrado en auditoría como "inventory.transferred" (route.ts:94-107).
- **Ya cubierto por:** npm run qa:inventory, bloque I3: "la transferencia responde OK", "resta 20 en el origen (50 → 30)", "suma 20 en el destino, misma cantidad". Sin prueba de navegador.
- **Ojo con:** La transferencia no es una transacción de base de datos: valida todo antes de tocar nada, pero si se cae a mitad del bucle de escritura puede quedar restado en origen y no sumado en destino. En la sede destino se une por nombre+unidad, así que "Pan" y "pan de perro" se vuelven dos insumos distintos. Y no hay pantalla de "transferencias recibidas": el que recibe solo lo ve en Movimientos.

**Pruebas:**

- [ ] Con la sede A seleccionada, abre "Transferir a sede", elige la sede B, escribe 20 en un insumo que tenga 50 y confirma. Esperado: mensaje de transferencia registrada, el insumo queda en 30 en la sede A y en la sede B aparece con +20.
- [ ] Revisa Movimientos en ambas sedes. Esperado: hay un movimiento de salida en la sede origen y uno de entrada en la sede destino, con la misma cantidad.
- [ ] Intenta transferir MÁS de lo que hay (por ejemplo 999 de un insumo con 30). Esperado: el sistema rechaza toda la operación con el mensaje de que no hay suficiente y NO mueve ni un gramo de ningún insumo de la lista.
- [ ] Transfiere un insumo que la sede destino NO tiene. Esperado: se crea allá con su unidad, costo y mínimo copiados, con la cantidad transferida.
- [ ] Pulsa Transferir sin elegir sede destino o sin escribir cantidades. Esperado: avisos "Elige la sede destino de la transferencia" / "Escribe la cantidad a transferir en al menos un producto", sin tocar el stock.
- [ ] Entra a /local-santo/auditoria y busca la acción de transferencia. Esperado: aparece quién la hizo, hacia qué sede y qué productos.

### Alertas de inventario y reposición

**Qué hace:** Ver de un golpe qué se acabó, qué está por acabarse, qué insumo no tiene costo y qué producto activo todavía no tiene receta; y recibir el aviso en el teléfono aunque la app esté cerrada.

- **Dónde:** `Página: /local-santo/inventario-alertas (lee /api/inventory, /api/inventory-recipes y /api/public/products). Notificación push: src/lib/inventoryRestockAlerts.ts, disparada desde GET /api/orders.`
- **Quién entra:** La pantalla pide la clave del dueño (usa /api/inventory, que solo acepta dueño/soporte). El módulo inventoryAlerts requiere plan Completo (src/lib/localPlans.ts:601-611). El push llega a los equipos suscritos a alertas del panel.
- **Ya cubierto por:** npm run qa:inventory, bloque I4 (insumo con stock 2 y mínimo 20 → el panel del dueño lo cuenta como bajo; marca anti-spam del aviso). No hay test de la construcción de alertas de la pantalla (buildInventoryAlerts no tiene vitest propio) ni prueba de navegador.
- **Ojo con:** El push no es un cron: solo se dispara cuando alguien abre el panel de pedidos y como máximo cada 10 minutos, con un aviso por sede cada 12 horas; en un día flojo el dueño puede no recibir nada. La pantalla es solo lectura: no permite reponer ni comprar desde ahí, hay que ir a Inventario o a Compras. Y depende de que los mínimos estén configurados: un insumo con mínimo 0 nunca alerta salvo que llegue a cero.

**Pruebas:**

- [ ] Deja un insumo en 0 y otro por debajo de su mínimo, entra a /local-santo/inventario-alertas. Esperado: el de 0 sale como alerta roja "Insumo agotado" y el otro como amarilla "Stock bajo", con la cantidad sugerida a comprar.
- [ ] Crea un insumo sin costo en USD ni en Bs. Esperado: aparece la alerta informativa "Costo sin registrar" con su nombre.
- [ ] Activa un producto del menú que no tenga receta. Esperado: aparece la alerta "Producto sin receta" nombrándolo.
- [ ] Pulsa "Copiar faltantes" y pega en WhatsApp o en un bloc de notas. Esperado: se pega una lista que empieza con "🛒 Lista de reposición:" y trae, por insumo, cuánto queda y cuánto comprar.
- [ ] Corrige el stock del insumo agotado en Inventario, vuelve a Alertas y pulsa "Actualizar". Esperado: la alerta roja desaparece y el contador de críticas baja.
- [ ] Con el dueño suscrito a las alertas del panel y un insumo agotado, abre el panel de Pedidos y espera: debe llegar el push "📦 Reposición · <sede>" con los nombres, y NO debe repetirse mientras la lista no cambie.

### Subrecetas (preparaciones base)

**Qué hace:** Armar preparaciones base reutilizables (salsas, mezclas, masas, carnes) con insumos del inventario y ver cuánto cuesta cada porción.

- **Dónde:** `Página: /local-santo/subrecetas. API: GET/POST /api/subrecipes y PATCH/DELETE /api/subrecipes/[id]`
- **Quién entra:** Leer: dueño y soporte (src/app/api/subrecipes/route.ts:49). Crear, editar y borrar: SOLO dueño (route.ts:79 y [id]/route.ts:48, :105). Requiere plan Completo y subrecipesModuleEnabled (src/app/api/subrecipes/guard.ts:32-55).
- **Ya cubierto por:** Ninguna prueba funcional. Solo el guard de arquitectura src/lib/__tests__/branchIsolation.fitness.test.ts toca los archivos de subrecetas; no hay vitest de dominio, ni script qa:*, ni e2e.
- **Ojo con:** Las subrecetas NO participan en el descuento automático de stock: src/lib/inventoryConsumption.ts solo mira las recetas de producto (inventory_recipes) y los ingredientes vinculados del producto; una subreceta es hoy solo una calculadora de costo. Tampoco se puede usar una subreceta como ingrediente de una receta de producto. Y es el módulo del grupo con CERO cobertura automática: todo lo que se rompa aquí solo lo agarra la prueba manual.

**Pruebas:**

- [ ] Entra a /local-santo/subrecetas como dueño, crea "Salsa de ajo ZZ" con rendimiento 10 porciones, agrégale 2 insumos con cantidades y guarda. Esperado: queda listada con su rendimiento y con un costo calculado a partir del costo de los insumos.
- [ ] Verifica el costo por porción: cambia el costo de uno de esos insumos en Inventario, vuelve a Subrecetas y recarga. Esperado: el costo de la subreceta cambia acorde (se calcula en vivo con el costo del inventario).
- [ ] Intenta guardar una subreceta sin nombre. Esperado: la rechaza con "Escribe el nombre de la subreceta".
- [ ] Edita la subreceta, quítale un insumo y guarda; luego bórrala. Esperado: los cambios se reflejan al instante y al borrarla desaparece de la lista sin tocar el stock de ningún insumo.
- [ ] Abre /local-santo/subrecetas con la clave del encargado. Esperado: acceso negado (solo dueño/soporte).

### Proveedores

**Qué hace:** Tener la lista de a quién le compras, con su contacto, cuánto le debes y cuándo fue la última compra.

- **Dónde:** `Página: /local-santo/proveedores. API: GET/POST /api/suppliers y PATCH/DELETE /api/suppliers/[id]`
- **Quién entra:** Leer: dueño y soporte (src/app/api/suppliers/route.ts:37). Crear, editar y borrar: SOLO dueño (route.ts:67 y [id]/route.ts:28, :82). Requiere plan Completo y suppliersModuleEnabled.
- **Ya cubierto por:** npm run qa:usuarios (scripts/qa-usuarios-permisos.mjs:167 comprueba que GET /api/suppliers rechaza a todos los roles salvo el dueño). npm run e2e:supplier-payables y npm run e2e:purchase-inventory crean y borran un proveedor de prueba. Sin test de la pantalla ni e2e de navegador.
- **Ojo con:** Borrar un proveedor NO borra sus compras: quedan huérfanas y su deuda deja de agruparse por nombre en la ficha (en Cuentas por pagar se sigue viendo el nombre congelado de la compra). No hay confirmación de deshacer ni papelera. Los campos se guardan al salir del campo (onBlur), así que si el usuario cierra la pestaña sin quitar el foco pierde el cambio.

**Pruebas:**

- [ ] Como dueño, en /local-santo/proveedores crea "Distribuidora ZZ" con contacto y teléfono. Esperado: aparece en la lista marcada "Activo" y con "Sin deuda".
- [ ] Registra una compra a ese proveedor en /local-santo/compras y vuelve a Proveedores. Esperado: en su tarjeta sale la deuda pendiente, "1 compra · $<monto>" y la fecha de la última compra.
- [ ] Pulsa "Ver sus compras" en esa tarjeta. Esperado: abre /local-santo/compras ya filtrado por ese proveedor y el listado muestra SOLO sus compras (no todas).
- [ ] Edita el teléfono directamente en la tarjeta y haz clic afuera del campo. Esperado: se guarda solo (al salir del campo) y al recargar la página el teléfono nuevo sigue ahí.
- [ ] Intenta borrar un proveedor al que le debes plata. Esperado: la confirmación advierte con el monto exacto que le debes y cuántas compras tiene, y avisa que su historial quedará sin proveedor.
- [ ] Usa el buscador escribiendo parte del nombre o del teléfono. Esperado: la lista filtra al instante por nombre, contacto, teléfono o email.

### Compras a proveedores

**Qué hace:** Registrar cada factura de proveedor con su fecha, vencimiento y monto, y si quieres sumarle esa compra al stock de un insumo.

- **Dónde:** `Página: /local-santo/compras. API: GET/POST /api/supplier-purchases, PATCH/DELETE /api/supplier-purchases/[id]`
- **Quién entra:** Leer: dueño y soporte (route.ts:38; el dueño puede pedir consolidado con ?scope=all). Registrar, editar y borrar: SOLO dueño (route.ts:71, [id]/route.ts:37 y :126). Cada compra deja auditoría "supplier_purchase.created".
- **Ya cubierto por:** npm run e2e:purchase-inventory (crea insumo con 10, compra vinculada de 5 → stock 15; comprueba que editar y borrar la compra NO revierte el stock; cantidad 0 → 400; insumo inexistente → 400). npm run qa:inventory bloque I5 (compra a crédito) y vitest src/lib/__tests__/supplierPurchasePartialFailure.test.ts (reversión si la factura falla después de subir el stock).
- **Ojo con:** La entrada al stock es aditiva y no se deshace: editar o borrar la compra deja el stock inflado (verificado en e2e:purchase-inventory), así que un error de tipeo en la cantidad solo se arregla con un ajuste manual. Una compra solo en Bs no se convierte a USD en ningún lado del módulo, así que el "total" del historial y la deuda se muestran en dos monedas separadas. Y la compra vinculada al inventario no crea el gasto del día: eso es un flujo aparte (Inventario → "Registrar como gasto"), con riesgo de doble contabilidad si el dueño hace las dos cosas.

**Pruebas:**

- [ ] Como dueño, en /local-santo/compras elige "Distribuidora ZZ", fecha de hoy, N° de documento, total $100 y registra. Esperado: aparece en el historial con estado "Pendiente" y el contador de arriba dice "1 compra · $100.00".
- [ ] Registra una compra SIN monto (deja $0 y Bs 0). Esperado: la rechaza con "Indica el monto de la compra (USD o Bs) mayor a cero" y no la crea.
- [ ] Registra una compra con vencimiento ANTERIOR a la fecha de la compra. Esperado: la rechaza con "La fecha de vencimiento no puede ser anterior a la compra".
- [ ] Marca "Sumar esta compra al inventario", elige un insumo con stock conocido y pon cantidad 5. Esperado: al guardar, el stock de ese insumo sube exactamente 5 y en Movimientos aparece un movimiento "Compra" con el motivo "Entrada por compra a proveedor (Distribuidora ZZ)".
- [ ] Edita esa misma compra y bájale el total, luego bórrala. Esperado: el aviso de borrado advierte que "El stock que sumó NO se revierte" y, en efecto, el stock del insumo NO baja: sigue con los 5 sumados.
- [ ] Registra una compra solo en bolívares (total Bs, USD en 0). Esperado: el contador del historial muestra el total en Bs (algo como "$0.00 + Bs 1.500,00"), no un $0.00 solitario.

### Cuentas por pagar (deuda a proveedores y abonos)

**Qué hace:** Ver cuánto le debes a cada proveedor, qué está vencido y qué se vence pronto, y registrar abonos parciales o totales.

- **Dónde:** `Página: /local-santo/cuentas-por-pagar (y el panel de abonos dentro de /local-santo/compras). API: GET/POST /api/supplier-purchases/[id]/payments y GET /api/supplier-purchases/payments?dateValue=`
- **Quién entra:** Ver la deuda y abonar: dueño (la pantalla usa /api/supplier-purchases, que es dueño/soporte; el POST de abonos es SOLO dueño, [id]/payments/route.ts:73). El resumen de abonos del día por rango también lo puede leer el encargado (payments/route.ts:20). Cada abono deja auditoría "supplier_purchase.payment.created".
- **Ya cubierto por:** npm run e2e:supplier-payables (nace pendiente → abono parcial 40/100 deja 60 → historial lista el abono → no permite pagar más de lo pendiente (400) → abono final marca Pagado → subir el total lo devuelve a Parcial). vitest src/lib/__tests__/supplierPayables.test.ts (incluye "compra mixta USD+Bs NO queda Pagada hasta saldar AMBAS monedas"). npm run qa:inventory bloque I5.
- **Ojo con:** Los abonos NO se pueden editar ni anular desde ninguna pantalla: un abono con monto equivocado solo se arregla borrando la compra completa (lo que además borra todos sus abonos, ordersStoreSupplierPurchases.ts:397-403) y ese borrado no revierte el stock que la compra sumó. La deuda en bolívares y en dólares no se consolidan en un solo número, así que el "Total por pagar" se lee en dos monedas. La línea del cierre depende de que el módulo Compras esté encendido: si está apagado, el cierre no resta las salidas a proveedores y nadie avisa.

**Pruebas:**

- [ ] Con una compra de $100 pendiente, entra a /local-santo/cuentas-por-pagar. Esperado: arriba dice "Total por pagar $100.00" y "1 compra(s) pendiente(s)", y la compra sale agrupada bajo el nombre del proveedor con la etiqueta roja "Pendiente".
- [ ] Pulsa "Abonar", registra $40 con método "Transferencia" y una referencia. Esperado: la etiqueta cambia a "Parcial", el pendiente pasa a $60 y el total de arriba baja a $60.
- [ ] Intenta abonar $200 a esa compra de $100. Esperado: el sistema lo rechaza con "El pago en dólares supera lo pendiente (quedan $60.00)" y no registra nada.
- [ ] Abona los $60 restantes. Esperado: la compra desaparece de Cuentas por pagar (queda "Pagado") y en /local-santo/compras aparece con la etiqueta verde "Pagado" y pendiente $0.00.
- [ ] Crea una compra MIXTA (por ejemplo $50 + Bs 1.000), abona solo los $50 y vuelve a Cuentas por pagar. Esperado: la compra SIGUE apareciendo como "Parcial" con la deuda en bolívares visible ("$0.00 + Bs 1.000,00"), no debe desaparecer.
- [ ] Crea una compra con vencimiento de ayer sin abonar. Esperado: sale con la etiqueta roja "Vencida", cuenta en el recuadro "Vencido" y se ordena de primera dentro del proveedor.
- [ ] Registra un abono hoy y abre el cierre del día en el panel de Pedidos / /local-santo/cierres. Esperado: aparece la línea "Salidas a proveedores" con ese monto y el "Neto después de compras" queda descontado.

### Usuarios del personal (roles, permisos y sedes)

**Qué hace:** Es donde el dueño crea el usuario de cada trabajador, le dice a qué sedes y a qué pantallas entra, le resetea la clave y lo desactiva el día que deja de trabajar.

- **Dónde:** `Página: /local-santo/usuarios (tarjeta «Usuarios» de la barra del staff, clave de módulo "roles"). API: GET/POST /api/staff y PATCH/DELETE /api/staff/{id}`
- **Quién entra:** Solo Dueño y Soporte pueden abrirlo y usar la API (requireStaffAdmin en src/app/api/staff/route.ts:48 y src/app/api/staff/[id]/route.ts:43). La página además pasa por ModuleAccessGuard con moduleKey "roles" (src/app/local-santo/usuarios/page.tsx:729). Los roles asignables son Dueño, Encargado, Caja, Mesonero, Promotor, Cocina, Delivery y Soporte (src/app/api/staff/route.ts:24-33).
- **Ya cubierto por:** npm run qa:usuarios (scripts/qa-usuarios-permisos.mjs: ciclo de vida, matriz de 12 puertas x 6 roles, permisos custom, desactivación), npm run qa:roles (scripts/qa-roles-proxy.mjs) y npm run qa:desactivacion (scripts/qa-desactivacion.mjs, 8 ataques D1-D8). Unitarios: src/lib/__tests__/staffUsers.test.ts, staffPermissions.test.ts, staffBranchAccess.test.ts, localAccessNavModules.test.ts.
- **Ojo con:** 1) /api/staff (y /api/audit-logs) solo miran el ROL, no los permisos personalizados: si a un dueño se le recortan módulos en modo custom, la pantalla se le cierra pero la API le sigue respondiendo (src/app/api/staff/route.ts:48). 2) Los permisos, sedes y nombre visible de cada usuario NO viven en su propia tabla: se guardan dentro del JSON de business_config bajo la clave "staffUsers" (src/lib/staffUsers.ts:30 y 101-107), así que dos personas editando a la vez pueden pisarse. 3) Las claves por rol de variables de entorno (ORDERS_CASHIER_PASSWORD, etc.) siguen abriendo la API sin usuario: quien sepa la clave compartida entra sin nombre y la auditoría solo registra el rol (src/lib/localAccess.ts:136-194 y 243-257). 4) «Eliminar» no borra: hace desactivación suave is_active=false (src/app/api/staff/[id]/route.ts:258-263).

**Pruebas:**

- [ ] Como Dueño, en /local-santo/usuarios crear el usuario «prueba1» con clave «prueba123», rol Caja y sede San Diego: debe aparecer en la tabla con estado Activo (verde), sede «San Diego» en azul y la etiqueta «Permisos por rol», y el contador de arriba debe subir en 1.
- [ ] Intentar crear un usuario con clave de 4 letras: debe salir en rojo «La contraseña debe tener al menos 6 caracteres» y la tabla debe quedar exactamente igual (no se crea nada).
- [ ] Cerrar sesión, entrar en /acceso como «prueba1» y comprobar que en la barra del panel solo salen Caja, Comprobantes, Cuentas abiertas y Tickets; escribir a mano la dirección /local-santo/configuracion y confirmar que sale la pantalla «Acceso no permitido» en vez de la configuración.
- [ ] Como Dueño, editar a «prueba1», cambiar a «Permisos personalizados», desmarcar Caja y guardar; volver a entrar como prueba1 y confirmar que /local-santo/caja ya NO abre. Devolverlo a «Por rol» y comprobar que vuelve a abrir.
- [ ] Con «prueba1» logueado en otro teléfono, tocar «Desactivar» en su fila desde el panel del dueño: la fila debe quedar gris con «Inactivo» y, al recargar la pantalla del otro teléfono de una vez (sin esperar), debe sacarlo del sistema.
- [ ] Intentar cambiarle el rol al ÚNICO dueño activo (de Dueño a Caja) y también desactivarlo: en ambos casos debe salir «No puedes quitar al último dueño activo» / «No puedes desactivar al último dueño activo» y el usuario debe quedar igual.

### Acceso del personal (login y candado por módulo)

**Qué hace:** Es la puerta: cada trabajador entra con su usuario y su clave, y el sistema le muestra solo las pantallas que le tocan. Si abre un enlace directo a un módulo, le pide entrar ahí mismo sin mandarlo a otra página.

- **Dónde:** `Páginas: /acceso (login) y el login incrustado en cada módulo (src/components/ModuleAccessGuard.tsx). API: GET/POST /api/local-auth?moduleKey=...`
- **Quién entra:** Todos. El rol lo resuelve el servidor: src/proxy.ts borra los headers x-staff-* que mande el cliente y los vuelve a poner desde el token de Supabase; getRequestAccess (src/lib/localAccess.ts:334-356) prioriza ese rol verificado y, si no hay token, cae a la contraseña por rol.
- **Ya cubierto por:** e2e/session-roles.spec.ts (multipestaña, sesión expirada, la clave de Cocina no abre el panel del dueño, la sesión de /acceso persiste entre pestañas) y npm run qa:roles (scripts/qa-roles-proxy.mjs, ataque real con Bearer a través del proxy). Unitario: src/lib/__tests__/localAccessNavModules.test.ts.
- **Ojo con:** 1) Cuando hay sesión de Supabase, el puente escribe un centinela en localStorage con la clave santo_perrito_owner_session (src/components/AuthBridge.tsx:120-151) para desbloquear la pantalla de login de los paneles antes de que el servidor conteste: puede verse un parpadeo del módulo antes del bloqueo. 2) El freno de 20 intentos por minuto vive en la memoria de cada instancia; en Vercel con varias instancias el límite real es mayor (comentario del propio código, src/app/api/local-auth/route.ts:52-55). 3) Convive la sesión por usuario con las claves compartidas por rol del .env; si el cliente sigue repartiendo la clave del rol, la trazabilidad por persona se pierde.

**Pruebas:**

- [ ] Abrir /acceso, poner un usuario que sí existe con la clave equivocada: debe salir «Usuario o contraseña incorrectos» y no debe entrar.
- [ ] Entrar con un usuario de Cocina: debe caer en su pantalla de cocina y en la barra NO deben aparecer «Cierres», «Reportes» ni «Usuarios».
- [ ] Con esa misma sesión de Cocina, escribir a mano /local-santo/auditoria: debe salir «Acceso no permitido» con el texto «Esta clave no tiene acceso a este módulo», nunca la bitácora.
- [ ] En una pestaña nueva sin haber entrado, abrir directo /local-santo/caja: debe salir el recuadro «Validación requerida» con usuario y clave; al entrar ahí mismo debe quedar DENTRO de Caja, sin pasar por otra pantalla.
- [ ] Con la sesión ya iniciada, volver a /acceso: debe decir «Sesión iniciada como ...» y ofrecer el botón «Entrar al panel» en vez del formulario.
- [ ] Fallar el login más de 20 veces en un minuto: debe responder «Demasiados intentos de acceso. Espera unos segundos e intenta nuevamente» (freno de 20/min en /api/local-auth, src/app/api/local-auth/route.ts:52-63).

### Auditoría (bitácora de quién hizo qué)

**Qué hace:** Es la libreta del negocio: muestra quién cobró, quién anuló, quién cambió la configuración y quién tocó usuarios, con hora, sede e IP. Solo se lee, no se puede editar ni borrar desde la app.

- **Dónde:** `Página: /local-santo/auditoria. API: GET /api/audit-logs (filtros action, entityType, fromDate, toDate, scope=all, limit, offset)`
- **Quién entra:** Solo Dueño y Soporte (src/app/api/audit-logs/route.ts:33-38). Además el módulo «Auditoría de acciones» tiene que estar incluido en el plan (mínimo plan Completo, src/lib/localPlans.ts:860-870) y encendido por el dueño en Configuración.
- **Ya cubierto por:** Parcial: npm run qa:dia-completo (check J6: el cierre queda en auditoría con su sede), npm run qa:desactivacion (D5: la huella del despedido sobrevive al «borrado»), npm run qa:usuarios (la puerta /api/audit-logs cerrada para todos los roles menos dueño/soporte) y npm run qa:isolation (endpoint por sede). No hay test unitario de la pantalla ni del CSV.
- **Ojo con:** 1) Los registros de usuarios (staff.created/updated/deleted) se guardan SIN sede (src/app/api/staff/route.ts:197-204 no manda branchId) y la pantalla filtra por la sede activa por defecto: se ven solo con «Todas las sedes» marcado — parece que no se registró nada. 2) Si la escritura de la bitácora falla, falla en silencio: writeAuditLog nunca lanza error, solo lo captura (src/lib/audit.ts:130-175), así que una acción puede quedar sin rastro sin que nadie se entere. 3) La API solo mira el rol, no los permisos personalizados. 4) La pantalla carga de a 500 filas y los filtros de usuario, categoría, día y búsqueda se aplican SOBRE LO YA CARGADO (src/app/local-santo/auditoria/page.tsx:396-425): con mucho movimiento, buscar algo viejo exige tocar «Cargar registros más antiguos» varias veces.

**Pruebas:**

- [ ] Cobrar un pedido en Caja y entrar de una vez a /local-santo/auditoria: arriba de todo debe aparecer la línea con la hora, el nombre de quien cobró, «Cobro de pedido actualizado» y las etiquetas de monto y método.
- [ ] Tocar el botón «Hoy» y luego el chip del usuario que cobró: el contador de la derecha debe cambiar a «X de Y registros» y abajo solo deben quedar las acciones de esa persona.
- [ ] Tocar «Excel» y abrir el archivo descargado (auditoria-AAAA-MM-DD.csv): debe traer las columnas Fecha, Hora, Usuario, Acción, Categoría, Entidad, Sede, IP y Detalles, y exactamente las filas que se estaban viendo en pantalla.
- [ ] Marcar «Todas las sedes»: deben aparecer registros de las dos sedes con el nombre de la sede en cada línea; al desmarcarlo, solo los de la sede activa.
- [ ] Crear un usuario nuevo desde /local-santo/usuarios, volver a Auditoría y MARCAR «Todas las sedes»: solo así debe aparecer «Usuario de personal creado» con el nombre de quien lo creó (sin ese check no sale, porque esos registros se guardan sin sede).
- [ ] Entrar como Encargado a /local-santo/auditoria: debe salir «Solo el dueño o soporte pueden ver la bitácora», no la lista.

### Soporte y planes (control del proveedor)

**Qué hace:** Es el tablero del proveedor del sistema: revisa que todo esté conectado (Supabase, pedidos, zonas, cierres), muestra qué claves están configuradas y define qué plan y qué módulos tiene contratado el cliente.

- **Dónde:** `Página: /local-santo/soporte. API: GET /api/local-support/status; guarda el plan con POST /api/business-config`
- **Quién entra:** SOLO rol Soporte. El endpoint exige checkRole(request, ["support"]) (src/app/api/local-support/status/route.ts:149) y la página rechaza cualquier otro rol con un mensaje explícito (src/app/local-santo/soporte/page.tsx:206-210). La clave sale de ORDERS_SUPPORT_PASSWORD u ORDERS_PROVIDER_PASSWORD (src/lib/localAccess.ts:184-192).
- **Ya cubierto por:** Ninguna suite dedicada (no existe qa:soporte ni test de /api/local-support). Por debajo sí están cubiertos src/lib/__tests__/localPlans.test.ts, businessConfigModules.test.ts y deploymentReadiness.test.ts.
- **Ojo con:** 1) La clave de soporte se guarda tal cual en sessionStorage del navegador (src/app/local-santo/soporte/page.tsx:212) y viaja como header en cada llamada. 2) Guardar el plan pega a /api/business-config, o sea que soporte escribe sobre TODA la configuración del negocio, no solo sobre el plan. 3) Si ya hay una sesión de Supabase de un usuario con rol Soporte, el puente adjunta el token y getRequestAccess prioriza el rol del token sobre la contraseña (src/lib/localAccess.ts:338-354): en ese caso cualquier texto en el campo de clave deja entrar. 4) Es el único módulo del grupo sin ninguna prueba automatizada.

**Pruebas:**

- [ ] Abrir /local-santo/soporte y poner la clave del DUEÑO: debe rebotar con «Esta área solo permite la clave de soporte. Cierra sesión e ingresa la clave definida en ORDERS_SUPPORT_PASSWORD» y no debe mostrar nada del tablero.
- [ ] Entrar con la clave de soporte y confirmar las 4 tarjetas de arriba: Plan seleccionado, Módulos incluidos X/Y, Chequeos correctos y Pedidos activos; «Chequeos correctos» debe marcar 6/6 en verde.
- [ ] Revisar «Claves configuradas»: Dueño, Caja y Soporte deben decir «Lista» en verde; anotar cuál diga «Falta» en rojo. No debe verse ninguna clave escrita, solo si existe o no.
- [ ] Cambiar a «Modo personalizado», tocar «Bloquear en este cliente» en Auditoría, guardar (debe salir «Plan y módulos guardados correctamente»), y luego entrar como Dueño a /local-santo/auditoria: debe salir «No incluido en el plan». Volver a incluirlo y comprobar que reabre.
- [ ] Confirmar que las tarjetas de Soporte, Configuración y Configuración básica NO tienen botón de bloquear (deben decir «Acceso interno de soporte» o «Activa el modo personalizado»).
- [ ] Tocar «Cerrar sesión» y recargar la página: debe volver a pedir la clave desde cero, no debe quedar entrando solo.

### Modo entrenamiento

**Qué hace:** Un interruptor para entrenar personal nuevo: mientras está encendido, los pedidos que se carguen son de práctica y no descuentan inventario ni cuentan en reportes ni en el cierre del día.

- **Dónde:** `Franja dentro del panel de Pedidos (/pedidos, src/app/pedidos/page.tsx:3726-3783). API: POST /api/business-config con {trainingModeActive}; el estado llega en GET /api/orders (trainingModeActive / trainingModeAvailable)`
- **Quién entra:** Lo enciende y apaga quien puede tocar configuración sensible (Dueño; el botón solo se dibuja si canEditSensitiveSettings, src/app/pedidos/page.tsx:3762). La franja de advertencia la ve TODO el personal mientras esté activo. El módulo requiere plan Completo y estar encendido en Configuración (src/lib/localPlans.ts:884-893).
- **Ya cubierto por:** npm run qa:training (scripts/qa-training-mode.mjs): enciende el módulo de verdad, verifica que un pedido de práctica no toque el inventario y devuelve las banderas exactamente como estaban, incluso si algo revienta a mitad.
- **Ojo con:** Mientras está activo, CUALQUIER pedido nuevo nace como práctica, incluidos los que entren solos por la página pública del cliente: lo decide el servidor en createOrder (src/lib/ordersCore.ts:36-43), no la pantalla. Si se queda encendido en horario de venta se pierde la contabilidad de esas horas y el cliente que pidió por internet no ve ningún aviso. No hay apagado automático, ni al cerrar el día ni por tiempo.

**Pruebas:**

- [ ] Con la clave de soporte confirmar que «Modo entrenamiento» está incluido en el plan, encenderlo como Dueño en Configuración, y comprobar que en /pedidos aparece la franja «Modo entrenamiento» con el botón «Entrar a entrenamiento».
- [ ] Tocar «Entrar a entrenamiento»: la franja debe ponerse NARANJA y decir «Modo entrenamiento ACTIVO» con la advertencia de que los pedidos nuevos son de práctica y no cuentan.
- [ ] Con el modo activo, anotar el stock de un insumo, cargar un pedido con un producto que use ese insumo, y confirmar que el stock NO bajó y que el pedido no suma en Reportes ni en el cierre del día.
- [ ] Tocar «Salir de entrenamiento», cargar otro pedido igual y confirmar que ahora SÍ baja el stock y SÍ aparece en Reportes: así se prueba que el interruptor es el que manda.
- [ ] Con el modo activo, entrar como Caja: debe ver la franja naranja de advertencia pero NO el botón para apagarlo.
- [ ] Antes de entregarle el sistema al cliente, verificar que la franja no esté naranja (modo apagado) y que no queden pedidos de práctica en la pantalla de Pedidos.

### Avisos push al personal (alertas de anulación)

**Qué hace:** Que al dueño (o al encargado) le suene el teléfono cuando se anula un pedido, aunque tenga la app cerrada o la pantalla bloqueada.

- **Dónde:** `Botón «Alertas de anulación» en el encabezado del panel de Pedidos (/pedidos). API: GET/POST/DELETE /api/staff/alerts-push. Lógica del teléfono en src/hooks/useStaffAlertsPush.ts`
- **Quién entra:** Solo Dueño y Encargado (src/app/api/staff/alerts-push/route.ts:43-51). El Dueño queda suscrito global, a TODAS las sedes; el Encargado queda amarrado a su sede activa y, si esa sede no se puede resolver, el servidor responde 409 pidiendo recargar (líneas 104-119).
- **Ya cubierto por:** Ninguna. No hay test unitario ni script qa que cubra /api/staff/alerts-push ni el hook (el script probar-push.mjs no está en esta rama).
- **Ojo con:** 1) Depende de claves VAPID en el servidor: sin ellas el endpoint responde 503 y la función queda muerta aunque el botón se vea. 2) En iPhone solo funciona si la página se agregó a inicio DESDE Safari (iOS 16.4+); es el reclamo más probable del dueño. 3) El estado «encendido» se guarda en el localStorage de ESE teléfono (STORAGE_KEY en src/hooks/useStaffAlertsPush.ts:13): al borrar datos del navegador, el dueño cree que sigue activo y no lo está. 4) Cero cobertura automatizada: solo se comprueba probándolo en un teléfono real.

**Pruebas:**

- [ ] Entrar al panel de Pedidos como Dueño desde un teléfono Android con Chrome, tocar «Alertas de anulación» y aceptar el permiso del navegador: el botón debe cambiar a «Alerta de anulación activa» y salir el texto «Listo: si se anula un pedido, este equipo recibe la alerta aunque la app esté cerrada».
- [ ] Con el botón activo, cerrar por completo la app en el teléfono y anular un pedido desde otro equipo: al teléfono le debe llegar la notificación.
- [ ] Repetir desde un iPhone abriendo la página en Chrome: debe salir el instructivo específico de Safari («abre esta página en Safari... Agregar a pantalla de inicio... iOS 16.4 o superior»), no un error genérico.
- [ ] Entrar como Caja o Cocina al panel y confirmar que el botón de alertas de anulación NO aparece (o que al tocarlo responde «Solo el dueño o el encargado reciben alertas de anulación»).
- [ ] Tocar de nuevo el botón para apagarlo: debe decir «Este equipo ya no recibirá alertas de anulación» y, tras anular otro pedido, ese teléfono NO debe sonar.
- [ ] Confirmar con el dueño que las claves VAPID están puestas en el servidor: si no lo están, el botón debe decir «Alertas no disponibles aquí» con el mensaje de que no están configuradas, en vez de fallar en silencio.

### Respaldos y restauración de la base

**Qué hace:** Sacar una copia completa de la información del negocio (pedidos, cobros, usuarios, inventario, auditoría) a un archivo, y poder devolverla si algo se daña.

- **Dónde:** `Sin pantalla en la app. Scripts: npm run backup (scripts/backup.mjs) y npm run restore (scripts/restore.mjs). Leen las credenciales de .env.local`
- **Quién entra:** Nadie desde la app: solo quien tenga acceso a la máquina y a la SUPABASE_SERVICE_ROLE_KEY del .env.local (scripts/backup.mjs:34-40, scripts/restore.mjs:34-40).
- **Ya cubierto por:** Ninguna. No hay test ni script qa que valide el respaldo ni la restauración.
- **Ojo con:** 1) No hay respaldo automático ni botón en la app: si nadie corre el comando, no hay copia. 2) El archivo queda en texto plano con TODO el negocio adentro (incluye staff_users y audit_logs) en la carpeta backups/. 3) La lista de tablas está escrita a mano (scripts/backup.mjs:43-63) y NO incluye reservations (migración 0019), push_subscriptions (0023), surveys (0027) ni order_cancellation_requests (0029): esa información no se respalda. 4) restore.mjs con --wipe BORRA la tabla completa antes de reinsertar (línea 78): un respaldo incompleto más --wipe se lleva por delante lo que sí estaba bien.

**Pruebas:**

- [ ] Correr npm run backup y confirmar que imprime una línea «✓ tabla: N filas» por cada una de las 19 tablas, termina con «19/19 tablas» y deja el archivo backups/santo-backup-AAAA-MM-DDTHH-MM-SS.json.
- [ ] Abrir ese JSON y verificar que meta.counts.orders y meta.counts.staff_users cuadren con lo que muestran el panel de Pedidos y la pantalla de Usuarios (contando activos e inactivos).
- [ ] Correr npm run restore -- --file backups/<archivo>.json SIN --confirm: debe decir «MODO: dry-run (no escribe)», listar las tablas y terminar con «Nada se escribió» (no puede tocar la base).
- [ ] Renombrar temporalmente el .env.local y correr npm run backup: debe fallar con «Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local» y salir con error, sin dejar un archivo vacío que parezca válido.
- [ ] Definir con el dueño quién corre el respaldo y cada cuánto, y dejarlo por escrito: hoy es 100% manual, el sistema no lo hace solo.

### Suite de pruebas de navegador (Playwright)

**Qué hace:** Es el ensayo general antes de entregar: un navegador de verdad abre la app y comprueba que funcione sin internet (PWA), que se vea bien en teléfono, tablet y computadora, que sea accesible y que las sesiones y los roles se comporten.

- **Dónde:** `Carpeta e2e/ (a11y.spec.ts, pwa-offline.spec.ts, responsive-forms.spec.ts, session-roles.spec.ts) + playwright.config.ts (baseURL http://localhost:3181)`
- **Quién entra:** Herramienta interna del equipo técnico, no del cliente. Los specs usan las claves de .env.simulacion y se saltan solos si el servidor no es localhost o 127.0.0.1 (e2e/session-roles.spec.ts:25-32).
- **Ya cubierto por:** Ella misma es la cobertura. Ojo: NO hay script npm que la lance (los e2e:* de package.json apuntan a otros scripts .mjs distintos); se corre con npx playwright test.
- **Ojo con:** 1) Si el baseURL no es localhost, los tests se SALTAN solos y la corrida se ve «en verde» sin haber probado nada (e2e/session-roles.spec.ts:25-32). 2) Dependen de .env.simulacion y de un usuario «alejandro» con clave escrita dentro del spec (e2e/session-roles.spec.ts:96-97): si esa base se recrea, la suite se rompe sin que sea culpa de la app. 3) El propio config avisa que solo debe correrse contra simulación (playwright.config.ts:6-11); correrla con el .env apuntando a producción escribiría en la base del cliente. 4) No hay ningún spec que cubra el flujo de dinero (cobros, cierre), solo sesión, PWA, responsive y accesibilidad.

**Pruebas:**

- [ ] Antes de nada, abrir .env.local y confirmar que NEXT_PUBLIC_SUPABASE_URL sea la base de SIMULACIÓN, no la de producción: esta suite escribe datos.
- [ ] Correr npx next build, luego npx next start -p 3181 y después npx playwright test: debe terminar con todos los tests en verde y sin ninguno marcado como «skipped» por host equivocado.
- [ ] Correr npx playwright test e2e/session-roles.spec.ts y confirmar los 4 casos: la segunda pestaña abre el panel sin volver a pedir clave, al borrar el localStorage vuelve la puerta de acceso, la clave de Cocina redirige a su pantalla y no muestra «Historial de cierres», y la sesión de /acceso persiste entre pestañas.
- [ ] Correr npx playwright test e2e/a11y.spec.ts y revisar la salida: las violaciones «critical» deben ser cero; anotar las líneas «[serious]» para decidirlas una por una con el dueño.
- [ ] Correr npx playwright test e2e/pwa-offline.spec.ts y confirmar que el manifest responde 200, que el service worker queda activo y que la app sigue mostrando el menú sin internet.
- [ ] Al terminar, devolver .env.local a su valor normal y confirmar que la app local ya no apunta a la base de prueba.

### Editor de menú (productos)

**Qué hace:** Es donde el dueño arma la carta que ve el cliente: nombre, categoría, precio en dólares, foto, descripción, orden, en qué canales se vende (Local / Para llevar / Delivery), si está activo o pausado y si es destacado. El menú se guarda POR SEDE (la sede es la del banner 'Estás viendo la sede', src/app/local-santo/menu/page.tsx:1606).

- **Dónde:** `Pantalla: /local-santo/menu (/local-santo/menu-avanzado ya solo redirige aquí, conservando ?producto=<id>). API: GET/POST/DELETE /api/menu-products, POST /api/menu-products/upload-image; el cliente lo lee por GET /api/public/products y GET /api/public/business-config.`
- **Quién entra:** La API exige rol dueño o encargado (src/app/api/menu-products/route.ts:123,171,251) y ADEMÁS que el usuario tenga el módulo 'menuProducts'. En la tabla de roles el encargado NO lo tiene (src/lib/localAccess.ts:59-82), así que en la práctica solo entra el DUEÑO (y soporte); a un encargado la API le responde 403 'Tu usuario no tiene habilitado el módulo del menú'.
- **Ya cubierto por:** npm test cubre la normalización y la respuesta pública: src/lib/__tests__/menuProductInput.test.ts, publicProductsResponse.test.ts, publicProductNormalization.test.ts, publicProductCategories.test.ts, publicBranchMenu.test.ts (sede sin menú propio hereda el de la principal) y dataUrlImages.test.ts (imágenes). npm run qa:isolation (scripts/qa-branch-isolation.mjs:299,314) comprueba que las dos sedes sirven menú y que ningún id de producto se repite entre sedes. NO hay prueba de navegador: e2e/ no toca este módulo.
- **Ojo con:** 1) El editor NO tiene selector de sede propio: usa la sede del banner, así que es muy fácil cargar un producto en la sucursal equivocada. 2) 'Desactivar' nunca borra (is_active=false): con el tiempo la lista se llena de productos viejos y el filtro 'Solo activos' es la única defensa. 3) El campo 'IVA del producto' solo aparece si Facturación fiscal está encendida (fiscalEnabled, default false en src/lib/businessConfigFields.ts:127). 4) Un encargado que abra el módulo recibe 403 aunque el botón le aparezca. 5) Las imágenes se pintan con unoptimized: una foto pesada de 4-5 MB entra (tope ~4,8 MB) y hace lento el menú en teléfono.

**Pruebas:**

- [ ] Entrar como dueño a /local-santo/menu, tocar 'Mostrar formulario', crear el producto 'ZZ Prueba', categoría Bebidas, precio 3.50, y tocar 'Guardar producto': debe salir el aviso verde 'Producto del menú guardado correctamente', la tarjeta debe aparecer marcada 'Activo', y al recargar el menú público en otra pestaña 'ZZ Prueba' debe verse a $3,50.
- [ ] Con el formulario abierto, dejar el precio en 0 y tocar 'Guardar producto': debe salir el error rojo 'Escribe un precio válido mayor a cero' y NO debe crearse ninguna tarjeta nueva en la lista.
- [ ] En la tarjeta de 'ZZ Prueba' tocar 'Pausar': la etiqueta debe cambiar a 'Inactivo'; recargar el menú público y confirmar que el producto ya NO aparece; volver a tocar 'Activar' y confirmar que reaparece en el público.
- [ ] Editar un producto real, tocar 'Subir foto', elegir una foto del teléfono: debe aparecer la vista previa y la URL en el campo 'Imagen URL'; tocar 'Guardar producto' y confirmar que en el menú público ese producto muestra esa misma foto (no el logo de relleno).
- [ ] Editar un producto y en 'Canales disponibles' apagar 'Delivery'; guardar. En el menú público elegir tipo de pedido Delivery, agregar ese producto al carrito y confirmar que en el carrito sale la etiqueta roja 'Disponible: Local, Para llevar' (src/components/cartDrawerParts.tsx:316-319).
- [ ] Con dos sedes: en el banner 'Estás viendo la sede' cambiar a la otra sucursal, verificar que la lista de productos es la de ESA sede, crear ahí 'ZZ Sede B' y confirmar que al volver a la primera sede ese producto NO aparece.
- [ ] Tocar 'Desactivar' (botón rojo) en 'ZZ Prueba': debe desaparecer del menú público pero seguir en la lista del editor marcado 'Inactivo' — el sistema no borra productos, solo los apaga (src/lib/ordersMenu.ts:549-572).

### Opciones avanzadas del producto (variaciones, adicionales, ingredientes, combos y plantilla armable)

**Qué hace:** Es donde se arma lo que el cliente elige al personalizar: grupos de variaciones (obligatorios u opcionales, con precio extra), adicionales con precio y cantidad máxima, ingredientes incluidos y removibles (que se pueden vincular a un insumo de inventario), artículos de un combo, y la plantilla de un clic para las hamburguesas.

- **Dónde:** `Pantalla: sección 'Opciones avanzadas' dentro de /local-santo/menu (ancla #opciones-avanzadas; también se abre con el botón 'Opciones avanzadas (variaciones, extras…)' de cada tarjeta). Código: src/app/local-santo/menu/AdvancedOptionsSection.tsx + src/app/local-santo/menu-avanzado/{domain.ts,components.tsx,burgerTemplate.ts}. Se guarda con el mismo POST /api/menu-products.`
- **Quién entra:** Mismo permiso que el editor de menú (dueño). Además la sección solo aparece si el plan incluye el módulo 'advancedMenu': el editor consulta /api/local-auth?moduleKey=advancedMenu y si no está incluido cae al modo simple de cajas de texto (src/app/local-santo/menu/page.tsx:793-808).
- **Ya cubierto por:** npm test → src/app/local-santo/menu-avanzado/__tests__/domain.test.ts (normalización de grupos, min<=max, grupo obligatorio nunca con mínimo 0, adicionales con precio y máximo, vínculo de inventario, combos, resumen y advertencias) y src/lib/__tests__/menuProductInput.test.ts (lo que acepta el servidor). Ninguna prueba automatizada aprieta los botones ni verifica cómo se ve en el menú público.
- **Ojo con:** 1) La plantilla de hamburguesa REEMPLAZA variaciones y adicionales existentes (solo avisa con un confirm del navegador): si alguien la toca en un producto ya afinado, se pierden los precios ajustados. 2) La plantilla trae los deltas de precio en 0 (src/app/local-santo/menu-avanzado/burgerTemplate.ts:14-26): si el dueño no los ajusta, elegir 'Big patty' no cobra más. 3) Si el plan no incluye 'advancedMenu' la sección desaparece y el producto se edita en modo simple, que solo entiende nombres — el código intenta no pisar precios guardados con una comparación previa (menu/page.tsx:1152-1199), pero es la parte más delicada del módulo. 4) Vincular un ingrediente a inventario depende de que el módulo Inventario responda; si falla, el ingrediente queda guardado sin descontar stock y nadie lo avisa.

**Pruebas:**

- [ ] Abrir una hamburguesa, desplegar 'Opciones avanzadas' y tocar 'Cargar plantilla de hamburguesa': deben aparecer los grupos 'Escoge tu tipo de hamburguesa' (obligatorio, elegir 1), 'Escoge tu proteína' (obligatorio, elegir 1) y 'Custom fries (para acompañar)' (opcional), más 11 adicionales con precio (Tocineta $1,50, Papas fritas $3,00…). Guardar producto.
- [ ] Con ese producto ya guardado, abrirlo en el menú público: debe pedir elegir tipo y proteína ANTES de dejar agregar al carrito, y las custom fries deben quedar de últimas, después de los adicionales con costo.
- [ ] En un producto que YA tenga variaciones, tocar la línea 'Reemplazar todo con la plantilla de hamburguesa': debe salir un aviso de confirmación; darle Cancelar y comprobar que no cambió nada; repetir y aceptar, y comprobar que sí quedó la plantilla.
- [ ] Agregar un adicional 'Tocineta' con precio 1.50 y máximo 2, guardar; en el menú público agregar ese producto con 2 tocinetas y confirmar que el total del carrito sube exactamente $3,00 sobre el precio base.
- [ ] Cambiar 'Tipo de producto' a 'Con variaciones' y borrar todos los grupos: debe aparecer el recuadro amarillo 'Revisión recomendada' con el texto 'Este producto está marcado con variaciones, pero no tiene opciones registradas.'
- [ ] Cambiar 'Tipo de producto' a 'Combo': debe aparecer el constructor de artículos del combo; agregar 2 productos del menú, guardar, y confirmar que el 'Resumen premium' de la tarjeta menciona los artículos del combo.

### Configuración del negocio (general)

**Qué hace:** Es el panel de control de lo GENERAL del negocio: nombre, descripción, WhatsApp de respaldo, colores y moneda del sitio, qué módulos están encendidos, los métodos de pago y los datos de pago que ve el cliente en el carrito, los cupones, la promoción, los destacados y el flujo de caja-cocina. Lo que cambia de una sede a otra NO se toca aquí (va en Sucursales).

- **Dónde:** `Pantalla: /local-santo/configuracion (secciones: Datos básicos, Tipo de negocio, Facturación fiscal, Colores y vista previa, Sedes, Envío por distancia, Mesas y QR, Módulos del negocio, Productos del menú, Información pública, Promoción, Destacados, Tasa y moneda, Flujo de caja y cocina, Vista y operación, Plan activo). API: GET/POST /api/business-config; el cliente lo lee por GET /api/public/business-config.`
- **Quién entra:** Dueño y soporte (src/app/api/business-config/route.ts:569,614 exige rol owner o support más el módulo 'settings'). El plan y los módulos personalizados solo los cambia soporte (setPlanConfig, línea 266). Los módulos que no estén incluidos en el plan se guardan siempre apagados aunque el dueño los prenda en pantalla (línea 249-253).
- **Ya cubierto por:** npm test → src/lib/__tests__/businessConfigFields.test.ts (que ningún campo se quede sin guardar), businessConfigModules.test.ts (cada módulo del dueño tiene su bandera), businessConfigModuleKeys.fitness.test.ts (pantalla y servidor no se desincronizan), publicBusinessConfigResponse.test.ts (qué sale al público), publicPaymentMethods.test.ts, publicCoupons.test.ts, localAccessNavModules.test.ts y localModuleNavWiring.fitness.test.ts (que apagar un módulo lo saque de la barra). No hay prueba de navegador de esta pantalla.
- **Ojo con:** 1) Es un solo botón 'Guardar configuración' al final de una página de 6.079 líneas: cualquier cambio hecho arriba se pierde si el dueño no baja a guardar. 2) Guardado silencioso a medias: los textos de la página pública, el orden de categorías y los botones de navegación SOLO se guardan si el plan incluye 'advancedPublicConfig' (src/app/api/business-config/route.ts:352-378) y lo mismo con promoción y destacados; si no está incluido, la respuesta igual dice 'Configuración guardada correctamente' pero esos campos no cambiaron. 3) Métodos de pago, datos de pago y cupones son GENERALES: no se pueden poner distintos por sucursal. 4) Los interruptores 'Cerrar con pedidos activos' y 'Cerrar con pagos pendientes' se guardan aquí, pero hay que verificar en el cierre del día que realmente se respeten. 5) La misma pantalla mezcla lo general con accesos directos a Sedes / Mesas / Envío por distancia; el dueño puede creer que ahí edita mesas y no.

**Pruebas:**

- [ ] Entrar como dueño a /local-santo/configuracion, cambiar 'Nombre del negocio' a 'Brotherhood QA' y bajar hasta el botón 'Guardar configuración': debe confirmar el guardado; recargar el menú público y ver el nombre nuevo; devolverlo a 'Brotherhood' y guardar otra vez.
- [ ] En 'Información pública' → 'Métodos de pago del carrito (uno por línea)' dejar solo 'Pago móvil' y 'Efectivo', guardar; abrir el carrito público y confirmar que al pagar SOLO aparecen esas dos opciones.
- [ ] En 'Datos de pago que ve el cliente' escribir tres líneas para Pago móvil (banco, teléfono, cédula), guardar; en el carrito público tocar 'Ver datos de Pago móvil' y confirmar que se ven esas tres líneas con su botón de copiar, y que 'Efectivo' (dejado vacío) no muestra ningún botón.
- [ ] En 'Cupones de descuento' escribir la línea 'ZZQA10 10' y guardar; en el carrito público escribir ZZQA10 y confirmar que descuenta el 10% del pedido; volver a Configuración, borrar la línea, guardar, y confirmar que el mismo código ahora sale como no válido.
- [ ] En 'Módulos del negocio' apagar 'Clientes' y guardar; recargar el panel y confirmar que el botón 'Clientes' desaparece de la barra de módulos y que entrar a /local-santo/clientes muestra el aviso de módulo no disponible; volver a encenderlo y confirmar que regresa.
- [ ] En 'Flujo de caja y cocina' cambiar el modo (por ejemplo a 'Caja + cocina opcional') y guardar; recargar /local-santo/caja y confirmar que los botones de la tarjeta del pedido cambiaron según el modo elegido (la caja toma el modo nuevo al recargar).
- [ ] Usar el índice 'Ir directo a…' de arriba: tocar 'Tasa y moneda' y confirmar que la página baja y despliega esa sección (varias secciones nacen plegadas y si no se despliegan parece que no existieran).

### Mesas y QR

**Qué hace:** Un solo lugar para crear, renombrar, ordenar, poner área/nota y activar o desactivar mesas —sede por sede—, ver cuáles están ocupadas y con cuánto pendiente, e imprimir las tarjetas con el QR que el cliente escanea para pedir desde su mesa.

- **Dónde:** `Pantalla: /local-santo/mesas (editor de mesas + mapa de estado + tarjetas imprimibles con QR). APIs: POST /api/business-config (mesas GENERALES), PATCH /api/branches/[id]/config (mesas PROPIAS de la sede, y localTables:null para volver a heredar), GET /api/public/business-config, GET /api/orders, GET /api/open-accounts?status=Abierta. El QR abre /mesa/<mesa>?branch=<sede>, que redirige a /?mesa=…&mesa_qr=1.`
- **Quién entra:** Ver el módulo: dueño, encargado y mesonero (módulo 'tables' en src/lib/localAccess.ts:59-93, protegido con ModuleAccessGuard). Crear y editar mesas: SOLO el dueño — si la API responde 401/403 el editor se pone en modo lectura con el mensaje 'Solo el dueño puede crear o editar mesas' (src/components/local/LocalTablesEditor.tsx:384-395).
- **Ya cubierto por:** npm run qa:branches (scripts/qa-branches-qr.mjs) prueba que el QR de la mesa abre el menú de SU sede, que la Mesa 3 se resuelve en las dos sedes y que los pedidos quedan con su mesa en su sucursal. npm test → src/lib/__tests__/branchConfig.test.ts (mesas por sede, override vacío, null elimina el override) y businessConfigModules.test.ts (mesas para la respuesta pública y el QR). El editor en sí (renombrar, duplicados, mesas ocupadas) no tiene prueba automatizada de pantalla.
- **Ojo con:** 1) Todo se relaciona por el NOMBRE de la mesa: renombrarla deja cuentas y QR viejos apuntando a un nombre que ya no existe (hay freno para mesas ocupadas, pero no para las libres con QR ya impreso). 2) Guardar con la opción 'Mesas generales' cambia las mesas de TODAS las sedes que heredan; el aviso está en pantalla pero es fácil de pasar por alto. 3) Si la sede ya tiene mesas propias guardadas, editar las generales no se le ve hasta tocar 'Volver a las generales' (el editor lo avisa en amarillo). 4) Los QR dependen de un servicio externo (api.qrserver.com): sin internet salen tarjetas en blanco. 5) Si el plan no incluye el módulo Mesas, el servidor ignora el guardado; el editor lo detecta comparando lo devuelto y avisa, pero es un camino frágil.

**Pruebas:**

- [ ] Como dueño entrar a /local-santo/mesas, en 'Crear y editar mesas' agregar 'Mesa ZZ' y guardar: debe salir el mensaje de mesas guardadas, y 'Mesa ZZ' debe aparecer tanto en el mapa 'Estado operativo por mesa' como en 'Tarjetas imprimibles por mesa'.
- [ ] Copiar el enlace de 'Mesa ZZ' y abrirlo en el teléfono: debe llevar al menú público con la mesa ya seleccionada; hacer un pedido de prueba y confirmar que en Caja ese pedido aparece con 'Mesa ZZ' y en la sede correcta.
- [ ] Con una mesa que tenga cuenta abierta o un pedido activo, intentar renombrarla o quitarla y guardar: debe bloquear con el error 'No se puede guardar: … tiene cuenta abierta o pedidos activos ahora mismo…' y no guardar nada.
- [ ] Poner dos mesas con el mismo nombre y guardar: debe salir el error 'Hay dos mesas con el mismo nombre (…)' y no guardar.
- [ ] Con dos sedes: elegir San Diego en 'Sede que estás gestionando', tocar 'Mesas propias de esta sede', crear una mesa y guardar; verificar que la otra sede NO cambió; luego usar 'Volver a las generales', aceptar la confirmación y comprobar que San Diego vuelve a mostrar las mesas del negocio.
- [ ] Tocar 'Imprimir QR': la vista de impresión debe mostrar una tarjeta por mesa con su código QR legible (las imágenes del QR vienen de api.qrserver.com, así que el equipo necesita internet); escanear una con el teléfono y confirmar que abre el menú de esa mesa y esa sede.

### Sucursales (incluye modo evento y enlaces por sede)

**Qué hace:** Crear y administrar las sucursales (cada una con su propio menú, inventario, caja y reportes), crear eventos o ferias como sedes temporales con su QR, comparar cuánto vendió cada evento y copiar los enlaces que dejan fijado cada equipo a su sede.

- **Dónde:** `Pantalla: /local-santo/sucursales. APIs: GET/POST /api/branches, PATCH/DELETE /api/branches/[id], PATCH /api/branches/[id]/config (fecha de fin del evento), GET /api/branches/events-summary (comparativo de ferias), POST /api/branches/[id]/inventory-transfer (enviar/devolver stock del evento).`
- **Quién entra:** Listar sedes: cualquier usuario autenticado (para poder elegir su sucursal, src/app/api/branches/route.ts:30-32). Crear, renombrar, activar/desactivar y eliminar: SOLO el dueño (línea 76: 'Solo el dueño puede crear sucursales'); a los demás la pantalla les dice 'Solo el dueño puede gestionar las sucursales'.
- **Ya cubierto por:** npm test → src/lib/__tests__/branchProvisioning.test.ts (resumen de eventos: ventas, días, ticket promedio, gastos), branchAccess.test.ts / staffBranchAccess.test.ts / branchMutationScope.test.ts y branchIsolation.fitness.test.ts (que nada se cruce entre sedes). npm run qa:isolation (scripts/qa-branch-isolation.mjs) fuerza cruces entre sedes en pedidos, menú y cierres y verifica que se rechacen. El borrado de una sucursal no se prueba automáticamente (es destructivo).
- **Ojo con:** 1) Eliminar una sucursal borra en cascada sus pedidos, menú, inventario y caja con un solo confirm del navegador y no se puede deshacer (src/app/api/branches/[id]/route.ts:90-92) — es la acción más peligrosa de todo el grupo. 2) Cualquier rol autenticado puede LISTAR las sedes (solo se filtran las que tiene permitidas). 3) El clonado del menú al crear una sede puede fallar y la sede queda creada y vacía: solo avisa con un texto que es fácil de pasar por alto. 4) El traslado de inventario del evento mueve stock real en las dos sedes; no hay 'deshacer' más allá de devolver a mano. 5) Un evento con fecha de fin se auto-finaliza y su QR deja de servir sin avisar a nadie.

**Pruebas:**

- [ ] Como dueño, en /local-santo/sucursales escribir 'ZZ Prueba' y tocar 'Crear': debe aparecer en la lista marcada 'Activa' y también en el selector de sede del panel al recargar.
- [ ] Tocar el botón 'Activa' de 'ZZ Prueba' para dejarla 'Inactiva' y confirmar en el menú público (ventana privada) que esa sede ya no se ofrece al cliente al elegir sucursal.
- [ ] En 'Enlaces por sede' copiar el enlace de 'Caja' de una sucursal, abrirlo en otro equipo o ventana privada y confirmar que ese equipo queda fijado a esa sede (el empleado solo pone su usuario y ve los pedidos de esa sucursal).
- [ ] Crear un evento eligiendo 'copiar el menú' de una sede existente: la sede-evento debe nacer con esos productos ya cargados; imprimir/abrir su QR y confirmar que lleva al menú de ESE evento; si el clonado falla debe aparecer el aviso 'Sede creada, pero el menú no se pudo clonar: …'.
- [ ] En un evento, abrir las herramientas de inventario, enviar 5 unidades de un insumo desde una sede y confirmar que en Inventario ese insumo bajó 5 en la sede origen y subió 5 en el evento; luego usar 'Devolver sobrante a la sede' y comprobar que regresa.
- [ ] Revisar la tabla de comparativo de eventos: debe listar cada feria con Pedidos, Vendido, Cobrado, Gastos, Días, Vendido/día y Ticket promedio, y esos números deben coincidir con los del módulo Reportes filtrando por esa sede.
- [ ] Eliminar 'ZZ Prueba' con el botón de papelera: debe pedir confirmación avisando que se borran TODOS sus datos; aceptar y verificar que desaparece. Con una sola sucursal registrada, intentar borrarla debe responder 'Debe quedar al menos una sucursal'.

### Configuración por sede

**Qué hace:** Poner lo que cambia de una sucursal a otra: nombre público, tiempo estimado de entrega, WhatsApp principal y de delivery, dirección y zona, link de Google Maps, link de reseñas, Instagram y la tasa de cambio propia de esa sede. Lo que se deja vacío hereda el dato general del negocio.

- **Dónde:** `Pantalla: /local-santo/sucursales → sección 'Configuración por sede' (src/app/local-santo/sucursales/BranchConfigPanel.tsx). API: GET/PATCH /api/branches/[id]/config. Lo que llega al cliente sale por GET /api/public/business-config y GET /api/public/branches.`
- **Quién entra:** Solo el DUEÑO: la ruta exige rol owner y responde 403 'Solo el dueño puede configurar sedes' a cualquier otro (src/app/api/branches/[id]/config/route.ts:38-44).
- **Ya cubierto por:** npm test → src/lib/__tests__/branchConfig.test.ts (normaliza campos por sede, mezcla un override sin borrar los de las otras sedes, un campo en null ELIMINA el override, copia de una sede a otra) y publicBusinessConfigResponse.test.ts / publicBranchSelection.test.ts (lo que ve el cliente al elegir sede). npm run qa:branches revisa que cada sede sirva su configuración pública y tenga WhatsApp. Sin prueba de navegador.
- **Ojo con:** 1) 'Copiar desde…' reemplaza toda la configuración propia de la sede destino, INCLUIDAS sus mesas propias, y solo avisa con un confirm. 2) Vacío = heredar: si alguien borra un WhatsApp por error, el cliente termina escribiéndole al número general sin que nadie lo note. 3) La tasa por sede pisa la del negocio y no se ve desde Configuración → 'Tasa y moneda': un cobro puede salir con una tasa distinta a la que el dueño cree tener puesta. 4) El modelo guarda 'ordersPaused' y 'temporarilyClosed' por sede (src/lib/branch.ts:486-487,515) pero NINGUNA pantalla los edita ni ningún flujo los lee: no existe hoy un 'cerrar temporalmente esta sede'. 5) Todo esto vive dentro del blob business_config: dos personas guardando a la vez pueden pisarse.

**Pruebas:**

- [ ] Elegir San Diego en 'Sede a configurar', poner un 'WhatsApp principal de la sede' distinto al general y tocar 'Guardar sede'; abrir el menú público de esa sede (por su QR o eligiéndola) y confirmar que el botón de WhatsApp abre ESE número; luego vaciar el campo, guardar, y confirmar que vuelve al número general del negocio.
- [ ] Poner la dirección y el 'Link de Google Maps de la sede', guardar, y en el menú público abrir 'Nuestros locales': el botón 'Cómo llegar' de esa sede debe abrir ese link (y no el general de la barra superior).
- [ ] Poner 'Nombre público de la sede' (por ejemplo 'San Diego' en vez de 'Sede 2'), guardar, y confirmar que el cliente ve ese nombre al elegir sucursal.
- [ ] En 'Tasa de cambio de esta sede' elegir 'Manual de esta sede' y dejar el monto vacío, tocar 'Guardar sede': debe salir el error 'Pon la tasa manual de esta sede (Bs por dólar), o elige otra opción de tasa.' y no guardar.
- [ ] Elegir 'Manual de esta sede' con 123.45, guardar; abrir el menú público de ESA sede en ventana privada y confirmar que los bolívares se calculan con 123,45, mientras la otra sede sigue con la tasa del negocio (el navegador cachea la tasa 5 minutos: usar ventana privada o esperar).
- [ ] Usar 'Copiar desde…' otra sede y aceptar la confirmación: debe reemplazar TODA la configuración propia de la sede destino (WhatsApp, dirección, Maps, reseñas, Instagram, tasa y mesas propias) y quedar igual a la de origen; verificar campo por campo.

### Clientes

**Qué hace:** Ver quiénes compran y cuánto: cada cliente aparece con su teléfono, cuántos pedidos hizo, cuánto gastó en total, su última compra, si prefiere comer aquí / para llevar / delivery, sus 3 productos más pedidos y un botón para escribirle por WhatsApp con un mensaje ya redactado.

- **Dónde:** `Pantalla: /local-santo/clientes. No tiene API propia: arma la lista en el navegador con GET /api/business-config y GET /api/orders.`
- **Quién entra:** Dueño y encargado (el módulo 'customers' está en la lista de ambos, src/lib/localAccess.ts:58-82) y protegido con ModuleAccessGuard; además la pantalla pide su propia clave, que guarda en el navegador (clave 'santo_perrito_owner_session').
- **Ya cubierto por:** Ninguna: no hay test de la agrupación de clientes ni script qa:* que la toque. Lo único indirecto es que los pedidos que alimenta la lista sí están cubiertos (npm run qa:dia-completo, qa:isolation). Es de los módulos con menos red de seguridad del grupo.
- **Ojo con:** 1) Esta pantalla NO muestra el banner de sede (a diferencia del editor de menú): se ven los clientes de la sede activa del dispositivo y nada en pantalla lo dice, así que es fácil leer la sucursal equivocada. 2) No existe una tabla de clientes: todo se deduce de los pedidos, así que un cliente que pidió sin teléfono se agrupa por nombre y dos personas con el mismo nombre se mezclan. 3) Depende de cuántos pedidos devuelva /api/orders: si esa consulta viene paginada o recortada, los totales del cliente quedan cortos. 4) Sin cobertura automatizada de ningún tipo.

**Pruebas:**

- [ ] Hacer dos pedidos con el MISMO teléfono pero escribiendo el nombre distinto (por ejemplo 'Jose' y 'José P.'), entrar a /local-santo/clientes y confirmar que aparece UN solo cliente con '2 pedidos' y el total sumado de ambos (agrupa por teléfono cuando tiene 7 dígitos o más).
- [ ] Tomar un cliente con varios pedidos y comparar su 'total gastado' con la suma de esos mismos pedidos en Caja/Reportes: deben coincidir al centavo.
- [ ] Anular (Cancelado) uno de los pedidos de ese cliente, recargar la pantalla y confirmar que ese pedido ya no cuenta ni en la cantidad ni en el total.
- [ ] Tocar el botón de WhatsApp de un cliente venezolano cargado como 0412…: debe abrir WhatsApp con el número convertido a 58412… y el mensaje ya escrito con el nombre del negocio y del cliente.
- [ ] Escribir en el buscador un producto (por ejemplo 'Smash') y confirmar que la lista se reduce a los clientes que lo han pedido; borrar el texto y confirmar que vuelve la lista completa.
- [ ] Con dos sedes: cambiar de sucursal en la barra del panel, recargar /local-santo/clientes y confirmar que la lista cambia (son los clientes de los pedidos de esa sede).

### Envío por distancia y zonas de delivery

**Qué hace:** Define cuánto cobra el negocio por llevar el pedido: el dueño pega el link de Google Maps de su local, arma los rangos (hasta X km cuesta $Y) y el factor de ruta; el cliente pega el link de su casa en el carrito y el sistema calcula el costo solo. Cada sucursal cotiza desde su propio local.

- **Dónde:** `Pantalla: /local-santo/configuracion → sección 'Envío por distancia' (componente src/components/config/DeliveryDistanceConfigCard.tsx). APIs: GET/POST /api/delivery-distance (por sede, con x-branch-id), cotización del cliente en /api/public/delivery-quote, y el cálculo definitivo al crear el pedido en POST /api/orders (src/app/api/orders/route.ts:395-431). API legado: GET/POST /api/delivery-zones.`
- **Quién entra:** Solo el dueño puede guardar (la tarjeta se bloquea si no es dueño y POST /api/delivery-zones exige rol owner). Además requiere que el módulo Delivery esté encendido y incluido en el plan; si no, la sección aparece con candado explicando por qué.
- **Ya cubierto por:** npm test → src/lib/__tests__/deliveryDistance.test.ts (lee coordenadas de links de Maps de todas las formas, rechaza basura), deliveryDistanceServer / deliveryCostSingleSource.fitness.test.ts (que el costo salga de una sola fuente y el cliente no pueda mandar el monto). No hay script qa:* ni prueba de navegador para esta pantalla.
- **Ojo con:** 1) Las 'zonas de delivery' del flujo viejo YA NO tienen pantalla: la API /api/delivery-zones existe y el servidor cae a ellas cuando el envío por distancia no está listo (orders/route.ts:423-429), pero no hay dónde cargarlas — resultado práctico: si el envío por distancia se apaga o le falta el origen, el delivery sale gratis. 2) El origen se resuelve desde el link de Maps al guardar; si el link es corto y el servidor no lo puede expandir, la sede queda sin origen y no cotiza. 3) Una sede sin configuración propia cotiza desde el local de OTRA sucursal (herencia): el aviso amarillo es lo único que lo delata. 4) Más allá del último rango no se cotiza: si los rangos quedan cortos, se pierden pedidos sin que nadie se entere.

**Pruebas:**

- [ ] Como dueño, en Configuración → 'Envío por distancia', pegar el link de Google Maps del local, poner los rangos (hasta 3 km $2, hasta 6 km $4, hasta 10 km $6), factor de ruta 1.3, dejar el interruptor en 'Activo' y tocar 'Guardar envío por distancia': debe confirmar el guardado y el texto de abajo debe pasar a 'Ubicación del local detectada'.
- [ ] En el menú público elegir Delivery, pegar el link de Maps de una dirección a ~2 km y confirmar que el carrito muestra $2,00 de envío; completar el pedido y verificar en Caja que el pedido llegó con ese mismo costo de envío (el monto lo decide el servidor, no el teléfono del cliente).
- [ ] Pegar el link de una dirección más lejos que el último rango (por ejemplo 20 km) y confirmar que el carrito dice que está fuera de cobertura e invita a coordinar por WhatsApp, sin cobrar un envío inventado.
- [ ] Con dos sedes: cambiar 'Sede que estás configurando' a la otra sucursal; si aún no tiene lo suyo debe aparecer el aviso amarillo 'Esta sede NO tiene su propio origen de envío…'; guardar su ubicación y rangos y confirmar que el aviso desaparece y que un pedido de esa sede cotiza desde SU local.
- [ ] Apagar el interruptor 'Activo', guardar, y hacer un pedido de delivery: confirmar qué costo de envío queda registrado en Caja (con el envío por distancia apagado y sin zonas cargadas, queda en $0,00). Decidir con el dueño si ese es el comportamiento que quiere antes de entregar.

### Tasa de cambio y moneda

**Qué hace:** Decide con qué tasa se convierten a bolívares los precios en dólares que ve el cliente y los montos que cobra la caja: tasa oficial del BCV en dólar, tasa oficial en euro, o una tasa fija puesta por el negocio. Cada sucursal puede tener la suya.

- **Dónde:** `Pantalla: /local-santo/configuracion → 'Tasa y moneda' (y el símbolo $/€ en 'Colores y vista previa'); la tasa propia de cada sucursal en /local-santo/sucursales → 'Configuración por sede'. API: GET /api/exchange-rate (acepta ?branch= y el header x-branch-id); el servidor la vuelve a resolver al crear cada pedido (src/app/api/orders/route.ts:499-502).`
- **Quién entra:** Cambiar el modo y la tasa manual: dueño (y soporte) desde Configuración; la tasa propia de una sede: solo el dueño desde Sucursales. La consulta GET /api/exchange-rate es pública (la usa el carrito).
- **Ya cubierto por:** npm test → src/lib/__tests__/exchangeRateModeInput.test.ts (que el modo EURO no se pierda al guardar, caso BH-SIM-007), serverExchangeRate.test.ts (los tres modos, y que una tasa absurda o una fuente caída no tumben el pedido), bcvRates.test.ts, exchangeRateCache.test.ts y moneyPath.test.ts. Es el módulo mejor cubierto del grupo en pruebas de unidad; nada prueba la pantalla ni el carrito de verdad.
- **Ojo con:** 1) La tasa por sede pisa a la general y no se ve desde Configuración: alguien puede cobrar con una tasa que no sabe que está puesta. 2) El navegador del cliente cachea la tasa 5 minutos (src/hooks/useExchangeRate.ts:12): tras cambiarla, durante ese rato distintos clientes ven números distintos. 3) Si el modo es Manual pero la tasa no es válida, el sistema cae al dólar BCV sin avisar en pantalla. 4) Si el BCV no responde, se usa un respaldo local fijo (667,05) marcado como 'Fallback local': el negocio podría cobrar con una tasa vieja sin darse cuenta. 5) El símbolo €/$ es solo estético — si el dueño lo interpreta como 'ahora cobro en euros', se equivoca.

**Pruebas:**

- [ ] En Configuración → 'Tasa y moneda' elegir 'Tasa BCV (dólar)' y guardar; abrir el menú público y confirmar que la referencia en bolívares usa la tasa del BCV del día y que se identifica la fuente.
- [ ] Cambiar a 'Manual', escribir 123.45 en 'Tasa manual (Bs por dólar)' y guardar; abrir el menú público en VENTANA PRIVADA (el navegador cachea la tasa 5 minutos) y confirmar que un producto de $10,00 muestra Bs 1.234,50 y que se indica que es la tasa fijada por el negocio.
- [ ] Elegir 'Tasa BCV (euro)', guardar, salir de Configuración y volver a entrar: la opción debe seguir en euro (este era el error BH-SIM-007, donde el euro se guardaba como dólar en silencio).
- [ ] Con la tasa manual puesta, registrar y cobrar un pedido en Caja y confirmar que el monto en bolívares del cobro y del comprobante es total en dólares × 123,45 (y que el cliente ve el mismo número al reportar su pago).
- [ ] Fijar una tasa manual distinta SOLO en una sucursal (Sucursales → Configuración por sede) y confirmar que el menú público de esa sede calcula con esa tasa mientras la otra sede sigue con la general.
- [ ] En 'Colores y vista previa' → 'Moneda del sitio público' cambiar de $ a €, guardar y confirmar que la página pública muestra el símbolo € pero los montos y los bolívares NO cambian (es solo estético), y que el panel del personal sigue mostrando $.

---

---

# Anexo — lo que la lista de módulos NO cubría

Un agente crítico revisó el plan buscando huecos y encontró **30 cosas** que
no estaban en la lista de arriba: integraciones con terceros, impuestos, pagos con
tarjeta, cupones, trabajos de fondo y expectativas que pueden explotar el día de la
entrega. **Léelo completo antes de prometerle algo al cliente.**

### Pago en línea con tarjeta (Stripe)

**Qué es:** El cliente paga su pedido con tarjeta desde la web y el pedido se marca cobrado solo cuando la pasarela confirma.

- **Dónde:** `Páginas /pago, /pago/exito, /pago/cancelado (src/app/pago/page.tsx, exito, cancelado) · API POST /api/payments/checkout y POST /api/payments/webhook · src/lib/stripe.ts`
- **Quién entra:** Cliente público (sin clave). El webhook no lleva rol: se autentica con la firma de Stripe (src/app/api/payments/webhook/route.ts, stripe.webhooks.constructEvent).
- **Ya cubierto por:** ninguna (no hay test de vitest ni spec de Playwright que toque /api/payments/*; los scripts qa:* no lo mencionan)
- **Por qué importa:** Es la única ruta por donde entra dinero real de forma automática y nadie la nombró en la entrega. Sin STRIPE_WEBHOOK_SECRET el webhook responde 503 y el pedido se queda en 'pendiente de pago' aunque el cliente ya pagó. Hay historial de bugs aquí (el webhook antes escribía el TOTAL del pedido aunque el cobro fuera parcial, sin idempotencia ni sede).

**Pruebas:**

- [ ] Con STRIPE_SECRET_KEY vacío, pedir pagar en línea: debe responder 503 'Pagos en línea no están configurados en este negocio' y NO romper el checkout normal.
- [ ] Intentar iniciar el pago de un pedido ya anulado: debe dar 409 'Este pedido está anulado: no se puede pagar'.
- [ ] Con claves de prueba de Stripe, completar un pago y verificar que el pedido queda pagado por la vía oficial (updateOrderPayment) y con línea en Auditoría.
- [ ] Reenviar el mismo evento checkout.session.completed dos veces: el monto NO debe sumarse dos veces (idempotencia).
- [ ] Enviar al webhook un cuerpo con firma inválida: debe responder 400 'Firma inválida'.

### Cupones de descuento del cliente

**Qué es:** El cliente escribe un código en el carrito y se le descuenta un porcentaje del pedido.

- **Dónde:** `POST /api/public/coupons · src/lib/publicPageConfig.ts (findPublicCoupon) · se configuran en Configuración (publicCoupons)`
- **Quién entra:** Cliente público (sin clave); los códigos los crea el dueño en Configuración.
- **Ya cubierto por:** ninguna (no aparece en scripts/ ni en e2e/)
- **Por qué importa:** Toca directamente el total que se cobra. Si el descuento se aplica en el carrito pero el servidor recalcula distinto, el cierre de caja no cuadra y el dueño pierde plata sin darse cuenta. Nadie definió qué pasa si un cupón se usa en una cuenta abierta de mesa.

**Pruebas:**

- [ ] Crear un cupón en Configuración y aplicarlo en el carrito: el total debe bajar el porcentaje exacto y verse el descuento.
- [ ] Probar un código inventado: debe responder 404 'Cupón no válido o vencido' sin revelar la lista de códigos.
- [ ] Probar un cupón vencido: debe rechazarlo igual que uno inexistente.
- [ ] Escribir 16 códigos seguidos en un minuto: el intento 16 debe cortarse con el mensaje de 'Demasiados intentos de cupón' (rate limit).
- [ ] Cobrar en caja un pedido que usó cupón y confirmar que el cierre del día y Reportes cuadran con el monto DESCONTADO, no con el original.

### IVA e IGTF (desglose fiscal del ticket)

**Qué es:** Calcula el IVA por producto (16/8/0) y el IGTF sobre lo pagado en divisas, y arma el desglose que se ve en el carrito y en el ticket.

- **Dónde:** `src/lib/fiscal.ts · src/lib/ordersStoreFiscal.ts · src/components/FiscalBreakdown.tsx (usado en src/components/cartDrawerParts.tsx:462 y src/app/pedidos/page.tsx:44) · se configura en /local-santo/configuracion (ivaDefaultRate, igtfEnabled, igtfRate)`
- **Quién entra:** Cliente público lo ve en el carrito; el dueño configura las tasas (Configuración).
- **Ya cubierto por:** src/lib/__tests__/fiscal.test.ts (cálculo puro) y scripts/smoke.mjs cubre 'el desglose fiscal'; NADA prueba el desglose en pantalla ni la interacción con cobros mixtos
- **Por qué importa:** Es el módulo de impuestos y no está en la lista de entrega. El propio código aclara que la factura fiscal la emite una máquina SENIAT aparte (src/lib/fiscal.ts, encabezado): si el dueño cree que este sistema factura fiscalmente, la entrega arranca con una expectativa falsa. Un IGTF mal aplicado en pagos mixtos es plata y es SENIAT.

**Pruebas:**

- [ ] Poner un producto exento (0%) y otro al 16% en el mismo pedido y verificar que el desglose separa bien las bases.
- [ ] Cambiar 'precios incluyen IVA' a 'IVA aparte' y ver que el precio al público cambia coherentemente en el menú y en el carrito.
- [ ] Cobrar un pedido con pago mixto (parte en Bs, parte en divisas) y comprobar que el IGTF se aplica SOLO a la parte en divisas.
- [ ] Apagar el IGTF y confirmar que desaparece del ticket y del total.
- [ ] Imprimir el ticket 80 mm de ese pedido y verificar que el desglose impreso es idéntico al de pantalla.

### Anulación automática de pedidos sin pago reportado

**Qué es:** Un pedido de Pick up o Delivery que se queda en 'Nuevo' sin ningún comprobante reportado se anula solo al vencer el plazo, para que no ensucie la cocina ni los reportes.

- **Dónde:** `src/lib/unpaidAutoCancel.ts · se dispara desde GET /api/orders (src/app/api/orders/route.ts:52), GET /api/public/order-status y GET /api/public/order-payment · configurable en publicUnpaidAutoCancelMinutes`
- **Quién entra:** Automático (sin rol). Lo dispara el polling del panel del staff y la consulta del propio cliente.
- **Ya cubierto por:** ninguna (no hay script qa:* ni test que espere el vencimiento; la lógica de barrido tiene un intervalo de 45 s en el proceso)
- **Por qué importa:** Anula pedidos SOLO. Si el plazo queda mal puesto se le anulan ventas buenas al dueño; si el barrido no corre (nadie con el panel abierto), quedan pedidos zombis en 'Nuevo' que descuadran el cierre. Además revierte inventario: un error aquí infla el stock.

**Pruebas:**

- [ ] Poner el plazo en 1 minuto, crear un pedido Pick up y no reportar nada: al minuto el cliente debe ver el aviso con el motivo y el pedido salir de ACTIVOS.
- [ ] Crear otro pedido y reportar un comprobante PENDIENTE de revisión: NO debe auto-anularse (el reporte lo protege).
- [ ] Un pedido 'Comer aquí' (mesa) vencido NO debe auto-anularse.
- [ ] Cerrar la app del cliente y esperar: el barrido del panel debe anularlo igual (no debe quedarse activo por siempre).
- [ ] Verificar que la auto-anulación devuelve el inventario consumido y deja línea en Auditoría.
- [ ] Poner el plazo en 0 y confirmar que la función queda apagada.

### Aprobación de anulación con código de un solo uso del dueño

**Qué es:** Cuando un empleado quiere anular un pedido, el sistema genera un código que solo ve el dueño; el dueño lo dicta si está de acuerdo.

- **Dónde:** `GET /api/cancellation-requests (solo rol owner, src/app/api/cancellation-requests/route.ts:39) · src/components/local/OwnerCancellationCodes.tsx · src/lib/cancellationRequests.ts`
- **Quién entra:** Solo dueño ve y consume los códigos (verificado: access.role !== 'owner' devuelve 403). El empleado solo pide.
- **Ya cubierto por:** ninguna dedicada (scripts/sim/probar-anulaciones.mjs prueba la política del dinero, no el flujo del código)
- **Por qué importa:** Es el freno anti-robo del dueño (el empleado no puede borrar ventas solo). Si el código se puede reutilizar, si el push no llega o si otro rol puede leer la lista, el control es decorativo y el hueco de caja queda abierto.

**Pruebas:**

- [ ] Con la aprobación por código activada, pedir una anulación como cajero: NO debe poder anular sin el código.
- [ ] Verificar que el código aparece en el panel del dueño (y por push si VAPID está configurado).
- [ ] Usar el código: debe funcionar UNA vez y quedar inválido al segundo intento.
- [ ] Intentar leer /api/cancellation-requests con clave de cajero: debe dar 403.
- [ ] Anular con el código y revisar que Auditoría registre quién pidió y quién autorizó.

### Recordatorios de cuentas por pagar como notificación

**Qué es:** Avisa al dueño/encargado, aunque tenga la app cerrada, que hay facturas de proveedor por vencer o ya vencidas.

- **Dónde:** `src/lib/payablesReminderAlerts.ts · se dispara desde GET /api/orders (src/app/api/orders/route.ts:51) · configurable en payablesReminderDaysBefore`
- **Quién entra:** Notificación al personal suscrito (usa sendStaffAlertPush); la configuración es del dueño.
- **Ya cubierto por:** ninguna (los tests de proveedores/pagables cubren montos, no el aviso)
- **Por qué importa:** Depende de VAPID y del polling del panel: si el negocio cierra el panel, el dueño no se entera de una deuda vencida. Y como la marca anti-spam vive en audit_logs, si alguien limpia la bitácora se puede disparar una tormenta de avisos.

**Pruebas:**

- [ ] Registrar una compra a crédito con vencimiento dentro de la ventana configurada y confirmar que llega el aviso al dispositivo suscrito.
- [ ] Verificar el anti-spam: no debe repetirse el mismo aviso antes de 24 h por sede.
- [ ] Pagar una de las facturas y confirmar que el próximo aviso ya no la lista.
- [ ] Con VAPID sin configurar, confirmar que NO se cae nada (degrada en silencio).
- [ ] Revisar que la marca del aviso quedó en audit_logs (es donde se guarda para no repetir).

### Encuestas: panel de resultados

**Qué es:** El dueño ve las respuestas de la encuesta post-venta y puede disparar el envío a mano.

- **Dónde:** `/local-santo/encuestas (src/app/local-santo/encuestas/page.tsx) · API /api/surveys (GET owner/manager/support; POST owner/manager/cashier/promoter/support; acción de despacho solo owner/support)`
- **Quién entra:** Verificado en src/app/api/surveys/route.ts:48, 85 y 94 (owner, manager, cashier, promoter, support según la acción).
- **Ya cubierto por:** ninguna sobre la pantalla (hay lógica probada en src/lib/surveys y surveyButtons, no el panel)
- **Por qué importa:** El módulo comparte la llave de permiso 'ownerDashboard' con el tablero del Dueño (src/components/LocalModuleNav.tsx:49 y 54, con comentario propio avisando del duplicado): quitarle el tablero a alguien le quita las encuestas y al revés. Nadie definió el comportamiento con respuestas repetidas.

**Pruebas:**

- [ ] Contestar la encuesta desde /encuesta/<pedido> y verla aparecer en el panel con el pedido correcto.
- [ ] Entrar al panel con clave de cocina: no debe poder ver las respuestas.
- [ ] Usar el botón de despacho manual con clave de manager: debe rechazarlo (solo owner/support).
- [ ] Comprobar que el aspecto evaluado coincide con los aspectos configurados (getConfiguredSurveyAspects).
- [ ] Contestar dos veces el mismo pedido y ver cómo lo maneja (¿duplica o reemplaza?).

### Diagnóstico de entrega / 'listo para producción' (Soporte)

**Qué es:** Revisa de un golpe si el entorno está bien puesto (Supabase, claves por rol, seguridad, cargas, pagos, monitoreo, dominio) y qué falta antes de entregar.

- **Dónde:** `src/lib/deploymentReadiness.ts · GET /api/local-support/status (rol support, src/app/api/local-support/status/route.ts:149) · /local-santo/soporte`
- **Quién entra:** Rol support (proveedor). Verificado: checkRole(request, ['support']).
- **Ya cubierto por:** src/lib/__tests__/deploymentReadiness.test.ts (lógica pura). NADIE lo corre contra el entorno real de producción
- **Por qué importa:** Es la lista de chequeo de entrega que el propio sistema ya trae y no está en el plan. Ya pasó antes que producción corriera SIN Supabase configurado y nadie lo notó; este diagnóstico existe justo para eso, pero si no se ejecuta contra el entorno real no sirve de nada.

**Pruebas:**

- [ ] Entrar a Soporte con la clave de support EN PRODUCCIÓN y capturar el resultado del diagnóstico completo.
- [ ] Confirmar que ninguna comprobación queda en 'error' antes de entregar (y anotar las 'warning' que se aceptan a conciencia).
- [ ] Verificar que NO muestra valores de secretos, solo si están puestos o no.
- [ ] Entrar con clave de dueño: no debe poder abrir el diagnóstico.
- [ ] Contrastar el grupo 'payments' con la decisión real del cliente (si no usa Stripe, dejarlo documentado como apagado a propósito).

### Planes por módulo, tipo de negocio y complejidad

**Qué es:** Define qué módulos existen según el plan contratado y aplica de un golpe los ajustes recomendados según el tipo de negocio.

- **Dónde:** `src/lib/localPlans.ts (56 llaves de módulo, 5 planes) · src/lib/businessTypes.ts (presets por rubro) · src/lib/businessComplexity.ts · se maneja en /local-santo/configuracion y /local-santo/soporte`
- **Quién entra:** Dueño (activa/desactiva lo de su plan) y support (define el plan).
- **Ya cubierto por:** src/lib/__tests__/localPlans.test.ts, businessTypes.test.ts y businessComplexity.test.ts (lógica); ningún recorrido en vivo
- **Por qué importa:** Se le puede prometer al cliente un módulo que su plan apaga, o al contrario dejarle habilitado algo que no pagó. Y 'serviceChargeTips' (Propina y servicio) está declarado con comingSoon: true en src/lib/localPlans.ts: aparece en la lista de módulos pero NO existe funcionalmente — es exactamente la clase de promesa que revienta en la entrega.

**Pruebas:**

- [ ] Aplicar el preset 'Restaurante' y verificar que la navegación queda exactamente con los módulos esperados y sin pisar el resto de la configuración.
- [ ] Bajar el plan a uno inferior y comprobar que los módulos por encima del plan dejan de abrirse (no solo de verse).
- [ ] Entrar directo por URL a un módulo que el plan NO incluye: debe bloquear, no cargar.
- [ ] Confirmar con el cliente cuál es su plan real y dejarlo asentado por escrito.
- [ ] Revisar qué módulos quedan marcados 'comingSoon' y avisarle al dueño que están apagados a propósito.

### Propina y cargo por servicio

**Qué es:** Debería permitir propina sugerida, propina personalizada y un cargo de servicio configurable.

- **Dónde:** `src/lib/localPlans.ts, módulo 'serviceChargeTips' (comingSoon: true, ownerConfigKey serviceChargeTipsModuleEnabled)`
- **Quién entra:** Sería del dueño (configuración) y de caja (cobro).
- **Ya cubierto por:** ninguna
- **Por qué importa:** Está listado como módulo pero el propio código lo marca 'comingSoon'. Un restaurante que cobra servicio o reparte propina va a asumir que está incluido; descubrirlo el día de la entrega es una discusión de plata con el cliente.

**Pruebas:**

- [ ] Activar el módulo en Configuración y verificar qué pasa realmente en el carrito y en caja (según el código: nada).
- [ ] Confirmar por escrito con el dueño que la propina NO va en esta entrega.
- [ ] Si el negocio cobra 10% de servicio hoy, definir cómo lo va a cobrar mientras esto no exista.
- [ ] Revisar que el interruptor apagado no deje textos de propina visibles al cliente.

### Promoción visible, popup y productos destacados

**Qué es:** El dueño pone una promoción y unos destacados en la página pública para empujar ventas, sin tocar código.

- **Dónde:** `src/components/PublicPromotion.tsx, PublicPromotionPopup.tsx, FeaturedProducts.tsx · módulos 'promotions' y 'featuredProducts' en src/lib/localPlans.ts (promotionModuleEnabled, featuredProductsModuleEnabled)`
- **Quién entra:** Dueño lo edita en Configuración; el cliente lo ve.
- **Ya cubierto por:** ninguna
- **Por qué importa:** Es la palanca de ventas que el dueño usa solo y a diario. Un popup que no se cierra o que tapa el carrito en teléfono mata pedidos, y ya hubo problemas de desborde a 375 px en este proyecto.

**Pruebas:**

- [ ] Escribir una promoción, guardar y verla en la página pública en menos de un refresh.
- [ ] Verificar que el popup aparece una vez y se puede cerrar (que no vuelva a saltar en cada scroll).
- [ ] Apagar el módulo de promociones y confirmar que desaparece por completo del sitio.
- [ ] Marcar 3 destacados y confirmar que salen los correctos y con su imagen.
- [ ] Revisar la promoción en teléfono (375 px): que no tape el botón del carrito.

### Editor visual y configuración pública avanzada

**Qué es:** El dueño cambia colores, textos, horarios, ubicación y secciones de su página sin depender del desarrollador.

- **Dónde:** `Módulos 'visualEditor' y 'advancedPublicConfig' en src/lib/localPlans.ts · /local-santo/configuracion (colores, tarjetas, botones, vista previa, títulos, textos, horarios, ubicación, reseñas, secciones)`
- **Quién entra:** Dueño y support.
- **Ya cubierto por:** parcial: src/lib/__tests__/theme.test.ts y businessConfigFields.test.ts prueban la normalización, no la pantalla
- **Por qué importa:** Es la puerta por la que el dueño puede desfigurar su propio sitio (o dejarlo ilegible) sin ayuda. Suma el riesgo conocido de caché del service worker: cambia la config y el cliente sigue viendo lo viejo, que ya fue un problema real en este proyecto.

**Pruebas:**

- [ ] Cambiar el color primario y verificar que se aplica en la página pública, en el carrito y en el ticket sin romper el contraste del texto.
- [ ] Editar horarios y ver que el sitio refleje 'abierto/cerrado' correctamente.
- [ ] Guardar un texto con emojis y comillas y verificar que no rompe la página.
- [ ] Apagar una sección pública y confirmar que desaparece y no deja un hueco en el layout.
- [ ] Hacer un cambio y confirmar que el cliente lo ve sin tener que borrar la caché de la PWA.

### Canales de venta y disponibilidad por producto

**Qué es:** Decidir por producto si aplica a Comer aquí, Para llevar o Delivery, y pausar un producto cuando se acaba.

- **Dónde:** `Módulos 'salesChannels' y 'productAvailability' en src/lib/localPlans.ts (routePath /local-santo/menu) · /local-santo/menu-avanzado`
- **Quién entra:** Dueño / encargado en el editor de menú.
- **Ya cubierto por:** parcial (src/lib/__tests__/publicProductsResponse.test.ts y publicBranchMenu.test.ts tocan el filtrado público)
- **Por qué importa:** Aquí ya hubo bugs (el commit 41c3eca arregló que el cartel 'Disponible: ...' saliera cuando el producto sí aplicaba). Si un producto pausado se puede pedir igual, la cocina recibe algo que no tiene y el cliente ya pagó.

**Pruebas:**

- [ ] Marcar un producto SOLO para Comer aquí y verificar que no aparece al pedir Delivery.
- [ ] Pausar un producto y confirmar que sale como no disponible en el menú público y que no se puede agregar al carrito.
- [ ] Con un producto pausado dentro del carrito guardado del cliente, intentar enviar el pedido: debe bloquear con mensaje claro, no crear el pedido.
- [ ] Verificar que el cartel 'Disponible: ...' solo aparece cuando el producto NO aplica al tipo de pedido elegido.
- [ ] Repetir en la segunda sede para confirmar que el filtro respeta la sede.

### Separar la cuenta entre varias personas

**Qué es:** Dividir el total de una cuenta de mesa en partes iguales o montos personalizados y cobrar parte por parte.

- **Dónde:** `Módulo 'splitBill' en src/lib/localPlans.ts (splitBillModuleEnabled, minimumPlan complete, comingSoon: false) · se usa en el cobro de la cuenta (src/components/local/OpenAccountsPanel.tsx)`
- **Quién entra:** Caja y mesonero (según los permisos del módulo de cuentas abiertas).
- **Ya cubierto por:** parcial: scripts/qa-open-accounts-attack.mjs y qa:cobros-origen cubren cuentas y cobros, pero la lista de entrega solo dice 'separar' de pasada
- **Por qué importa:** Es la operación que más rompe la aritmética del dinero (redondeo de centavos entre 3 personas, pedidos que entran después del reparto). Está declarado como módulo activo, así que el cliente lo va a usar el primer viernes.

**Pruebas:**

- [ ] Cuenta de 4 pedidos: dividir en 3 partes iguales y cobrar las 3 con métodos distintos; el total cobrado debe dar exactamente el total de la cuenta (sin centavo perdido).
- [ ] Dividir con montos personalizados que NO sumen el total: debe rechazar o avisar, nunca cerrar la cuenta a medias.
- [ ] Cobrar la primera parte y dejar la segunda pendiente: la cuenta debe seguir abierta y mostrar el saldo real.
- [ ] Agregar un pedido nuevo a una cuenta ya dividida y ver qué pasa con el reparto.
- [ ] Cerrar el día con una cuenta separada a medio cobrar y revisar que el cierre lo refleje sin descuadrar.

### Sonidos operativos del panel

**Qué es:** Que caja, cocina y delivery escuchen el pedido nuevo, el envío a cocina, el 'listo' y las anulaciones sin estar mirando la pantalla.

- **Dónde:** `src/hooks/useOperationalSounds.ts · src/app/pedidos/usePanelSound.ts · módulo 'sounds' en src/lib/localPlans.ts`
- **Quién entra:** Contextos verificados en el hook: cashier, kitchen, delivery.
- **Ya cubierto por:** ninguna (no se puede probar audio en los specs actuales)
- **Por qué importa:** Es el único aviso de la cocina en la práctica. Los navegadores móviles bloquean el audio sin interacción del usuario y las tablets duermen las pestañas: si falla, los pedidos se enfrían y nadie se enteró. No hay ni un test que lo cubra.

**Pruebas:**

- [ ] Con el panel de cocina abierto y sin tocar nada, crear un pedido desde el teléfono: debe sonar.
- [ ] Verificar que cada evento suena distinto (nuevo, a cocina, listo, anulado, comprobante).
- [ ] Silenciar y confirmar que no suena, y que la preferencia sobrevive al refresco de la tablet.
- [ ] En la tablet real del local (no en el escritorio del desarrollador) confirmar que el navegador permite el audio sin un clic previo.
- [ ] Dejar el panel 30 minutos abierto y confirmar que sigue sonando (que no se duerma la pestaña).

### Cola de pedidos sin internet del POS (IndexedDB) e idempotencia

**Qué es:** Si se cae el internet mientras se registra un pedido, se guarda en el equipo y se reintenta al reconectar, sin duplicar la venta.

- **Dónde:** `src/lib/offlineQueue.ts (IndexedDB 'santo_offline') · src/components/OfflineSync.tsx · migración supabase/migrations/0018_order_idempotency.sql · script npm run e2e:order-idempotency`
- **Quién entra:** Personal que registra pedidos (caja, mesonero).
- **Ya cubierto por:** npm run e2e:order-idempotency (scripts/order-idempotency-e2e.mjs) para la no duplicación en el servidor; la cola en IndexedDB solo tiene tests con almacenamiento en memoria
- **Por qué importa:** La lista de entrega solo menciona el 'sin internet' del CLIENTE (PWA); esto es el del POS y es distinto. Un fallo aquí es la peor falla posible: venta perdida o venta duplicada con inventario descontado dos veces. El internet del local es justo la variable que no controlamos.

**Pruebas:**

- [ ] Cortar el WiFi de la tablet, registrar 2 pedidos, reconectar y verificar que entran los 2 y ninguno duplicado.
- [ ] Repetir con reintentos forzados (misma clave de idempotencia varias veces): debe crearse UN solo pedido.
- [ ] Cerrar y reabrir el navegador con pedidos en la cola: deben seguir ahí (IndexedDB) y sincronizar.
- [ ] Verificar que el pedido encolado se numera correctamente por sede al sincronizar (#N-sede).
- [ ] Confirmar que el inventario se descuenta UNA vez cuando el pedido encolado finalmente entra.

### Comprobantes en almacenamiento privado con enlace firmado y RLS

**Qué es:** Que la captura del pago de un cliente (con su banco y su nombre) no quede en una URL pública adivinable, y que la base tenga RLS activo.

- **Dónde:** `src/lib/ordersPaymentProofs.ts:55 y :74 (createSignedUrl / createSignedUrls, bucket 'payment-proofs') · src/lib/ordersMenu.ts:351 (bucket público 'menu-images') · migraciones 0032_security_rls_and_private_proofs.sql y 0034_supplier_purchase_payments_rls.sql`
- **Quién entra:** Caja/dueño ven los comprobantes con enlace temporal; nadie de fuera debe poder abrirlos.
- **Ya cubierto por:** src/lib/__tests__/rlsEnabled.fitness.test.ts (verifica que se declaró RLS en los .sql, NO que esté aplicado en la base real)
- **Por qué importa:** Datos bancarios de clientes reales. El fitness test compara código contra archivos .sql: pasa en verde aunque nadie haya aplicado la migración en la base. Ya pasó en este proyecto que una columna 'existía' en el código y nunca en la base (orders.payment_method, 500 silenciosos).

**Pruebas:**

- [ ] Copiar la URL firmada de un comprobante, esperar a que expire y volver a abrirla: debe fallar.
- [ ] Intentar abrir el archivo del comprobante por su ruta directa en el bucket, sin firma: debe dar error de acceso.
- [ ] Confirmar EN SUPABASE que los buckets 'payment-proofs' (privado) y 'menu-images' (público) existen con esa visibilidad exacta.
- [ ] Confirmar en Supabase que RLS está ACTIVO en las tablas de las migraciones 0032 y 0034 (no solo escrito en el .sql).
- [ ] Correr npm run qa:migraciones contra la base de producción y guardar la salida.

### Frenos anti-abuso: rate limit, guardas de origen y tamaño, cabeceras

**Qué es:** Evitar que cualquiera desde fuera inunde el sistema de pedidos, comprobantes o intentos de clave, o suba archivos enormes.

- **Dónde:** `src/lib/rateLimit.ts, apiMutationGuards.ts, apiReadGuards.ts, requestGuards.ts, securityHeaders.ts, securityEvents.ts · configurado con RATE_LIMIT_MAX_KEYS, ALLOWED_API_ORIGINS y los *_MAX_BYTES de .env.example`
- **Quién entra:** Transversal, sin rol: protege todas las rutas mutantes públicas y privadas.
- **Ya cubierto por:** src/lib/__tests__/securityHeaders.test.ts y requestBillRateLimit.test.ts (unitarios); ningún ataque real en la entrega
- **Por qué importa:** El propio .env.example advierte que el rate limit es EN MEMORIA y en serverless no es perfecto entre instancias. Si ALLOWED_API_ORIGINS queda mal al mover el dominio, el checkout del cliente empieza a rebotar en producción y parece 'la app está caída'.

**Pruebas:**

- [ ] Disparar 30 pedidos públicos seguidos desde el mismo dispositivo y verificar que corta con mensaje claro (no con 500).
- [ ] Subir una imagen de comprobante más grande que PAYMENT_PROOF_IMAGE_MAX_BYTES: debe rechazarla con un mensaje entendible por el cliente.
- [ ] Subir un archivo que no sea JPG/PNG/WEBP renombrado a .jpg: debe rechazarlo.
- [ ] Llamar a una ruta mutante desde otro origen (curl sin Origin válido) y verificar el bloqueo; luego confirmar que el dominio real del cliente SÍ pasa.
- [ ] Confirmar que ALLOWED_API_ORIGINS incluye el dominio definitivo del cliente antes de entregar.

### Traslado de inventario para eventos (segunda ruta, sin bitácora)

**Qué es:** Surtir una sede de evento/feria desde la sede principal y devolver el sobrante al terminar ('in' / 'out', o 'all' para mover todo).

- **Dónde:** `POST /api/branches/[id]/inventory-transfer (src/app/api/branches/[id]/inventory-transfer/route.ts) vs POST /api/inventory/transfer (src/app/api/inventory/transfer/route.ts)`
- **Quién entra:** Solo dueño en la ruta de sedes (verificado: access.role !== 'owner' → 403).
- **Ya cubierto por:** parcial: qa:isolation y qa:inventory-deduct tocan inventario y sedes, pero ningún script llama a /api/branches/[id]/inventory-transfer
- **Por qué importa:** Dos caminos distintos para la misma operación y solo uno queda registrado: /api/inventory/transfer valida el módulo y escribe en la bitácora, la de /api/branches/[id]/ solo pide rol dueño y no escribe auditoría. Mover TODO el stock con 'all' sin dejar rastro es un agujero de inventario, y con la clave compartida de dueño no se sabe quién lo hizo.

**Pruebas:**

- [ ] Enviar stock con direction 'in' e items 'all' a la sede de evento y verificar que la sede origen quedó exactamente en cero de esos insumos.
- [ ] Devolver con 'out' al cerrar el evento y confirmar que los totales cierran sin insumos perdidos ni duplicados.
- [ ] Buscar ese traslado en Auditoría: hoy NO aparece (esta ruta no llama a writeAuditLog, la otra sí).
- [ ] Llamar la ruta con clave de encargado: debe dar 403.
- [ ] Comparar el resultado de mover el mismo insumo por las DOS rutas y ver si dejan el mismo rastro y el mismo movimiento de inventario.

### Resúmenes por sede (operación y eventos)

**Qué es:** Contar de un golpe lo que tiene cada sede (pedidos, cuentas, cierres, gastos, productos, inventario, movimientos, recetas, proveedores, compras, comprobantes) y comparar eventos.

- **Dónde:** `GET /api/branches/operations-summary y GET /api/branches/events-summary`
- **Quién entra:** Se resuelve con getRequestAccess; no verifiqué restricción de rol explícita en operations-summary.
- **Ya cubierto por:** ninguna directa
- **Por qué importa:** Es la vista con la que el dueño decide si una sede o un evento le sirve. Al ser un conteo transversal sobre 11 tablas es exactamente el tipo de endpoint que se salta el filtro por sede o la restricción de rol, que es justo el hueco que ya reportaron los auditores de acceso.

**Pruebas:**

- [ ] Abrir Sucursales y comparar los conteos con lo que muestra cada módulo de esa sede (deben cuadrar).
- [ ] Cambiar de sede y confirmar que los números cambian (no está mostrando el consolidado disfrazado de sede).
- [ ] Llamar el endpoint con clave de un rol bajo (cocina) y ver si devuelve datos que no le tocan.
- [ ] Con una sede de evento cerrada, verificar que events-summary la incluye con su neto correcto.

### Exportar a Excel, PDF y CSV

**Qué es:** Que el dueño y su contador se lleven los cierres, reportes y ventas por vendedor a un archivo.

- **Dónde:** `Dependencias xlsx, jspdf y jspdf-autotable (package.json) · src/lib/csv.ts · src/app/local-santo/cierres/exportRich.ts`
- **Quién entra:** Dueño y encargado (según el módulo desde donde se exporta).
- **Ya cubierto por:** ninguna sobre el archivo generado
- **Por qué importa:** Es lo que el dueño manda al contador: un decimal mal formateado o una columna que se cae en el PDF se convierte en un problema fiscal, y nadie va a revisar el archivo si no se abre en la entrega.

**Pruebas:**

- [ ] Exportar un cierre a Excel y ABRIR el archivo: montos, fechas y decimales correctos (no texto, no fechas corridas).
- [ ] Exportar el PDF del cierre y verificar que la tabla no se corta ni pierde filas.
- [ ] Exportar con acentos y ñ en nombres de producto y confirmar que no salen caracteres raros.
- [ ] Exportar un día con cero ventas: no debe generar un archivo roto.
- [ ] Exportar el reporte de ventas por vendedor y cruzarlo a mano con el panel.

### SEO, páginas de diseño públicas y archivos de otro cliente

**Qué es:** Controlar qué ve Google del sitio del cliente. robots.ts bloquea /local-santo, /acceso, /api/, /pago, /pedidos y /pedido/.

- **Dónde:** `src/app/robots.ts, src/app/sitemap.ts · páginas /previa, /previa/idea-3, /previa/idea-4, /previa/idea-5 · carpeta public/ (Santoperrito.png, Santocachon.png, logo-santo-perrito.png, logo-bambucha.png, public/previa/)`
- **Quién entra:** Público (cualquiera en internet).
- **Ya cubierto por:** ninguna
- **Por qué importa:** Un cliente entrando por casualidad a /previa/idea-5 ve borradores de diseño internos; peor, encontrar los logos de Santo Perrito y Bambucha en su propio dominio le dice que su sistema es una plantilla compartida. Es un daño comercial, no técnico, y no cuesta nada cerrarlo.

**Pruebas:**

- [ ] Abrir /previa en el dominio del cliente sin ninguna clave: hoy carga, y robots.ts NO la bloquea (solo bloquea /local-santo, /acceso, /api/, /pago, /pedidos, /pedido/).
- [ ] Abrir /brotherhood-logo.png y también /Santoperrito.png y /logo-bambucha.png: los logos de OTROS clientes están servidos en el mismo dominio.
- [ ] Abrir /sitemap.xml y confirmar que solo lista páginas que existen y están activas (con Reservas apagado, /reservar no debe aparecer).
- [ ] Buscar el sitio en Google con site:<dominio> después de publicar y verificar que no indexó el panel ni las páginas de prueba.
- [ ] Confirmar que el manifest dice el nombre del negocio correcto (hoy: 'Brotherhood').

### Integración: WhatsApp Business de Meta (encuesta con botones y Flow)

**Qué es:** Mandar la encuesta post-venta dentro del chat de WhatsApp (botones o formulario) y recibir la respuesta por el webhook, sin que el cliente abra ningún link.

- **Dónde:** `src/lib/whatsappBusiness.ts, surveyAutoSend.ts, surveyButtons.ts, surveyFlow.ts · GET/POST /api/whatsapp/webhook · env WHATSAPP_BUSINESS_TOKEN, WHATSAPP_BUSINESS_PHONE_ID, WHATSAPP_SURVEY_FLOW_TEMPLATE, WHATSAPP_SURVEY_BUTTON_TEMPLATE, WHATSAPP_WEBHOOK_VERIFY_TOKEN, WHATSAPP_APP_SECRET`
- **Quién entra:** Automático más disparo manual (owner/support en /api/surveys).
- **Ya cubierto por:** src/lib/__tests__ cubre el parseo de respuestas (surveyButtons, surveyFlow); NADA prueba contra Meta de verdad
- **Por qué importa:** BLOQUEO EXTERNO — depende del CLIENTE: hace falta la verificación del negocio en Meta, las plantillas aprobadas y el Flow publicado (según el estado del montaje, el Flow está en borrador y falta la verificación). El desarrollador NO puede cerrarlo. Ojo con el fail-open: si WHATSAPP_APP_SECRET queda vacío, el webhook acepta cualquier cuerpo sin validar firma (src/app/api/whatsapp/webhook/route.ts, 'sin secreto no hay validación posible').

**Pruebas:**

- [ ] Hacer el handshake real de Meta contra /api/whatsapp/webhook y confirmar que devuelve el hub.challenge (hoy responde 403 si el verify token no coincide).
- [ ] Mandar la encuesta a un número real y contestarla con un toque; verificar que la respuesta aparece en /local-santo/encuestas.
- [ ] Mandar al webhook un cuerpo con firma X-Hub-Signature-256 inválida: debe rechazarlo.
- [ ] Con todas las variables de WhatsApp vacías, confirmar que el envío automático queda apagado y NO rompe el panel ni el pedido.
- [ ] Verificar el agradecimiento automático dentro de la ventana de 24 h.

### Integración: avisos push VAPID (personal y cliente)

**Qué es:** Avisar al personal de anulaciones, reposición y cuentas por pagar, y al cliente cuando su pedido está listo, aunque tengan la app cerrada.

- **Dónde:** `src/lib/orderPushNotifications.ts (env VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT) · /api/staff/alerts-push · /api/public/push · migración 0023_push_subscriptions.sql · src/hooks/useStaffAlertsPush.ts`
- **Quién entra:** Personal suscrito (según módulo) y cliente público.
- **Ya cubierto por:** scripts/sim/probar-push.mjs (receptor propio RFC 8291); no prueba iPhone ni el navegador real del dueño
- **Por qué importa:** VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT NO están documentadas en .env.example (grep vacío): un despliegue nuevo se va sin push y en silencio, porque el código degrada sin avisar. Y si alguien genera claves nuevas, todos los teléfonos ya suscritos dejan de recibir sin ningún error visible. LO CIERRA EL DESARROLLADOR (documentar y verificar), salvo la parte de iPhone/Safari, que depende del dueño.

**Pruebas:**

- [ ] Suscribir el teléfono del dueño y anular un pedido: el aviso debe llegar con la app CERRADA.
- [ ] En iPhone: agregar a inicio DESDE SAFARI (no Chrome) y confirmar que llega; si el dueño usa Chrome, documentar que no va a recibir nada.
- [ ] Confirmar en el entorno de producción que VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY están puestas y son las MISMAS de siempre (cambiarlas invalida todas las suscripciones existentes).
- [ ] Con VAPID vacío, confirmar que todo degrada en silencio y nada se cae.
- [ ] Avisar 'pedido listo' a un cliente y confirmar que el aviso llega con el número de pedido correcto.

### Integración: tasa oficial BCV / DolarApi

**Qué es:** Traer la tasa oficial para mostrar precios en Bs al cliente y cobrar en bolívares.

- **Dónde:** `GET /api/exchange-rate (BCV_EXCHANGE_URL = bcv.org.ve, DOLAR_API_USD_URL = ve.dolarapi.com) · src/lib/bcvRates.ts, exchangeRateCache.ts · FALLBACK_USD_RATE = 667.05, FALLBACK_EUR_RATE = 774.0`
- **Quién entra:** Público (la tasa se muestra en el menú) y dueño (modo de tasa por sede).
- **Ya cubierto por:** src/lib/__tests__/bcvRates.test.ts y serverExchangeRate.test.ts (parseo con HTML de ejemplo) · scripts/sim/probar-tasa.mjs
- **Por qué importa:** Depende de que bcv.org.ve siga sirviendo el mismo HTML: es scraping (el código incluso usa rejectUnauthorized: false por el certificado del BCV). El día que cambien la página, el negocio empieza a cobrar con una tasa fija de 667,05 sin que nadie lo note, y cada pedido en Bs sale mal. No lo cierra ni el desarrollador ni el cliente: hay que MONITOREARLO.

**Pruebas:**

- [ ] Consultar /api/exchange-rate en producción y confirmar que la tasa y la fecha de valor coinciden con bcv.org.ve HOY.
- [ ] Simular la caída del BCV y verificar que cae a DolarApi, y luego a la caché.
- [ ] Verificar qué se le muestra al cliente cuando se usa el respaldo fijo (667,05): debe quedar clarísimo que es una tasa de respaldo, no la del día.
- [ ] Poner una tasa manual por sede y confirmar que gana sobre la automática en el menú, el carrito y el cobro en Bs.
- [ ] Cobrar en Bs y revisar que el cierre del día use la MISMA tasa del cobro, no la de ahora.

### Integración: mapa de delivery y links de Google Maps

**Qué es:** Que el cliente marque su punto en el mapa y el sistema calcule el cobro por kilómetro; el delivery abre la ruta.

- **Dónde:** `src/components/DeliveryMapPicker.tsx:50 (tiles de tile.openstreetmap.org) · DeliveryPointPreviewMap.tsx · src/lib/deliveryDistanceServer.ts (expande maps.app.goo.gl) · /api/delivery-distance, /api/public/delivery-quote`
- **Quién entra:** Cliente público marca el punto; delivery y caja lo usan.
- **Ya cubierto por:** src/lib/__tests__ cubre el cálculo puro de distancia; nada prueba los tiles ni la expansión del link
- **Por qué importa:** Los tiles vienen de OpenStreetMap (servidor de terceros, con política de uso justo para producción) y la expansión de links depende de que Google siga redirigiendo igual. Si el mapa no carga en el teléfono del cliente, el delivery no se puede pedir: es una pantalla de venta bloqueada por un tercero gratuito. LO REVISA EL DESARROLLADOR, pero el servicio es de terceros.

**Pruebas:**

- [ ] En un teléfono con datos móviles reales (no WiFi de oficina) abrir el mapa y confirmar que los tiles cargan y el pin se puede mover.
- [ ] Pegar un link corto maps.app.goo.gl y confirmar que se expande y saca coordenadas (hay timeout de 6 s).
- [ ] Pegar un link de Maps que NO sea de un host conocido y confirmar que se rechaza.
- [ ] Cotizar un delivery a 3 km y a 12 km y verificar que el monto por kilómetro cuadra con lo configurado.
- [ ] Desde el módulo Delivery, abrir la ruta del pedido y confirmar que cae en la dirección correcta.

### Integración: impresión térmica 80 mm real

**Qué es:** Sacar la comanda para la cocina al enviar el pedido y el recibo de 80 mm cuando se marca Listo.

- **Dónde:** `/local-santo/tickets (src/app/local-santo/tickets/page.tsx: window.print() en :841 y :941, @media print con width 80mm en :973) · modo de impresión none/auto en src/lib/businessConfigFields.ts:123 y configuracion/page.tsx:3580`
- **Quién entra:** Caja y cocina.
- **Ya cubierto por:** ninguna (window.print no se puede probar en los specs actuales)
- **Por qué importa:** BLOQUEO EXTERNO — depende del CLIENTE: hace falta la impresora térmica física, su driver y el navegador de la tablet configurado para imprimir sin diálogo. Se imprime con window.print del navegador, así que el resultado depende del equipo del local; imposible certificarlo desde el código. Si sale mal el día 1, la cocina trabaja a gritos.

**Pruebas:**

- [ ] Imprimir un ticket en la impresora térmica REAL del local y medir que no se corte por los lados (80 mm).
- [ ] Poner el modo 'auto' y verificar que la comanda sale sola al enviar a cocina y el recibo al marcar Listo, sin diálogo de impresión en cada pedido.
- [ ] Poner el modo 'none' y confirmar que no se imprime nada.
- [ ] Imprimir un ticket con desglose de IVA/IGTF, propina no, cupón y pago mixto: todo debe caber y ser legible.
- [ ] Imprimir un pedido con nombres largos y muchos adicionales y revisar que no se corten los renglones.

### Integración: respaldo y restauración de la base

**Qué es:** Tener una copia de la base del cliente y poder devolverla si algo se rompe.

- **Dónde:** `npm run backup (scripts/backup.mjs) y npm run restore (scripts/restore.mjs) · requieren SUPABASE_SERVICE_ROLE_KEY de .env.local`
- **Quién entra:** Proveedor/desarrollador (no hay pantalla en el panel).
- **Ya cubierto por:** están como scripts npm, pero no los corre ningún CI (.github/workflows/ci.yml solo hace tsc, lint, test y build)
- **Por qué importa:** Un respaldo que nunca se restauró no es un respaldo. Es manual: si el desarrollador no lo corre, no existe. Y como la restauración usa la service_role key, un error apunta al proyecto equivocado y pisa datos reales (ya pasó algo parecido con el dev server del puerto 3000 escribiéndole a la app de OTRO cliente).

**Pruebas:**

- [ ] Correr npm run backup contra la base de producción del cliente y guardar el archivo fuera de la máquina del desarrollador.
- [ ] Restaurar ese respaldo en un proyecto Supabase VACÍO de prueba y confirmar que la app arranca y muestra los datos.
- [ ] Contar pedidos, cuentas y cierres antes y después de la restauración (ojo con la paginación de 1000 filas de Supabase, que ya engañó una verificación en este proyecto).
- [ ] Definir por escrito CADA CUÁNTO se hace el respaldo y QUIÉN lo hace (hoy es manual, no hay cron).
- [ ] Confirmar que el archivo de respaldo no queda dentro del repo ni se sube al despliegue.

### Los trabajos de fondo no tienen cron: viven del polling del panel

**Qué es:** Encuesta automática, auto-anulación de impagos, alertas de reposición y recordatorios de cuentas por pagar: los cuatro corren 'de gratis' cuando alguien del staff tiene el panel abierto y hace polling.

- **Dónde:** `src/app/api/orders/route.ts:50-52 y :242 disparan maybeDispatchRestockAlerts, maybeDispatchPayablesReminders, maybeAutoCancelStaleUnpaidOrders y maybeDispatchPostSaleSurveys · NO existe vercel.json (sin crons)`
- **Quién entra:** Automático, sin rol.
- **Ya cubierto por:** ninguna que valide el disparo en el tiempo (cada módulo tiene su intervalo interno: 2 min encuestas, 45 s barrido de impagos, 10 min reposición y pagables)
- **Por qué importa:** En Vercel el proceso muere entre peticiones: los intervalos en memoria (RUN_INTERVAL_MS, lastRunAt) no son garantía de nada, y sin panel abierto no corre nada. Un lunes cerrado significa encuestas que nunca salen y pedidos impagos vivos que descuadran el cierre. Es una decisión de arquitectura que hay que aceptar por escrito o resolver con un cron.

**Pruebas:**

- [ ] Cerrar TODOS los paneles del staff 30 minutos y verificar qué NO pasó: encuestas sin enviar, impagos sin anular, alertas sin salir.
- [ ] Confirmar que no hay vercel.json con crons en el proyecto desplegado.
- [ ] Abrir el panel y ver que al primer polling se despachan los pendientes acumulados.
- [ ] Verificar que en serverless los contadores en memoria (lastRunAt) no hacen que una instancia nueva repita avisos ya enviados.
- [ ] Decidir con el dueño si acepta que esto solo corra en horario de operación o si hace falta un cron real.

### La suite automatizada cubre menos de lo que parece

**Qué es:** Es la red de seguridad con la que se va a decir 'todo probado' en la entrega.

- **Dónde:** `e2e/ tiene solo 4 specs (a11y.spec.ts, pwa-offline.spec.ts, responsive-forms.spec.ts, session-roles.spec.ts) · los 20+ scripts qa:* exigen dev server en :3177 más Supabase real (scripts/qa-lib.mjs:9) · scripts/smoke.mjs:12 todavía tiene BASE por defecto http://localhost:3000`
- **Quién entra:** Desarrollador.
- **Ya cubierto por:** CI (.github/workflows/ci.yml) corre solo tsc, lint, vitest y build con claves ficticias: NINGÚN qa:*, NINGÚN e2e de Playwright y NINGÚN smoke corren en CI
- **Por qué importa:** El riesgo no es el código, es el informe: si se entrega diciendo 'la suite pasó', el dueño va a creer que se probó cobrar, cocinar y cerrar el día, y eso no está en ningún test automatizado. Y correr la batería contra la base de producción por descuido daña datos reales del cliente: ya pasó una vez con la app de otro cliente en el puerto 3000.

**Pruebas:**

- [ ] Revisar spec por spec: los 4 archivos de e2e/ NO tocan carrito, ni caja, ni cocina, ni cierre de caja, ni cuentas abiertas; no confundir '15/15 en verde' con cobertura del negocio.
- [ ] Antes de correr cualquier qa:*, verificar contra QUÉ base apunta .env.local (apunta al Supabase de producción de Brotherhood) y qué app vive en el puerto que se va a usar.
- [ ] Corregir/forzar BASE=http://localhost:3177 al correr npm run smoke: su valor por defecto (3000) es la trampa exacta que scripts/qa-lib.mjs documenta como incidente pasado.
- [ ] Notar que scripts/qa-lib.mjs trae los UUID de las sedes de producción escritos a mano (BRANCH_SAN_DIEGO, BRANCH_VINEDO): en otra base esos scripts no prueban nada válido.
- [ ] Correr npm run qa:migraciones contra la base donde se va a operar y confirmar que 0036_order_cancellation_details.sql está aplicada (es la de la política de anulaciones).

# Prompt para la próxima sesión — Lote v4 Brotherhood (feedback 2026-07-22, tarde)

> Pega esto tal cual (o di: "lee LOTE-V4-PROMPT.md y ejecútalo por fases").

---

Trabaja el lote v4 de Brotherhood en la rama `brotherhood-publico` (repo D:/Santo edit).
Reglas fijas: verificar con `tsc + vitest + build` (NUNCA preview/navegador), un commit
por fase, deploy al final con `npx vercel --prod --yes` (autenticado, lo corro yo),
migraciones solo las escribo yo y las aplica el usuario, la estética actual no se toca
salvo lo pedido aquí, y TODO el flujo público debe poder usarlo una persona de tercera
edad sin escribir nada más que nombre, teléfono y con cuánto paga (lo demás = botones).
Lee las memorias `brotherhood-feedback-julio21` y `brotherhood-menu-loaded` antes de empezar.

Contexto: esto sale de probar el lote v3 EN VIVO (brotherhood-xi.vercel.app). Hay
capturas del cliente. Varias cosas del v3 quedaron a medias o con bugs; este lote las
remata.

---

## F1 — Barra superior del checkout/confirmación (modal "Pedido del cliente")

En `CartDrawer.tsx`, el modal de registro/confirmación (`isOrderModalOpen`) tiene un
header con el eyebrow **"PEDIDO DEL CLIENTE"** y un título grande (h3) que dice
"Identificar pedido" / "Enviando pedido" / **"Pedido confirmado"**.

1. **Quitar el eyebrow "PEDIDO DEL CLIENTE"** (el textito de arriba).
2. **Reducir la altura/tamaño de esa barra superior** (hoy ocupa mucho; hacerla más
   compacta, título más chico).
3. **Título correcto por estado:**
   - Mientras identifica/arma: **"Confirma tu pedido"** (hoy dice "Identificar pedido").
   - Ya creado pero **sin pagar** (pago pendiente): el header debe decir
     **"PEDIDO SIN PAGAR"**, NO "Pedido confirmado". Hoy el h3 usa
     `lastCreatedOrder ? "Pedido confirmado" : …` (aprox. línea 2870); debe ser
     `lastOrderPaymentPending ? "Pedido sin pagar" : lastCreatedOrder ? "Pedido confirmado" : …`.
     (El label chico del cuerpo ya dice "Pedido sin pagar"; falta el header.)
4. **Botón de Ayuda grande y llamativo AL LADO del título**, con texto
   **"¿Necesitas ayuda con tu pedido?"** (no "Ayuda"). Ver F3 (es el mismo botón en todos lados).

## F2 — BUG: "Reportar pago" no reporta, solo manda a ver el estado

En la pantalla de confirmación (la del número #25-s), el botón grande **"REPORTAR PAGO"**
es hoy un `<a href="/pedido/[id]">` (aprox. línea 2987 de `CartDrawer.tsx`): al tocarlo
solo abre la página de seguimiento y NO deja reportar el pago.

- El formulario de reporte (`PublicOrderPaymentSection`, con `autoOpenForm`) YA está
  renderizado más abajo en el MISMO modal. El botón "Reportar pago" debe **abrir/enfocar
  ese formulario ahí mismo** (scroll al `PublicOrderPaymentSection` y abrir su form), sin
  sacar al cliente a otra página.
- Cuando el pago ya no está pendiente (reportado/confirmado), el botón vuelve a decir
  "Ver el avance de mi pedido" y sí puede seguir linkeando a `/pedido/[id]`.
- Verificar el flujo completo: tocar "Reportar pago" → se abre el form → puede adjuntar
  captura/referencia → envía. (Ver también F4/F5/F6: el form debe entenderse.)

## F3 — Botón de Ayuda llamativo y consistente en TODA la experiencia

El botón de ayuda (guía completa, componente `PublicHelpGuide`) debe ser **grande y
llamativo** y decir **"¿Necesitas ayuda con tu pedido?"** en vez de "Ayuda", en:

1. El header del **carrito** ("TU PEDIDO").
2. El header del **checkout/confirmación** (F1).
3. (El botón flotante de la página puede quedarse como "Ayuda", pero evaluar unificar.)

Además, en el **carrito**: **reducir el tamaño del texto "TU PEDIDO"** (hoy es enorme)
para que el botón de ayuda quepa llamativo al lado.

## F4 — Efectivo en divisas: billetes y vuelto

En `renderCashChangeSection` (`CartDrawer.tsx`):

1. **Quitar el botón "Pago exacto".**
2. **Mostrar SIEMPRE los billetes 5 / 10 / 20 / 50 / 100** en divisas (hoy se filtran por
   `>= total`, así que con un total de €37.50 solo salen 50 y 100). El dueño quiere ver
   los 5 billetes siempre. (En Bs mantener un set razonable.)
3. **Conexión con la página privada (caja):** verificar que el monto con que paga el
   cliente y el **vuelto** viajen al pedido y se muestren en **Caja**, para que caja sepa
   cuánto vuelto dar. Revisar que `cashGivenAmount` / cambio se guarden en el pedido
   (nota o campo) y se rendericen en la tarjeta de caja. Arreglar si no llega.

## F5 — Contraste/claridad de las casillas de método de pago (sigue mal)

Las casillas para indicar el método de pago **se siguen viendo mal y no se entiende qué
hacer** (captura 3). Reforzar respecto al v3:

- Casillas con borde/etiqueta/fondo claramente distintos del fondo de la tarjeta.
- Instrucción corta y directa arriba de cada bloque ("Elige cómo pagas", "Escribe el
  monto", etc.), en lenguaje de tercera edad.
- Aplica tanto al checkout (`renderCheckoutPaymentSection` / `renderMixedPaymentSection`)
  como al reporte (`PublicOrderPaymentSection`).

## F6 — Métodos en divisas (Zelle) y datos de pago separados

1. En el **pago mixto**, el dropdown de "método de las divisas" hoy solo ofrece
   **"Efectivo en divisas"**. Debe ofrecer también **"Zelle"** (y cualquier otro método en
   divisas configurado). Esto depende de que **Zelle** esté en `publicPaymentMethods` y de
   que `isVesPaymentMethod("Zelle")` sea `false` (es divisa) — verificar `lib/paymentOptions.ts`.
2. En **"Datos para pagar"**: donde hoy dice **"Datos de transferencia"** debe decir
   **"Datos de Zelle"**, y poner **"Datos de transferencia"** como sección/entrada SEPARADA
   (transferencia = Bs local; Zelle = divisa). Esto es sobre `publicPaymentMethodDetails`
   (mapa método → líneas de datos) + cómo se listan en `PaymentMethodDetailsList`.
3. Probablemente haga falta ajustar la CONFIG del negocio (métodos + datos): si es data,
   escribir un script `scripts/brotherhood-lote-v4-metodos.mjs` (idempotente) que agregue
   "Zelle" a `publicPaymentMethods` y sus datos, y deje "Transferencia" con sus propios
   datos. Confirmar con el usuario los datos reales de Zelle antes de escribirlos.

## F7 — Plantilla de hamburguesas EDITABLE en el Menú avanzado

El dueño **no ve la plantilla** en el Menú avanzado/editable. El script del v3
(`brotherhood-burger-template-all.mjs`) aplicó `config.variations`/`config.addons` a las
28 burgers, pero el dueño no las encuentra ni las puede editar cómodamente.

Objetivo:
1. **Investigar** `src/app/local-santo/menu-avanzado/` (y el constructor de
   variaciones/adicionales/ingredientes) para ver si YA muestra las variaciones/extras que
   trae el `config` de cada producto. Si las muestra, el problema es de descubribilidad
   (que el dueño sepa dónde están). Si NO las muestra, agregarlo.
2. Que las hamburguesas aparezcan con la plantilla **pre-seleccionada** (variaciones +
   extras + custom fries) VISIBLE y **editable** por producto.
3. Ofrecer al dueño **editar la plantilla o ponerla "normal"** (opt-out por producto):
   un control claro tipo "Usar plantilla de hamburguesa" / "Producto normal".
4. Idealmente: una **plantilla global** editable una sola vez que todas las burgers
   hereden (nueva sección en el editor: "Plantillas"), en vez de editar 28 productos a mano.
   Evaluar alcance/riesgo con el usuario; puede ser fase aparte.
5. **Nuevas secciones en el editor**: "Variaciones" y "Extras" bien separadas y claras.

### Spec de la plantilla general (referencia del dueño, textual):

**Tipos de hamburguesas** (familias / variación de tipo):
1. Americanas
2. Sweeties
3. Uncle haze
4. Champie's
5. Parrilleras

**Escoge tu proteína** (variación de proteína, obligatoria, 1):
- Smash patty
- Big patty
- Lil chicken
- Chicken crispy
- Veggie Patty

**Extras con costo** (adicionales):
- Tocineta
- Chorizo
- Queso americano
- Ensalada clásica
- Champiñón
- Pepinillos
- Cebolla caramelizada
- Cebolla asada
- Salsa SPAY (picante medio)
- Cheddar crema
- Papas fritas

**Custom frys** (extras de las papas, con costo):
- Cheddar bacon
- Cheddar wurst
- Cheddar jalapeño

> Nota: la plantilla que aplicó el v3 ya incluye "Escoge tu proteína" + los extras +
> custom fries (deltas/precios en 0 o sugeridos). Falta la variación **"Tipos de
> hamburguesas"** y, sobre todo, que TODO esto sea **visible y editable** en el menú
> avanzado con una opción de plantilla vs normal.

## F8 — Opción activable "referencia/imagen obligatoria antes de avanzar"

Recordar y **verificar** que la opción `publicPaymentBeforeRegisterEnabled` (Configuración
→ "Comprobante antes de registrar") funcione: con métodos electrónicos, sin captura o
referencia completa no se puede registrar el pedido. Confirmar que quede clara y activable
(ver `NEGOCIO-OPCIONES-FLUJO.md`, punto 1). No es código nuevo salvo que esté roto.

## F9 — Verificación y cierre

`npx tsc --noEmit` + `npx vitest run` + `npm run build`; commit por fase; correr los
scripts de datos que hagan falta (F6, y re-correr burger-template si se amplía a "Tipos de
hamburguesas"); `npx vercel --prod --yes`; actualizar la memoria `brotherhood-feedback-julio21`.

Pendientes que NO son de esta sesión (no tocar): cadena Meta/WhatsApp (César crea la app),
claves VAPID para push en vivo, precios finales de burgers (dueño), verificación del negocio.

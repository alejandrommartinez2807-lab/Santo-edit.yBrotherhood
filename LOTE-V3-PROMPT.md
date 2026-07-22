# Prompt para la próxima sesión — Lote v3 Brotherhood (feedback 2026-07-22)

> Pega esto tal cual (o di: "lee LOTE-V3-PROMPT.md y ejecútalo por fases").

---

Trabaja el lote v3 de Brotherhood en la rama `brotherhood-publico` (repo D:/Santo edit). Reglas fijas: verificar con `tsc + vitest + build` (NUNCA preview/navegador), un commit por fase, deploy al final con `npx vercel --prod`, migraciones solo las escribo yo y las aplica el usuario, la estética actual no se toca, y TODO el flujo público debe poder usarlo una persona de tercera edad sin escribir nada más que nombre, teléfono y con cuánto paga (lo demás = botones). Lee la memoria `brotherhood-feedback-julio21` antes de empezar.

## F0 — Datos rápidos (BD, sin código)
1. Sede **San Diego**: fijar `googleMapsUrl` en `branchConfigs` (business_config) = `https://maps.app.goo.gl/UZ3ExmvEYx8kaGZt7`.
2. Quitar **"Por confirmar"** de los métodos de pago públicos: del default en `src/lib/publicPageConfig.ts` Y de `publicPaymentMethods` en la BD.

## F1 — Bug de la barra superior
Al hacer scroll, la barra compacta de categorías (Promos/Antojos/…) **se mezcla/monta con la fila de enlaces** (WhatsApp, Instagram, Inicio…). Reproducir leyendo `src/components/Navbar.tsx` (transiciones `max-h` de la barra completa vs compacta) y arreglar para que NUNCA se vean ambas a la vez ni se pisen.

## F2 — Plantilla en TODAS las hamburguesas (precios intactos)
Script tipo `scripts/brotherhood-burger-template.mjs` que aplique la estructura de la plantilla (grupo "Escoge tu proteína" + extras + custom fries, mismo formato `config` que los 5 borradores) a **todas las hamburguesas ACTIVAS** del menú en ambas sedes, **sin cambiar el precio base de ninguna** (deltas de proteína en 0 si no hay dato mejor). Objetivo: el dueño solo edita precios/deltas en Menú avanzado. Los 5 modelos borrador (AMERICANAS, SWEETIES…) se quedan como están.

## F3 — Textos y flujo de la confirmación (cliente que NO ha pagado)
En `CartDrawer` (pantalla post-registro), cuando el pago está pendiente:
1. Título: **"Pedido sin pagar"** (no "Pedido guardado").
2. El botón "Ver el avance de mi pedido" pasa a decir **"Reportar pago"** (y al pagar/confirmarse vuelve a "Ver el avance de mi pedido").
3. El botón final "Listo, volver al menú" pasa a decir **"Entiendo que no registré mi pago — volver al menú"** (solo cuando no ha reportado; si ya reportó, texto normal).
4. En el mensaje de WhatsApp "¿Dudas con tu pedido?": dejar SOLO el número de pedido grande (#XX-s) y **quitar la línea `Ref: ord-...`** (aplica en `pedido/[orderId]/page.tsx` y donde se arme ese texto en CartDrawer/recentPublicOrders).
5. El botón **Ayuda** (guía completa) debe estar visible también DENTRO del carrito/checkout, no solo en la página.

## F4 — Métodos de pago "para tontos"
1. **Contraste**: las casillas de los métodos de pago se ven blancas y no se entiende qué va en cada una — revisar los inputs de `renderCheckoutPaymentSection`/pago mixto/reporte (fondos `bg-white` sobre tarjeta clara) y darles borde/etiqueta/placeholder claros con el estilo de la marca.
2. **Pago mixto simplificado**: rehacer la UI para que sea imposible no entender: paso 1 "¿cuánto pagas en bolívares?" paso 2 "¿cuánto en divisas?", con el total visible, botones "Completar lo que falta" prominentes y validación que explique en cristiano qué falta.
3. **Efectivo en divisas**: botones rápidos de billete **5 / 10 / 20 / 50 / 100** (además del campo libre) para el vuelto.
4. **BUG a reproducir**: al subir una imagen de comprobante el sistema dijo "no se registró el método de pago" — revisar la validación de `PublicOrderPaymentSection`/`submitCheckoutProofForOrder` (probable: entries sin `method` cuando solo adjuntan captura) y arreglar para que la captura sola + método preseleccionado siempre pase.

## F5 — Caja: comprobantes a la vista y estados sincronizados
1. La **imagen del comprobante debe verse (miniatura ampliable) en la tarjeta del pedido** en caja apenas el cliente la manda — sin ir a la sección Comprobantes.
2. Verificar el ciclo comprobante ↔ pago: los botones En revisión / Confirmado / Rechazado / Necesita corrección deben reflejarse en el estado de pago del pedido, y al marcarlos el CLIENTE debe enterarse (su página de seguimiento ya sondea; sumar push si está suscrito).
3. Verificar que Preparando / Listo / Entregado de caja/cocina muevan el avance que ve el cliente (línea Recibido→Preparando→Listo) — probar el cableo completo y arreglar lo que no refresque.

## F6 — Código de anulación: visibilidad y rastro del motivo
1. El código debe verlo SOLO el **dueño (rol owner)** — hoy revisar `/api/cancellation-requests` y el panel: el **manager/administrador NO debe verlo**. El usuario (desarrollador) entra como dueño, así que con owner basta.
2. El usuario reportó que "al intentar cancelar no veo el código": verificar dónde vive la sección de códigos en el panel del dueño (`OwnerCancellationCodes`) y que sea fácil de encontrar; si el dueño activó push, debe llegarle también por notificación (y por WhatsApp cuando Meta esté conectado).
3. El **motivo de cancelación** debe verse: en el push/WhatsApp al dueño (ya va), en el **cierre de caja** y en el **historial de cierres** (los pedidos cancelados del día deben listar su motivo). Revisar `cierres` y agregar el motivo donde se listen cancelados.

## F7 — Activar flujos y explicárselos al dueño
1. Dejar activas las funciones acordadas (código de anulación YA está activo; evaluar con el usuario si se activa auto-cancel y con cuántos minutos).
2. Escribir en `NEGOCIO-OPCIONES-FLUJO.md` (lenguaje de dueño, sin tecnicismos) las opciones configurables para que el dueño elija: (a) pago ANTES de registrar vs registrar y reportar después; (b) minutos de anulación automática (0=off, sólo métodos electrónicos); (c) método de pago fijo vs cambiable; (d) promoción como sección o como ventana emergente; (e) qué hace cada una y qué recomienda el sistema.

## F8 — Verificación y cierre
`npx tsc --noEmit` + `npx vitest run` + `npm run build`; commit por fase; `npx vercel --prod`; actualizar la memoria `brotherhood-feedback-julio21` con lo hecho y pendientes.

Pendientes que NO son de esta sesión (no tocar): cadena Meta/WhatsApp (César crea la app / esperar desbloqueo), precios finales de burgers (dueño), método de pago en Meta, verificación del negocio.

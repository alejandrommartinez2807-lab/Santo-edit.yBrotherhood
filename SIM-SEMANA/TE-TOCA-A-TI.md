# TE TOCA A TI

Solo lo que yo no puedo hacer desde el repositorio o el entorno autorizado.
Todo lo demás de la semana ya quedó ejecutado, corregido y commiteado.

---

## 1. Llevar el fix de precio/tasa a producción (IMPORTANTE)

**Acción**: fusionar la rama `qa/simulacion-semana-real` (o solo el commit
`5c010d4`) a `main` y a `brotherhood-publico`, y desplegar.

**Por qué**: BH-SIM-001 y BH-SIM-002 son bugs **CRÍTICOS que existen hoy en el
Brotherhood en vivo**. Cualquiera que sepa abrir las herramientas del navegador
puede pedir por el QR una hamburguesa de $9,50 pagando $0,01, o reportar Bs a
una tasa inventada y que el sistema dé el pedido por pagado.

**Comando**:

```bash
git checkout brotherhood-publico && git cherry-pick 5c010d4
```

**Riesgo**: el re-precio se aplica a TODO pedido público. El menú real de
Brotherhood usa la plantilla de burger armable v2 (68 productos con
variaciones y adicionales). Antes de desplegar, **prueba un pedido armable
completo** (con extras y sin ingredientes) en el sitio y confirma que el total
que cobra el sistema es el que muestra el carrito. Si un producto armable usa
una regla de precio que no está en `variations`/`addons`/`includedIngredients`,
el guard lo rechazaría con "El menú cambió mientras armabas tu pedido".

**Cómo verificar después del deploy**: pide una burger normal por el QR y
confirma que entra; luego, con las herramientas del navegador, cambia el precio
en la petición y confirma que el pedido se guarda con el precio real.

**Qué queda bloqueado si no lo haces**: nada de la simulación, pero producción
sigue expuesta.

---

## 2. Decidir la política de tasa en modo automático (decisión de negocio)

**Acción**: decidir si, cuando el negocio usa tasa **BCV automática** (no
manual), el servidor debe imponer la última tasa cacheada al pedido público.

**Por qué**: el fix actual solo pisa la tasa del cliente cuando el negocio tiene
**tasa manual** configurada. Brotherhood usa BCV automática, así que en
producción el clamp fuerte **no se activa**. Un cliente podría seguir enviando
una tasa distinta.

**La decisión es tuya** porque tiene un compromiso real: si el servidor impone
siempre su tasa y el BCV está momentáneamente caído, los pedidos podrían
quedarse sin conversión a Bs. Opciones:

- (a) imponer siempre la última tasa cacheada del servidor (más seguro, riesgo
  de quedarse sin tasa si el cache está vacío);
- (b) aceptar la del cliente solo si está dentro de un ±5% de la del servidor
  (equilibrio, es lo que yo recomendaría);
- (c) dejarlo como está y confiar en que el cobro real lo hace la caja.

Dime cuál y lo implemento con su test.

---

## 3. Configurar VAPID para probar notificaciones de verdad

**Acción**: generar el par de claves VAPID y ponerlas en el entorno.

**Por qué**: sin ellas no hay entrega real de push. En la simulación quedó
`BLOCKED` (D2-NOTIF-1) — verifiqué que el evento interno se genera, pero no que
llegue a un teléfono.

**Qué queda bloqueado**: aviso de "pedido listo" al mesonero y al cliente,
alerta de anulación al dueño, alerta de stock bajo.

---

## 4. Credenciales de WhatsApp/Meta para un entorno de prueba

**Acción**: crear una app de Meta de PRUEBA (no la de producción) con su token
y número de test.

**Por qué**: usar las credenciales de producción está prohibido por el propio
Prompt Maestro, y sin unas de prueba no puedo ejercitar el envío de encuestas
ni las plantillas de botones.

**Qué queda bloqueado**: encuesta post-venta con botones, avisos por WhatsApp.

---

## 5. Confirmar la impresora física

**Acción**: probar con la impresora real de 80mm que la comanda sale al enviar
a cocina y el recibo al marcar Listo (el modo `printFlowMode: auto` quedó
configurado en la simulación).

**Por qué**: no hay hardware en este entorno. Es lo único de la lista que
requiere estar físicamente en el local.

---

## 6. (Opcional) Instalar Playwright si quieres las pruebas de navegador en verde

**Acción**:

```bash
npm i -D @playwright/test && npx playwright install chromium
```

**Por qué**: sin él, Service Worker, instalación de la PWA, offline real y
multipestaña de navegador quedan `BLOCKED` por la regla del propio prompt
(nunca `PASS` por inspección manual). Lo verificable por API ya se probó
(sesiones simultáneas, idempotencia del reenvío offline, caché de menú viejo).

**Nota**: si lo instalas, dímelo y escribo la batería E2E; no lo instalé por mi
cuenta porque añade ~300 MB de dependencias al repo y eso es tu decisión.

---

## 7. Limpieza del proyecto de prueba (cuando ya no lo necesites)

El Supabase `gnyvdlxlrjwbsdctincy` quedó con la semana completa dentro
(~470 pedidos, 14 cierres, auditoría completa). **Déjalo así si quieres poder
re-inspeccionar la evidencia.** Cuando ya no lo necesites, puedes borrar el
proyecto desde el panel de Supabase — no hay nada de producción ahí.

Para volver a correr la semana desde cero necesitarías re-aplicar
`SETUP-SUPABASE-PRUEBA.sql` en un proyecto limpio y ejecutar los scripts en
orden (están en `SIM-SEMANA/resumen-final.md`).

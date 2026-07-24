# Auto-revisión Brotherhood — TODOS los flujos lógicos (operación completa)

> Prompt de auto-revisión general (pedido del dueño 2026-07-23). Complementa
> `AUTO-REVISION-PAGOS.md` (matriz de pagos). En una sesión di: **"lee
> AUTO-REVISION-FLUJOS.md y corre la revisión completa"** — se verifica cada
> fila contra el código actual (y preview/API en vivo cuando aplique, SIN
> crear datos de prueba salvo pedidos PRUEBA-AUTO que se borran al final).

## 1. Ciclo de vida del pedido (por tipo)

| Tipo | Nace | Avanza | Termina |
|---|---|---|---|
| Mesa (Comer aquí) | Cliente/mesonero lo registra; si hay cuenta abierta se suma sola | Cocina: Preparando→Listo; mesonero entrega ITEM POR ITEM | Caja cobra la cuenta completa y la cierra |
| Pick up | Nace "Nuevo" + Esperando pago | Pago confirmado → cocina → Listo | Cliente retira → Entregado |
| Delivery | Igual + cotización por sede sumada al total | Igual + datos del repartidor | Entrega reportada → Entregado |

Verificar por fila: estados válidos por rol (`canRoleUpdateStatus` en
`/api/orders/[orderId]`), que ningún módulo pueda saltarse un paso que otro
módulo asume ocurrido, y que el kitchenFlowMode (kitchen/mixed/direct) cambie
los botones SIN romper las transiciones.

## 2. Conexión mesonero ↔ cocina ↔ caja
- Mesonero marca un producto como entregado → persiste (no se pisa con el
  refresco/polling) y caja/cocina lo VEN.
- Items con confirmación de staff pendiente → bloquean "A cocina"/"Listo" en
  TODOS los módulos por igual (no solo en uno).
- Cobro de caja → visible en mesonero/pedidos (chip Pagado) sin recargar a mano.
- Los tres módulos comparten fuente (`/api/orders` + x-branch-id): cualquier
  helper duplicado (isDeliveryOrder, builders de WhatsApp, payment form) debe
  tener LA MISMA lógica en cada copia — ya mordió dos veces (isDeliveryOrder
  con customerPhone; prefill solo en /caja y no en /pedidos).
- Cambiar de sede en el panel → los tres módulos filtran la MISMA sede.

## 3. Público ↔ staff (lo que el cliente ve)
- Estado del pedido (/pedido/[id] + confirmación): refleja cocina y cobro por
  polling ≤10s; comprobante confirmado/rechazado dispara push.
- Acciones de caja/comprobantes NUNCA degradan al cliente: confirmar la foto
  del efectivo no marca pagado ni bloquea la pata electrónica (matriz PAGOS).
- Anulación (staff o automática) → cliente ve motivo, se le deja de pedir plata.
- Cancelación del cliente (solo "Nuevo") → staff la ve con motivo, inventario
  revertido si aplicaba.

## 4. Sedes
- Menú, mesas, tasa, delivery (origen/tarifas), WhatsApp y links de
  Maps/reseñas: TODOS por sede con herencia de la principal.
- QR por sede fija la sede del cliente; cambiar sede en el checkout recotiza
  el delivery (header x-branch-id explícito).
- Sede pausada/cerrada/evento vencido → no acepta pedidos y lo dice claro.

## 5. Extras que se rompen calladamente
- Promoción: sección + pop-up (cierre vence a las 12h; cambia el contenido →
  reaparece); "Ver promoción" abre la ficha del producto.
- Reseñas: botón del Hero → selector por sede (links en Sucursales); pop-up
  post-entrega usa googleReviewUrl global.
- Notificaciones push por hito (cocina/pagado/listo/entregado) — requieren
  suscripción del botón "Avisarme"; iPhone solo PWA instalada.
- Repetir último pedido, cupones, reservas, cuenta abierta por QR de mesa.
- PWA: subir SW `santo-*-vN` al tocar UI pública; el auto-reload NO interrumpe
  a quien está pagando (se pospone si hay checkout/reporte a la vista).

## 6. Cómo correr la verificación
1. `npx tsc --noEmit` + `npx vitest run --dir ./src` + `npm run build` (log limpio).
2. Matriz de pagos: `AUTO-REVISION-PAGOS.md` (unit tests + e2e PRUEBA-AUTO con
   borrado al final; patrón en memoria del proyecto).
3. Preview CDP (solo lectura) de: home (promo pop-up, hero, navbar 360px),
   checkout mixto, /pedido en cada estado de pago, caja (precarga + avisos),
   y los tres módulos de staff con la MISMA sede.
4. Reportar: qué se verificó, qué falló (archivo:línea) y qué se corrigió.

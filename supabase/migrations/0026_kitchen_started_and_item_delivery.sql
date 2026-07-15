-- ============================================================
-- 0026: Cronómetro real de cocina + entrega por producto
--
-- 1) orders.kitchen_started_at: momento en que caja envía el pedido a
--    cocina (status → 'Preparando'). El cronómetro del módulo cocina cuenta
--    desde aquí y no desde la creación del pedido, que podía incluir el
--    tiempo de confirmación/pago en caja.
--
-- 2) order_items.delivered_at / delivered_by: en cuentas abiertas (y en
--    cualquier pedido) el personal puede ir marcando qué productos ya se
--    entregaron al cliente. NULL = aún no entregado.
--
-- Idempotente: se puede correr más de una vez. El código degrada con
-- gracia si esta migración no está aplicada (isMissingColumnError).
-- ============================================================

alter table orders
  add column if not exists kitchen_started_at timestamptz;

alter table order_items
  add column if not exists delivered_at timestamptz;

alter table order_items
  add column if not exists delivered_by text;

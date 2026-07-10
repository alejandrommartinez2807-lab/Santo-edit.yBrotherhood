-- ============================================================
-- Santo Edit · Atribución de ventas por persona
-- Migración: 0022_order_attribution
--
-- Guarda QUIÉN registró y QUIÉN cobró cada pedido, para el reporte de
-- ventas por vendedor/promotor y el desglose del cierre de caja/evento.
--
-- Columnas TEXT sin FK a propósito (mismo criterio que audit_logs y
-- delivery_reported_by): el pedido nunca debe fallar por un staff borrado.
-- - registered_by_*: staff que registró el pedido. NULL = pedido hecho por
--   el cliente desde la página pública (QR/web).
-- - charged_by_*: staff que registró el cobro (caja). Se escribe al cobrar.
--
-- El código escribe estas columnas de forma tolerante: si esta migración
-- aún no está aplicada, reintenta sin atribución (no rompe venta ni cobro).
-- ============================================================

alter table orders add column if not exists registered_by_id   text;
alter table orders add column if not exists registered_by_name text;
alter table orders add column if not exists registered_by_role text;

alter table orders add column if not exists charged_by_id   text;
alter table orders add column if not exists charged_by_name text;
alter table orders add column if not exists charged_by_role text;

-- Reporte de ventas por vendedor: agrupa por quien cobró.
create index if not exists idx_orders_charged_by on orders (charged_by_id);

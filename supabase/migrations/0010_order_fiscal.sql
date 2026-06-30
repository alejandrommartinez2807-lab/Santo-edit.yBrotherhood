-- ============================================================
-- Santo Edit · Desglose fiscal fijado en la orden
-- Migración: 0010_order_fiscal
--
-- Guarda el desglose fiscal (IVA por tasa, IGTF, total) calculado AL COBRAR,
-- para que no cambie aunque luego se editen precios o tasas. Y la tasa de IVA
-- usada por cada ítem en esa venta.
-- ============================================================

alter table orders add column if not exists fiscal jsonb;
alter table order_items add column if not exists iva_rate numeric;

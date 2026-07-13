-- ============================================================
-- Santo Edit · Hotel — folio_items.source_order_id a TEXT
-- Migración: 0027_folio_source_order_text
--
-- Los IDs de pedidos del POS son texto ("ord-mrjkwq6a-2xqqf"), no uuid. La
-- columna se creó como uuid en 0026 y rompía al cargar un pedido al folio.
-- Este ALTER la pasa a text (idempotente: si ya es text, no hace nada dañino).
-- Aplicar solo si ya se corrió 0026 con la versión antigua (uuid).
-- ============================================================

alter table folio_items
  alter column source_order_id type text using source_order_id::text;

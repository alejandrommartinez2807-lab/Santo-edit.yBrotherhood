-- 0038_order_items_touch_order.sql
-- Consumo de Supabase 2026-08-04 · el paso previo para dejar de leer la base
-- entera en cada sondeo.
--
-- Hoy `orders` tiene un trigger que estampa updated_at en cada UPDATE, así que
-- "¿cambió algo?" se puede responder con dos agregados baratos (54 bytes) en
-- vez de bajar 626 KB de filas. PERO hay escrituras que cambian lo que ve el
-- panel y NO tocan la fila del pedido:
--
--   1. Marcar (o desmarcar) UN producto como entregado escribe solo en
--      `order_items`. En un pedido de 3 productos, las dos primeras marcas
--      serían invisibles: cocina y caja se quedarían viendo "0 de 3".
--   2. Al crear un pedido, la fila de `orders` y sus líneas se insertan en dos
--      statements separados. Un sondeo que caiga justo en medio se llevaría la
--      comanda SIN productos, y como nada más cambia, se quedaría así.
--
-- Este trigger cierra las dos de una vez y a prueba de futuro: cualquier
-- escritura sobre las líneas —las de hoy y las que se escriban mañana— marca su
-- pedido como modificado.
--
-- Es idempotente: correrlo dos veces no rompe ni duplica nada.

create or replace function touch_order_from_items()
returns trigger as $$
begin
  -- En DELETE la fila nueva no existe; en INSERT/UPDATE la vieja no.
  update orders
     set updated_at = now()
   where id = coalesce(new.order_id, old.order_id);

  return null; -- AFTER trigger: el valor de retorno se ignora
end;
$$ language plpgsql;

drop trigger if exists trg_order_items_touch_order on order_items;

create trigger trg_order_items_touch_order
  after insert or update or delete on order_items
  for each row execute function touch_order_from_items();

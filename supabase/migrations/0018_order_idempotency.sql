-- ============================================================
-- Santo Edit · Idempotencia de pedidos (sync offline)
-- Migración: 0018_order_idempotency
--
-- Cuando un POS pierde internet, los pedidos se encolan localmente y se
-- reenvían al reconectar (ver src/lib/offlineQueue + OfflineSync). Si un
-- pedido SÍ llegó al servidor pero la red se cortó antes de la respuesta,
-- el reintento crearía un DUPLICADO. Para evitarlo, el cliente genera una
-- clave única por pedido (client_order_id, un uuid) que viaja en el payload
-- y se reusa en cada reintento. El servidor, antes de crear, busca esa clave
-- y si ya existe devuelve el pedido existente en vez de crear otro.
--
-- El índice único parcial garantiza la unicidad incluso ante reintentos
-- concurrentes (la segunda inserción falla y el código devuelve el existente).
-- Es parcial (where client_order_id is not null) para no afectar a los
-- pedidos históricos ni a los creados sin clave (canal normal con red).
-- ============================================================

alter table orders
  add column if not exists client_order_id text;

create unique index if not exists idx_orders_client_order_id
  on orders (client_order_id)
  where client_order_id is not null;

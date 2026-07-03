-- ============================================================
-- Santo Edit · Modo entrenamiento
-- Migración: 0021_training_mode
--
-- Marca de "pedido de práctica". Los pedidos creados con Modo entrenamiento
-- activo quedan con is_training = true y se EXCLUYEN de reportes, del descuento
-- de inventario al entregar y del cierre real. Por defecto false: los pedidos
-- y negocios existentes no cambian en nada hasta que alguien use el modo.
-- ============================================================

alter table orders
  add column if not exists is_training boolean not null default false;

-- Índice parcial: la inmensa mayoría de pedidos son reales (false), así que
-- solo indexamos los de entrenamiento para filtrarlos barato.
create index if not exists idx_orders_is_training
  on orders (is_training)
  where is_training = true;

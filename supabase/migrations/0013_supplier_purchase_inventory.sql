-- ============================================================
-- Santo Edit · Compras → Inventario (Proveedores Fase 2b)
-- Migración: 0013_supplier_purchase_inventory
--
-- Permite que una compra a proveedor sume stock a un insumo del inventario.
-- Es OPCIONAL por compra. La entrada de stock se registra como un movimiento
-- de inventario ("Compra") para auditoría.
--
-- Comportamiento ADITIVO: la entrada aplicada al inventario NO se revierte al
-- editar o borrar la compra (igual que el flujo gasto→inventario existente).
--
-- inventory_item_id es ON DELETE SET NULL (si se borra el insumo, la compra
-- conserva el snapshot del nombre/cantidad).
-- ============================================================

alter table supplier_purchases
  add column if not exists inventory_item_id text references inventory_items(id) on delete set null,
  add column if not exists inventory_item_name text not null default '',
  add column if not exists inventory_quantity numeric(14,3) not null default 0,
  add column if not exists inventory_unit text not null default '',
  add column if not exists inventory_movement_id text not null default '';

create index if not exists idx_supplier_purchases_inv_item on supplier_purchases (inventory_item_id);

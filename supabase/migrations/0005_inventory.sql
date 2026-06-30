-- ============================================================
-- Santo Edit · Inventario (Fase 3c)
-- Migración: 0005_inventory
--
-- Recrea las tablas de inventario para que calcen con la forma real que usa
-- la app (ids de texto, campos planos) y agrega la tabla de movimientos.
-- Las tablas previas (inventory_items, inventory_recipes) estaban vacías
-- (nunca se usaron), por eso se pueden recrear sin pérdida de datos.
-- ============================================================

drop table if exists inventory_recipes cascade;
drop table if exists inventory_items cascade;

-- Insumos ------------------------------------------------------
create table inventory_items (
  id                   text primary key,         -- id de texto (ej. "inv-...")
  name                 text not null,
  category             text not null default 'General',
  quantity             numeric(14,3) not null default 0,
  unit                 text not null default 'unidades',
  minimum_stock        numeric(14,3) not null default 0,
  cost_usd             numeric(12,4) not null default 0,
  cost_ves             numeric(14,4) not null default 0,
  equivalent_cost_usd  numeric(12,4) not null default 0,
  note                 text not null default '',
  is_active            boolean not null default true,
  updated_at           timestamptz not null default now()
);
create index idx_inventory_items_active on inventory_items (is_active);

-- Movimientos de inventario ------------------------------------
create table inventory_movements (
  id                 text primary key,
  date_label         text not null default '',
  item_id            text not null,
  item_name          text not null default '',
  movement_type      text not null default 'Ajuste',
  previous_quantity  numeric(14,3) not null default 0,
  quantity_moved     numeric(14,3) not null default 0,
  final_quantity     numeric(14,3) not null default 0,
  unit               text not null default 'unidades',
  reason             text not null default 'Movimiento manual',
  related_expense    boolean not null default false,
  expense_id         text not null default '',
  note               text not null default '',
  created_at         timestamptz not null default now()
);
create index idx_inventory_movements_item on inventory_movements (item_id);
create index idx_inventory_movements_created on inventory_movements (created_at desc);

-- Recetas (producto del menú -> insumos consumidos) ------------
create table inventory_recipes (
  id                text primary key,            -- id de texto (ej. "rec-...")
  product_id        bigint not null default 0,
  product_name      text not null default '',
  product_category  text not null default '',
  ingredients       jsonb not null default '[]'::jsonb,  -- [{itemId,itemName,quantity,unit}]
  note              text not null default '',
  is_active         boolean not null default true,
  updated_at        timestamptz not null default now()
);
create index idx_inventory_recipes_product on inventory_recipes (product_id);

-- RLS: cerrado por defecto (solo el servidor con service role key) ---
alter table inventory_items     enable row level security;
alter table inventory_movements enable row level security;
alter table inventory_recipes   enable row level security;

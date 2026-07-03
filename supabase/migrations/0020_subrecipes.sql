-- ============================================================
-- Santo Edit · Subrecetas (recetas base reutilizables)
-- Migración: 0020_subrecipes
--
-- Preparaciones base (carnes, masas, salsas, mezclas) hechas a partir de
-- insumos del inventario. Cada subreceta rinde una cantidad (yield) y guarda
-- sus ingredientes como jsonb, igual que inventory_recipes. El costo se calcula
-- en lectura a partir del costo de cada insumo (no se almacena).
-- Aislada por sucursal (branch_id) y con RLS cerrado (solo service role).
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists subrecipes (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  name           text not null,
  yield_quantity numeric(14,3) not null default 1,
  yield_unit     text not null default 'porción',
  ingredients    jsonb not null default '[]'::jsonb, -- [{itemId,itemName,quantity,unit}]
  note           text not null default '',
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_subrecipes_branch on subrecipes (branch_id);

-- RLS: cerrado por defecto (solo el servidor con service role key).
alter table subrecipes enable row level security;

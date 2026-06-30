-- ============================================================
-- Santo Edit · Multi-sucursal (Fase 1: fundación)
-- Migración: 0009_branches
--
-- Cada sucursal tiene su propio menú, inventario, pedidos, caja y cierres.
-- Se agrega branch_id a todas las tablas operativas. Los datos existentes se
-- reasignan a una sucursal "Principal" creada aquí, para no perder nada.
-- (business_config sigue compartido: marca, tema y módulos del negocio.)
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table branches enable row level security;

-- Sucursal por defecto (idempotente: solo si no hay ninguna).
insert into branches (name, sort_order)
select 'Principal', 1
where not exists (select 1 from branches);

-- Agrega branch_id a las tablas operativas (nullable; se backfillea abajo).
do $$
declare
  t text;
  tables text[] := array[
    'menu_products', 'tables', 'orders', 'open_accounts',
    'inventory_items', 'inventory_movements', 'inventory_recipes',
    'day_closes', 'day_expenses', 'delivery_zones', 'payment_proofs'
  ];
  default_branch uuid;
begin
  select id into default_branch from branches order by sort_order, created_at limit 1;

  foreach t in array tables loop
    execute format('alter table %I add column if not exists branch_id uuid references branches(id) on delete cascade', t);
    execute format('update %I set branch_id = %L where branch_id is null', t, default_branch);
    execute format('create index if not exists idx_%s_branch on %I (branch_id)', t, t);
  end loop;
end $$;

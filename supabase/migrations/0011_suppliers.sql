-- ============================================================
-- Santo Edit · Proveedores (Fase 1: CRUD / listado)
-- Migración: 0011_suppliers
--
-- Tabla base de proveedores por sucursal. Fase 1 es de bajo riesgo:
-- solo datos de contacto (nombre, contacto, teléfono, email, nota). No
-- toca cobro ni inventario todavía; eso queda para fases posteriores.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists suppliers (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id) on delete cascade,
  name         text not null,
  contact_name text not null default '',
  phone        text not null default '',
  email        text not null default '',
  note         text not null default '',
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_suppliers_branch on suppliers (branch_id);

-- RLS: cerrado por defecto (solo el servidor con service role key).
alter table suppliers enable row level security;

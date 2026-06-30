-- ============================================================
-- Santo Edit · Compras a proveedores (Proveedores Fase 2a)
-- Migración: 0012_supplier_purchases
--
-- Registro e historial de compras a cada proveedor. Bajo riesgo: solo
-- captura el dato de la compra (proveedor, fecha, documento, total, nota).
-- NO toca inventario ni cuentas por pagar todavía (fases posteriores).
--
-- supplier_id es ON DELETE SET NULL y guardamos un snapshot `supplier_name`
-- para que el historial de compras sobreviva si se elimina el proveedor.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists supplier_purchases (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete cascade,
  supplier_id     uuid references suppliers(id) on delete set null,
  supplier_name   text not null default '',
  purchase_date   date not null default current_date,
  document_number text not null default '',
  total_usd       numeric(14,2) not null default 0,
  total_ves       numeric(16,2) not null default 0,
  note            text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists idx_supplier_purchases_branch on supplier_purchases (branch_id);
create index if not exists idx_supplier_purchases_supplier on supplier_purchases (supplier_id);

-- RLS: cerrado por defecto (solo el servidor con service role key).
alter table supplier_purchases enable row level security;

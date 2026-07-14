-- ============================================================
-- Hotel · Fase 16: FACTURACIÓN
-- Factura generada desde el folio: número correlativo, datos fiscales y totales
-- (subtotal, impuesto, total). Migración ADITIVA por branch_id.
-- ============================================================

create table if not exists invoices (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  reservation_id uuid references hotel_reservations(id) on delete set null,
  folio_id       uuid references folios(id) on delete set null,
  number         integer not null default 0,
  serie          text not null default 'A',
  customer_name  text not null default '',
  customer_rif   text not null default '',
  subtotal       numeric(12,2) not null default 0,
  tax_rate       numeric(6,3) not null default 0,
  tax            numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_invoices_branch on invoices (branch_id, number);

alter table invoices enable row level security;

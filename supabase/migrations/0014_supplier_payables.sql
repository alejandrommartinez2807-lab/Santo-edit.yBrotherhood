-- 0014_supplier_payables.sql
-- Fase 2d: Cuentas por pagar de proveedores.
-- Agrega vencimientos, estado de pago, acumulados pagados y tabla de abonos.

alter table if exists supplier_purchases
  add column if not exists due_date date,
  add column if not exists paid_usd numeric(12,2) not null default 0,
  add column if not exists paid_ves numeric(14,2) not null default 0,
  add column if not exists payment_status text not null default 'Pendiente',
  add column if not exists payment_method text not null default '',
  add column if not exists payment_reference text not null default '',
  add column if not exists payment_note text not null default '',
  add column if not exists last_payment_at timestamptz;

update supplier_purchases
set
  paid_usd = coalesce(paid_usd, 0),
  paid_ves = coalesce(paid_ves, 0),
  payment_status = case
    when coalesce(paid_usd, 0) <= 0 and coalesce(paid_ves, 0) <= 0 then 'Pendiente'
    when coalesce(total_usd, 0) > 0 and coalesce(paid_usd, 0) >= coalesce(total_usd, 0) - 0.01 then 'Pagado'
    when coalesce(total_usd, 0) <= 0 and coalesce(total_ves, 0) > 0 and coalesce(paid_ves, 0) >= coalesce(total_ves, 0) - 0.01 then 'Pagado'
    else 'Parcial'
  end,
  payment_method = coalesce(payment_method, ''),
  payment_reference = coalesce(payment_reference, ''),
  payment_note = coalesce(payment_note, '')
where true;

create table if not exists supplier_purchase_payments (
  id text primary key,
  branch_id text,
  purchase_id text not null,
  supplier_id text,
  supplier_name text not null default '',
  payment_date date not null default current_date,
  amount_usd numeric(12,2) not null default 0,
  amount_ves numeric(14,2) not null default 0,
  method text not null default '',
  reference text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_supplier_purchase_payments_branch
  on supplier_purchase_payments(branch_id);

create index if not exists idx_supplier_purchase_payments_purchase
  on supplier_purchase_payments(purchase_id);

create index if not exists idx_supplier_purchase_payments_supplier
  on supplier_purchase_payments(supplier_id);

create index if not exists idx_supplier_purchase_payments_date
  on supplier_purchase_payments(payment_date desc);

create index if not exists idx_supplier_purchases_payment_status
  on supplier_purchases(payment_status);

create index if not exists idx_supplier_purchases_due_date
  on supplier_purchases(due_date);

-- Constraints idempotentes para instalaciones que corren migraciones manualmente.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'supplier_purchases_payment_status_check'
  ) then
    alter table supplier_purchases
      add constraint supplier_purchases_payment_status_check
      check (payment_status in ('Pendiente', 'Parcial', 'Pagado'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'supplier_purchase_payments_amount_check'
  ) then
    alter table supplier_purchase_payments
      add constraint supplier_purchase_payments_amount_check
      check (amount_usd >= 0 and amount_ves >= 0 and (amount_usd > 0 or amount_ves > 0));
  end if;
end $$;

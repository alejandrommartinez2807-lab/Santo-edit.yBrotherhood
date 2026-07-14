-- ============================================================
-- Hotel · Fase 9: PAGOS / DEPÓSITOS DE RESERVA
-- Depósitos reportados antes del check-in (pago móvil, Zelle, transferencia)
-- con referencia, para conciliar. Migración ADITIVA por branch_id.
-- ============================================================

create table if not exists reservation_payments (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  reservation_id uuid references hotel_reservations(id) on delete cascade,
  method         text not null default 'transferencia', -- pago_movil | zelle | transferencia | efectivo | otro
  amount         numeric(12,2) not null default 0,
  reference      text not null default '',
  status         text not null default 'reportado',      -- reportado | confirmado | rechazado
  note           text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists idx_reservation_payments_branch on reservation_payments (branch_id, created_at);
create index if not exists idx_reservation_payments_res on reservation_payments (reservation_id);

alter table reservation_payments enable row level security;

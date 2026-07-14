-- ============================================================
-- Hotel · Fase 15: CIERRE DE DÍA (night audit)
-- Snapshot diario de la operación (llegadas, salidas, en casa, ingreso de
-- habitación de la noche). Migración ADITIVA por branch_id.
-- ============================================================

create table if not exists business_days (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  date          date not null,
  arrivals      integer not null default 0,
  departures    integer not null default 0,
  in_house      integer not null default 0,
  room_revenue  numeric(12,2) not null default 0,
  note          text not null default '',
  closed_at     timestamptz not null default now()
);

create index if not exists idx_business_days_branch on business_days (branch_id, date);

alter table business_days enable row level security;

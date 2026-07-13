-- ============================================================
-- Hotel · Fase 18: RESTRICCIONES DE TARIFA
--
-- Reglas por rango de fechas y tipo de habitación que condicionan la venta:
--   · min_stay             = estancia mínima de noches (según fecha de llegada)
--   · closed_to_arrival    = no se permite ENTRAR ese día (CTA)
--   · closed_to_departure  = no se permite SALIR ese día (CTD)
--
-- room_type_id NULL = aplica a TODOS los tipos. Rango [from_date, to_date]
-- inclusive (como rate_seasons). Migración ADITIVA, aislada por branch_id.
-- ============================================================

create table if not exists rate_restrictions (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid references branches(id) on delete cascade,
  room_type_id         uuid references room_types(id) on delete cascade,
  from_date            date not null,
  to_date              date not null,
  min_stay             integer not null default 1,
  closed_to_arrival    boolean not null default false,
  closed_to_departure  boolean not null default false,
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint rate_restrictions_dates_ck check (to_date >= from_date)
);

create index if not exists idx_rate_restrictions_branch
  on rate_restrictions (branch_id, from_date, to_date);

alter table rate_restrictions enable row level security;
